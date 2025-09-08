#!/usr/bin/env node

/**
 * Direct webhook test - triggers actual webhook processing
 * This sends a real webhook to the cruiseline-pricing-updated endpoint
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = process.env.API_URL || 'https://zipsea-backend.onrender.com';

// Test cruise lines with their webhook line IDs
const TEST_LINES = [
  { id: 14, name: 'Holland America', expectedCruises: 1228 },
  { id: 104, name: 'Viking', expectedCruises: 6861 },
  { id: 24, name: 'MSC Cruises', expectedCruises: 6428 },
  { id: 32, name: 'Royal Caribbean', expectedCruises: 3449 },
];

async function sendWebhook(lineId, lineName) {
  console.log(`\n📤 Sending webhook for ${lineName} (Line ID: ${lineId})`);

  try {
    const webhookPayload = {
      event: 'cruiseline_pricing_updated',
      lineid: lineId,
      currency: 'USD',
      timestamp: new Date().toISOString(),
    };

    const response = await axios.post(
      `${API_BASE_URL}/api/webhooks/traveltek/cruiseline-pricing-updated`,
      webhookPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Webhook-Test-Direct',
        },
        timeout: 10000,
      }
    );

    console.log(`✅ Response: ${response.status}`);
    if (response.data) {
      console.log(`   Message: ${response.data.message || 'Processing started'}`);
      if (response.data.jobId) {
        console.log(`   Job ID: ${response.data.jobId}`);
      }
    }
    return true;
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      if (error.response.data) {
        console.error(`   Response:`, error.response.data);
      }
    }
    return false;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('🚀 Direct Webhook Test');
  console.log(`📍 Target: ${API_BASE_URL}`);
  console.log('='.repeat(60));

  // Get line ID from command line or use default
  const lineIdArg = process.argv[2];

  if (lineIdArg) {
    const lineId = parseInt(lineIdArg);
    const line = TEST_LINES.find(l => l.id === lineId);
    const name = line ? line.name : `Line ${lineId}`;
    await sendWebhook(lineId, name);
  } else {
    console.log('\nUsage: node test-webhook-direct.js [lineId]');
    console.log('\nAvailable test lines:');
    TEST_LINES.forEach(line => {
      console.log(`  ${line.id}: ${line.name} (~${line.expectedCruises} cruises)`);
    });
    console.log('\nTesting Holland America (small) and Viking (large)...\n');

    // Test small line
    await sendWebhook(14, 'Holland America');

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test large line
    await sendWebhook(104, 'Viking');
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Test complete - check Slack for processing updates');
  console.log('='.repeat(60));
}

main().catch(console.error);
