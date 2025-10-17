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

    console.log('Reading booking tables migration file...');
    const migrationPath = path.join(__dirname, '../src/db/migrations/0012_add_live_booking_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running booking tables migration...');
    await client.query(migrationSQL);

    console.log('✅ Booking tables migration completed successfully!');

    // Verify tables were created
    const tables = [
      'booking_sessions',
      'bookings',
      'booking_passengers',
      'booking_payments',
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

    // Count rows in booking_sessions to verify it's ready
    const count = await client.query('SELECT COUNT(*) FROM booking_sessions');
    console.log(`\nBooking sessions table: ${count.rows[0].count} rows`);

    console.log('\n✅ All booking tables are ready for live booking!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
