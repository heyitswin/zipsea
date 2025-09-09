#!/usr/bin/env node

require('dotenv').config();

async function testWebhookProcessor() {
  console.log('Testing webhook processor directly...\n');

  try {
    // Import the webhook processor
    const { WebhookProcessorOptimized } = require('../dist/services/webhook-processor-optimized.service');

    console.log('Creating webhook processor instance...');
    const processor = new WebhookProcessorOptimized();

    console.log('Calling processWebhooks for line 22...');
    await processor.processWebhooks(22);

    console.log('✅ Webhook processing completed');
  } catch (error) {
    console.error('❌ Webhook processing failed:', error.message);
    console.error('Stack:', error.stack);
  }

  // Give it a moment to finish
  setTimeout(() => {
    console.log('\nExiting...');
    process.exit(0);
  }, 2000);
}

testWebhookProcessor();
