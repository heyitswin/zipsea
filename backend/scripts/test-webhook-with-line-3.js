#!/usr/bin/env node

/**
 * Test webhook with line ID 3 (which Traveltek sends for Royal Caribbean)
 */

const https = require('https');

const API_URL = 'https://zipsea-production.onrender.com';

function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = `${API_URL}${path}`;
    const parsedUrl = new URL(url);
    
    const postData = body ? JSON.stringify(body) : null;
    
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(postData && { 'Content-Length': Buffer.byteLength(postData) })
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
          resolve({ statusCode: res.statusCode, body: response });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
}

async function testWebhook() {
  console.log('🧪 Testing Webhook with Line ID 3 (Royal Caribbean)');
  console.log('=' .repeat(60));
  console.log('');
  
  try {
    // First, check how many Royal Caribbean cruises we have
    console.log('📊 Checking Royal Caribbean cruises in database...');
    const cruiseCheck = await makeRequest('/api/admin/cruise-lines');
    
    const rcLine = cruiseCheck.body.lines?.find(l => l.name === 'Royal Caribbean');
    if (rcLine) {
      console.log(`Found Royal Caribbean as line ID ${rcLine.id} with ${rcLine.cruise_count} cruises`);
    }
    console.log('');
    
    // Send webhook with line ID 3 (what Traveltek actually sends)
    console.log('📤 Sending webhook with lineid = 3...');
    const webhookPayload = {
      event: 'cruiseline_pricing_updated',
      lineid: 3,  // This is what Traveltek sends for Royal Caribbean
      timestamp: Math.floor(Date.now() / 1000),
      description: 'Royal Caribbean pricing updated',
      source: 'test_webhook',
      currency: 'USD'
    };
    
    console.log('Payload:', JSON.stringify(webhookPayload, null, 2));
    console.log('');
    
    const webhookResponse = await makeRequest('/api/webhooks/traveltek', 'POST', webhookPayload);
    
    console.log(`Response Status: ${webhookResponse.statusCode}`);
    console.log('Response:', webhookResponse.body);
    console.log('');
    
    if (webhookResponse.body.totalCruises === 0) {
      console.log('❌ PROBLEM: Webhook found 0 cruises for line ID 3');
      console.log('This confirms the ID mismatch issue!');
      console.log('');
      console.log('Royal Caribbean is stored as line ID 22 in database');
      console.log('But Traveltek sends line ID 3 in webhooks');
      console.log('So the webhook handler can\'t find any cruises to update!');
    } else {
      console.log(`✅ Found ${webhookResponse.body.totalCruises} cruises to update`);
    }
    
    // Check pending updates
    console.log('');
    console.log('📊 Checking pending updates...');
    const pendingResponse = await makeRequest('/api/admin/pending-syncs');
    console.log('Pending cruises:', pendingResponse.body.summary?.total_pending || 0);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testWebhook();