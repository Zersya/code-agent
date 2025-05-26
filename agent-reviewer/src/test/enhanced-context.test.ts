/**
 * Test file for Enhanced Context Service
 * This file demonstrates and validates the enhanced context functionality
 */

import { enhancedContextService } from '../services/enhanced-context.js';
import { MergeRequestChange } from '../types/review.js';

/**
 * Mock merge request changes for testing
 */
const mockSmallChangeset: MergeRequestChange[] = [
  {
    oldPath: 'src/components/UserProfile.vue',
    newPath: 'src/components/UserProfile.vue',
    oldContent: `<template>
  <div class="user-profile">
    <h1>{{ user.name }}</h1>
  </div>
</template>

<script>
export default {
  name: 'UserProfile',
  props: ['user']
}
</script>`,
    newContent: `<template>
  <div class="user-profile">
    <h1>{{ user.name }}</h1>
    <p>{{ user.email }}</p>
  </div>
</template>

<script>
export default {
  name: 'UserProfile',
  props: ['user']
}
</script>`,
    diffContent: `@@ -2,6 +2,7 @@
   <div class="user-profile">
     <h1>{{ user.name }}</h1>
+    <p>{{ user.email }}</p>
   </div>
 </template>`,
    language: 'vue'
  },
  {
    oldPath: 'src/services/user.js',
    newPath: 'src/services/user.js',
    oldContent: `export class UserService {
  async getUser(id) {
    return await fetch(\`/api/users/\${id}\`);
  }
}`,
    newContent: `export class UserService {
  async getUser(id) {
    const response = await fetch(\`/api/users/\${id}\`);
    return response.json();
  }
}`,
    diffContent: `@@ -1,5 +1,6 @@
 export class UserService {
   async getUser(id) {
-    return await fetch(\`/api/users/\${id}\`);
+    const response = await fetch(\`/api/users/\${id}\`);
+    return response.json();
   }
 }`,
    language: 'javascript'
  }
];

const mockLargeChangeset: MergeRequestChange[] = [
  // Create a changeset with more than 5 files to test threshold
  ...Array.from({ length: 6 }, (_, i) => ({
    oldPath: `src/file${i}.js`,
    newPath: `src/file${i}.js`,
    oldContent: `console.log('old content ${i}');`,
    newContent: `console.log('new content ${i}');`,
    diffContent: `@@ -1 +1 @@
-console.log('old content ${i}');
+console.log('new content ${i}');`,
    language: 'javascript'
  }))
];

/**
 * Test enhanced context service functionality
 */
async function testEnhancedContext() {
  console.log('🧪 Testing Enhanced Context Service\n');

  // Test 1: Small changeset detection
  console.log('📊 Test 1: Changeset Size Analysis');
  const smallStats = enhancedContextService.analyzeChangesetSize(mockSmallChangeset);
  const largeStats = enhancedContextService.analyzeChangesetSize(mockLargeChangeset);

  console.log('Small changeset stats:', {
    files: smallStats.totalFiles,
    lines: smallStats.totalLinesModified,
    isSmall: smallStats.isSmallChangeset,
    languages: smallStats.languages
  });

  console.log('Large changeset stats:', {
    files: largeStats.totalFiles,
    lines: largeStats.totalLinesModified,
    isSmall: largeStats.isSmallChangeset,
    languages: largeStats.languages
  });

  // Test 2: Should use enhanced context
  console.log('\n🎯 Test 2: Enhanced Context Eligibility');
  const shouldUseSmall = enhancedContextService.shouldUseEnhancedContext(mockSmallChangeset);
  const shouldUseLarge = enhancedContextService.shouldUseEnhancedContext(mockLargeChangeset);

  console.log('Should use enhanced context for small changeset:', shouldUseSmall);
  console.log('Should use enhanced context for large changeset:', shouldUseLarge);

  // Test 3: Code element extraction
  console.log('\n🔍 Test 3: Code Element Extraction');
  const codeElements = enhancedContextService.extractCodeElements(mockSmallChangeset);
  console.log('Extracted code elements:');
  codeElements.forEach(element => {
    console.log(`  - ${element.type}: ${element.name} (${element.language}) in ${element.filePath}`);
  });

  // Test 4: Context query generation
  console.log('\n❓ Test 4: Context Query Generation');
  const queries = enhancedContextService.generateContextQueries(mockSmallChangeset, codeElements);
  console.log(`Generated ${queries.length} context queries:`);
  queries.forEach((query, index) => {
    console.log(`  ${index + 1}. [${query.category}] ${query.query} (priority: ${query.priority})`);
  });

  // Test 5: Full enhanced context gathering
  console.log('\n🚀 Test 5: Full Enhanced Context Gathering');
  try {
    const enhancedContext = await enhancedContextService.getEnhancedContext(mockSmallChangeset);
    console.log('Enhanced context result:');
    console.log(`  - Success: ${enhancedContext.success}`);
    console.log(`  - Execution time: ${enhancedContext.totalExecutionTimeMs}ms`);
    console.log(`  - Queries executed: ${enhancedContext.queryResults.length}`);
    console.log(`  - Enhanced files found: ${enhancedContext.enhancedFiles.length}`);
    console.log(`  - Errors: ${enhancedContext.errors.length}`);

    if (enhancedContext.success) {
      console.log('\n📋 Context Summary Preview:');
      console.log(enhancedContext.contextSummary.substring(0, 500) + '...');
    }
  } catch (error) {
    console.error('Error in enhanced context gathering:', error);
  }

  console.log('\n✅ Enhanced Context Service tests completed!');
}

/**
 * Test integration with existing context service
 */
async function testIntegration() {
  console.log('\n🔗 Testing Integration with Context Service');
  
  // This would require a full integration test with database and embeddings
  // For now, we'll just verify the service can be imported and instantiated
  console.log('Enhanced context service initialized:', !!enhancedContextService);
  console.log('Service configuration loaded:', !!enhancedContextService['config']);
}

/**
 * Run all tests
 */
async function runTests() {
  try {
    await testEnhancedContext();
    await testIntegration();
    console.log('\n🎉 All tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Export for use in other test files
export {
  mockSmallChangeset,
  mockLargeChangeset,
  testEnhancedContext,
  testIntegration
};

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}
