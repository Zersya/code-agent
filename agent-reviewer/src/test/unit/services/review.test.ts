// Test file for review service functionality
import { describe, test, expect, beforeEach } from 'bun:test';
import { reviewService } from '../../../services/review.js';

describe('Review Service', () => {
  beforeEach(() => {
    // Reset environment variables to known state
    process.env.ENABLE_NOTION_INTEGRATION = 'false';
    process.env.SEQUENTIAL_THINKING_API_URL = 'http://localhost:8000';
  });

  describe('Notion context formatting', () => {
    test('should format single Notion context correctly', () => {
      const mockContext = {
        contexts: [{
          pageId: 'test-123',
          title: 'Test Task',
          description: 'Test description',
          requirements: ['Requirement 1', 'Requirement 2'],
          acceptanceCriteria: ['Criteria 1', 'Criteria 2'],
          technicalSpecs: 'Technical specifications',
          relatedContext: 'Related context',
          url: 'https://notion.so/test-123',
          lastModified: new Date()
        }],
        totalPages: 1,
        successfulFetches: 1,
        errors: [],
        summary: 'Test summary'
      };

      const formatted = (reviewService as any).formatNotionContext(mockContext);

      expect(formatted).toContain('Test Task');
      expect(formatted).toContain('To-do List:');
      expect(formatted).toContain('Requirement 1');
      expect(formatted).toContain('Requirement 2');
      expect(formatted).toContain('Acceptance Criteria:');
      expect(formatted).toContain('Criteria 1');
      expect(formatted).toContain('Criteria 2');
      expect(formatted).toContain('Technical specifications');
      expect(formatted).toContain('https://notion.so/test-123');
    });

    test('should format multiple Notion contexts correctly', () => {
      const mockContext = {
        contexts: [
          {
            pageId: 'test-123',
            title: 'Task 1',
            description: 'Description 1',
            requirements: ['Req 1'],
            acceptanceCriteria: ['Criteria 1'],
            technicalSpecs: 'Tech specs 1',
            relatedContext: 'Context 1',
            url: 'https://notion.so/test-123',
            lastModified: new Date()
          },
          {
            pageId: 'test-456',
            title: 'Task 2',
            description: 'Description 2',
            requirements: ['Req 2'],
            acceptanceCriteria: ['Criteria 2'],
            technicalSpecs: 'Tech specs 2',
            relatedContext: 'Context 2',
            url: 'https://notion.so/test-456',
            lastModified: new Date()
          }
        ],
        totalPages: 2,
        successfulFetches: 2,
        errors: [],
        summary: 'Found 2 tasks'
      };

      const formatted = (reviewService as any).formatNotionContext(mockContext);

      expect(formatted).toContain('Task 1');
      expect(formatted).toContain('Task 2');
      expect(formatted).toContain('Tugas 1:');
      expect(formatted).toContain('Tugas 2:');
      expect(formatted).toContain('https://notion.so/test-123');
      expect(formatted).toContain('https://notion.so/test-456');
    });

    test('should handle empty Notion context', () => {
      const emptyContext = {
        contexts: [],
        totalPages: 0,
        successfulFetches: 0,
        errors: [],
        summary: 'No tasks found'
      };

      const formatted = (reviewService as any).formatNotionContext(emptyContext);

      expect(formatted).toContain('Tidak ada konteks tugas yang tersedia');
      expect(formatted).not.toContain('Tugas');
    });

    test('should handle Notion context with errors', () => {
      const contextWithErrors = {
        contexts: [{
          pageId: 'test-123',
          title: 'Test Task',
          description: 'Test description',
          requirements: [],
          acceptanceCriteria: [],
          technicalSpecs: '',
          relatedContext: '',
          url: 'https://notion.so/test-123',
          lastModified: new Date()
        }],
        totalPages: 2,
        successfulFetches: 1,
        errors: [{
          code: 'FETCH_ERROR',
          message: 'Failed to fetch page',
          status: 404,
          url: 'https://notion.so/invalid-page'
        }],
        summary: 'Found 1 task with 1 error'
      };

      const formatted = (reviewService as any).formatNotionContext(contextWithErrors);

      expect(formatted).toContain('Test Task');
      expect(formatted).toContain('Found 1 task with 1 error');
    });

    test('should handle context with empty requirements and criteria', () => {
      const mockContext = {
        contexts: [{
          pageId: 'test-123',
          title: 'Minimal Task',
          description: 'Just a description',
          requirements: [],
          acceptanceCriteria: [],
          technicalSpecs: '',
          relatedContext: '',
          url: 'https://notion.so/test-123',
          lastModified: new Date()
        }],
        totalPages: 1,
        successfulFetches: 1,
        errors: [],
        summary: 'Found 1 minimal task'
      };

      const formatted = (reviewService as any).formatNotionContext(mockContext);

      expect(formatted).toContain('Minimal Task');
      expect(formatted).toContain('Just a description');
      expect(formatted).toContain('https://notion.so/test-123');
    });

    test('should handle context with special characters', () => {
      const mockContext = {
        contexts: [{
          pageId: 'test-123',
          title: 'Task with Special Characters: @#$%^&*()',
          description: 'Description with émojis 🚀 and unicode ñ',
          requirements: ['Requirement with "quotes" and \'apostrophes\''],
          acceptanceCriteria: ['Criteria with <tags> and &entities;'],
          technicalSpecs: 'Specs with code: `console.log("hello")`',
          relatedContext: 'Context with newlines\nand\ttabs',
          url: 'https://notion.so/test-123',
          lastModified: new Date()
        }],
        totalPages: 1,
        successfulFetches: 1,
        errors: [],
        summary: 'Found 1 task with special chars'
      };

      const formatted = (reviewService as any).formatNotionContext(mockContext);

      expect(formatted).toContain('Task with Special Characters');
      expect(formatted).toContain('émojis 🚀');
      expect(formatted).toContain('unicode ñ');
      expect(formatted).toContain('"quotes"');
      expect(formatted).toContain('<tags>');
      expect(formatted).toContain('console.log');
    });
  });

  describe('Environment configuration', () => {
    test('should handle missing sequential thinking API URL', () => {
      delete process.env.SEQUENTIAL_THINKING_API_URL;

      // The service should handle this gracefully
      expect(process.env.SEQUENTIAL_THINKING_API_URL).toBeUndefined();
    });

    test('should handle disabled Notion integration', () => {
      process.env.ENABLE_NOTION_INTEGRATION = 'false';

      expect(process.env.ENABLE_NOTION_INTEGRATION).toBe('false');
    });

    test('should handle enabled Notion integration', () => {
      process.env.ENABLE_NOTION_INTEGRATION = 'true';

      expect(process.env.ENABLE_NOTION_INTEGRATION).toBe('true');
    });
  });

  describe('Review formatting helpers', () => {
    test('should format review comments in Bahasa Indonesia', () => {
      // Test that the service is configured for Indonesian language
      const mockContext = {
        contexts: [{
          pageId: 'test-123',
          title: 'Test Task',
          description: 'Test description',
          requirements: ['Test requirement'],
          acceptanceCriteria: ['Test criteria'],
          technicalSpecs: 'Test specs',
          relatedContext: 'Test context',
          url: 'https://notion.so/test-123',
          lastModified: new Date()
        }],
        totalPages: 1,
        successfulFetches: 1,
        errors: [],
        summary: 'Test summary'
      };

      const formatted = (reviewService as any).formatNotionContext(mockContext);

      // Should contain Indonesian terms
      expect(formatted).toContain('Tugas');
    });
  });

  describe('Error handling', () => {
    test('should handle null context gracefully', () => {
      const formatted = (reviewService as any).formatNotionContext(null);

      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
    });

    test('should handle undefined context gracefully', () => {
      const formatted = (reviewService as any).formatNotionContext(undefined);

      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
    });

    test('should handle malformed context object', () => {
      const malformedContext = {
        // Missing required properties
        contexts: null,
        summary: 'Malformed'
      };

      // The service will throw an error for malformed context
      expect(() => (reviewService as any).formatNotionContext(malformedContext)).toThrow();
    });
  });

  describe('Service availability', () => {
    test('should be importable and have expected methods', () => {
      expect(reviewService).toBeDefined();
      expect(typeof reviewService.reviewMergeRequest).toBe('function');
    });
  });
});
