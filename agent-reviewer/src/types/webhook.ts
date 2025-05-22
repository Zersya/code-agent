// GitLab webhook event types

export interface GitLabUser {
  id: number;
  name: string;
  username: string;
  avatar_url: string;
  email: string;
}

export interface GitLabProject {
  id: number;
  name: string;
  description: string;
  web_url: string;
  avatar_url: string;
  git_ssh_url: string;
  git_http_url: string;
  namespace: string;
  visibility_level: number;
  path_with_namespace: string;
  default_branch: string;
  homepage: string;
  url: string;
  ssh_url: string;
  http_url: string;
}

export interface GitLabRepository {
  name: string;
  url: string;
  description: string;
  homepage: string;
  git_http_url: string;
  git_ssh_url: string;
  visibility_level: number;
}

export interface GitLabCommit {
  id: string;
  message: string;
  title: string;
  timestamp: string;
  url: string;
  author: {
    name: string;
    email: string;
  };
  added: string[];
  modified: string[];
  removed: string[];
}

export interface GitLabPushEvent {
  object_kind: 'push';
  event_name: 'push';
  before: string;
  after: string;
  ref: string;
  checkout_sha: string;
  user_id: number;
  user_name: string;
  user_username: string;
  user_email: string;
  user_avatar: string;
  project_id: number;
  project: GitLabProject;
  repository: GitLabRepository;
  commits: GitLabCommit[];
  total_commits_count: number;
}

export interface GitLabMergeRequestAttributes {
  id: number;
  iid: number;
  target_branch: string;
  source_branch: string;
  source_project_id: number;
  target_project_id: number;
  state: string;
  merge_status: string;
  title: string;
  description: string;
  url: string;
  source: GitLabProject;
  target: GitLabProject;
  last_commit: {
    id: string;
    message: string;
    timestamp: string;
    url: string;
    author: {
      name: string;
      email: string;
    };
  };
  work_in_progress: boolean;
  assignee: GitLabUser;
  assignees: GitLabUser[];
  author: GitLabUser;
  created_at: string;
  updated_at: string;
  action?: string;
}

export interface GitLabMergeRequestEvent {
  object_kind: 'merge_request';
  event_type: string;
  user: GitLabUser;
  project: GitLabProject;
  repository: GitLabRepository;
  object_attributes: GitLabMergeRequestAttributes;
  changes: {
    [key: string]: {
      previous: any;
      current: any;
    };
  };
  labels: any[];
}

export interface GitLabNoteAttributes {
  id: number;
  note: string;
  attachment: string | null;
  author: GitLabUser;
  created_at: string;
  updated_at: string;
  system: boolean;
  noteable_id: number;
  noteable_type: string;
  resolvable: boolean;
  confidential: boolean;
  internal: boolean;
  noteable_iid: number;
  url: string;
}

export interface GitLabNoteEvent {
  object_kind: 'note';
  event_type: string;
  user: GitLabUser;
  project_id: number;
  project: GitLabProject;
  repository: GitLabRepository;
  object_attributes: GitLabNoteAttributes;
  merge_request?: GitLabMergeRequestAttributes;
  issue?: any;
  snippet?: any;
}

export interface GitLabEmojiEvent {
  object_kind: 'emoji';
  event_type: string;
  user: GitLabUser;
  project_id: number;
  project: GitLabProject;
  object_attributes: {
    id: number;
    user_id: number;
    created_at: string;
    updated_at: string;
    awardable_id: number;
    awardable_type: string;
    name: string;
    action: 'award' | 'revoke';
  };
  note?: GitLabNoteAttributes;
  merge_request?: GitLabMergeRequestAttributes;
  issue?: any;
}

export type GitLabWebhookEvent = GitLabPushEvent | GitLabMergeRequestEvent | GitLabNoteEvent | GitLabEmojiEvent;

// GitHub webhook event types

export interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  html_url: string;
  type: string;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  default_branch: string;
  owner: GitHubUser;
}

export interface GitHubCommit {
  id: string;
  message: string;
  timestamp: string;
  url: string;
  author: {
    name: string;
    email: string;
  };
  added: string[];
  modified: string[];
  removed: string[];
}

export interface GitHubPushEvent {
  ref: string;
  before: string;
  after: string;
  repository: GitHubRepository;
  pusher: GitHubUser;
  sender: GitHubUser;
  commits: GitHubCommit[];
  head_commit: GitHubCommit;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  state: string;
  title: string;
  body: string;
  html_url: string;
  head: {
    ref: string;
    sha: string;
    repo: GitHubRepository;
  };
  base: {
    ref: string;
    sha: string;
    repo: GitHubRepository;
  };
  user: GitHubUser;
  merged: boolean;
  mergeable: boolean;
  created_at: string;
  updated_at: string;
}

export interface GitHubPullRequestEvent {
  action: string;
  number: number;
  pull_request: GitHubPullRequest;
  repository: GitHubRepository;
  sender: GitHubUser;
}

export interface GitHubIssueComment {
  id: number;
  body: string;
  user: GitHubUser;
  created_at: string;
  updated_at: string;
  html_url: string;
}

export interface GitHubIssueCommentEvent {
  action: string;
  issue?: {
    id: number;
    number: number;
    title: string;
    body: string;
    state: string;
    user: GitHubUser;
    html_url: string;
    pull_request?: {
      url: string;
      html_url: string;
    };
  };
  comment: GitHubIssueComment;
  repository: GitHubRepository;
  sender: GitHubUser;
}

export interface GitHubPullRequestReviewCommentEvent {
  action: string;
  pull_request: GitHubPullRequest;
  comment: {
    id: number;
    body: string;
    user: GitHubUser;
    created_at: string;
    updated_at: string;
    html_url: string;
    path: string;
    position: number;
    line: number;
  };
  repository: GitHubRepository;
  sender: GitHubUser;
}

export type GitHubWebhookEvent = GitHubPushEvent | GitHubPullRequestEvent | GitHubIssueCommentEvent | GitHubPullRequestReviewCommentEvent;

export type WebhookEvent = GitLabWebhookEvent | GitHubWebhookEvent;

// Agentic coding interfaces
export interface AgenticCodingRequest {
  platform: 'gitlab' | 'github';
  projectId: number | string;
  repositoryUrl: string;
  instructions: string;
  context: {
    pullRequestNumber?: number;
    mergeRequestIid?: number;
    commentId: number;
    author: string;
    branch?: string;
    commitSha?: string;
  };
}

export interface AgenticCodingResult {
  success: boolean;
  filesModified: string[];
  filesCreated: string[];
  summary: string;
  errors?: string[];
  warnings?: string[];
}
