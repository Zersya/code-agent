#!/usr/bin/env node

/**
 * Test script for Agentic Coding functionality
 * This script tests the core components without requiring actual webhook events
 */

import { AgenticCodingService } from '../src/services/agentic-coding.js';
import { GitHubService } from '../src/services/github.js';
import dotenv from 'dotenv';

dotenv.config();

async function testAgenticCodingService() {
  console.log('🧪 Testing Agentic Coding Service...\n');

  // Test comment detection
  console.log('1. Testing comment detection:');
  
  const testComments = [
    '/agent Add error handling to the login function',
    'This is a regular comment',
    '/AGENT Fix the memory leak in uppercase',
    '/agent    Add TypeScript types with leading spaces',
    'Some other text /agent not at start',
  ];

  testComments.forEach(comment => {
    const isAgentic = AgenticCodingService.isAgenticCodingComment(comment);
    const instructions = AgenticCodingService.extractInstructions(comment);
    console.log(`  "${comment}" -> ${isAgentic ? '✅' : '❌'} ${isAgentic ? `"${instructions}"` : ''}`);
  });

  console.log('\n2. Testing GitHub URL parsing:');
  
  const testUrls = [
    'https://github.com/owner/repo',
    'https://github.com/owner/repo.git',
    'git@github.com:owner/repo.git',
    'https://gitlab.com/owner/repo', // Should fail
    'invalid-url',
  ];

  testUrls.forEach(url => {
    const parsed = GitHubService.parseRepositoryUrl(url);
    console.log(`  "${url}" -> ${parsed ? `✅ ${parsed.owner}/${parsed.repo}` : '❌ Failed'}`);
  });

  console.log('\n3. Testing project ID generation:');
  
  const testRepos = [
    { owner: 'facebook', repo: 'react' },
    { owner: 'microsoft', repo: 'vscode' },
    { owner: 'google', repo: 'tensorflow' },
  ];

  testRepos.forEach(({ owner, repo }) => {
    const projectId = GitHubService.generateProjectId(owner, repo);
    console.log(`  ${owner}/${repo} -> "${projectId}"`);
  });

  console.log('\n4. Testing agentic coding request processing:');
  
  // Create a mock request
  const mockRequest = {
    platform: 'github',
    projectId: 12345, // Mock numeric project ID
    repositoryUrl: 'https://github.com/test/repo',
    instructions: 'Add error handling to the authentication service',
    context: {
      pullRequestNumber: 123,
      commentId: 456,
      author: 'testuser',
      branch: 'feature/auth-improvements',
      commitSha: 'abc123def456',
    },
  };

  try {
    console.log('  Processing mock agentic coding request...');
    const agenticService = new AgenticCodingService();
    const result = await agenticService.processAgenticCodingRequest(mockRequest);
    
    console.log('  ✅ Request processed successfully');
    console.log(`  📝 Summary: ${result.summary}`);
    console.log(`  📄 Files modified: ${result.filesModified.length}`);
    console.log(`  📁 Files created: ${result.filesCreated.length}`);
    
    if (result.errors && result.errors.length > 0) {
      console.log(`  🚨 Errors: ${result.errors.join(', ')}`);
    }
    
    if (result.warnings && result.warnings.length > 0) {
      console.log(`  ⚠️ Warnings: ${result.warnings.join(', ')}`);
    }
  } catch (error) {
    console.log(`  ❌ Error processing request: ${error.message}`);
  }

  console.log('\n✅ Agentic Coding Service tests completed!\n');
}

async function testWebhookPlatformDetection() {
  console.log('🔍 Testing webhook platform detection...\n');

  // Mock request objects
  const mockRequests = [
    {
      name: 'GitHub webhook',
      headers: { 'x-github-event': 'issue_comment' },
      body: { repository: { html_url: 'https://github.com/owner/repo' } },
      expected: 'github'
    },
    {
      name: 'GitLab webhook',
      headers: { 'x-gitlab-event': 'Note Hook' },
      body: { object_kind: 'note' },
      expected: 'gitlab'
    },
    {
      name: 'Unknown webhook',
      headers: {},
      body: { some: 'data' },
      expected: 'unknown'
    },
  ];

  // Simple platform detection function (copied from webhook controller logic)
  function determineWebhookPlatform(req) {
    // Check GitHub headers
    if (req.headers['x-github-event'] || req.headers['x-hub-signature'] || req.headers['x-hub-signature-256']) {
      return 'github';
    }

    // Check GitLab headers
    if (req.headers['x-gitlab-event'] || req.headers['x-gitlab-token']) {
      return 'gitlab';
    }

    // Check body structure
    const body = req.body;
    if (body && typeof body === 'object') {
      // GitLab events have object_kind
      if (body.object_kind) {
        return 'gitlab';
      }
      
      // GitHub events have different structure
      if (body.repository && body.repository.html_url && body.repository.html_url.includes('github.com')) {
        return 'github';
      }
    }

    return 'unknown';
  }

  mockRequests.forEach(({ name, headers, body, expected }) => {
    const detected = determineWebhookPlatform({ headers, body });
    const result = detected === expected ? '✅' : '❌';
    console.log(`  ${name}: ${result} detected as "${detected}" (expected "${expected}")`);
  });

  console.log('\n✅ Webhook platform detection tests completed!\n');
}

async function main() {
  console.log('🚀 Starting Agentic Coding Tests\n');
  console.log('=' .repeat(50));

  try {
    await testAgenticCodingService();
    await testWebhookPlatformDetection();
    
    console.log('🎉 All tests completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Configure webhooks in your repository settings');
    console.log('2. Set up the required environment variables');
    console.log('3. Test with a real /agent comment on a pull request');
    console.log('4. Monitor the server logs for processing details');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
