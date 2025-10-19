#!/usr/bin/env node

/**
 * Apply Missing Migrations to Staging Database
 *
 * This script applies migrations 0012 and 0013 which add:
 * - Live booking tables (booking_sessions, bookings, booking_passengers, booking_payments)
 * - Cruise line indexes for performance
 *
 * Run this on Render staging backend shell:
 * node scripts/apply-missing-migrations-to-staging.js
 */

const postgres = require('postgres');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function main() {
  // Use DATABASE_URL which will be staging when run on staging backend
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error('❌ Missing DATABASE_URL environment variable');
    process.exit(1);
  }

  console.log('🔧 Applying missing migrations to staging database...\n');

  const sql = postgres(dbUrl, { max: 2, ssl: 'require' });

  try {
    // Migration 0012: Add live booking tables
    console.log('📝 Migration 0012: Adding live booking tables...');
    const migration0012 = fs.readFileSync(
      path.join(__dirname, '../src/db/migrations/0012_add_live_booking_tables.sql'),
      'utf8'
    );
    await sql.unsafe(migration0012);
    console.log('✅ Migration 0012 applied successfully\n');

    // Migration 0013: Add cruise line indexes
    console.log('📝 Migration 0013: Adding cruise line indexes...');
    const migration0013 = fs.readFileSync(
      path.join(__dirname, '../src/db/migrations/0013_add_cruise_line_index.sql'),
      'utf8'
    );
    await sql.unsafe(migration0013);
    console.log('✅ Migration 0013 applied successfully\n');

    // Verify tables were created
    console.log('🔍 Verifying tables were created...');
    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN (
        'booking_sessions',
        'bookings',
        'booking_passengers',
        'booking_payments'
      )
      ORDER BY table_name
    `;

    console.log(`✅ Found ${tables.length}/4 booking tables:`);
    tables.forEach(t => console.log(`  - ${t.table_name}`));

    // Verify indexes were created
    console.log('\n🔍 Verifying indexes were created...');
    const indexes = await sql`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND (
        indexname LIKE 'idx_booking_%' OR
        indexname = 'idx_cruises_cruise_line_id' OR
        indexname = 'idx_cruises_cruise_line_sailing_date'
      )
      ORDER BY indexname
    `;

    console.log(`✅ Found ${indexes.length} indexes:`);
    indexes.forEach(i => console.log(`  - ${i.indexname}`));

    console.log('\n✅ All migrations applied successfully!');
    console.log('\n📊 Next steps:');
    console.log('  1. Run the production → staging data sync cron job');
    console.log('  2. Or manually run: node scripts/sync-production-to-staging-simple.js');
    console.log('  3. Update staging frontend NEXT_PUBLIC_API_URL to use staging backend');

  } catch (err) {
    console.error('❌ Migration failed:', err);
    console.error('Error details:', err.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
