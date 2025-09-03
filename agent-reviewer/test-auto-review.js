#!/usr/bin/env node

/**
 * Test script to verify auto review toggle functionality
 * This script tests the database operations and API endpoints for the auto review feature
 */

import { dbService } from '../src/services/database.js';

async function testAutoReviewFunctionality() {
  console.log('🧪 Testing Auto Review Toggle Functionality\n');

  try {
    // Test 1: Create a test project
    console.log('1. Creating test project...');
    const testProject = {
      projectId: 99999,
      name: 'Test Auto Review Project',
      description: 'Test project for auto review functionality',
      url: 'https://gitlab.com/test/auto-review-project',
      defaultBranch: 'main',
      lastProcessedCommit: 'abc123',
      lastProcessedAt: new Date(),
      autoReviewEnabled: true
    };

    await dbService.updateProjectMetadata(testProject);
    console.log('✅ Test project created successfully');

    // Test 2: Check if auto review is enabled (should be true)
    console.log('\n2. Checking initial auto review status...');
    let isEnabled = await dbService.isAutoReviewEnabled(testProject.projectId);
    console.log(`Expected: true, Actual: ${isEnabled}`);
    if (isEnabled !== true) {
      throw new Error('Initial auto review status should be true');
    }
    console.log('✅ Initial auto review status is correct');

    // Test 3: Disable auto review
    console.log('\n3. Disabling auto review...');
    await dbService.updateAutoReviewEnabled(testProject.projectId, false);
    isEnabled = await dbService.isAutoReviewEnabled(testProject.projectId);
    console.log(`Expected: false, Actual: ${isEnabled}`);
    if (isEnabled !== false) {
      throw new Error('Auto review should be disabled');
    }
    console.log('✅ Auto review disabled successfully');

    // Test 4: Re-enable auto review
    console.log('\n4. Re-enabling auto review...');
    await dbService.updateAutoReviewEnabled(testProject.projectId, true);
    isEnabled = await dbService.isAutoReviewEnabled(testProject.projectId);
    console.log(`Expected: true, Actual: ${isEnabled}`);
    if (isEnabled !== true) {
      throw new Error('Auto review should be enabled');
    }
    console.log('✅ Auto review re-enabled successfully');

    // Test 5: Check default behavior for non-existent project
    console.log('\n5. Checking default behavior for non-existent project...');
    const defaultEnabled = await dbService.isAutoReviewEnabled(99998);
    console.log(`Expected: true (default), Actual: ${defaultEnabled}`);
    if (defaultEnabled !== true) {
      throw new Error('Default auto review status should be true');
    }
    console.log('✅ Default behavior works correctly');

    // Test 6: Get project metadata
    console.log('\n6. Getting project metadata...');
    const metadata = await dbService.getProjectMetadata(testProject.projectId);
    if (!metadata) {
      throw new Error('Project metadata should exist');
    }
    console.log(`Project name: ${metadata.name}`);
    console.log(`Auto review enabled: ${metadata.autoReviewEnabled}`);
    if (metadata.autoReviewEnabled !== true) {
      throw new Error('Project metadata should have autoReviewEnabled set to true');
    }
    console.log('✅ Project metadata retrieved successfully');

    // Test 7: Get all projects
    console.log('\n7. Getting all projects...');
    const allProjects = await dbService.getAllProjects();
    const foundProject = allProjects.find(p => p.projectId === testProject.projectId);
    if (!foundProject) {
      throw new Error('Test project should be in the list of all projects');
    }
    console.log(`Found project: ${foundProject.name}`);
    console.log(`Auto review enabled: ${foundProject.autoReviewEnabled}`);
    if (foundProject.autoReviewEnabled !== true) {
      throw new Error('Project in all projects list should have autoReviewEnabled set to true');
    }
    console.log('✅ All projects retrieved successfully');

    // Clean up
    console.log('\n8. Cleaning up test data...');
    try {
      // Note: In a real scenario, you might want to delete the test project
      // For now, we'll just update it to disabled to avoid interfering with other tests
      await dbService.updateAutoReviewEnabled(testProject.projectId, false);
      console.log('✅ Test data cleaned up');
    } catch (cleanupError) {
      console.log('⚠️  Cleanup failed, but tests passed:', cleanupError.message);
    }

    console.log('\n🎉 All tests passed! Auto review toggle functionality is working correctly.');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the tests
testAutoReviewFunctionality()
  .then(() => {
    console.log('\n🏁 Test script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test script crashed:', error);
    process.exit(1);
  });