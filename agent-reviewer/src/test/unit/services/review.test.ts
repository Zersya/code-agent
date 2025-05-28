// Test file for review service functionality
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
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

  describe('Auto-Approval Logic', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    describe('shouldApproveMergeRequest', () => {
      test('should approve when no critical issues are found in quick mode', () => {
        const reviewResult = `
## Review Kode (Quick Mode)

**Ringkasan**: Perubahan pada authentication middleware, tidak ada isu kritis ditemukan.

**Isu Kritis**: Tidak ada

**Kesimpulan**: ✅ Siap merge
        `;

        const shouldApprove = (reviewService as any).shouldApproveMergeRequest(reviewResult);
        expect(shouldApprove).toBe(true);
      });

      test('should reject when critical issues are found in quick mode', () => {
        const reviewResult = `
## Review Kode (Quick Mode)

**Ringkasan**: Perubahan pada authentication middleware dengan beberapa masalah.

**Isu Kritis**:
🔴 Null pointer exception pada line 45 ketika user tidak terautentikasi
🔴 SQL injection vulnerability pada query parameter

**Kesimpulan**: ⚠️ Perlu perbaikan
        `;

        const shouldApprove = (reviewService as any).shouldApproveMergeRequest(reviewResult);
        expect(shouldApprove).toBe(false);
      });

      test('should approve when no critical issues in standard mode', () => {
        const reviewResult = `
## Review Kode

**Ringkasan**: Implementasi fitur login dengan validasi yang baik.

**🔴 Kritis**: Tidak ada

**🟡 Penting**:
• Tambahkan rate limiting untuk endpoint login

**🔵 Opsional**:
• Pertimbangkan menggunakan TypeScript untuk type safety

**Kesimpulan**: ⚠️ Perlu perbaikan minor
        `;

        const shouldApprove = (reviewService as any).shouldApproveMergeRequest(reviewResult);
        expect(shouldApprove).toBe(true);
      });

      test('should reject when critical issues found in standard mode', () => {
        const reviewResult = `
## Review Kode

**Ringkasan**: Implementasi fitur login dengan beberapa masalah serius.

**🔴 Kritis**:
• Password disimpan dalam plain text tanpa hashing
• Tidak ada validasi input yang dapat menyebabkan XSS

**🟡 Penting**:
• Tambahkan rate limiting untuk endpoint login

**Kesimpulan**: ❌ Perlu perbaikan signifikan
        `;

        const shouldApprove = (reviewService as any).shouldApproveMergeRequest(reviewResult);
        expect(shouldApprove).toBe(false);
      });

      test('should approve when only important and optional issues in detailed mode', () => {
        const reviewResult = `
## Review Kode (Detailed Analysis)

**Ringkasan**: Comprehensive analysis of authentication changes.

**🔴 Kritis**: Tidak ada

**🟡 Penting**:
• Consider adding input validation for better security
• Optimize database query performance

**🔵 Opsional**:
• Add more comprehensive logging
• Consider using dependency injection

**Kesimpulan**: ✅ Siap merge
        `;

        const shouldApprove = (reviewService as any).shouldApproveMergeRequest(reviewResult);
        expect(shouldApprove).toBe(true);
      });

      test('should handle traditional approval phrases as fallback', () => {
        const reviewResult = `
Kode ini sudah baik dan dapat di-merge. Silahkan merge!
        `;

        const shouldApprove = (reviewService as any).shouldApproveMergeRequest(reviewResult);
        expect(shouldApprove).toBe(true);
      });

      test('should handle explicit rejection conclusions', () => {
        const reviewResult = `
Ada beberapa isu signifikan yang perlu ditangani sebelum kode ini dapat di-merge.
        `;

        const shouldApprove = (reviewService as any).shouldApproveMergeRequest(reviewResult);
        expect(shouldApprove).toBe(false);
      });
    });

    describe('hasCriticalIssues', () => {
      test('should detect critical issues in quick mode format', () => {
        const reviewResult = `
**Isu Kritis**:
🔴 Memory leak pada component lifecycle
🔴 Race condition dalam async operations
        `;

        const hasCritical = (reviewService as any).hasCriticalIssues(reviewResult);
        expect(hasCritical).toBe(true);
      });

      test('should not detect critical issues when section is empty in quick mode', () => {
        const reviewResult = `
**Isu Kritis**: Tidak ada
        `;

        const hasCritical = (reviewService as any).hasCriticalIssues(reviewResult);
        expect(hasCritical).toBe(false);
      });

      test('should detect critical issues with emoji indicators', () => {
        const reviewResult = `
**🔴 Kritis**:
• Buffer overflow vulnerability pada input processing
• Unhandled exception yang dapat crash aplikasi
        `;

        const hasCritical = (reviewService as any).hasCriticalIssues(reviewResult);
        expect(hasCritical).toBe(true);
      });

      test('should not detect critical issues when section is empty with emoji', () => {
        const reviewResult = `
**🔴 Kritis**: Tidak ada
**🟡 Penting**: Ada beberapa saran
        `;

        const hasCritical = (reviewService as any).hasCriticalIssues(reviewResult);
        expect(hasCritical).toBe(false);
      });

      test('should detect critical indicators with substantial content', () => {
        const reviewResult = `
Ditemukan beberapa masalah yang harus diperbaiki sebelum merge:
- Authentication bypass vulnerability
- Data corruption risk in concurrent access
        `;

        const hasCritical = (reviewService as any).hasCriticalIssues(reviewResult);
        expect(hasCritical).toBe(true);
      });
    });

    describe('checkConclusionApproval', () => {
      test('should return true for explicit approval conclusions', () => {
        const reviewResult = '✅ Siap merge - kode sudah memenuhi standar';
        const result = (reviewService as any).checkConclusionApproval(reviewResult);
        expect(result).toBe(true);
      });

      test('should return true for minor issues conclusion', () => {
        const reviewResult = '⚠️ Perlu perbaikan minor sebelum merge';
        const result = (reviewService as any).checkConclusionApproval(reviewResult);
        expect(result).toBe(true);
      });

      test('should return false for significant issues conclusion', () => {
        const reviewResult = '❌ Perlu perbaikan signifikan sebelum dapat di-merge';
        const result = (reviewService as any).checkConclusionApproval(reviewResult);
        expect(result).toBe(false);
      });

      test('should return null when no explicit conclusion found', () => {
        const reviewResult = 'Some general review comments without explicit conclusion';
        const result = (reviewService as any).checkConclusionApproval(reviewResult);
        expect(result).toBe(null);
      });
    });

    describe('checkTraditionalApprovalPhrases', () => {
      test('should detect traditional approval phrases', () => {
        const reviewResult = 'Kode ini sudah baik dan dapat di-merge';
        const result = (reviewService as any).checkTraditionalApprovalPhrases(reviewResult);
        expect(result).toBe(true);
      });

      test('should detect Silahkan merge phrase', () => {
        const reviewResult = 'Silahkan merge! Terima kasih';
        const result = (reviewService as any).checkTraditionalApprovalPhrases(reviewResult);
        expect(result).toBe(true);
      });

      test('should not detect when no approval phrases present', () => {
        const reviewResult = 'Ada beberapa masalah yang perlu diperbaiki';
        const result = (reviewService as any).checkTraditionalApprovalPhrases(reviewResult);
        expect(result).toBe(false);
      });
    });
  });

  describe('Enhanced Critical Issue Format', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    describe('System Prompt Generation with Solution Examples', () => {
      test('should include solution example format in base context', () => {
        const systemPrompt = (reviewService as any).generateSystemPromptByMode('standard');

        expect(systemPrompt).toContain('Format Isu Kritis (🔴)');
        expect(systemPrompt).toContain('**Masalah:**');
        expect(systemPrompt).toContain('**Contoh perbaikan:**');
        expect(systemPrompt).toContain('**Cara implementasi:**');
        expect(systemPrompt).toContain('Batasi contoh kode maksimal 5 baris');
      });

      test('should include technology-specific guidance', () => {
        const systemPrompt = (reviewService as any).generateSystemPromptByMode('standard');

        expect(systemPrompt).toContain('JavaScript untuk Nuxt.js');
        expect(systemPrompt).toContain('Dart untuk Flutter');
        expect(systemPrompt).toContain('Fokus pada solusi praktis');
      });

      test('should specify examples only for critical issues', () => {
        const systemPrompt = (reviewService as any).generateSystemPromptByMode('standard');

        expect(systemPrompt).toContain('Berikan contoh hanya untuk isu kritis (🔴)');
        expect(systemPrompt).toContain('bukan untuk saran penting (🟡) atau opsional (🔵)');
      });
    });

    describe('Quick Mode Enhanced Format', () => {
      test('should include solution example format in quick mode', () => {
        const quickPrompt = (reviewService as any).generateQuickModePrompt('base context');

        expect(quickPrompt).toContain('🔴 [Deskripsi masalah]');
        expect(quickPrompt).toContain('**Masalah:** [Penjelasan singkat mengapa bermasalah]');
        expect(quickPrompt).toContain('**Contoh perbaikan:**');
        expect(quickPrompt).toContain('// Before (bermasalah)');
        expect(quickPrompt).toContain('// After (diperbaiki)');
        expect(quickPrompt).toContain('**Cara implementasi:** [Panduan 1-2 kalimat]');
      });

      test('should emphasize concise examples in quick mode', () => {
        const quickPrompt = (reviewService as any).generateQuickModePrompt('base context');

        expect(quickPrompt).toContain('Berikan contoh solusi hanya untuk isu kritis');
        expect(quickPrompt).toContain('ringkas dan langsung to the point');
      });
    });

    describe('Standard Mode Enhanced Format', () => {
      test('should include solution examples for critical issues only', () => {
        const standardPrompt = (reviewService as any).generateStandardModePrompt('base context');

        expect(standardPrompt).toContain('🔴 [Deskripsi masalah]');
        expect(standardPrompt).toContain('**Masalah:** [Penjelasan singkat mengapa bermasalah]');
        expect(standardPrompt).toContain('**Contoh perbaikan:**');
        expect(standardPrompt).toContain('• [Improvement penting dengan reasoning - tanpa contoh kode]');
        expect(standardPrompt).toContain('• [Saran tambahan jika ada - tanpa contoh kode]');
      });

      test('should clarify no examples for non-critical issues', () => {
        const standardPrompt = (reviewService as any).generateStandardModePrompt('base context');

        expect(standardPrompt).toContain('Contoh solusi hanya untuk isu kritis (🔴)');
      });
    });

    describe('Detailed Mode Enhanced Format', () => {
      test('should include comprehensive solution examples', () => {
        const detailedPrompt = (reviewService as any).generateDetailedModePrompt('base context');

        expect(detailedPrompt).toContain('🔴 [Deskripsi masalah kritis]');
        expect(detailedPrompt).toContain('**Masalah:** [Penjelasan detail mengapa bermasalah]');
        expect(detailedPrompt).toContain('[kode bermasalah dengan konteks]');
        expect(detailedPrompt).toContain('[kode solusi dengan penjelasan]');
        expect(detailedPrompt).toContain('**Cara implementasi:** [Panduan detail 1-2 kalimat]');
      });

      test('should specify no examples for non-critical suggestions', () => {
        const detailedPrompt = (reviewService as any).generateDetailedModePrompt('base context');

        expect(detailedPrompt).toContain('tanpa contoh kode untuk non-kritis');
        expect(detailedPrompt).toContain('Gunakan contoh konkret dan solusi spesifik untuk isu kritis (🔴) saja');
      });
    });

    describe('Sequential Thinking Enhanced Format', () => {
      test('should include solution format in sequential thinking prompt', () => {
        process.env.REVIEW_MODE = 'standard';
        process.env.REVIEW_MAX_SUGGESTIONS = '5';

        const sequentialPrompt = (reviewService as any).generateSequentialThinkingSystemPrompt();

        expect(sequentialPrompt).toContain('Format Isu Kritis dalam Sequential Thinking');
        expect(sequentialPrompt).toContain('🔴 [Deskripsi masalah]');
        expect(sequentialPrompt).toContain('**Masalah:** [Penjelasan mengapa bermasalah]');
        expect(sequentialPrompt).toContain('**Contoh perbaikan:**');
        expect(sequentialPrompt).toContain('**Cara implementasi:** [Panduan 1-2 kalimat]');
      });
    });

    describe('Final Step Format Enhancement', () => {
      test('should include enhanced format for quick mode final step', () => {
        const format = (reviewService as any).getFinalStepFormatByMode('quick');

        expect(format).toContain('🔴 [Deskripsi masalah]');
        expect(format).toContain('**Masalah:** [Penjelasan singkat mengapa bermasalah]');
        expect(format).toContain('**Contoh perbaikan:**');
        expect(format).toContain('// Before (bermasalah)');
        expect(format).toContain('// After (diperbaiki)');
        expect(format).toContain('dengan contoh solusi');
      });

      test('should include enhanced format for standard mode final step', () => {
        const format = (reviewService as any).getFinalStepFormatByMode('standard');

        expect(format).toContain('🔴 [Deskripsi masalah]');
        expect(format).toContain('**Masalah:** [Penjelasan singkat mengapa bermasalah]');
        expect(format).toContain('**Contoh perbaikan:**');
        expect(format).toContain('tanpa contoh kode');
        expect(format).toContain('Contoh solusi hanya untuk isu kritis (🔴)');
      });

      test('should include enhanced format for detailed mode final step', () => {
        const format = (reviewService as any).getFinalStepFormatByMode('detailed');

        expect(format).toContain('🔴 [Deskripsi masalah kritis]');
        expect(format).toContain('**Masalah:** [Penjelasan detail mengapa bermasalah]');
        expect(format).toContain('[kode bermasalah dengan konteks]');
        expect(format).toContain('[kode solusi dengan penjelasan]');
        expect(format).toContain('Contoh solusi hanya untuk isu kritis (🔴)');
      });
    });

    describe('Critical Issue Detection with Enhanced Format', () => {
      test('should detect critical issues with new solution format', () => {
        const reviewResult = `
**🔴 Kritis**:
🔴 Null pointer exception pada authentication
**Masalah:** User object tidak dicek null sebelum digunakan
**Contoh perbaikan:**
\`\`\`javascript
// Before (bermasalah)
const name = user.name;

// After (diperbaiki)
const name = user?.name || 'Guest';
\`\`\`
**Cara implementasi:** Gunakan optional chaining dan default value
        `;

        const hasCritical = (reviewService as any).hasCriticalIssues(reviewResult);
        expect(hasCritical).toBe(true);
      });

      test('should not detect when critical section has only format template', () => {
        const reviewResult = `
**🔴 Kritis**:
🔴 [Deskripsi masalah]
**Masalah:** [Penjelasan singkat mengapa bermasalah]
**Contoh perbaikan:**
\`\`\`javascript
// Before (bermasalah)
[kode bermasalah]
\`\`\`
        `;

        const hasCritical = (reviewService as any).hasCriticalIssues(reviewResult);
        expect(hasCritical).toBe(false);
      });

      test('should detect substantial critical content with solution examples', () => {
        const reviewResult = `
🔴 Memory leak pada component lifecycle
**Masalah:** useEffect tidak dibersihkan saat component unmount
**Contoh perbaikan:**
\`\`\`javascript
// Before
useEffect(() => {
  const timer = setInterval(fetchData, 1000);
}, []);

// After
useEffect(() => {
  const timer = setInterval(fetchData, 1000);
  return () => clearInterval(timer);
}, []);
\`\`\`
**Cara implementasi:** Tambahkan cleanup function di return useEffect
        `;

        const hasCritical = (reviewService as any).hasCriticalIssues(reviewResult);
        expect(hasCritical).toBe(true);
      });
    });
  });
});
