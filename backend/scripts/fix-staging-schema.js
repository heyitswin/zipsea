#!/usr/bin/env node

/**
 * Quick fix to add missing columns to staging database
 */

require('dotenv').config();
const postgres = require('postgres');

async function fixSchema() {
  if (!process.env.DATABASE_URL) {
    console.log('No DATABASE_URL found');
    return;
  }

  console.log('🔧 Fixing staging database schema...\n');
  
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  
  try {
    // Add missing columns to cruise_lines table
    console.log('Adding missing columns to cruise_lines...');
    
    await sql`
      ALTER TABLE cruise_lines 
      ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500),
      ADD COLUMN IF NOT EXISTS website VARCHAR(255),
      ADD COLUMN IF NOT EXISTS headquarters VARCHAR(255),
      ADD COLUMN IF NOT EXISTS founded_year INTEGER,
      ADD COLUMN IF NOT EXISTS fleet_size INTEGER;
    `;
    
    console.log('✅ cruise_lines table updated');
    
    // Check if there are other missing columns in ships table
    console.log('\nAdding missing columns to ships...');
    
    await sql`
      ALTER TABLE ships 
      ADD COLUMN IF NOT EXISTS ship_class VARCHAR(255),
      ADD COLUMN IF NOT EXISTS tonnage INTEGER,
      ADD COLUMN IF NOT EXISTS total_cabins INTEGER,
      ADD COLUMN IF NOT EXISTS capacity INTEGER,
      ADD COLUMN IF NOT EXISTS decks INTEGER,
      ADD COLUMN IF NOT EXISTS launched_year INTEGER,
      ADD COLUMN IF NOT EXISTS rating INTEGER,
      ADD COLUMN IF NOT EXISTS highlights TEXT,
      ADD COLUMN IF NOT EXISTS default_image_url VARCHAR(500),
      ADD COLUMN IF NOT EXISTS default_image_url_hd VARCHAR(500),
      ADD COLUMN IF NOT EXISTS images JSONB,
      ADD COLUMN IF NOT EXISTS additional_info TEXT;
    `;
    
    console.log('✅ ships table updated');
    
    // Add any missing columns to cruises table
    console.log('\nAdding missing columns to cruises...');
    
    await sql`
      ALTER TABLE cruises 
      ADD COLUMN IF NOT EXISTS voyage_code VARCHAR(50),
      ADD COLUMN IF NOT EXISTS sail_nights INTEGER,
      ADD COLUMN IF NOT EXISTS sea_days INTEGER,
      ADD COLUMN IF NOT EXISTS no_fly BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS depart_uk BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS fly_cruise_info JSONB,
      ADD COLUMN IF NOT EXISTS line_content TEXT,
      ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'USD';
    `;
    
    console.log('✅ cruises table updated');
    
    console.log('\n✅ All schema fixes applied successfully!');
    console.log('\nYou can now run the sync script again.');
    
  } catch (error) {
    console.error('Error fixing schema:', error.message);
    console.error('\nFull error:', error);
  } finally {
    await sql.end();
  }
}

fixSchema();