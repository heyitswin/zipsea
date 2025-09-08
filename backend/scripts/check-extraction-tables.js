const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_URL_PRODUCTION,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false
});

async function checkTables() {
  const client = await pool.connect();
  
  console.log('📋 Checking Extraction Tables');
  console.log('=' .repeat(60));
  
  // List all tables
  const tables = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  
  console.log('\nTables in database:');
  tables.rows.forEach(row => {
    if (row.table_name.includes('cabin') || 
        row.table_name.includes('itinerary') || 
        row.table_name.includes('pricing')) {
      console.log(`  ✓ ${row.table_name}`);
    }
  });
  
  // Check cheapest_pricing structure
  const pricingCols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'cheapest_pricing'
    ORDER BY ordinal_position
  `);
  
  console.log('\n📊 cheapest_pricing columns:');
  pricingCols.rows.forEach(col => {
    console.log(`  - ${col.column_name}: ${col.data_type}`);
  });
  
  // Check if cruise_itinerary exists
  const itineraryExists = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'cruise_itinerary'
    )
  `);
  
  if (!itineraryExists.rows[0].exists) {
    console.log('\n⚠️  cruise_itinerary table does not exist!');
  }
  
  // Check if cabin_categories exists
  const cabinExists = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'cabin_categories'
    )
  `);
  
  if (!cabinExists.rows[0].exists) {
    console.log('⚠️  cabin_categories table does not exist!');
  }
  
  client.release();
  await pool.end();
}

checkTables();
