#!/usr/bin/env node

/**
 * Clear stuck webhook locks from Redis
 */

const redisClient = require('../dist/cache/redis').default;

async function clearWebhookLocks() {
  console.log('🔓 Clearing Webhook Locks');
  console.log('============================================================\n');

  try {
    // Find all webhook locks
    const lockKeys = await redisClient.keys('webhook:line:*:lock');

    if (lockKeys.length === 0) {
      console.log('✅ No webhook locks found');
      return;
    }

    console.log(`Found ${lockKeys.length} webhook lock(s):\n`);

    // Display and clear each lock
    for (const key of lockKeys) {
      const value = await redisClient.get(key);
      const lineId = key.match(/webhook:line:(\d+):lock/)?.[1];

      console.log(`  🔒 Line ${lineId}: locked by ${value}`);

      // Delete the lock
      await redisClient.del(key);
      console.log(`  ✅ Cleared lock for line ${lineId}`);
    }

    console.log('\n✅ All webhook locks have been cleared');

  } catch (error) {
    console.error('❌ Error clearing locks:', error.message);
  } finally {
    // Close Redis connection
    await redisClient.quit();
    process.exit(0);
  }
}

clearWebhookLocks();
