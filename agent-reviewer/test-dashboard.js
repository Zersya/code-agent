#!/usr/bin/env node

/**
 * Simple test script to verify the admin dashboard functionality
 * This script tests the backend API endpoints and basic functionality
 */

const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const BASE_URL = process.env.DASHBOARD_URL || process.env.APP_URL || 'http://localhost:8080';
const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY || 'test-admin-secret';

let authToken = null;

async function testEndpoint(name, method, url, data = null, headers = {}) {
  try {
    console.log(`\n🧪 Testing ${name}...`);
    
    const config = {
      method,
      url: `${BASE_URL}${url}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    console.log(`✅ ${name}: ${response.status} ${response.statusText}`);
    return response.data;
  } catch (error) {
    console.log(`❌ ${name}: ${error.response?.status || 'ERROR'} ${error.response?.statusText || error.message}`);
    if (error.response?.data) {
      console.log(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return null;
  }
}

async function runTests() {
  console.log('🚀 Starting Agent Reviewer Dashboard Tests');
  console.log(`📍 Base URL: ${BASE_URL}`);
  
  // Test 1: Health Check
  await testEndpoint('Health Check', 'GET', '/health');
  
  // Test 2: System Health (should require auth)
  await testEndpoint('System Health (no auth)', 'GET', '/health/system');
  
  // Test 3: Admin Login
  const loginResult = await testEndpoint('Admin Login', 'POST', '/api/auth/login', {
    secretKey: ADMIN_SECRET
  });
  
  if (loginResult && loginResult.token) {
    authToken = loginResult.token;
    console.log('🔑 Authentication token received');
    
    const authHeaders = {
      'Authorization': `Bearer ${authToken}`
    };
    
    // Test 4: Get Admin User Info
    await testEndpoint('Get Admin User', 'GET', '/api/auth/me', null, authHeaders);
    
    // Test 5: System Health (with auth)
    await testEndpoint('System Health (with auth)', 'GET', '/api/system/health', null, authHeaders);
    
    // Test 6: Queue Status
    await testEndpoint('Queue Status', 'GET', '/api/queue/status', null, authHeaders);
    
    // Test 7: Review History
    await testEndpoint('Review History', 'GET', '/api/reviews?page=1&limit=10', null, authHeaders);
    
    // Test 8: Analytics
    await testEndpoint('Analytics', 'GET', '/api/analytics', null, authHeaders);
    
    // Test 9: Projects List
    await testEndpoint('Projects List', 'GET', '/api/projects', null, authHeaders);
    
    // Test 10: Admin Logout
    await testEndpoint('Admin Logout', 'POST', '/api/auth/logout', null, authHeaders);
    
  } else {
    console.log('❌ Authentication failed - skipping authenticated tests');
    console.log('💡 Make sure ADMIN_SECRET_KEY is set correctly in your .env file');
  }
  
  console.log('\n📊 Test Summary:');
  console.log('- Health endpoints should be accessible without authentication');
  console.log('- Admin endpoints should require valid authentication');
  console.log('- All authenticated endpoints should return proper responses');
  console.log('\n🎯 Next Steps:');
  console.log('1. Docker Compose (Recommended):');
  console.log('   docker-compose up -d');
  console.log('   Access: http://localhost:8080');
  console.log('');
  console.log('2. Manual Setup:');
  console.log('   - Start backend: npm run start:webhook');
  console.log('   - Start frontend: cd frontend && npm run dev');
  console.log('   - Access: http://localhost:5173');
  console.log('');
  console.log('3. Login with your admin secret key');
  
  console.log('\n✨ Dashboard Testing Complete!');
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the tests
runTests().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
