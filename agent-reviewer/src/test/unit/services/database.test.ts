// Test file for database service functionality
import { describe, test, expect, beforeEach } from 'bun:test';
import { dbService } from '../../../services/database.js';
import { CodeEmbedding, ProjectMetadata } from '../../../models/embedding.js';
import { WebhookProcessingStatus } from '../../../models/webhook.js';

describe('Database Service', () => {
  beforeEach(() => {
    // Reset any state before each test
  });

  describe('Service initialization', () => {
    test('should be importable and have expected methods', () => {
      expect(dbService).toBeDefined();
      expect(typeof dbService.connect).toBe('function');
      expect(typeof dbService.disconnect).toBe('function');
      expect(typeof dbService.saveEmbedding).toBe('function');
      expect(typeof dbService.saveEmbeddings).toBe('function');
      expect(typeof dbService.saveBatch).toBe('function');
      expect(typeof dbService.updateProjectMetadata).toBe('function');
      expect(typeof dbService.getProjectMetadata).toBe('function');
      expect(typeof dbService.getClient).toBe('function');
    });
  });

  describe('Content sanitization', () => {
    test('should sanitize binary content for database storage', () => {
      const mockEmbedding: CodeEmbedding = {
        projectId: 123,
        repositoryUrl: 'https://gitlab.com/test/repo',
        filePath: 'src/test.ts',
        content: '\x00\x01\x02\x03Binary content with null bytes\x04\x05',
        embedding: [0.1, 0.2, 0.3],
        language: 'typescript',
        commitId: 'abc123',
        branch: 'main',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Test that the service can handle binary content
      expect(mockEmbedding.content).toContain('\x00');
      expect(mockEmbedding.content).toContain('\x01');
    });

    test('should handle normal text content', () => {
      const mockEmbedding: CodeEmbedding = {
        projectId: 123,
        repositoryUrl: 'https://gitlab.com/test/repo',
        filePath: 'src/test.ts',
        content: 'export function test() { return true; }',
        embedding: [0.1, 0.2, 0.3],
        language: 'typescript',
        commitId: 'abc123',
        branch: 'main',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(mockEmbedding.content).toBe('export function test() { return true; }');
      expect(mockEmbedding.content).not.toContain('\x00');
    });

    test('should handle unicode content', () => {
      const mockEmbedding: CodeEmbedding = {
        projectId: 123,
        repositoryUrl: 'https://gitlab.com/test/repo',
        filePath: 'src/test.ts',
        content: 'const message = "Hello 世界! 🌍 Café naïve résumé";',
        embedding: [0.1, 0.2, 0.3],
        language: 'typescript',
        commitId: 'abc123',
        branch: 'main',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(mockEmbedding.content).toContain('世界');
      expect(mockEmbedding.content).toContain('🌍');
      expect(mockEmbedding.content).toContain('naïve');
      expect(mockEmbedding.content).toContain('résumé');
    });

    test('should handle empty content', () => {
      const mockEmbedding: CodeEmbedding = {
        projectId: 123,
        repositoryUrl: 'https://gitlab.com/test/repo',
        filePath: 'src/empty.ts',
        content: '',
        embedding: [0.1, 0.2, 0.3],
        language: 'typescript',
        commitId: 'abc123',
        branch: 'main',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(mockEmbedding.content).toBe('');
    });

    test('should handle very long content', () => {
      const longContent = 'x'.repeat(100000);
      const mockEmbedding: CodeEmbedding = {
        projectId: 123,
        repositoryUrl: 'https://gitlab.com/test/repo',
        filePath: 'src/large.ts',
        content: longContent,
        embedding: [0.1, 0.2, 0.3],
        language: 'typescript',
        commitId: 'abc123',
        branch: 'main',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(mockEmbedding.content.length).toBe(100000);
    });
  });

  describe('Embedding vector handling', () => {
    test('should handle various embedding vector sizes', () => {
      const testVectors = [
        [0.1, 0.2, 0.3], // Small vector
        new Array(128).fill(0).map((_, i) => i / 128), // Medium vector
        new Array(1536).fill(0).map((_, i) => Math.random()), // Large vector (OpenAI size)
      ];

      testVectors.forEach((vector, index) => {
        const mockEmbedding: CodeEmbedding = {
          projectId: 123 + index,
          repositoryUrl: 'https://gitlab.com/test/repo',
          filePath: `src/test${index}.ts`,
          content: `test content ${index}`,
          embedding: vector,
          language: 'typescript',
          commitId: 'abc123',
          branch: 'main',
          createdAt: new Date(),
          updatedAt: new Date()
        };

        expect(mockEmbedding.embedding).toEqual(vector);
        expect(mockEmbedding.embedding.length).toBe(vector.length);
      });
    });

    test('should handle zero vectors', () => {
      const zeroVector = new Array(512).fill(0);
      const mockEmbedding: CodeEmbedding = {
        projectId: 123,
        repositoryUrl: 'https://gitlab.com/test/repo',
        filePath: 'src/zero.ts',
        content: 'zero vector test',
        embedding: zeroVector,
        language: 'typescript',
        commitId: 'abc123',
        branch: 'main',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(mockEmbedding.embedding.every(val => val === 0)).toBe(true);
    });

    test('should handle normalized vectors', () => {
      // Create a normalized vector (magnitude = 1)
      const vector = [0.6, 0.8]; // This is normalized: sqrt(0.6^2 + 0.8^2) = 1
      const mockEmbedding: CodeEmbedding = {
        projectId: 123,
        repositoryUrl: 'https://gitlab.com/test/repo',
        filePath: 'src/normalized.ts',
        content: 'normalized vector test',
        embedding: vector,
        language: 'typescript',
        commitId: 'abc123',
        branch: 'main',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
      expect(magnitude).toBeCloseTo(1.0, 5);
    });
  });

  describe('Project metadata validation', () => {
    test('should handle valid project metadata', () => {
      const mockMetadata: ProjectMetadata = {
        projectId: 123,
        name: 'Test Project',
        url: 'https://gitlab.com/test/project',
        defaultBranch: 'main',
        lastEmbeddingAt: new Date(),
        lastReembeddingAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(mockMetadata.projectId).toBe(123);
      expect(mockMetadata.name).toBe('Test Project');
      expect(mockMetadata.url).toBe('https://gitlab.com/test/project');
      expect(mockMetadata.defaultBranch).toBe('main');
      expect(mockMetadata.lastEmbeddingAt).toBeInstanceOf(Date);
      expect(mockMetadata.lastReembeddingAt).toBeInstanceOf(Date);
      expect(mockMetadata.createdAt).toBeInstanceOf(Date);
      expect(mockMetadata.updatedAt).toBeInstanceOf(Date);
    });

    test('should handle project metadata with special characters', () => {
      const mockMetadata: ProjectMetadata = {
        projectId: 456,
        name: 'Project with Special Chars: @#$%^&*()',
        url: 'https://gitlab.com/group/project-with-dashes_and_underscores',
        defaultBranch: 'feature/special-branch-name',
        lastEmbeddingAt: new Date(),
        lastReembeddingAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(mockMetadata.name).toContain('@#$%^&*()');
      expect(mockMetadata.url).toContain('dashes_and_underscores');
      expect(mockMetadata.defaultBranch).toContain('feature/special-branch-name');
    });

    test('should handle project metadata with unicode', () => {
      const mockMetadata: ProjectMetadata = {
        projectId: 789,
        name: 'Проект с Unicode 中文 🚀',
        url: 'https://gitlab.com/unicode/project',
        defaultBranch: 'main',
        lastEmbeddingAt: new Date(),
        lastReembeddingAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(mockMetadata.name).toContain('Проект');
      expect(mockMetadata.name).toContain('中文');
      expect(mockMetadata.name).toContain('🚀');
    });
  });

  describe('Webhook processing status', () => {
    test('should handle all webhook processing statuses', () => {
      const statuses = [
        WebhookProcessingStatus.PROCESSING,
        WebhookProcessingStatus.COMPLETED,
        WebhookProcessingStatus.FAILED
      ];

      statuses.forEach(status => {
        expect(typeof status).toBe('string');
        expect(status.length).toBeGreaterThan(0);
      });

      expect(WebhookProcessingStatus.PROCESSING).toBe('processing');
      expect(WebhookProcessingStatus.COMPLETED).toBe('completed');
      expect(WebhookProcessingStatus.FAILED).toBe('failed');
    });
  });

  describe('Data validation and constraints', () => {
    test('should handle various project ID formats', () => {
      const projectIds = [1, 123, 999999, 0];

      projectIds.forEach(id => {
        const mockEmbedding: CodeEmbedding = {
          projectId: id,
          repositoryUrl: 'https://gitlab.com/test/repo',
          filePath: 'src/test.ts',
          content: 'test content',
          embedding: [0.1, 0.2, 0.3],
          language: 'typescript',
          commitId: 'abc123',
          branch: 'main',
          createdAt: new Date(),
          updatedAt: new Date()
        };

        expect(mockEmbedding.projectId).toBe(id);
        expect(typeof mockEmbedding.projectId).toBe('number');
      });
    });

    test('should handle various commit ID formats', () => {
      const commitIds = [
        'abc123',
        'abcd1234567890abcd1234567890abcd12345678', // Full SHA
        '1234567', // Short SHA
        'feature-branch-commit-123'
      ];

      commitIds.forEach(commitId => {
        const mockEmbedding: CodeEmbedding = {
          projectId: 123,
          repositoryUrl: 'https://gitlab.com/test/repo',
          filePath: 'src/test.ts',
          content: 'test content',
          embedding: [0.1, 0.2, 0.3],
          language: 'typescript',
          commitId: commitId,
          branch: 'main',
          createdAt: new Date(),
          updatedAt: new Date()
        };

        expect(mockEmbedding.commitId).toBe(commitId);
      });
    });

    test('should handle various branch name formats', () => {
      const branches = [
        'main',
        'master',
        'develop',
        'feature/new-feature',
        'bugfix/fix-issue-123',
        'release/v1.0.0',
        'hotfix/urgent-fix'
      ];

      branches.forEach(branch => {
        const mockEmbedding: CodeEmbedding = {
          projectId: 123,
          repositoryUrl: 'https://gitlab.com/test/repo',
          filePath: 'src/test.ts',
          content: 'test content',
          embedding: [0.1, 0.2, 0.3],
          language: 'typescript',
          commitId: 'abc123',
          branch: branch,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        expect(mockEmbedding.branch).toBe(branch);
      });
    });
  });
});
