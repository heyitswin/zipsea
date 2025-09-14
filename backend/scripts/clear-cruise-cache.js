#!/usr/bin/env node

const dotenv = require('dotenv');
const path = require('path');
const Redis = require('ioredis');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const cruiseId = process.argv[2] || '2143102';

async function clearCruiseCache() {
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

  try {
    console.log(`\nClearing cache for cruise ${cruiseId}...`);

    // Cache key format from cache-keys.ts
    const cacheKey = `cruise:details:${cruiseId}`;

    const exists = await redis.exists(cacheKey);
    if (exists) {
      await redis.del(cacheKey);
      console.log(`✅ Cleared cache key: ${cacheKey}`);
    } else {
      console.log(`❌ Cache key not found: ${cacheKey}`);
    }

    // Also check for other related cache keys
    const patterns = [
      `cruise:pricing:${cruiseId}:*`,
      `cruise:itinerary:${cruiseId}`,
      `cruise:comprehensive:${cruiseId}`
    ];

    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        for (const key of keys) {
          await redis.del(key);
          console.log(`✅ Cleared related cache key: ${key}`);
        }
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    redis.quit();
  }
}

clearCruiseCache();
