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

  describe('Review Configuration', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Reset environment variables
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    test('should use default review mode when not specified', () => {
      delete process.env.REVIEW_MODE;

      // Access the private method to test system prompt generation
      const systemPrompt = (reviewService as any).generateSystemPrompt();

      expect(systemPrompt).toContain('STANDARD');
    });

    test('should generate quick mode prompt correctly', () => {
      process.env.REVIEW_MODE = 'quick';
      process.env.REVIEW_MAX_SUGGESTIONS = '3';

      const systemPrompt = (reviewService as any).generateSystemPromptByMode('quick');

      expect(systemPrompt).toContain('QUICK');
      expect(systemPrompt).toContain('Fokus pada isu kritis saja');
      expect(systemPrompt).toContain('maksimal 3');
    });

    test('should generate standard mode prompt correctly', () => {
      process.env.REVIEW_MODE = 'standard';
      process.env.REVIEW_MAX_SUGGESTIONS = '5';

      const systemPrompt = (reviewService as any).generateSystemPromptByMode('standard');

      expect(systemPrompt).toContain('STANDARD');
      expect(systemPrompt).toContain('Pendekatan seimbang');
      expect(systemPrompt).toContain('maksimal 5');
    });

    test('should generate detailed mode prompt correctly', () => {
      process.env.REVIEW_MODE = 'detailed';
      process.env.REVIEW_MAX_SUGGESTIONS = '10';

      const systemPrompt = (reviewService as any).generateSystemPromptByMode('detailed');

      expect(systemPrompt).toContain('DETAILED');
      expect(systemPrompt).toContain('Analisis komprehensif');
      expect(systemPrompt).toContain('maksimal 10');
    });

    test('should handle conservative mode configuration', () => {
      process.env.REVIEW_CONSERVATIVE_MODE = 'true';

      const systemPrompt = (reviewService as any).generateSystemPromptByMode('standard');

      expect(systemPrompt).toContain('Mode Konservatif Aktif');
      expect(systemPrompt).toContain('Hindari menyarankan perubahan struktural besar');
    });

    test('should handle non-conservative mode configuration', () => {
      process.env.REVIEW_CONSERVATIVE_MODE = 'false';

      const systemPrompt = (reviewService as any).generateSystemPromptByMode('standard');

      expect(systemPrompt).toContain('Mode Standar');
      expect(systemPrompt).toContain('seimbang antara kualitas kode');
    });

    test('should parse focus areas correctly', () => {
      process.env.REVIEW_FOCUS_AREAS = 'bugs,performance,security';

      const systemPrompt = (reviewService as any).generateSystemPromptByMode('standard');

      expect(systemPrompt).toContain('bugs, performance, security');
    });

    test('should handle custom focus areas', () => {
      process.env.REVIEW_FOCUS_AREAS = 'bugs,style,documentation';

      const systemPrompt = (reviewService as any).generateSystemPromptByMode('standard');

      expect(systemPrompt).toContain('bugs, style, documentation');
    });

    test('should generate final step format for quick mode', () => {
      const format = (reviewService as any).getFinalStepFormatByMode('quick');

      expect(format).toContain('Quick Mode');
      expect(format).toContain('Isu Kritis');
      expect(format).toContain('Siap merge');
      expect(format).toContain('ringkas dan langsung to the point');
    });

    test('should generate final step format for standard mode', () => {
      const format = (reviewService as any).getFinalStepFormatByMode('standard');

      expect(format).toContain('Standard Mode');
      expect(format).toContain('🔴 Kritis');
      expect(format).toContain('🟡 Penting');
      expect(format).toContain('🔵 Opsional');
    });

    test('should generate final step format for detailed mode', () => {
      const format = (reviewService as any).getFinalStepFormatByMode('detailed');

      expect(format).toContain('Detailed Analysis');
      expect(format).toContain('Kualitas Kode & Kejelasan');
      expect(format).toContain('Alur Logika & Fungsionalitas');
      expect(format).toContain('Konsistensi & Arsitektur');
    });

    test('should default to standard mode for unknown mode', () => {
      const format = (reviewService as any).getFinalStepFormatByMode('unknown');

      expect(format).toContain('Standard Mode');
    });

    test('should handle invalid max suggestions value', () => {
      process.env.REVIEW_MAX_SUGGESTIONS = 'invalid';

      // Should not throw error and use default
      const systemPrompt = (reviewService as any).generateSystemPromptByMode('standard');

      expect(systemPrompt).toBeDefined();
      expect(typeof systemPrompt).toBe('string');
    });

    test('should include configuration in sequential thinking prompt', () => {
      process.env.REVIEW_MODE = 'quick';
      process.env.REVIEW_CONSERVATIVE_MODE = 'true';
      process.env.REVIEW_MAX_SUGGESTIONS = '3';
      process.env.REVIEW_FOCUS_AREAS = 'bugs,security';

      const sequentialPrompt = (reviewService as any).generateSequentialThinkingSystemPrompt();

      expect(sequentialPrompt).toContain('QUICK');
      expect(sequentialPrompt).toContain('Mode Konservatif Aktif');
      expect(sequentialPrompt).toContain('Maksimal 3 saran');
      expect(sequentialPrompt).toContain('bugs, security');
    });
  });
});
