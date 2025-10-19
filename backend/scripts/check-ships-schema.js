#!/usr/bin/env node

/**
 * Check Ships Table Schema
 *
 * Shows all columns in the ships table to understand schema differences
 */

const postgres = require('postgres');
require('dotenv').config();

async function main() {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error('❌ Missing DATABASE_URL environment variable');
    process.exit(1);
  }

  console.log('🔍 Checking ships table schema...\n');

  const sql = postgres(dbUrl, { max: 2, ssl: 'require' });

  try {
    // Get all columns in ships table
    const columns = await sql`
      SELECT
        column_name,
        data_type,
        character_maximum_length,
        numeric_precision,
        numeric_scale,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'ships'
      ORDER BY ordinal_position
    `;

    if (columns.length === 0) {
      console.log('❌ Ships table not found or has no columns');
      process.exit(1);
    }

    console.log(`✅ Found ${columns.length} columns in ships table:\n`);

    columns.forEach(col => {
      let typeInfo = col.data_type;
      if (col.character_maximum_length) {
        typeInfo += `(${col.character_maximum_length})`;
      } else if (col.numeric_precision) {
        typeInfo += `(${col.numeric_precision},${col.numeric_scale || 0})`;
      }

      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';

      console.log(`  ${col.column_name}: ${typeInfo} ${nullable}${defaultVal}`);
    });

    // Check if we have common ship-related columns
    const columnNames = columns.map(c => c.column_name);
    const expectedColumns = [
      'id', 'ship_id', 'name', 'cruise_line_id',
      'passenger_capacity', 'crew_size', 'tonnage',
      'year_built', 'refurbished_year', 'length', 'beam'
    ];

    console.log('\n📋 Column check:');
    expectedColumns.forEach(col => {
      if (columnNames.includes(col)) {
        console.log(`  ✅ ${col}`);
      } else {
        console.log(`  ❌ ${col} - MISSING`);
      }
    });

  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
