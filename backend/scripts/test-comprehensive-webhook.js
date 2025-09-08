#!/usr/bin/env node
/**
 * Test script for comprehensive webhook processing
 * Tests the new webhook service that processes ALL cruises for a line
 */

const axios = require('axios');

// Configuration
const API_URL = process.env.API_URL || 'https://zipsea-backend.onrender.com';
const ENVIRONMENT = API_URL.includes('production') ? 'production' : 'staging';

// Test cruise lines with different sizes
const TEST_LINES = [
  { id: 41, name: 'American Cruise Lines', expectedCruises: 1 },
  { id: 21, name: 'Crystal Cruises', expectedCruises: 5 },
  { id: 14, name: 'Holland America', expectedCruises: 1228 },
  { id: 22, name: 'Royal Caribbean', expectedCruises: 3102 },
  { id: 16, name: 'MSC Cruises', expectedCruises: 5956 },
  { id: 62, name: 'Viking', expectedCruises: 5622 }
];

/**
 * Test comprehensive webhook for a specific line
 */
async function testComprehensiveWebhook(lineId, lineName, expectedCruises) {
  console.log(`\n🧪 Testing comprehensive webhook for ${lineName} (Line ID: ${lineId})`);
  console.log(`   Expected cruises: ~${expectedCruises}`);
  console.log(`   This will process ALL cruises, not just 500`);

  try {
    console.log(`📤 Sending webhook to ${API_URL}/api/webhooks/traveltek/test-comprehensive`);

    const response = await axios.post(
      `${API_URL}/api/webhooks/traveltek/test-comprehensive`,
      { lineId },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );

    if (response.data.success) {
      console.log(`✅ Webhook accepted and processing started`);
      console.log(`   Webhook ID: ${response.data.webhookId}`);
      console.log(`   Processor: ${response.data.processor}`);
      console.log(`   Note: ${response.data.note}`);
    } else {
      console.log(`❌ Webhook rejected:`, response.data.message);
    }

    return response.data;

  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.log(`⏱️  Request timed out (expected for async processing)`);
      return { success: true, timeout: true };
    }
    console.error(`❌ Error testing ${lineName}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Check webhook processing status
 */
async function checkProcessingStatus() {
  try {
    const response = await axios.get(
      `${API_URL}/api/webhooks/traveltek/diagnostics`,
      { timeout: 5000 }
    );

    console.log(`\n📊 Current Processing Status:`);

    if (response.data.diagnostics) {
      const diag = response.data.diagnostics;

      console.log(`   Redis Status: ${diag.redisStatus}`);
      console.log(`   Active Locks: ${diag.activeLocks || 0}`);
      console.log(`   FTP Connection: ${diag.ftpConnection}`);

      if (diag.recentProcessing && diag.recentProcessing.length > 0) {
        console.log(`   Recent Updates:`);
        diag.recentProcessing.forEach(update => {
          console.log(`     - Line ${update.lineId}: ${update.cruisesUpdated} cruises at ${update.lastUpdate}`);
        });
      }
    }

    return response.data;

  } catch (error) {
    console.error(`Could not fetch processing status:`, error.message);
    return null;
  }
}

/**
 * Main test execution
 */
async function main() {
  console.log('============================================================');
  console.log('🚀 Comprehensive Webhook Test Suite');
  console.log(`📍 Environment: ${ENVIRONMENT}`);
  console.log(`🔗 API URL: ${API_URL}`);
  console.log('============================================================');

  console.log(`\n⚠️  IMPORTANT: This test will trigger REAL webhook processing!`);
  console.log(`   The comprehensive service will:`);
  console.log(`   1. Process ALL cruises for each line (not limited to 500)`);
  console.log(`   2. Handle JSON corruption gracefully with retries`);
  console.log(`   3. Use FTP connection pooling for better performance`);
  console.log(`   4. Send progress updates to Slack every 5 batches`);
  console.log(`   5. Continue processing even if some files fail\n`);

  // Get user confirmation
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const answer = await new Promise(resolve => {
    readline.question('Do you want to proceed? (y/n): ', resolve);
  });
  readline.close();

  if (answer.toLowerCase() !== 'y') {
    console.log('Test cancelled');
    process.exit(0);
  }

  // Test small line first
  console.log(`\nStarting with small cruise line for validation...`);
  const smallLine = TEST_LINES[0];
  await testComprehensiveWebhook(smallLine.id, smallLine.name, smallLine.expectedCruises);

  // Wait a bit before checking status
  await new Promise(resolve => setTimeout(resolve, 5000));
  await checkProcessingStatus();

  // Ask if should continue with larger line
  console.log(`\n📝 Small line test initiated.`);
  console.log(`   Monitor Slack for progress updates.`);
  console.log(`   The webhook will process in batches of 100 cruises.`);

  const readline2 = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const answer2 = await new Promise(resolve => {
    readline2.question('\nTest large cruise line (MSC with ~6000 cruises)? (y/n): ', resolve);
  });
  readline2.close();

  if (answer2.toLowerCase() === 'y') {
    const largeLine = TEST_LINES[4]; // MSC Cruises
    await testComprehensiveWebhook(largeLine.id, largeLine.name, largeLine.expectedCruises);

    console.log(`\n⏳ Large cruise line processing initiated.`);
    console.log(`   Expected batches: ~${Math.ceil(largeLine.expectedCruises / 100)}`);
    console.log(`   Monitor Slack for progress updates every 5 batches.`);

    // Check status after a delay
    await new Promise(resolve => setTimeout(resolve, 10000));
    await checkProcessingStatus();
  }

  console.log('\n============================================================');
  console.log('📝 Test Summary:');
  console.log('1. Check Slack for detailed progress and results');
  console.log('2. Monitor Render logs for any errors');
  console.log('3. Verify cruise updates in the database');
  console.log('4. The comprehensive service handles ALL cruises efficiently');
  console.log('============================================================\n');
}

// Run the test
main().catch(console.error);
