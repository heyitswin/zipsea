#!/usr/bin/env node

const Redis = require('ioredis');
const { Queue } = require('bullmq');

async function checkWebhookStatus() {
  console.log('🔍 Webhook Queue Status Check');
  console.log('==============================\n');

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
    // Check Redis connection
    const ping = await redis.ping();
    console.log(`✅ Redis Connected: ${ping}\n`);

    // Check webhook-v2-processing queue
    const queue = new Queue('webhook-v2-processing', {
      connection: redis
    });

    // Get queue stats
    const waiting = await queue.getWaitingCount();
    const active = await queue.getActiveCount();
    const completed = await queue.getCompletedCount();
    const failed = await queue.getFailedCount();
    const delayed = await queue.getDelayedCount();
    const paused = await queue.isPaused();

    console.log('📊 Queue Statistics:');
    console.log(`  Status: ${paused ? '⏸️  PAUSED' : '▶️  RUNNING'}`);
    console.log(`  Waiting: ${waiting}`);
    console.log(`  Active: ${active}`);
    console.log(`  Completed: ${completed}`);
    console.log(`  Failed: ${failed}`);
    console.log(`  Delayed: ${delayed}`);
    console.log();

    // Get recent jobs
    console.log('📋 Recent Jobs:');

    // Get active jobs
    const activeJobs = await queue.getActive(0, 5);
    if (activeJobs.length > 0) {
      console.log('\n  Active Jobs:');
      for (const job of activeJobs) {
        const duration = Date.now() - job.timestamp;
        console.log(`    - Job ${job.id}: Line ${job.data.cruiseLineId}, Duration: ${Math.round(duration/1000)}s`);
      }
    }

    // Get waiting jobs
    const waitingJobs = await queue.getWaiting(0, 5);
    if (waitingJobs.length > 0) {
      console.log('\n  Waiting Jobs:');
      for (const job of waitingJobs) {
        const age = Date.now() - job.timestamp;
        console.log(`    - Job ${job.id}: Line ${job.data.cruiseLineId}, Age: ${Math.round(age/1000)}s`);
      }
    }

    // Get failed jobs
    const failedJobs = await queue.getFailed(0, 5);
    if (failedJobs.length > 0) {
      console.log('\n  Recent Failed Jobs:');
      for (const job of failedJobs) {
        console.log(`    - Job ${job.id}: Line ${job.data.cruiseLineId}`);
        if (job.failedReason) {
          console.log(`      Error: ${job.failedReason.substring(0, 100)}...`);
        }
      }
    }

    // Check for stuck jobs
    if (active > 0) {
      const oldestActive = activeJobs[0];
      if (oldestActive) {
        const duration = Date.now() - oldestActive.timestamp;
        if (duration > 600000) { // 10 minutes
          console.log('\n⚠️  WARNING: Active job running for over 10 minutes!');
          console.log(`  Job ${oldestActive.id} has been running for ${Math.round(duration/60000)} minutes`);
        }
      }
    }

    // Check worker status
    console.log('\n🔧 Worker Status:');
    const workers = await queue.getWorkers();
    if (workers && workers.length > 0) {
      console.log(`  Active Workers: ${workers.length}`);
    } else {
      console.log('  ❌ No active workers detected!');
      console.log('  The webhook processor service may need to be restarted.');
    }

    // Check FTP connection pool (if exists)
    const ftpPoolKey = 'webhook:ftp:pool:status';
    const ftpStatus = await redis.get(ftpPoolKey);
    if (ftpStatus) {
      console.log('\n🔌 FTP Pool Status:');
      console.log(`  ${ftpStatus}`);
    }

    await queue.close();
  } catch (error) {
    console.error('❌ Error checking webhook status:', error.message);
  } finally {
    await redis.quit();
  }
}

checkWebhookStatus().catch(console.error);
