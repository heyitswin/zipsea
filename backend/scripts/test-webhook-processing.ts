#!/usr/bin/env tsx

/**
 * Test Webhook Processing
 * 
 * This script tests that webhook jobs are properly processed by workers
 */

import { realtimeWebhookService } from '../src/services/realtime-webhook.service';
import { slackService } from '../src/services/slack.service';

async function main() {
  console.log('🧪 Testing webhook processing...\n');

  try {
    // Test payload that simulates a Traveltek webhook
    const testPayload = {
      event: 'cruiseline_pricing_updated',
      lineid: 5, // Princess Cruises - should have cruises
      marketid: 0,
      currency: 'USD',
      description: 'TEST: Webhook processing fix verification',
      source: 'test_verification',
      timestamp: Math.floor(Date.now() / 1000)
    };

    console.log('📤 Sending test webhook...');
    console.log(`Payload: ${JSON.stringify(testPayload, null, 2)}`);

    // Process the webhook
    const result = await realtimeWebhookService.processWebhook(testPayload);
    
    console.log(`\n✅ Webhook queued successfully!`);
    console.log(`├─ Job ID: ${result.jobId}`);
    console.log(`└─ Message: ${result.message}`);

    console.log('\n⏳ Waiting 30 seconds for processing to complete...');
    
    // Wait a bit for processing
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    console.log('\n🎯 If the fix worked, you should see:');
    console.log('├─ Log messages about webhook processing in the server console');
    console.log('├─ A Slack notification about the processing results');
    console.log('└─ No "job stalled" errors');
    
    console.log('\n📊 Check Slack channel for the notification!');
    
    // Also send a direct test Slack message to confirm Slack is working
    try {
      await slackService.notifyCustomMessage({
        title: '🧪 Webhook Processing Test',
        message: 'This is a test message to confirm webhook workers are now running',
        details: {
          testJobId: result.jobId,
          timestamp: new Date().toISOString(),
          note: 'If you see this message, the webhook processing fix is working!'
        }
      });
      console.log('✅ Test Slack notification sent!');
    } catch (slackError) {
      console.log('⚠️  Slack test failed:', slackError);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
  
  console.log('\n🔚 Test completed. Check server logs and Slack for results.');
  process.exit(0);
}

main().catch(console.error);