#!/usr/bin/env node

/**
 * Traveltek Webhook Testing Script
 * Tests webhook endpoints with sample Traveltek payloads
 */

const https = require('https');

const WEBHOOK_URL = process.argv[2] || 'https://zipsea-production.onrender.com/api/webhooks/traveltek';

// Sample Traveltek webhook payloads
const testPayloads = {
  cruiselinePricing: {
    endpoint: '/cruiseline-pricing-updated',
    data: {
      event: 'cruiseline_pricing_updated',
      lineid: 7,
      currency: 'GBP',
      marketid: 1,
      timestamp: new Date().toISOString(),
      description: 'Royal Caribbean pricing updated'
    }
  },
  livePricing: {
    endpoint: '/cruises-live-pricing-updated',
    data: {
      event: 'cruises_live_pricing_updated',
      currency: 'GBP',
      marketid: 1,
      timestamp: new Date().toISOString(),
      paths: [
        '2025/05/7/231/8734921.json',
        '2025/05/7/231/8734922.json'
      ]
    }
  },
  generic: {
    endpoint: '',
    data: {
      event: 'test_webhook',
      timestamp: new Date().toISOString(),
      message: 'Test webhook from monitoring script'
    }
  }
};

function sendWebhook(url, payload) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const data = JSON.stringify(payload);
    
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: responseData
        });
      });
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function testWebhooks() {
  console.log('🔍 Testing Traveltek Webhook Endpoints');
  console.log('=====================================');
  console.log(`Base URL: ${WEBHOOK_URL}`);
  console.log('');
  
  // Test health endpoint
  console.log('1. Testing Health Endpoint...');
  try {
    const healthUrl = WEBHOOK_URL + '/health';
    const response = await sendWebhook(healthUrl.replace('/traveltek', '/traveltek/health'), {});
    console.log(`   ✅ Health check: Status ${response.status}`);
  } catch (error) {
    console.log(`   ❌ Health check failed: ${error.message}`);
  }
  
  // Test each webhook type
  for (const [name, config] of Object.entries(testPayloads)) {
    console.log(`\n2. Testing ${name} webhook...`);
    const url = WEBHOOK_URL + config.endpoint;
    
    try {
      console.log(`   URL: ${url}`);
      console.log(`   Payload: ${JSON.stringify(config.data, null, 2)}`);
      
      const response = await sendWebhook(url, config.data);
      const body = JSON.parse(response.body);
      
      if (response.status === 200) {
        console.log(`   ✅ Status: ${response.status}`);
        console.log(`   ✅ Success: ${body.success}`);
        console.log(`   ✅ Message: ${body.message}`);
      } else {
        console.log(`   ⚠️ Status: ${response.status}`);
        console.log(`   Response: ${JSON.stringify(body, null, 2)}`);
      }
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
    }
  }
  
  console.log('\n=====================================');
  console.log('✅ Webhook testing complete');
  console.log('');
  console.log('Next steps:');
  console.log('1. Monitor Render logs for incoming Traveltek webhooks');
  console.log('2. Configure FTP credentials when available');
  console.log('3. Run initial data sync');
}

// Run tests
testWebhooks().catch(console.error);