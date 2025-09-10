import { Request, Response } from 'express';
import { GitLabPushEvent, GitLabMergeRequestEvent, GitLabWebhookEvent, GitLabNoteEvent, GitLabEmojiEvent, GitLabMergeRequestAttributes } from '../types/webhook.js';
import { RepopoWebhookEvent } from '../types/review.js';
import { gitlabService } from '../services/gitlab.js';
import { embeddingService } from '../services/embedding.js';
import { dbService } from '../services/database.js';
import { reviewService } from '../services/review.js';
import { webhookDeduplicationService } from '../services/webhook-deduplication.js';
import { performanceService } from '../services/performance.js';
import { whatsappService } from '../services/whatsapp.js';
import { taskMRMappingService } from '../services/task-mr-mapping.js';
import { completionRateService } from '../services/completion-rate.js';
import { EmbeddingBatch, ProjectMetadata } from '../models/embedding.js';
import { WhatsAppNotificationContext, NotificationType } from '../models/whatsapp.js';

/**
 * Helper function to check if a merge request is in draft status
 */
function isDraftMergeRequest(attributes: GitLabMergeRequestAttributes): boolean {
  return attributes.work_in_progress === true;
}

/**
 * Helper function to check if a merge request transitioned from draft to ready
 */
function isTransitionFromDraftToReady(event: GitLabMergeRequestEvent): boolean {
  return event.changes?.work_in_progress?.previous === true &&
         event.changes?.work_in_progress?.current === false;
}

/**
 * Helper function to determine if a merge request should be processed
 * Returns true if MR is ready OR if it's transitioning from draft to ready
 */
function shouldProcessMergeRequest(event: GitLabMergeRequestEvent): boolean {
  const isDraft = isDraftMergeRequest(event.object_attributes);
  const isTransition = isTransitionFromDraftToReady(event);

  // Process if not draft OR if transitioning from draft to ready
  return !isDraft || isTransition;
}

/**
 * Process a GitLab webhook event
 */
export const processWebhook = async (req: Request, res: Response) => {
  try {
    const event: GitLabWebhookEvent = req.body;

    console.log(`Received webhook event: ${event.object_kind}`);

    // Check for duplicate webhook processing
    const deduplicationResult = await webhookDeduplicationService.startWebhookProcessing(event);

    if (!deduplicationResult.success) {
      console.error('Error starting webhook processing:', deduplicationResult.error);
      console.error('Event details:', {
        object_kind: event.object_kind,
        project_id: event.project?.id || (event as any).project_id,
        event_size: JSON.stringify(event).length
      });
      res.status(500).json({
        error: 'Failed to process webhook',
        details: deduplicationResult.error,
        event_type: event.object_kind
      });
      return;
    }

    if (deduplicationResult.isDuplicate) {
      console.log(`Webhook is already being processed (ID: ${deduplicationResult.processingId}), returning success`);
      res.status(202).json({
        message: 'Webhook already being processed',
        processingId: deduplicationResult.processingId
      });
      return;
    }

    // Acknowledge receipt of the webhook immediately
    res.status(202).json({
      message: 'Webhook received and processing started',
      processingId: deduplicationResult.processingId
    });

    const processingId = deduplicationResult.processingId!;

    try {
      // Check if this is a Repopo webhook event
      const isRepopoEvent = isRepopoWebhook(req);

      // Process the event asynchronously
      if (event.object_kind === 'push') {
        await processPushEvent(event);
      } else if (event.object_kind === 'merge_request') {
        const mrEvent = event as GitLabMergeRequestEvent;
        const repopoToken = isRepopoEvent ? extractRepopoToken(req) : null;

        // Save MR tracking data first
        await saveMergeRequestTrackingData(mrEvent, isRepopoEvent, repopoToken);

        // Then process the event normally
        if (isRepopoEvent) {
          await processRepopoMergeRequestEvent(event as RepopoWebhookEvent);
        } else {
          await processMergeRequestEvent(mrEvent);
        }
      } else if (event.object_kind === 'note') {
        await processNoteEvent(event as GitLabNoteEvent);
      } else if (event.object_kind === 'emoji') {
        await processEmojiEvent(event as GitLabEmojiEvent);
      } else {
        console.log(`Ignoring unsupported event type: ${(event as any).object_kind}`);
      }

      // Mark processing as completed
      await webhookDeduplicationService.completeWebhookProcessing(processingId);
    } catch (processingError) {
      console.error('Error processing webhook:', processingError);

      // Mark processing as failed
      const errorMessage = processingError instanceof Error ? processingError.message : 'Unknown error';
      await webhookDeduplicationService.failWebhookProcessing(processingId, errorMessage);
    }
  } catch (error) {
    console.error('Error in webhook handler:', error);
    // Only send response if we haven't already sent one
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

/**
 * Check if a webhook request is from Repopo
 */
function isRepopoWebhook(req: Request): boolean {
  // Check for Repopo-specific headers or query parameters
  const repopoToken = req.headers['x-repopo-token'] || req.query.repopo_token;

  // Check if the request body contains Repopo-specific fields
  const hasRepopoFields = req.body && req.body.repopo_token;

  // Check if the request comes from a Repopo domain
  const repopoReferer = req.headers.referer && req.headers.referer.includes('repopo');

  // Check if the user agent contains Repopo
  const repopoUserAgent = req.headers['user-agent'] && req.headers['user-agent'].includes('Repopo');

  return Boolean(repopoToken || hasRepopoFields || repopoReferer || repopoUserAgent);
}

/**
 * Extract Repopo token from request
 */
function extractRepopoToken(req: Request): string | null {
  const token = req.headers['x-repopo-token'] || req.query.repopo_token || req.body?.repopo_token;
  return token ? String(token) : null;
}

/**
 * Save merge request tracking data
 */
async function saveMergeRequestTrackingData(event: GitLabMergeRequestEvent, isRepopo: boolean, repopoToken?: string | null) {
  try {
    const action = event.object_attributes.action || 'unknown';
    const trackingData = {
      project_id: event.project.id,
      merge_request_iid: event.object_attributes.iid,
      merge_request_id: event.object_attributes.id,
      title: event.object_attributes.title,
      description: event.object_attributes.description,
      author_id: event.object_attributes.author?.id || event.user.id,
      author_username: event.user.username,
      author_name: event.user.name,
      source_branch: event.object_attributes.source_branch,
      target_branch: event.object_attributes.target_branch,
      status: event.object_attributes.state,
      action,
      created_at: new Date(event.object_attributes.created_at),
      updated_at: new Date(event.object_attributes.updated_at),
      approved_at: action === 'approved' ? new Date(event.object_attributes.updated_at) : null,
      merged_at: null, // Will be updated when merge event is processed
      closed_at: null, // Will be updated when close event is processed
      merge_commit_sha: null, // Will be updated when merge event is processed
      repository_url: event.project.web_url,
      web_url: event.object_attributes.url,
      is_repopo_event: isRepopo,
      repopo_token: repopoToken
    };

    await dbService.saveMergeRequestTracking(trackingData);

    // Update user statistics
    await dbService.updateUserMRStatistics(
      event.object_attributes.author?.id || event.user.id,
      event.user.username,
      event.project.id
    );

    // Send WhatsApp notifications for merge request events
    try {
      const action = event.object_attributes.action;
      const assignees = event.reviewers || [];

      console.log(event);

      // Get all relevant users (assignee + assignees/reviewers)
      const getTargetUsers = (): string[] => {
        const users: string[] = [];

        // Add additional assignees/reviewers
        assignees.forEach(user => {
          if (user?.username && !users.includes(user.username)) {
            users.push(user.username);
          }
        });

        return users;
      };

      const targetUsers = getTargetUsers();

      // Send notification for merge request creation (only if assignee/reviewers are set)
      if (action === 'open') {
        if (targetUsers.length > 0) {
          console.log(`Sending MR created notification to: ${targetUsers.join(', ')}`);
          await sendWhatsAppNotifications('merge_request_created', event, targetUsers);
        } else {
          console.log('No assignee or reviewers set for MR creation, skipping WhatsApp notification');
        }
      }

      // Send notification for merge request assignment (when assignee/reviewers are added/changed)
      if (action === 'update' && targetUsers.length > 0) {
        // Check if assignment actually changed by looking at the changes object
        const hasAssignmentChange = event.changes?.assignee || event.changes?.assignees;

        if (hasAssignmentChange) {
          console.log(`Sending MR assignment change notification to: ${targetUsers.join(', ')}`);
          await sendWhatsAppNotifications('merge_request_assigned', event, targetUsers);
        }
      }

      // Send notification for merge request merge (only to assignee/reviewers if exist)
      if (action === 'merge') {
        if (targetUsers.length > 0) {
          console.log(`Sending MR merged notification to: ${targetUsers.join(', ')}`);
          await sendWhatsAppNotifications('merge_request_merged', event, targetUsers);
        } else {
          console.log('No assignee or reviewers for merged MR, skipping WhatsApp notification');
        }
      }

      // Send notification for merge request close (only to assignee/reviewers if exist)
      if (action === 'close') {
        if (targetUsers.length > 0) {
          console.log(`Sending MR closed notification to: ${targetUsers.join(', ')}`);
          await sendWhatsAppNotifications('merge_request_closed', event, targetUsers);
        } else {
          console.log('No assignee or reviewers for closed MR, skipping WhatsApp notification');
        }
      }
    } catch (notificationError) {
      console.error('Error sending WhatsApp notifications:', notificationError);
      // Don't throw error to avoid breaking existing functionality
    }

    console.log(`Saved MR tracking data for project ${event.project.id}, MR !${event.object_attributes.iid}`);
  } catch (error) {
    console.error('Error saving MR tracking data:', error);
    // Don't throw error to avoid breaking existing functionality
  }
}

/**
 * Process a push event
 */
async function processPushEvent(event: GitLabPushEvent) {
  try {
    // Skip if this is a branch deletion
    if (event.after === '0000000000000000000000000000000000000000') {
      console.log('Skipping branch deletion event');
      return;
    }

    const gitlabProjectId = event.project_id;
    const commitId = event.after;
    const branch = event.ref.replace('refs/heads/', '');

    // Generate a consistent project ID
    const projectId = event.project.id

    console.log(`Processing push event for GitLab project ${gitlabProjectId}, using consistent project ID ${projectId}, commit ${commitId}, branch ${branch}`);

    // Get project metadata
    let projectMetadata = await dbService.getProjectMetadata(projectId);

    if (!projectMetadata) {
      const projectDetails = await gitlabService.getProject(gitlabProjectId);

      projectMetadata = {
        projectId,
        name: projectDetails.name,
        description: projectDetails.description || '',
        url: projectDetails.web_url,
        defaultBranch: branch,
        lastProcessedCommit: '',
        lastProcessedAt: new Date(),
        lastReembeddingAt: undefined
      };
    }

    // Skip if we've already processed this commit
    if (projectMetadata.lastProcessedCommit === commitId) {
      console.log(`Commit ${commitId} already processed, skipping`);
      return;
    }

    // Get all files from the repository at this commit
    console.log(`Fetching files for project ${projectId} at commit ${commitId}`);
    const files = await gitlabService.getAllFiles(projectId, commitId);

    if (files.length === 0) {
      console.log('No files found, skipping');
      return;
    }

    console.log(`Found ${files.length} files, generating embeddings`);

    // Generate embeddings for all files using the consistent project ID
    const embeddings = await embeddingService.generateEmbeddings(
      files,
      projectId,
      commitId,
      branch
    );

    // Add repository URL to embeddings
    const repositoryUrl = event.project.web_url;
    embeddings.forEach(embedding => {
      embedding.repositoryUrl = repositoryUrl;
    });

    console.log(`Generated ${embeddings.length} embeddings, saving to database`);

    // Save embeddings to database
    await dbService.saveEmbeddings(embeddings);

    // Save batch information
    const batch: EmbeddingBatch = {
      projectId,
      commitId,
      branch,
      files,
      embeddings,
      createdAt: new Date(),
    };

    await dbService.saveBatch(batch);

    // Update project metadata
    projectMetadata.lastProcessedCommit = commitId;
    projectMetadata.lastProcessedAt = new Date();
    await dbService.updateProjectMetadata(projectMetadata);

    console.log(`Successfully processed push event for project ${projectId}, commit ${commitId}`);
  } catch (error) {
    console.error('Error processing push event:', error);
  }
}

/**
 * Process a merge request event
 */
async function processMergeRequestEvent(event: GitLabMergeRequestEvent) {
  try {
    // Handle merge completion events differently
    if (event.object_attributes.action === 'merge') {
      await processMergeCompletionEvent(event);
      return;
    }

    // Only process merge requests that are opened or updated for regular processing
    if (!['open', 'update'].includes(event.object_attributes.action || '')) {
      console.log(`Skipping merge request event with action: ${event.object_attributes.action}`);
      return;
    }

    // Check if merge request should be processed based on draft status
    if (!shouldProcessMergeRequest(event)) {
      const gitlabProjectId = event.project.id;
      const mergeRequestIid = event.object_attributes.iid;
      console.log(`Skipping draft merge request !${mergeRequestIid} in project ${gitlabProjectId} (work_in_progress: ${event.object_attributes.work_in_progress})`);
      return;
    }

    const gitlabProjectId = event.project.id;
    const mergeRequestIid = event.object_attributes.iid;
    const sourceBranch = event.object_attributes.source_branch;
    const commitId = event.object_attributes.last_commit.id;

    // Generate a consistent project ID
    const projectId = event.project.id

    // Log processing with draft status information
    const isDraft = isDraftMergeRequest(event.object_attributes);
    const isTransition = isTransitionFromDraftToReady(event);
    const statusInfo = isDraft ? 'draft' : 'ready';
    const transitionInfo = isTransition ? ' (transitioned from draft to ready)' : '';

    console.log(`Processing ${statusInfo} merge request event${transitionInfo} for GitLab project ${gitlabProjectId}, using consistent project ID ${projectId}, MR !${mergeRequestIid}, commit ${commitId}`);

    // Get project metadata
    let projectMetadata = await dbService.getProjectMetadata(projectId);

    if (!projectMetadata) {
      const projectDetails = await gitlabService.getProject(gitlabProjectId);

      projectMetadata = {
        projectId,
        name: projectDetails.name,
        description: projectDetails.description || '',
        url: projectDetails.web_url,
        defaultBranch: sourceBranch,
        lastProcessedCommit: '',
        lastProcessedAt: new Date(),
        lastReembeddingAt: undefined
      };
    }

    // Get all files from the source branch
    console.log(`Fetching files for project ${projectId} at branch ${sourceBranch}`);
    const files = await gitlabService.getAllFiles(projectId, sourceBranch);

    if (files.length === 0) {
      console.log('No files found, skipping');
      return;
    }


    // Check if the project has embeddings and trigger embedding process if needed
    // We don't wait for completion here, as we'll still proceed with the review
    // even if the embedding process is still running
    await embeddingService.checkAndEmbedProject(projectId, true);

    // has embeddings
    // const hasEmbeddings = await dbService.hasEmbeddings(projectId);
    // if (!hasEmbeddings) {
    //   console.log(`Found ${files.length} files, generating embeddings`);

    //   // Generate embeddings for all files
    //   const embeddings = await embeddingService.generateEmbeddings(
    //     files,
    //     projectId,
    //     commitId,
    //     sourceBranch
    //   );

    //   // Add repository URL to embeddings
    //   const repositoryUrl = event.project.web_url;
    //   embeddings.forEach(embedding => {
    //     embedding.repositoryUrl = repositoryUrl;
    //   });

    //   console.log(`Generated ${embeddings.length} embeddings, saving to database`);

    //   // Save embeddings to database
    //   await dbService.saveEmbeddings(embeddings);

    //   // Save batch information
    //   const batch: EmbeddingBatch = {
    //     projectId,
    //     commitId,
    //     branch: sourceBranch,
    //     files,
    //     embeddings,
    //     createdAt: new Date(),
    //   };

    //   await dbService.saveBatch(batch);

    //   // Update project metadata
    //   projectMetadata.lastProcessedCommit = commitId;
    //   projectMetadata.lastProcessedAt = new Date();
    //   await dbService.updateProjectMetadata(projectMetadata);

    //   return;
    // }

    // Process task-MR mappings for Notion URLs in description
    try {
      if (event.object_attributes.description) {
        await taskMRMappingService.processMergeRequestForTaskMapping(
          projectId,
          mergeRequestIid,
          event.object_attributes.id,
          event.object_attributes.description,
          event.user?.username
        );
        console.log(`Processed task-MR mappings for MR !${mergeRequestIid}`);
      }
    } catch (taskMappingError) {
      console.error(`Error processing task mappings for MR !${mergeRequestIid}:`, taskMappingError);
    }

    console.log(`Successfully processed merge request event for project ${projectId}, MR !${mergeRequestIid}`);
  } catch (error) {
    console.error('Error processing merge request event:', error);
  }
}

/**
 * Process a merge completion event
 * This function handles when a merge request is successfully merged and triggers re-embedding
 */
async function processMergeCompletionEvent(event: GitLabMergeRequestEvent) {
  try {
    const projectId = event.project.id;
    const mergeRequestIid = event.object_attributes.iid;
    const targetBranch = event.object_attributes.target_branch;
    const repositoryUrl = event.project.web_url;

    console.log(`Processing merge completion event for project ${projectId}, MR !${mergeRequestIid}, target branch: ${targetBranch}`);

    // Check if the merge was successful
    if (event.object_attributes.state !== 'merged') {
      console.log(`Merge request !${mergeRequestIid} is not in merged state (${event.object_attributes.state}), skipping re-embedding`);
      return;
    }

    // Update merge request tracking data with merged_at timestamp and merge_commit_sha
    try {
      const updateData = {
        project_id: projectId,
        merge_request_iid: mergeRequestIid,
        merge_request_id: event.object_attributes.id,
        title: event.object_attributes.title,
        description: event.object_attributes.description,
        author_id: event.object_attributes.author?.id || event.user?.id,
        author_username: event.user?.username || event.object_attributes.author?.username,
        author_name: event.user?.name || event.object_attributes.author?.name,
        source_branch: event.object_attributes.source_branch,
        target_branch: event.object_attributes.target_branch,
        status: event.object_attributes.state,
        action: event.object_attributes.action || 'merge',
        created_at: new Date(event.object_attributes.created_at),
        updated_at: new Date(event.object_attributes.updated_at),
        merged_at: new Date(event.object_attributes.merged_at || new Date()),
        closed_at: event.object_attributes.closed_at ? new Date(event.object_attributes.closed_at) : null,
        merge_commit_sha: event.object_attributes.merge_commit_sha,
        repository_url: event.project.web_url,
        web_url: event.object_attributes.url,
        is_repopo_event: false,
        repopo_token: null
      };

      await dbService.saveMergeRequestTracking(updateData);
      console.log(`Updated merge request tracking data for project ${projectId}, MR !${mergeRequestIid} with merged_at timestamp`);

      // Update user statistics
      if (updateData.author_id) {
        await dbService.updateUserMRStatistics(
          updateData.author_id,
          updateData.author_username,
          projectId
        );
      }

      // Process performance metrics for merged MR
      try {
        await performanceService.processMRForQualityMetrics(
          event.object_attributes.id,
          projectId,
          updateData.author_id
        );
        console.log(`Processed performance metrics for merged MR !${mergeRequestIid}`);
      } catch (metricsError) {
        console.error(`Error processing performance metrics for MR !${mergeRequestIid}:`, metricsError);
      }

      // Update task completion status for associated Notion tasks
      try {
        await taskMRMappingService.updateTaskCompletionOnMerge(projectId, mergeRequestIid);
        console.log(`Updated task completion status for merged MR !${mergeRequestIid}`);
      } catch (taskError) {
        console.error(`Error updating task completion for MR !${mergeRequestIid}:`, taskError);
      }

      // Trigger completion rate recalculation
      try {
        await completionRateService.onMergeRequestMerged(
          projectId,
          mergeRequestIid,
          updateData.author_username
        );
        console.log(`Triggered completion rate recalculation for merged MR !${mergeRequestIid}`);
      } catch (completionRateError) {
        console.error(`Error recalculating completion rate for MR !${mergeRequestIid}:`, completionRateError);
      }
    } catch (updateError) {
      console.error(`Error updating merge request tracking data for MR !${mergeRequestIid}:`, updateError);
    }

    // Trigger re-embedding for the project
    console.log(`Triggering re-embedding for project ${projectId} after successful merge to ${targetBranch}`);

    try {
      const reEmbeddingSuccess = await embeddingService.triggerProjectReEmbedding(projectId, repositoryUrl, targetBranch);

      if (reEmbeddingSuccess) {
        console.log(`Successfully queued re-embedding for project ${projectId} after merge !${mergeRequestIid}`);
      } else {
        console.error(`Failed to queue re-embedding for project ${projectId} after merge !${mergeRequestIid}`);
      }
    } catch (reEmbeddingError) {
      console.error(`Error triggering re-embedding for project ${projectId} after merge !${mergeRequestIid}:`, reEmbeddingError);
    }
  } catch (error) {
    console.error('Error processing merge completion event:', error);
  }
}

/**
 * Process a Repopo merge completion event
 * This function handles when a Repopo merge request is successfully merged
 */
async function processRepopoMergeCompletionEvent(event: RepopoWebhookEvent) {
  try {
    const projectId = event.project.id;
    const mergeRequestIid = event.object_attributes.iid;
    const targetBranch = event.object_attributes.target_branch;
    const repositoryUrl = event.project.web_url;

    console.log(`Processing Repopo merge completion event for project ${projectId}, MR !${mergeRequestIid}, target branch: ${targetBranch}`);

    // Check if the merge was successful
    if (event.object_attributes.state !== 'merged') {
      console.log(`Merge request !${mergeRequestIid} is not in merged state (${event.object_attributes.state}), skipping`);
      return;
    }

    // Update merge request tracking data with merged_at timestamp and merge_commit_sha for Repopo
    try {
      const updateData = {
        project_id: projectId,
        merge_request_iid: mergeRequestIid,
        merge_request_id: event.object_attributes.id,
        title: event.object_attributes.title,
        description: event.object_attributes.description,
        author_id: event.object_attributes.author?.id || event.user?.id,
        author_username: event.user?.username || event.object_attributes.author?.username,
        author_name: event.user?.name || event.object_attributes.author?.name,
        source_branch: event.object_attributes.source_branch,
        target_branch: event.object_attributes.target_branch,
        status: event.object_attributes.state,
        action: event.object_attributes.action || 'merge',
        created_at: new Date(event.object_attributes.created_at),
        updated_at: new Date(event.object_attributes.updated_at),
        merged_at: new Date(event.object_attributes.merged_at || new Date()),
        closed_at: event.object_attributes.closed_at ? new Date(event.object_attributes.closed_at) : null,
        merge_commit_sha: event.object_attributes.merge_commit_sha,
        repository_url: event.project.web_url,
        web_url: event.object_attributes.url,
        is_repopo_event: true,
        repopo_token: event.repopo_token || null
      };

      await dbService.saveMergeRequestTracking(updateData);
      console.log(`Updated Repopo merge request tracking data for project ${projectId}, MR !${mergeRequestIid} with merged_at timestamp`);

      // Update user statistics
      if (updateData.author_id) {
        await dbService.updateUserMRStatistics(
          updateData.author_id,
          updateData.author_username,
          projectId
        );
      }

      // Process performance metrics for merged Repopo MR
      try {
        await performanceService.processMRForQualityMetrics(
          event.object_attributes.id,
          projectId,
          updateData.author_id
        );
        console.log(`Processed performance metrics for merged Repopo MR !${mergeRequestIid}`);
      } catch (metricsError) {
        console.error(`Error processing performance metrics for Repopo MR !${mergeRequestIid}:`, metricsError);
      }
    } catch (updateError) {
      console.error(`Error updating Repopo merge request tracking data for MR !${mergeRequestIid}:`, updateError);
    }

    // Trigger re-embedding for the project
    console.log(`Triggering re-embedding for project ${projectId} after successful Repopo merge to ${targetBranch}`);

    try {
      const reEmbeddingSuccess = await embeddingService.triggerProjectReEmbedding(projectId, repositoryUrl, targetBranch);

      if (reEmbeddingSuccess) {
        console.log(`Successfully queued re-embedding for project ${projectId} after Repopo merge !${mergeRequestIid}`);
      } else {
        console.error(`Failed to queue re-embedding for project ${projectId} after Repopo merge !${mergeRequestIid}`);
      }
    } catch (reEmbeddingError) {
      console.error(`Error triggering re-embedding for project ${projectId} after Repopo merge !${mergeRequestIid}:`, reEmbeddingError);
    }
  } catch (error) {
    console.error('Error processing Repopo merge completion event:', error);
  }
}

/**
 * Process a Repopo merge request event
 * This function handles merge request events from Repopo and triggers the review process
 */
async function processRepopoMergeRequestEvent(event: RepopoWebhookEvent) {
  try {
    // Handle merge completion events for Repopo as well
    if (event.object_attributes.action === 'merge') {
      await processRepopoMergeCompletionEvent(event);
      return;
    }

    // Only process merge requests that are opened or updated
    if (!['open', 'update'].includes(event.object_attributes.action || '')) {
      console.log(`Skipping Repopo merge request event with action: ${event.object_attributes.action}`);
      return;
    }

    // Check if merge request should be processed based on draft status
    if (!shouldProcessMergeRequest(event)) {
      const projectId = event.project.id;
      const mergeRequestIid = event.object_attributes.iid;
      console.log(`Skipping draft Repopo merge request !${mergeRequestIid} in project ${projectId} (work_in_progress: ${event.object_attributes.work_in_progress})`);
      return;
    }

    const projectId = event.project.id;
    const mergeRequestIid = event.object_attributes.iid;

    // Log processing with draft status information
    const isDraft = isDraftMergeRequest(event.object_attributes);
    const isTransition = isTransitionFromDraftToReady(event);
    const statusInfo = isDraft ? 'draft' : 'ready';
    const transitionInfo = isTransition ? ' (transitioned from draft to ready)' : '';

    console.log(`Processing ${statusInfo} Repopo merge request event${transitionInfo} for project ${projectId}, MR !${mergeRequestIid}`);

    // First, process the merge request normally to generate embeddings
    await processMergeRequestEvent(event);

    // Then, trigger the review process
    console.log(`Starting review for merge request !${mergeRequestIid} in project ${projectId}`);

    try {
      // Submit the review (this will add a comment and approve if appropriate)
      await reviewService.submitReview(projectId, mergeRequestIid);
      console.log(`Successfully reviewed merge request !${mergeRequestIid} in project ${projectId}`);
    } catch (reviewError) {
      console.error(`Error reviewing merge request !${mergeRequestIid} in project ${projectId}:`, reviewError);
    }
  } catch (error) {
    console.error('Error processing Repopo merge request event:', error);
  }
}

/**
 * Process a note (comment) event
 * This function handles note events and checks for emoji reactions that trigger re-reviews
 */
async function processNoteEvent(event: GitLabNoteEvent) {
  try {
    console.log(`Processing note event for project ${event.project_id}, note ${event.object_attributes.id}`);

    // Only process notes on merge requests
    if (event.object_attributes.noteable_type !== 'MergeRequest' || !event.merge_request) {
      console.log('Note is not on a merge request, skipping');
      return;
    }

    // Check if this note contains the trigger phrase for re-review
    // const noteBody = event.object_attributes.note;
    // const triggerPhrase = 'Merge request has already been reviewed';

    // if (!noteBody.includes(triggerPhrase)) {
    //   console.log('Note does not contain re-review trigger phrase, skipping');
    //   return;
    // }

    // console.log(`Found note with re-review trigger phrase: "${triggerPhrase}"`);

    // Get emoji reactions for this note to check if any were added
    const projectId = event.project_id;
    const noteId = event.object_attributes.id;

    try {
      const emojis = await gitlabService.getNoteEmojis(projectId, noteId);

      if (emojis.length > 0) {
        console.log(`Found ${emojis.length} emoji reactions on note ${noteId}, triggering re-review`);

        const mergeRequestIid = event.merge_request.iid;
        await triggerReReview(projectId, mergeRequestIid, 'emoji_reaction_on_note');
      } else {
        console.log(`No emoji reactions found on note ${noteId}`);
      }
    } catch (error) {
      console.error(`Error checking emoji reactions for note ${noteId}:`, error);
    }
  } catch (error) {
    console.error('Error processing note event:', error);
  }
}

/**
 * Process an emoji event
 * This function handles emoji reactions and triggers re-reviews when appropriate
 */
async function processEmojiEvent(event: GitLabEmojiEvent) {
  try {
    console.log(`Processing emoji event for project ${event.project_id}, emoji ${event.object_attributes.name}, action: ${event.object_attributes.action}, event type: ${event.event_type}`);

    // Only process emoji additions (not removals)
    if (event.event_type !== 'award') {
      console.log('Emoji was removed, not added, skipping');
      return;
    }

    // Only process emojis on notes/comments
    if (event.object_attributes.awardable_type !== 'Note' || !event.note) {
      console.log('Emoji is not on a note, skipping');
      return;
    }

    // Check if the note is on a merge request
    if (!event.merge_request) {
      console.log('Note is not on a merge request, skipping');
      return;
    }

    // Check if the note contains the trigger phrase for re-review
    // const noteBody = event.note.note;
    // const triggerPhrase = 'Merge request has already been reviewed';

    // if (!noteBody.includes(triggerPhrase)) {
    //   console.log('Note does not contain re-review trigger phrase, skipping');
    //   return;
    // }

    // console.log(`Emoji ${event.object_attributes.name} added to note with re-review trigger phrase, triggering re-review`);

    const projectId = event.project_id;
    const mergeRequestIid = event.merge_request.iid;

    await triggerReReview(projectId, mergeRequestIid, 'emoji_reaction');
  } catch (error) {
    console.error('Error processing emoji event:', error);
  }
}

/**
 * Trigger a re-review for a merge request
 */
async function triggerReReview(projectId: number, mergeRequestIid: number, trigger: string) {
  try {
    console.log(`Triggering re-review for MR !${mergeRequestIid} in project ${projectId} due to ${trigger}`);

    // Submit the re-review
    await reviewService.submitReReview(projectId, mergeRequestIid);

    console.log(`Successfully triggered re-review for MR !${mergeRequestIid} in project ${projectId}`);
  } catch (error) {
    console.error(`Error triggering re-review for MR !${mergeRequestIid} in project ${projectId}:`, error);
  }
}

/**
 * Send WhatsApp notifications for merge request events
 */
async function sendWhatsAppNotifications(
  notificationType: NotificationType,
  event: GitLabMergeRequestEvent,
  targetUsernames?: string[]
) {
  try {
    if (!whatsappService.isEnabled()) {
      console.log('WhatsApp service is disabled, skipping notifications');
      return;
    }

    // Get active WhatsApp configurations for this notification type
    const configurations = await dbService.getActiveWhatsAppConfigurationsForNotification(notificationType);

    if (configurations.length === 0) {
      console.log(`No active WhatsApp configurations found for notification type: ${notificationType}`);
      return;
    }

    // Filter configurations based on target usernames if provided
    let targetConfigurations = configurations;
    if (targetUsernames && targetUsernames.length > 0) {
      targetConfigurations = configurations.filter(config =>
        targetUsernames.includes(config.gitlab_username)
      );
    }

    if (targetConfigurations.length === 0) {
      console.log(`No matching WhatsApp configurations found for target users: ${targetUsernames?.join(', ')}`);
      return;
    }

    // Prepare notification context
    const context: WhatsAppNotificationContext = {
      type: notificationType,
      projectName: event.project.name,
      mergeRequestTitle: event.object_attributes.title,
      mergeRequestUrl: event.object_attributes.url,
      authorName: event.object_attributes.author?.name || event.user?.name || 'Unknown',
      assigneeName: event.reviewers[0].name,
      reviewerName: undefined // Will be set for review_completed notifications
    };

    // Send notifications to all target configurations
    const notificationPromises = targetConfigurations.map(async (config) => {
      try {
        console.log(`Sending WhatsApp notification to ${config.gitlab_username} (${config.whatsapp_number}) for ${notificationType}`);

        const result = await whatsappService.sendMergeRequestNotification(
          config.whatsapp_number,
          context
        );

        if (result.success) {
          console.log(`Successfully sent WhatsApp notification to ${config.gitlab_username}`);
        } else {
          console.error(`Failed to send WhatsApp notification to ${config.gitlab_username}: ${result.error}`);
        }

        return result;
      } catch (error) {
        console.error(`Error sending WhatsApp notification to ${config.gitlab_username}:`, error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Wait for all notifications to complete
    const results = await Promise.allSettled(notificationPromises);

    const successCount = results.filter(result =>
      result.status === 'fulfilled' && result.value.success
    ).length;

    const failureCount = results.length - successCount;

    console.log(`WhatsApp notification summary for ${notificationType}: ${successCount} sent, ${failureCount} failed`);

  } catch (error) {
    console.error(`Error sending WhatsApp notifications for ${notificationType}:`, error);
  }
}
