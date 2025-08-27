#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

async function addPricingColumns() {
  console.log('🔄 Adding pricing columns to cruises table...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    // First check what columns currently exist
    console.log('\n📊 Checking current columns...');
    const currentColumns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'cruises' 
      AND column_name IN ('interior_price', 'oceanview_price', 'balcony_price', 'suite_price', 'cheapest_price', 'needs_price_update')
    `);
    
    console.log('Existing pricing columns:', currentColumns.rows.map(r => r.column_name));
    
    // Add missing columns one by one to avoid errors
    const columnsToAdd = [
      { name: 'interior_price', type: 'DECIMAL(10, 2)', comment: 'Interior cabin cheapest price' },
      { name: 'oceanview_price', type: 'DECIMAL(10, 2)', comment: 'Oceanview cabin cheapest price' },
      { name: 'balcony_price', type: 'DECIMAL(10, 2)', comment: 'Balcony cabin cheapest price' },
      { name: 'suite_price', type: 'DECIMAL(10, 2)', comment: 'Suite cabin cheapest price' },
      { name: 'cheapest_price', type: 'DECIMAL(10, 2)', comment: 'Overall cheapest price' },
      { name: 'needs_price_update', type: 'BOOLEAN DEFAULT false', comment: 'Flag for pending price updates' }
    ];
    
    for (const column of columnsToAdd) {
      const exists = currentColumns.rows.some(r => r.column_name === column.name);
      if (!exists) {
        console.log(`\n➕ Adding column: ${column.name}`);
        try {
          await pool.query(`ALTER TABLE cruises ADD COLUMN ${column.name} ${column.type}`);
          console.log(`✅ Added ${column.name}`);
          
          // Add comment
          await pool.query(`COMMENT ON COLUMN cruises.${column.name} IS '${column.comment}'`);
        } catch (err) {
          if (err.message.includes('already exists')) {
            console.log(`⚠️ Column ${column.name} already exists`);
          } else {
            console.error(`❌ Failed to add ${column.name}:`, err.message);
          }
        }
      } else {
        console.log(`✓ Column ${column.name} already exists`);
      }
    }
    
    // Create indexes for performance
    console.log('\n📊 Creating indexes...');
    try {
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_cruises_needs_price_update 
        ON cruises(needs_price_update) 
        WHERE needs_price_update = true
      `);
      console.log('✅ Created needs_price_update index');
    } catch (err) {
      console.log('Index may already exist:', err.message);
    }
    
    // Verify all columns were added
    console.log('\n🔍 Verifying columns...');
    const verifyResult = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'cruises'
      AND column_name IN ('interior_price', 'oceanview_price', 'balcony_price', 'suite_price', 'cheapest_price', 'needs_price_update')
      ORDER BY column_name
    `);
    
    console.log('\n✅ Final pricing columns in cruises table:');
    console.table(verifyResult.rows);
    
    // Mark cruises as needing price update
    console.log('\n🔄 Marking cruises for price update...');
    const updateResult = await pool.query(`
      UPDATE cruises 
      SET needs_price_update = true
      WHERE sailing_date >= CURRENT_DATE
      AND (interior_price IS NULL OR oceanview_price IS NULL OR balcony_price IS NULL OR suite_price IS NULL)
      RETURNING id
    `);
    
    console.log(`✅ Marked ${updateResult.rowCount} cruises for price update`);
    
    // Show statistics
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_cruises,
        COUNT(CASE WHEN needs_price_update = true THEN 1 END) as needs_update,
        COUNT(CASE WHEN interior_price IS NOT NULL THEN 1 END) as has_interior,
        COUNT(CASE WHEN oceanview_price IS NOT NULL THEN 1 END) as has_oceanview,
        COUNT(CASE WHEN balcony_price IS NOT NULL THEN 1 END) as has_balcony,
        COUNT(CASE WHEN suite_price IS NOT NULL THEN 1 END) as has_suite
      FROM cruises
      WHERE sailing_date >= CURRENT_DATE
    `);
    
    console.log('\n📈 Cruise pricing statistics:');
    console.table(stats.rows);
    
    console.log('\n✅ Database is ready for price sync!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
  
  process.exit(0);
}

// Check for database connection
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  console.log('Please ensure you have a .env file with DATABASE_URL');
  process.exit(1);
}

console.log('🔗 Connecting to database...');
addPricingColumns().catch(console.error);