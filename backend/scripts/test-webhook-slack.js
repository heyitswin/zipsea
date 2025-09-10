#!/usr/bin/env node

/**
 * Test script to verify webhook processor with accurate Slack notifications
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const { getWebhookProcessorSimple } = require('../dist/services/webhook-processor-simple.service');

async function testWebhookProcessing() {
  console.log('='.repeat(60));
  console.log('Testing Webhook Processor with Accurate Slack Notifications');
  console.log('='.repeat(60));

  const processor = getWebhookProcessorSimple();

  // Test with a small line that has data
  const testLineId = 10; // Line 10 has data based on previous tests

  try {
    console.log(`\n📝 Testing webhook for Line ${testLineId}`);
    console.log('Check Slack for notifications...\n');

    await processor.processWebhooks(testLineId);

    console.log('\n✅ Webhook processing completed successfully');
    console.log('Check Slack for the complete notification flow:');
    console.log('1. Webhook received notification');
    console.log('2. File discovery complete notification');
    console.log('3. Processing start notification');
    console.log('4. Progress updates (25%, 50%, 75%, 100%)');
    console.log('5. Final report with success metrics');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.log('Check Slack for error notification');
  }

  console.log('\n' + '='.repeat(60));
  process.exit(0);
}

// Run the test
testWebhookProcessing().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
