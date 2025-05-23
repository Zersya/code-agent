// Test file for Notion integration functionality
import { notionService } from '../services/notion.js';

/**
 * Test Notion URL extraction functionality
 */
function testNotionUrlExtraction() {
  console.log('Testing Notion URL extraction...');

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

  let passedTests = 0;
  let totalTests = testCases.length;

  testCases.forEach((testCase, index) => {
    console.log(`\nTest ${index + 1}: ${testCase.name}`);

    try {
      const result = notionService.extractNotionUrls(testCase.description);

      console.log(`  Found ${result.urls.length} URLs: ${result.urls.join(', ')}`);
      console.log(`  Extracted from: ${result.extractedFromSection || 'entire description'}`);

      if (result.urls.length === testCase.expectedUrls) {
        console.log(`  ✅ PASS - Expected ${testCase.expectedUrls}, got ${result.urls.length}`);
        passedTests++;
      } else {
        console.log(`  ❌ FAIL - Expected ${testCase.expectedUrls}, got ${result.urls.length}`);
      }
    } catch (error) {
      console.log(`  ❌ ERROR - ${error}`);
    }
  });

  console.log(`\n📊 Test Results: ${passedTests}/${totalTests} tests passed`);
  return passedTests === totalTests;
}

/**
 * Test Notion context formatting
 */
async function testNotionContextFormatting() {
  console.log('\nTesting Notion context formatting...');

  const mockNotionContext = {
    contexts: [
      {
        pageId: 'abc123',
        title: 'User Authentication Feature',
        description: 'Implement user login and registration functionality with JWT tokens',
        requirements: [
          'User must be able to login with email and password',
          'System must generate JWT tokens for authenticated users',
          'Password must be hashed using bcrypt'
        ],
        acceptanceCriteria: [
          'Login form validates email format',
          'Invalid credentials show appropriate error message',
          'Successful login redirects to dashboard'
        ],
        technicalSpecs: 'Use JWT with 24-hour expiration. Store tokens in httpOnly cookies.',
        relatedContext: 'This feature is part of the user management system.',
        url: 'https://www.notion.so/transtrack/User-Auth-abc123',
        lastModified: new Date()
      }
    ],
    totalPages: 1,
    successfulFetches: 1,
    errors: [],
    summary: 'Found 1 task(s): User Authentication Feature. Total requirements: 3, acceptance criteria: 3'
  };

  try {
    // Access the private method through type assertion for testing
    const reviewService = (await import('../services/review.js')).reviewService;
    const formatted = (reviewService as any).formatNotionContext(mockNotionContext);

    console.log('Formatted Notion context:');
    console.log(formatted);

    // Check if formatting includes key elements
    const hasTitle = formatted.includes('User Authentication Feature');
    const hasRequirements = formatted.includes('Requirements:');
    const hasCriteria = formatted.includes('Acceptance Criteria:');
    const hasUrl = formatted.includes('https://www.notion.so/transtrack/User-Auth-abc123');

    if (hasTitle && hasRequirements && hasCriteria && hasUrl) {
      console.log('✅ PASS - Formatting includes all expected elements');
      return true;
    } else {
      console.log('❌ FAIL - Missing expected elements in formatting');
      return false;
    }
  } catch (error) {
    console.log(`❌ ERROR - ${error}`);
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('🧪 Running Notion Integration Tests\n');

  const urlExtractionPassed = testNotionUrlExtraction();
  const contextFormattingPassed = await testNotionContextFormatting();

  const allTestsPassed = urlExtractionPassed && contextFormattingPassed;

  console.log('\n' + '='.repeat(50));
  if (allTestsPassed) {
    console.log('🎉 All tests passed! Notion integration is working correctly.');
  } else {
    console.log('❌ Some tests failed. Please check the implementation.');
  }
  console.log('='.repeat(50));

  return allTestsPassed;
}

// Export for use in other test files
export { testNotionUrlExtraction, testNotionContextFormatting, runTests };

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}
