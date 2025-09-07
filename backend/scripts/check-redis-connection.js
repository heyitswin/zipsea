#!/usr/bin/env node
const { createClient } = require('redis');

async function checkRedis() {
  console.log('🔍 Checking Redis Configuration...\n');

  // Check environment variable
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.error('❌ REDIS_URL environment variable is not set!');
    console.log('\nThis is likely the issue. The backend needs REDIS_URL configured.');
    console.log('\nTo fix on Render:');
    console.log('1. Go to your backend service on Render');
    console.log('2. Go to Environment settings');
    console.log('3. Add REDIS_URL with the internal Redis URL');
    console.log('   Format: redis://red-d2idqjbipnbc73abm9eg:6379');
    return;
  }

  console.log('✅ REDIS_URL is configured');
  console.log(`   URL: ${redisUrl.replace(/:[^:@]+@/, ':****@')}`); // Hide password

  // Try to connect
  console.log('\n🔌 Testing Redis connection...');
  const client = createClient({ url: redisUrl });

  client.on('error', err => {
    console.error('❌ Redis Client Error:', err.message);
  });

  try {
    await client.connect();
    console.log('✅ Successfully connected to Redis!');

    // Test basic operations
    console.log('\n🧪 Testing Redis operations...');

    // Set a test key
    const testKey = `test:webhook:${Date.now()}`;
    const testValue = 'webhook-test';

    await client.set(testKey, testValue, { EX: 60 }); // Expire in 60 seconds
    console.log(`✅ SET operation successful (key: ${testKey})`);

    // Get the test key
    const retrieved = await client.get(testKey);
    if (retrieved === testValue) {
      console.log('✅ GET operation successful');
    } else {
      console.log('⚠️ GET returned unexpected value');
    }

    // Delete the test key
    await client.del(testKey);
    console.log('✅ DEL operation successful');

    // Check Redis info
    const info = await client.info('server');
    const versionMatch = info.match(/redis_version:([^\r\n]+)/);
    if (versionMatch) {
      console.log(`\n📊 Redis Version: ${versionMatch[1]}`);
    }

    // Check memory usage
    const memInfo = await client.info('memory');
    const usedMemMatch = memInfo.match(/used_memory_human:([^\r\n]+)/);
    if (usedMemMatch) {
      console.log(`📊 Memory Usage: ${usedMemMatch[1]}`);
    }

    console.log('\n✅ All Redis operations working correctly!');

  } catch (error) {
    console.error('❌ Failed to connect to Redis:', error.message);
    console.log('\nPossible issues:');
    console.log('1. Redis service is down');
    console.log('2. Network connectivity issues');
    console.log('3. Invalid Redis URL format');
    console.log('4. Authentication failure');
  } finally {
    await client.quit();
  }
}

checkRedis().catch(console.error);
