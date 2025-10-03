#!/usr/bin/env node

/**
 * Fix Staging Database Schema
 * Adds missing columns to match production schema
 */

const postgres = require('postgres');

const STAGING_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_STAGING;

if (!STAGING_URL) {
  console.error('❌ DATABASE_URL or DATABASE_URL_STAGING environment variable required');
  process.exit(1);
}

async function fixSchema() {
  console.log('🔧 Fixing staging database schema...');

  const sql = postgres(STAGING_URL, {
    ssl: STAGING_URL.includes('render.com') ? { rejectUnauthorized: false } : false,
  });

  try {
    // Add missing columns to ports table
    console.log('\n📋 Checking ports table...');
    const portsCheck = await sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='ports' AND column_name='raw_port_data'
      ) as has_column
    `;

    if (!portsCheck[0].has_column) {
      console.log('  ➕ Adding raw_port_data column to ports...');
      await sql`ALTER TABLE ports ADD COLUMN raw_port_data JSONB`;
      console.log('  ✅ Added raw_port_data to ports');
    } else {
      console.log('  ✅ ports.raw_port_data already exists');
    }

    // Add missing columns to regions table
    console.log('\n📋 Checking regions table...');
    const regionsCheck = await sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='regions' AND column_name='code'
      ) as has_column
    `;

    if (!regionsCheck[0].has_column) {
      console.log('  ➕ Adding code column to regions...');
      await sql`ALTER TABLE regions ADD COLUMN code VARCHAR(10)`;
      console.log('  ✅ Added code to regions');
    } else {
      console.log('  ✅ regions.code already exists');
    }

    // Verify all columns exist
    console.log('\n🔍 Verifying schema...');

    const portsColumns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'ports'
      ORDER BY ordinal_position
    `;
    console.log('  ports columns:', portsColumns.map(c => c.column_name).join(', '));

    const regionsColumns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'regions'
      ORDER BY ordinal_position
    `;
    console.log('  regions columns:', regionsColumns.map(c => c.column_name).join(', '));

    console.log('\n✅ Schema fix completed successfully!');
  } catch (error) {
    console.error('\n❌ Error fixing schema:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

fixSchema();
