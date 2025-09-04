#!/usr/bin/env tsx

/**
 * Redis Queue Monitoring Script for Production
 * 
 * This script monitors BullMQ queues in production to identify:
 * - Stuck jobs
 * - Failed jobs
 * - Worker status
 * - Queue backlog
 * - Processing rates
 */

import IORedis from 'ioredis';
import { Queue, Job } from 'bullmq';
import { env } from '../src/config/environment';

interface QueueDiagnostics {
  name: string;
  jobCounts: any;
  stuckJobs: Job[];
  recentFailures: Job[];
  oldestWaitingJob?: Job;
  processingRate: number;
  workerPresent: boolean;
}

async function main() {
  console.log('📊 Redis Queue Monitoring - Production');
  console.log('=====================================\n');

  // Initialize Redis connection
  const redis = env.REDIS_URL ? 
    new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    }) :
    new IORedis({
      host: env.REDIS_HOST || 'localhost',
      port: env.REDIS_PORT || 6379,
      password: env.REDIS_PASSWORD,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

  try {
    // 1. Check Redis connectivity
    console.log('1. 🔗 Redis Connection Test');
    console.log('──────────────────────────');
    
    await redis.ping();
    console.log('✅ Redis connection successful');
    
    const redisInfo = await redis.info('server');
    const versionMatch = redisInfo.match(/redis_version:([^\r\n]+)/);
    if (versionMatch) {
      console.log(`Redis Version: ${versionMatch[1]}`);
    }

    // 2. Monitor main queues
    console.log('\n2. 📋 Queue Status Analysis');
    console.log('──────────────────────────');
    
    const queueNames = ['realtime-webhooks', 'cruise-processing'];
    const diagnostics: QueueDiagnostics[] = [];

    for (const queueName of queueNames) {
      console.log(`\n🔍 Analyzing queue: ${queueName}`);
      console.log(`${'─'.repeat(25 + queueName.length)}`);
      
      const queue = new Queue(queueName, { connection: redis });
      
      try {
        // Get job counts
        const jobCounts = await queue.getJobCounts();
        console.log(`  Waiting: ${jobCounts.waiting} | Active: ${jobCounts.active} | Completed: ${jobCounts.completed}`);
        console.log(`  Failed: ${jobCounts.failed} | Delayed: ${jobCounts.delayed} | Paused: ${jobCounts.paused}`);

        // Check for stuck/old waiting jobs
        const waitingJobs = await queue.getWaiting(0, 10);
        const stuckJobs: Job[] = [];
        let oldestWaitingJob: Job | undefined;
        
        if (waitingJobs.length > 0) {
          const now = Date.now();
          oldestWaitingJob = waitingJobs[0];
          
          for (const job of waitingJobs) {
            const ageMinutes = (now - job.timestamp) / (1000 * 60);
            if (ageMinutes > 10) { // Jobs waiting more than 10 minutes are suspicious
              stuckJobs.push(job);
            }
            
            if (job.timestamp < oldestWaitingJob.timestamp) {
              oldestWaitingJob = job;
            }
          }
          
          const oldestAge = Math.floor((now - oldestWaitingJob.timestamp) / (1000 * 60));
          console.log(`  Oldest waiting job: ${oldestAge} minutes old (Job ID: ${oldestWaitingJob.id})`);
          
          if (stuckJobs.length > 0) {
            console.log(`  ⚠️  ${stuckJobs.length} jobs have been waiting >10 minutes`);
          }
        }

        // Check recent failures
        const failedJobs = await queue.getFailed(0, 5);
        console.log(`  Recent failures: ${failedJobs.length} (showing last 5)`);
        
        for (const failedJob of failedJobs) {
          const failedAt = new Date(failedJob.timestamp);
          console.log(`    - Job ${failedJob.id}: Failed at ${failedAt.toISOString()}`);
          console.log(`      Error: ${failedJob.failedReason || 'No reason provided'}`);
          
          // Show job data for context
          if (failedJob.data) {
            const dataPreview = JSON.stringify(failedJob.data).substring(0, 100);
            console.log(`      Data: ${dataPreview}${dataPreview.length >= 100 ? '...' : ''}`);
          }
        }

        // Calculate processing rate (completed jobs in last hour)
        const completedJobs = await queue.getCompleted(0, 100);
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        const recentlyCompleted = completedJobs.filter(job => job.timestamp > oneHourAgo);
        const processingRate = recentlyCompleted.length; // Jobs per hour
        
        console.log(`  Processing rate: ${processingRate} jobs/hour (last 100 completed)`);

        // Check for worker presence
        const workerKeys = await redis.keys(`bull:${queueName}:*`);
        const hasWorkerKeys = workerKeys.some(key => 
          key.includes(':workers') || 
          key.includes(':processing') || 
          key.includes(':meta')
        );
        
        console.log(`  Worker indicators: ${hasWorkerKeys ? '✅ Present' : '❌ Missing'}`);
        
        if (!hasWorkerKeys && jobCounts.waiting > 0) {
          console.log(`  🚨 CRITICAL: ${jobCounts.waiting} jobs waiting but no worker detected!`);
        }

        diagnostics.push({
          name: queueName,
          jobCounts,
          stuckJobs,
          recentFailures: failedJobs,
          oldestWaitingJob,
          processingRate,
          workerPresent: hasWorkerKeys
        });

      } catch (error) {
        console.log(`  ❌ Error analyzing queue: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        await queue.close();
      }
    }

    // 3. Overall Redis analysis
    console.log('\n3. 🗄️ Overall Redis Analysis');
    console.log('────────────────────────────');
    
    const allKeys = await redis.keys('*');
    const bullKeys = allKeys.filter(key => key.includes('bull:'));
    
    console.log(`Total Redis keys: ${allKeys.length}`);
    console.log(`BullMQ keys: ${bullKeys.length}`);
    
    // Show some BullMQ keys for debugging
    console.log('\nBullMQ key samples:');
    const sampleKeys = bullKeys.slice(0, 10);
    for (const key of sampleKeys) {
      console.log(`  - ${key}`);
    }
    
    if (bullKeys.length > 20) {
      console.log(`  ... and ${bullKeys.length - 10} more keys`);
    }

    // 4. Memory and performance
    console.log('\n4. 🧠 Redis Memory & Performance');
    console.log('───────────────────────────────');
    
    const memoryInfo = await redis.info('memory');
    const memoryUsedMatch = memoryInfo.match(/used_memory_human:([^\r\n]+)/);
    const memoryPeakMatch = memoryInfo.match(/used_memory_peak_human:([^\r\n]+)/);
    
    if (memoryUsedMatch) console.log(`Memory used: ${memoryUsedMatch[1]}`);
    if (memoryPeakMatch) console.log(`Memory peak: ${memoryPeakMatch[1]}`);
    
    // Check for fragmentation
    const fragRatioMatch = memoryInfo.match(/mem_fragmentation_ratio:([^\r\n]+)/);
    if (fragRatioMatch) {
      const fragRatio = parseFloat(fragRatioMatch[1]);
      console.log(`Fragmentation ratio: ${fragRatio} ${fragRatio > 1.5 ? '⚠️ High' : '✅ Normal'}`);
    }

    // 5. Diagnostic summary
    console.log('\n5. 🏥 Diagnostic Summary');
    console.log('───────────────────────');
    
    let criticalIssues = 0;
    let warnings = 0;
    
    for (const diag of diagnostics) {
      console.log(`\nQueue: ${diag.name}`);
      
      // Check for critical issues
      if (diag.jobCounts.waiting > 0 && !diag.workerPresent) {
        console.log(`  🚨 CRITICAL: ${diag.jobCounts.waiting} jobs waiting but no worker running`);
        criticalIssues++;
      }
      
      if (diag.stuckJobs.length > 0) {
        console.log(`  ⚠️  WARNING: ${diag.stuckJobs.length} jobs stuck waiting >10 minutes`);
        warnings++;
      }
      
      if (diag.jobCounts.failed > 10) {
        console.log(`  ⚠️  WARNING: High failure rate (${diag.jobCounts.failed} failed jobs)`);
        warnings++;
      }
      
      if (diag.processingRate === 0 && diag.jobCounts.completed > 0) {
        console.log(`  ⚠️  WARNING: No processing activity in last hour`);
        warnings++;
      }
      
      // Positive indicators
      if (diag.workerPresent && diag.jobCounts.waiting === 0) {
        console.log(`  ✅ Queue healthy: Worker present, no backlog`);
      }
      
      if (diag.processingRate > 0) {
        console.log(`  ✅ Active processing: ${diag.processingRate} jobs/hour`);
      }
    }

    // 6. Action recommendations
    console.log('\n6. 💡 Action Recommendations');
    console.log('────────────────────────────');
    
    if (criticalIssues > 0) {
      console.log('🚨 IMMEDIATE ACTION REQUIRED:');
      console.log('• Workers are not running - check app initialization');
      console.log('• Restart the application to reinitialize workers');
      console.log('• Check application logs for worker startup errors');
    } else if (warnings > 0) {
      console.log('⚠️  INVESTIGATION NEEDED:');
      console.log('• Check for stuck jobs that may need manual intervention');
      console.log('• Review recent failures for patterns');
      console.log('• Consider clearing old failed jobs if they\'re resolved');
    } else {
      console.log('✅ Queue system appears healthy');
      console.log('• All queues have workers present');
      console.log('• No significant backlogs detected');
      console.log('• Processing rates are normal');
    }
    
    // Show stuck job details if any
    const allStuckJobs = diagnostics.flatMap(d => d.stuckJobs);
    if (allStuckJobs.length > 0) {
      console.log('\n🔍 Stuck Job Details:');
      console.log('─────────────────────');
      
      for (const job of allStuckJobs.slice(0, 5)) {
        const ageMinutes = Math.floor((Date.now() - job.timestamp) / (1000 * 60));
        console.log(`  Job ${job.id}: ${ageMinutes} minutes old`);
        console.log(`    Data: ${JSON.stringify(job.data).substring(0, 150)}...`);
        console.log('');
      }
    }

    console.log('\n✨ Queue monitoring complete!');

  } catch (error) {
    console.error('❌ Error during queue monitoring:', error);
  } finally {
    await redis.quit();
    process.exit(0);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Monitoring interrupted');
  process.exit(0);
});

main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});