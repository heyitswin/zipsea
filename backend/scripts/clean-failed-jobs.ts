#!/usr/bin/env tsx

/**
 * Clean failed jobs from Redis
 */

import IORedis from 'ioredis';
import { Queue } from 'bullmq';

const REDIS_URL = process.env.REDIS_URL;
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');

async function main() {
  const redis = REDIS_URL ? 
    new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    }) :
    new IORedis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

  try {
    console.log('🧹 Cleaning failed webhook jobs...\n');

    // Clean the old queue that was using Bull (not BullMQ)
    const oldQueueNames = ['webhook-processing', 'cruise-updates'];
    
    for (const queueName of oldQueueNames) {
      console.log(`📊 Cleaning old queue: ${queueName}`);
      
      // Delete failed jobs
      const failedCount = await redis.zcard(`bull:${queueName}:failed`);
      if (failedCount > 0) {
        await redis.del(`bull:${queueName}:failed`);
        console.log(`  ✅ Removed ${failedCount} failed jobs`);
      }

      // Clean up job data
      const jobKeys = await redis.keys(`bull:${queueName}:*`);
      if (jobKeys.length > 0) {
        await redis.del(...jobKeys);
        console.log(`  ✅ Removed ${jobKeys.length} job-related keys`);
      }
      
      console.log(`  ├─ Queue ${queueName} cleaned`);
    }

    // Also clean the new BullMQ queues if they have any issues
    const newQueueNames = ['realtime-webhooks', 'cruise-processing'];
    
    for (const queueName of newQueueNames) {
      console.log(`\n📊 Cleaning BullMQ queue: ${queueName}`);
      
      const queue = new Queue(queueName, { connection: redis });
      
      try {
        // Clean failed jobs
        const failedJobs = await queue.getFailed(0, 100);
        if (failedJobs.length > 0) {
          for (const job of failedJobs) {
            await job.remove();
          }
          console.log(`  ✅ Removed ${failedJobs.length} failed jobs`);
        }

        // Clean completed jobs older than 1 hour
        await queue.clean(60 * 60 * 1000, 1000, 'completed');
        console.log(`  ✅ Cleaned old completed jobs`);
        
      } catch (error) {
        console.log(`  ⚠️  Error cleaning ${queueName}: ${error}`);
      } finally {
        await queue.close();
      }
    }

    console.log('\n✅ Queue cleanup completed!');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await redis.quit();
    process.exit(0);
  }
}

main().catch(console.error);