const { WebhookProcessorFixed } = require('./dist/services/webhook-processor-fixed.service');

async function test() {
  try {
    console.log('Creating WebhookProcessorFixed instance...');
    const processor = new WebhookProcessorFixed();
    console.log('Instance created successfully');

    // Test if we can call the method (it will fail but we'll see where)
    console.log('Attempting to process webhooks...');
    await processor.processWebhooks(14);
    console.log('Processing completed');
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
  process.exit(0);
}

test();
