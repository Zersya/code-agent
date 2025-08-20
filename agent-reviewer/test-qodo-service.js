#!/usr/bin/env node

/**
 * Test script to verify the Qodo embedding service can start without errors
 * This tests the SentenceTransformer initialization fix
 */

const axios = require('axios');

const QODO_SERVICE_URL = process.env.QODO_SERVICE_URL || 'http://localhost:8000';
const MAX_WAIT_TIME = 60000; // 60 seconds
const POLL_INTERVAL = 2000; // 2 seconds

console.log('🧪 Testing Qodo Embedding Service\n');

async function waitForService(url, maxWaitTime = MAX_WAIT_TIME) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      console.log(`⏳ Checking service health at ${url}/health...`);
      const response = await axios.get(`${url}/health`, { timeout: 5000 });
      
      if (response.status === 200) {
        console.log(`✅ Service is responding!`);
        console.log(`📊 Health check response:`, JSON.stringify(response.data, null, 2));
        return response.data;
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log(`🔄 Service not ready yet, waiting...`);
      } else {
        console.log(`⚠️  Health check error: ${error.message}`);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }
  
  throw new Error(`Service did not become ready within ${maxWaitTime}ms`);
}

async function testEmbeddingGeneration(url) {
  console.log('\n🔬 Testing embedding generation...');
  
  const testPayload = {
    model: 'qodo-embed-1',
    input: 'function test() { return "hello world"; }'
  };
  
  try {
    const response = await axios.post(`${url}/v1/embeddings`, testPayload, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.status === 200 && response.data) {
      console.log(`✅ Embedding generation successful!`);
      console.log(`📊 Response structure:`, {
        object: response.data.object,
        model: response.data.model,
        dataLength: response.data.data?.length,
        embeddingLength: response.data.data?.[0]?.embedding?.length,
        usage: response.data.usage
      });
      return true;
    } else {
      console.log(`❌ Unexpected response:`, response.status, response.data);
      return false;
    }
  } catch (error) {
    console.log(`❌ Embedding generation failed:`, error.message);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return false;
  }
}

async function runTests() {
  let healthCheckPassed = false;
  let embeddingTestPassed = false;
  
  try {
    // Test 1: Health check and service availability
    console.log('📋 Test 1: Service Health Check');
    const healthData = await waitForService(QODO_SERVICE_URL);
    
    // Validate health response
    if (healthData.status === 'ok' && healthData.model_status === 'loaded') {
      console.log(`✅ Health check passed - Model loaded successfully`);
      console.log(`   Model: ${healthData.model_name}`);
      console.log(`   Device: ${healthData.device}`);
      healthCheckPassed = true;
    } else if (healthData.model_status === 'not_loaded_or_failed') {
      console.log(`❌ Health check failed - Model failed to load`);
      console.log(`   This indicates the trust_remote_code fix may not have worked`);
    } else {
      console.log(`⚠️  Unexpected health status: ${healthData.model_status}`);
    }
    
    // Test 2: Embedding generation (only if health check passed)
    if (healthCheckPassed) {
      console.log('\n📋 Test 2: Embedding Generation');
      embeddingTestPassed = await testEmbeddingGeneration(QODO_SERVICE_URL);
    } else {
      console.log('\n⏭️  Skipping embedding test due to failed health check');
    }
    
  } catch (error) {
    console.log(`❌ Test failed with error: ${error.message}`);
  }
  
  // Summary
  console.log('\n📊 Test Results Summary:');
  console.log(`  Health Check: ${healthCheckPassed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Embedding Generation: ${embeddingTestPassed ? '✅ PASS' : '❌ FAIL'}`);
  
  if (healthCheckPassed && embeddingTestPassed) {
    console.log('\n🎉 All tests passed! The Qodo embedding service is working correctly.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please check the service logs for more details.');
    console.log('\n💡 Troubleshooting tips:');
    console.log('  1. Make sure the qodo-embedding-service is running');
    console.log('  2. Check if the requirements.txt has been updated to sentence-transformers>=2.3.1');
    console.log('  3. Rebuild the Docker container if using Docker');
    console.log('  4. Check the service logs for any error messages');
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted by user');
  process.exit(1);
});

// Run the tests
runTests().catch(error => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});
