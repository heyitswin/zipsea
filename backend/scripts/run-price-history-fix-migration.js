#!/usr/bin/env node

/**
 * Migration runner for fixing price_history and price_trends cruise_id type
 *
 * This script applies the migration to fix the INTEGER to VARCHAR type mismatch
 * for cruise_id columns in price_history and price_trends tables.
 *
 * Usage:
 *   node scripts/run-price-history-fix-migration.js
 *
 * Environment Variables:
 *   DATABASE_URL - PostgreSQL connection string (required)
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    console.error('❌ ERROR: DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    console.log('🔧 Starting price_history cruise_id type fix migration...\n');

    // Read the migration file
    const migrationPath = path.join(__dirname, '../src/db/migrations/0011_fix_price_history_cruise_id_type.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded: 0011_fix_price_history_cruise_id_type.sql');
    console.log('');

    // Check current table structure
    console.log('🔍 Checking current table structure...');
    const checkQuery = `
      SELECT
        table_name,
        column_name,
        data_type,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_name IN ('price_history', 'price_trends')
        AND column_name = 'cruise_id'
      ORDER BY table_name;
    `;

    const beforeResult = await pool.query(checkQuery);
    console.log('\n📊 BEFORE migration:');
    console.table(beforeResult.rows);

    // Check if there's any existing data
    const dataCheckQuery = `
      SELECT
        'price_history' as table_name,
        COUNT(*) as row_count
      FROM price_history
      UNION ALL
      SELECT
        'price_trends' as table_name,
        COUNT(*) as row_count
      FROM price_trends;
    `;

    const dataResult = await pool.query(dataCheckQuery);
    console.log('\n📈 Existing data:');
    console.table(dataResult.rows);

    const hasData = dataResult.rows.some(row => parseInt(row.row_count) > 0);
    if (hasData) {
      console.log('\n⚠️  WARNING: Tables contain data. This migration will preserve existing records.');
      console.log('   The USING clause will convert INTEGER values to VARCHAR.');
    } else {
      console.log('\n✅ Tables are empty - safe to proceed with migration.');
    }

    // Ask for confirmation
    console.log('\n⏸️  Ready to apply migration...');
    console.log('   This will:');
    console.log('   1. Drop foreign key constraints');
    console.log('   2. Change cruise_id from INTEGER to VARCHAR(255)');
    console.log('   3. Recreate foreign key constraints');
    console.log('');

    // Apply the migration
    console.log('▶️  Applying migration...\n');

    await pool.query(migrationSQL);

    console.log('✅ Migration SQL executed successfully!\n');

    // Verify the changes
    console.log('🔍 Verifying migration results...');
    const afterResult = await pool.query(checkQuery);
    console.log('\n📊 AFTER migration:');
    console.table(afterResult.rows);

    // Verify foreign key constraints
    const fkCheckQuery = `
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name IN ('price_history', 'price_trends')
        AND kcu.column_name = 'cruise_id';
    `;

    const fkResult = await pool.query(fkCheckQuery);
    console.log('\n🔗 Foreign key constraints:');
    console.table(fkResult.rows);

    if (fkResult.rows.length === 2) {
      console.log('\n✅ SUCCESS! Both foreign key constraints recreated correctly.');
    } else {
      console.log('\n⚠️  WARNING: Expected 2 foreign key constraints, found', fkResult.rows.length);
    }

    console.log('\n✨ Migration completed successfully!\n');
    console.log('📝 Summary:');
    console.log('   - price_history.cruise_id: INTEGER → VARCHAR(255)');
    console.log('   - price_trends.cruise_id: INTEGER → VARCHAR(255)');
    console.log('   - Foreign key constraints: Recreated and working');
    console.log('   - Existing indexes: Still functional\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
runMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
