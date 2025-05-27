// Test file for Notion integration functionality
import { describe, test, expect } from 'bun:test';
import { notionService } from '../services/notion.js';

describe('Notion Integration Service', () => {
  describe('extractNotionUrls', () => {
    // Test cases for different merge request descriptions
    const testCases = [
    {
      name: 'Related Links section with Notion URL',
      description: `
## Description
This MR implements the user authentication feature.

## Related Links:
- Notion Task: https://www.notion.so/transtrack/User-Authentication-Implementation-abc123def456
- Design: https://figma.com/design/123

## Changes
- Added login component
- Implemented JWT authentication
      `,
      expectedUrls: 1
    },
    {
      name: 'Multiple Notion URLs in description',
      description: `
## Task Details
Main task: https://notion.so/workspace/main-task-123456789012345678901234567890ab
Sub-task: https://www.notion.so/workspace/sub-task-fedcba0987654321fedcba0987654321

## Implementation
Following the requirements from both tasks above.
      `,
      expectedUrls: 2
    },
    {
      name: 'Custom domain Notion URL',
      description: `
## Reference
Task details: https://transtrack.notion.site/Feature-Implementation-abcdef123456789012345678901234567890

## Notes
Please review according to the task requirements.
      `,
      expectedUrls: 1
    },
    {
      name: 'No Notion URLs',
      description: `
## Description
This is a simple bug fix for the login form.

## Changes
- Fixed validation error
- Updated error messages
      `,
      expectedUrls: 0
    },
    {
      name: 'Direct page ID format',
      description: `
## Task
Notion page: https://www.notion.so/abc123def456789012345678901234567890

## Implementation details
Following the specifications in the Notion page above.
      `,
      expectedUrls: 1
    },
    {
      name: 'Long page ID format (real example)',
      description: `
## Task
Stock Card FE Improvement: https://www.notion.so/transtrack/Stock-Card-FE-Improvement-Stock-Control-Per-Warehouse-1edccba5c5ad80b6b6e6ff914bcbbb2a

## Implementation details
Following the acceptance criteria in the Notion page.
      `,
      expectedUrls: 1
    }
  ];

    testCases.forEach((testCase) => {
      test(`should extract URLs correctly: ${testCase.name}`, () => {
        const result = notionService.extractNotionUrls(testCase.description);

        expect(result.urls).toHaveLength(testCase.expectedUrls);
        expect(result.totalFound).toBe(testCase.expectedUrls);

        if (testCase.expectedUrls > 0) {
          expect(result.urls[0]).toMatch(/https:\/\/.*notion\.(so|site)/);
        }
      });
    });

    test('should handle empty description', () => {
      const result = notionService.extractNotionUrls('');
      expect(result.urls).toHaveLength(0);
      expect(result.totalFound).toBe(0);
    });

    test('should handle null/undefined description', () => {
      const result1 = notionService.extractNotionUrls(null as any);
      const result2 = notionService.extractNotionUrls(undefined as any);

      expect(result1.urls).toHaveLength(0);
      expect(result2.urls).toHaveLength(0);
    });
  });

  describe('fetchTaskContext', () => {
    test('should handle API errors gracefully', async () => {
      // Test when Notion integration is disabled
      const originalEnabled = process.env.ENABLE_NOTION_INTEGRATION;
      process.env.ENABLE_NOTION_INTEGRATION = 'false';

      try {
        await notionService.fetchTaskContext('https://notion.so/test-page');
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect((error as Error).message).toContain('Notion integration is disabled');
      }

      // Restore original value
      process.env.ENABLE_NOTION_INTEGRATION = originalEnabled;
    });

    test('should handle invalid URLs', async () => {
      // Enable Notion integration for this test
      const originalEnabled = process.env.ENABLE_NOTION_INTEGRATION;
      process.env.ENABLE_NOTION_INTEGRATION = 'true';

      try {
        await notionService.fetchTaskContext('invalid-url');
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect((error as Error).message).toBeDefined();
      }

      // Restore original value
      process.env.ENABLE_NOTION_INTEGRATION = originalEnabled;
    });

    test('should extract page ID from various URL formats', () => {
      const testUrls = [
        'https://www.notion.so/workspace/Page-Title-abc123def456789012345678901234567890',
        'https://notion.so/abc123def456789012345678901234567890',
        'https://custom.notion.site/Page-Title-abc123def456789012345678901234567890'
      ];

      testUrls.forEach(url => {
        const pageId = (notionService as any).extractPageIdFromUrl(url);
        expect(pageId).toBeTruthy();
        expect(pageId).toHaveLength(32);
      });
    });
  });

  describe('fetchMultipleTaskContexts', () => {
    test('should handle empty URL array', async () => {
      const result = await notionService.fetchMultipleTaskContexts([]);

      expect(result.contexts).toHaveLength(0);
      expect(result.totalPages).toBe(0);
      expect(result.successfulFetches).toBe(0);
    });

    test('should handle mixed success and failure scenarios', async () => {
      // Test with Notion integration disabled (default behavior)
      const urls = [
        'https://notion.so/valid-page-123',
        'invalid-url',
        'https://notion.so/another-valid-page-456'
      ];

      const result = await notionService.fetchMultipleTaskContexts(urls);

      // When Notion integration is disabled, totalPages should be 0
      expect(result.totalPages).toBe(0);
      expect(result.successfulFetches).toBe(0);
      expect(result.contexts).toHaveLength(0);
      expect(result.summary).toContain('disabled');
    });
  });

});

// Export test functions for backward compatibility
export function testNotionUrlExtraction() {
  // This function is now replaced by Jest tests
  return true;
}

export function testNotionContextFormatting() {
  // This function is now replaced by Jest tests
  return Promise.resolve(true);
}

export function runTests() {
  // This function is now replaced by Jest test runner
  return Promise.resolve(true);
}
