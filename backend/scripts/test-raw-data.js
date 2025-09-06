#!/usr/bin/env node

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testRawData() {
  try {
    console.log('Testing raw_data field...\n');

    // Check a specific cruise
    const result = await pool.query(`
      SELECT
        id,
        name,
        raw_data IS NOT NULL as has_raw_data,
        raw_data->'cheapest'->'combined'->>'inside' as interior_price,
        raw_data->'cheapest'->'combined'->>'outside' as oceanview_price,
        raw_data->'cheapest'->'combined'->>'balcony' as balcony_price,
        raw_data->'cheapest'->'combined'->>'suite' as suite_price,
        jsonb_array_length(COALESCE(raw_data->'itinerary', '[]'::jsonb)) as itinerary_count
      FROM cruises
      WHERE id = '2169275'
    `);

    if (result.rows.length > 0) {
      const cruise = result.rows[0];
      console.log('Cruise 2169275:');
      console.log('  Name:', cruise.name);
      console.log('  Has raw_data:', cruise.has_raw_data);
      console.log('  Interior price:', cruise.interior_price);
      console.log('  Oceanview price:', cruise.oceanview_price);
      console.log('  Balcony price:', cruise.balcony_price);
      console.log('  Suite price:', cruise.suite_price);
      console.log('  Itinerary days:', cruise.itinerary_count);
    } else {
      console.log('Cruise 2169275 not found');
    }

    // Check how many cruises have pricing in raw_data
    const statsResult = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN raw_data->'cheapest'->'combined' IS NOT NULL THEN 1 END) as has_pricing
      FROM cruises
      WHERE raw_data IS NOT NULL
    `);

    const stats = statsResult.rows[0];
    console.log('\nOverall stats:');
    console.log('  Cruises with raw_data:', stats.total);
    console.log('  Cruises with pricing:', stats.has_pricing);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

testRawData();
