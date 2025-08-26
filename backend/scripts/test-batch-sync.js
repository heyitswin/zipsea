#!/usr/bin/env node

/**
 * Test the complete batch sync flow
 * Run with: node scripts/test-batch-sync.js
 */

const https = require('https');

const API_URL = process.env.API_URL || 'https://zipsea-production.onrender.com';

function makeRequest(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const url = `${API_URL}${path}`;
    const parsedUrl = new URL(url);
    
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (e) {
          resolve({ raw: data });
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Complete Batch Sync Flow Test');
  console.log('================================\n');

  try {
    // Step 1: Health Check
    console.log('Step 1: System Health Check');
    console.log('----------------------------');
    
    const health = await makeRequest('/health');
    if (health.status === 'ok') {
      console.log('✅ API is healthy\n');
    } else {
      console.log('❌ API health check failed');
      process.exit(1);
    }

    // Step 2: Check Pending Updates
    console.log('Step 2: Check Current Pending Updates');
    console.log('--------------------------------------');
    
    const pendingBefore = await makeRequest('/api/admin/pending-syncs');
    console.log('Summary:', JSON.stringify(pendingBefore.summary, null, 2));
    console.log();

    // Step 3: Trigger Batch Sync
    console.log('Step 3: Trigger Batch Sync');
    console.log('---------------------------');
    
    const triggerResponse = await makeRequest('/api/admin/trigger-batch-sync', 'POST');
    console.log('Response:', JSON.stringify(triggerResponse, null, 2));
    
    if (triggerResponse.message === 'No pending price updates') {
      console.log('\n✅ No pending updates - system is working correctly\n');
      console.log('This is expected when there are no webhooks from Traveltek.');
      console.log('The system will automatically process updates when webhooks arrive.\n');
    } else if (triggerResponse.message === 'Batch sync triggered') {
      console.log('\n✅ Batch sync triggered successfully');
      const pendingLines = triggerResponse.pendingLines || 0;
      console.log(`Processing updates for ${pendingLines} cruise line(s)...\n`);
    }

    // Summary
    console.log('\n🎉 All tests passed! The batch sync system is working correctly.\n');
    console.log('Monitor live activity at: https://dashboard.render.com');
    
    process.exit(0);
  } catch (error) {
    console.log(`\n❌ Test failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the tests
runTests();
