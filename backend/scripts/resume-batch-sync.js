#!/usr/bin/env node

/**
 * Resume Batch Sync Processing
 * This script resumes the batch sync cron job by removing the system pause flag
 * Run this after completing FTP sync operations
 * Date: 2025-01-14
 */

const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function resumeBatchSync() {
  console.log('▶️ Resuming Batch Sync Processing');
  console.log('==================================\n');

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
    // Step 1: Connect to database
    console.log('1️⃣ Connecting to database...');
    await dbClient.connect();
    console.log('✅ Database connected\n');

    // Step 2: Check current pause status
    console.log('2️⃣ Checking current batch sync status...');
    const currentStatus = await dbClient.query(`
      SELECT flag_value, description, updated_at
      FROM system_flags
      WHERE flag_name = 'batch_sync_paused'
    `);

    if (currentStatus.rows.length === 0) {
      console.log('⚠️ No batch_sync_paused flag found - batch sync may already be active\n');
    } else {
      const isPaused = currentStatus.rows[0].flag_value;
      if (!isPaused) {
        console.log('✅ Batch sync is already resumed (not paused)\n');
      } else {
        console.log('🔴 Batch sync is currently paused\n');
      }
    }

    // Step 3: Resume batch sync by setting flag to false
    console.log('3️⃣ Resuming batch sync processing...');
    await dbClient.query(`
      INSERT INTO system_flags (flag_name, flag_value, description)
      VALUES ('batch_sync_paused', false, 'Batch sync processing resumed')
      ON CONFLICT (flag_name)
      DO UPDATE SET
        flag_value = false,
        description = 'Batch sync processing resumed',
        updated_at = NOW()
    `);
    console.log('✅ Batch sync pause flag removed\n');

    // Step 4: Get current system flags status
    console.log('4️⃣ Checking all system flags...');
    const flags = await dbClient.query(`
      SELECT flag_name, flag_value, description, updated_at
      FROM system_flags
      WHERE flag_name IN ('webhooks_paused', 'batch_sync_paused')
      ORDER BY flag_name
    `);

    console.log('📊 Current System Flags:');
    if (flags.rows.length > 0) {
      for (const flag of flags.rows) {
        const status = flag.flag_value ? '🔴 PAUSED' : '🟢 ACTIVE';
        console.log(`   ${flag.flag_name}: ${status}`);
        console.log(`     Description: ${flag.description}`);
        console.log(`     Last updated: ${flag.updated_at}\n`);
      }
    } else {
      console.log('   No system flags found\n');
    }

    // Step 5: Check database status
    console.log('5️⃣ Checking database status...');
    const counts = await dbClient.query(`
      SELECT
        COUNT(*) as total_cruises,
        COUNT(CASE WHEN needs_price_update THEN 1 END) as needs_update,
        COUNT(CASE WHEN processing_started_at IS NOT NULL THEN 1 END) as processing,
        COUNT(CASE WHEN cheapest_price IS NOT NULL AND cheapest_price > 0 THEN 1 END) as has_pricing
      FROM cruises
      WHERE sailing_date >= CURRENT_DATE
        AND is_active = true
    `);

    const stats = counts.rows[0];
    console.log('📊 Current Database Status (Future Active Cruises):');
    console.log(`   Total cruises: ${stats.total_cruises}`);
    console.log(`   Needs update: ${stats.needs_update}`);
    console.log(`   Currently processing: ${stats.processing}`);
    console.log(`   Has pricing data: ${stats.has_pricing}\n`);

    // Summary
    console.log('✅ Batch sync processing resumed successfully!');
    console.log('============================================');
    console.log('');
    console.log('📋 What was done:');
    console.log('   • Set batch_sync_paused = false');
    console.log('   • Batch sync will now process normally');
    console.log('   • Cron job will run every 5 minutes as scheduled');
    console.log('');
    console.log('⚠️ IMPORTANT:');
    console.log('   Batch sync is now ACTIVE and will process cruises marked with needs_price_update = true');
    console.log('   Slack notifications will resume');
    console.log('');
    console.log('📝 Next batch sync run:');
    console.log('   The cron job runs every 5 minutes');
    console.log('   Check Slack for batch sync notifications');
    console.log('');
    console.log('💡 To pause again if needed:');
    console.log('   node scripts/pause-batch-sync.js');

  } catch (error) {
    console.error('❌ Error resuming batch sync:', error.message);
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
  resumeBatchSync();
}

module.exports = { resumeBatchSync };
