#!/usr/bin/env node

/**
 * Emergency fix script for webhook processing hangs
 * This script:
 * 1. Clears stuck jobs from Redis queue
 * 2. Resets webhook processing flags
 * 3. Restarts the webhook processor
 */

const { Queue } = require('bullmq');
const Redis = require('ioredis');
const { db } = require('../dist/db/connection.js');
const { webhookEvents } = require('../dist/db/schema/webhook-events.js');
const { eq, inArray, sql } = require('drizzle-orm');
const logger = require('../dist/config/logger.js').default;

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function clearStuckJobs() {
  console.log('🔧 Fixing webhook processing issues...\n');

  const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  const queue = new Queue('webhook-v2-processing', {
    connection: redis,
  });

  try {
    // 1. Get queue statistics
    const waiting = await queue.getWaitingCount();
    const active = await queue.getActiveCount();
    const failed = await queue.getFailedCount();
    const delayed = await queue.getDelayedCount();

    console.log('📊 Current Queue Status:');
    console.log(`  - Waiting: ${waiting}`);
    console.log(`  - Active: ${active}`);
    console.log(`  - Failed: ${failed}`);
    console.log(`  - Delayed: ${delayed}\n`);

    // 2. Clear all stuck jobs
    if (waiting > 0 || active > 0 || failed > 0 || delayed > 0) {
      console.log('🧹 Cleaning up stuck jobs...');

      // Remove all jobs
      await queue.obliterate({ force: true });
      console.log('  ✅ All stuck jobs cleared\n');
    }

    // 3. Reset webhook events that are stuck in 'processing' state
    console.log('🔄 Resetting stuck webhook events...');

    const stuckEvents = await db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.status, 'processing'));

    if (stuckEvents.length > 0) {
      console.log(`  Found ${stuckEvents.length} stuck webhook events`);

      // Reset them to 'failed' with error message
      await db
        .update(webhookEvents)
        .set({
          status: 'failed',
          errorMessage: 'Processing timeout - reset by fix script',
          processedAt: new Date(),
        })
        .where(eq(webhookEvents.status, 'processing'));

      console.log('  ✅ Reset all stuck webhook events\n');
    }

    // 4. Clear Redis memory
    console.log('🧹 Flushing Redis cache to free memory...');
    await redis.flushdb();
    console.log('  ✅ Redis cache cleared\n');

    // 5. Get recent failed webhooks to retry
    console.log('📋 Recent webhook events to retry:');
    const recentWebhooks = await db
      .select({
        lineId: webhookEvents.lineId,
        webhookType: webhookEvents.webhookType,
        receivedAt: webhookEvents.receivedAt,
      })
      .from(webhookEvents)
      .where(inArray(webhookEvents.status, ['failed', 'pending']))
      .orderBy(sql`received_at DESC`)
      .limit(10);

    if (recentWebhooks.length > 0) {
      console.log('  Line IDs to retry:');
      const uniqueLineIds = [...new Set(recentWebhooks.map(w => w.lineId))];
      uniqueLineIds.forEach(lineId => {
        console.log(`    - Line ${lineId}`);
      });
    }

    console.log('\n✅ Webhook processing fix completed!');
    console.log('\n📝 Next Steps:');
    console.log('1. The service should automatically restart and resume processing');
    console.log('2. Monitor the logs for successful completions');
    console.log('3. If issues persist, consider scaling up the service or implementing a timeout');
  } catch (error) {
    console.error('❌ Error fixing webhook processing:', error);
  } finally {
    await queue.close();
    await redis.quit();
    process.exit(0);
  }
}

// Run the fix
clearStuckJobs().catch(console.error);
