#!/usr/bin/env node

/**
 * Test script for bulk FTP downloader integration
 * This simulates a webhook to test the end-to-end bulk download flow
 */

const http = require('http');

// Test webhook payload
const testWebhookPayload = {
  event: 'cruiseline_pricing_updated',
  lineid: 22, // Royal Caribbean - good test case
  timestamp: new Date().toISOString(),
  data: {
    message: 'Test bulk FTP integration',
    source: 'integration_test'
  }
};

console.log('🧪 Testing bulk FTP downloader integration...');
console.log('📋 Test webhook payload:', JSON.stringify(testWebhookPayload, null, 2));

// Create HTTP request to webhook endpoint
const postData = JSON.stringify(testWebhookPayload);

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('🚀 Sending test webhook to http://localhost:3001/api/webhook...');

const req = http.request(options, (res) => {
  console.log(`📊 Response status: ${res.statusCode}`);
  console.log(`📊 Response headers:`, res.headers);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('📨 Response body:', data);
    
    if (res.statusCode === 200) {
      console.log('✅ Test webhook sent successfully!');
      console.log('🔍 Check the backend logs to see bulk FTP downloader in action');
      console.log('📱 Check Slack for bulk processing notifications');
    } else {
      console.log('❌ Test webhook failed');
    }
  });
});

req.on('error', (e) => {
  console.error(`❌ Request error: ${e.message}`);
  console.log('💡 Make sure the backend server is running on port 3001');
});

// Send the webhook
req.write(postData);
req.end();