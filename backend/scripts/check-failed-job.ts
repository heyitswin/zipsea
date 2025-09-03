#!/usr/bin/env tsx

/**
 * Check failed jobs in detail
 */

import IORedis from 'ioredis';

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
    console.log('🔍 Checking failed webhook job...\n');

    // Check the failed job
    const failedJobsData = await redis.zrange('bull:webhook-processing:failed', 0, -1, 'WITHSCORES');
    console.log(`📊 Failed jobs: ${failedJobsData.length / 2} entries`);

    for (let i = 0; i < failedJobsData.length; i += 2) {
      const jobId = failedJobsData[i];
      const score = failedJobsData[i + 1];
      
      console.log(`\n❌ Failed job ID: ${jobId} (score: ${score})`);
      
      // Get job details
      const jobKey = `bull:webhook-processing:${jobId}`;
      const jobData = await redis.hgetall(jobKey);
      
      if (Object.keys(jobData).length > 0) {
        console.log('Job details:');
        for (const [field, value] of Object.entries(jobData)) {
          if (field === 'data' || field === 'opts') {
            try {
              const parsed = JSON.parse(value);
              console.log(`  ├─ ${field}: ${JSON.stringify(parsed, null, 2)}`);
            } catch {
              console.log(`  ├─ ${field}: ${value}`);
            }
          } else {
            console.log(`  ├─ ${field}: ${value}`);
          }
        }
      }
    }

    // Also check if there are any worker processes running
    console.log('\n🔍 Checking for evidence of workers...');
    
    // Look for processing keys
    const processingKeys = await redis.keys('bull:*:processing*');
    console.log(`├─ Processing keys: ${processingKeys.length}`);
    
    // Look for worker keys  
    const workerKeys = await redis.keys('bull:*:workers*');
    console.log(`├─ Worker keys: ${workerKeys.length}`);
    
    // Check for active jobs
    const activeKeys = await redis.keys('bull:*:active*');
    console.log(`└─ Active keys: ${activeKeys.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await redis.quit();
    process.exit(0);
  }
}

main().catch(console.error);