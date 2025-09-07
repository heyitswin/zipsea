#!/usr/bin/env node

/**
 * Reset Sync Flags and Clear Pending Updates
 *
 * This script provides options to:
 * - Clear all needs_price_update flags
 * - Reset webhook processing state
 * - Clear Redis locks and queues
 * - Reset system flags
 * - Optionally clear price history for fresh start
 *
 * Usage:
 *   node scripts/reset-sync-flags.js [options]
 *
 * Options:
 *   --all           Reset everything (flags, queues, locks)
 *   --flags         Reset only cruise update flags
 *   --system        Reset only system flags
 *   --redis         Clear Redis queues and locks
 *   --history       Clear price history (use with caution!)
 *   --dry-run       Show what would be reset without doing it
 */

const { Client } = require('pg');
const redis = require('redis');
require('dotenv').config({ path: '.env.local' });

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  all: args.includes('--all'),
  flags: args.includes('--flags') || args.includes('--all'),
  system: args.includes('--system') || args.includes('--all'),
  redis: args.includes('--redis') || args.includes('--all'),
  history: args.includes('--history'),
  dryRun: args.includes('--dry-run'),
  help: args.includes('--help') || args.includes('-h')
};

// Show help if requested or no options provided
if (options.help || (!options.all && !options.flags && !options.system && !options.redis && !options.history)) {
  console.log(`
Reset Sync Flags Script
=======================

This script resets various flags and states in the system.

Usage:
  node scripts/reset-sync-flags.js [options]

Options:
  --all           Reset everything (flags, queues, locks)
  --flags         Reset only cruise update flags
  --system        Reset only system flags
  --redis         Clear Redis queues and locks
  --history       Clear price history (use with caution!)
  --dry-run       Show what would be reset without doing it
  --help          Show this help message

Examples:
  node scripts/reset-sync-flags.js --flags              # Clear needs_price_update flags
  node scripts/reset-sync-flags.js --all                # Reset everything
  node scripts/reset-sync-flags.js --flags --dry-run    # Preview flag reset
  node scripts/reset-sync-flags.js --redis --system     # Clear Redis and system flags

Warning:
  --history option will delete price history data. Use with extreme caution!
  `);
  process.exit(0);
}

async function resetSyncFlags() {
  console.log('🔄 Reset Sync Flags Script');
  console.log('===========================\n');

  if (options.dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  const databaseUrl = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ No database URL found');
    process.exit(1);
  }

  const dbClient = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('render.com') ? { rejectUnauthorized: false } : false
  });

  try {
    await dbClient.connect();
    console.log('✅ Connected to database\n');

    // Get current statistics
    console.log('📊 Current System State:');
    console.log('------------------------');

    const stats = await dbClient.query(`
      SELECT
        COUNT(*) FILTER (WHERE needs_price_update = true) as needs_update,
        COUNT(*) FILTER (WHERE processing_started_at IS NOT NULL) as processing,
        COUNT(*) FILTER (WHERE webhook_priority > 0) as prioritized,
        COUNT(*) as total_cruises
      FROM cruises
    `);

    console.table(stats.rows[0]);

    // 1. Reset cruise update flags
    if (options.flags) {
      console.log('\n1️⃣ Resetting Cruise Update Flags...');

      if (!options.dryRun) {
        const result = await dbClient.query(`
          UPDATE cruises
          SET
            needs_price_update = false,
            processing_started_at = NULL,
            processing_completed_at = NULL,
            webhook_priority = 0,
            last_webhook_at = NULL,
            webhook_source = NULL
          WHERE needs_price_update = true
             OR processing_started_at IS NOT NULL
             OR webhook_priority > 0
          RETURNING id
        `);

        console.log(`✅ Reset ${result.rowCount} cruise flags`);
      } else {
        const count = await dbClient.query(`
          SELECT COUNT(*) as count
          FROM cruises
          WHERE needs_price_update = true
             OR processing_started_at IS NOT NULL
             OR webhook_priority > 0
        `);
        console.log(`Would reset ${count.rows[0].count} cruise flags`);
      }
    }

    // 2. Reset system flags
    if (options.system) {
      console.log('\n2️⃣ Resetting System Flags...');

      // Check if system_flags table exists
      const tableExists = await dbClient.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'system_flags'
        )
      `);

      if (tableExists.rows[0].exists) {
        if (!options.dryRun) {
          await dbClient.query(`
            UPDATE system_flags
            SET value = CASE
              WHEN key IN ('webhooks_paused', 'batch_sync_paused', 'sync_in_progress') THEN 'false'
              WHEN key = 'sync_started_at' THEN NULL
              WHEN key = 'sync_operator' THEN NULL
              ELSE value
            END,
            updated_at = CURRENT_TIMESTAMP,
            updated_by = 'reset_script'
            WHERE key IN ('webhooks_paused', 'batch_sync_paused', 'sync_in_progress', 'sync_started_at', 'sync_operator')
          `);

          console.log('✅ System flags reset to defaults');
        } else {
          console.log('Would reset system flags to defaults');
        }

        // Show current system flags
        const flags = await dbClient.query(`
          SELECT key, value
          FROM system_flags
          WHERE key IN ('webhooks_paused', 'batch_sync_paused', 'sync_in_progress')
          ORDER BY key
        `);

        console.log('\nSystem Flags After Reset:');
        console.table(flags.rows);
      } else {
        console.log('⚠️  system_flags table does not exist');
      }
    }

    // 3. Clear Redis queues and locks
    if (options.redis) {
      console.log('\n3️⃣ Clearing Redis Queues and Locks...');

      const redisUrl = process.env.REDIS_URL;
      if (redisUrl) {
        const redisClient = redis.createClient({ url: redisUrl });

        try {
          await redisClient.connect();

          if (!options.dryRun) {
            // Clear webhook locks
            const lockKeys = await redisClient.keys('webhook:line:*:lock');
            if (lockKeys.length > 0) {
              await redisClient.del(lockKeys);
              console.log(`✅ Cleared ${lockKeys.length} webhook locks`);
            }

            // Clear BullMQ queues
            const queuePatterns = [
              'bull:realtime-webhooks:*',
              'bull:cruise-processing:*',
              'bull:webhook-queue:*',
              'bull:batch-sync:*',
              'bull:price-sync:*'
            ];

            for (const pattern of queuePatterns) {
              const keys = await redisClient.keys(pattern);
              if (keys.length > 0) {
                await redisClient.del(keys);
                console.log(`✅ Cleared ${keys.length} keys for ${pattern}`);
              }
            }

            // Clear webhook deduplication keys
            const webhookKeys = await redisClient.keys('webhook:*');
            if (webhookKeys.length > 0) {
              await redisClient.del(webhookKeys);
              console.log(`✅ Cleared ${webhookKeys.length} webhook deduplication keys`);
            }
          } else {
            const allKeys = await redisClient.keys('webhook:*');
            const queueKeys = await redisClient.keys('bull:*');
            console.log(`Would clear ${allKeys.length} webhook keys and ${queueKeys.length} queue keys`);
          }

          await redisClient.disconnect();
        } catch (error) {
          console.log('⚠️  Redis not available or error:', error.message);
        }
      } else {
        console.log('⚠️  No Redis URL configured');
      }
    }

    // 4. Clear webhook processing log
    if (options.flags || options.all) {
      console.log('\n4️⃣ Clearing Webhook Processing Log...');

      const logExists = await dbClient.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'webhook_processing_log'
        )
      `);

      if (logExists.rows[0].exists) {
        if (!options.dryRun) {
          const result = await dbClient.query(`
            DELETE FROM webhook_processing_log
            WHERE created_at < NOW() - INTERVAL '7 days'
          `);
          console.log(`✅ Cleared ${result.rowCount} old webhook log entries`);
        } else {
          const count = await dbClient.query(`
            SELECT COUNT(*) as count
            FROM webhook_processing_log
            WHERE created_at < NOW() - INTERVAL '7 days'
          `);
          console.log(`Would clear ${count.rows[0].count} old webhook log entries`);
        }
      }
    }

    // 5. Clear price history (optional, with warning)
    if (options.history) {
      console.log('\n5️⃣ ⚠️  CLEARING PRICE HISTORY (DANGEROUS)...');

      if (!options.dryRun) {
        console.log('⚠️  This will delete all price history data!');
        console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        const result = await dbClient.query(`
          TRUNCATE TABLE price_history CASCADE
        `);
        console.log('✅ Price history cleared');
      } else {
        const count = await dbClient.query(`
          SELECT COUNT(*) as count FROM price_history
        `);
        console.log(`Would delete ${count.rows[0].count} price history records`);
      }
    }

    // Final statistics
    console.log('\n📊 Final System State:');
    console.log('----------------------');

    const finalStats = await dbClient.query(`
      SELECT
        COUNT(*) FILTER (WHERE needs_price_update = true) as needs_update,
        COUNT(*) FILTER (WHERE processing_started_at IS NOT NULL) as processing,
        COUNT(*) FILTER (WHERE webhook_priority > 0) as prioritized,
        COUNT(*) FILTER (WHERE sailing_date >= CURRENT_DATE) as future_cruises,
        COUNT(*) as total_cruises
      FROM cruises
    `);

    console.table(finalStats.rows[0]);

    if (!options.dryRun) {
      console.log('\n✅ Reset completed successfully!');

      console.log('\n📝 Next Steps:');
      console.log('   1. Run webhooks: node scripts/unpause-services.js');
      console.log('   2. Test webhook: node scripts/test-webhook-traveltek.js');
      console.log('   3. Monitor: Check webhook_processing_log table');
    } else {
      console.log('\n🔍 Dry run completed - no changes were made');
      console.log('Remove --dry-run flag to apply changes');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await dbClient.end();
    console.log('\n✅ Database connection closed');
  }
}

// Run the script
resetSyncFlags().catch(console.error);
