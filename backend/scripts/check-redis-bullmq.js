#!/usr/bin/env node

/**
 * Check Redis and BullMQ configuration
 */

require('dotenv').config();

async function checkRedis() {
  console.log('🔍 Checking Redis/BullMQ configuration...\n');

  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log(`REDIS_URL: ${process.env.REDIS_URL ? '✅ Set' : '❌ Not set'}`);
  console.log(`REDIS_HOST: ${process.env.REDIS_HOST || 'Not set'}`);
  console.log(`REDIS_PORT: ${process.env.REDIS_PORT || 'Not set'}`);
  console.log(`REDIS_PASSWORD: ${process.env.REDIS_PASSWORD ? '✅ Set (hidden)' : '❌ Not set'}`);
  
  if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
    console.log('\n❌ No Redis configuration found!');
    console.log('BullMQ requires Redis. Please set either:');
    console.log('  REDIS_URL=redis://...  OR');
    console.log('  REDIS_HOST, REDIS_PORT, REDIS_PASSWORD');
    return;
  }

  // Try to connect to Redis
  try {
    const IORedis = require('ioredis');
    
    let redis;
    if (process.env.REDIS_URL) {
      redis = new IORedis(process.env.REDIS_URL);
    } else {
      redis = new IORedis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD
      });
    }

    // Test connection
    await redis.ping();
    console.log('\n✅ Redis connection successful!');

    // Check for BullMQ queues
    const keys = await redis.keys('bull:*');
    console.log(`\n📊 BullMQ queues found: ${keys.length}`);
    
    if (keys.length > 0) {
      console.log('Queues:');
      const queueNames = new Set();
      keys.forEach(key => {
        const match = key.match(/bull:([^:]+):/);
        if (match) {
          queueNames.add(match[1]);
        }
      });
      queueNames.forEach(name => console.log(`  - ${name}`));
    }

    // Check for webhook processing queues specifically
    const webhookQueues = keys.filter(k => k.includes('webhook') || k.includes('realtime'));
    if (webhookQueues.length === 0) {
      console.log('\n⚠️ No webhook processing queues found!');
      console.log('The realtime webhook service may not be initialized.');
    } else {
      console.log('\n✅ Webhook queues found:');
      webhookQueues.forEach(q => console.log(`  - ${q}`));
    }

    await redis.quit();

  } catch (error) {
    console.log('\n❌ Redis connection failed!');
    console.log(`Error: ${error.message}`);
    console.log('\nPossible issues:');
    console.log('- Redis server not running');
    console.log('- Invalid connection string');
    console.log('- Network/firewall blocking connection');
    console.log('- Wrong credentials');
  }

  console.log('\n📝 Summary:');
  console.log('For real-time webhook processing to work, you need:');
  console.log('1. Redis server running and accessible');
  console.log('2. REDIS_URL or REDIS_HOST configured');
  console.log('3. BullMQ queues initialized (realtime-webhooks, cruise-processing)');
  console.log('4. Workers running to process the queues');
}

checkRedis();