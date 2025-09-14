#!/usr/bin/env node

require('dotenv').config();
const Redis = require('ioredis');
const { Queue } = require('bullmq');

async function checkBatch3Status() {
  let redis = null;
  let queue = null;

  try {
    // Connect to Redis
    if (process.env.REDIS_URL) {
      redis = new Redis(process.env.REDIS_URL);
    } else {
      redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      });
    }

    queue = new Queue('webhook-v2-processing', {
      connection: redis,
    });

    console.log('Checking recent jobs for Royal Caribbean (line 22)...\n');

    // Get completed jobs
    const completedJobs = await queue.getCompleted(0, 100);
    const failedJobs = await queue.getFailed(0, 100);

    console.log(`Found ${completedJobs.length} completed jobs and ${failedJobs.length} failed jobs\n`);

    // Look for batch 3 specifically
    let batch3Found = false;

    console.log('=== Completed Jobs for Line 22 ===');
    for (const job of completedJobs) {
      if (job.data && job.data.lineId === 22) {
        console.log(`Job ${job.id}: Batch ${job.data.batchNumber}/${job.data.totalBatches} - ${job.data.files?.length || 0} files`);
        if (job.data.batchNumber === 3) {
          batch3Found = true;
          console.log('  ✅ BATCH 3 FOUND IN COMPLETED JOBS');

          // Check if cruise 2143102 was in this batch
          if (job.data.files) {
            const cruise2143102 = job.data.files.find(f => f.cruiseId === '2143102');
            if (cruise2143102) {
              console.log('    ✅ Cruise 2143102 WAS in this batch!');
              console.log(`    File: ${cruise2143102.path}`);
            } else {
              console.log('    ❌ Cruise 2143102 was NOT in this batch');
            }
          }

          if (job.returnvalue) {
            console.log(`    Results: ${JSON.stringify(job.returnvalue)}`);
          }
        }
      }
    }

    console.log('\n=== Failed Jobs for Line 22 ===');
    for (const job of failedJobs) {
      if (job.data && job.data.lineId === 22) {
        console.log(`Job ${job.id}: Batch ${job.data.batchNumber}/${job.data.totalBatches} - ${job.data.files?.length || 0} files`);
        if (job.data.batchNumber === 3) {
          batch3Found = true;
          console.log('  ⚠️ BATCH 3 FOUND IN FAILED JOBS');
          console.log(`    Error: ${job.failedReason}`);

          // Check if cruise 2143102 was in this batch
          if (job.data.files) {
            const cruise2143102 = job.data.files.find(f => f.cruiseId === '2143102');
            if (cruise2143102) {
              console.log('    ✅ Cruise 2143102 WAS in this batch!');
              console.log(`    File: ${cruise2143102.path}`);
            }
          }
        }
      }
    }

    if (!batch3Found) {
      console.log('\n❌ Batch 3 was NOT found in either completed or failed jobs');
      console.log('This could mean:');
      console.log('  1. The batch was never created/queued');
      console.log('  2. The batch is still waiting/active');
      console.log('  3. The job was removed from Redis');
    }

    // Check current queue status
    const waiting = await queue.getWaitingCount();
    const active = await queue.getActiveCount();
    const delayed = await queue.getDelayedCount();

    console.log('\n=== Current Queue Status ===');
    console.log(`Waiting: ${waiting}`);
    console.log(`Active: ${active}`);
    console.log(`Delayed: ${delayed}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (queue) await queue.close();
    if (redis) redis.disconnect();
  }
}

checkBatch3Status().catch(console.error);
