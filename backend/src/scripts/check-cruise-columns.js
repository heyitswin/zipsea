#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

async function checkCruiseColumns() {
  console.log('🔍 Checking columns in cruises table...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    // Get all columns from cruises table
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'cruises'
      AND column_name LIKE '%price%' OR column_name LIKE '%cheapest%' OR column_name = 'needs_price_update'
      ORDER BY column_name
    `);
    
    console.log('\n📊 Pricing-related columns in cruises table:');
    if (result.rows.length === 0) {
      console.log('❌ No pricing columns found in cruises table');
    } else {
      console.table(result.rows);
    }
    
    // Check if needs_price_update column exists
    const needsUpdateCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'cruises'
      AND column_name = 'needs_price_update'
    `);
    
    if (needsUpdateCheck.rows.length === 0) {
      console.log('\n⚠️ Column "needs_price_update" does not exist in cruises table');
    }
    
    // Check what pricing columns actually exist
    const allColumns = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'cruises'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 All columns in cruises table:');
    console.log(allColumns.rows.map(r => r.column_name).join(', '));
    
    // Check if cheapest_pricing table exists
    const cheapestPricingCheck = await pool.query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_name = 'cheapest_pricing'
    `);
    
    console.log(`\n📊 cheapest_pricing table exists: ${cheapestPricingCheck.rows[0].count > 0 ? 'YES' : 'NO'}`);
    
    // Sample data from cruises to see what we have
    const sampleCruise = await pool.query(`
      SELECT id, cruise_id, name, sailing_date, 
             interior_price, oceanview_price, balcony_price, suite_price, cheapest_price
      FROM cruises
      WHERE sailing_date >= CURRENT_DATE
      LIMIT 1
    `);
    
    if (sampleCruise.rows.length > 0) {
      console.log('\n📝 Sample cruise data:');
      console.table(sampleCruise.rows);
    }
    
  } catch (error) {
    console.error('❌ Error checking columns:', error.message);
    
    // If columns don't exist, show the SQL needed to add them
    if (error.message.includes('column') && error.message.includes('does not exist')) {
      console.log('\n🔧 To fix this, run the following SQL:');
      console.log(`
ALTER TABLE cruises 
ADD COLUMN IF NOT EXISTS interior_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS oceanview_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS balcony_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS suite_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS cheapest_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS needs_price_update BOOLEAN DEFAULT false;
      `);
    }
  } finally {
    await pool.end();
  }
}

checkCruiseColumns().catch(console.error);