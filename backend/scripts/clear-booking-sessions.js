require('dotenv').config({ path: '.env' });
const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL_PRODUCTION || process.env.REDIS_URL;

if (!REDIS_URL) {
  console.error('❌ No Redis URL found in environment variables');
  process.exit(1);
}

const redis = new Redis(REDIS_URL);

async function clearBookingSessions() {
  try {
    console.log('🔍 Searching for booking sessions in Redis...\n');

    // Find all booking session keys
    const keys = await redis.keys('booking_session:*');

    console.log(`📊 Found ${keys.length} booking sessions\n`);

    if (keys.length === 0) {
      console.log('✅ No sessions to clear');
      await redis.quit();
      return;
    }

    // Also find existing session keys
    const existingKeys = await redis.keys('existing_session:*');
    console.log(`📊 Found ${existingKeys.length} cached session references\n`);

    const allKeys = [...keys, ...existingKeys];

    console.log(`🗑️  Deleting ${allKeys.length} total keys...`);

    // Delete in batches of 100
    const batchSize = 100;
    let deleted = 0;

    for (let i = 0; i < allKeys.length; i += batchSize) {
      const batch = allKeys.slice(i, i + batchSize);
      if (batch.length > 0) {
        const result = await redis.del(...batch);
        deleted += result;
      }
    }

    console.log(`✅ Successfully deleted ${deleted} keys`);
    console.log('\n📝 Note: New sessions will be created with correct adult counts when users next visit cruise pages');

    await redis.quit();
  } catch (error) {
    console.error('❌ Error clearing sessions:', error);
    await redis.quit();
    process.exit(1);
  }
}

clearBookingSessions();
