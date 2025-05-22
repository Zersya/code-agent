/**
 * Simple test script to verify merge completion re-embedding functionality
 * This simulates a GitLab merge completion webhook event
 */

import { processWebhook } from './dist/controllers/webhook.js';

// Mock request and response objects
const mockReq = {
  body: {
    object_kind: 'merge_request',
    event_type: 'merge_request',
    user: {
      id: 1,
      name: 'Test User',
      username: 'testuser',
      avatar_url: '',
      email: 'test@example.com'
    },
    project: {
      id: 12345,
      name: 'test-project',
      description: 'Test project for merge completion',
      web_url: 'https://gitlab.example.com/test/test-project',
      avatar_url: '',
      git_ssh_url: 'git@gitlab.example.com:test/test-project.git',
      git_http_url: 'https://gitlab.example.com/test/test-project.git',
      namespace: 'test',
      visibility_level: 0,
      path_with_namespace: 'test/test-project',
      default_branch: 'main',
      homepage: 'https://gitlab.example.com/test/test-project',
      url: 'https://gitlab.example.com/test/test-project.git',
      ssh_url: 'git@gitlab.example.com:test/test-project.git',
      http_url: 'https://gitlab.example.com/test/test-project.git'
    },
    repository: {
      name: 'test-project',
      url: 'https://gitlab.example.com/test/test-project.git',
      description: 'Test project for merge completion',
      homepage: 'https://gitlab.example.com/test/test-project',
      git_http_url: 'https://gitlab.example.com/test/test-project.git',
      git_ssh_url: 'git@gitlab.example.com:test/test-project.git',
      visibility_level: 0
    },
    object_attributes: {
      id: 1,
      iid: 1,
      target_branch: 'main',
      source_branch: 'feature/test-feature',
      source_project_id: 12345,
      target_project_id: 12345,
      state: 'merged',
      merge_status: 'merged',
      title: 'Test merge request',
      description: 'This is a test merge request for re-embedding functionality',
      url: 'https://gitlab.example.com/test/test-project/-/merge_requests/1',
      source: {
        id: 12345,
        name: 'test-project',
        description: 'Test project for merge completion',
        web_url: 'https://gitlab.example.com/test/test-project',
        avatar_url: '',
        git_ssh_url: 'git@gitlab.example.com:test/test-project.git',
        git_http_url: 'https://gitlab.example.com/test/test-project.git',
        namespace: 'test',
        visibility_level: 0,
        path_with_namespace: 'test/test-project',
        default_branch: 'main',
        homepage: 'https://gitlab.example.com/test/test-project',
        url: 'https://gitlab.example.com/test/test-project.git',
        ssh_url: 'git@gitlab.example.com:test/test-project.git',
        http_url: 'https://gitlab.example.com/test/test-project.git'
      },
      target: {
        id: 12345,
        name: 'test-project',
        description: 'Test project for merge completion',
        web_url: 'https://gitlab.example.com/test/test-project',
        avatar_url: '',
        git_ssh_url: 'git@gitlab.example.com:test/test-project.git',
        git_http_url: 'https://gitlab.example.com/test/test-project.git',
        namespace: 'test',
        visibility_level: 0,
        path_with_namespace: 'test/test-project',
        default_branch: 'main',
        homepage: 'https://gitlab.example.com/test/test-project',
        url: 'https://gitlab.example.com/test/test-project.git',
        ssh_url: 'git@gitlab.example.com:test/test-project.git',
        http_url: 'https://gitlab.example.com/test/test-project.git'
      },
      last_commit: {
        id: 'abc123def456',
        message: 'Add new feature',
        timestamp: new Date().toISOString(),
        url: 'https://gitlab.example.com/test/test-project/-/commit/abc123def456',
        author: {
          name: 'Test User',
          email: 'test@example.com'
        }
      },
      work_in_progress: false,
      assignee: {
        id: 1,
        name: 'Test User',
        username: 'testuser',
        avatar_url: '',
        email: 'test@example.com'
      },
      assignees: [{
        id: 1,
        name: 'Test User',
        username: 'testuser',
        avatar_url: '',
        email: 'test@example.com'
      }],
      author: {
        id: 1,
        name: 'Test User',
        username: 'testuser',
        avatar_url: '',
        email: 'test@example.com'
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      action: 'merge'
    },
    changes: {},
    labels: []
  },
  headers: {},
  query: {}
};

const mockRes = {
  status: (code) => ({
    json: (data) => {
      console.log(`Response: ${code} - ${JSON.stringify(data)}`);
      return mockRes;
    }
  })
};

const mockNext = () => {};

// Run the test
async function runTest() {
  console.log('🧪 Testing merge completion re-embedding functionality...\n');
  
  console.log('📝 Simulating GitLab merge completion webhook event:');
  console.log(`- Project ID: ${mockReq.body.project.id}`);
  console.log(`- Merge Request: !${mockReq.body.object_attributes.iid}`);
  console.log(`- Action: ${mockReq.body.object_attributes.action}`);
  console.log(`- State: ${mockReq.body.object_attributes.state}`);
  console.log(`- Target Branch: ${mockReq.body.object_attributes.target_branch}`);
  console.log(`- Source Branch: ${mockReq.body.object_attributes.source_branch}\n`);
  
  try {
    await processWebhook(mockReq, mockRes, mockNext);
    console.log('\n✅ Test completed successfully!');
    console.log('\n📋 Expected behavior:');
    console.log('1. Webhook should detect merge completion (action: "merge")');
    console.log('2. Should trigger processMergeCompletionEvent function');
    console.log('3. Should clear existing embeddings for the project');
    console.log('4. Should queue new embedding job with high priority');
    console.log('5. Should log appropriate messages throughout the process');
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTest();
}

export { runTest };
