#!/usr/bin/env tsx

/**
 * Redis Job Inspection Script
 * 
 * This script looks at all Redis keys to understand what jobs exist
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
    console.log('🔍 Inspecting Redis for webhook jobs...\n');

    // Get all keys
    const allKeys = await redis.keys('*');
    console.log(`📊 Total Redis keys: ${allKeys.length}`);

    // Filter for different types of keys
    const bullKeys = allKeys.filter(key => key.includes('bull:') || key.includes('bullmq:'));
    const webhookKeys = allKeys.filter(key => 
      key.includes('webhook') || 
      key.includes('wh_') || 
      key.includes('cruise')
    );
    
    console.log(`├─ Bull/BullMQ keys: ${bullKeys.length}`);
    console.log(`└─ Webhook-related keys: ${webhookKeys.length}`);

    // Look for waiting jobs in specific patterns
    console.log('\n🔍 Looking for waiting jobs...');
    
    const waitingPatterns = [
      'bull:*:waiting',
      'bull:*:wait',
      'bullmq:*:waiting',
      'bullmq:*:wait'
    ];
    
    for (const pattern of waitingPatterns) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        console.log(`\n📋 Pattern "${pattern}" found ${keys.length} keys:`);
        for (const key of keys.slice(0, 5)) {
          try {
            const length = await redis.llen(key);
            console.log(`  ├─ ${key}: ${length} jobs`);
            
            if (length > 0) {
              // Get a sample job
              const job = await redis.lindex(key, 0);
              if (job) {
                try {
                  const jobData = JSON.parse(job);
                  console.log(`     └─ Sample job: ${JSON.stringify(jobData).substring(0, 150)}...`);
                } catch {
                  console.log(`     └─ Sample job (raw): ${job.substring(0, 100)}...`);
                }
              }
            }
          } catch (error) {
            console.log(`  ├─ ${key}: error reading (${error})`);
          }
        }
      }
    }

    // Look for any keys that might contain job IDs mentioned in the user's diagnostic
    console.log('\n🔍 Looking for webhook job IDs...');
    const jobIdKeys = allKeys.filter(key => key.includes('wh_'));
    if (jobIdKeys.length > 0) {
      console.log(`Found ${jobIdKeys.length} keys with webhook job IDs:`);
      for (const key of jobIdKeys.slice(0, 10)) {
        try {
          const type = await redis.type(key);
          console.log(`  ├─ ${key} (${type})`);
        } catch (error) {
          console.log(`  ├─ ${key} (error: ${error})`);
        }
      }
    }

    // Check specific queue names the user mentioned
    console.log('\n🔍 Checking specific queue names from diagnostic...');
    const queueNames = ['realtime-webhooks', 'cruise-processing', 'webhook-processing', 'cruise-updates'];
    
    for (const queueName of queueNames) {
      const queueKeys = allKeys.filter(key => key.includes(queueName));
      if (queueKeys.length > 0) {
        console.log(`\n📊 Queue "${queueName}" has ${queueKeys.length} Redis keys:`);
        for (const key of queueKeys) {
          try {
            const type = await redis.type(key);
            let info = `${key} (${type})`;
            
            if (type === 'list') {
              const length = await redis.llen(key);
              info += ` - ${length} items`;
            } else if (type === 'set') {
              const size = await redis.scard(key);
              info += ` - ${size} items`;
            } else if (type === 'zset') {
              const size = await redis.zcard(key);
              info += ` - ${size} items`;
            }
            
            console.log(`  ├─ ${info}`);
          } catch (error) {
            console.log(`  ├─ ${key} (error reading)`);
          }
        }
      }
    }

    // Summary
    console.log('\n📊 SUMMARY:');
    console.log('──────────');
    console.log(`Total keys: ${allKeys.length}`);
    console.log(`Bull keys: ${bullKeys.length}`);
    console.log(`Webhook keys: ${webhookKeys.length}`);
    
    if (allKeys.length > 1000) {
      console.log('\n⚠️  Large number of Redis keys detected - this could indicate job accumulation');
    }

  } catch (error) {
    console.error('❌ Error inspecting Redis:', error);
  } finally {
    await redis.quit();
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});