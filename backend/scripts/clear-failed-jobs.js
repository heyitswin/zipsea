#!/usr/bin/env node

/**
 * Clear failed jobs from the webhook processing queue
 */

const { Queue } = require('bullmq');
const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function clearFailedJobs() {
  console.log('🧹 Clearing failed jobs from webhook queue...\n');

  const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  const queue = new Queue('webhook-v2-processing', {
    connection: redis,
  });

  try {
    // Get current counts
    const failed = await queue.getFailedCount();
    const active = await queue.getActiveCount();
    const waiting = await queue.getWaitingCount();

    console.log('📊 Current Queue Status:');
    console.log(`  - Failed: ${failed}`);
    console.log(`  - Active: ${active}`);
    console.log(`  - Waiting: ${waiting}\n`);

    if (failed > 0) {
      // Get failed jobs to see what failed
      const failedJobs = await queue.getFailed(0, 10);

      console.log('❌ Failed Jobs (showing first 10):');
      failedJobs.forEach((job, index) => {
        console.log(`  ${index + 1}. Job ${job.id}:`);
        console.log(`     Line ID: ${job.data?.lineId}`);
        console.log(`     Attempts: ${job.attemptsMade}/${job.opts?.attempts || 3}`);
        console.log(`     Failed: ${job.failedReason?.substring(0, 100)}`);
      });

      console.log('\n🗑️  Removing all failed jobs...');
      await queue.clean(0, 1000, 'failed');

      const newFailed = await queue.getFailedCount();
      console.log(`✅ Cleared ${failed - newFailed} failed jobs\n`);
    } else {
      console.log('✅ No failed jobs to clear\n');
    }

    // Also clean up any stalled jobs
    // Note: getStalledCount is not available in current BullMQ version
    // We'll clean stalled jobs differently
    try {
      const stalled = await queue.clean(0, 1000, 'stalled');
      if (stalled && stalled.length > 0) {
        console.log(`⚠️  Cleaned ${stalled.length} stalled jobs`);
      }
    } catch (stalledError) {
      // Ignore if stalled cleaning is not supported
      console.log('Note: Could not clean stalled jobs (feature may not be available)');
    }

    console.log('✨ Queue cleanup completed!');
  } catch (error) {
    console.error('❌ Error clearing failed jobs:', error);
  } finally {
    await queue.close();
    await redis.quit();
    process.exit(0);
  }
}

// Run the cleanup
clearFailedJobs().catch(console.error);
