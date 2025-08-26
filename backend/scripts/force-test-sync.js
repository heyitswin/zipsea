#!/usr/bin/env node

/**
 * Force some cruises to need updates for testing
 * This bypasses the webhook and directly marks cruises
 */

const https = require('https');

const API_URL = process.env.API_URL || 'https://zipsea-production.onrender.com';

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

async function forceTestSync() {
  console.log('🧪 Force Test Sync - Testing Batch Processing');
  console.log('=' .repeat(60));
  console.log('');
  
  try {
    // Step 1: Check current state
    console.log('📊 Step 1: Checking current state...');
    const initialPending = await makeRequest('/api/admin/pending-syncs');
    console.log(`Currently pending: ${initialPending.body.summary?.total_pending || 0} cruises`);
    console.log('');
    
    // Step 2: Force mark some cruises (using admin endpoint if it exists)
    // For now, we'll send a webhook for line 3 (which we know has cruises)
    console.log('📤 Step 2: Sending webhook for line 3 (Royal Caribbean)...');
    const webhookPayload = {
      event: 'cruiseline_pricing_updated',
      lineid: 3,  // Line 3 has cruises in the database
      timestamp: Math.floor(Date.now() / 1000),
      description: 'Test sync for line 3',
      source: 'force_test',
      currency: 'USD'
    };
    
    const webhookResponse = await makeRequest('/api/webhooks/traveltek', 'POST', webhookPayload);
    console.log('Webhook response:', webhookResponse.body.message || 'Processed');
    console.log('');
    
    // Step 3: Check pending after webhook
    console.log('📊 Step 3: Checking pending updates...');
    const afterWebhook = await makeRequest('/api/admin/pending-syncs');
    const pendingCount = afterWebhook.body.summary?.total_pending || 0;
    
    if (pendingCount > 0) {
      console.log(`✅ ${pendingCount} cruises marked for update!`);
      
      if (afterWebhook.body.byLine) {
        console.log('By line:');
        afterWebhook.body.byLine.forEach(line => {
          console.log(`  - Line ${line.cruise_line_id}: ${line.count} cruises`);
        });
      }
      console.log('');
      
      // Step 4: Trigger batch sync
      console.log('🔄 Step 4: Triggering batch sync...');
      const syncResponse = await makeRequest('/api/admin/trigger-batch-sync', 'POST');
      
      if (syncResponse.body.pendingLines > 0) {
        console.log(`✅ Batch sync triggered for ${syncResponse.body.pendingLines} line(s)`);
        console.log('');
        console.log('⏳ Processing in background...');
        console.log('The batch sync will:');
        console.log('  1. Download files from FTP for each cruise line');
        console.log('  2. Match files to database records');
        console.log('  3. Update prices');
        console.log('  4. Create price history records');
        console.log('');
        console.log('Monitor at: https://dashboard.render.com');
      } else {
        console.log('No lines to process');
      }
    } else {
      console.log('⚠️ No cruises were marked for update');
      console.log('This might mean:');
      console.log('  - Line 3 has no cruises in the database');
      console.log('  - The webhook handler is not working correctly');
      console.log('');
      console.log('Try creating test data for line 3:');
      console.log('  1. Use sync-complete-data.js to populate cruises');
      console.log('  2. Or manually insert test cruises');
    }
    
    console.log('');
    console.log('=' .repeat(60));
    console.log('✅ Test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
forceTestSync();