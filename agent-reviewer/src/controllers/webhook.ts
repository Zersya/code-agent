import { Request, Response } from 'express';
import { GitLabPushEvent, GitLabMergeRequestEvent, GitLabWebhookEvent, GitLabNoteEvent, GitLabEmojiEvent } from '../types/webhook.js';
import { RepopoWebhookEvent } from '../types/review.js';
import { gitlabService } from '../services/gitlab.js';
import { embeddingService } from '../services/embedding.js';
import { dbService } from '../services/database.js';
import { reviewService } from '../services/review.js';
import { webhookDeduplicationService } from '../services/webhook-deduplication.js';
import { EmbeddingBatch, ProjectMetadata } from '../models/embedding.js';

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
      res.status(500).json({ error: 'Failed to process webhook' });
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
        if (isRepopoEvent) {
          await processRepopoMergeRequestEvent(event as RepopoWebhookEvent);
        } else {
          await processMergeRequestEvent(event as GitLabMergeRequestEvent);
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

    const gitlabProjectId = event.project.id;
    const mergeRequestIid = event.object_attributes.iid;
    const sourceBranch = event.object_attributes.source_branch;
    const commitId = event.object_attributes.last_commit.id;

    // Generate a consistent project ID
    const projectId = event.project.id

    console.log(`Processing merge request event for GitLab project ${gitlabProjectId}, using consistent project ID ${projectId}, MR !${mergeRequestIid}, commit ${commitId}`);

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
 * Process a Repopo merge request event
 * This function handles merge request events from Repopo and triggers the review process
 */
async function processRepopoMergeRequestEvent(event: RepopoWebhookEvent) {
  try {
    // Handle merge completion events for Repopo as well
    if (event.object_attributes.action === 'merge') {
      await processMergeCompletionEvent(event);
      return;
    }

    // Only process merge requests that are opened or updated
    if (!['open', 'update'].includes(event.object_attributes.action || '')) {
      console.log(`Skipping Repopo merge request event with action: ${event.object_attributes.action}`);
      return;
    }

    const projectId = event.project.id;
    const mergeRequestIid = event.object_attributes.iid;

    console.log(`Processing Repopo merge request event for project ${projectId}, MR !${mergeRequestIid}`);

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
