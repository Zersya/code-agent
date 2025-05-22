/**
 * Test script for the automatic re-review functionality
 * This simulates emoji reactions on bot comments to trigger re-reviews
 */

import { processWebhook } from './dist/controllers/webhook.js';

// Mock emoji event that triggers re-review
const mockEmojiEvent = {
  body: {
    object_kind: 'emoji',
    event_type: 'emoji',
    user: {
      id: 2,
      name: 'Developer User',
      username: 'developer',
      avatar_url: '',
      email: 'developer@example.com'
    },
    project_id: 12345,
    project: {
      id: 12345,
      name: 'test-project',
      description: 'Test project for re-review functionality',
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
    object_attributes: {
      id: 1,
      user_id: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      awardable_id: 123,
      awardable_type: 'Note',
      name: '👍',
      action: 'add'
    },
    note: {
      id: 123,
      body: 'Halo, berikut review untuk MR ini:\n\n## Review Kode\n\n**Ringkasan:**\nKode sudah baik dan memenuhi standar.\n\n**Kesimpulan:**\nMerge request has already been reviewed. Silahkan merge! Terima kasih',
      attachment: null,
      author: {
        id: 1,
        name: 'Bot User',
        username: 'bot',
        avatar_url: '',
        email: 'bot@example.com'
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      system: false,
      noteable_id: 1,
      noteable_type: 'MergeRequest',
      resolvable: false,
      confidential: false,
      internal: false,
      noteable_iid: 1,
      url: 'https://gitlab.example.com/test/test-project/-/merge_requests/1#note_123'
    },
    merge_request: {
      id: 1,
      iid: 1,
      target_branch: 'main',
      source_branch: 'feature/new-feature',
      source_project_id: 12345,
      target_project_id: 12345,
      state: 'opened',
      merge_status: 'can_be_merged',
      title: 'Add new feature',
      description: 'This adds a new feature to the application',
      url: 'https://gitlab.example.com/test/test-project/-/merge_requests/1',
      source: {
        id: 12345,
        name: 'test-project',
        description: 'Test project for re-review functionality',
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
        description: 'Test project for re-review functionality',
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
        id: 'def456ghi789',
        message: 'Update feature implementation',
        timestamp: new Date().toISOString(),
        url: 'https://gitlab.example.com/test/test-project/-/commit/def456ghi789',
        author: {
          name: 'Developer User',
          email: 'developer@example.com'
        }
      },
      work_in_progress: false,
      assignee: {
        id: 2,
        name: 'Developer User',
        username: 'developer',
        avatar_url: '',
        email: 'developer@example.com'
      },
      assignees: [{
        id: 2,
        name: 'Developer User',
        username: 'developer',
        avatar_url: '',
        email: 'developer@example.com'
      }],
      author: {
        id: 2,
        name: 'Developer User',
        username: 'developer',
        avatar_url: '',
        email: 'developer@example.com'
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      action: 'update'
    }
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
async function runReReviewTest() {
  console.log('🧪 Testing automatic re-review functionality...\n');
  
  console.log('📝 Simulating emoji reaction on bot comment:');
  console.log(`- Project ID: ${mockEmojiEvent.body.project_id}`);
  console.log(`- Merge Request: !${mockEmojiEvent.body.merge_request.iid}`);
  console.log(`- Emoji: ${mockEmojiEvent.body.object_attributes.name}`);
  console.log(`- Action: ${mockEmojiEvent.body.object_attributes.action}`);
  console.log(`- Note contains trigger phrase: ${mockEmojiEvent.body.note.body.includes('Merge request has already been reviewed')}`);
  console.log(`- Note ID: ${mockEmojiEvent.body.note.id}\n`);
  
  try {
    await processWebhook(mockEmojiEvent, mockRes, mockNext);
    console.log('\n✅ Test completed successfully!');
    console.log('\n📋 Expected behavior:');
    console.log('1. Webhook should detect emoji reaction on note');
    console.log('2. Should check if note contains "Merge request has already been reviewed"');
    console.log('3. Should trigger re-review process');
    console.log('4. Should compare current commit with last reviewed commit');
    console.log('5. Should analyze only new changes since last review');
    console.log('6. Should post re-review comment with incremental analysis');
    console.log('7. Should update review history with new commit SHA');
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runReReviewTest();
}

export { runReReviewTest };
