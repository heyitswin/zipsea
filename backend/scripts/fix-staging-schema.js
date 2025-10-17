#!/usr/bin/env node
/**
 * Fix staging database schema - add missing pricing columns
 * Run this against staging database to sync it with production schema
 */

const { Client } = require('pg');
require('dotenv').config();

async function fixStagingSchema() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check if columns exist first
    const checkQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'cruises'
        AND column_name IN ('interior_price', 'oceanview_price', 'balcony_price', 'suite_price', 'cheapest_price')
      ORDER BY column_name;
    `;

    const existingCols = await client.query(checkQuery);
    const existingColNames = existingCols.rows.map(r => r.column_name);

    console.log('\n📋 Existing pricing columns:', existingColNames);

    const requiredColumns = [
      'interior_price',
      'oceanview_price',
      'balcony_price',
      'suite_price',
      'cheapest_price',
    ];

    const missingColumns = requiredColumns.filter(col => !existingColNames.includes(col));

    if (missingColumns.length === 0) {
      console.log('\n✅ All pricing columns already exist!');
      return;
    }

    console.log('\n⚠️  Missing columns:', missingColumns);
    console.log('\n🔧 Adding missing columns...\n');

    // Add missing columns
    for (const col of missingColumns) {
      try {
        const alterQuery = `
          ALTER TABLE cruises
          ADD COLUMN IF NOT EXISTS ${col} DECIMAL(10, 2);
        `;
        await client.query(alterQuery);
        console.log(`✅ Added column: ${col}`);
      } catch (err) {
        console.error(`❌ Error adding ${col}:`, err.message);
      }
    }

    console.log('\n✅ Schema fix complete!');

    // Verify
    const verifyResult = await client.query(checkQuery);
    console.log(
      '\n📋 Final columns:',
      verifyResult.rows.map(r => r.column_name)
    );
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

fixStagingSchema().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
