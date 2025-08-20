#!/usr/bin/env node

/**
 * Simple test to check if the health endpoint is accessible
 */

import axios from 'axios';

async function testHealthEndpoint() {
  console.log('🔍 Testing Embedding Service Health Endpoints...\n');
  
  const baseUrl = 'http://qodo-embed-api:8000';
  
  try {
    console.log('📋 Testing endpoints:');
    console.log(`   Base URL: ${baseUrl}`);
    console.log(`   Health endpoint: ${baseUrl}/health`);
    console.log(`   Embedding endpoint: ${baseUrl}/v1/embeddings`);
    console.log();

    // Test health endpoint
    console.log('🏥 Testing health endpoint...');
    try {
      const healthResponse = await axios.get(`${baseUrl}/health`);
      console.log('✅ Health endpoint accessible');
      console.log('📊 Health response:', JSON.stringify(healthResponse.data, null, 2));
    } catch (healthError) {
      console.log(`❌ Health endpoint failed: ${healthError.message}`);
      if (healthError.response) {
        console.log(`   Status: ${healthError.response.status}`);
        console.log(`   Data: ${JSON.stringify(healthError.response.data)}`);
      }
    }
    
    console.log();
    
    // Test embedding endpoint with a simple request
    console.log('🧪 Testing embedding endpoint...');
    try {
      const embeddingResponse = await axios.post(`${baseUrl}/v1/embeddings`, {
        model: 'qodo-embed-1',
        input: 'function test() { return "hello world"; }'
      });
      console.log('✅ Embedding endpoint accessible');
      console.log(`📊 Generated embedding with ${embeddingResponse.data.data[0].embedding.length} dimensions`);
    } catch (embeddingError) {
      console.log(`❌ Embedding endpoint failed: ${embeddingError.message}`);
      if (embeddingError.response) {
        console.log(`   Status: ${embeddingError.response.status}`);
        console.log(`   Data: ${JSON.stringify(embeddingError.response.data)}`);
      }
    }
    
  } catch (error) {
    console.error('💥 Test failed with error:', error.message);
  }
}

// Run the test
testHealthEndpoint()
  .then(() => {
    console.log('\n🏁 Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
  });
