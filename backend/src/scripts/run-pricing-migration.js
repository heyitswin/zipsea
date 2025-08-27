#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runPricingMigration() {
  console.log('🔄 Running pricing columns migration on production database...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    // Read the migration SQL
    const migrationPath = path.join(__dirname, '../db/migrations/add-pricing-columns.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('\n📋 Migration SQL to execute:');
    console.log(migrationSQL);
    
    // Execute the migration
    console.log('\n🚀 Executing migration...');
    await pool.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    
    // Verify the columns were added
    console.log('\n🔍 Verifying new columns...');
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'cruises' 
      AND column_name IN (
        'interior_cheapest_price', 
        'oceanview_cheapest_price', 
        'balcony_cheapest_price', 
        'suite_cheapest_price',
        'needs_price_update',
        'processing_started_at',
        'processing_completed_at'
      )
      ORDER BY column_name
    `);
    
    console.log('\n📊 New columns in cruises table:');
    console.table(result.rows);
    
    // Check how many cruises need price updates
    const needsUpdateResult = await pool.query(`
      SELECT COUNT(*) as total_cruises,
             COUNT(CASE WHEN needs_price_update = true THEN 1 END) as needs_update,
             COUNT(CASE WHEN interior_cheapest_price IS NOT NULL THEN 1 END) as has_interior_price,
             COUNT(CASE WHEN oceanview_cheapest_price IS NOT NULL THEN 1 END) as has_oceanview_price,
             COUNT(CASE WHEN balcony_cheapest_price IS NOT NULL THEN 1 END) as has_balcony_price,
             COUNT(CASE WHEN suite_cheapest_price IS NOT NULL THEN 1 END) as has_suite_price
      FROM cruises
      WHERE sailing_date >= CURRENT_DATE
    `);
    
    console.log('\n📈 Current cruise pricing statistics:');
    console.table(needsUpdateResult.rows);
    
    // Mark all future cruises as needing price update
    console.log('\n🔄 Marking future cruises as needing price update...');
    const updateResult = await pool.query(`
      UPDATE cruises 
      SET needs_price_update = true 
      WHERE sailing_date >= CURRENT_DATE
        AND interior_cheapest_price IS NULL
      RETURNING id
    `);
    
    console.log(`✅ Marked ${updateResult.rowCount} cruises for price update`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('\n🔧 Please run the following SQL manually on the production database:');
    console.error(`
ALTER TABLE cruises 
ADD COLUMN IF NOT EXISTS interior_cheapest_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS oceanview_cheapest_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS balcony_cheapest_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS suite_cheapest_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS needs_price_update BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMP;
    `);
    process.exit(1);
  } finally {
    await pool.end();
  }
  
  console.log('\n✅ Migration completed successfully!');
  console.log('The batch sync service should now be able to update cruise prices.');
  process.exit(0);
}

// Check if we have database connection
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable not set');
  process.exit(1);
}

runPricingMigration().catch(console.error);