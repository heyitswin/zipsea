#!/usr/bin/env node

/**
 * Add Missing Cruise Line Indexes to Staging
 *
 * Applies only the index creation from migration 0013
 * Safe to run multiple times (uses CREATE INDEX IF NOT EXISTS)
 */

const postgres = require('postgres');
require('dotenv').config();

async function main() {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error('❌ Missing DATABASE_URL environment variable');
    process.exit(1);
  }

  console.log('🔧 Adding cruise line indexes...\n');

  const sql = postgres(dbUrl, { max: 2, ssl: 'require' });

  try {
    // Add index on cruise_line_id
    console.log('📝 Creating idx_cruises_cruise_line_id...');
    await sql.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_cruises_cruise_line_id
      ON cruises(cruise_line_id)
    `);
    console.log('✅ Index created\n');

    // Add composite index for cruise line + sailing date
    console.log('📝 Creating idx_cruises_cruise_line_sailing_date...');
    await sql.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_cruises_cruise_line_sailing_date
      ON cruises(cruise_line_id, sailing_date)
      WHERE is_active = true
    `);
    console.log('✅ Index created\n');

    // Add comments
    await sql.unsafe(`
      COMMENT ON INDEX idx_cruises_cruise_line_id IS
        'Index on cruise_line_id for filtering searches by cruise line'
    `);
    await sql.unsafe(`
      COMMENT ON INDEX idx_cruises_cruise_line_sailing_date IS
        'Composite index for cruise line and sailing date queries with active filter'
    `);

    // Verify indexes were created
    console.log('🔍 Verifying indexes...');
    const indexes = await sql`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND (
        indexname = 'idx_cruises_cruise_line_id' OR
        indexname = 'idx_cruises_cruise_line_sailing_date'
      )
      ORDER BY indexname
    `;

    console.log(`✅ Found ${indexes.length}/2 indexes:`);
    indexes.forEach(i => console.log(`  - ${i.indexname}`));

    console.log('\n✅ All indexes created successfully!');
    console.log('\n📋 Next steps:');
    console.log('  1. ✅ Indexes created');
    console.log('  2. Run data sync if needed: node scripts/sync-production-to-staging-simple.js');
    console.log('  3. Update staging frontend NEXT_PUBLIC_API_URL to use staging backend');

  } catch (err) {
    console.error('❌ Failed to create indexes:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
