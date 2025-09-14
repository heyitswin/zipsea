#!/usr/bin/env node

import { Queue } from 'bullmq';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const webhookQueue = new Queue('webhook-processor-optimized-v2', {
  connection: redis,
});

async function getJobStats() {
  try {
    // Get all job counts
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      webhookQueue.getWaitingCount(),
      webhookQueue.getActiveCount(),
      webhookQueue.getCompletedCount(),
      webhookQueue.getFailedCount(),
      webhookQueue.getDelayedCount(),
    ]);

    console.log('\n=== BullMQ Job Queue Status ===');
    console.log(`Waiting:   ${waiting}`);
    console.log(`Active:    ${active}`);
    console.log(`Completed: ${completed}`);
    console.log(`Failed:    ${failed}`);
    console.log(`Delayed:   ${delayed}`);
    console.log(`Total:     ${waiting + active + completed + failed + delayed}`);

    // Get active jobs details
    const activeJobs = await webhookQueue.getJobs(['active']);
    if (activeJobs.length > 0) {
      console.log('\n=== Active Jobs Details ===');
      const lineJobCounts = {};

      for (const job of activeJobs) {
        const lineId = job.data?.lineId;
        const batchNumber = job.data?.batchNumber;
        const totalBatches = job.data?.totalBatches;
        const filesCount = job.data?.files?.length || 0;

        if (lineId) {
          if (!lineJobCounts[lineId]) {
            lineJobCounts[lineId] = {
              count: 0,
              batches: [],
              totalFiles: 0,
            };
          }
          lineJobCounts[lineId].count++;
          lineJobCounts[lineId].batches.push(`${batchNumber}/${totalBatches}`);
          lineJobCounts[lineId].totalFiles += filesCount;
        }
      }

      for (const [lineId, stats] of Object.entries(lineJobCounts)) {
        console.log(`\nLine ${lineId}:`);
        console.log(`  Active Jobs: ${stats.count}`);
        console.log(`  Batches: ${stats.batches.join(', ')}`);
        console.log(`  Total Files: ${stats.totalFiles}`);
      }
    }

    // Get waiting jobs details (first 10)
    const waitingJobs = await webhookQueue.getJobs(['waiting'], 0, 10);
    if (waitingJobs.length > 0) {
      console.log('\n=== Waiting Jobs (First 10) ===');
      const lineWaitingCounts = {};

      for (const job of waitingJobs) {
        const lineId = job.data?.lineId;
        if (lineId) {
          lineWaitingCounts[lineId] = (lineWaitingCounts[lineId] || 0) + 1;
        }
      }

      for (const [lineId, count] of Object.entries(lineWaitingCounts)) {
        console.log(`Line ${lineId}: ${count} jobs waiting`);
      }
    }

    // Check for duplicate jobs
    console.log('\n=== Checking for Duplicate Jobs ===');
    const allJobs = await webhookQueue.getJobs(['waiting', 'active', 'delayed']);
    const jobsByLine = {};

    for (const job of allJobs) {
      const lineId = job.data?.lineId;
      const batchNumber = job.data?.batchNumber;
      if (lineId && batchNumber) {
        const key = `${lineId}-${batchNumber}`;
        if (!jobsByLine[key]) {
          jobsByLine[key] = [];
        }
        jobsByLine[key].push({
          id: job.id,
          status: await job.getState(),
          created: new Date(job.timestamp).toISOString(),
        });
      }
    }

    let duplicatesFound = false;
    for (const [key, jobs] of Object.entries(jobsByLine)) {
      if (jobs.length > 1) {
        duplicatesFound = true;
        console.log(`\nDuplicate found for ${key}:`);
        jobs.forEach(job => {
          console.log(`  - Job ${job.id}: ${job.status} (created: ${job.created})`);
        });
      }
    }

    if (!duplicatesFound) {
      console.log('No duplicate jobs found.');
    }

  } catch (error) {
    console.error('Error getting job stats:', error);
  } finally {
    await redis.quit();
    process.exit(0);
  }
}

// Run the monitor
getJobStats();
