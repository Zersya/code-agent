// Integration tests for webhook analytics integration
import { describe, test, expect, beforeEach, jest } from 'bun:test';
import { GitLabMergeRequestEvent } from '../../types/webhook.js';
import { MergeRequestEventData } from '../../models/analytics.js';

// Mock the analytics service
const mockAnalyticsService = {
  trackMergeRequestCreated: jest.fn(),
  trackMergeRequestCompleted: jest.fn(),
  trackReviewCompleted: jest.fn()
};

jest.mock('../../services/analytics.js', () => ({
  analyticsService: mockAnalyticsService
}));

// Mock other services to isolate analytics testing
const mockDbService = {
  getProjectMetadata: jest.fn(),
  updateProjectMetadata: jest.fn(),
  saveBatch: jest.fn(),
  saveEmbeddings: jest.fn()
};

jest.mock('../../services/database.js', () => ({
  dbService: mockDbService
}));

const mockEmbeddingService = {
  generateEmbeddings: jest.fn(),
  triggerProjectReEmbedding: jest.fn()
};

jest.mock('../../services/embedding.js', () => ({
  embeddingService: mockEmbeddingService
}));

const mockGitlabService = {
  getRepositoryTree: jest.fn(),
  getFileContent: jest.fn(),
  getProject: jest.fn()
};

jest.mock('../../services/gitlab.js', () => ({
  gitlabService: mockGitlabService
}));

const mockReviewService = {
  submitReview: jest.fn()
};

jest.mock('../../services/review.js', () => ({
  reviewService: mockReviewService
}));

const mockWebhookDeduplicationService = {
  startWebhookProcessing: jest.fn(),
  completeWebhookProcessing: jest.fn()
};

jest.mock('../../services/webhook-deduplication.js', () => ({
  webhookDeduplicationService: mockWebhookDeduplicationService
}));

// Import the webhook controller after mocking
import { processWebhook } from '../../controllers/webhook.js';

describe('Webhook Analytics Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock responses
    mockWebhookDeduplicationService.startWebhookProcessing.mockResolvedValue({
      success: true,
      isDuplicate: false,
      processingId: 'test-processing-id'
    });
    
    mockWebhookDeduplicationService.completeWebhookProcessing.mockResolvedValue(undefined);
    
    mockDbService.getProjectMetadata.mockResolvedValue({
      projectId: 123,
      name: 'Test Project',
      description: 'Test Description',
      url: 'https://gitlab.com/test/repo',
      defaultBranch: 'main',
      lastProcessedCommit: '',
      lastProcessedAt: new Date(),
      lastReembeddingAt: undefined
    });
    
    mockGitlabService.getProject.mockResolvedValue({
      id: 123,
      name: 'Test Project',
      description: 'Test Description',
      web_url: 'https://gitlab.com/test/repo',
      default_branch: 'main'
    });
    
    mockEmbeddingService.generateEmbeddings.mockResolvedValue([]);
    mockDbService.saveEmbeddings.mockResolvedValue(undefined);
    mockDbService.saveBatch.mockResolvedValue(undefined);
    mockDbService.updateProjectMetadata.mockResolvedValue(undefined);
    mockReviewService.submitReview.mockResolvedValue(undefined);
    mockEmbeddingService.triggerProjectReEmbedding.mockResolvedValue(true);
  });

  describe('Merge Request Creation Analytics', () => {
    test('should track analytics when merge request is opened', async () => {
      const mockEvent: GitLabMergeRequestEvent = {
        object_kind: 'merge_request',
        event_type: 'merge_request',
        user: {
          id: 789,
          name: 'Test User',
          username: 'testuser',
          avatar_url: 'https://example.com/avatar.png',
          email: 'test@example.com'
        },
        project: {
          id: 123,
          name: 'Test Project',
          description: 'Test Description',
          web_url: 'https://gitlab.com/test/repo',
          avatar_url: '',
          git_ssh_url: '',
          git_http_url: '',
          namespace: 'test',
          visibility_level: 0,
          path_with_namespace: 'test/repo',
          default_branch: 'main',
          homepage: '',
          url: '',
          ssh_url: '',
          http_url: ''
        },
        repository: {
          name: 'Test Project',
          url: 'https://gitlab.com/test/repo',
          description: 'Test Description',
          homepage: '',
          git_http_url: '',
          git_ssh_url: '',
          visibility_level: 0
        },
        object_attributes: {
          id: 456,
          iid: 789,
          target_branch: 'main',
          source_branch: 'feature/test',
          source_project_id: 123,
          target_project_id: 123,
          state: 'opened',
          merge_status: 'can_be_merged',
          title: 'Test MR',
          description: 'Test description',
          url: 'https://gitlab.com/test/repo/-/merge_requests/789',
          source: {} as any,
          target: {} as any,
          last_commit: {
            id: 'abc123',
            message: 'Test commit',
            timestamp: '2024-01-01T10:00:00Z',
            url: 'https://gitlab.com/test/repo/-/commit/abc123',
            author: {
              name: 'Test User',
              email: 'test@example.com'
            }
          },
          work_in_progress: false,
          assignee: {
            id: 789,
            name: 'Test User',
            username: 'testuser',
            avatar_url: 'https://example.com/avatar.png',
            email: 'test@example.com'
          },
          assignees: [],
          author: {
            id: 789,
            name: 'Test User',
            username: 'testuser',
            avatar_url: 'https://example.com/avatar.png',
            email: 'test@example.com'
          },
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z',
          action: 'open'
        },
        changes: {},
        labels: []
      };

      const mockReq = {
        body: mockEvent,
        headers: {}
      } as any;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;

      await processWebhook(mockReq, mockRes);

      expect(mockAnalyticsService.trackMergeRequestCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 123,
          mergeRequestIid: 789,
          developerId: 789,
          developerUsername: 'testuser',
          developerEmail: 'test@example.com',
          title: 'Test MR',
          description: 'Test description',
          sourceBranch: 'feature/test',
          targetBranch: 'main',
          action: 'open'
        })
      );
    });

    test('should not track analytics for non-open actions', async () => {
      const mockEvent: GitLabMergeRequestEvent = {
        object_kind: 'merge_request',
        event_type: 'merge_request',
        user: {
          id: 789,
          name: 'Test User',
          username: 'testuser',
          avatar_url: 'https://example.com/avatar.png',
          email: 'test@example.com'
        },
        project: {
          id: 123,
          name: 'Test Project',
          description: 'Test Description',
          web_url: 'https://gitlab.com/test/repo',
          avatar_url: '',
          git_ssh_url: '',
          git_http_url: '',
          namespace: 'test',
          visibility_level: 0,
          path_with_namespace: 'test/repo',
          default_branch: 'main',
          homepage: '',
          url: '',
          ssh_url: '',
          http_url: ''
        },
        repository: {
          name: 'Test Project',
          url: 'https://gitlab.com/test/repo',
          description: 'Test Description',
          homepage: '',
          git_http_url: '',
          git_ssh_url: '',
          visibility_level: 0
        },
        object_attributes: {
          id: 456,
          iid: 789,
          target_branch: 'main',
          source_branch: 'feature/test',
          source_project_id: 123,
          target_project_id: 123,
          state: 'opened',
          merge_status: 'can_be_merged',
          title: 'Test MR',
          description: 'Test description',
          url: 'https://gitlab.com/test/repo/-/merge_requests/789',
          source: {} as any,
          target: {} as any,
          last_commit: {
            id: 'abc123',
            message: 'Test commit',
            timestamp: '2024-01-01T10:00:00Z',
            url: 'https://gitlab.com/test/repo/-/commit/abc123',
            author: {
              name: 'Test User',
              email: 'test@example.com'
            }
          },
          work_in_progress: false,
          assignee: {
            id: 789,
            name: 'Test User',
            username: 'testuser',
            avatar_url: 'https://example.com/avatar.png',
            email: 'test@example.com'
          },
          assignees: [],
          author: {
            id: 789,
            name: 'Test User',
            username: 'testuser',
            avatar_url: 'https://example.com/avatar.png',
            email: 'test@example.com'
          },
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z',
          action: 'update'
        },
        changes: {},
        labels: []
      };

      const mockReq = {
        body: mockEvent,
        headers: {}
      } as any;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;

      await processWebhook(mockReq, mockRes);

      expect(mockAnalyticsService.trackMergeRequestCreated).not.toHaveBeenCalled();
    });
  });

  describe('Merge Request Completion Analytics', () => {
    test('should track analytics when merge request is merged', async () => {
      const mockEvent: GitLabMergeRequestEvent = {
        object_kind: 'merge_request',
        event_type: 'merge_request',
        user: {
          id: 789,
          name: 'Test User',
          username: 'testuser',
          avatar_url: 'https://example.com/avatar.png',
          email: 'test@example.com'
        },
        project: {
          id: 123,
          name: 'Test Project',
          description: 'Test Description',
          web_url: 'https://gitlab.com/test/repo',
          avatar_url: '',
          git_ssh_url: '',
          git_http_url: '',
          namespace: 'test',
          visibility_level: 0,
          path_with_namespace: 'test/repo',
          default_branch: 'main',
          homepage: '',
          url: '',
          ssh_url: '',
          http_url: ''
        },
        repository: {
          name: 'Test Project',
          url: 'https://gitlab.com/test/repo',
          description: 'Test Description',
          homepage: '',
          git_http_url: '',
          git_ssh_url: '',
          visibility_level: 0
        },
        object_attributes: {
          id: 456,
          iid: 789,
          target_branch: 'main',
          source_branch: 'feature/test',
          source_project_id: 123,
          target_project_id: 123,
          state: 'merged',
          merge_status: 'can_be_merged',
          title: 'Test MR',
          description: 'Test description',
          url: 'https://gitlab.com/test/repo/-/merge_requests/789',
          source: {} as any,
          target: {} as any,
          last_commit: {
            id: 'abc123',
            message: 'Test commit',
            timestamp: '2024-01-01T10:00:00Z',
            url: 'https://gitlab.com/test/repo/-/commit/abc123',
            author: {
              name: 'Test User',
              email: 'test@example.com'
            }
          },
          work_in_progress: false,
          assignee: {
            id: 789,
            name: 'Test User',
            username: 'testuser',
            avatar_url: 'https://example.com/avatar.png',
            email: 'test@example.com'
          },
          assignees: [],
          author: {
            id: 789,
            name: 'Test User',
            username: 'testuser',
            avatar_url: 'https://example.com/avatar.png',
            email: 'test@example.com'
          },
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z',
          action: 'merge'
        },
        changes: {},
        labels: []
      };

      const mockReq = {
        body: mockEvent,
        headers: {}
      } as any;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;

      await processWebhook(mockReq, mockRes);

      expect(mockAnalyticsService.trackMergeRequestCompleted).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 123,
          mergeRequestIid: 789,
          developerId: 789,
          developerUsername: 'testuser',
          action: 'merge'
        })
      );
    });
  });

  describe('Analytics Error Handling', () => {
    test('should continue processing even if analytics tracking fails', async () => {
      mockAnalyticsService.trackMergeRequestCreated.mockRejectedValue(new Error('Analytics error'));

      const mockEvent: GitLabMergeRequestEvent = {
        object_kind: 'merge_request',
        event_type: 'merge_request',
        user: {
          id: 789,
          name: 'Test User',
          username: 'testuser',
          avatar_url: 'https://example.com/avatar.png',
          email: 'test@example.com'
        },
        project: {
          id: 123,
          name: 'Test Project',
          description: 'Test Description',
          web_url: 'https://gitlab.com/test/repo',
          avatar_url: '',
          git_ssh_url: '',
          git_http_url: '',
          namespace: 'test',
          visibility_level: 0,
          path_with_namespace: 'test/repo',
          default_branch: 'main',
          homepage: '',
          url: '',
          ssh_url: '',
          http_url: ''
        },
        repository: {
          name: 'Test Project',
          url: 'https://gitlab.com/test/repo',
          description: 'Test Description',
          homepage: '',
          git_http_url: '',
          git_ssh_url: '',
          visibility_level: 0
        },
        object_attributes: {
          id: 456,
          iid: 789,
          target_branch: 'main',
          source_branch: 'feature/test',
          source_project_id: 123,
          target_project_id: 123,
          state: 'opened',
          merge_status: 'can_be_merged',
          title: 'Test MR',
          description: 'Test description',
          url: 'https://gitlab.com/test/repo/-/merge_requests/789',
          source: {} as any,
          target: {} as any,
          last_commit: {
            id: 'abc123',
            message: 'Test commit',
            timestamp: '2024-01-01T10:00:00Z',
            url: 'https://gitlab.com/test/repo/-/commit/abc123',
            author: {
              name: 'Test User',
              email: 'test@example.com'
            }
          },
          work_in_progress: false,
          assignee: {
            id: 789,
            name: 'Test User',
            username: 'testuser',
            avatar_url: 'https://example.com/avatar.png',
            email: 'test@example.com'
          },
          assignees: [],
          author: {
            id: 789,
            name: 'Test User',
            username: 'testuser',
            avatar_url: 'https://example.com/avatar.png',
            email: 'test@example.com'
          },
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z',
          action: 'open'
        },
        changes: {},
        labels: []
      };

      const mockReq = {
        body: mockEvent,
        headers: {}
      } as any;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;

      // Should not throw and should complete successfully
      await expect(processWebhook(mockReq, mockRes)).resolves.toBeUndefined();
      
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockWebhookDeduplicationService.completeWebhookProcessing).toHaveBeenCalled();
    });
  });
});
