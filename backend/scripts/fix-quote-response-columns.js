#!/usr/bin/env node

/**
 * Add missing columns to quote_requests table
 * This fixes the 500 error when responding to quotes
 */

const { db } = require('../dist/db/connection.js');
const { sql } = require('drizzle-orm');

async function addMissingColumns() {
  console.log('🔧 Adding missing columns to quote_requests table...\n');

  try {
    // Check if columns already exist
    const checkColumns = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'quote_requests'
      AND column_name IN ('quote_response', 'quoted_at', 'notes')
    `);

    const existingColumns = checkColumns.map(row => row.column_name);
    console.log('Existing columns:', existingColumns);

    // Add quote_response column if it doesn't exist
    if (!existingColumns.includes('quote_response')) {
      console.log('Adding quote_response column...');
      await db.execute(sql`
        ALTER TABLE quote_requests
        ADD COLUMN IF NOT EXISTS quote_response JSONB
      `);
      console.log('✅ quote_response column added');
    } else {
      console.log('✓ quote_response column already exists');
    }

    // Add quoted_at column if it doesn't exist
    if (!existingColumns.includes('quoted_at')) {
      console.log('Adding quoted_at column...');
      await db.execute(sql`
        ALTER TABLE quote_requests
        ADD COLUMN IF NOT EXISTS quoted_at TIMESTAMP
      `);
      console.log('✅ quoted_at column added');
    } else {
      console.log('✓ quoted_at column already exists');
    }

    // Add notes column if it doesn't exist
    if (!existingColumns.includes('notes')) {
      console.log('Adding notes column...');
      await db.execute(sql`
        ALTER TABLE quote_requests
        ADD COLUMN IF NOT EXISTS notes TEXT
      `);
      console.log('✅ notes column added');
    } else {
      console.log('✓ notes column already exists');
    }

    // Verify all columns exist
    console.log('\n📊 Verifying table structure...');
    const verifyColumns = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'quote_requests'
      ORDER BY ordinal_position
    `);

    console.log('\nCurrent quote_requests columns:');
    verifyColumns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    console.log('\n✅ Quote response columns fixed successfully!');

  } catch (error) {
    console.error('❌ Error adding columns:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run the fix
addMissingColumns().catch(console.error);
