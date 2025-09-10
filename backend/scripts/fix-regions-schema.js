#!/usr/bin/env node

/**
 * Fix regions table schema mismatch
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const { db } = require('../dist/db');
const { sql } = require('drizzle-orm');

async function fixSchema() {
  try {
    console.log('Checking regions table schema...');

    // Check if display_order column exists
    const checkColumn = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'regions'
      AND column_name = 'display_order'
    `);

    if (checkColumn.length === 0) {
      console.log('Adding missing display_order column...');
      await db.execute(sql`
        ALTER TABLE regions
        ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0
      `);
      console.log('✅ Added display_order column');
    } else {
      console.log('✅ display_order column already exists');
    }

    // Check for is_popular column
    const checkPopular = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'regions'
      AND column_name = 'is_popular'
    `);

    if (checkPopular.length === 0) {
      console.log('Adding missing is_popular column...');
      await db.execute(sql`
        ALTER TABLE regions
        ADD COLUMN IF NOT EXISTS is_popular BOOLEAN DEFAULT false
      `);
      console.log('✅ Added is_popular column');
    } else {
      console.log('✅ is_popular column already exists');
    }

    // Check for parent_region_id column
    const checkParent = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'regions'
      AND column_name = 'parent_region_id'
    `);

    if (checkParent.length === 0) {
      console.log('Adding missing parent_region_id column...');
      await db.execute(sql`
        ALTER TABLE regions
        ADD COLUMN IF NOT EXISTS parent_region_id INTEGER REFERENCES regions(id)
      `);
      console.log('✅ Added parent_region_id column');
    } else {
      console.log('✅ parent_region_id column already exists');
    }

    console.log('\n✅ Schema fixes applied successfully!');

  } catch (error) {
    console.error('❌ Error fixing schema:', error);
  }

  process.exit(0);
}

fixSchema();
