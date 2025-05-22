import { Request, Response } from 'express';
import {
  GitLabPushEvent,
  GitLabMergeRequestEvent,
  GitLabWebhookEvent,
  GitLabNoteEvent,
  GitLabEmojiEvent,
  GitHubPushEvent,
  GitHubPullRequestEvent,
  GitHubIssueCommentEvent,
  GitHubPullRequestReviewCommentEvent,
  AgenticCodingRequest,
  AgenticCodingResult
} from '../types/webhook.js';
import { RepopoWebhookEvent } from '../types/review.js';
import { gitlabService } from '../services/gitlab.js';
import { githubService, GitHubService } from '../services/github.js';
import { agenticCodingService, AgenticCodingService } from '../services/agentic-coding.js';
import { embeddingService } from '../services/embedding.js';
import { dbService } from '../services/database.js';
import { reviewService } from '../services/review.js';
import { repositoryService } from '../services/repository.js';
import { CodeFile, EmbeddingBatch, ProjectMetadata } from '../models/embedding.js';

/**
 * Process a webhook event (GitLab or GitHub)
 */
export const processWebhook = async (req: Request, res: Response, next: Function) => {
  try {
    // Determine webhook platform
    const platform = determineWebhookPlatform(req);

    console.log(`Received ${platform} webhook event`);

    // Acknowledge receipt of the webhook immediately
    res.status(202).json({ message: 'Webhook received and processing started' });

    // Process the event asynchronously based on platform
    if (platform === 'gitlab') {
      await processGitLabWebhook(req);
    } else if (platform === 'github') {
      await processGitHubWebhook(req);
    } else {
      console.log(`Unsupported webhook platform: ${platform}`);
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
    // We've already sent a response, so we just log the error
  }
};

/**
 * Determine webhook platform from request headers and body
 */
function determineWebhookPlatform(req: Request): 'gitlab' | 'github' | 'unknown' {
  // Check GitHub headers
  if (req.headers['x-github-event'] || req.headers['x-hub-signature'] || req.headers['x-hub-signature-256']) {
    return 'github';
  }

  // Check GitLab headers
  if (req.headers['x-gitlab-event'] || req.headers['x-gitlab-token']) {
    return 'gitlab';
  }

  // Check body structure
  const body = req.body;
  if (body && typeof body === 'object') {
    // GitLab events have object_kind
    if (body.object_kind) {
      return 'gitlab';
    }

    // GitHub events have different structure
    if (body.repository && body.repository.html_url && body.repository.html_url.includes('github.com')) {
      return 'github';
    }
  }

  return 'unknown';
}

/**
 * Process GitLab webhook events
 */
async function processGitLabWebhook(req: Request) {
  try {
    const event: GitLabWebhookEvent = req.body;

    console.log(`Processing GitLab webhook event: ${event.object_kind}`);

    // Check if this is a Repopo webhook event
    const isRepopoEvent = isRepopoWebhook(req);

    // Process the event based on type
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
      console.log(`Ignoring unsupported GitLab event type: ${event}`);
    }
  } catch (error) {
    console.error('Error processing GitLab webhook:', error);
  }
}

/**
 * Process GitHub webhook events
 */
async function processGitHubWebhook(req: Request) {
  try {
    const eventType = req.headers['x-github-event'] as string;
    const event = req.body;

    console.log(`Processing GitHub webhook event: ${eventType}`);

    // Process the event based on type
    switch (eventType) {
      case 'push':
        await processGitHubPushEvent(event as GitHubPushEvent);
        break;
      case 'pull_request':
        await processGitHubPullRequestEvent(event as GitHubPullRequestEvent);
        break;
      case 'issue_comment':
        await processGitHubIssueCommentEvent(event as GitHubIssueCommentEvent);
        break;
      case 'pull_request_review_comment':
        await processGitHubPullRequestReviewCommentEvent(event as GitHubPullRequestReviewCommentEvent);
        break;
      default:
        console.log(`Ignoring unsupported GitHub event type: ${eventType}`);
    }
  } catch (error) {
    console.error('Error processing GitHub webhook:', error);
  }
}

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
    console.log(`Fetching files for GitLab project ${gitlabProjectId} at branch ${sourceBranch}`);
    const files = await gitlabService.getAllFiles(gitlabProjectId, sourceBranch);

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
 * This function handles note events and checks for agentic coding requests and emoji reactions
 */
async function processNoteEvent(event: GitLabNoteEvent) {
  try {
    console.log(`Processing note event for project ${event.project_id}, note ${event.object_attributes.id}`);

    // Only process notes on merge requests
    if (event.object_attributes.noteable_type !== 'MergeRequest' || !event.merge_request) {
      console.log('Note is not on a merge request, skipping');
      return;
    }

    const noteBody = event.object_attributes.note;

    // Check if this is an agentic coding comment
    if (AgenticCodingService.isAgenticCodingComment(noteBody)) {
      console.log(`Processing agentic coding request from GitLab comment on MR !${event.merge_request.iid}`);

      // Extract instructions from the comment
      const instructions = AgenticCodingService.extractInstructions(noteBody);

      // Create agentic coding request
      const agenticRequest: AgenticCodingRequest = {
        platform: 'gitlab',
        projectId: event.project_id,
        repositoryUrl: event.project.web_url,
        instructions,
        context: {
          mergeRequestIid: event.merge_request.iid,
          commentId: event.object_attributes.id,
          author: event.object_attributes.author.username,
          branch: event.merge_request.source_branch,
          commitSha: event.merge_request.last_commit?.id,
        },
      };

      try {
        // Process the agentic coding request
        const result = await agenticCodingService.processAgenticCodingRequest(agenticRequest);

        // Post response comment
        await postAgenticCodingResponse(event.project_id, undefined, event.merge_request.iid, result, 'gitlab');

        console.log(`Successfully processed agentic coding request for GitLab MR !${event.merge_request.iid}`);
      } catch (error) {
        console.error(`Error processing agentic coding request for MR !${event.merge_request.iid}:`, error);
      }

      return; // Don't process as regular note if it's an agentic coding request
    }

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

// GitHub webhook processing functions

/**
 * Convert GitHub project ID string to number for database operations
 */
function convertGitHubProjectIdToNumber(projectIdString: string): number {
  // Simple hash function to convert string to number
  let hash = 0;
  for (let i = 0; i < projectIdString.length; i++) {
    const char = projectIdString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Process a GitHub push event
 */
async function processGitHubPushEvent(event: GitHubPushEvent) {
  try {
    // Skip if this is a branch deletion
    if (event.after === '0000000000000000000000000000000000000000') {
      console.log('Skipping GitHub branch deletion event');
      return;
    }

    const repoInfo = GitHubService.parseRepositoryUrl(event.repository.html_url);
    if (!repoInfo) {
      console.error('Could not parse GitHub repository URL:', event.repository.html_url);
      return;
    }

    const projectIdString = GitHubService.generateProjectId(repoInfo.owner, repoInfo.repo);
    const projectId = convertGitHubProjectIdToNumber(projectIdString);
    const commitId = event.after;
    const branch = event.ref.replace('refs/heads/', '');

    console.log(`Processing GitHub push event for ${repoInfo.owner}/${repoInfo.repo}, project ID ${projectId} (${projectIdString}), commit ${commitId}, branch ${branch}`);

    // Get project metadata
    let projectMetadata = await dbService.getProjectMetadata(projectId);

    if (!projectMetadata) {
      const repoDetails = await githubService.getRepository(repoInfo.owner, repoInfo.repo);

      projectMetadata = {
        projectId,
        name: repoDetails.name,
        description: repoDetails.description || '',
        url: repoDetails.html_url,
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
    console.log(`Fetching files for GitHub project ${projectId} at commit ${commitId}`);
    const files = await githubService.getAllFiles(repoInfo.owner, repoInfo.repo, commitId);

    if (files.length === 0) {
      console.log('No files found, skipping');
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
    const repositoryUrl = event.repository.html_url;
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

    console.log(`Successfully processed GitHub push event for project ${projectId}, commit ${commitId}`);
  } catch (error) {
    console.error('Error processing GitHub push event:', error);
  }
}

/**
 * Process a GitHub pull request event
 */
async function processGitHubPullRequestEvent(event: GitHubPullRequestEvent) {
  try {
    // Only process opened and updated pull requests
    if (!['opened', 'synchronize', 'reopened'].includes(event.action)) {
      console.log(`Skipping GitHub pull request event with action: ${event.action}`);
      return;
    }

    const repoInfo = GitHubService.parseRepositoryUrl(event.repository.html_url);
    if (!repoInfo) {
      console.error('Could not parse GitHub repository URL:', event.repository.html_url);
      return;
    }

    const projectIdString = GitHubService.generateProjectId(repoInfo.owner, repoInfo.repo);
    const projectId = convertGitHubProjectIdToNumber(projectIdString);
    const pullRequestNumber = event.pull_request.number;
    const commitId = event.pull_request.head.sha;

    console.log(`Processing GitHub pull request event for ${repoInfo.owner}/${repoInfo.repo}, project ID ${projectId} (${projectIdString}), PR #${pullRequestNumber}, commit ${commitId}`);

    // Ensure project has embeddings
    await embeddingService.checkAndEmbedProject(projectId, true);

    console.log(`Successfully processed GitHub pull request event for project ${projectId}, PR #${pullRequestNumber}`);
  } catch (error) {
    console.error('Error processing GitHub pull request event:', error);
  }
}

/**
 * Process a GitHub issue comment event (includes PR comments)
 */
async function processGitHubIssueCommentEvent(event: GitHubIssueCommentEvent) {
  try {
    // Only process created comments
    if (event.action !== 'created') {
      console.log(`Skipping GitHub issue comment event with action: ${event.action}`);
      return;
    }

    const commentBody = event.comment.body;

    // Check if this is an agentic coding comment
    if (!AgenticCodingService.isAgenticCodingComment(commentBody)) {
      console.log('Comment does not start with /agent, skipping');
      return;
    }

    // Check if this comment is on a pull request
    if (!event.issue?.pull_request) {
      console.log('Comment is not on a pull request, skipping agentic coding');
      return;
    }

    const repoInfo = GitHubService.parseRepositoryUrl(event.repository.html_url);
    if (!repoInfo) {
      console.error('Could not parse GitHub repository URL:', event.repository.html_url);
      return;
    }

    console.log(`Processing agentic coding request from GitHub comment on PR #${event.issue.number}`);

    // Extract instructions from the comment
    const instructions = AgenticCodingService.extractInstructions(commentBody);

    // Get pull request details
    const pullRequest = await githubService.getPullRequest(repoInfo.owner, repoInfo.repo, event.issue.number);

    // Create agentic coding request
    const projectIdString = GitHubService.generateProjectId(repoInfo.owner, repoInfo.repo);
    const agenticRequest: AgenticCodingRequest = {
      platform: 'github',
      projectId: convertGitHubProjectIdToNumber(projectIdString),
      repositoryUrl: event.repository.html_url,
      instructions,
      context: {
        pullRequestNumber: event.issue.number,
        commentId: event.comment.id,
        author: event.comment.user.login,
        branch: pullRequest.head.ref,
        commitSha: pullRequest.head.sha,
      },
    };

    // Process the agentic coding request
    const result = await agenticCodingService.processAgenticCodingRequest(agenticRequest);

    // Post response comment
    await postAgenticCodingResponse(repoInfo.owner, repoInfo.repo, event.issue.number, result, 'github');

    console.log(`Successfully processed agentic coding request for GitHub PR #${event.issue.number}`);
  } catch (error) {
    console.error('Error processing GitHub issue comment event:', error);
  }
}

/**
 * Process a GitHub pull request review comment event
 */
async function processGitHubPullRequestReviewCommentEvent(event: GitHubPullRequestReviewCommentEvent) {
  try {
    // Only process created comments
    if (event.action !== 'created') {
      console.log(`Skipping GitHub PR review comment event with action: ${event.action}`);
      return;
    }

    const commentBody = event.comment.body;

    // Check if this is an agentic coding comment
    if (!AgenticCodingService.isAgenticCodingComment(commentBody)) {
      console.log('PR review comment does not start with /agent, skipping');
      return;
    }

    const repoInfo = GitHubService.parseRepositoryUrl(event.repository.html_url);
    if (!repoInfo) {
      console.error('Could not parse GitHub repository URL:', event.repository.html_url);
      return;
    }

    console.log(`Processing agentic coding request from GitHub PR review comment on PR #${event.pull_request.number}`);

    // Extract instructions from the comment
    const instructions = AgenticCodingService.extractInstructions(commentBody);

    // Create agentic coding request
    const projectIdString = GitHubService.generateProjectId(repoInfo.owner, repoInfo.repo);
    const agenticRequest: AgenticCodingRequest = {
      platform: 'github',
      projectId: convertGitHubProjectIdToNumber(projectIdString),
      repositoryUrl: event.repository.html_url,
      instructions,
      context: {
        pullRequestNumber: event.pull_request.number,
        commentId: event.comment.id,
        author: event.comment.user.login,
        branch: event.pull_request.head.ref,
        commitSha: event.pull_request.head.sha,
      },
    };

    // Process the agentic coding request
    const result = await agenticCodingService.processAgenticCodingRequest(agenticRequest);

    // Post response comment
    await postAgenticCodingResponse(repoInfo.owner, repoInfo.repo, event.pull_request.number, result, 'github');

    console.log(`Successfully processed agentic coding request for GitHub PR #${event.pull_request.number}`);
  } catch (error) {
    console.error('Error processing GitHub PR review comment event:', error);
  }
}

/**
 * Post agentic coding response as a comment
 */
async function postAgenticCodingResponse(
  projectIdOrOwner: number | string,
  repo: string | undefined,
  prOrMrNumber: number,
  result: AgenticCodingResult,
  platform: 'gitlab' | 'github'
) {
  try {
    // Format the response message
    const responseMessage = formatAgenticCodingResponse(result);

    if (platform === 'gitlab') {
      // Post comment on GitLab merge request
      await gitlabService.addMergeRequestComment(
        projectIdOrOwner as number,
        prOrMrNumber,
        responseMessage
      );
    } else if (platform === 'github' && repo) {
      // Post comment on GitHub pull request
      await githubService.createPullRequestComment(
        projectIdOrOwner as string,
        repo,
        prOrMrNumber,
        responseMessage
      );
    }

    console.log(`Posted agentic coding response to ${platform} ${platform === 'gitlab' ? 'MR' : 'PR'} ${platform === 'gitlab' ? '!' : '#'}${prOrMrNumber}`);
  } catch (error) {
    console.error(`Error posting agentic coding response to ${platform}:`, error);
  }
}

/**
 * Format agentic coding response message
 */
function formatAgenticCodingResponse(result: AgenticCodingResult): string {
  let message = '🤖 **Agentic Coding Response**\n\n';

  if (result.success) {
    message += '✅ **Status**: Successfully processed your request\n\n';

    message += `📝 **Summary**: ${result.summary}\n\n`;

    if (result.filesModified.length > 0) {
      message += '📄 **Files Modified**:\n';
      result.filesModified.forEach(file => {
        message += `- \`${file}\`\n`;
      });
      message += '\n';
    }

    if (result.filesCreated.length > 0) {
      message += '📁 **Files Created**:\n';
      result.filesCreated.forEach(file => {
        message += `- \`${file}\`\n`;
      });
      message += '\n';
    }

    if (result.warnings && result.warnings.length > 0) {
      message += '⚠️ **Warnings**:\n';
      result.warnings.forEach(warning => {
        message += `- ${warning}\n`;
      });
      message += '\n';
    }

    message += '> **Note**: This is a simulated response. In a production environment, the changes would be applied to a new branch and a pull request would be created for review.\n\n';
    message += '🔍 **Next Steps**: Please review the proposed changes and test them thoroughly before merging.';
  } else {
    message += '❌ **Status**: Failed to process your request\n\n';
    message += `📝 **Summary**: ${result.summary}\n\n`;

    if (result.errors && result.errors.length > 0) {
      message += '🚨 **Errors**:\n';
      result.errors.forEach(error => {
        message += `- ${error}\n`;
      });
      message += '\n';
    }

    message += '💡 **Suggestion**: Please check your request and try again with more specific instructions.';
  }

  return message;
}
