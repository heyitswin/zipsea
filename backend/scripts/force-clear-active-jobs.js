#!/usr/bin/env node

/**
 * Force clear stuck active jobs from the webhook processing queue
 * Use with caution - this will terminate jobs that are currently processing
 */

const { Queue } = require('bullmq');
const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function forceClearActiveJobs() {
  console.log('⚠️  Force clearing stuck active jobs...\n');

  const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  const queue = new Queue('webhook-v2-processing', {
    connection: redis,
  });

  try {
    // Get current counts
    const active = await queue.getActiveCount();
    const waiting = await queue.getWaitingCount();
    const failed = await queue.getFailedCount();

    console.log('📊 Current Queue Status:');
    console.log(`  - Active: ${active}`);
    console.log(`  - Waiting: ${waiting}`);
    console.log(`  - Failed: ${failed}\n`);

    if (active > 0) {
      // Get active jobs
      const activeJobs = await queue.getActive();

      console.log(`⚠️  Found ${activeJobs.length} active jobs:`);

      for (const job of activeJobs) {
        console.log(`\n  Job ${job.id}:`);
        console.log(`    Line ID: ${job.data?.lineId}`);
        console.log(`    Files: ${job.data?.files?.length || 0}`);
        console.log(`    Progress: ${await job.progress}%`);
        console.log(`    Started: ${new Date(job.processedOn || 0).toISOString()}`);

        // Move job to failed state
        try {
          await job.moveToFailed(new Error('Force cleared due to stuck state'), '0', false);
          console.log(`    ✅ Moved to failed state`);
        } catch (moveError) {
          console.log(`    ❌ Could not move job: ${moveError.message}`);
          // Try to remove it completely
          try {
            await job.remove();
            console.log(`    ✅ Removed job completely`);
          } catch (removeError) {
            console.log(`    ❌ Could not remove job: ${removeError.message}`);
          }
        }
      }

      // Clean up any remaining active jobs
      console.log('\n🧹 Cleaning up queue...');
      await queue.clean(0, 1000, 'active');

      // Obliterate the queue to force clean everything
      console.log('🔨 Force obliterating stuck jobs...');
      await queue.obliterate({ force: true });

      const newActive = await queue.getActiveCount();
      console.log(`\n✅ Active jobs after cleanup: ${newActive}`);
    } else {
      console.log('✅ No active jobs to clear');
    }

    // Also check for any stuck workers
    const workers = await queue.getWorkers();
    if (workers && workers.length > 0) {
      console.log(`\n⚠️  Found ${workers.length} workers, checking status...`);
      for (const worker of workers) {
        console.log(`  Worker: ${worker.id || worker}`);
      }
    }

    console.log('\n✨ Force cleanup completed!');
    console.log('\n📝 Next steps:');
    console.log('  1. Restart the backend service to reset workers');
    console.log('  2. Monitor for new webhook processing');
    console.log('  3. Consider implementing job timeouts in the worker');

  } catch (error) {
    console.error('❌ Error clearing active jobs:', error);
  } finally {
    await queue.close();
    await redis.quit();
    process.exit(0);
  }
}

// Run the cleanup
forceClearActiveJobs().catch(console.error);
