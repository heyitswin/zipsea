#!/usr/bin/env node

/**
 * Test webhook batching for large cruise lines
 * This script simulates webhook calls for cruise lines with many cruises
 * to verify that ALL cruises are processed, not just the first 500
 */

const axios = require('axios');

// Configuration - update based on environment
const API_BASE_URL = process.env.API_URL || 'https://zipsea-backend.onrender.com';
const TEST_ENVIRONMENT = process.env.TEST_ENV || 'staging';

// Large cruise lines for testing (webhook line IDs from Traveltek)
const TEST_CRUISE_LINES = [
  { webhookLineId: 104, name: 'Viking', expectedCruises: 6861 },
  { webhookLineId: 24, name: 'MSC Cruises', expectedCruises: 6428 },
  { webhookLineId: 32, name: 'Royal Caribbean', expectedCruises: 3449 },
  { webhookLineId: 2, name: 'Celebrity Cruises', expectedCruises: 1638 },
  { webhookLineId: 14, name: 'Holland America', expectedCruises: 1228 }
];

async function testWebhook(cruiseLine) {
  console.log(`\n🧪 Testing webhook for ${cruiseLine.name} (Line ID: ${cruiseLine.webhookLineId})`);
  console.log(`   Expected cruises: ${cruiseLine.expectedCruises}`);

  try {
    // Prepare webhook payload
    const webhookPayload = {
      event: 'staticprice',
      lineid: cruiseLine.webhookLineId,
      test: true,
      timestamp: new Date().toISOString()
    };

    console.log(`📤 Sending webhook to ${API_BASE_URL}/api/webhooks/traveltek/test`);

    // Send test webhook
    const response = await axios.post(
      `${API_BASE_URL}/api/webhooks/traveltek/test`,
      webhookPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Test-Mode': 'true'
        },
        timeout: 10000 // 10 second timeout for webhook acknowledgment
      }
    );

    if (response.status === 200 || response.status === 202) {
      console.log(`✅ Webhook accepted successfully`);
      console.log(`   Job ID: ${response.data.jobId || 'N/A'}`);
      console.log(`   Message: ${response.data.message || 'Processing started'}`);

      // Check if it mentions batching for large cruise lines
      if (cruiseLine.expectedCruises > 500) {
        const expectedBatches = Math.ceil(cruiseLine.expectedCruises / 500);
        console.log(`   📦 Should process in ${expectedBatches} batches (500 cruises each)`);
        console.log(`   ⏳ Monitor Slack for batch progress updates`);
      }

      return true;
    } else {
      console.log(`❌ Unexpected response status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error testing ${cruiseLine.name}:`, error.message);
    if (error.response) {
      console.error(`   Response status: ${error.response.status}`);
      console.error(`   Response data:`, error.response.data);
    }
    return false;
  }
}

async function checkProcessingStatus() {
  console.log('\n📊 Checking webhook processing status...');

  try {
    const response = await axios.get(`${API_BASE_URL}/api/webhooks/traveltek/status`);

    if (response.data) {
      console.log('Current processing status:');
      console.log(`  Active jobs: ${response.data.activeJobs || 0}`);
      console.log(`  Pending jobs: ${response.data.pendingJobs || 0}`);
      console.log(`  Completed jobs: ${response.data.completedJobs || 0}`);
      console.log(`  Failed jobs: ${response.data.failedJobs || 0}`);
    }
  } catch (error) {
    console.log('Could not fetch processing status:', error.message);
  }
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('🚀 Webhook Batching Test Suite');
  console.log(`📍 Environment: ${TEST_ENVIRONMENT}`);
  console.log(`🔗 API URL: ${API_BASE_URL}`);
  console.log('='.repeat(60));

  console.log('\n⚠️  IMPORTANT: This test will trigger REAL webhook processing!');
  console.log('   Monitor Slack notifications to verify:');
  console.log('   1. ALL cruises are being processed (not just 500)');
  console.log('   2. Large cruise lines show batch progress updates');
  console.log('   3. Final counts match expected cruise numbers');
  console.log('');

  // Test small cruise line first (no batching needed)
  console.log('Testing small cruise line (no batching):');
  await testWebhook({ webhookLineId: 14, name: 'Holland America', expectedCruises: 1228 });

  // Wait a bit before testing large cruise line
  console.log('\nWaiting 5 seconds before testing large cruise line...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Test large cruise line (requires batching)
  console.log('Testing large cruise line (requires batching):');
  await testWebhook({ webhookLineId: 104, name: 'Viking', expectedCruises: 6861 });

  // Check processing status
  await new Promise(resolve => setTimeout(resolve, 3000));
  await checkProcessingStatus();

  console.log('\n' + '='.repeat(60));
  console.log('📝 Test Summary:');
  console.log('1. Check Slack for webhook notifications');
  console.log('2. Viking should show ~14 batch updates (6861 ÷ 500)');
  console.log('3. Holland America should process in 3 batches (1228 ÷ 500)');
  console.log('4. Final success counts should match total cruises');
  console.log('='.repeat(60));
}

// Run tests if called directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testWebhook, checkProcessingStatus };
