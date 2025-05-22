// Types for GitLab merge request review functionality

import { GitLabMergeRequestEvent } from './webhook.js';

/**
 * Interface for Repopo webhook events
 * This extends the standard GitLab webhook event with Repopo-specific fields
 */
export interface RepopoWebhookEvent extends GitLabMergeRequestEvent {
  // Add any Repopo-specific fields here
  repopo_token?: string;
}

/**
 * Interface for sequential thinking steps
 */
export interface SequentialThought {
  thought: string;
  thoughtNumber: number;
  totalThoughts: number;
  nextThoughtNeeded: boolean;
  isRevision?: boolean;
  revisesThought?: number;
  branchFromThought?: number;
  branchId?: string;
  needsMoreThoughts?: boolean;
}

/**
 * Interface for merge request review data
 */
export interface MergeRequestReview {
  projectId: number | string;
  mergeRequestIid: number;
  title: string;
  description: string;
  author: string;
  url: string;
  sourceBranch: string;
  targetBranch: string;
  commitId: string;
  changes: MergeRequestChange[];
  existingComments: MergeRequestComment[];
  thoughts: SequentialThought[];
  reviewResult: string;
  shouldApprove: boolean;
}

/**
 * Interface for merge request changes
 */
export interface MergeRequestChange {
  oldPath: string;
  newPath: string;
  oldContent: string;
  newContent: string;
  diffContent: string;
  language: string;
}

/**
 * Interface for merge request comments
 */
export interface MergeRequestComment {
  id: number;
  body: string;
  author: {
    id: number;
    username: string;
  };
  createdAt: string;
}

/**
 * Interface for merge request review result
 */
export interface MergeRequestReviewResult {
  reviewText: string;
  shouldApprove: boolean;
  shouldContinue: boolean;
}
