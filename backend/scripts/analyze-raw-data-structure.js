const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_URL_PRODUCTION,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false
});

async function analyze() {
  const client = await pool.connect();
  
  // Get a sample of raw_data to understand structure
  const samples = await client.query(`
    SELECT 
      id,
      name,
      raw_data
    FROM cruises
    WHERE raw_data IS NOT NULL
      AND raw_data->>'cheapest' IS NULL
      AND is_active = true
    LIMIT 5
  `);
  
  console.log('Analyzing raw_data structure for cruises without "cheapest" field:\n');
  
  for (const row of samples.rows) {
    console.log(`Cruise: ${row.name} (${row.id})`);
    console.log('Raw data keys:', Object.keys(row.raw_data));
    
    // Check for pricing fields
    const possiblePriceFields = [
      'cheapestprice', 'cheapestinside', 'cheapestoutside', 
      'cheapestbalcony', 'cheapestsuite', 'prices', 'pricing',
      'cabins', 'cheapest'
    ];
    
    for (const field of possiblePriceFields) {
      if (row.raw_data[field]) {
        console.log(`  ${field}:`, typeof row.raw_data[field] === 'object' 
          ? JSON.stringify(row.raw_data[field]).substring(0, 100) + '...'
          : row.raw_data[field]);
      }
    }
    console.log('\n');
  }
  
  client.release();
  await pool.end();
}

analyze();
