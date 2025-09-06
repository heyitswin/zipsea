#!/usr/bin/env node

/**
 * Fix cruise visibility for search
 * Updates is_active, show_cruise fields and extracts data from raw_data
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkCurrentStatus() {
  console.log('📊 Checking current cruise status...');

  const result = await pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN is_active = true THEN 1 END) as active,
      COUNT(CASE WHEN show_cruise = true THEN 1 END) as show_cruise,
      COUNT(CASE WHEN sailing_date >= CURRENT_DATE THEN 1 END) as future_cruises,
      COUNT(CASE WHEN is_active = true AND show_cruise = true AND sailing_date >= CURRENT_DATE THEN 1 END) as searchable,
      COUNT(CASE WHEN name IS NOT NULL AND name != '' THEN 1 END) as has_name,
      COUNT(CASE WHEN raw_data IS NOT NULL THEN 1 END) as has_raw_data
    FROM cruises
  `);

  const stats = result.rows[0];
  console.log('   Total cruises:', stats.total);
  console.log('   Active:', stats.active);
  console.log('   Show cruise:', stats.show_cruise);
  console.log('   Future cruises:', stats.future_cruises);
  console.log('   Searchable (active + show + future):', stats.searchable);
  console.log('   Has name:', stats.has_name);
  console.log('   Has raw_data:', stats.has_raw_data);

  return stats;
}

async function updateVisibilityFields() {
  console.log('\n🔧 Updating visibility fields...');

  // Update is_active and show_cruise to true for all cruises with raw_data
  const updateResult = await pool.query(`
    UPDATE cruises
    SET
      is_active = COALESCE(is_active, true),
      show_cruise = COALESCE(show_cruise, true)
    WHERE raw_data IS NOT NULL
    RETURNING id
  `);

  console.log(`   Updated ${updateResult.rowCount} cruises to be active and visible`);
}

async function extractNamesFromRawData() {
  console.log('\n📝 Extracting names from raw_data...');

  const updateResult = await pool.query(`
    UPDATE cruises
    SET
      name = COALESCE(name, raw_data->>'name'),
      voyage_code = COALESCE(voyage_code, raw_data->>'voyagecode'),
      itinerary_code = COALESCE(itinerary_code, raw_data->>'itinerarycode')
    WHERE
      raw_data IS NOT NULL
      AND (name IS NULL OR name = '')
    RETURNING id
  `);

  console.log(`   Updated ${updateResult.rowCount} cruises with names from raw_data`);
}

async function extractPricingFromRawData() {
  console.log('\n💰 Extracting pricing from raw_data...');

  const updateResult = await pool.query(`
    UPDATE cruises
    SET
      interior_price = COALESCE(
        interior_price::numeric,
        (raw_data->'cheapest'->'combined'->>'inside')::numeric
      ),
      oceanview_price = COALESCE(
        oceanview_price::numeric,
        (raw_data->'cheapest'->'combined'->>'outside')::numeric
      ),
      balcony_price = COALESCE(
        balcony_price::numeric,
        (raw_data->'cheapest'->'combined'->>'balcony')::numeric
      ),
      suite_price = COALESCE(
        suite_price::numeric,
        (raw_data->'cheapest'->'combined'->>'suite')::numeric
      ),
      cheapest_price = COALESCE(
        cheapest_price::numeric,
        LEAST(
          (raw_data->'cheapest'->'combined'->>'inside')::numeric,
          (raw_data->'cheapest'->'combined'->>'outside')::numeric,
          (raw_data->'cheapest'->'combined'->>'balcony')::numeric,
          (raw_data->'cheapest'->'combined'->>'suite')::numeric
        )
      )
    WHERE
      raw_data IS NOT NULL
      AND raw_data->'cheapest'->'combined' IS NOT NULL
      AND (interior_price IS NULL OR oceanview_price IS NULL)
    RETURNING id
  `);

  console.log(`   Updated ${updateResult.rowCount} cruises with pricing from raw_data`);
}

async function showSampleCruises() {
  console.log('\n📋 Sample searchable cruises:');

  const result = await pool.query(`
    SELECT
      id,
      name,
      sailing_date,
      interior_price,
      raw_data->>'name' as raw_name,
      raw_data->'shipcontent'->>'name' as ship_name
    FROM cruises
    WHERE
      is_active = true
      AND show_cruise = true
      AND sailing_date >= CURRENT_DATE
      AND raw_data IS NOT NULL
    ORDER BY sailing_date
    LIMIT 5
  `);

  result.rows.forEach(cruise => {
    console.log(`   ${cruise.id}: ${cruise.name || cruise.raw_name} - ${cruise.ship_name} (${cruise.sailing_date})`);
    console.log(`      Interior: $${cruise.interior_price || 'N/A'}`);
  });
}

async function main() {
  try {
    console.log('🚀 Fixing Cruise Visibility for Search');
    console.log('=====================================\n');

    // Check current status
    const beforeStats = await checkCurrentStatus();

    if (beforeStats.searchable > 0) {
      console.log('\n✅ Already have searchable cruises!');
    } else {
      // Fix the data
      await updateVisibilityFields();
      await extractNamesFromRawData();
      await extractPricingFromRawData();

      // Check status after fixes
      console.log('\n📊 Status after fixes:');
      await checkCurrentStatus();
    }

    // Show sample cruises
    await showSampleCruises();

    console.log('\n✅ Complete!');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
