#!/usr/bin/env node

const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');

// Get Redis URL from environment
const REDIS_URL = process.env.REDIS_URL || process.env.REDIS_URL_PRODUCTION;

if (!REDIS_URL) {
  console.error('❌ No Redis URL found in environment');
  process.exit(1);
}

console.log('🔍 Testing BullMQ connection to production Redis...');
console.log(`📡 Redis URL: ${REDIS_URL.replace(/:[^:@]+@/, ':***@')}`);

async function testBullMQ() {
  try {
    // Create Redis connection
    const connection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

    // Test Redis connection
    await connection.ping();
    console.log('✅ Redis connection successful');

    // Create a queue
    const testQueue = new Queue('webhook-test-queue', { connection });

    // Add a test job
    const job = await testQueue.add('test-job', {
      test: true,
      timestamp: new Date().toISOString()
    });

    console.log(`✅ Added test job with ID: ${job.id}`);

    // Check queue stats
    const waiting = await testQueue.getWaitingCount();
    const active = await testQueue.getActiveCount();
    const completed = await testQueue.getCompletedCount();
    const failed = await testQueue.getFailedCount();

    console.log('\n📊 Queue Stats:');
    console.log(`  Waiting: ${waiting}`);
    console.log(`  Active: ${active}`);
    console.log(`  Completed: ${completed}`);
    console.log(`  Failed: ${failed}`);

    // Check the actual webhook processing queue
    const webhookQueue = new Queue('webhook-processing', { connection });
    const webhookStats = {
      waiting: await webhookQueue.getWaitingCount(),
      active: await webhookQueue.getActiveCount(),
      completed: await webhookQueue.getCompletedCount(),
      failed: await webhookQueue.getFailedCount(),
      delayed: await webhookQueue.getDelayedCount(),
      paused: await webhookQueue.isPaused()
    };

    console.log('\n📊 Webhook Processing Queue Stats:');
    console.log(`  Waiting: ${webhookStats.waiting}`);
    console.log(`  Active: ${webhookStats.active}`);
    console.log(`  Completed: ${webhookStats.completed}`);
    console.log(`  Failed: ${webhookStats.failed}`);
    console.log(`  Delayed: ${webhookStats.delayed}`);
    console.log(`  Paused: ${webhookStats.paused}`);

    // Clean up test job
    await job.remove();
    console.log('\n✅ Cleaned up test job');

    // Check for stuck jobs
    const stuckJobs = await webhookQueue.getJobs(['waiting', 'active', 'delayed']);
    if (stuckJobs.length > 0) {
      console.log(`\n⚠️  Found ${stuckJobs.length} jobs in webhook queue:`);
      for (const job of stuckJobs.slice(0, 5)) { // Show first 5
        console.log(`  - Job ${job.id}: ${job.name} (${await job.getState()})`);
        if (job.data) {
          console.log(`    Data: ${JSON.stringify(job.data).substring(0, 100)}`);
        }
      }
    }

    // Close connections
    await testQueue.close();
    await webhookQueue.close();
    await connection.quit();

    console.log('\n✅ All tests passed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testBullMQ();
