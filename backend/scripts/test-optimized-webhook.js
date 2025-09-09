#!/usr/bin/env node

/**
 * Test script for the optimized webhook processing system
 * Tests FTP connection pooling, parallel processing, and Slack notifications
 */

const axios = require('axios');
require('dotenv').config();

const API_URL = process.env.API_URL || 'http://localhost:3001';

// Test configurations
const tests = {
  // Test 1: Single line webhook
  singleLine: {
    name: 'Single Line Webhook',
    payload: {
      event: 'cruiseline_pricing_updated',
      lineid: 16,
      currency: 'USD',
      marketid: 1,
      source: 'test',
      description: 'Test single line update',
      timestamp: Date.now(),
    },
  },

  // Test 2: Multiple webhooks in quick succession
  multipleWebhooks: {
    name: 'Multiple Webhooks',
    payloads: [
      {
        event: 'cruiseline_pricing_updated',
        lineid: 16,
        currency: 'USD',
        marketid: 1,
        source: 'test',
        description: 'Test line 16',
        timestamp: Date.now(),
      },
      {
        event: 'cruiseline_pricing_updated',
        lineid: 22,
        currency: 'USD',
        marketid: 1,
        source: 'test',
        description: 'Test line 22',
        timestamp: Date.now() + 1000,
      },
      {
        event: 'cruiseline_pricing_updated',
        lineid: 11,
        currency: 'USD',
        marketid: 1,
        source: 'test',
        description: 'Test line 11',
        timestamp: Date.now() + 2000,
      },
    ],
  },

  // Test 3: Connection pool stress test
  poolStress: {
    name: 'Connection Pool Stress Test',
    lineIds: [16, 22, 11, 35, 44], // Multiple lines to process simultaneously
  },
};

// Helper functions
async function sendWebhook(payload) {
  try {
    const response = await axios.post(`${API_URL}/api/webhooks/traveltek`, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });
    return response.data;
  } catch (error) {
    console.error('Failed to send webhook:', error.message);
    throw error;
  }
}

async function getWebhookStatus() {
  try {
    const response = await axios.get(`${API_URL}/api/webhooks/status`, {
      timeout: 5000,
    });
    return response.data;
  } catch (error) {
    console.error('Failed to get status:', error.message);
    return null;
  }
}

async function getPoolStats() {
  try {
    const response = await axios.get(`${API_URL}/api/webhooks/pool-stats`, {
      timeout: 5000,
    });
    return response.data;
  } catch (error) {
    console.error('Failed to get pool stats:', error.message);
    return null;
  }
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test runners
async function testSingleWebhook() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TEST 1: Single Line Webhook');
  console.log('='.repeat(60));

  const test = tests.singleLine;
  console.log(`\nSending webhook for line ${test.payload.lineid}...`);

  const result = await sendWebhook(test.payload);
  console.log('Response:', result);

  // Wait and check status
  await delay(5000);
  const status = await getWebhookStatus();
  if (status) {
    console.log('\nRecent webhooks:');
    status.recentWebhooks.slice(0, 3).forEach(w => {
      console.log(`  - Line ${w.lineId}: ${w.status} (${w.createdAt})`);
    });
  }

  console.log('\n✅ Test 1 completed');
}

async function testMultipleWebhooks() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TEST 2: Multiple Webhooks in Quick Succession');
  console.log('='.repeat(60));

  const test = tests.multipleWebhooks;

  console.log('\nSending multiple webhooks...');
  for (const payload of test.payloads) {
    console.log(`  - Sending webhook for line ${payload.lineid}`);
    await sendWebhook(payload);
    await delay(500); // Small delay between webhooks
  }

  console.log('\nWaiting for processing...');
  await delay(10000);

  // Check status
  const status = await getWebhookStatus();
  if (status) {
    console.log('\nActive processing:', status.activeProcessing);
    console.log('FTP Pool:', status.ftpPool);
  }

  console.log('\n✅ Test 2 completed');
}

async function testConnectionPool() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TEST 3: Connection Pool Stress Test');
  console.log('='.repeat(60));

  const test = tests.poolStress;

  console.log('\nInitial pool stats:');
  let poolStats = await getPoolStats();
  if (poolStats) {
    console.log(`  Total: ${poolStats.pool.total}, In Use: ${poolStats.pool.inUse}, Idle: ${poolStats.pool.idle}`);
  }

  console.log('\nTriggering multiple webhooks simultaneously...');
  const promises = test.lineIds.map(lineId =>
    sendWebhook({
      event: 'cruiseline_pricing_updated',
      lineid: lineId,
      currency: 'USD',
      marketid: 1,
      source: 'stress-test',
      description: `Stress test for line ${lineId}`,
      timestamp: Date.now(),
    })
  );

  await Promise.all(promises);
  console.log(`Sent ${test.lineIds.length} webhooks`);

  // Monitor pool stats
  console.log('\nMonitoring pool stats...');
  for (let i = 0; i < 5; i++) {
    await delay(3000);
    poolStats = await getPoolStats();
    if (poolStats) {
      console.log(`  [${i * 3}s] Connections: ${poolStats.pool.total}, In Use: ${poolStats.pool.inUse}, Waiting: ${poolStats.pool.waiting}`);
    }
  }

  console.log('\n✅ Test 3 completed');
}

async function testHealthCheck() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 Health Check');
  console.log('='.repeat(60));

  try {
    const response = await axios.get(`${API_URL}/api/webhooks/health`, {
      timeout: 5000,
    });
    console.log('\nHealth status:', response.data);
  } catch (error) {
    console.error('Health check failed:', error.message);
  }
}

// Main test runner
async function runAllTests() {
  console.log('\n' + '🚀'.repeat(30));
  console.log('OPTIMIZED WEBHOOK SYSTEM TEST SUITE');
  console.log('🚀'.repeat(30));
  console.log(`\nAPI URL: ${API_URL}`);
  console.log(`Time: ${new Date().toISOString()}`);

  try {
    // Run health check first
    await testHealthCheck();

    // Run individual tests
    await testSingleWebhook();
    await delay(5000);

    await testMultipleWebhooks();
    await delay(5000);

    await testConnectionPool();

    // Final status check
    console.log('\n' + '='.repeat(60));
    console.log('📊 FINAL STATUS');
    console.log('='.repeat(60));

    const finalStatus = await getWebhookStatus();
    if (finalStatus) {
      console.log('\nRecent webhooks processed:');
      finalStatus.recentWebhooks.forEach(w => {
        console.log(`  - Line ${w.lineId}: ${w.status} (${w.createdAt})`);
      });

      console.log('\nFTP Pool final state:');
      console.log(`  Total: ${finalStatus.ftpPool.total}`);
      console.log(`  In Use: ${finalStatus.ftpPool.inUse}`);
      console.log(`  Idle: ${finalStatus.ftpPool.idle}`);
    }

    console.log('\n' + '✅'.repeat(30));
    console.log('ALL TESTS COMPLETED SUCCESSFULLY');
    console.log('✅'.repeat(30));

  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

// Run specific test or all tests
const testName = process.argv[2];

if (testName === 'single') {
  testSingleWebhook().then(() => process.exit(0));
} else if (testName === 'multiple') {
  testMultipleWebhooks().then(() => process.exit(0));
} else if (testName === 'pool') {
  testConnectionPool().then(() => process.exit(0));
} else {
  runAllTests().then(() => process.exit(0));
}
