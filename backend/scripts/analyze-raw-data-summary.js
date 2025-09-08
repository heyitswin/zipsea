const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function analyzeRawDataSummary() {
  console.log('Analyzing raw_data JSONB fields for extraction opportunities...\n');

  try {
    // Get statistics on all important fields
    const statsResult = await pool.query(`
      SELECT
        COUNT(*) as total_cruises,
        COUNT(CASE WHEN raw_data IS NOT NULL AND raw_data::text != '{}' THEN 1 END) as with_data,

        -- Pricing fields (already being extracted)
        COUNT(CASE WHEN raw_data->>'cheapestprice' IS NOT NULL THEN 1 END) as with_cheapest_price,
        COUNT(CASE WHEN raw_data->>'cheapestinterior' IS NOT NULL THEN 1 END) as with_interior_price,
        COUNT(CASE WHEN raw_data->>'cheapestoceanview' IS NOT NULL THEN 1 END) as with_oceanview_price,
        COUNT(CASE WHEN raw_data->>'cheapestbalcony' IS NOT NULL THEN 1 END) as with_balcony_price,
        COUNT(CASE WHEN raw_data->>'cheapestsuite' IS NOT NULL THEN 1 END) as with_suite_price,

        -- Ship and cruise info (potentially useful for extraction)
        COUNT(CASE WHEN raw_data->'shipcontent'->>'name' IS NOT NULL THEN 1 END) as with_ship_name,
        COUNT(CASE WHEN raw_data->>'voyagecode' IS NOT NULL THEN 1 END) as with_voyage_code,
        COUNT(CASE WHEN raw_data->>'nights' IS NOT NULL THEN 1 END) as with_nights,
        COUNT(CASE WHEN raw_data->>'saildate' IS NOT NULL THEN 1 END) as with_sail_date,

        -- Port information (useful for search/filtering)
        COUNT(CASE WHEN raw_data->>'startportid' IS NOT NULL THEN 1 END) as with_start_port_id,
        COUNT(CASE WHEN raw_data->>'endportid' IS NOT NULL THEN 1 END) as with_end_port_id,
        COUNT(CASE WHEN raw_data->'ports' IS NOT NULL AND raw_data->'ports'::text != '{}' THEN 1 END) as with_ports_list,

        -- Destination/region info (useful for search/filtering)
        COUNT(CASE WHEN raw_data->'regions' IS NOT NULL AND raw_data->'regions'::text != '{}' THEN 1 END) as with_regions,
        COUNT(CASE WHEN raw_data->>'regionids' IS NOT NULL THEN 1 END) as with_region_ids,
        COUNT(CASE WHEN raw_data->'destinations' IS NOT NULL THEN 1 END) as with_destinations,

        -- Itinerary data (detailed port stops)
        COUNT(CASE WHEN raw_data->'itinerary' IS NOT NULL AND jsonb_typeof(raw_data->'itinerary') = 'array' THEN 1 END) as with_itinerary_array,
        COUNT(CASE WHEN raw_data->'itinerary' IS NOT NULL AND jsonb_typeof(raw_data->'itinerary') = 'string' THEN 1 END) as with_itinerary_string,

        -- Cabin information
        COUNT(CASE WHEN raw_data->'cabins' IS NOT NULL AND raw_data->'cabins'::text != '{}' THEN 1 END) as with_cabin_details,

        -- Cache/update metadata
        COUNT(CASE WHEN raw_data->>'lastcached' IS NOT NULL THEN 1 END) as with_last_cached,
        COUNT(CASE WHEN raw_data->>'cacheddate' IS NOT NULL THEN 1 END) as with_cached_date

      FROM cruises
      WHERE is_active = true
    `);

    const stats = statsResult.rows[0];
    const total = parseInt(stats.total_cruises);

    console.log('=== DATA COVERAGE ANALYSIS ===\n');
    console.log(`Total active cruises: ${total.toLocaleString()}`);
    console.log(`With raw_data: ${stats.with_data} (${(stats.with_data/total*100).toFixed(1)}%)\n`);

    console.log('=== PRICING FIELDS (Already being extracted) ===');
    console.log(`Cheapest price: ${stats.with_cheapest_price} (${(stats.with_cheapest_price/total*100).toFixed(1)}%)`);
    console.log(`Interior price: ${stats.with_interior_price} (${(stats.with_interior_price/total*100).toFixed(1)}%)`);
    console.log(`Oceanview price: ${stats.with_oceanview_price} (${(stats.with_oceanview_price/total*100).toFixed(1)}%)`);
    console.log(`Balcony price: ${stats.with_balcony_price} (${(stats.with_balcony_price/total*100).toFixed(1)}%)`);
    console.log(`Suite price: ${stats.with_suite_price} (${(stats.with_suite_price/total*100).toFixed(1)}%)\n`);

    console.log('=== HIGH-VALUE EXTRACTION CANDIDATES ===');
    console.log('Ship & Cruise Information:');
    console.log(`  Ship name: ${stats.with_ship_name} (${(stats.with_ship_name/total*100).toFixed(1)}%) - RECOMMENDED FOR EXTRACTION`);
    console.log(`  Voyage code: ${stats.with_voyage_code} (${(stats.with_voyage_code/total*100).toFixed(1)}%) - RECOMMENDED FOR EXTRACTION`);
    console.log(`  Nights: ${stats.with_nights} (${(stats.with_nights/total*100).toFixed(1)}%) - RECOMMENDED FOR EXTRACTION`);
    console.log(`  Sail date: ${stats.with_sail_date} (${(stats.with_sail_date/total*100).toFixed(1)}%) - Already in cruises table\n`);

    console.log('Port Information (for search/filtering):');
    console.log(`  Start port ID: ${stats.with_start_port_id} (${(stats.with_start_port_id/total*100).toFixed(1)}%) - RECOMMENDED FOR EXTRACTION`);
    console.log(`  End port ID: ${stats.with_end_port_id} (${(stats.with_end_port_id/total*100).toFixed(1)}%) - RECOMMENDED FOR EXTRACTION`);
    console.log(`  Ports list: ${stats.with_ports_list} (${(stats.with_ports_list/total*100).toFixed(1)}%) - Complex JSON, needs port table\n`);

    console.log('Region/Destination Information:');
    console.log(`  Regions: ${stats.with_regions} (${(stats.with_regions/total*100).toFixed(1)}%) - RECOMMENDED FOR EXTRACTION`);
    console.log(`  Region IDs: ${stats.with_region_ids} (${(stats.with_region_ids/total*100).toFixed(1)}%) - RECOMMENDED FOR EXTRACTION`);
    console.log(`  Destinations: ${stats.with_destinations} (${(stats.with_destinations/total*100).toFixed(1)}%)\n`);

    console.log('Itinerary Information:');
    console.log(`  Itinerary (array): ${stats.with_itinerary_array} (${(stats.with_itinerary_array/total*100).toFixed(1)}%) - Complex, needs separate table`);
    console.log(`  Itinerary (string): ${stats.with_itinerary_string} (${(stats.with_itinerary_string/total*100).toFixed(1)}%) - Needs parsing\n`);

    console.log('Other Data:');
    console.log(`  Cabin details: ${stats.with_cabin_details} (${(stats.with_cabin_details/total*100).toFixed(1)}%) - Complex JSON`);
    console.log(`  Last cached timestamp: ${stats.with_last_cached} (${(stats.with_last_cached/total*100).toFixed(1)}%)`);
    console.log(`  Cached date string: ${stats.with_cached_date} (${(stats.with_cached_date/total*100).toFixed(1)}%)\n`);

    // Sample some actual data to understand structure
    console.log('=== SAMPLE DATA STRUCTURES ===\n');

    const sampleResult = await pool.query(`
      SELECT
        raw_data->'shipcontent'->>'name' as ship_name,
        raw_data->>'voyagecode' as voyage_code,
        raw_data->>'nights' as nights,
        raw_data->>'startportid' as start_port_id,
        raw_data->>'endportid' as end_port_id,
        raw_data->'ports' as ports_sample,
        raw_data->'regions' as regions_sample
      FROM cruises
      WHERE raw_data IS NOT NULL
        AND raw_data::text != '{}'
        AND raw_data->'ports' IS NOT NULL
      LIMIT 1
    `);

    if (sampleResult.rows.length > 0) {
      const sample = sampleResult.rows[0];
      console.log('Sample cruise data:');
      console.log(`  Ship name: ${sample.ship_name}`);
      console.log(`  Voyage code: ${sample.voyage_code}`);
      console.log(`  Nights: ${sample.nights}`);
      console.log(`  Start port ID: ${sample.start_port_id}`);
      console.log(`  End port ID: ${sample.end_port_id}`);
      console.log(`  Ports structure: ${JSON.stringify(sample.ports_sample).substring(0, 100)}...`);
      console.log(`  Regions structure: ${JSON.stringify(sample.regions_sample)}\n`);
    }

    // Check existing tables to see what's already extracted
    console.log('=== EXISTING TABLE STRUCTURE ===\n');

    const tablesResult = await pool.query(`
      SELECT
        table_name,
        column_name,
        data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('cruises', 'ships', 'cheapest_pricing', 'pricing', 'ports')
      ORDER BY table_name, ordinal_position
    `);

    let currentTable = '';
    tablesResult.rows.forEach(row => {
      if (row.table_name !== currentTable) {
        if (currentTable) console.log();
        console.log(`Table: ${row.table_name}`);
        currentTable = row.table_name;
      }
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });

    console.log('\n=== RECOMMENDATIONS ===\n');
    console.log('1. IMMEDIATE EXTRACTION NEEDED (High coverage, useful for search/filtering):');
    console.log('   - Ship name (100% coverage) -> Add ship_name column to cruises table');
    console.log('   - Voyage code (100% coverage) -> Add voyage_code column to cruises table');
    console.log('   - Nights duration (100% coverage) -> Add nights column to cruises table');
    console.log('   - Start/End port IDs (100% coverage) -> Add start_port_id, end_port_id columns\n');

    console.log('2. CREATE NEW TABLES FOR COMPLEX DATA:');
    console.log('   - cruise_ports table: cruise_id, port_id, port_name, port_order');
    console.log('   - cruise_regions table: cruise_id, region_id, region_name');
    console.log('   - cruise_itinerary table: cruise_id, day_number, port_id, arrival_date, departure_date\n');

    console.log('3. ALREADY EXTRACTED (No action needed):');
    console.log('   - Cheapest pricing fields -> cheapest_pricing table exists\n');

    console.log('4. LOW PRIORITY:');
    console.log('   - Cabin details (complex nested structure, low search value)');
    console.log('   - Cache metadata (operational data, not user-facing)\n');

  } catch (error) {
    console.error('Error analyzing raw_data:', error);
  } finally {
    await pool.end();
  }
}

analyzeRawDataSummary();
