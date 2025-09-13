#!/usr/bin/env node
const Redis = require('ioredis');
const { Queue } = require('bullmq');
require('dotenv').config();

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

const webhookQueue = new Queue('webhook-processor', {
  connection: {
    host: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).hostname : 'localhost',
    port: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).port : 6379,
    password: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).password : undefined
  }
});

async function cleanupOldJobs() {
  try {
    console.log('Starting Redis cleanup...\n');

    // Clean completed jobs older than 24 hours
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const cleaned = await webhookQueue.clean(
      24 * 60 * 60 * 1000, // grace period
      1000, // limit
      'completed'
    );
    console.log(`✅ Cleaned ${cleaned.length} completed jobs older than 24 hours`);

    // Clean failed jobs older than 7 days
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const cleanedFailed = await webhookQueue.clean(
      7 * 24 * 60 * 60 * 1000, // grace period
      1000, // limit
      'failed'
    );
    console.log(`✅ Cleaned ${cleanedFailed.length} failed jobs older than 7 days`);

    // Check memory after cleanup
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
    console.log(`\n📊 Current memory usage: ${usedMemory.toFixed(1)}MB / 375MB`);

  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await webhookQueue.close();
    redis.disconnect();
  }
}

cleanupOldJobs();
