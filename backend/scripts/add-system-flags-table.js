#!/usr/bin/env node

/**
 * Add system_flags table for controlling system behavior
 * This table is used to pause webhooks during syncs and manage other system-wide flags
 */

const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function addSystemFlagsTable() {
  console.log('🔧 Adding system_flags table');
  console.log('================================\n');

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

    // Create system_flags table if it doesn't exist
    console.log('Creating system_flags table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_flags (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT,
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by VARCHAR(100)
      )
    `);
    console.log('✅ system_flags table created/verified\n');

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
      }
    ];

    for (const flag of defaultFlags) {
      await client.query(`
        INSERT INTO system_flags (key, value, description, updated_by)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (key) DO UPDATE
        SET description = EXCLUDED.description,
            updated_at = CURRENT_TIMESTAMP
        WHERE system_flags.description IS NULL OR system_flags.description = ''
      `, [flag.key, flag.value, flag.description, 'system']);
    }

    console.log('✅ Default system flags inserted\n');

    // Display current flags
    console.log('Current system flags:');
    const result = await client.query('SELECT key, value, description FROM system_flags ORDER BY key');
    console.table(result.rows);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

// Run the script
addSystemFlagsTable().catch(console.error);
