#!/usr/bin/env tsx

/**
 * Queue Cleanup Script for Stuck Jobs
 * 
 * This script identifies and cleans up stuck jobs that might be preventing
 * new webhook processing from working properly.
 */

import IORedis from 'ioredis';
import { Queue, Job } from 'bullmq';
import { env } from '../src/config/environment';

interface CleanupStats {
  queue: string;
  beforeCounts: any;
  afterCounts: any;
  stuckJobsRemoved: number;
  failedJobsRemoved: number;
  completedJobsRemoved: number;
}

async function main() {
  console.log('🧹 Queue Cleanup - Stuck Jobs');
  console.log('=============================\n');

  const DRY_RUN = process.argv.includes('--dry-run');
  
  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No changes will be made');
  } else {
    console.log('⚠️  LIVE MODE - Changes will be made to queues');
    console.log('   Add --dry-run flag to preview changes without making them');
  }
  console.log('');

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

  const cleanupStats: CleanupStats[] = [];

  try {
    console.log('1. 📋 Analyzing Queue State');
    console.log('──────────────────────────');
    
    const queueNames = ['realtime-webhooks', 'cruise-processing'];
    
    for (const queueName of queueNames) {
      console.log(`\n🔍 Analyzing ${queueName} queue:`);
      
      const queue = new Queue(queueName, { connection: redis });
      
      try {
        // Get initial job counts
        const beforeCounts = await queue.getJobCounts();
        console.log(`  Current state:`);
        console.log(`    Waiting: ${beforeCounts.waiting}`);
        console.log(`    Active: ${beforeCounts.active}`);
        console.log(`    Completed: ${beforeCounts.completed}`);
        console.log(`    Failed: ${beforeCounts.failed}`);
        console.log(`    Delayed: ${beforeCounts.delayed}`);
        
        const stats: CleanupStats = {
          queue: queueName,
          beforeCounts,
          afterCounts: beforeCounts,
          stuckJobsRemoved: 0,
          failedJobsRemoved: 0,
          completedJobsRemoved: 0
        };

        // 2. Identify stuck waiting jobs
        console.log(`\n  🕐 Checking for stuck jobs...`);
        const waitingJobs = await queue.getWaiting(0, 50);
        const stuckJobs: Job[] = [];
        const now = Date.now();
        
        for (const job of waitingJobs) {
          const ageMinutes = (now - job.timestamp) / (1000 * 60);
          if (ageMinutes > 30) { // Jobs waiting more than 30 minutes
            stuckJobs.push(job);
          }
        }
        
        console.log(`    Found ${stuckJobs.length} jobs stuck waiting >30 minutes`);
        
        // Show details of stuck jobs
        if (stuckJobs.length > 0) {
          console.log(`    Stuck job details:`);
          for (const job of stuckJobs.slice(0, 5)) {
            const ageMinutes = Math.floor((now - job.timestamp) / (1000 * 60));
            console.log(`      - Job ${job.id}: ${ageMinutes} minutes old`);
            if (job.data?.webhookId || job.data?.cruiseId) {
              console.log(`        ${job.data.webhookId ? 'Webhook: ' + job.data.webhookId : 'Cruise: ' + job.data.cruiseId}`);
            }
          }
          
          if (stuckJobs.length > 5) {
            console.log(`      ... and ${stuckJobs.length - 5} more stuck jobs`);
          }
        }

        // 3. Check active jobs (might be truly stuck)
        const activeJobs = await queue.getActive(0, 10);
        const stuckActiveJobs: Job[] = [];
        
        for (const job of activeJobs) {
          const ageMinutes = (now - job.timestamp) / (1000 * 60);
          if (ageMinutes > 60) { // Active jobs running for more than 60 minutes
            stuckActiveJobs.push(job);
          }
        }
        
        console.log(`    Found ${stuckActiveJobs.length} jobs stuck in active state >60 minutes`);
        
        if (stuckActiveJobs.length > 0) {
          console.log(`    Stuck active jobs:`);
          for (const job of stuckActiveJobs) {
            const ageMinutes = Math.floor((now - job.timestamp) / (1000 * 60));
            console.log(`      - Job ${job.id}: active for ${ageMinutes} minutes`);
          }
        }

        // 4. Check failed jobs
        const failedJobs = await queue.getFailed(0, 50);
        const oldFailedJobs = failedJobs.filter(job => {
          const ageHours = (now - job.timestamp) / (1000 * 60 * 60);
          return ageHours > 24; // Failed jobs older than 24 hours
        });
        
        console.log(`    Found ${oldFailedJobs.length} failed jobs older than 24 hours`);

        // 5. Check completed jobs (cleanup old ones)
        const completedJobs = await queue.getCompleted(0, 100);
        const oldCompletedJobs = completedJobs.filter(job => {
          const ageHours = (now - job.timestamp) / (1000 * 60 * 60);
          return ageHours > 24; // Completed jobs older than 24 hours
        });
        
        console.log(`    Found ${oldCompletedJobs.length} completed jobs older than 24 hours`);

        // 6. Perform cleanup if not dry run
        if (!DRY_RUN) {
          console.log(`\n  🧹 Performing cleanup...`);
          
          // Remove stuck waiting jobs
          for (const job of stuckJobs) {
            try {
              await job.remove();
              stats.stuckJobsRemoved++;
            } catch (error) {
              console.log(`      Error removing stuck job ${job.id}: ${error instanceof Error ? error.message : 'Unknown'}`);
            }
          }
          
          // Move stuck active jobs back to waiting
          for (const job of stuckActiveJobs) {
            try {
              // Try to move back to waiting state
              await job.retry();
              console.log(`      Moved stuck active job ${job.id} back to waiting`);
            } catch (error) {
              console.log(`      Error retrying stuck active job ${job.id}: ${error instanceof Error ? error.message : 'Unknown'}`);
            }
          }
          
          // Remove old failed jobs
          let failedRemoved = 0;
          for (const job of oldFailedJobs) {
            try {
              await job.remove();
              failedRemoved++;
            } catch (error) {
              // Ignore removal errors
            }
          }
          stats.failedJobsRemoved = failedRemoved;
          
          // Remove old completed jobs
          let completedRemoved = 0;
          for (const job of oldCompletedJobs.slice(0, 50)) { // Limit to 50 to avoid overwhelming
            try {
              await job.remove();
              completedRemoved++;
            } catch (error) {
              // Ignore removal errors
            }
          }
          stats.completedJobsRemoved = completedRemoved;
          
          console.log(`    Cleanup results:`);
          console.log(`      Stuck waiting jobs removed: ${stats.stuckJobsRemoved}`);
          console.log(`      Stuck active jobs retried: ${stuckActiveJobs.length}`);
          console.log(`      Old failed jobs removed: ${stats.failedJobsRemoved}`);
          console.log(`      Old completed jobs removed: ${stats.completedJobsRemoved}`);
          
          // Get final counts
          stats.afterCounts = await queue.getJobCounts();
          
        } else {
          console.log(`\n  👀 Would clean up (DRY RUN):`);
          console.log(`      ${stuckJobs.length} stuck waiting jobs`);
          console.log(`      ${stuckActiveJobs.length} stuck active jobs (retry)`);
          console.log(`      ${oldFailedJobs.length} old failed jobs`);
          console.log(`      ${Math.min(oldCompletedJobs.length, 50)} old completed jobs`);
        }

        cleanupStats.push(stats);

      } catch (error) {
        console.log(`  ❌ Error analyzing ${queueName}: ${error instanceof Error ? error.message : 'Unknown'}`);
      } finally {
        await queue.close();
      }
    }

    // 7. Reset circuit breakers in FTP service
    console.log('\n2. 🔄 Circuit Breaker Reset');
    console.log('──────────────────────────');
    
    try {
      // Import and reset circuit breakers
      const { improvedFTPService } = await import('../src/services/improved-ftp.service');
      
      const stats = improvedFTPService.getStats();
      let circuitBreakersReset = 0;
      
      for (const [name, state] of Object.entries(stats.circuitBreakers)) {
        if (state.isOpen) {
          console.log(`🔄 Resetting open circuit breaker: ${name}`);
          if (!DRY_RUN) {
            const success = improvedFTPService.resetCircuitBreaker(name);
            if (success) {
              circuitBreakersReset++;
              console.log(`  ✅ Successfully reset ${name}`);
            } else {
              console.log(`  ❌ Failed to reset ${name}`);
            }
          }
        }
      }
      
      if (circuitBreakersReset === 0 && !DRY_RUN) {
        console.log('✅ No circuit breakers needed resetting');
      } else if (DRY_RUN && circuitBreakersReset === 0) {
        console.log('👀 Would reset 0 circuit breakers (DRY RUN)');
      }
      
    } catch (error) {
      console.log(`❌ Error checking circuit breakers: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    // 8. Summary and recommendations
    console.log('\n3. 📊 Cleanup Summary');
    console.log('────────────────────');
    
    if (!DRY_RUN) {
      let totalStuckRemoved = 0;
      let totalFailedRemoved = 0;
      let totalCompletedRemoved = 0;
      
      for (const stats of cleanupStats) {
        console.log(`\n${stats.queue} queue:`);
        console.log(`  Before: ${stats.beforeCounts.waiting} waiting, ${stats.beforeCounts.failed} failed, ${stats.beforeCounts.completed} completed`);
        console.log(`  After:  ${stats.afterCounts.waiting} waiting, ${stats.afterCounts.failed} failed, ${stats.afterCounts.completed} completed`);
        console.log(`  Removed: ${stats.stuckJobsRemoved} stuck + ${stats.failedJobsRemoved} failed + ${stats.completedJobsRemoved} completed`);
        
        totalStuckRemoved += stats.stuckJobsRemoved;
        totalFailedRemoved += stats.failedJobsRemoved;
        totalCompletedRemoved += stats.completedJobsRemoved;
      }
      
      console.log(`\nTotal cleanup:`);
      console.log(`  ${totalStuckRemoved} stuck jobs removed`);
      console.log(`  ${totalFailedRemoved} old failed jobs removed`);
      console.log(`  ${totalCompletedRemoved} old completed jobs removed`);
      
      if (totalStuckRemoved > 0 || totalFailedRemoved > 0) {
        console.log(`\n✅ Cleanup completed successfully!`);
        console.log(`The queues should now be in a cleaner state for webhook processing.`);
      } else {
        console.log(`\n✅ Queues were already clean - no stuck jobs found.`);
      }
      
    } else {
      console.log('\n👀 DRY RUN - No actual changes made');
      console.log('Run without --dry-run to perform cleanup');
    }

    console.log('\n4. 🎯 Next Steps');
    console.log('───────────────');
    
    console.log('After cleanup, you should:');
    console.log('1. 🧪 Test webhook processing with a manual trigger');
    console.log('2. 📊 Monitor queues to ensure jobs are being processed');
    console.log('3. 🔍 Check worker status to confirm workers are running');
    console.log('4. 📈 Verify FTP connectivity is working');
    
    console.log('\nMonitoring commands:');
    console.log('• npm run script:monitor-redis-queues-production');
    console.log('• npm run script:check-worker-status-production');
    console.log('• npm run script:test-ftp-connectivity-production');

    console.log('\n✨ Cleanup complete!');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await redis.quit();
    process.exit(0);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Cleanup interrupted');
  process.exit(0);
});

main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});