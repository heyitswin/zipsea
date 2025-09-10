#!/usr/bin/env node

/**
 * Script to stop/clear the webhook processing queue
 * Use this to stop in-progress webhook syncs
 */

require('dotenv').config();
const Redis = require('ioredis');
const { Queue } = require('bullmq');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function stopWebhookQueue() {
  console.log('🛑 Stopping Webhook Queue Processing');
  console.log('='.repeat(50));

  const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  try {
    // Connect to the webhook queue
    const queue = new Queue('webhook-v2-processing', {
      connection: redis,
    });

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

    if (waiting > 0 || active > 0) {
      console.log('\n⏸️  Stopping queue...');

      // Pause the queue to prevent new jobs from being processed
      await queue.pause();
      console.log('✅ Queue paused');

      // Get all waiting jobs and remove them
      if (waiting > 0) {
        const waitingJobs = await queue.getWaiting(0, waiting);
        console.log(`\n🗑️  Removing ${waitingJobs.length} waiting jobs...`);

        for (const job of waitingJobs) {
          await job.remove();
        }
        console.log('✅ Waiting jobs removed');
      }

      // Get active jobs (these are currently being processed)
      if (active > 0) {
        const activeJobs = await queue.getActive(0, active);
        console.log(`\n⚠️  Found ${activeJobs.length} active jobs`);
        console.log('   Note: Active jobs will complete their current operation');
        console.log('   To force stop, you may need to restart the backend service');

        // Optionally move active jobs to failed
        const forceStop = process.argv.includes('--force');
        if (forceStop) {
          console.log('\n🔴 Force stopping active jobs...');
          let stoppedCount = 0;
          for (const job of activeJobs) {
            try {
              // Try to remove the job directly
              await job.remove();
              stoppedCount++;
            } catch (error) {
              // If remove fails, try to fail it
              try {
                await job.moveToFailed(new Error('Force stopped by admin'), false);
                stoppedCount++;
              } catch (moveError) {
                console.log(`   ⚠️  Could not stop job ${job.id} - it may be locked by worker`);
              }
            }
          }
          if (stoppedCount > 0) {
            console.log(`✅ Stopped ${stoppedCount} of ${activeJobs.length} active jobs`);
          }
          if (stoppedCount < activeJobs.length) {
            console.log('\n⚠️  Some jobs could not be stopped because they are locked by workers');
            console.log('   To fully stop all processing:');
            console.log('   1. Kill the worker processes: pkill -f "node.*worker"');
            console.log('   2. Or restart the backend service on Render');
          }
        }
      }

      // Clear completed and failed jobs if requested
      if (process.argv.includes('--clear-all')) {
        console.log('\n🧹 Clearing all completed and failed jobs...');
        await queue.clean(0, 0, 'completed');
        await queue.clean(0, 0, 'failed');
        console.log('✅ Queue history cleared');
      }

      console.log('\n✅ Queue operations complete!');
      console.log('\n📝 To resume processing, use: node resume-webhook-queue.js');
    } else {
      console.log('\n✅ No active or waiting jobs to stop');
    }

    // Also clear any Redis locks
    console.log('\n🔓 Clearing webhook locks...');
    const keys = await redis.keys('webhook:lock:*');
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`✅ Cleared ${keys.length} webhook locks`);
    } else {
      console.log('✅ No locks to clear');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await redis.quit();
  }
}

// Show usage
if (process.argv.includes('--help')) {
  console.log('Usage: node stop-webhook-queue.js [options]');
  console.log('\nOptions:');
  console.log('  --force       Force stop active jobs (move to failed)');
  console.log('  --clear-all   Clear all completed and failed job history');
  console.log('  --help        Show this help message');
  process.exit(0);
}

// Run the script
stopWebhookQueue().catch(console.error);
