#!/usr/bin/env node

/**
 * Enhanced Webhook Testing Script
 * Tests the reactivated Traveltek webhook system with various scenarios
 */

const axios = require('axios');
const { setTimeout } = require('timers/promises');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const WEBHOOK_URL = `${BASE_URL}/api/webhooks/traveltek`;

console.log('🧪 Enhanced Traveltek Webhook Testing');
console.log('=====================================');
console.log(`Base URL: ${BASE_URL}`);
console.log();

// Test scenarios
const testScenarios = [
  {
    name: '1. Cruise Line Pricing Update (Royal Caribbean)',
    endpoint: `${WEBHOOK_URL}/cruiseline-pricing-updated`,
    payload: {
      event: 'cruiseline_pricing_updated',
      lineid: 7, // Royal Caribbean
      marketid: 0,
      currency: 'USD',
      description: 'Royal Caribbean pricing updated',
      source: 'test_webhook',
      timestamp: Math.floor(Date.now() / 1000)
    }
  },
  {
    name: '2. Cruise Line Pricing Update (Norwegian)',
    endpoint: `${WEBHOOK_URL}/cruiseline-pricing-updated`,
    payload: {
      event: 'cruiseline_pricing_updated',
      lineid: 6, // Norwegian
      marketid: 0,
      currency: 'USD',
      description: 'Norwegian Cruise Line pricing updated',
      source: 'test_webhook',
      timestamp: Math.floor(Date.now() / 1000)
    }
  },
  {
    name: '3. Generic Webhook (Cruise Line Update)',
    endpoint: `${WEBHOOK_URL}`,
    payload: {
      event: 'cruiseline_pricing_updated',
      lineid: 5, // Celebrity
      marketid: 0,
      currency: 'USD',
      description: 'Celebrity Cruises pricing updated via generic webhook',
      source: 'test_generic_webhook',
      timestamp: Math.floor(Date.now() / 1000)
    }
  },
  {
    name: '4. Individual Cruise Pricing Update',
    endpoint: `${WEBHOOK_URL}/cruises-pricing-updated`,
    payload: {
      event: 'cruises_pricing_updated',
      cruiseIds: [123456, 123457, 123458],
      currency: 'USD',
      description: 'Individual cruise pricing updated',
      source: 'test_webhook',
      timestamp: Math.floor(Date.now() / 1000)
    }
  },
  {
    name: '5. Live Pricing Update (Generic)',
    endpoint: `${WEBHOOK_URL}`,
    payload: {
      event: 'cruises_live_pricing_updated',
      currency: 'USD',
      marketid: 0,
      paths: [
        '2025/09/7/231/8734921.json',
        '2025/09/7/231/8734922.json',
        '2025/09/7/231/8734923.json'
      ],
      description: 'Live pricing updated for multiple cruises',
      source: 'test_webhook',
      timestamp: Math.floor(Date.now() / 1000)
    }
  },
  {
    name: '6. Invalid Webhook (Missing lineId)',
    endpoint: `${WEBHOOK_URL}/cruiseline-pricing-updated`,
    payload: {
      event: 'cruiseline_pricing_updated',
      // Missing lineid
      marketid: 0,
      currency: 'USD',
      description: 'Invalid webhook test',
      source: 'test_webhook',
      timestamp: Math.floor(Date.now() / 1000)
    }
  },
  {
    name: '7. Unknown Event Type',
    endpoint: `${WEBHOOK_URL}`,
    payload: {
      event: 'unknown_event_type',
      lineid: 7,
      data: 'Some unknown data',
      source: 'test_webhook',
      timestamp: Math.floor(Date.now() / 1000)
    }
  }
];

async function testWebhook(scenario) {
  console.log(`\n🔬 Testing: ${scenario.name}`);
  console.log('-'.repeat(50));
  
  try {
    const startTime = Date.now();
    const response = await axios.post(scenario.endpoint, scenario.payload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Zipsea-Webhook-Test/1.0'
      },
      timeout: 10000 // 10 second timeout
    });
    
    const responseTime = Date.now() - startTime;
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`⏱️ Response Time: ${responseTime}ms`);
    console.log(`📝 Response:`, JSON.stringify(response.data, null, 2));
    
    return {
      success: true,
      status: response.status,
      responseTime,
      data: response.data
    };
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Data:`, JSON.stringify(error.response.data, null, 2));
    }
    
    return {
      success: false,
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    };
  }
}

async function testHealthEndpoints() {
  console.log('\n🏥 Testing Health Endpoints');
  console.log('============================');
  
  const healthEndpoints = [
    { name: 'Health Check', url: `${WEBHOOK_URL}/health` },
    { name: 'Status Dashboard', url: `${WEBHOOK_URL}/status` },
    { name: 'Status Dashboard (7 days)', url: `${WEBHOOK_URL}/status?days=7&limit=10` }
  ];
  
  for (const endpoint of healthEndpoints) {
    try {
      console.log(`\n📊 ${endpoint.name}: ${endpoint.url}`);
      const response = await axios.get(endpoint.url, { timeout: 5000 });
      console.log(`✅ Status: ${response.status}`);
      console.log(`📈 Data:`, JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

async function runTests() {
  console.log('🚀 Starting Webhook Tests...\n');
  
  const results = [];
  
  // Test all webhook scenarios
  for (const scenario of testScenarios) {
    const result = await testWebhook(scenario);
    results.push({ scenario: scenario.name, ...result });
    
    // Wait between tests to avoid overwhelming the server
    await setTimeout(1000);
  }
  
  // Test health endpoints
  await testHealthEndpoints();
  
  // Summary
  console.log('\n📊 TEST SUMMARY');
  console.log('================');
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ Successful: ${successful}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   • ${r.scenario}: ${r.error}`);
    });
  }
  
  const avgResponseTime = results
    .filter(r => r.responseTime)
    .reduce((acc, r) => acc + r.responseTime, 0) / results.length;
    
  if (avgResponseTime) {
    console.log(`⏱️ Average Response Time: ${Math.round(avgResponseTime)}ms`);
  }
  
  console.log('\n✨ Testing Complete!');
  
  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Handle errors
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the tests
runTests().catch(console.error);