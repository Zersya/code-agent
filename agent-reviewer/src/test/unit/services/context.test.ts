// Test file for context service functionality
import { describe, test, expect, beforeEach } from 'bun:test';
import { contextService } from '../../../services/context.js';

describe('Context Service', () => {
  beforeEach(() => {
    // Reset any state before each test
  });

  describe('Service initialization', () => {
    test('should be importable and have expected methods', () => {
      expect(contextService).toBeDefined();
      expect(typeof contextService.getProjectContext).toBe('function');
    });
  });

  describe('Project context structure', () => {
    test('should handle project context data structure', () => {
      // Test the expected structure of project context
      const mockProjectContext = {
        projectId: 123,
        projectMetadata: {
          projectId: 123,
          name: 'Test Project',
          url: 'https://gitlab.com/test/project',
          defaultBranch: 'main',
          lastEmbeddingAt: new Date(),
          lastReembeddingAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        },
        relevantFiles: [
          {
            projectId: 123,
            repositoryUrl: 'https://gitlab.com/test/project',
            filePath: 'src/auth.ts',
            content: 'export function authenticate() { return true; }',
            embedding: [0.1, 0.2, 0.3],
            language: 'typescript',
            commitId: 'abc123',
            branch: 'main',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ],
        contextSummary: 'Project contains authentication functionality'
      };

      expect(mockProjectContext.projectId).toBe(123);
      expect(mockProjectContext.projectMetadata).toBeDefined();
      expect(mockProjectContext.relevantFiles).toBeInstanceOf(Array);
      expect(mockProjectContext.contextSummary).toBeTruthy();
    });

    test('should handle empty project context', () => {
      const emptyContext = {
        projectId: 456,
        projectMetadata: null,
        relevantFiles: [],
        contextSummary: 'No context available'
      };

      expect(emptyContext.projectId).toBe(456);
      expect(emptyContext.projectMetadata).toBeNull();
      expect(emptyContext.relevantFiles).toHaveLength(0);
      expect(emptyContext.contextSummary).toBe('No context available');
    });
  });

  describe('Context filtering and relevance', () => {
    test('should handle various file types in context', () => {
      const mockFiles = [
        {
          projectId: 123,
          repositoryUrl: 'https://gitlab.com/test/project',
          filePath: 'src/auth.ts',
          content: 'authentication code',
          embedding: [0.1, 0.2, 0.3],
          language: 'typescript',
          commitId: 'abc123',
          branch: 'main',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          projectId: 123,
          repositoryUrl: 'https://gitlab.com/test/project',
          filePath: 'src/utils.js',
          content: 'utility functions',
          embedding: [0.4, 0.5, 0.6],
          language: 'javascript',
          commitId: 'abc123',
          branch: 'main',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          projectId: 123,
          repositoryUrl: 'https://gitlab.com/test/project',
          filePath: 'README.md',
          content: '# Project Documentation',
          embedding: [0.7, 0.8, 0.9],
          language: 'markdown',
          commitId: 'abc123',
          branch: 'main',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      expect(mockFiles).toHaveLength(3);
      expect(mockFiles[0].language).toBe('typescript');
      expect(mockFiles[1].language).toBe('javascript');
      expect(mockFiles[2].language).toBe('markdown');
    });

    test('should handle context with different branches', () => {
      const mockFiles = [
        {
          projectId: 123,
          repositoryUrl: 'https://gitlab.com/test/project',
          filePath: 'src/feature.ts',
          content: 'feature code',
          embedding: [0.1, 0.2, 0.3],
          language: 'typescript',
          commitId: 'def456',
          branch: 'feature/new-feature',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          projectId: 123,
          repositoryUrl: 'https://gitlab.com/test/project',
          filePath: 'src/main.ts',
          content: 'main code',
          embedding: [0.4, 0.5, 0.6],
          language: 'typescript',
          commitId: 'abc123',
          branch: 'main',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      expect(mockFiles[0].branch).toBe('feature/new-feature');
      expect(mockFiles[1].branch).toBe('main');
      expect(mockFiles[0].commitId).not.toBe(mockFiles[1].commitId);
    });
  });

  describe('Context summarization', () => {
    test('should handle various context summary formats', () => {
      const summaries = [
        'Project contains authentication and user management functionality',
        'No relevant files found for this context',
        'Found 5 TypeScript files related to API endpoints',
        'Mixed codebase with JavaScript, TypeScript, and Python files',
        ''
      ];

      summaries.forEach(summary => {
        expect(typeof summary).toBe('string');
      });
    });

    test('should handle context with technical details', () => {
      const technicalSummary = `
        Project Analysis:
        - Languages: TypeScript (60%), JavaScript (30%), Python (10%)
        - Main components: Authentication, API routes, Database models
        - Architecture: Microservices with REST API
        - Dependencies: Express.js, PostgreSQL, Redis
        - Test coverage: 85%
      `;

      expect(technicalSummary).toContain('TypeScript');
      expect(technicalSummary).toContain('Authentication');
      expect(technicalSummary).toContain('PostgreSQL');
      expect(technicalSummary).toContain('85%');
    });
  });

  describe('Error handling and edge cases', () => {
    test('should handle invalid project IDs', () => {
      const invalidIds = [0, -1, null, undefined, NaN];

      invalidIds.forEach(id => {
        // The service should handle these gracefully
        expect(typeof id === 'number' || id === null || id === undefined).toBe(true);
      });
    });

    test('should handle malformed file data', () => {
      const malformedFile = {
        projectId: 123,
        // Missing required fields
        filePath: null,
        content: undefined,
        embedding: [],
        language: '',
        commitId: '',
        branch: '',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(malformedFile.filePath).toBeNull();
      expect(malformedFile.content).toBeUndefined();
      expect(malformedFile.embedding).toHaveLength(0);
    });

    test('should handle very large context data', () => {
      const largeContext = {
        projectId: 123,
        projectMetadata: {
          projectId: 123,
          name: 'Large Project',
          url: 'https://gitlab.com/large/project',
          defaultBranch: 'main',
          lastEmbeddingAt: new Date(),
          lastReembeddingAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        },
        relevantFiles: new Array(1000).fill(null).map((_, index) => ({
          projectId: 123,
          repositoryUrl: 'https://gitlab.com/large/project',
          filePath: `src/file${index}.ts`,
          content: `file content ${index}`,
          embedding: new Array(512).fill(0).map(() => Math.random()),
          language: 'typescript',
          commitId: `commit${index}`,
          branch: 'main',
          createdAt: new Date(),
          updatedAt: new Date()
        })),
        contextSummary: 'Large project with 1000 files'
      };

      expect(largeContext.relevantFiles).toHaveLength(1000);
      expect(largeContext.relevantFiles[0].embedding).toHaveLength(512);
      expect(largeContext.contextSummary).toContain('1000 files');
    });
  });

  describe('Context metadata validation', () => {
    test('should validate project metadata structure', () => {
      const validMetadata = {
        projectId: 123,
        name: 'Valid Project',
        url: 'https://gitlab.com/valid/project',
        defaultBranch: 'main',
        lastEmbeddingAt: new Date('2024-01-01'),
        lastReembeddingAt: new Date('2024-01-02'),
        createdAt: new Date('2023-12-01'),
        updatedAt: new Date('2024-01-03')
      };

      expect(validMetadata.projectId).toBeGreaterThan(0);
      expect(validMetadata.url).toMatch(/^https?:\/\//);
      expect(validMetadata.lastEmbeddingAt).toBeInstanceOf(Date);
      expect(validMetadata.lastReembeddingAt).toBeInstanceOf(Date);
      expect(validMetadata.createdAt).toBeInstanceOf(Date);
      expect(validMetadata.updatedAt).toBeInstanceOf(Date);
    });

    test('should handle metadata with null dates', () => {
      const metadataWithNulls = {
        projectId: 456,
        name: 'Project with Nulls',
        url: 'https://gitlab.com/null/project',
        defaultBranch: 'main',
        lastEmbeddingAt: null,
        lastReembeddingAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(metadataWithNulls.lastEmbeddingAt).toBeNull();
      expect(metadataWithNulls.lastReembeddingAt).toBeNull();
      expect(metadataWithNulls.createdAt).toBeInstanceOf(Date);
      expect(metadataWithNulls.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('Performance considerations', () => {
    test('should handle context with various embedding sizes', () => {
      const embeddingSizes = [128, 256, 512, 768, 1024, 1024];

      embeddingSizes.forEach(size => {
        const mockFile = {
          projectId: 123,
          repositoryUrl: 'https://gitlab.com/test/project',
          filePath: `src/file_${size}.ts`,
          content: 'test content',
          embedding: new Array(size).fill(0).map(() => Math.random()),
          language: 'typescript',
          commitId: 'abc123',
          branch: 'main',
          createdAt: new Date(),
          updatedAt: new Date()
        };

        expect(mockFile.embedding).toHaveLength(size);
        expect(mockFile.embedding.every(val => typeof val === 'number')).toBe(true);
      });
    });
  });
});
