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
    const migrationPath = path.join(__dirname, '../src/db/migrations/0015_add_pricing_breakdown_to_sessions.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running migration...');
    console.log('SQL:', migrationSQL);
    await client.query(migrationSQL);

    console.log('✅ Migration completed successfully!');

    // Verify column was added
    console.log('\nVerifying pricing_breakdown column:');
    const result = await client.query(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_name = 'booking_sessions'
       AND column_name = 'pricing_breakdown'`
    );

    if (result.rows.length > 0) {
      console.log(`  ✅ Column added: ${result.rows[0].column_name} (${result.rows[0].data_type})`);
    } else {
      console.log('  ❌ Column not found');
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
