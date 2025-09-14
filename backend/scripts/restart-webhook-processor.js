#!/usr/bin/env node

/**
 * Restart the webhook processor service
 * This clears stuck jobs and reinitializes the FTP connection pool
 */

const Redis = require('ioredis');
const { Queue } = require('bullmq');

async function restartWebhookProcessor() {
  console.log('🔄 Webhook Processor Restart Tool');
  console.log('==================================\n');

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log('❌ REDIS_URL not set');
    return;
  }

  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  });

  try {
    console.log('1️⃣  Checking current queue status...');
    const queue = new Queue('webhook-v2-processing', {
      connection: redis
    });

    const active = await queue.getActiveCount();
    const waiting = await queue.getWaitingCount();
    const failed = await queue.getFailedCount();

    console.log(`   Active: ${active}, Waiting: ${waiting}, Failed: ${failed}\n`);

    // Clear stuck active jobs
    if (active > 0) {
      console.log('2️⃣  Moving stuck active jobs back to waiting...');
      const activeJobs = await queue.getActive();
      for (const job of activeJobs) {
        const duration = Date.now() - job.timestamp;
        if (duration > 300000) { // 5 minutes
          console.log(`   Moving job ${job.id} (${Math.round(duration/60000)} min old) back to queue`);
          await job.moveToWaiting();
        }
      }
    }

    // Retry failed jobs
    console.log('3️⃣  Retrying failed jobs...');
    const failedJobs = await queue.getFailed(0, 100);
    let retriedCount = 0;
    for (const job of failedJobs) {
      // Check if it's an FTP connection error
      if (job.failedReason && job.failedReason.includes('ECONNREFUSED')) {
        await job.retry();
        retriedCount++;
      }
    }
    console.log(`   Retried ${retriedCount} failed jobs\n`);

    // Clear FTP pool status
    console.log('4️⃣  Clearing FTP connection pool cache...');
    const ftpKeys = await redis.keys('webhook:ftp:*');
    if (ftpKeys.length > 0) {
      await redis.del(...ftpKeys);
      console.log(`   Cleared ${ftpKeys.length} FTP cache keys\n`);
    }

    // Resume queue if paused
    const isPaused = await queue.isPaused();
    if (isPaused) {
      console.log('5️⃣  Resuming paused queue...');
      await queue.resume();
      console.log('   Queue resumed\n');
    }

    // Force restart the webhook processor
    console.log('6️⃣  Triggering webhook processor restart...');
    console.log('   The webhook processor will reinitialize on next request.\n');

    // Set a flag to force reinit
    await redis.set('webhook:processor:needs_restart', '1', 'EX', 60);

    console.log('✅ Webhook processor restart initiated!');
    console.log('\nNext steps:');
    console.log('1. The processor will reinitialize its FTP connection pool');
    console.log('2. Failed jobs will be retried');
    console.log('3. Monitor logs for successful processing');

    // Final status
    console.log('\n📊 Final Queue Status:');
    const finalActive = await queue.getActiveCount();
    const finalWaiting = await queue.getWaitingCount();
    const finalFailed = await queue.getFailedCount();
    console.log(`   Active: ${finalActive}, Waiting: ${finalWaiting}, Failed: ${finalFailed}`);

    await queue.close();
  } catch (error) {
    console.error('❌ Error restarting webhook processor:', error.message);
  } finally {
    await redis.quit();
  }
}

restartWebhookProcessor().catch(console.error);
