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
 [Deskripsi masalah]
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
        **Isu Kritis**:
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

      test('should detect critical issues when in quick mode format', () => {
        const reviewResult = `
Halo, berikut review untuk MR ini:

## Review Kode (Quick Mode)

**Ringkasan**: Perubahan ini bertujuan memperbaiki *bug* *filter* yang *reset* saat paginasi pada halaman riwayat APICAL. Perubahan inti melibatkan penyesuaian logika *filter* dan penanganan *error* dasar. Secara umum, kode bersih dan selaras dengan pola Nuxt.js yang ada, namun ada potensi *regresi* dan area minor untuk peningkatan *maintainability* dan *user experience*.

**Isu Kritis**:

1.  🔴 **Potensi Regresi: Logika filterVariabel yang Tidak Lengkap**
    **Masalah:** Perubahan pada kondisi filterVariabel di handlePaginationChange berpotensi menghilangkan *filter* lama yang masih relevan, menyebabkan *bug* *reset filter* muncul kembali untuk *filter-filter* tersebut. Ini adalah risiko *regresi* fungsionalitas yang tinggi.
    **Contoh perbaikan:**
    javascript
    // Before (bermasalah)
    const filterVariabel = (this.selectedMill || this.selectedUsersId || this.selectedStatus || this.dateRange.length > 0)

    // After (diperbaiki)
    // Pastikan semua state filter yang relevan tercakup.
    // Contoh: Jika selectedProductId dan selectedVendorId masih digunakan:
    const filterVariabel = (
        (this.selectedMill && this.selectedMill.length > 0) ||
        (this.selectedUsersId && this.selectedUsersId.length > 0) ||
        (this.selectedStatus && this.selectedStatus.length > 0) ||
        (this.dateRange && this.dateRange.length > 0) ||
        (this.selectedProductId && this.selectedProductId.length > 0) || // Tambahkan jika masih relevan
        (this.selectedVendorId && this.selectedVendorId.length > 0)     // Tambahkan jika masih relevan
        // ... tambahkan semua variabel filter lainnya yang mungkin ada
    );
    
    **Cara implementasi:** Verifikasi semua *state* *filter* yang ada di UI dan pastikan semuanya tercakup dalam kondisi filterVariabel yang baru.

2.  🔴 **Penanganan *Error* console.error yang Pasif**
    **Masalah:** Penggunaan console.error untuk *error* API tidak memberikan *feedback* visual kepada pengguna, yang dapat menyebabkan kebingungan jika *data fetching* gagal.
    **Contoh perbaikan:**
    javascript
    // Before (bermasalah)
    try {
      await this.$store.dispatch('shipment/getItemsV2', { /* ... */ });
    } catch (error) {
      console.error('Error applying filter:', error);
    }

    // After (diperbaiki)
    try {
      await this.$store.dispatch('shipment/getItemsV2', { /* ... */ });
    } catch (error) {
      console.error('Error applying filter:', error);
      // this.$toast.error('Gagal memuat data. Silakan coba lagi.'); // Contoh dengan plugin toast/snackbar
    }
    
    **Cara implementasi:** Tambahkan notifikasi *user-friendly* (misalnya *toast* atau *snackbar*) saat terjadi *error* pada *data fetching*.

3.  🔴 **Potensi Perilaku Tidak Terduga pada *Default Page***
    **Masalah:** Mengubah *default* page menjadi 1 di applyFilter akan selalu mereset paginasi ke halaman pertama jika page tidak diberikan secara eksplisit. Ini mungkin tidak diinginkan dalam semua skenario pemanggilan applyFilter.
    **Contoh perbaikan:**
    javascript
    // Before (bermasalah)
    async applyFilter ({
      page = 1,
      // ...
    })

    // After (diperbaiki)
    // Jika ada skenario di mana halaman saat ini harus dipertahankan:
    async applyFilter ({
      page = this.$route.query?.page_history ? parseInt(this.$route.query.page_history as string) : 1,
      // ...
    })
    
    **Cara implementasi:** Konfirmasi perilaku yang diinginkan untuk *default value* page dan sesuaikan agar konsisten dengan *user experience* yang diharapkan.

4.  🔴 **Duplikasi Logika Pengambilan filter dari $route.query**
    **Masalah:** Objek filter dibuat ulang di handlePaginationChange dengan mengambil dari $route.query. Jika *filter state* sudah dikelola di *state* komponen atau Vuex, ini bisa menjadi *redundant* dan berpotensi menyebabkan inkonsistensi.
    **Contoh perbaikan:**
    javascript
    // Before (bermasalah)
    const filter = {
      filterColumn: this.$route.query?.filter_column,
      filterType: this.$route.query?.filter_type
    } as any

    // After (diperbaiki)
    // Gunakan state filter yang sudah ada sebagai single source of truth:
    const filter = {
      filterColumn: this.currentFilter.column, // Asumsi ada currentFilter di data/computed
      filterType: this.currentFilter.type
    };
    
    **Cara implementasi:** Pastikan *state filter* dikelola secara terpusat dan digunakan sebagai *single source of truth*.

5.  🔴 **Penamaan Variabel Kurang Deskriptif**
    **Masalah:** Variabel filterVariabel kurang deskriptif dan dapat membingungkan.
    **Contoh perbaikan:**
    javascript
    // Before (bermasalah)
    const filterVariabel = (this.selectedMill || this.selectedUsersId || this.selectedStatus || this.dateRange.length > 0)

    // After (diperbaiki)
    const hasActiveFilters = (this.selectedMill || this.selectedUsersId || this.selectedStatus || this.dateRange.length > 0)
    
    **Cara implementasi:** Ganti nama variabel filterVariabel menjadi hasActiveFilters atau nama lain yang lebih jelas.
`;

        const hasCritical = (reviewService as any).hasCriticalIssues(reviewResult);
        expect(hasCritical).toBe(true);
      });
    });
  });

  describe('Domain-Specific Review Scope', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    describe('shouldUseDiffOnlyScope', () => {
      const mockSmallChanges = [
        {
          oldPath: 'src/components/Button.vue',
          newPath: 'src/components/Button.vue',
          oldContent: 'old content',
          newContent: 'new content',
          diffContent: '+  console.log("test");\n-  console.log("old");',
          language: 'vue'
        }
      ];

      const mockLargeChanges = Array.from({ length: 10 }, (_, i) => ({
        oldPath: `src/components/Component${i}.vue`,
        newPath: `src/components/Component${i}.vue`,
        oldContent: 'old content',
        newContent: 'new content',
        diffContent: Array.from({ length: 20 }, (_, j) => `+  line ${j}`).join('\n'),
        language: 'vue'
      }));

      test('should return true when REVIEW_DOMAIN_SCOPE is diff-only', () => {
        process.env.REVIEW_DOMAIN_SCOPE = 'diff-only';

        const result = (reviewService as any).shouldUseDiffOnlyScope(mockLargeChanges);
        expect(result).toBe(true);
      });

      test('should return false when REVIEW_DOMAIN_SCOPE is full-context', () => {
        process.env.REVIEW_DOMAIN_SCOPE = 'full-context';

        const result = (reviewService as any).shouldUseDiffOnlyScope(mockSmallChanges);
        expect(result).toBe(false);
      });

      test('should use diff-only for small changesets in auto mode', () => {
        process.env.REVIEW_DOMAIN_SCOPE = 'auto';

        const result = (reviewService as any).shouldUseDiffOnlyScope(mockSmallChanges);
        expect(result).toBe(true);
      });

      test('should use full-context for large changesets in auto mode', () => {
        process.env.REVIEW_DOMAIN_SCOPE = 'auto';

        const result = (reviewService as any).shouldUseDiffOnlyScope(mockLargeChanges);
        expect(result).toBe(false);
      });

      test('should default to false for unknown domain scope values', () => {
        process.env.REVIEW_DOMAIN_SCOPE = 'unknown';

        const result = (reviewService as any).shouldUseDiffOnlyScope(mockSmallChanges);
        expect(result).toBe(false);
      });
    });

    describe('getDomainScopeInstructions', () => {
      test('should return empty string when useDiffOnly is false', () => {
        const instructions = (reviewService as any).getDomainScopeInstructions(false);
        expect(instructions).toBe('');
      });

      test('should return diff-only instructions when useDiffOnly is true', () => {
        const instructions = (reviewService as any).getDomainScopeInstructions(true);

        expect(instructions).toContain('BATASAN DOMAIN REVIEW (DIFF-ONLY MODE AKTIF)');
        expect(instructions).toContain('HANYA analisis kode yang diubah dalam diff');
        expect(instructions).toContain('FOKUS pada perubahan spesifik');
        expect(instructions).toContain('HINDARI saran arsitektur umum');
        expect(instructions).toContain('JANGAN berikan rekomendasi refactoring');
        expect(instructions).toContain('baris kode yang ditambah (+) atau dimodifikasi');
      });
    });

    describe('System Prompt Integration with Domain Scope', () => {
      test('should include domain scope instructions in system prompt when diff-only is active', () => {
        process.env.REVIEW_DOMAIN_SCOPE = 'diff-only';

        const mockChanges = [
          {
            oldPath: 'test.js',
            newPath: 'test.js',
            oldContent: 'old',
            newContent: 'new',
            diffContent: '+  new line',
            language: 'javascript'
          }
        ];

        const systemPrompt = (reviewService as any).generateSystemPrompt(mockChanges);

        expect(systemPrompt).toContain('BATASAN DOMAIN REVIEW (DIFF-ONLY MODE AKTIF)');
        expect(systemPrompt).toContain('HANYA analisis kode yang diubah dalam diff');
      });

      test('should not include domain scope instructions when full-context is active', () => {
        process.env.REVIEW_DOMAIN_SCOPE = 'full-context';

        const mockChanges = [
          {
            oldPath: 'test.js',
            newPath: 'test.js',
            oldContent: 'old',
            newContent: 'new',
            diffContent: '+  new line',
            language: 'javascript'
          }
        ];

        const systemPrompt = (reviewService as any).generateSystemPrompt(mockChanges);

        expect(systemPrompt).not.toContain('BATASAN DOMAIN REVIEW');
      });
    });
  });

  describe('Critical Issue Threshold Configuration', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    describe('getCriticalIssueThresholdDefinition', () => {
      test('should return strict threshold definition', () => {
        process.env.CRITICAL_ISSUE_THRESHOLD = 'strict';

        const definition = (reviewService as any).getCriticalIssueThresholdDefinition();

        expect(definition).toContain('THRESHOLD: STRICT');
        expect(definition).toContain('Security Vulnerabilities');
        expect(definition).toContain('Data Loss/Corruption');
        expect(definition).toContain('System-Breaking Bugs');
        expect(definition).toContain('Memory/Resource Exhaustion');
        expect(definition).toContain('JANGAN tandai sebagai kritis');
        expect(definition).toContain('Code style violations');
        expect(definition).toContain('performance optimizations yang tidak menyebabkan ketidakstabilan sistem');
      });

      test('should return lenient threshold definition', () => {
        process.env.CRITICAL_ISSUE_THRESHOLD = 'lenient';

        const definition = (reviewService as any).getCriticalIssueThresholdDefinition();

        expect(definition).toContain('THRESHOLD: LENIENT');
        expect(definition).toContain('Critical Security Vulnerabilities');
        expect(definition).toContain('Complete System Failure');
        expect(definition).toContain('Permanent Data Loss');
        expect(definition).toContain('Deployment Blockers');
        expect(definition).toContain('JANGAN tandai sebagai kritis');
        expect(definition).toContain('Bug minor');
        expect(definition).toContain('logic errors yang tidak menyebabkan system failure');
      });

      test('should return standard threshold definition by default', () => {
        process.env.CRITICAL_ISSUE_THRESHOLD = 'standard';

        const definition = (reviewService as any).getCriticalIssueThresholdDefinition();

        expect(definition).toContain('THRESHOLD: STANDARD');
        expect(definition).toContain('Severe Security Issues');
        expect(definition).toContain('Application-Breaking Bugs');
        expect(definition).toContain('Data Corruption/Loss');
        expect(definition).toContain('Critical System Instability');
        expect(definition).toContain('Major Breaking Changes');
        expect(definition).toContain('Gunakan 🟡 untuk');
        expect(definition).toContain('Gunakan 🔵 untuk');
      });

      test('should default to standard for unknown threshold values', () => {
        process.env.CRITICAL_ISSUE_THRESHOLD = 'unknown';

        const definition = (reviewService as any).getCriticalIssueThresholdDefinition();

        expect(definition).toContain('THRESHOLD: STANDARD');
      });
    });

    describe('validateCriticalIssueByThreshold', () => {
      test('should validate strict threshold correctly', () => {
        process.env.CRITICAL_ISSUE_THRESHOLD = 'strict';

        // Should pass strict validation
        expect((reviewService as any).validateCriticalIssueByThreshold('SQL injection vulnerability found')).toBe(true);
        expect((reviewService as any).validateCriticalIssueByThreshold('Security vulnerability with data breach risk')).toBe(true);
        expect((reviewService as any).validateCriticalIssueByThreshold('Application crash secara total')).toBe(true);
        expect((reviewService as any).validateCriticalIssueByThreshold('Data corruption and loss')).toBe(true);
        expect((reviewService as any).validateCriticalIssueByThreshold('Memory leak causing system crash')).toBe(true);
        expect((reviewService as any).validateCriticalIssueByThreshold('Authentication bypass vulnerability')).toBe(true);

        // Should fail strict validation
        expect((reviewService as any).validateCriticalIssueByThreshold('Code style issue')).toBe(false);
        expect((reviewService as any).validateCriticalIssueByThreshold('Minor performance optimization')).toBe(false);
        expect((reviewService as any).validateCriticalIssueByThreshold('Documentation missing')).toBe(false);
        expect((reviewService as any).validateCriticalIssueByThreshold('Logic error without crash')).toBe(false);
        expect((reviewService as any).validateCriticalIssueByThreshold('Input validation issue')).toBe(false);
      });

      test('should validate lenient threshold correctly', () => {
        process.env.CRITICAL_ISSUE_THRESHOLD = 'lenient';

        // Should pass lenient validation
        expect((reviewService as any).validateCriticalIssueByThreshold('Deployment blocker preventing release')).toBe(true);
        expect((reviewService as any).validateCriticalIssueByThreshold('Critical security vulnerability with breach')).toBe(true);
        expect((reviewService as any).validateCriticalIssueByThreshold('Complete system failure detected')).toBe(true);
        expect((reviewService as any).validateCriticalIssueByThreshold('Permanent data loss risk')).toBe(true);
        expect((reviewService as any).validateCriticalIssueByThreshold('Tidak dapat berfungsi sama sekali')).toBe(true);

        // Should fail lenient validation
        expect((reviewService as any).validateCriticalIssueByThreshold('Minor bug found')).toBe(false);
        expect((reviewService as any).validateCriticalIssueByThreshold('Performance issue')).toBe(false);
        expect((reviewService as any).validateCriticalIssueByThreshold('Code quality concern')).toBe(false);
        expect((reviewService as any).validateCriticalIssueByThreshold('Regular security issue')).toBe(false);
        expect((reviewService as any).validateCriticalIssueByThreshold('Logic error without system failure')).toBe(false);
      });

      test('should validate standard threshold correctly (more restrictive)', () => {
        process.env.CRITICAL_ISSUE_THRESHOLD = 'standard';

        // Should pass standard validation
        expect((reviewService as any).validateCriticalIssueByThreshold('Security vulnerability with breach')).toBe(true);
        expect((reviewService as any).validateCriticalIssueByThreshold('Application crash detected')).toBe(true);
        expect((reviewService as any).validateCriticalIssueByThreshold('Data corruption risk')).toBe(true);
        expect((reviewService as any).validateCriticalIssueByThreshold('Memory leak causing instability')).toBe(true);
        expect((reviewService as any).validateCriticalIssueByThreshold('Major breaking change')).toBe(true);

        // Should fail standard validation (now more restrictive)
        expect((reviewService as any).validateCriticalIssueByThreshold('Code style problem')).toBe(false);
        expect((reviewService as any).validateCriticalIssueByThreshold('Minor logic error')).toBe(false);
        expect((reviewService as any).validateCriticalIssueByThreshold('Performance optimization needed')).toBe(false);
        expect((reviewService as any).validateCriticalIssueByThreshold('Input validation missing')).toBe(false);
      });
    });

    describe('Enhanced Critical Issue Detection with Threshold', () => {
      test('should respect strict threshold in emoji detection', () => {
        process.env.CRITICAL_ISSUE_THRESHOLD = 'strict';

        const reviewWithSecurityIssue = `
        🔴 SQL injection vulnerability in user input
        `;

        const reviewWithStyleIssue = `
        🔴 Code style inconsistency found
        `;

        expect((reviewService as any).detectCriticalIssuesByEmoji(reviewWithSecurityIssue)).toBe(true);
        expect((reviewService as any).detectCriticalIssuesByEmoji(reviewWithStyleIssue)).toBe(false);
      });

      test('should respect lenient threshold in emoji detection', () => {
        process.env.CRITICAL_ISSUE_THRESHOLD = 'lenient';

        const reviewWithDeploymentBlocker = `
        🔴 Deployment will fail due to missing dependency
        `;

        const reviewWithMinorBug = `
        🔴 Minor bug in UI component
        `;

        expect((reviewService as any).detectCriticalIssuesByEmoji(reviewWithDeploymentBlocker)).toBe(true);
        expect((reviewService as any).detectCriticalIssuesByEmoji(reviewWithMinorBug)).toBe(false);
      });

      test('should filter out non-critical issues under strict threshold', () => {
        process.env.CRITICAL_ISSUE_THRESHOLD = 'strict';

        const reviewWithStyleIssue = `
        🔴 Code formatting issue detected
        `;

        const reviewWithSecurityIssue = `
        🔴 SQL injection vulnerability found
        `;

        // Style issue should be filtered out under strict threshold
        expect((reviewService as any).detectCriticalIssuesByEmoji(reviewWithStyleIssue)).toBe(false);

        // Security issue should pass under strict threshold
        expect((reviewService as any).detectCriticalIssuesByEmoji(reviewWithSecurityIssue)).toBe(true);
      });
    });

    describe('System Prompt Integration with Threshold', () => {
      test('should include threshold definition in system prompt', () => {
        process.env.CRITICAL_ISSUE_THRESHOLD = 'strict';

        const systemPrompt = (reviewService as any).generateSystemPrompt();

        expect(systemPrompt).toContain('THRESHOLD: STRICT');
        expect(systemPrompt).toContain('HANYA TANDAI SEBAGAI 🔴 JIKA');
      });

      test('should include threshold definition in sequential thinking prompt', () => {
        process.env.CRITICAL_ISSUE_THRESHOLD = 'lenient';

        const sequentialPrompt = (reviewService as any).generateSequentialThinkingSystemPrompt();

        expect(sequentialPrompt).toContain('THRESHOLD: LENIENT');
        expect(sequentialPrompt).toContain('HANYA TANDAI SEBAGAI 🔴 JIKA');
      });
    });
  });
});
