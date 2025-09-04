#!/usr/bin/env tsx

/**
 * Worker Status Diagnostic Script for Production
 * 
 * This script checks if BullMQ workers are properly initialized and running.
 * It tests the actual worker services and provides detailed diagnostics.
 */

import IORedis from 'ioredis';
import { Queue, Worker } from 'bullmq';
import { env } from '../src/config/environment';

// Import the actual services to test them
import { realtimeWebhookService } from '../src/services/realtime-webhook.service';

async function main() {
  console.log('⚙️ Worker Status Diagnostic - Production');
  console.log('======================================\n');

  // Initialize Redis connection for direct inspection
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
    console.log('1. 🔍 Service Initialization Check');
    console.log('─────────────────────────────────');
    
    // Check if realtime webhook service is initialized
    try {
      // Access private properties via type assertion to check if workers exist
      const service = realtimeWebhookService as any;
      
      console.log('Realtime Webhook Service:');
      console.log(`  ✅ Service instance exists: ${!!service}`);
      console.log(`  ✅ Webhook worker exists: ${!!service.webhookWorker}`);
      console.log(`  ✅ Cruise worker exists: ${!!service.cruiseWorker}`);
      console.log(`  ✅ Webhook queue exists: ${!!service.webhookQueue}`);
      console.log(`  ✅ Cruise queue exists: ${!!service.cruiseQueue}`);
      console.log(`  ✅ Redis connection exists: ${!!service.redisConnection}`);
      
      // Test Redis connection from service
      if (service.redisConnection) {
        try {
          await service.redisConnection.ping();
          console.log('  ✅ Service Redis connection: Working');
        } catch (error) {
          console.log(`  ❌ Service Redis connection: Failed - ${error instanceof Error ? error.message : 'Unknown'}`);
        }
      }
      
    } catch (error) {
      console.log(`❌ Error checking service initialization: ${error instanceof Error ? error.message : 'Unknown'}`);
      console.log('This suggests the realtime webhook service failed to initialize properly');
    }

    console.log('\n2. 🔧 Worker Registration Check');
    console.log('──────────────────────────────');
    
    const queueNames = ['realtime-webhooks', 'cruise-processing'];
    
    for (const queueName of queueNames) {
      console.log(`\nChecking ${queueName} workers:`);
      
      // Look for BullMQ worker registration in Redis
      const workerKeys = await redis.keys(`bull:${queueName}:*`);
      
      console.log(`  Redis keys for ${queueName}: ${workerKeys.length}`);
      
      // Specifically look for worker-related keys
      const activeKeys = workerKeys.filter(key => key.includes(':active'));
      const metaKeys = workerKeys.filter(key => key.includes(':meta'));
      const waitKeys = workerKeys.filter(key => key.includes(':waiting'));
      const processingKeys = workerKeys.filter(key => key.includes(':processing'));
      
      console.log(`    Active job keys: ${activeKeys.length}`);
      console.log(`    Meta keys: ${metaKeys.length}`);
      console.log(`    Waiting keys: ${waitKeys.length}`);
      console.log(`    Processing keys: ${processingKeys.length}`);
      
      // Check queue meta information
      try {
        const queue = new Queue(queueName, { connection: redis });
        const isPaused = await queue.isPaused();
        const jobCounts = await queue.getJobCounts();
        
        console.log(`    Queue paused: ${isPaused ? '🚨 YES' : '✅ No'}`);
        console.log(`    Job counts: waiting(${jobCounts.waiting}) active(${jobCounts.active}) failed(${jobCounts.failed})`);
        
        await queue.close();
        
        // If jobs are waiting but no active processing, likely no workers
        if (jobCounts.waiting > 0 && jobCounts.active === 0 && !isPaused) {
          console.log(`    🚨 ISSUE: ${jobCounts.waiting} jobs waiting but none active - worker likely not running`);
        }
        
      } catch (error) {
        console.log(`    ❌ Error checking queue: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }

    console.log('\n3. 🧪 Worker Function Test');
    console.log('─────────────────────────');
    
    // Test if we can create a simple test job
    try {
      const testQueue = new Queue('realtime-webhooks', { connection: redis });
      
      console.log('Creating test webhook job...');
      
      const testJob = await testQueue.add('test-job', {
        webhookId: 'diagnostic-test',
        eventType: 'test',
        lineId: 999,
        payload: { test: true },
        timestamp: new Date().toISOString(),
        priority: 10
      }, {
        priority: 10,
        jobId: `diagnostic-${Date.now()}`,
        removeOnComplete: 1,
        removeOnFail: 1
      });
      
      console.log(`✅ Test job created: ${testJob.id}`);
      
      // Wait a few seconds to see if it gets processed
      console.log('Waiting 5 seconds to see if job gets processed...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const jobState = await testJob.getState();
      console.log(`Test job state after 5s: ${jobState}`);
      
      if (jobState === 'waiting') {
        console.log('🚨 CRITICAL: Test job still waiting - worker is NOT processing jobs');
      } else if (jobState === 'active') {
        console.log('⚠️ Test job is active - worker is running but may be slow');
      } else if (jobState === 'completed') {
        console.log('✅ Test job completed - worker is functioning');
      } else if (jobState === 'failed') {
        console.log('❌ Test job failed - worker is running but has errors');
        console.log(`Failure reason: ${testJob.failedReason}`);
      }
      
      // Clean up
      try {
        await testJob.remove();
        console.log('Test job cleaned up');
      } catch (error) {
        // Ignore cleanup errors
      }
      
      await testQueue.close();
      
    } catch (error) {
      console.log(`❌ Error testing worker function: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    console.log('\n4. 🌐 Environment Check');
    console.log('─────────────────────');
    
    console.log('Redis Configuration:');
    console.log(`  REDIS_URL: ${env.REDIS_URL ? '✅ Set' : '❌ Not set'}`);
    console.log(`  REDIS_HOST: ${env.REDIS_HOST || 'localhost'}`);
    console.log(`  REDIS_PORT: ${env.REDIS_PORT || 6379}`);
    console.log(`  REDIS_PASSWORD: ${env.REDIS_PASSWORD ? '✅ Set' : '❌ Not set'}`);
    
    console.log('\nFTP Configuration:');
    console.log(`  TRAVELTEK_FTP_HOST: ${env.TRAVELTEK_FTP_HOST ? '✅ Set' : '❌ Missing'}`);
    console.log(`  TRAVELTEK_FTP_USER: ${env.TRAVELTEK_FTP_USER ? '✅ Set' : '❌ Missing'}`);
    console.log(`  TRAVELTEK_FTP_PASSWORD: ${env.TRAVELTEK_FTP_PASSWORD ? '✅ Set' : '❌ Missing'}`);
    
    // Check if FTP credentials are missing (common cause of worker failures)
    if (!env.TRAVELTEK_FTP_HOST || !env.TRAVELTEK_FTP_USER || !env.TRAVELTEK_FTP_PASSWORD) {
      console.log('\n🚨 CRITICAL: FTP credentials are missing!');
      console.log('This will cause all webhook processing jobs to fail during FTP operations.');
      console.log('Workers may still be running but will fail when attempting to fetch cruise data.');
    }

    console.log('\n5. 🔄 Process Check');
    console.log('──────────────────');
    
    // Check if this is running in production
    console.log(`Node Environment: ${process.env.NODE_ENV || 'not set'}`);
    console.log(`Process PID: ${process.pid}`);
    console.log(`Process uptime: ${Math.floor(process.uptime())} seconds`);
    
    // Memory usage
    const memUsage = process.memoryUsage();
    console.log(`Memory usage: ${Math.round(memUsage.rss / 1024 / 1024)}MB RSS, ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB heap`);

    console.log('\n6. 💡 Diagnostic Summary');
    console.log('────────────────────────');
    
    // Create final assessment
    let issues = [];
    let critical = 0;
    
    // Check for missing FTP credentials
    if (!env.TRAVELTEK_FTP_HOST || !env.TRAVELTEK_FTP_USER || !env.TRAVELTEK_FTP_PASSWORD) {
      issues.push('🚨 CRITICAL: Missing FTP credentials - workers will fail during processing');
      critical++;
    }
    
    // Check Redis connectivity
    try {
      await redis.ping();
      console.log('✅ Redis connectivity: Working');
    } catch (error) {
      issues.push('🚨 CRITICAL: Redis connection failed - workers cannot operate');
      critical++;
    }
    
    // Final recommendations
    if (critical > 0) {
      console.log('\n🚨 CRITICAL ISSUES FOUND:');
      for (const issue of issues) {
        console.log(`   ${issue}`);
      }
      
      console.log('\n🔧 IMMEDIATE ACTIONS REQUIRED:');
      console.log('1. Check Render environment variables for FTP credentials');
      console.log('2. Verify Redis connection configuration');
      console.log('3. Restart the application after fixing environment variables');
      console.log('4. Monitor logs for worker initialization errors');
      
    } else {
      console.log('\n✅ No critical issues detected with worker environment');
      console.log('If webhooks are still not processing, the issue may be:');
      console.log('• Worker initialization failed silently during app startup');
      console.log('• Jobs are getting stuck in processing');
      console.log('• FTP service is failing during job execution');
    }
    
    console.log('\n📝 Next Steps:');
    console.log('1. Run the FTP connectivity test: npm run script:test-ftp-connectivity-production');
    console.log('2. Monitor queues: npm run script:monitor-redis-queues-production');
    console.log('3. Check application startup logs for worker errors');

    console.log('\n✨ Worker diagnostic complete!');

  } catch (error) {
    console.error('❌ Error during worker diagnostic:', error);
  } finally {
    await redis.quit();
    process.exit(0);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Diagnostic interrupted');
  process.exit(0);
});

main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});