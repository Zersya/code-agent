#!/usr/bin/env node

/**
 * Test script to verify embedding service health check functionality
 */

import dotenv from 'dotenv';
import { embeddingService } from './dist/services/embedding.js';

dotenv.config();

async function testEmbeddingHealth() {
  console.log('🔍 Testing Embedding Service Health Check...\n');
  
  try {
    console.log('📋 Configuration:');
    console.log(`   QODO_EMBED_API_URL: ${process.env.QODO_EMBED_API_URL}`);
    console.log(`   Expected health endpoint: ${process.env.QODO_EMBED_API_URL?.replace('/v1/embeddings', '')}/health`);
    console.log(`   Expected embedding endpoint: ${process.env.QODO_EMBED_API_URL}`);
    console.log();

    console.log('🏥 Running health check...');
    const healthResult = await embeddingService.checkEmbeddingServiceHealth();
    
    console.log('📊 Health Check Results:');
    console.log(`   ✅ Is Healthy: ${healthResult.isHealthy}`);
    console.log(`   🔧 Can Embed: ${healthResult.canEmbed}`);
    console.log(`   🤖 Model Loaded: ${healthResult.modelLoaded}`);
    console.log(`   ⏰ Last Checked: ${healthResult.lastChecked}`);
    
    if (healthResult.error) {
      console.log(`   ❌ Error: ${healthResult.error}`);
    }
    
    console.log();
    
    // Test circuit breaker state
    console.log('🔌 Circuit Breaker State:');
    const circuitBreakerState = embeddingService.getCircuitBreakerState();
    console.log(`   State: ${circuitBreakerState.state}`);
    console.log(`   Failure Count: ${circuitBreakerState.failureCount}`);
    if (circuitBreakerState.nextRetryTime) {
      console.log(`   Next Retry: ${circuitBreakerState.nextRetryTime}`);
    }
    
    console.log();
    
    // Test legacy health check for backward compatibility
    console.log('🔄 Testing legacy health check...');
    const legacyResult = await embeddingService.checkEmbeddingServiceHealthLegacy();
    console.log(`   Legacy Result: ${legacyResult}`);
    
    console.log();
    
    if (healthResult.isHealthy && healthResult.canEmbed) {
      console.log('✅ SUCCESS: Embedding service is healthy and ready!');
      
      // Test a simple embedding if service is healthy
      console.log('\n🧪 Testing simple embedding...');
      try {
        const testEmbedding = await embeddingService.generateEmbeddings([
          { content: 'function test() { return "hello world"; }', metadata: { test: true } }
        ]);
        
        if (testEmbedding && testEmbedding.length > 0) {
          console.log(`✅ Embedding test successful! Generated ${testEmbedding.length} embeddings`);
          console.log(`   First embedding dimension: ${testEmbedding[0].embedding.length}`);
        } else {
          console.log('❌ Embedding test failed: No embeddings returned');
        }
      } catch (embeddingError) {
        console.log(`❌ Embedding test failed: ${embeddingError.message}`);
      }
    } else {
      console.log('❌ FAILURE: Embedding service is not ready');
      console.log('   Please check:');
      console.log('   1. Docker container is running: docker ps | grep qodo_embed_api');
      console.log('   2. Service logs: docker logs qodo_embed_api');
      console.log('   3. Network connectivity between containers');
      console.log('   4. Model loading status in the service');
    }
    
  } catch (error) {
    console.error('💥 Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testEmbeddingHealth()
  .then(() => {
    console.log('\n🏁 Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
  });
