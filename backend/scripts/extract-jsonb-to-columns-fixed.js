#!/usr/bin/env node

/**
 * Extract data from raw_data JSONB column to populate proper table columns
 * This script processes cruises that have raw_data but missing extracted fields
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  console.log('Usage: DATABASE_URL=your_database_url node extract-jsonb-to-columns-fixed.js');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false,
  max: 5,
});

async function extractJsonbData() {
  const client = await pool.connect();

  try {
    console.log('🔍 JSONB Data Extraction Tool (Fixed)');
    console.log('==============================\n');

    // First, check how many cruises have raw_data
    const checkResult = await client.query(`
      SELECT
        COUNT(*) as total_cruises,
        COUNT(raw_data) as has_raw_data,
        COUNT(CASE WHEN raw_data IS NOT NULL AND name IS NULL THEN 1 END) as needs_name,
        COUNT(CASE WHEN raw_data IS NOT NULL AND cheapest_price IS NULL THEN 1 END) as needs_pricing,
        COUNT(CASE WHEN raw_data IS NOT NULL AND ship_name IS NULL THEN 1 END) as needs_ship_name
      FROM cruises
    `);

    const stats = checkResult.rows[0];
    console.log('📊 Database Statistics:');
    console.log(`  Total cruises: ${stats.total_cruises}`);
    console.log(`  Has raw_data: ${stats.has_raw_data}`);
    console.log(`  Needs name extraction: ${stats.needs_name}`);
    console.log(`  Needs pricing: ${stats.needs_pricing}`);
    console.log(`  Needs ship name: ${stats.needs_ship_name}\n`);

    if (stats.needs_name === '0' && stats.needs_pricing === '0') {
      console.log('✅ All data already extracted!');
      return;
    }

    // Extract basic cruise information
    console.log('1️⃣ Extracting basic cruise information...');
    const basicResult = await client.query(`
      UPDATE cruises
      SET
        name = COALESCE(name, raw_data->>'name', raw_data->>'cruisename'),
        ship_name = COALESCE(ship_name, raw_data->>'shipname'),
        voyage_code = COALESCE(voyage_code, raw_data->>'voyagecode'),
        itinerary_code = COALESCE(itinerary_code, raw_data->>'itinerarycode'),
        sailing_date = COALESCE(
          sailing_date,
          CASE
            WHEN raw_data->>'saildate' IS NOT NULL THEN (raw_data->>'saildate')::date
            ELSE NULL
          END
        ),
        return_date = COALESCE(
          return_date,
          CASE
            WHEN raw_data->>'returndate' IS NOT NULL THEN (raw_data->>'returndate')::date
            ELSE NULL
          END
        ),
        nights = COALESCE(nights, (raw_data->>'nights')::integer),
        sail_nights = COALESCE(sail_nights, (raw_data->>'sailnights')::integer),
        sea_days = COALESCE(sea_days, (raw_data->>'seadays')::integer),
        no_fly = COALESCE(no_fly, (raw_data->>'nofly')::boolean),
        depart_uk = COALESCE(depart_uk, (raw_data->>'departuk')::boolean),
        updated_at = NOW()
      WHERE raw_data IS NOT NULL
      AND (name IS NULL OR ship_name IS NULL OR sailing_date IS NULL)
    `);
    console.log(`  ✅ Updated ${basicResult.rowCount} cruises with basic info\n`);

    // Extract pricing information from raw_data
    console.log('2️⃣ Extracting pricing information...');
    const pricingResult = await client.query(`
      UPDATE cruises
      SET
        cheapest_price = COALESCE(
          cheapest_price,
          LEAST(
            NULLIF((raw_data->'cheapest'->'combined'->>'inside')::numeric, 0),
            NULLIF((raw_data->'cheapest'->'combined'->>'outside')::numeric, 0),
            NULLIF((raw_data->'cheapest'->'combined'->>'balcony')::numeric, 0),
            NULLIF((raw_data->'cheapest'->'combined'->>'suite')::numeric, 0)
          )
        ),
        cheapest_inside = COALESCE(cheapest_inside, NULLIF((raw_data->'cheapest'->'combined'->>'inside')::numeric, 0)),
        cheapest_outside = COALESCE(cheapest_outside, NULLIF((raw_data->'cheapest'->'combined'->>'outside')::numeric, 0)),
        cheapest_balcony = COALESCE(cheapest_balcony, NULLIF((raw_data->'cheapest'->'combined'->>'balcony')::numeric, 0)),
        cheapest_suite = COALESCE(cheapest_suite, NULLIF((raw_data->'cheapest'->'combined'->>'suite')::numeric, 0)),
        interior_price = COALESCE(interior_price, NULLIF((raw_data->'cheapest'->'combined'->>'inside')::numeric, 0)),
        oceanview_price = COALESCE(oceanview_price, NULLIF((raw_data->'cheapest'->'combined'->>'outside')::numeric, 0)),
        balcony_price = COALESCE(balcony_price, NULLIF((raw_data->'cheapest'->'combined'->>'balcony')::numeric, 0)),
        suite_price = COALESCE(suite_price, NULLIF((raw_data->'cheapest'->'combined'->>'suite')::numeric, 0)),
        currency = COALESCE(currency, raw_data->>'currency', 'USD'),
        updated_at = NOW()
      WHERE raw_data IS NOT NULL
      AND cheapest_price IS NULL
      AND raw_data->'cheapest'->'combined' IS NOT NULL
    `);
    console.log(`  ✅ Updated ${pricingResult.rowCount} cruises with pricing\n`);

    // Extract itinerary data to itinerary_data column
    console.log('3️⃣ Extracting itinerary data...');
    const itineraryResult = await client.query(`
      UPDATE cruises
      SET
        itinerary_data = COALESCE(itinerary_data, raw_data->'itinerary'),
        ports_data = COALESCE(ports_data, raw_data->'ports'),
        regions_data = COALESCE(regions_data, raw_data->'regions'),
        updated_at = NOW()
      WHERE raw_data IS NOT NULL
      AND (itinerary_data IS NULL OR ports_data IS NULL OR regions_data IS NULL)
      AND (raw_data->'itinerary' IS NOT NULL OR raw_data->'ports' IS NOT NULL OR raw_data->'regions' IS NOT NULL)
    `);
    console.log(
      `  ✅ Updated ${itineraryResult.rowCount} cruises with itinerary/ports/regions data\n`
    );

    // Skip port_ids and region_ids extraction due to type mismatch
    console.log('4️⃣ Skipping port/region IDs extraction (type mismatch)\n');

    // Final statistics
    const finalResult = await client.query(`
      SELECT
        COUNT(*) as total_cruises,
        COUNT(raw_data) as has_raw_data,
        COUNT(CASE WHEN name IS NOT NULL THEN 1 END) as has_name,
        COUNT(CASE WHEN cheapest_price IS NOT NULL THEN 1 END) as has_pricing,
        COUNT(CASE WHEN ship_name IS NOT NULL THEN 1 END) as has_ship_name
      FROM cruises
    `);

    const final = finalResult.rows[0];
    console.log('📊 Final Statistics:');
    console.log(`  Total cruises: ${final.total_cruises}`);
    console.log(`  Has raw_data: ${final.has_raw_data}`);
    console.log(`  Has name: ${final.has_name}`);
    console.log(`  Has pricing: ${final.has_pricing}`);
    console.log(`  Has ship name: ${final.has_ship_name}`);

    // Look for Quantum of the Seas specifically
    console.log('\n🔍 Looking for Quantum of the Seas Feb 10, 2026...');
    const quantumResult = await client.query(`
      SELECT
        id,
        cruise_id,
        name,
        ship_name,
        cheapest_price,
        sailing_date,
        return_date,
        nights
      FROM cruises
      WHERE (
        LOWER(name) LIKE '%quantum%'
        OR LOWER(ship_name) LIKE '%quantum%'
        OR LOWER(raw_data->>'shipname') LIKE '%quantum%'
      )
      AND sailing_date >= '2026-02-09'
      AND sailing_date <= '2026-02-11'
      ORDER BY sailing_date
    `);

    if (quantumResult.rows.length > 0) {
      console.log('✅ Found Quantum of the Seas cruise:');
      quantumResult.rows.forEach(cruise => {
        console.log(`  ID: ${cruise.id}`);
        console.log(`  Cruise ID: ${cruise.cruise_id}`);
        console.log(`  Name: ${cruise.name}`);
        console.log(`  Ship: ${cruise.ship_name}`);
        console.log(`  Price: $${cruise.cheapest_price}`);
        console.log(`  Sailing: ${cruise.sailing_date}`);
        console.log(`  Return: ${cruise.return_date}`);
        console.log(`  Nights: ${cruise.nights}\n`);
      });
    } else {
      console.log('❌ Quantum of the Seas Feb 10, 2026 cruise not found');
    }

    console.log('✅ Extraction complete!');
  } catch (error) {
    console.error('❌ Error during extraction:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run extraction
extractJsonbData().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
