#!/usr/bin/env node

/**
 * Fix stuck active jobs that are not actually being processed
 * This happens when workers die but jobs remain marked as active
 */

const Redis = require('ioredis');
const { Queue } = require('bullmq');

async function fixStuckJobs() {
  console.log('🔧 Stuck Active Jobs Fixer');
  console.log('===========================\n');

  // Try REDIS_URL first, fall back to REDIS_HOST/PORT
  const redisUrl = process.env.REDIS_URL;
  let redis;

  if (redisUrl) {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  } else if (process.env.REDIS_HOST) {
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  } else {
    console.log('❌ Redis configuration not found (neither REDIS_URL nor REDIS_HOST set)');
    return;
  }

  try {
    const queue = new Queue('webhook-v2-processing', {
      connection: redis,
    });

    // Get current status
    console.log('📊 Initial Queue Status:');
    const waiting = await queue.getWaitingCount();
    const active = await queue.getActiveCount();
    const completed = await queue.getCompletedCount();
    const failed = await queue.getFailedCount();
    const paused = await queue.isPaused();

    console.log(`  Waiting: ${waiting}`);
    console.log(`  Active: ${active}`);
    console.log(`  Completed: ${completed}`);
    console.log(`  Failed: ${failed}`);
    console.log(`  Paused: ${paused}\n`);

    if (active === 0) {
      console.log('✅ No active jobs to check');
      await queue.close();
      await redis.quit();
      return;
    }

    // Get active jobs
    console.log(`🔍 Checking ${active} active jobs...\n`);
    const activeJobs = await queue.getActive();

    const now = Date.now();
    const stuckJobs = [];
    const recentJobs = [];

    for (const job of activeJobs) {
      const duration = now - job.timestamp;
      const durationMin = Math.round(duration / 60000);

      console.log(`Job ${job.id}:`);
      console.log(`  Line ID: ${job.data.cruiseLineId}`);
      console.log(`  Files: ${job.data.files?.length || 0}`);
      console.log(`  Started: ${new Date(job.timestamp).toISOString()}`);
      console.log(`  Duration: ${durationMin} minutes`);
      console.log(`  Attempts: ${job.attemptsMade}/${job.opts.attempts || 3}`);

      // If job is older than 5 minutes, it's likely stuck
      if (duration > 300000) {
        // 5 minutes
        console.log(`  ⚠️  STUCK - Running for ${durationMin} minutes!`);
        stuckJobs.push(job);
      } else {
        console.log(`  ✅ Recently started`);
        recentJobs.push(job);
      }
      console.log();
    }

    if (stuckJobs.length === 0) {
      console.log('✅ No stuck jobs found. All active jobs are recent.\n');

      // Check if there are workers
      const workers = await queue.getWorkers();
      console.log(`🔧 Active Workers: ${workers ? workers.length : 0}`);

      if (!workers || workers.length === 0) {
        console.log('\n⚠️  WARNING: No active workers detected!');
        console.log('The webhook processor may need to be restarted.');
        console.log('\nTo fix: The service needs to be restarted to reinitialize workers.');
      }

      await queue.close();
      await redis.quit();
      return;
    }

    // Fix stuck jobs
    console.log(`\n🔄 Moving ${stuckJobs.length} stuck jobs back to waiting queue...`);

    let movedCount = 0;
    let errorCount = 0;

    for (const job of stuckJobs) {
      try {
        // Move job back to waiting queue
        await job.moveToWaiting();
        movedCount++;
        console.log(`  ✅ Moved job ${job.id} back to waiting`);
      } catch (error) {
        // If moveToWaiting fails, try to remove and re-add
        try {
          const jobData = job.data;
          const jobOpts = job.opts;
          await job.remove();
          await queue.add(job.name || 'webhook-batch', jobData, jobOpts);
          movedCount++;
          console.log(`  ✅ Re-added job ${job.id} to queue`);
        } catch (retryError) {
          errorCount++;
          console.error(`  ❌ Failed to fix job ${job.id}: ${retryError.message}`);
        }
      }
    }

    console.log(`\n✅ Fix Complete!`);
    console.log(`  Successfully fixed: ${movedCount} jobs`);
    if (errorCount > 0) {
      console.log(`  Failed to fix: ${errorCount} jobs`);
    }

    // Check if queue is paused
    if (paused) {
      console.log('\n⚠️  Queue is PAUSED. Resuming...');
      await queue.resume();
      console.log('✅ Queue resumed');
    }

    // Force a worker check
    console.log('\n🔧 Checking worker status...');
    const workers = await queue.getWorkers();

    if (!workers || workers.length === 0) {
      console.log('❌ No active workers!');
      console.log('\n🚨 CRITICAL: The webhook processor service needs to be restarted!');
      console.log('The worker process has died but jobs remain in the queue.');
      console.log(
        '\nThe service will auto-restart on next deployment or can be manually restarted.'
      );
    } else {
      console.log(`✅ ${workers.length} active workers detected`);
    }

    // Final status
    console.log('\n📊 Final Queue Status:');
    const finalWaiting = await queue.getWaitingCount();
    const finalActive = await queue.getActiveCount();
    const finalFailed = await queue.getFailedCount();

    console.log(
      `  Waiting: ${finalWaiting} ${finalWaiting > waiting ? `(+${finalWaiting - waiting})` : ''}`
    );
    console.log(
      `  Active: ${finalActive} ${finalActive < active ? `(-${active - finalActive})` : ''}`
    );
    console.log(`  Failed: ${finalFailed}`);

    if (finalWaiting > 0 && (!workers || workers.length === 0)) {
      console.log('\n⚠️  Jobs are waiting but no workers are running!');
      console.log('The service needs to be restarted to process these jobs.');
    }

    await queue.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await redis.quit();
  }
}

fixStuckJobs().catch(console.error);
