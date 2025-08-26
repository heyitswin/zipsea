#!/usr/bin/env node

/**
 * Test webhook with line 21 (should have fewer or no cruises)
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

async function testLine21() {
  console.log('🧪 Testing Webhook with Line 21 (Virgin Voyages)');
  console.log('=' .repeat(60));
  console.log('');
  
  try {
    // Check what's in line 21
    console.log('📊 Checking line 21 in database...');
    const lines = await makeRequest('/api/admin/cruise-lines');
    const line21 = lines.body.lines?.find(l => l.id === 21);
    
    if (line21) {
      console.log(`Line 21: ${line21.name} with ${line21.cruise_count} cruises`);
    } else {
      console.log('Line 21 not found in database');
    }
    console.log('');
    
    // Send webhook for line 21
    console.log('📤 Sending webhook for line 21...');
    const webhookPayload = {
      event: 'cruiseline_pricing_updated',
      lineid: 21,
      timestamp: Math.floor(Date.now() / 1000),
      description: 'Line 21 pricing updated',
      source: 'test_line_21',
      currency: 'USD'
    };
    
    const webhookResponse = await makeRequest('/api/webhooks/traveltek', 'POST', webhookPayload);
    console.log(`Response: ${webhookResponse.body.message}`);
    console.log('');
    
    // Wait and check
    console.log('⏳ Waiting 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('📊 Checking pending updates...');
    const pendingResponse = await makeRequest('/api/admin/pending-syncs');
    const pendingCount = pendingResponse.body.summary?.total_pending || 0;
    
    if (pendingCount > 0) {
      console.log(`✅ ${pendingCount} cruises marked for update`);
      
      if (pendingResponse.body.byLine) {
        pendingResponse.body.byLine.forEach(line => {
          console.log(`  - Line ${line.cruise_line_id}: ${line.count} cruises`);
        });
      }
    } else {
      console.log('❌ No cruises marked');
      console.log('This might mean:');
      console.log('  1. Line 21 has no cruises');
      console.log('  2. Webhook created a placeholder');
      console.log('  3. Processing failed');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testLine21();