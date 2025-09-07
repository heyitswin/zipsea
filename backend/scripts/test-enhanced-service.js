#!/usr/bin/env node
const { enhancedWebhookService } = require('../dist/services/webhook-enhanced.service');

async function testEnhancedService() {
  console.log('🧪 Testing Enhanced Webhook Service...\n');

  try {
    // Test if the service is properly instantiated
    console.log('1️⃣ Service instantiation:', typeof enhancedWebhookService);
    console.log('   Has processCruiselinePricingUpdate:', typeof enhancedWebhookService.processCruiselinePricingUpdate);

    // Try to call the service with a test payload
    console.log('\n2️⃣ Testing service call with Line 21...');

    const testPayload = {
      eventType: 'cruiseline_pricing_updated',
      lineId: 21,
      timestamp: String(Date.now()),
      webhookId: `test_${Date.now()}`
    };

    console.log('   Payload:', testPayload);
    console.log('\n3️⃣ Calling service (this may take a moment)...');

    // Call the service
    await enhancedWebhookService.processCruiselinePricingUpdate(testPayload);

    console.log('✅ Service call completed successfully!');

  } catch (error) {
    console.error('❌ Service test failed:', error.message);
    console.error('   Stack:', error.stack);

    // Check for specific error types
    if (error.message.includes('Redis')) {
      console.log('\n⚠️ Redis connection issue detected');
      console.log('   Check if REDIS_URL is configured in environment');
    }
    if (error.message.includes('Slack')) {
      console.log('\n⚠️ Slack integration issue detected');
      console.log('   Check if SLACK_WEBHOOK_URL is configured');
    }
    if (error.message.includes('FTP')) {
      console.log('\n⚠️ FTP connection issue detected');
      console.log('   Check FTP credentials in environment');
    }
  }

  process.exit(0);
}

testEnhancedService();
