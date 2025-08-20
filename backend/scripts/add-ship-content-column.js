#!/usr/bin/env node

/**
 * Add ship_content column to ships table
 */

require('dotenv').config();
const { db } = require('../dist/db/connection');
const { sql } = require('drizzle-orm');

async function addShipContentColumn() {
  console.log('Adding ship_content column to ships table...');
  
  try {
    // Add the column if it doesn't exist
    await db.execute(sql`
      ALTER TABLE ships 
      ADD COLUMN IF NOT EXISTS ship_content JSONB
    `);
    
    console.log('✅ Successfully added ship_content column');
  } catch (error) {
    console.error('❌ Error adding column:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

addShipContentColumn();