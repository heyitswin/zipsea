#!/usr/bin/env node

/**
 * Extract data from raw_data JSONB column to populate proper table columns
 * This script processes cruises that have raw_data but missing extracted fields
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  console.log('Usage: DATABASE_URL=your_database_url node extract-jsonb-to-columns.js');
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
    console.log('🔍 JSONB Data Extraction Tool');
    console.log('==============================\n');

    // First, check how many cruises have raw_data
    const checkResult = await client.query(`
      SELECT
        COUNT(*) as total_cruises,
        COUNT(raw_data) as has_raw_data,
        COUNT(CASE WHEN raw_data IS NOT NULL AND name IS NULL THEN 1 END) as needs_extraction,
        COUNT(CASE WHEN raw_data IS NOT NULL AND price_from IS NULL THEN 1 END) as needs_pricing
      FROM cruises
    `);

    const stats = checkResult.rows[0];
    console.log('📊 Database Statistics:');
    console.log(`  Total cruises: ${stats.total_cruises}`);
    console.log(`  Has raw_data: ${stats.has_raw_data}`);
    console.log(`  Needs extraction: ${stats.needs_extraction}`);
    console.log(`  Needs pricing: ${stats.needs_pricing}\n`);

    if (stats.needs_extraction === '0' && stats.needs_pricing === '0') {
      console.log('✅ All data already extracted!');
      return;
    }

    // Extract basic cruise information
    console.log('1️⃣ Extracting basic cruise information...');
    const basicResult = await client.query(`
      UPDATE cruises
      SET
        name = COALESCE(name, raw_data->>'name'),
        cruise_name = COALESCE(cruise_name, raw_data->>'cruisename'),
        description = COALESCE(description, raw_data->>'description'),
        embarkation_port = COALESCE(embarkation_port, raw_data->>'embarkation'),
        disembarkation_port = COALESCE(disembarkation_port, raw_data->>'disembarkation'),
        sailing_date = COALESCE(sailing_date, (raw_data->>'saildate')::date),
        return_date = COALESCE(return_date, (raw_data->>'returndate')::date),
        nights = COALESCE(nights, (raw_data->>'nights')::integer),
        sail_nights = COALESCE(sail_nights, (raw_data->>'sailnights')::integer),
        departure_time = COALESCE(departure_time, raw_data->>'departuretime'),
        arrival_time = COALESCE(arrival_time, raw_data->>'arrivaltime'),
        cruise_type = COALESCE(cruise_type, raw_data->>'cruisetype'),
        destination = COALESCE(destination, raw_data->>'destination'),
        departure_port_code = COALESCE(departure_port_code, raw_data->>'departureportcode'),
        arrival_port_code = COALESCE(arrival_port_code, raw_data->>'arrivalportcode'),
        map_image_url = COALESCE(map_image_url, raw_data->>'mapimageurl'),
        roundtrip = COALESCE(roundtrip, (raw_data->>'roundtrip')::boolean),
        one_way = COALESCE(one_way, (raw_data->>'oneway')::boolean),
        cruise_line_content = COALESCE(cruise_line_content, raw_data->'linecontent'),
        ship_content = COALESCE(ship_content, raw_data->'shipcontent'),
        content = COALESCE(content, raw_data->'content'),
        updated_at = NOW()
      WHERE raw_data IS NOT NULL
      AND (name IS NULL OR cruise_name IS NULL OR sailing_date IS NULL)
    `);
    console.log(`  ✅ Updated ${basicResult.rowCount} cruises with basic info\n`);

    // Extract pricing information
    console.log('2️⃣ Extracting pricing information...');
    const pricingResult = await client.query(`
      UPDATE cruises
      SET
        price_from = COALESCE(
          price_from,
          LEAST(
            NULLIF((raw_data->'cheapest'->'combined'->>'inside')::numeric, 0),
            NULLIF((raw_data->'cheapest'->'combined'->>'outside')::numeric, 0),
            NULLIF((raw_data->'cheapest'->'combined'->>'balcony')::numeric, 0),
            NULLIF((raw_data->'cheapest'->'combined'->>'suite')::numeric, 0)
          )
        ),
        currency = COALESCE(currency, raw_data->>'currency', 'USD'),
        market_price = COALESCE(market_price, (raw_data->>'marketprice')::numeric),
        special_offer = COALESCE(special_offer, raw_data->>'specialoffer'),
        updated_at = NOW()
      WHERE raw_data IS NOT NULL
      AND price_from IS NULL
      AND raw_data->'cheapest'->'combined' IS NOT NULL
    `);
    console.log(`  ✅ Updated ${pricingResult.rowCount} cruises with pricing\n`);

    // Extract cheapest pricing details to separate table
    console.log('3️⃣ Extracting detailed pricing to cheapest_pricing table...');
    const detailedPricingResult = await client.query(`
      INSERT INTO cheapest_pricing (
        cruise_id,
        cheapest_price,
        interior_price,
        oceanview_price,
        balcony_price,
        suite_price,
        single_price,
        triple_price,
        quad_price,
        child_price,
        currency,
        rate_code,
        last_updated
      )
      SELECT
        c.id,
        LEAST(
          NULLIF((c.raw_data->'cheapest'->'combined'->>'inside')::numeric, 0),
          NULLIF((c.raw_data->'cheapest'->'combined'->>'outside')::numeric, 0),
          NULLIF((c.raw_data->'cheapest'->'combined'->>'balcony')::numeric, 0),
          NULLIF((c.raw_data->'cheapest'->'combined'->>'suite')::numeric, 0)
        ),
        NULLIF((c.raw_data->'cheapest'->'combined'->>'inside')::numeric, 0),
        NULLIF((c.raw_data->'cheapest'->'combined'->>'outside')::numeric, 0),
        NULLIF((c.raw_data->'cheapest'->'combined'->>'balcony')::numeric, 0),
        NULLIF((c.raw_data->'cheapest'->'combined'->>'suite')::numeric, 0),
        NULLIF((c.raw_data->'cheapest'->'combined'->>'single')::numeric, 0),
        NULLIF((c.raw_data->'cheapest'->'combined'->>'triple')::numeric, 0),
        NULLIF((c.raw_data->'cheapest'->'combined'->>'quad')::numeric, 0),
        NULLIF((c.raw_data->'cheapest'->'combined'->>'child')::numeric, 0),
        COALESCE(c.raw_data->>'currency', 'USD'),
        c.raw_data->'cheapest'->>'ratecode',
        NOW()
      FROM cruises c
      WHERE c.raw_data IS NOT NULL
      AND c.raw_data->'cheapest'->'combined' IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM cheapest_pricing cp WHERE cp.cruise_id = c.id
      )
      ON CONFLICT (cruise_id) DO UPDATE SET
        cheapest_price = EXCLUDED.cheapest_price,
        interior_price = EXCLUDED.interior_price,
        oceanview_price = EXCLUDED.oceanview_price,
        balcony_price = EXCLUDED.balcony_price,
        suite_price = EXCLUDED.suite_price,
        single_price = EXCLUDED.single_price,
        triple_price = EXCLUDED.triple_price,
        quad_price = EXCLUDED.quad_price,
        child_price = EXCLUDED.child_price,
        currency = EXCLUDED.currency,
        rate_code = EXCLUDED.rate_code,
        last_updated = NOW()
    `);
    console.log(`  ✅ Inserted/Updated ${detailedPricingResult.rowCount} pricing records\n`);

    // Extract itinerary data
    console.log('4️⃣ Extracting itinerary data...');
    const itineraryResult = await client.query(`
      INSERT INTO itineraries (cruise_id, day_number, port_name, arrival_time, departure_time, description)
      SELECT
        c.id,
        (itinerary_item->>'day')::integer,
        itinerary_item->>'port',
        itinerary_item->>'arrivaltime',
        itinerary_item->>'departuretime',
        itinerary_item->>'description'
      FROM cruises c,
        jsonb_array_elements(c.raw_data->'itinerary') AS itinerary_item
      WHERE c.raw_data->'itinerary' IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM itineraries i WHERE i.cruise_id = c.id
      )
      ON CONFLICT (cruise_id, day_number) DO UPDATE SET
        port_name = EXCLUDED.port_name,
        arrival_time = EXCLUDED.arrival_time,
        departure_time = EXCLUDED.departure_time,
        description = EXCLUDED.description
    `);
    console.log(`  ✅ Inserted/Updated ${itineraryResult.rowCount} itinerary records\n`);

    // Extract regions
    console.log('5️⃣ Extracting regions data...');
    const regionsResult = await client.query(`
      INSERT INTO cruise_regions (cruise_id, region_id, region_name)
      SELECT DISTINCT
        c.id,
        (region_item->>'regionid')::integer,
        region_item->>'regionname'
      FROM cruises c,
        jsonb_array_elements(c.raw_data->'regions') AS region_item
      WHERE c.raw_data->'regions' IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM cruise_regions cr
        WHERE cr.cruise_id = c.id
        AND cr.region_id = (region_item->>'regionid')::integer
      )
      ON CONFLICT (cruise_id, region_id) DO UPDATE SET
        region_name = EXCLUDED.region_name
    `);
    console.log(`  ✅ Inserted/Updated ${regionsResult.rowCount} region records\n`);

    // Update flags
    console.log('6️⃣ Updating extraction flags...');
    const flagResult = await client.query(`
      UPDATE cruises
      SET
        is_extracted = true,
        extraction_date = NOW()
      WHERE raw_data IS NOT NULL
      AND is_extracted IS NOT true
    `);
    console.log(`  ✅ Marked ${flagResult.rowCount} cruises as extracted\n`);

    // Final statistics
    const finalResult = await client.query(`
      SELECT
        COUNT(*) as total_cruises,
        COUNT(raw_data) as has_raw_data,
        COUNT(CASE WHEN name IS NOT NULL THEN 1 END) as has_name,
        COUNT(CASE WHEN price_from IS NOT NULL THEN 1 END) as has_pricing,
        COUNT(CASE WHEN is_extracted = true THEN 1 END) as is_extracted
      FROM cruises
    `);

    const final = finalResult.rows[0];
    console.log('📊 Final Statistics:');
    console.log(`  Total cruises: ${final.total_cruises}`);
    console.log(`  Has raw_data: ${final.has_raw_data}`);
    console.log(`  Has name: ${final.has_name}`);
    console.log(`  Has pricing: ${final.has_pricing}`);
    console.log(`  Is extracted: ${final.is_extracted}`);

    // Check for sample data
    const sampleResult = await client.query(`
      SELECT
        id,
        name,
        price_from,
        sailing_date,
        nights,
        destination
      FROM cruises
      WHERE raw_data IS NOT NULL
      AND name IS NOT NULL
      AND price_from IS NOT NULL
      ORDER BY sailing_date
      LIMIT 3
    `);

    if (sampleResult.rows.length > 0) {
      console.log('\n📋 Sample Extracted Data:');
      sampleResult.rows.forEach(cruise => {
        console.log(`  - ${cruise.name}`);
        console.log(`    Price: $${cruise.price_from}`);
        console.log(`    Date: ${cruise.sailing_date}`);
        console.log(`    Nights: ${cruise.nights}`);
        console.log(`    Destination: ${cruise.destination}\n`);
      });
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
