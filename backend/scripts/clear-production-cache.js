#!/usr/bin/env node
require('dotenv').config();
const Redis = require('ioredis');

// Production Redis connection string from Render
const REDIS_URL = 'rediss://default:vGUMnSNcHSjIXjgKaLvQjzfA7MzrwmR9@red-d2idqjbipnbc73abm9eg-a.oregon-postgres.render.com:6380';

const redis = new Redis(REDIS_URL);

async function clearCruiseCache() {
  try {
    // Clear all cache keys related to these cruises
    const patterns = [
      'cruise_details:2145865',
      'cruise_details:2190299',
      'cruise_pricing:2145865',
      'cruise_pricing:2190299',
      'comprehensive_cruise:2145865',
      'comprehensive_cruise:2190299',
      '*2145865*',
      '*2190299*'
    ];

    console.log('Clearing cache keys...');

    for (const pattern of patterns) {
      if (pattern.includes('*')) {
        // Use SCAN for patterns with wildcards
        const stream = redis.scanStream({
          match: pattern,
          count: 100
        });

        stream.on('data', async (keys) => {
          if (keys.length) {
            const pipeline = redis.pipeline();
            keys.forEach(key => {
              pipeline.del(key);
              console.log(`  Deleting: ${key}`);
            });
            await pipeline.exec();
          }
        });

        await new Promise((resolve, reject) => {
          stream.on('end', resolve);
          stream.on('error', reject);
        });
      } else {
        // Direct delete for exact keys
        const result = await redis.del(pattern);
        if (result > 0) {
          console.log(`  Deleted: ${pattern}`);
        }
      }
    }

    // Also flush all if needed (careful with this!)
    console.log('\nDo you want to flush ALL cache? Type "yes" to confirm:');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    redis.disconnect();
  }
}

clearCruiseCache();
