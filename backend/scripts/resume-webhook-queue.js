#!/usr/bin/env node

/**
 * Script to resume the webhook processing queue
 */

require('dotenv').config();
const Redis = require('ioredis');
const { Queue } = require('bullmq');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function resumeWebhookQueue() {
  console.log('▶️  Resuming Webhook Queue Processing');
  console.log('=' .repeat(50));

  const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  try {
    // Connect to the webhook queue
    const queue = new Queue('webhook-v2-processing', {
      connection: redis,
    });

    // Resume the queue
    await queue.resume();
    console.log('✅ Queue resumed');

    // Get current queue status
    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
    ]);

    console.log('\n📊 Current Queue Status:');
    console.log(`  Waiting: ${waiting}`);
    console.log(`  Active: ${active}`);
    console.log(`  Completed: ${completed}`);
    console.log(`  Failed: ${failed}`);

    if (waiting > 0) {
      console.log(`\n✅ ${waiting} jobs will start processing soon`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await redis.quit();
  }
}

// Run the script
resumeWebhookQueue().catch(console.error);
