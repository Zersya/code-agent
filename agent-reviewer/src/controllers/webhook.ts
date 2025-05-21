import { Request, Response } from 'express';
import { GitLabPushEvent, GitLabMergeRequestEvent, GitLabWebhookEvent } from '../types/webhook.js';
import { RepopoWebhookEvent } from '../types/review.js';
import { gitlabService } from '../services/gitlab.js';
import { embeddingService } from '../services/embedding.js';
import { dbService } from '../services/database.js';
import { reviewService } from '../services/review.js';
import { queueService } from '../services/queue.js';
import { v4 as uuidv4 } from 'uuid';
import { CodeFile, EmbeddingBatch, ProjectMetadata } from '../models/embedding.js';

/**
 * Process a GitLab webhook event
 */
export const processWebhook = async (req: Request, res: Response, next: Function) => {
  try {
    const event: GitLabWebhookEvent = req.body;

    console.log(`Received webhook event: ${event.object_kind}`);

    // Acknowledge receipt of the webhook immediately
    res.status(202).json({ message: 'Webhook received and processing started' });

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
    } else {
      console.log(`Ignoring unsupported event type`);
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
    // We've already sent a response, so we just log the error
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

    const projectId = event.project_id;
    const commitId = event.after;
    const branch = event.ref.replace('refs/heads/', '');

    console.log(`Processing push event for project ${projectId}, commit ${commitId}, branch ${branch}`);

    // Get project metadata
    let projectMetadata = await dbService.getProjectMetadata(projectId);

    if (!projectMetadata) {
      const projectDetails = await gitlabService.getProject(projectId);

      projectMetadata = {
        projectId,
        name: projectDetails.name,
        description: projectDetails.description || '',
        url: projectDetails.web_url,
        defaultBranch: projectDetails.default_branch,
        lastProcessedCommit: '',
        lastProcessedAt: new Date(),
        isEmbeddingInProgress: false
      };

      // Save the new project metadata
      await dbService.saveProjectMetadata(projectMetadata);
    }

    // Skip if we've already processed this commit
    if (projectMetadata.lastProcessedCommit === commitId) {
      console.log(`Commit ${commitId} already processed, skipping`);
      return;
    }

    // Check if the project is already being embedded
    if (projectMetadata.isEmbeddingInProgress) {
      console.log(`Project ${projectId} is already being embedded, skipping duplicate embedding`);
      return;
    }

    // Set the project as being embedded
    projectMetadata.isEmbeddingInProgress = true;
    const processingId = uuidv4();
    projectMetadata.lastEmbeddingJobId = processingId;
    await dbService.updateProjectMetadata(projectMetadata);

    try {
      // Get all files from the repository at this commit
      console.log(`Fetching files for project ${projectId} at commit ${commitId}`);
      const files = await gitlabService.getAllFiles(projectId, commitId);

      if (files.length === 0) {
        console.log('No files found, skipping');
        // Reset the embedding status
        projectMetadata.isEmbeddingInProgress = false;
        await dbService.updateProjectMetadata(projectMetadata);
        return;
      }

      console.log(`Found ${files.length} files, generating embeddings`);

      // Generate embeddings for all files
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
      projectMetadata.isEmbeddingInProgress = false; // Reset the embedding status
      await dbService.updateProjectMetadata(projectMetadata);

      console.log(`Successfully processed push event for project ${projectId}, commit ${commitId}`);
    } catch (error) {
      console.error(`Error processing push event for project ${projectId}:`, error);

      // Reset the embedding status in case of error
      try {
        projectMetadata.isEmbeddingInProgress = false;
        await dbService.updateProjectMetadata(projectMetadata);
      } catch (updateError) {
        console.error(`Error resetting embedding status for project ${projectId}:`, updateError);
      }

      throw error;
    }
  } catch (error) {
    console.error('Error processing push event:', error);
  }
}

/**
 * Process a merge request event
 */
async function processMergeRequestEvent(event: GitLabMergeRequestEvent) {
  try {
    // Only process merge requests that are opened or updated
    if (!['open', 'update'].includes(event.object_attributes.action || '')) {
      console.log(`Skipping merge request event with action: ${event.object_attributes.action}`);
      return;
    }

    const projectId = event.project.id;
    const mergeRequestIid = event.object_attributes.iid;
    const sourceBranch = event.object_attributes.source_branch;
    const commitId = event.object_attributes.last_commit.id;

    console.log(`Processing merge request event for project ${projectId}, MR !${mergeRequestIid}, commit ${commitId}`);

    // Get project metadata
    let projectMetadata = await dbService.getProjectMetadata(projectId);

    if (!projectMetadata) {
      const projectDetails = await gitlabService.getProject(projectId);

      projectMetadata = {
        projectId,
        name: projectDetails.name,
        description: projectDetails.description || '',
        url: projectDetails.web_url,
        defaultBranch: projectDetails.default_branch,
        lastProcessedCommit: '',
        lastProcessedAt: new Date(),
        isEmbeddingInProgress: false
      };

      // Save the new project metadata
      await dbService.saveProjectMetadata(projectMetadata);
    }

    // Check if the project is already being embedded
    if (projectMetadata.isEmbeddingInProgress) {
      console.log(`Project ${projectId} is already being embedded, skipping duplicate embedding`);
      return;
    }

    // Set the project as being embedded
    projectMetadata.isEmbeddingInProgress = true;
    const processingId = uuidv4();
    projectMetadata.lastEmbeddingJobId = processingId;
    await dbService.updateProjectMetadata(projectMetadata);

    try {
      // Get all files from the source branch
      console.log(`Fetching files for project ${projectId} at branch ${sourceBranch}`);
      const files = await gitlabService.getAllFiles(projectId, sourceBranch);

      if (files.length === 0) {
        console.log('No files found, skipping');
        // Reset the embedding status
        projectMetadata.isEmbeddingInProgress = false;
        await dbService.updateProjectMetadata(projectMetadata);
        return;
      }

      console.log(`Found ${files.length} files, generating embeddings`);

      // Generate embeddings for all files
      const embeddings = await embeddingService.generateEmbeddings(
        files,
        projectId,
        commitId,
        sourceBranch
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
        branch: sourceBranch,
        files,
        embeddings,
        createdAt: new Date(),
      };

      await dbService.saveBatch(batch);

      // Update project metadata
      projectMetadata.lastProcessedCommit = commitId;
      projectMetadata.lastProcessedAt = new Date();
      projectMetadata.isEmbeddingInProgress = false; // Reset the embedding status
      await dbService.updateProjectMetadata(projectMetadata);

      console.log(`Successfully processed merge request event for project ${projectId}, MR !${mergeRequestIid}`);
    } catch (error) {
      console.error(`Error processing merge request event for project ${projectId}:`, error);

      // Reset the embedding status in case of error
      try {
        projectMetadata.isEmbeddingInProgress = false;
        await dbService.updateProjectMetadata(projectMetadata);
      } catch (updateError) {
        console.error(`Error resetting embedding status for project ${projectId}:`, updateError);
      }

      throw error;
    }
  } catch (error) {
    console.error('Error processing merge request event:', error);
  }
}

/**
 * Process a Repopo merge request event
 * This function handles merge request events from Repopo and triggers the review process
 */
async function processRepopoMergeRequestEvent(event: RepopoWebhookEvent) {
  try {
    // Only process merge requests that are opened or updated
    if (!['open', 'update'].includes(event.object_attributes.action || '')) {
      console.log(`Skipping Repopo merge request event with action: ${event.object_attributes.action}`);
      return;
    }

    const projectId = event.project.id;
    const mergeRequestIid = event.object_attributes.iid;

    console.log(`Processing Repopo merge request event for project ${projectId}, MR !${mergeRequestIid}`);

    // Get project metadata
    let projectMetadata = await dbService.getProjectMetadata(projectId);
    let shouldProcessEmbeddings = true;

    if (projectMetadata) {
      // Check if the project is already being embedded
      if (projectMetadata.isEmbeddingInProgress) {
        console.log(`Project ${projectId} is already being embedded, skipping duplicate embedding`);
        shouldProcessEmbeddings = false;
      }
    }

    // Process the merge request to generate embeddings if needed
    if (shouldProcessEmbeddings) {
      await processMergeRequestEvent(event);
    }

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
