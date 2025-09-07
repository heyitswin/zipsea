#!/usr/bin/env node

/**
 * Fix system_flags table structure
 * This script checks and fixes the system_flags table to ensure it has the correct columns
 */

const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function fixSystemFlagsTable() {
  console.log('🔧 Fixing system_flags table structure');
  console.log('========================================\n');

  const databaseUrl = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ No database URL found');
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('render.com') ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Check if system_flags table exists and what columns it has
    console.log('Checking existing table structure...');
    const tableCheck = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'system_flags'
      ORDER BY ordinal_position
    `);

    if (tableCheck.rows.length > 0) {
      console.log('Current system_flags columns:');
      console.table(tableCheck.rows);

      // Drop the existing table if it has wrong structure
      console.log('\nDropping existing system_flags table to recreate with correct structure...');
      await client.query('DROP TABLE IF EXISTS system_flags CASCADE');
      console.log('✅ Old table dropped\n');
    }

    // Create system_flags table with correct structure
    console.log('Creating system_flags table with correct structure...');
    await client.query(`
      CREATE TABLE system_flags (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT,
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by VARCHAR(100)
      )
    `);
    console.log('✅ system_flags table created with correct structure\n');

    // Insert default flags
    console.log('Inserting default system flags...');

    const defaultFlags = [
      {
        key: 'webhooks_paused',
        value: 'false',
        description: 'Controls whether webhooks are processed. Set to true during large sync operations.'
      },
      {
        key: 'batch_sync_paused',
        value: 'false',
        description: 'Controls whether batch sync cron job processes. Set to true during initial FTP sync.'
      },
      {
        key: 'sync_in_progress',
        value: 'false',
        description: 'Indicates if a large sync operation is currently running.'
      },
      {
        key: 'sync_started_at',
        value: null,
        description: 'Timestamp when the current sync started.'
      },
      {
        key: 'sync_operator',
        value: null,
        description: 'Who initiated the current sync operation.'
      },
      {
        key: 'webhook_deduplication_window',
        value: '300',
        description: 'Seconds to prevent duplicate webhook processing (default 5 minutes)'
      },
      {
        key: 'max_cruises_per_webhook',
        value: '500',
        description: 'Maximum cruises to process per webhook batch'
      }
    ];

    for (const flag of defaultFlags) {
      await client.query(`
        INSERT INTO system_flags (key, value, description, updated_by)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value,
            description = EXCLUDED.description,
            updated_at = CURRENT_TIMESTAMP
      `, [flag.key, flag.value, flag.description, 'system']);
    }

    console.log('✅ Default system flags inserted\n');

    // Verify the structure
    console.log('Verifying final table structure:');
    const finalCheck = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'system_flags'
      ORDER BY ordinal_position
    `);
    console.table(finalCheck.rows);

    // Display current flags
    console.log('\nCurrent system flags:');
    const result = await client.query('SELECT key, value, description FROM system_flags ORDER BY key');
    console.table(result.rows);

    console.log('\n✅ System flags table fixed successfully!');
    console.log('\nYou can now run:');
    console.log('  node scripts/apply-webhook-improvements.js');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

// Run the script
fixSystemFlagsTable().catch(console.error);
