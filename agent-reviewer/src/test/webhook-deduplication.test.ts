// Test file for webhook deduplication functionality
import { describe, test, expect } from 'bun:test';
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

describe('Webhook Deduplication Service', () => {
  describe('generateWebhookKey', () => {
    test('should generate consistent keys for identical push events', () => {
      const pushKey1 = webhookDeduplicationService.generateWebhookKey(samplePushEvent);
      const pushKey2 = webhookDeduplicationService.generateWebhookKey(samplePushEvent);

      expect(pushKey1).toBe(pushKey2);
      expect(pushKey1).toBeTruthy();
      expect(typeof pushKey1).toBe('string');
    });

    test('should generate consistent keys for identical merge request events', () => {
      const mrKey1 = webhookDeduplicationService.generateWebhookKey(sampleMergeRequestEvent);
      const mrKey2 = webhookDeduplicationService.generateWebhookKey(sampleMergeRequestEvent);

      expect(mrKey1).toBe(mrKey2);
      expect(mrKey1).toBeTruthy();
      expect(typeof mrKey1).toBe('string');
    });

    test('should generate different keys for different event types', () => {
      const pushKey = webhookDeduplicationService.generateWebhookKey(samplePushEvent);
      const mrKey = webhookDeduplicationService.generateWebhookKey(sampleMergeRequestEvent);

      expect(pushKey).not.toBe(mrKey);
    });

    test('should generate different keys for events with different commit IDs', () => {
      const event1 = { ...samplePushEvent, after: 'commit1' };
      const event2 = { ...samplePushEvent, after: 'commit2' };

      const key1 = webhookDeduplicationService.generateWebhookKey(event1);
      const key2 = webhookDeduplicationService.generateWebhookKey(event2);

      expect(key1).not.toBe(key2);
    });
  });

  describe('createWebhookIdentifier', () => {
    test('should create valid identifier for push event', () => {
      const identifier = webhookDeduplicationService.createWebhookIdentifier(samplePushEvent);

      expect(identifier).toHaveProperty('uniqueKey');
      expect(identifier).toHaveProperty('eventType');
      expect(identifier).toHaveProperty('projectId');
      expect(identifier.eventType).toBe('push');
      expect(identifier.projectId).toBe(samplePushEvent.project_id);
    });

    test('should create valid identifier for merge request event', () => {
      const identifier = webhookDeduplicationService.createWebhookIdentifier(sampleMergeRequestEvent);

      expect(identifier).toHaveProperty('uniqueKey');
      expect(identifier).toHaveProperty('eventType');
      expect(identifier).toHaveProperty('projectId');
      expect(identifier.eventType).toBe('merge_request');
      expect(identifier.projectId).toBe(sampleMergeRequestEvent.project.id);
    });
  });

  describe('Edge cases and error handling', () => {
    test('should handle malformed webhook events', () => {
      const malformedEvent = { object_kind: 'unknown' } as any;

      expect(() => {
        webhookDeduplicationService.generateWebhookKey(malformedEvent);
      }).not.toThrow();
    });
  });
});

// Export test functions for backward compatibility
export function testWebhookKeyGeneration() {
  const pushKey1 = webhookDeduplicationService.generateWebhookKey(samplePushEvent);
  const pushKey2 = webhookDeduplicationService.generateWebhookKey(samplePushEvent);
  return pushKey1 === pushKey2;
}

export function testWebhookIdentifierCreation() {
  const pushIdentifier = webhookDeduplicationService.createWebhookIdentifier(samplePushEvent);
  const mrIdentifier = webhookDeduplicationService.createWebhookIdentifier(sampleMergeRequestEvent);
  return pushIdentifier && mrIdentifier;
}