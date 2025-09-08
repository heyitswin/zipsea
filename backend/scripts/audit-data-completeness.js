const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_URL_PRODUCTION,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false
});

async function auditData() {
  const client = await pool.connect();
  
  console.log('📊 DATA COMPLETENESS AUDIT');
  console.log('=' .repeat(80));
  
  // 1. Check what's in raw_data
  const sample = await client.query(`
    SELECT 
      c.id,
      c.name,
      cl.name as cruise_line,
      c.raw_data
    FROM cruises c
    JOIN cruise_lines cl ON c.cruise_line_id = cl.id
    WHERE c.raw_data IS NOT NULL
      AND cl.name = 'Royal Caribbean'
    LIMIT 1
  `);
  
  if (sample.rows.length > 0) {
    const cruise = sample.rows[0];
    const raw = cruise.raw_data;
    
    console.log(`\n🚢 Sample Royal Caribbean Cruise: ${cruise.name}`);
    console.log('-'.repeat(60));
    
    // Check what data we have
    console.log('\n✅ Data Available in raw_data:');
    console.log(`  - Cruise name: ${raw.name ? 'YES' : 'NO'}`);
    console.log(`  - Ship info: ${raw.shipcontent ? 'YES' : 'NO'}`);
    console.log(`  - Itinerary: ${raw.itinerary ? `YES (${Array.isArray(raw.itinerary) ? raw.itinerary.length + ' days' : 'string'})` : 'NO'}`);
    console.log(`  - Cabins: ${raw.cabins ? `YES (${Object.keys(raw.cabins || {}).length} types)` : 'NO'}`);
    console.log(`  - Pricing: ${raw.cheapestprice ? 'YES' : 'NO'}`);
    console.log(`  - Ports: ${raw.ports ? 'YES' : 'NO'}`);
    console.log(`  - Regions: ${raw.regions ? 'YES' : 'NO'}`);
    
    // Check cabin details
    if (raw.cabins) {
      console.log('\n📸 Cabin Data Sample:');
      const firstCabin = Object.values(raw.cabins)[0];
      if (firstCabin) {
        console.log(`  - Name: ${firstCabin.name || 'N/A'}`);
        console.log(`  - Type: ${firstCabin.codtype || 'N/A'}`);
        console.log(`  - Image: ${firstCabin.imageurl ? 'YES' : 'NO'}`);
        console.log(`  - Description: ${firstCabin.description ? 'YES' : 'NO'}`);
      }
    }
    
    // Check itinerary details
    if (raw.itinerary && Array.isArray(raw.itinerary)) {
      console.log('\n🗺️ Itinerary Sample (Day 1):');
      const day1 = raw.itinerary[0];
      if (day1) {
        console.log(`  - Port: ${day1.name || day1.portname || 'N/A'}`);
        console.log(`  - Arrival: ${day1.arrivetime || 'N/A'}`);
        console.log(`  - Departure: ${day1.departtime || 'N/A'}`);
        console.log(`  - Description: ${day1.description ? 'YES' : 'NO'}`);
      }
    }
  }
  
  // 2. Check overall data coverage
  const coverage = await client.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN raw_data IS NOT NULL THEN 1 END) as with_raw_data,
      COUNT(CASE WHEN raw_data->>'cheapestprice' IS NOT NULL THEN 1 END) as with_pricing,
      COUNT(CASE WHEN raw_data->>'itinerary' IS NOT NULL THEN 1 END) as with_itinerary,
      COUNT(CASE WHEN raw_data->>'cabins' IS NOT NULL THEN 1 END) as with_cabins,
      COUNT(CASE WHEN interior_price IS NOT NULL THEN 1 END) as extracted_pricing
    FROM cruises
    WHERE cruise_line_id = (SELECT id FROM cruise_lines WHERE name = 'Royal Caribbean')
      AND is_active = true
  `);
  
  const stats = coverage.rows[0];
  console.log('\n📈 Royal Caribbean Data Coverage:');
  console.log('-'.repeat(60));
  console.log(`Total cruises: ${stats.total}`);
  console.log(`With raw_data: ${stats.with_raw_data} (${(stats.with_raw_data/stats.total*100).toFixed(1)}%)`);
  console.log(`With pricing data: ${stats.with_pricing} (${(stats.with_pricing/stats.total*100).toFixed(1)}%)`);
  console.log(`With itinerary: ${stats.with_itinerary} (${(stats.with_itinerary/stats.total*100).toFixed(1)}%)`);
  console.log(`With cabin info: ${stats.with_cabins} (${(stats.with_cabins/stats.total*100).toFixed(1)}%)`);
  console.log(`Pricing extracted to columns: ${stats.extracted_pricing} (${(stats.extracted_pricing/stats.total*100).toFixed(1)}%)`);
  
  // 3. Check what tables we need to populate
  console.log('\n📋 Tables That Need Population:');
  console.log('-'.repeat(60));
  
  // Check cruise_itinerary table
  const itineraryCount = await client.query(`
    SELECT COUNT(DISTINCT cruise_id) as count
    FROM cruise_itinerary
  `);
  console.log(`cruise_itinerary: ${itineraryCount.rows[0].count} cruises have itinerary`);
  
  // Check cabin_categories table
  const cabinCount = await client.query(`
    SELECT COUNT(DISTINCT cruise_id) as count
    FROM cabin_categories
  `);
  console.log(`cabin_categories: ${cabinCount.rows[0].count} cruises have cabin data`);
  
  // Check cheapest_pricing table
  const pricingCount = await client.query(`
    SELECT COUNT(DISTINCT cruise_id) as count
    FROM cheapest_pricing
  `);
  console.log(`cheapest_pricing: ${pricingCount.rows[0].count} cruises have pricing`);
  
  client.release();
  await pool.end();
  
  console.log('\n' + '=' .repeat(80));
  console.log('\n🎯 NEXT STEPS:');
  console.log('1. Extract all data from raw_data to proper tables');
  console.log('2. Fix webhook to process ALL cruises, not just 500');
  console.log('3. Implement efficient batch downloading (connection pooling)');
  console.log('4. Set up proper data extraction pipeline');
}

auditData();
