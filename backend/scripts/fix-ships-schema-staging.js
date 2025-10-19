#!/usr/bin/env node

/**
 * Fix Ships Table Schema in Staging
 *
 * Changes passenger_capacity from INTEGER to DECIMAL to match production
 * This fixes the "invalid input syntax for type integer: '1083.00'" error
 */

const postgres = require('postgres');
require('dotenv').config();

async function main() {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error('❌ Missing DATABASE_URL environment variable');
    process.exit(1);
  }

  console.log('🔧 Fixing ships table schema in staging...\n');

  const sql = postgres(dbUrl, { max: 2, ssl: 'require' });

  try {
    // Check current data type
    console.log('🔍 Checking current passenger_capacity data type...');
    const [currentType] = await sql`
      SELECT data_type, character_maximum_length, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_name = 'ships' AND column_name = 'passenger_capacity'
    `;

    if (currentType) {
      console.log(`  Current type: ${currentType.data_type}`);
      if (currentType.numeric_precision) {
        console.log(`  Precision: ${currentType.numeric_precision}, Scale: ${currentType.numeric_scale}`);
      }
    } else {
      console.log('  ❌ Column not found');
      process.exit(1);
    }

    // Change to DECIMAL if it's INTEGER
    if (currentType.data_type === 'integer') {
      console.log('\n📝 Changing passenger_capacity from INTEGER to DECIMAL(10,2)...');
      await sql.unsafe(`
        ALTER TABLE ships
        ALTER COLUMN passenger_capacity TYPE DECIMAL(10,2)
      `);
      console.log('✅ Column type updated\n');
    } else if (currentType.data_type === 'numeric') {
      console.log('✅ Already DECIMAL/NUMERIC type\n');
    } else {
      console.log(`⚠️  Unexpected type: ${currentType.data_type}\n`);
    }

    // Verify the change
    console.log('🔍 Verifying new data type...');
    const [newType] = await sql`
      SELECT data_type, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_name = 'ships' AND column_name = 'passenger_capacity'
    `;

    console.log(`  New type: ${newType.data_type}`);
    if (newType.numeric_precision) {
      console.log(`  Precision: ${newType.numeric_precision}, Scale: ${newType.numeric_scale}`);
    }

    console.log('\n✅ Ships table schema fixed!');
    console.log('\n📋 Next step:');
    console.log('  Run sync again: node scripts/sync-production-to-staging-simple.js');

  } catch (err) {
    console.error('❌ Failed to fix schema:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
