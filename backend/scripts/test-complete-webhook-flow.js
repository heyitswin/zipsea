#!/usr/bin/env node

/**
 * Test the complete webhook and batch sync flow
 * This simulates a Traveltek webhook and then triggers the batch sync
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
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
}

async function runCompleteTest() {
  console.log('🧪 Complete Webhook & Batch Sync Flow Test');
  console.log('=' .repeat(60));
  console.log('');

  try {
    // Step 1: Check initial state
    console.log('📊 Step 1: Checking initial pending updates...');
    const initialPending = await makeRequest('/api/admin/pending-syncs');
    console.log(`Initial pending: ${initialPending.body.summary?.total_pending || 0} cruises`);
    console.log('');

    // Step 2: Send webhook
    console.log('📤 Step 2: Simulating Traveltek webhook for line 21...');
    const webhookPayload = {
      event: 'cruiseline_pricing_updated',
      lineid: 21,
      timestamp: Math.floor(Date.now() / 1000),
      description: 'Cruise line 21 pricing updated (test)',
      source: 'test_simulation',
      currency: 'USD'
    };
    
    const webhookResponse = await makeRequest('/api/webhooks/traveltek', 'POST', webhookPayload);
    
    if (webhookResponse.statusCode === 200 || webhookResponse.statusCode === 201) {
      console.log('✅ Webhook processed successfully');
      
      if (typeof webhookResponse.body === 'object') {
        console.log(`  - Total cruises: ${webhookResponse.body.totalCruises || 0}`);
        console.log(`  - Successful: ${webhookResponse.body.successful || 0}`);
        console.log(`  - Failed: ${webhookResponse.body.failed || 0}`);
        
        if (webhookResponse.body.message) {
          console.log(`  - Message: ${webhookResponse.body.message}`);
        }
      }
    } else {
      console.log(`⚠️ Webhook returned status ${webhookResponse.statusCode}`);
    }
    console.log('');

    // Step 3: Check pending updates after webhook
    console.log('📊 Step 3: Checking pending updates after webhook...');
    const afterWebhookPending = await makeRequest('/api/admin/pending-syncs');
    const pendingCount = afterWebhookPending.body.summary?.total_pending || 0;
    console.log(`Pending after webhook: ${pendingCount} cruises`);
    
    if (afterWebhookPending.body.byLine && afterWebhookPending.body.byLine.length > 0) {
      console.log('By cruise line:');
      afterWebhookPending.body.byLine.forEach(line => {
        console.log(`  - Line ${line.cruise_line_id}: ${line.count} cruises`);
      });
    }
    console.log('');

    // Step 4: Trigger batch sync
    console.log('🔄 Step 4: Triggering batch sync...');
    const syncResponse = await makeRequest('/api/admin/trigger-batch-sync', 'POST');
    
    if (syncResponse.body.message === 'No pending price updates') {
      console.log('✅ No pending updates to process');
    } else if (syncResponse.body.message === 'Batch sync triggered') {
      console.log('✅ Batch sync triggered successfully');
      console.log(`  - Processing ${syncResponse.body.pendingLines} cruise line(s)`);
      console.log('');
      console.log('⏳ Batch sync is now running in the background...');
      console.log('  This will:');
      console.log('  1. Download all files from FTP for line 21');
      console.log('  2. Create cruise records if they don\'t exist');
      console.log('  3. Update prices for all cruises');
      console.log('  4. Send Slack notification when complete');
    } else {
      console.log('Response:', syncResponse.body);
    }
    console.log('');

    // Step 5: Wait and check results
    if (pendingCount > 0) {
      console.log('⏳ Step 5: Waiting 15 seconds for processing...');
      await new Promise(resolve => setTimeout(resolve, 15000));
      
      console.log('📊 Checking final state...');
      const finalPending = await makeRequest('/api/admin/pending-syncs');
      const finalCount = finalPending.body.summary?.total_pending || 0;
      
      if (finalCount < pendingCount) {
        console.log(`✅ Successfully processed ${pendingCount - finalCount} cruises!`);
      } else if (finalCount === 0 && pendingCount === 0) {
        console.log('✅ System created placeholder and is ready for sync');
      } else {
        console.log(`⏳ Still ${finalCount} cruises pending (processing may still be running)`);
      }
    }
    
    console.log('');
    console.log('=' .repeat(60));
    console.log('✅ Test completed!');
    console.log('');
    console.log('📝 Notes:');
    console.log('- If line 21 has no cruises, a placeholder was created');
    console.log('- The batch sync will download ALL files from FTP');
    console.log('- New cruises will be created automatically');
    console.log('- Monitor progress at: https://dashboard.render.com');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
runCompleteTest();