#!/usr/bin/env node
const Redis = require('ioredis');
require('dotenv').config();

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

async function monitorMemory() {
  try {
    const info = await redis.info('memory');
    const lines = info.split('\r\n');
    const stats = {};

    lines.forEach(line => {
      const [key, value] = line.split(':');
      if (key && value) {
        stats[key] = value;
      }
    });

    const usedMemory = parseInt(stats.used_memory) / 1024 / 1024; // MB
    const maxMemory = 375; // MB limit for Starter plan
    const percentage = (usedMemory / maxMemory * 100).toFixed(1);

    console.log(`Memory Usage: ${usedMemory.toFixed(1)}MB / ${maxMemory}MB (${percentage}%)`);

    // Alert if approaching limit
    if (percentage > 80) {
      console.error('⚠️  WARNING: Redis memory usage above 80%!');
      console.log('Consider clearing old completed jobs or upgrading plan.');
    }

    // Check queue sizes
    const webhookQueueSize = await redis.llen('bull:webhook-processor:wait');
    const activeJobs = await redis.zcard('bull:webhook-processor:active');
    const completedJobs = await redis.zcard('bull:webhook-processor:completed');
    const failedJobs = await redis.zcard('bull:webhook-processor:failed');

    console.log('\nQueue Stats:');
    console.log(`  Waiting: ${webhookQueueSize}`);
    console.log(`  Active: ${activeJobs}`);
    console.log(`  Completed: ${completedJobs}`);
    console.log(`  Failed: ${failedJobs}`);

    // Recommend cleanup if too many completed jobs
    if (completedJobs > 1000) {
      console.log('\n💡 TIP: Run cleanup script to remove old completed jobs');
    }

  } catch (error) {
    console.error('Error monitoring Redis:', error);
  } finally {
    redis.disconnect();
  }
}

monitorMemory();
