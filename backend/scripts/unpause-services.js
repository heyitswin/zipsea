#!/usr/bin/env node

/**
 * Unpause webhook and batch sync services after improvements are deployed
 * This should be run after the webhook improvements have been tested
 */

const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function unpauseServices() {
  console.log('🔄 Unpausing Services After Webhook Improvements');
  console.log('=================================================\n');

  const databaseUrl = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ No database URL found');
    console.log('Please set DATABASE_URL or DATABASE_URL_PRODUCTION');
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('render.com') ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Check if system_flags table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'system_flags'
      )
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('⚠️  system_flags table does not exist');
      console.log('Run: node scripts/apply-webhook-improvements.js first');
      process.exit(1);
    }

    // Get current status
    console.log('📊 Current Service Status:');
    const currentStatus = await client.query(`
      SELECT key, value, description
      FROM system_flags
      WHERE key IN ('webhooks_paused', 'batch_sync_paused', 'sync_in_progress')
      ORDER BY key
    `);

    console.table(currentStatus.rows);
    console.log('');

    // Check for any ongoing sync
    const syncCheck = await client.query(`
      SELECT value FROM system_flags
      WHERE key = 'sync_in_progress'
      LIMIT 1
    `);

    if (syncCheck.rows.length > 0 && syncCheck.rows[0].value === 'true') {
      console.log('⚠️  WARNING: A sync is currently in progress!');
      console.log('It is recommended to wait until the sync completes before unpausing services.');
      console.log('Continue anyway? This may cause conflicts.');
      // In a real scenario, you'd prompt for confirmation here
    }

    // Unpause webhooks
    console.log('1️⃣ Unpausing webhook processing...');
    await client.query(`
      UPDATE system_flags
      SET value = 'false',
          updated_at = CURRENT_TIMESTAMP,
          updated_by = 'unpause_script'
      WHERE key = 'webhooks_paused'
    `);
    console.log('✅ Webhooks unpaused - they will now process incoming events\n');

    // Unpause batch sync
    console.log('2️⃣ Unpausing batch sync cron job...');
    await client.query(`
      UPDATE system_flags
      SET value = 'false',
          updated_at = CURRENT_TIMESTAMP,
          updated_by = 'unpause_script'
      WHERE key = 'batch_sync_paused'
    `);
    console.log('✅ Batch sync unpaused - cron job will process flagged cruises\n');

    // Clear any stale sync_in_progress flag
    console.log('3️⃣ Clearing sync_in_progress flag...');
    await client.query(`
      UPDATE system_flags
      SET value = 'false',
          updated_at = CURRENT_TIMESTAMP,
          updated_by = 'unpause_script'
      WHERE key = 'sync_in_progress'
    `);
    console.log('✅ Sync flag cleared\n');

    // Check pending updates
    console.log('4️⃣ Checking pending updates...');
    const pendingStats = await client.query(`
      SELECT
        COUNT(*) as total_pending,
        COUNT(*) FILTER (WHERE sailing_date >= CURRENT_DATE) as future_pending,
        COUNT(DISTINCT cruise_line_id) as affected_lines
      FROM cruises
      WHERE needs_price_update = true
    `);

    const stats = pendingStats.rows[0];
    console.log(`📈 Pending Price Updates:`);
    console.log(`   Total cruises needing update: ${stats.total_pending}`);
    console.log(`   Future cruises needing update: ${stats.future_pending}`);
    console.log(`   Affected cruise lines: ${stats.affected_lines}`);
    console.log('');

    if (parseInt(stats.total_pending) > 0) {
      console.log('💡 The batch sync cron job will start processing these in the next run (every 5 minutes)');
    }

    // Final status
    console.log('5️⃣ Final Service Status:');
    const finalStatus = await client.query(`
      SELECT key, value, updated_at
      FROM system_flags
      WHERE key IN ('webhooks_paused', 'batch_sync_paused', 'sync_in_progress')
      ORDER BY key
    `);

    console.table(finalStatus.rows);

    console.log('\n✅ Services successfully unpaused!');
    console.log('\n📝 What happens next:');
    console.log('   1. Webhooks will immediately start processing new events');
    console.log('   2. Batch sync cron job will run every 5 minutes');
    console.log('   3. With the flag clearing bug fixed, only processed cruises will be unmarked');
    console.log('   4. Price snapshots will be captured before all updates');
    console.log('   5. All future sailings (no 2-year limit) will be processed');
    console.log('\n🎯 Monitor the system with:');
    console.log('   - Check logs: Render dashboard → Logs');
    console.log('   - View webhook stats: GET /api/webhooks/traveltek/stats');
    console.log('   - Check health: GET /api/webhooks/traveltek/health');

  } catch (error) {
    console.error('❌ Error unpausing services:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

// Run the script
unpauseServices().catch(console.error);
