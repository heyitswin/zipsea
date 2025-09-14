#!/usr/bin/env node

/**
 * Retry all failed webhook jobs from the FTP connection outage
 * This will find jobs that failed with ECONNREFUSED and retry them
 */

const Redis = require('ioredis');
const { Queue } = require('bullmq');

async function retryFailedJobs() {
  console.log('🔄 Webhook Failed Jobs Recovery Tool');
  console.log('=====================================\n');

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
    const queue = new Queue('webhook-v2-processing', {
      connection: redis
    });

    // Get current queue status
    console.log('📊 Current Queue Status:');
    const waiting = await queue.getWaitingCount();
    const active = await queue.getActiveCount();
    const completed = await queue.getCompletedCount();
    const failed = await queue.getFailedCount();

    console.log(`  Waiting: ${waiting}`);
    console.log(`  Active: ${active}`);
    console.log(`  Completed: ${completed}`);
    console.log(`  Failed: ${failed}\n`);

    if (failed === 0) {
      console.log('✅ No failed jobs to retry!');
      console.log('The queue is healthy and processing normally.\n');

      if (waiting > 0 || active > 0) {
        console.log(`📈 Progress: ${active} jobs actively processing, ${waiting} in queue`);
      }

      await queue.close();
      await redis.quit();
      return;
    }

    // Get all failed jobs
    console.log(`🔍 Analyzing ${failed} failed jobs...\n`);
    const failedJobs = await queue.getFailed(0, 1000); // Get up to 1000 failed jobs

    // Categorize failures
    const ftpConnectionFailures = [];
    const otherFailures = [];

    for (const job of failedJobs) {
      if (job.failedReason &&
          (job.failedReason.includes('ECONNREFUSED') ||
           job.failedReason.includes('FTP connection failed') ||
           job.failedReason.includes('connect ETIMEDOUT'))) {
        ftpConnectionFailures.push(job);
      } else {
        otherFailures.push(job);
      }
    }

    console.log(`📝 Failed Jobs Breakdown:`);
    console.log(`  FTP Connection Failures: ${ftpConnectionFailures.length}`);
    console.log(`  Other Failures: ${otherFailures.length}\n`);

    if (ftpConnectionFailures.length === 0) {
      console.log('✅ No FTP-related failures found.');
      console.log('All failures appear to be from other causes.\n');

      if (otherFailures.length > 0) {
        console.log('Other failure reasons:');
        const reasons = {};
        for (const job of otherFailures.slice(0, 5)) {
          const reason = job.failedReason ? job.failedReason.substring(0, 80) : 'Unknown';
          reasons[reason] = (reasons[reason] || 0) + 1;
        }
        Object.entries(reasons).forEach(([reason, count]) => {
          console.log(`  - ${reason}... (${count} jobs)`);
        });
      }

      await queue.close();
      await redis.quit();
      return;
    }

    // Retry FTP connection failures
    console.log(`♻️  Retrying ${ftpConnectionFailures.length} FTP-related failed jobs...`);

    let retriedCount = 0;
    let errorCount = 0;

    for (const job of ftpConnectionFailures) {
      try {
        await job.retry();
        retriedCount++;

        // Show progress every 10 jobs
        if (retriedCount % 10 === 0) {
          console.log(`  Progress: ${retriedCount}/${ftpConnectionFailures.length} retried`);
        }
      } catch (error) {
        errorCount++;
        console.error(`  Failed to retry job ${job.id}: ${error.message}`);
      }
    }

    console.log(`\n✅ Retry Complete!`);
    console.log(`  Successfully retried: ${retriedCount} jobs`);
    if (errorCount > 0) {
      console.log(`  Failed to retry: ${errorCount} jobs`);
    }

    // Final status
    console.log('\n📊 Updated Queue Status:');
    const finalWaiting = await queue.getWaitingCount();
    const finalActive = await queue.getActiveCount();
    const finalFailed = await queue.getFailedCount();

    console.log(`  Waiting: ${finalWaiting} ${finalWaiting > waiting ? `(+${finalWaiting - waiting})` : ''}`);
    console.log(`  Active: ${finalActive}`);
    console.log(`  Failed: ${finalFailed} ${finalFailed < failed ? `(-${failed - finalFailed})` : ''}`);

    if (finalWaiting > 0 || finalActive > 0) {
      console.log('\n⏳ Jobs are being processed. Monitor progress with:');
      console.log('   node scripts/check-webhook-queue-status.js');
    }

    await queue.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await redis.quit();
  }
}

retryFailedJobs().catch(console.error);
