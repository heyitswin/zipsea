import { WebhookProcessorOptimized } from '../dist/services/webhook-processor-optimized.service.js';
import dotenv from 'dotenv';

dotenv.config();

async function testProcessor() {
  console.log('Starting webhook processor test...');

  const processor = new WebhookProcessorOptimized();

  try {
    // Process line 54 (Celebrity Cruises)
    console.log('Processing line 54 (Celebrity Cruises)...');
    await processor.processWebhooks(54);

    console.log('Processing complete!');

    // Give it a moment to finish
    await new Promise(resolve => setTimeout(resolve, 5000));

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testProcessor();
