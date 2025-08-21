#!/usr/bin/env node

/**
 * Fix missing columns in staging database
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

async function fixMissingColumns() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Adding missing columns to staging database...\n');
    
    // Add amenities column to ships table
    console.log('Adding amenities column to ships table...');
    await client.query(`
      ALTER TABLE ships 
      ADD COLUMN IF NOT EXISTS amenities TEXT[]
    `);
    console.log('✅ Added amenities column to ships\n');
    
    // Add city column to ports table
    console.log('Adding city column to ports table...');
    await client.query(`
      ALTER TABLE ports 
      ADD COLUMN IF NOT EXISTS city VARCHAR(255)
    `);
    console.log('✅ Added city column to ports\n');
    
    // Check for other potentially missing columns
    console.log('Checking and adding other potentially missing columns...');
    
    // Ships table
    await client.query(`
      ALTER TABLE ships
      ADD COLUMN IF NOT EXISTS deck_plans TEXT,
      ADD COLUMN IF NOT EXISTS videos TEXT[],
      ADD COLUMN IF NOT EXISTS virtual_tours TEXT[]
    `);
    
    // Ports table
    await client.query(`
      ALTER TABLE ports
      ADD COLUMN IF NOT EXISTS region VARCHAR(100),
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS timezone VARCHAR(50)
    `);
    
    // Cruises table
    await client.query(`
      ALTER TABLE cruises
      ADD COLUMN IF NOT EXISTS marketing_description TEXT,
      ADD COLUMN IF NOT EXISTS highlights TEXT[],
      ADD COLUMN IF NOT EXISTS included_features TEXT[],
      ADD COLUMN IF NOT EXISTS optional_features TEXT[]
    `);
    
    console.log('✅ All columns added successfully\n');
    
    // Verify the columns exist
    console.log('Verifying columns...');
    
    const shipsColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'ships' 
      AND column_name IN ('amenities', 'deck_plans', 'videos', 'virtual_tours')
    `);
    console.log(`Ships columns found: ${shipsColumns.rows.map(r => r.column_name).join(', ')}`);
    
    const portsColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'ports' 
      AND column_name IN ('city', 'region', 'description', 'timezone')
    `);
    console.log(`Ports columns found: ${portsColumns.rows.map(r => r.column_name).join(', ')}`);
    
    const cruisesColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'cruises' 
      AND column_name IN ('marketing_description', 'highlights', 'included_features', 'optional_features')
    `);
    console.log(`Cruises columns found: ${cruisesColumns.rows.map(r => r.column_name).join(', ')}`);
    
    console.log('\n✅ All missing columns have been added to staging database!');
    
  } catch (error) {
    console.error('❌ Error adding columns:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the fix
fixMissingColumns()
  .then(() => {
    console.log('\n🎉 Staging database schema fixed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Failed to fix staging database:', error);
    process.exit(1);
  });