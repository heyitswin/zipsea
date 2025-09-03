#!/usr/bin/env node

/**
 * Test webhook processing internally
 * This bypasses external security and tests the actual processing
 */

require('dotenv').config();

// Import the service directly
const { realtimeWebhookService } = require('../dist/services/realtime-webhook.service');
const { slackService } = require('../dist/services/slack.service');

async function testInternally() {
  console.log('🧪 Testing webhook processing internally...\n');

  // Check if service is initialized
  if (!realtimeWebhookService) {
    console.log('❌ Realtime webhook service not found!');
    console.log('Make sure the app has been built and the service exists.');
    process.exit(1);
  }

  console.log('✅ Realtime webhook service found');

  // Create a test webhook payload
  const testPayload = {
    lineid: 5,
    currency: 'USD',
    event: 'cruiseline_pricing_updated',
    timestamp: Date.now(),
    description: 'Internal test webhook'
  };

  const webhookId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  console.log('📦 Test webhook payload:');
  console.log(JSON.stringify(testPayload, null, 2));
  console.log('\n🚀 Queueing webhook for processing...');

  try {
    // Queue the webhook directly
    const job = await realtimeWebhookService.queueWebhook({
      webhookId,
      eventType: 'cruiseline_pricing_updated',
      lineId: testPayload.lineid,
      payload: testPayload,
      timestamp: new Date().toISOString()
    });

    console.log('✅ Webhook queued successfully!');
    console.log(`Job ID: ${job.id}`);
    console.log(`Webhook ID: ${webhookId}`);
    
    console.log('\n📊 Checking queue status...');
    const stats = await realtimeWebhookService.getQueueStats();
    console.log('Queue stats:', JSON.stringify(stats, null, 2));

    console.log('\n🔔 Testing Slack notification...');
    const slackTest = await slackService.notifyCustomMessage({
      title: '🧪 Internal Webhook Test',
      message: `Testing webhook processing for Line ${testPayload.lineid}`,
      details: {
        webhookId,
        lineId: testPayload.lineid,
        testType: 'internal',
        timestamp: new Date().toISOString()
      }
    });

    if (slackTest) {
      console.log('✅ Slack notification sent!');
    } else {
      console.log('⚠️ Slack notification might have failed');
    }

    console.log('\n✅ Internal test complete!');
    console.log('Check Slack for processing notifications.');
    console.log('The webhook should be processed within 30 seconds.');
    
    // Wait a bit to let processing start
    setTimeout(() => {
      process.exit(0);
    }, 3000);

  } catch (error) {
    console.error('❌ Error during internal test:', error);
    process.exit(1);
  }
}

// Run the test
testInternally();