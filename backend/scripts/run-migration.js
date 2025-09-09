#!/usr/bin/env node

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('Connecting to database...');
    await client.connect();

    console.log('Reading migration file...');
    const migrationPath = path.join(__dirname, 'create-webhook-tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running migration...');
    await client.query(migrationSQL);

    console.log('✅ Migration completed successfully!');

    // Verify tables were created
    const tables = [
      'webhook_events',
      'system_flags',
      'price_snapshots',
      'sync_locks',
      'webhook_processing_log',
    ];
    console.log('\nVerifying tables:');

    for (const table of tables) {
      const result = await client.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = $1
        )`,
        [table]
      );
      console.log(`  ${table}: ${result.rows[0].exists ? '✅ Created' : '❌ Not found'}`);
    }
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
