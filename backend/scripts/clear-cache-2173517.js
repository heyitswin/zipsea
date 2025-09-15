require('dotenv').config();
const Redis = require('ioredis');

async function clearCache() {
  console.log('=== Clearing Cache for Cruise 2173517 ===\n');

  try {
    // Connect to Redis
    const redis = new Redis(process.env.REDIS_URL || process.env.REDIS_URL_PRODUCTION);

    // List all keys related to cruise 2173517
    const patterns = [
      '*2173517*',
      '*comprehensive_cruise_2173517*',
      '*cruise:2173517*',
      '*cruiseDetails:2173517*'
    ];

    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        console.log(`Found ${keys.length} keys matching pattern "${pattern}":`);
        for (const key of keys) {
          console.log(`  - ${key}`);
          await redis.del(key);
        }
        console.log(`  ✅ Deleted all keys matching "${pattern}"\n`);
      } else {
        console.log(`No keys found matching pattern "${pattern}"\n`);
      }
    }

    await redis.quit();
    console.log('✅ Cache clearing complete');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

clearCache();
