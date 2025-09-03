#!/usr/bin/env tsx

/**
 * BullMQ Queue Workers Diagnostic Script
 * 
 * This script checks if BullMQ workers are actually running and processing jobs.
 */

import IORedis from 'ioredis';
import { Queue } from 'bullmq';

const REDIS_URL = process.env.REDIS_URL;
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');

if (!REDIS_URL && !REDIS_HOST) {
  console.error('❌ Neither REDIS_URL nor REDIS_HOST environment variable set');
  process.exit(1);
}

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
    console.log('🔍 Checking BullMQ Queue Workers Status...\n');

    // Check the queues we know should exist
    const queueNames = ['realtime-webhooks', 'cruise-processing'];
    
    for (const queueName of queueNames) {
      console.log(`📊 Checking queue: ${queueName}`);
      
      const queue = new Queue(queueName, { connection: redis });
      
      try {
        // Get job counts
        const jobCounts = await queue.getJobCounts();
        console.log(`  ├─ Waiting: ${jobCounts.waiting}`);
        console.log(`  ├─ Active: ${jobCounts.active}`);
        console.log(`  ├─ Completed: ${jobCounts.completed}`);
        console.log(`  ├─ Failed: ${jobCounts.failed}`);
        console.log(`  └─ Delayed: ${jobCounts.delayed}`);

        // Check for stuck jobs (waiting jobs that should be processed)
        if (jobCounts.waiting > 0) {
          console.log(`\n⚠️  WARNING: ${jobCounts.waiting} jobs waiting in ${queueName} queue!`);
          
          // Get some waiting jobs to inspect
          const waitingJobs = await queue.getWaiting(0, 5);
          console.log(`   └─ Sample waiting jobs:`);
          
          for (const job of waitingJobs) {
            const createdAt = new Date(job.timestamp);
            const waitTime = Date.now() - job.timestamp;
            const waitTimeMinutes = Math.floor(waitTime / (1000 * 60));
            
            console.log(`      - Job ${job.id}: created ${createdAt.toISOString()} (waiting ${waitTimeMinutes} minutes)`);
            console.log(`        Data: ${JSON.stringify(job.data).substring(0, 100)}...`);
          }
        }

        // Check for workers by looking at Redis keys
        const workerKeys = await redis.keys(`bull:${queueName}:*`);
        const workerProcessing = workerKeys.filter(key => key.includes(':active') || key.includes(':processing'));
        
        console.log(`  └─ Worker-related Redis keys found: ${workerKeys.length}`);
        console.log(`     Active processing keys: ${workerProcessing.length}`);
        
      } catch (error) {
        console.error(`  ❌ Error checking queue ${queueName}:`, error instanceof Error ? error.message : error);
      } finally {
        await queue.close();
      }
      
      console.log(''); // Empty line for readability
    }

    // Check for any BullMQ worker processes/consumers
    console.log('🔍 Checking for active BullMQ consumers...');
    const allKeys = await redis.keys('*');
    const bullKeys = allKeys.filter(key => key.includes('bull:') || key.includes('bullmq:'));
    
    console.log(`├─ Total BullMQ-related Redis keys: ${bullKeys.length}`);
    
    const workerKeys = bullKeys.filter(key => 
      key.includes(':workers') || 
      key.includes(':processing') || 
      key.includes(':stalled') ||
      key.includes(':meta')
    );
    
    console.log(`└─ Worker/processing related keys: ${workerKeys.length}`);
    
    if (workerKeys.length === 0) {
      console.log('\n❌ NO WORKER KEYS FOUND - This suggests no workers are currently running!');
    } else {
      console.log('\n✅ Worker keys found - workers may be running');
      
      // Show some worker keys for debugging
      console.log('   Sample worker keys:');
      for (const key of workerKeys.slice(0, 10)) {
        console.log(`   - ${key}`);
      }
    }

    // Final diagnosis
    console.log('\n🏥 DIAGNOSIS:');
    console.log('──────────────');
    
    const totalWaiting = queueNames.length > 0 ? 
      (await Promise.all(queueNames.map(async name => {
        const q = new Queue(name, { connection: redis });
        const counts = await q.getJobCounts();
        await q.close();
        return counts.waiting;
      }))).reduce((sum, count) => sum + count, 0) : 0;
    
    if (totalWaiting > 0 && workerKeys.length === 0) {
      console.log('❌ PROBLEM IDENTIFIED:');
      console.log('   • Jobs are being queued (webhooks are working)');
      console.log('   • BUT no workers are processing them');
      console.log('   • This means the BullMQ workers are not initialized/running');
      console.log('\n💡 SOLUTION:');
      console.log('   • Ensure realtimeWebhookService is imported and initialized at app startup');
      console.log('   • Check that workers are not failing silently during initialization');
    } else if (totalWaiting === 0) {
      console.log('✅ No jobs waiting - either workers are processing efficiently or no webhooks received');
    } else {
      console.log('⚠️  Mixed signals - need further investigation');
    }

  } catch (error) {
    console.error('❌ Error in diagnostic script:', error);
  } finally {
    await redis.quit();
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});