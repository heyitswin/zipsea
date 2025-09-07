#!/usr/bin/env node

/**
 * Test Webhook Script - Mimics Traveltek Webhook Notifications
 *
 * This script simulates real Traveltek webhook payloads for testing
 * the enhanced webhook system without waiting for actual Traveltek events.
 *
 * Usage:
 *   node scripts/test-webhook-traveltek.js [lineId] [environment]
 *
 * Examples:
 *   node scripts/test-webhook-traveltek.js 22 staging    # Test Royal Caribbean on staging
 *   node scripts/test-webhook-traveltek.js 3 production  # Test Celebrity on production
 *   node scripts/test-webhook-traveltek.js               # Default: Line 22 on staging
 */

const https = require('https');
const http = require('http');

// Configuration
const ENVIRONMENTS = {
  staging: {
    url: 'https://zipsea-backend.onrender.com',
    name: 'Staging'
  },
  production: {
    url: 'https://zipsea-production.onrender.com',
    name: 'Production'
  },
  local: {
    url: 'http://localhost:3000',
    name: 'Local'
  }
};

// Common cruise line IDs from Traveltek
const CRUISE_LINES = {
  3: 'Celebrity Cruises',
  17: 'Carnival Cruise Line',
  22: 'Royal Caribbean',
  14: 'Princess Cruises',
  26: 'Norwegian Cruise Line',
  7: 'Holland America Line',
  25: 'MSC Cruises',
  29: 'Virgin Voyages',
  19: 'Disney Cruise Line'
};

// Parse command line arguments
const args = process.argv.slice(2);
const lineId = parseInt(args[0]) || 22; // Default to Royal Caribbean
const environment = args[1] || 'staging'; // Default to staging
const testType = args[2] || 'pricing'; // 'pricing' or 'availability'

// Validate inputs
if (!ENVIRONMENTS[environment]) {
  console.error(`❌ Invalid environment: ${environment}`);
  console.log('Valid environments: staging, production, local');
  process.exit(1);
}

const config = ENVIRONMENTS[environment];
const lineName = CRUISE_LINES[lineId] || `Line ${lineId}`;

/**
 * Create a realistic Traveltek webhook payload
 */
function createWebhookPayload(type, lineId) {
  const timestamp = Math.floor(Date.now() / 1000);

  const payloads = {
    // Cruise line pricing updated (most common)
    pricing: {
      event: 'cruiseline_pricing_updated',
      lineid: lineId,
      lineId: lineId, // Some webhooks use different casing
      marketid: 0,
      currency: 'USD',
      timestamp: timestamp,
      source: 'traveltek_webhook',
      description: `Pricing update for cruise line ${lineId}`,
      metadata: {
        webhook_version: '2.0',
        batch_id: `batch_${timestamp}`,
        total_cruises_affected: Math.floor(Math.random() * 500) + 100
      }
    },

    // Specific cruise pricing update
    cruise_pricing: {
      event: 'cruise_pricing_updated',
      cruiseid: 1234567 + Math.floor(Math.random() * 100000),
      lineid: lineId,
      shipid: 400 + Math.floor(Math.random() * 100),
      currency: 'USD',
      timestamp: timestamp,
      source: 'traveltek_webhook',
      price_changes: {
        interior: { old: 1299, new: 1199 },
        oceanview: { old: 1599, new: 1499 },
        balcony: { old: 1899, new: 1799 },
        suite: { old: 2999, new: 2899 }
      }
    },

    // Availability change
    availability: {
      event: 'availability_changed',
      lineid: lineId,
      cruiseid: 1234567 + Math.floor(Math.random() * 100000),
      cabincode: 'BAL',
      available: Math.random() > 0.5,
      inventory: Math.floor(Math.random() * 20),
      waitlist: false,
      timestamp: timestamp,
      source: 'traveltek_webhook'
    },

    // Batch update (multiple cruises)
    batch: {
      event: 'batch_pricing_update',
      lineid: lineId,
      cruiseids: Array.from({ length: 10 }, () =>
        1234567 + Math.floor(Math.random() * 100000)
      ),
      currency: 'USD',
      timestamp: timestamp,
      source: 'traveltek_webhook',
      batch_size: 10,
      priority: 'high'
    }
  };

  return payloads[type] || payloads.pricing;
}

/**
 * Send webhook to the specified environment
 */
async function sendWebhook(payload, endpoint) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${config.url}${endpoint}`);
    const data = JSON.stringify(payload);

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'User-Agent': 'TravelTek-Webhook/2.0 (Test)',
        'X-Webhook-Source': 'test-script',
        'X-Webhook-Version': '2.0'
      }
    };

    // Use http or https based on protocol
    const client = url.protocol === 'https:' ? https : http;

    console.log(`\n📤 Sending webhook to ${url.href}`);
    console.log(`📦 Payload size: ${data.length} bytes`);

    const req = client.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        console.log(`📨 Response Status: ${res.statusCode}`);

        try {
          const response = JSON.parse(responseData);
          console.log('📊 Response:', JSON.stringify(response, null, 2));
          resolve(response);
        } catch (e) {
          console.log('📊 Response (raw):', responseData);
          resolve(responseData);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request failed:', error.message);
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.setTimeout(10000); // 10 second timeout
    req.write(data);
    req.end();
  });
}

/**
 * Main test function
 */
async function runWebhookTest() {
  console.log('🧪 Traveltek Webhook Test Script');
  console.log('=====================================\n');

  console.log(`📍 Environment: ${config.name} (${config.url})`);
  console.log(`🚢 Cruise Line: ${lineName} (ID: ${lineId})`);
  console.log(`📝 Test Type: ${testType}`);
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);

  // Create webhook payload
  const payload = createWebhookPayload(testType, lineId);

  console.log('\n📋 Webhook Payload:');
  console.log(JSON.stringify(payload, null, 2));

  try {
    // Test different endpoints based on webhook type
    const endpoints = {
      pricing: '/api/webhooks/traveltek/cruiseline-pricing-updated',
      cruise_pricing: '/api/webhooks/traveltek/cruise-pricing-updated',
      availability: '/api/webhooks/traveltek/availability-changed',
      batch: '/api/webhooks/traveltek/batch-update'
    };

    const endpoint = endpoints[testType] || endpoints.pricing;

    console.log(`\n🎯 Target Endpoint: ${endpoint}`);

    // Send the webhook
    const startTime = Date.now();
    const response = await sendWebhook(payload, endpoint);
    const duration = Date.now() - startTime;

    console.log(`\n⏱️ Response Time: ${duration}ms`);

    // Check response
    if (response && response.success) {
      console.log('\n✅ Webhook accepted successfully!');

      if (response.webhookId) {
        console.log(`📌 Webhook ID: ${response.webhookId}`);
        console.log('\n💡 Track processing with:');
        console.log(`   SELECT * FROM webhook_processing_log WHERE webhook_id = '${response.webhookId}';`);
      }
    } else {
      console.log('\n⚠️ Webhook processed but may have issues');
    }

    // Provide monitoring commands
    console.log('\n📊 Monitor Results:');
    console.log(`1. Check Render logs: ${config.url.replace('https://', 'https://dashboard.render.com/web/')}`);
    console.log(`2. Check webhook health: curl ${config.url}/api/webhooks/traveltek/health`);
    console.log(`3. Check processing stats: curl ${config.url}/api/webhooks/traveltek/stats`);
    console.log(`4. Check database for updates:`);
    console.log(`   - Cruises with needs_price_update = true`);
    console.log(`   - Recent entries in webhook_processing_log`);
    console.log(`   - Price history snapshots created`);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Additional test scenarios
async function runComprehensiveTest() {
  console.log('\n🔄 Running Comprehensive Test Suite...\n');

  const tests = [
    { type: 'pricing', lineId: 22, name: 'Royal Caribbean Pricing' },
    { type: 'cruise_pricing', lineId: 22, name: 'Specific Cruise Pricing' },
    { type: 'availability', lineId: 22, name: 'Availability Change' },
    { type: 'batch', lineId: 22, name: 'Batch Update' }
  ];

  for (const test of tests) {
    console.log(`\n📌 Test: ${test.name}`);
    console.log('-----------------------------------');

    const payload = createWebhookPayload(test.type, test.lineId);
    const endpoint = `/api/webhooks/traveltek/${test.type.replace('_', '-')}-updated`;

    try {
      await sendWebhook(payload, endpoint);
      console.log(`✅ ${test.name} completed`);
    } catch (error) {
      console.log(`❌ ${test.name} failed: ${error.message}`);
    }

    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n✅ Comprehensive test suite completed!');
}

// Run the appropriate test
if (args.includes('--comprehensive')) {
  runComprehensiveTest().catch(console.error);
} else {
  runWebhookTest().catch(console.error);
}

// Help text
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Traveltek Webhook Test Script
==============================

Usage:
  node scripts/test-webhook-traveltek.js [lineId] [environment] [type]

Arguments:
  lineId      - Cruise line ID (default: 22 for Royal Caribbean)
  environment - staging, production, or local (default: staging)
  type        - pricing, cruise_pricing, availability, batch (default: pricing)

Options:
  --comprehensive  Run all test types
  --help          Show this help message

Examples:
  node scripts/test-webhook-traveltek.js                    # Test line 22 on staging
  node scripts/test-webhook-traveltek.js 3 production       # Test Celebrity on production
  node scripts/test-webhook-traveltek.js 22 staging batch   # Test batch update
  node scripts/test-webhook-traveltek.js --comprehensive    # Run all tests

Available Cruise Lines:
  3  - Celebrity Cruises
  17 - Carnival Cruise Line
  22 - Royal Caribbean (default)
  14 - Princess Cruises
  26 - Norwegian Cruise Line
  `);
  process.exit(0);
}
