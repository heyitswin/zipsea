#!/usr/bin/env node

/**
 * Simulate the cruise line 21 webhook that came in earlier
 * This will test the entire flow without waiting for Traveltek
 */

const https = require('https');

// The webhook payload that Traveltek sent for line 21
const webhookPayload = {
  event: 'cruiseline_pricing_updated',
  lineid: 21,
  timestamp: Math.floor(Date.now() / 1000),
  description: 'Cruise line 21 pricing updated',
  source: 'simulated_webhook',
  currency: 'USD'
};

function sendWebhook(url) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const postData = JSON.stringify(webhookPayload);
    
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 30000
    };

    console.log(`📤 Sending webhook to ${url}`);
    console.log('Payload:', JSON.stringify(webhookPayload, null, 2));
    console.log('');

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`Response Status: ${res.statusCode}`);
        console.log('Response Body:', data);
        
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log('\n✅ Webhook accepted successfully!');
          resolve({ statusCode: res.statusCode, body: data });
        } else {
          console.log(`\n❌ Webhook failed with status ${res.statusCode}`);
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
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
    
    req.write(postData);
    req.end();
  });
}

async function monitorResults() {
  console.log('\n📊 Monitoring Results...\n');
  console.log('The webhook should trigger the following flow:');
  console.log('1. Webhook marks cruises as needs_price_update = true');
  console.log('2. Creates placeholder cruise if none exist');
  console.log('3. Next cron job (within 5 minutes) will process');
  console.log('4. Batch sync downloads all files from FTP');
  console.log('5. Creates/updates cruise records');
  console.log('');
  console.log('To check pending updates:');
  console.log('curl https://zipsea-production.onrender.com/api/admin/pending-syncs | jq');
  console.log('');
  console.log('To manually trigger batch sync (instead of waiting for cron):');
  console.log('curl -X POST https://zipsea-production.onrender.com/api/admin/trigger-batch-sync | jq');
  console.log('');
  console.log('Watch the logs at: https://dashboard.render.com');
}

async function main() {
  const environment = process.argv[2] || 'production';
  
  let webhookUrl;
  if (environment === 'staging') {
    webhookUrl = 'https://zipsea-backend.onrender.com/api/webhooks/traveltek';
  } else {
    webhookUrl = 'https://zipsea-production.onrender.com/api/webhooks/traveltek';
  }
  
  console.log('🚀 Simulating Traveltek Webhook for Cruise Line 21');
  console.log('=' .repeat(60));
  console.log(`Environment: ${environment}`);
  console.log(`Webhook URL: ${webhookUrl}`);
  console.log('=' .repeat(60));
  console.log('');
  
  try {
    await sendWebhook(webhookUrl);
    await monitorResults();
  } catch (error) {
    console.error('\n❌ Simulation failed:', error.message);
    process.exit(1);
  }
}

main();