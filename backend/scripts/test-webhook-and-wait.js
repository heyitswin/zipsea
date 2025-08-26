#!/usr/bin/env node

/**
 * Test webhook and wait for processing
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

async function testWebhookFlow() {
  console.log('🧪 Testing Complete Webhook Flow with Mapping Fix');
  console.log('=' .repeat(60));
  console.log('');
  
  try {
    // Check initial state
    console.log('📊 Step 1: Checking initial pending updates...');
    let pendingResponse = await makeRequest('/api/admin/pending-syncs');
    console.log(`Initial pending: ${pendingResponse.body.summary?.total_pending || 0} cruises`);
    console.log('');
    
    // Send webhook with line ID 3 (what Traveltek sends for Royal Caribbean)
    console.log('📤 Step 2: Sending webhook with lineid = 3 (Royal Caribbean)...');
    const webhookPayload = {
      event: 'cruiseline_pricing_updated',
      lineid: 3,  // This should map to database ID 22
      timestamp: Math.floor(Date.now() / 1000),
      description: 'Royal Caribbean pricing updated (mapping test)',
      source: 'test_mapping',
      currency: 'USD'
    };
    
    const webhookResponse = await makeRequest('/api/webhooks/traveltek', 'POST', webhookPayload);
    console.log(`Webhook response: ${webhookResponse.body.message}`);
    console.log(`Webhook ID: ${webhookResponse.body.webhookId}`);
    console.log('');
    
    // Wait for async processing
    console.log('⏳ Step 3: Waiting 5 seconds for async processing...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('');
    
    // Check if cruises were marked
    console.log('📊 Step 4: Checking if cruises were marked as pending...');
    pendingResponse = await makeRequest('/api/admin/pending-syncs');
    const pendingCount = pendingResponse.body.summary?.total_pending || 0;
    
    if (pendingCount > 0) {
      console.log(`✅ SUCCESS! ${pendingCount} cruises marked for update!`);
      
      if (pendingResponse.body.byLine && pendingResponse.body.byLine.length > 0) {
        console.log('By line:');
        pendingResponse.body.byLine.forEach(line => {
          console.log(`  - Line ${line.cruise_line_id}: ${line.count} cruises`);
        });
      }
      
      console.log('');
      console.log('🎉 The mapping fix is working!');
      console.log('Webhook line ID 3 → Database line ID 22 (Royal Caribbean)');
    } else {
      console.log('❌ No cruises were marked as pending');
      console.log('The mapping might not be working correctly');
      console.log('');
      
      // Check if line 22 has cruises
      const lines = await makeRequest('/api/admin/cruise-lines');
      const line22 = lines.body.lines?.find(l => l.id === 22);
      if (line22) {
        console.log(`Line 22 (${line22.name}) has ${line22.cruise_count} cruises`);
        console.log('But webhook didn\'t mark them for update');
      }
    }
    
    console.log('');
    console.log('=' .repeat(60));
    console.log('✅ Test completed');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testWebhookFlow();