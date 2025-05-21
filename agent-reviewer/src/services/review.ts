import { MergeRequestChange, MergeRequestComment, /* MergeRequestReview, */ MergeRequestReviewResult } from '../types/review.js';
import { gitlabService } from './gitlab.js';
import { sequentialThinkingService } from './sequential-thinking.js';
import { contextService } from './context.js';
import { dbService } from './database.js';
import { queueService } from './queue.js';
import { JobStatus } from '../models/queue.js';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

// Environment variables
const GITLAB_USERNAME = process.env.GITLAB_USERNAME || '';
const ENABLE_MR_REVIEW = process.env.ENABLE_MR_REVIEW === 'true';
const ENABLE_PROJECT_CONTEXT = process.env.ENABLE_PROJECT_CONTEXT === 'true';
const AUTO_EMBED_PROJECTS = process.env.AUTO_EMBED_PROJECTS === 'true';
const EMBEDDING_WAIT_TIMEOUT = Number(process.env.EMBEDDING_WAIT_TIMEOUT) || 300; // 5 minutes default

/**
 * Service for reviewing merge requests
 */
export class ReviewService {
  /**
   * Check if a project has embeddings and trigger embedding process if needed
   * @param projectId The ID of the project
   * @param waitForCompletion Whether to wait for the embedding process to complete
   * @returns True if the project has embeddings or embedding was triggered, false otherwise
   */
  async checkAndEmbedProject(projectId: number | string, waitForCompletion: boolean = false): Promise<boolean> {
    try {
      // Convert projectId to number if it's a string
      const numericProjectId = typeof projectId === 'string' ? parseInt(projectId, 10) : projectId;

      // Check if the project has embeddings
      const hasEmbeddings = await dbService.hasEmbeddings(numericProjectId);

      if (hasEmbeddings) {
        console.log(`Project ${projectId} already has embeddings`);
        return true;
      }

      // Check if the project is already being embedded
      const isBeingEmbedded = await dbService.isProjectBeingEmbedded(numericProjectId);

      if (isBeingEmbedded) {
        console.log(`Project ${projectId} is already being embedded, skipping duplicate embedding`);

        // If we need to wait for completion, check the job status
        if (waitForCompletion) {
          // Get project metadata to get the job ID
          const metadata = await dbService.getProjectMetadata(numericProjectId);

          if (metadata && metadata.lastEmbeddingJobId) {
            console.log(`Waiting for existing embedding job ${metadata.lastEmbeddingJobId} to complete`);
            const job = await queueService.waitForJobCompletion(metadata.lastEmbeddingJobId, EMBEDDING_WAIT_TIMEOUT);

            if (job && job.status === JobStatus.COMPLETED) {
              console.log(`Existing embedding job completed successfully for project ${projectId}`);

              // Update the project status
              await dbService.setProjectEmbeddingStatus(numericProjectId, false);

              return true;
            } else {
              console.warn(`Existing embedding job did not complete successfully for project ${projectId}`);
              return false;
            }
          }
        }

        return true; // Return true to indicate that embedding is in progress
      }

      // If auto-embedding is disabled, just return false
      if (!AUTO_EMBED_PROJECTS) {
        console.log(`Project ${projectId} has no embeddings, but auto-embedding is disabled`);
        return false;
      }

      console.log(`Project ${projectId} has no embeddings, triggering embedding process`);

      // Get project details from GitLab
      const project = await gitlabService.getProject(projectId);

      if (!project) {
        console.error(`Could not find project ${projectId} in GitLab`);
        return false;
      }

      // Generate a unique processing ID
      const processingId = uuidv4();

      // Update the project status to indicate that embedding is in progress
      await dbService.setProjectEmbeddingStatus(numericProjectId, true, processingId);

      // Queue the project for embedding with high priority
      await queueService.addJob(project.web_url, processingId, 10);

      console.log(`Project ${projectId} queued for embedding (processingId: ${processingId})`);

      // If we don't need to wait for completion, return true
      if (!waitForCompletion) {
        return true;
      }

      // Wait for the embedding process to complete with a timeout
      console.log(`Waiting for embedding process to complete for project ${projectId}`);
      const job = await queueService.waitForJobCompletion(processingId, EMBEDDING_WAIT_TIMEOUT);

      // Update the project status
      await dbService.setProjectEmbeddingStatus(numericProjectId, false);

      if (!job) {
        console.warn(`Could not get job status for project ${projectId}`);
        return false;
      }

      if (job.status === JobStatus.COMPLETED) {
        console.log(`Embedding process completed successfully for project ${projectId}`);
        return true;
      } else {
        console.warn(`Embedding process did not complete successfully for project ${projectId}: ${job.status}`);
        return false;
      }
    } catch (error) {
      console.error(`Error checking and embedding project ${projectId}:`, error);
      return false;
    }
  }
  /**
   * Review a merge request
   * @param projectId The ID of the project
   * @param mergeRequestIid The IID of the merge request
   * @returns The review result
   */
  async reviewMergeRequest(projectId: number | string, mergeRequestIid: number): Promise<MergeRequestReviewResult> {
    try {
      console.log(`Starting review for merge request !${mergeRequestIid} in project ${projectId}`);

      // Get merge request details
      const mergeRequest = await gitlabService.getMergeRequest(projectId, mergeRequestIid);

      // Get merge request changes
      const changes = await gitlabService.getMergeRequestChanges(projectId, mergeRequestIid);

      // Get existing comments
      const comments = await gitlabService.getMergeRequestComments(projectId, mergeRequestIid);

      // Check if this merge request has already been reviewed by us
      if (this.hasBeenReviewed(comments)) {
        console.log(`Merge request !${mergeRequestIid} has already been reviewed, skipping`);
        return {
          reviewText: 'Merge request has already been reviewed.',
          shouldApprove: false,
        };
      }

      // Check if the project is already being embedded
      const numericProjectId = typeof projectId === 'string' ? parseInt(projectId, 10) : projectId;
      const isBeingEmbedded = await dbService.isProjectBeingEmbedded(numericProjectId);

      if (isBeingEmbedded) {
        console.log(`Project ${projectId} is already being embedded, proceeding with review without waiting`);
      } else {
        // Check if the project has embeddings and trigger embedding process if needed
        // We don't wait for completion here, as we'll still proceed with the review
        // even if the embedding process is still running
        await this.checkAndEmbedProject(projectId, false);
      }

      // Format the changes for review
      const formattedChanges = this.formatChangesForReview(changes);

      console.log('Formatted changes for review:', formattedChanges);

      // Get project context if enabled
      let projectContext = undefined;
      if (ENABLE_PROJECT_CONTEXT) {
        try {
          console.log(`Getting project context for project ${projectId}`);
          projectContext = await contextService.getProjectContext(projectId, changes);
          console.log(`Retrieved project context with ${projectContext.relevantFiles.length} relevant files`);
        } catch (contextError) {
          console.warn(`Error getting project context, continuing without it:`, contextError);
        }
      }

      // Perform the review using sequential thinking
      const { /* thoughts, */ reviewResult } = await sequentialThinkingService.reviewCode(
        formattedChanges,
        mergeRequest.title,
        mergeRequest.description || '',
        projectContext
      );

      console.log('Review result:', reviewResult);

      // Determine if the merge request should be approved
      const shouldApprove = this.shouldApproveMergeRequest(reviewResult);

      // Format the review comment
      const reviewComment = this.formatReviewComment(reviewResult, shouldApprove);

      // Create the review object for future reference
      // Currently not used but prepared for future implementation of review history
      /*
      const review: MergeRequestReview = {
        projectId,
        mergeRequestIid,
        title: mergeRequest.title,
        description: mergeRequest.description || '',
        author: mergeRequest.author.username,
        url: mergeRequest.web_url,
        sourceBranch: mergeRequest.source_branch,
        targetBranch: mergeRequest.target_branch,
        commitId: mergeRequest.sha,
        changes,
        existingComments: comments,
        thoughts,
        reviewResult,
        shouldApprove,
      };
      */

      // Save the review for future reference if needed
      // This could be implemented later if we need to store review history

      return {
        reviewText: reviewComment,
        shouldApprove,
      };
    } catch (error) {
      console.error(`Error reviewing merge request !${mergeRequestIid} in project ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Check if a merge request has already been reviewed by us
   */
  private hasBeenReviewed(comments: MergeRequestComment[]): boolean {
    // Check if there are any comments from the GitLab user we're using
    return comments.some(comment =>
      comment.author.username === GITLAB_USERNAME &&
      comment.body.includes('Halo, berikut review untuk MR ini:')
    );
  }

  /**
   * Format the changes for review
   */
  private formatChangesForReview(changes: MergeRequestChange[]): string {
    // Combine all diffs into a single string
    return changes.map(change => {
      const header = `File: ${change.newPath} (${change.language})`;
      return `${header}\n${change.diffContent}`;
    }).join('\n\n');
  }

  /**
   * Determine if a merge request should be approved based on the review result
   */
  private shouldApproveMergeRequest(reviewResult: string): boolean {
    // Check if the review contains approval language
    const approvalIndicators = [
      'Silahkan merge',
      'Silakan merge',
      'dapat di-merge',
      'dapat dimerge',
      'bisa di-merge',
      'bisa dimerge',
      'siap untuk di-merge',
      'siap untuk dimerge',
      'layak untuk di-merge',
      'layak untuk dimerge',
      'memenuhi standar kualitas',
    ];

    return approvalIndicators.some(indicator => reviewResult.includes(indicator));
  }

  /**
   * Format the review comment
   */
  private formatReviewComment(reviewResult: string, shouldApprove: boolean): string {
    // Start with the standard greeting
    let comment = 'Halo, berikut review untuk MR ini:\n\n';

    // Add the review result
    comment += reviewResult;

    // If the MR should be approved, make sure the approval message is included
    if (shouldApprove && !comment.includes('Silahkan merge!')) {
      comment += '\n\nSilahkan merge! \nTerima kasih';
    }

    return comment;
  }

  /**
   * Submit a review for a merge request
   */
  async submitReview(projectId: number | string, mergeRequestIid: number): Promise<void> {
    try {
      // Check if merge request reviews are enabled
      if (!ENABLE_MR_REVIEW) {
        console.log(`Merge request reviews are disabled. Skipping review for !${mergeRequestIid} in project ${projectId}`);
        return;
      }

      // Perform the review
      const reviewResult = await this.reviewMergeRequest(projectId, mergeRequestIid);

      // Add the review comment
      await gitlabService.addMergeRequestComment(projectId, mergeRequestIid, reviewResult.reviewText);

      // If the review indicates approval, approve the merge request
      if (reviewResult.shouldApprove) {
        await gitlabService.approveMergeRequest(projectId, mergeRequestIid);
        console.log(`Approved merge request !${mergeRequestIid} in project ${projectId}`);
      } else {
        console.log(`Did not approve merge request !${mergeRequestIid} in project ${projectId}`);
      }
    } catch (error) {
      console.error(`Error submitting review for merge request !${mergeRequestIid} in project ${projectId}:`, error);
      throw error;
    }
  }
}

export const reviewService = new ReviewService();
