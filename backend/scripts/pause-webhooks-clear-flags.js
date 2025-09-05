#!/usr/bin/env node

/**
 * Pause Webhook Processing and Clear Sync Flags
 * Run this before initial FTP sync to avoid conflicts
 * Date: 2025-09-04
 */

const { Client } = require('pg');
const redis = require('redis');
require('dotenv').config({ path: '.env.local' });

async function pauseWebhooksAndClearFlags() {
  console.log('🛑 Pausing Webhook Processing & Clearing Sync Flags');
  console.log('===================================================\n');

  const databaseUrl = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;
  const redisUrl = process.env.REDIS_URL;

  if (!databaseUrl) {
    console.error('❌ No database URL found');
    process.exit(1);
  }

  const dbClient = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('render.com') ? { rejectUnauthorized: false } : false
  });

  try {
    // Step 1: Connect to database
    console.log('1️⃣ Connecting to database...');
    await dbClient.connect();
    console.log('✅ Database connected\n');

    // Step 2: Clear all sync flags
    console.log('2️⃣ Clearing sync flags from cruises table...');
    const result = await dbClient.query(`
      UPDATE cruises
      SET
        needs_price_update = false,
        processing_started_at = NULL,
        processing_completed_at = NULL
      WHERE needs_price_update = true
         OR processing_started_at IS NOT NULL
      RETURNING id
    `);

    console.log(`✅ Cleared flags from ${result.rowCount} cruises\n`);

    // Step 3: Get current counts
    console.log('3️⃣ Getting current database status...');
    const counts = await dbClient.query(`
      SELECT
        COUNT(*) as total_cruises,
        COUNT(CASE WHEN needs_price_update THEN 1 END) as needs_update,
        COUNT(CASE WHEN processing_started_at IS NOT NULL THEN 1 END) as processing,
        COUNT(CASE WHEN last_cached IS NOT NULL THEN 1 END) as has_cache_data
      FROM cruises
    `);

    const stats = counts.rows[0];
    console.log(`📊 Database Status:`);
    console.log(`   Total cruises: ${stats.total_cruises}`);
    console.log(`   Needs update: ${stats.needs_update} (should be 0)`);
    console.log(`   Currently processing: ${stats.processing} (should be 0)`);
    console.log(`   Has cache data: ${stats.has_cache_data}\n`);

    // Step 4: Clear Redis queues if Redis is configured
    if (redisUrl) {
      console.log('4️⃣ Clearing Redis queues...');
      const redisClient = redis.createClient({ url: redisUrl });

      try {
        await redisClient.connect();

        // Clear BullMQ queues
        const queueNames = [
          'bull:realtime-webhooks:*',
          'bull:cruise-processing:*',
          'bull:webhook-queue:*',
          'bull:batch-sync:*'
        ];

        for (const pattern of queueNames) {
          const keys = await redisClient.keys(pattern);
          if (keys.length > 0) {
            await redisClient.del(keys);
            console.log(`   Cleared ${keys.length} keys matching ${pattern}`);
          }
        }

        // Clear any webhook-related flags
        const webhookKeys = await redisClient.keys('webhook:*');
        if (webhookKeys.length > 0) {
          await redisClient.del(webhookKeys);
          console.log(`   Cleared ${webhookKeys.length} webhook-related keys`);
        }

        console.log('✅ Redis queues cleared\n');
      } catch (redisError) {
        console.log('⚠️ Redis not available or error clearing queues:', redisError.message);
        console.log('   This is OK if Redis is not being used\n');
      } finally {
        if (redisClient.isOpen) {
          await redisClient.disconnect();
        }
      }
    } else {
      console.log('4️⃣ No Redis URL configured, skipping Redis cleanup\n');
    }

    // Step 5: Create webhook pause flag
    console.log('5️⃣ Creating webhook pause flag...');
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS system_flags (
        flag_name VARCHAR(100) PRIMARY KEY,
        flag_value BOOLEAN DEFAULT false,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await dbClient.query(`
      INSERT INTO system_flags (flag_name, flag_value, description)
      VALUES ('webhooks_paused', true, 'Webhooks paused for initial FTP sync')
      ON CONFLICT (flag_name)
      DO UPDATE SET
        flag_value = true,
        updated_at = NOW()
    `);

    console.log('✅ Webhook processing paused\n');

    // Summary
    console.log('✅ All operations completed successfully!');
    console.log('==========================================');
    console.log('');
    console.log('📋 Status:');
    console.log('   • All sync flags cleared');
    console.log('   • Processing flags reset');
    console.log('   • Redis queues cleared (if available)');
    console.log('   • Webhook processing paused');
    console.log('');
    console.log('⚠️ IMPORTANT:');
    console.log('   Webhooks are now PAUSED. To resume after initial sync:');
    console.log('   node scripts/resume-webhooks.js');
    console.log('');
    console.log('📝 Next step:');
    console.log('   Run the initial FTP sync:');
    console.log('   node scripts/initial-ftp-sync-optimized.js');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.detail) {
      console.error('Details:', error.detail);
    }
    process.exit(1);
  } finally {
    await dbClient.end();
  }
}

// Run if executed directly
if (require.main === module) {
  pauseWebhooksAndClearFlags();
}

module.exports = { pauseWebhooksAndClearFlags };
