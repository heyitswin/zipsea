#!/usr/bin/env node

/**
 * Verify Staging Database Has All Required Tables and Indexes
 *
 * Checks if migrations 0012 and 0013 are properly applied
 */

const postgres = require('postgres');
require('dotenv').config();

async function main() {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error('❌ Missing DATABASE_URL environment variable');
    process.exit(1);
  }

  console.log('🔍 Verifying staging database schema...\n');

  const sql = postgres(dbUrl, { max: 2, ssl: 'require' });

  try {
    // Check for booking tables
    console.log('📋 Checking for live booking tables...');
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

    const expectedTables = ['booking_sessions', 'bookings', 'booking_passengers', 'booking_payments'];
    const foundTables = new Set(tables.map(t => t.table_name));

    expectedTables.forEach(table => {
      if (foundTables.has(table)) {
        console.log(`  ✅ ${table}`);
      } else {
        console.log(`  ❌ ${table} - MISSING`);
      }
    });

    // Check for cruise line index
    console.log('\n📋 Checking for cruise line indexes...');
    const indexes = await sql`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND (
        indexname = 'idx_cruises_cruise_line_id' OR
        indexname = 'idx_cruises_cruise_line_sailing_date'
      )
      ORDER BY indexname
    `;

    const expectedIndexes = ['idx_cruises_cruise_line_id', 'idx_cruises_cruise_line_sailing_date'];
    const foundIndexes = new Set(indexes.map(i => i.indexname));

    expectedIndexes.forEach(index => {
      if (foundIndexes.has(index)) {
        console.log(`  ✅ ${index}`);
      } else {
        console.log(`  ❌ ${index} - MISSING`);
      }
    });

    // Check cruise data
    console.log('\n📊 Checking cruise data...');
    const [{ count: cruiseCount }] = await sql`SELECT COUNT(*)::int as count FROM cruises`;
    const [{ count: cruiseLineCount }] = await sql`SELECT COUNT(*)::int as count FROM cruise_lines`;
    const [{ count: shipCount }] = await sql`SELECT COUNT(*)::int as count FROM ships`;

    console.log(`  Cruises: ${cruiseCount.toLocaleString()} ${cruiseCount < 1000 ? '⚠️  LOW' : '✅'}`);
    console.log(`  Cruise Lines: ${cruiseLineCount} ${cruiseLineCount < 10 ? '⚠️  LOW' : '✅'}`);
    console.log(`  Ships: ${shipCount} ${shipCount < 100 ? '⚠️  LOW' : '✅'}`);

    // Overall status
    console.log('\n' + '='.repeat(50));
    const allTablesExist = expectedTables.every(t => foundTables.has(t));
    const allIndexesExist = expectedIndexes.every(i => foundIndexes.has(i));
    const hasData = cruiseCount > 1000;

    if (allTablesExist && allIndexesExist && hasData) {
      console.log('✅ Staging database is fully configured!');
      console.log('\n📋 Next steps:');
      console.log('  1. ✅ Migrations applied');
      console.log('  2. ✅ Data synced from production');
      console.log('  3. ⏭️  Update staging frontend NEXT_PUBLIC_API_URL');
      console.log('  4. ⏭️  Test cabin pricing and booking flow');
    } else if (allTablesExist && allIndexesExist && !hasData) {
      console.log('⚠️  Database schema is correct but data needs syncing');
      console.log('\n📋 Next steps:');
      console.log('  1. ✅ Migrations applied');
      console.log('  2. ❌ Run: node scripts/sync-production-to-staging-simple.js');
      console.log('  3. ⏭️  Update staging frontend NEXT_PUBLIC_API_URL');
    } else {
      console.log('❌ Database setup incomplete');
      if (!allTablesExist) {
        console.log('  Missing tables - migrations need to be applied');
      }
      if (!allIndexesExist) {
        console.log('  Missing indexes - run migration 0013');
      }
    }

  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
