#!/usr/bin/env node

/**
 * Pause Batch Sync Processing
 * This script pauses the batch sync cron job by setting a system flag
 * Run this to stop batch sync from processing during FTP sync operations
 * Date: 2025-01-14
 */

const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function pauseBatchSync() {
  console.log('🛑 Pausing Batch Sync Processing');
  console.log('=================================\n');

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

    // Step 2: Create system_flags table if it doesn't exist
    console.log('2️⃣ Ensuring system_flags table exists...');
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS system_flags (
        flag_name VARCHAR(100) PRIMARY KEY,
        flag_value BOOLEAN DEFAULT false,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ System flags table ready\n');

    // Step 3: Set batch sync pause flag
    console.log('3️⃣ Setting batch sync pause flag...');
    await dbClient.query(`
      INSERT INTO system_flags (flag_name, flag_value, description)
      VALUES ('batch_sync_paused', true, 'Batch sync paused to prevent conflicts during FTP sync operations')
      ON CONFLICT (flag_name)
      DO UPDATE SET
        flag_value = true,
        updated_at = NOW()
    `);
    console.log('✅ Batch sync pause flag set\n');

    // Step 4: Clear any existing needs_price_update flags to stop current processing
    console.log('4️⃣ Clearing needs_price_update flags to stop current processing...');
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

    // Step 5: Get current system flags status
    console.log('5️⃣ Checking current system flags...');
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

    // Summary
    console.log('✅ Batch sync processing paused successfully!');
    console.log('=============================================');
    console.log('');
    console.log('📋 What was done:');
    console.log('   • Set batch_sync_paused = true');
    console.log('   • Cleared all needs_price_update flags');
    console.log('   • Reset processing timestamps');
    console.log('');
    console.log('⚠️ IMPORTANT:');
    console.log('   Batch sync cron job will now exit early when it runs');
    console.log('   No Slack notifications will be sent');
    console.log('   No cruise price updates will be processed');
    console.log('');
    console.log('📝 To resume batch sync later:');
    console.log('   node scripts/resume-batch-sync.js');
    console.log('');
    console.log('💡 Note:');
    console.log('   The cron job will still run every 5 minutes,');
    console.log('   but it will immediately exit when it sees the pause flag.');

  } catch (error) {
    console.error('❌ Error pausing batch sync:', error.message);
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
  pauseBatchSync();
}

module.exports = { pauseBatchSync };
