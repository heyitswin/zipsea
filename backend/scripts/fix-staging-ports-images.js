#!/usr/bin/env node

/**
 * Add missing images column to ports table
 */

const { Pool } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function fixPortsImages() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Adding images column to ports table\n');
    
    // Add the missing images column (JSONB type for array of image URLs)
    await client.query(`
      ALTER TABLE ports 
      ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb
    `);
    
    console.log('✅ Added images column to ports table');
    
    // Verify the column was added
    const checkColumn = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ports' 
        AND column_name = 'images'
    `);
    
    if (checkColumn.rows.length > 0) {
      console.log('✅ Verified: images column exists with type', checkColumn.rows[0].data_type);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the fix
fixPortsImages()
  .then(() => {
    console.log('\n✅ Schema fix complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Fix failed:', error);
    process.exit(1);
  });