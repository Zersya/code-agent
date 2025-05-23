// Test file for webhook deduplication functionality
// This is a simple test to verify the webhook deduplication logic

import { webhookDeduplicationService } from '../services/webhook-deduplication.js';
import { GitLabPushEvent, GitLabMergeRequestEvent } from '../types/webhook.js';

/**
 * Sample push event for testing
 */
const samplePushEvent: GitLabPushEvent = {
  object_kind: 'push',
  event_name: 'push',
  before: '0000000000000000000000000000000000000000',
  after: 'abcd1234567890abcd1234567890abcd12345678',
  ref: 'refs/heads/main',
  checkout_sha: 'abcd1234567890abcd1234567890abcd12345678',
  user_id: 123,
  user_name: 'Test User',
  user_username: 'testuser',
  user_email: 'test@example.com',
  user_avatar: 'https://example.com/avatar.png',
  project_id: 456,
  project: {
    id: 456,
    name: 'Test Project',
    description: 'A test project',
    web_url: 'https://gitlab.example.com/test/project',
    avatar_url: '',
    git_ssh_url: 'git@gitlab.example.com:test/project.git',
    git_http_url: 'https://gitlab.example.com/test/project.git',
    namespace: 'test',
    visibility_level: 0,
    path_with_namespace: 'test/project',
    default_branch: 'main',
    homepage: 'https://gitlab.example.com/test/project',
    url: 'git@gitlab.example.com:test/project.git',
    ssh_url: 'git@gitlab.example.com:test/project.git',
    http_url: 'https://gitlab.example.com/test/project.git'
  },
  repository: {
    name: 'Test Project',
    url: 'git@gitlab.example.com:test/project.git',
    description: 'A test project',
    homepage: 'https://gitlab.example.com/test/project',
    git_http_url: 'https://gitlab.example.com/test/project.git',
    git_ssh_url: 'git@gitlab.example.com:test/project.git',
    visibility_level: 0
  },
  commits: [],
  total_commits_count: 1
};

/**
 * Sample merge request event for testing
 */
const sampleMergeRequestEvent: GitLabMergeRequestEvent = {
  object_kind: 'merge_request',
  event_type: 'merge_request',
  user: {
    id: 123,
    name: 'Test User',
    username: 'testuser',
    avatar_url: 'https://example.com/avatar.png',
    email: 'test@example.com'
  },
  project: {
    id: 456,
    name: 'Test Project',
    description: 'A test project',
    web_url: 'https://gitlab.example.com/test/project',
    avatar_url: '',
    git_ssh_url: 'git@gitlab.example.com:test/project.git',
    git_http_url: 'https://gitlab.example.com/test/project.git',
    namespace: 'test',
    visibility_level: 0,
    path_with_namespace: 'test/project',
    default_branch: 'main',
    homepage: 'https://gitlab.example.com/test/project',
    url: 'git@gitlab.example.com:test/project.git',
    ssh_url: 'git@gitlab.example.com:test/project.git',
    http_url: 'https://gitlab.example.com/test/project.git'
  },
  repository: {
    name: 'Test Project',
    url: 'git@gitlab.example.com:test/project.git',
    description: 'A test project',
    homepage: 'https://gitlab.example.com/test/project',
    git_http_url: 'https://gitlab.example.com/test/project.git',
    git_ssh_url: 'git@gitlab.example.com:test/project.git',
    visibility_level: 0
  },
  object_attributes: {
    id: 789,
    iid: 1,
    target_branch: 'main',
    source_branch: 'feature-branch',
    source_project_id: 456,
    target_project_id: 456,
    state: 'opened',
    merge_status: 'can_be_merged',
    title: 'Test Merge Request',
    description: 'A test merge request',
    url: 'https://gitlab.example.com/test/project/-/merge_requests/1',
    source: {
      id: 456,
      name: 'Test Project',
      description: 'A test project',
      web_url: 'https://gitlab.example.com/test/project',
      avatar_url: '',
      git_ssh_url: 'git@gitlab.example.com:test/project.git',
      git_http_url: 'https://gitlab.example.com/test/project.git',
      namespace: 'test',
      visibility_level: 0,
      path_with_namespace: 'test/project',
      default_branch: 'main',
      homepage: 'https://gitlab.example.com/test/project',
      url: 'git@gitlab.example.com:test/project.git',
      ssh_url: 'git@gitlab.example.com:test/project.git',
      http_url: 'https://gitlab.example.com/test/project.git'
    },
    target: {
      id: 456,
      name: 'Test Project',
      description: 'A test project',
      web_url: 'https://gitlab.example.com/test/project',
      avatar_url: '',
      git_ssh_url: 'git@gitlab.example.com:test/project.git',
      git_http_url: 'https://gitlab.example.com/test/project.git',
      namespace: 'test',
      visibility_level: 0,
      path_with_namespace: 'test/project',
      default_branch: 'main',
      homepage: 'https://gitlab.example.com/test/project',
      url: 'git@gitlab.example.com:test/project.git',
      ssh_url: 'git@gitlab.example.com:test/project.git',
      http_url: 'https://gitlab.example.com/test/project.git'
    },
    last_commit: {
      id: 'abcd1234567890abcd1234567890abcd12345678',
      message: 'Test commit',
      timestamp: '2024-01-01T00:00:00Z',
      url: 'https://gitlab.example.com/test/project/-/commit/abcd1234567890abcd1234567890abcd12345678',
      author: {
        name: 'Test User',
        email: 'test@example.com'
      }
    },
    work_in_progress: false,
    assignee: {
      id: 123,
      name: 'Test User',
      username: 'testuser',
      avatar_url: 'https://example.com/avatar.png',
      email: 'test@example.com'
    },
    assignees: [],
    author: {
      id: 123,
      name: 'Test User',
      username: 'testuser',
      avatar_url: 'https://example.com/avatar.png',
      email: 'test@example.com'
    },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    action: 'open'
  },
  changes: {},
  labels: []
};

/**
 * Test webhook key generation
 */
export function testWebhookKeyGeneration() {
  console.log('Testing webhook key generation...');
  
  // Test push event key generation
  const pushKey1 = webhookDeduplicationService.generateWebhookKey(samplePushEvent);
  const pushKey2 = webhookDeduplicationService.generateWebhookKey(samplePushEvent);
  
  console.log('Push event key 1:', pushKey1);
  console.log('Push event key 2:', pushKey2);
  console.log('Push keys match:', pushKey1 === pushKey2);
  
  // Test merge request event key generation
  const mrKey1 = webhookDeduplicationService.generateWebhookKey(sampleMergeRequestEvent);
  const mrKey2 = webhookDeduplicationService.generateWebhookKey(sampleMergeRequestEvent);
  
  console.log('MR event key 1:', mrKey1);
  console.log('MR event key 2:', mrKey2);
  console.log('MR keys match:', mrKey1 === mrKey2);
  
  // Test that different events generate different keys
  console.log('Push and MR keys are different:', pushKey1 !== mrKey1);
}

/**
 * Test webhook identifier creation
 */
export function testWebhookIdentifierCreation() {
  console.log('\nTesting webhook identifier creation...');
  
  const pushIdentifier = webhookDeduplicationService.createWebhookIdentifier(samplePushEvent);
  console.log('Push identifier:', pushIdentifier);
  
  const mrIdentifier = webhookDeduplicationService.createWebhookIdentifier(sampleMergeRequestEvent);
  console.log('MR identifier:', mrIdentifier);
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testWebhookKeyGeneration();
  testWebhookIdentifierCreation();
}
