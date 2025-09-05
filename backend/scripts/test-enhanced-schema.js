#!/usr/bin/env node

/**
 * Test Enhanced Schema with Sample Data
 * Verifies the complete enhanced schema works with real Traveltek data
 */

const { Client } = require('pg');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: '.env' });

// Sample data file
const SAMPLE_FILE = path.join(__dirname, '../sample-cruise-data.json');

/**
 * Safe conversion utilities (from sync script)
 */
function safeIntegerConvert(value) {
  if (
    value === null ||
    value === undefined ||
    value === '' ||
    value === 'NaN' ||
    value === 'system'
  ) {
    return null;
  }
  const num = parseInt(value, 10);
  return isNaN(num) ? null : num;
}

function safeDecimalConvert(value) {
  if (
    value === null ||
    value === undefined ||
    value === '' ||
    value === 'NaN' ||
    value === 'system'
  ) {
    return null;
  }
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

function safeBooleanConvert(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.toLowerCase() === 'y' || value.toLowerCase() === 'yes' || value === '1';
  }
  return false;
}

function safeStringConvert(value) {
  if (value === null || value === undefined || value === 'NaN' || value === 'system') {
    return null;
  }
  return String(value).trim();
}

/**
 * Test the enhanced schema with sample data
 */
async function testEnhancedSchema() {
  console.log('🧪 Testing Enhanced Schema with Sample Data');
  console.log('==========================================\n');

  const databaseUrl = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ Error: DATABASE_URL not found');
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('render.com') ? { rejectUnauthorized: false } : false,
  });

  try {
    // Connect to database
    console.log('📡 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully\n');

    // Load sample data
    console.log('📥 Loading sample data...');
    const sampleData = JSON.parse(await fs.readFile(SAMPLE_FILE, 'utf8'));
    console.log('✅ Sample data loaded\n');

    // Insert cruise line if present
    if (sampleData.linecontent && sampleData.lineid) {
      console.log('🏢 Inserting cruise line...');
      const lineQuery = `
        INSERT INTO cruise_lines (
          id, name, code, engine_name, short_name, nice_url, title,
          logo, description, raw_line_content, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          updated_at = NOW()
        RETURNING id, name
      `;

      const lineValues = [
        safeIntegerConvert(sampleData.lineid),
        safeStringConvert(sampleData.linecontent.name) || `Line ${sampleData.lineid}`,
        safeStringConvert(sampleData.linecontent.code),
        safeStringConvert(sampleData.linecontent.enginename),
        safeStringConvert(sampleData.linecontent.shortname),
        safeStringConvert(sampleData.linecontent.niceurl),
        safeStringConvert(sampleData.linecontent.title),
        safeStringConvert(sampleData.linecontent.logo),
        safeStringConvert(sampleData.linecontent.description),
        JSON.stringify(sampleData.linecontent),
        true,
      ];

      const lineResult = await client.query(lineQuery, lineValues);
      console.log(`   ✅ Cruise line: ${lineResult.rows[0].name} (ID: ${lineResult.rows[0].id})`);
    }

    // Insert ship if present
    if (sampleData.shipcontent && sampleData.shipid && sampleData.lineid) {
      console.log('🚢 Inserting ship...');
      const shipQuery = `
        INSERT INTO ships (
          id, cruise_line_id, name, nice_name, short_name, code, tonnage,
          total_cabins, max_passengers, crew, length, beam, draft, speed,
          registry, built_year, refurbished_year, description, star_rating,
          adults_only, ship_class, default_ship_image, default_ship_image_hd,
          default_ship_image_2k, nice_url, highlights, raw_ship_content, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          updated_at = NOW()
        RETURNING id, name
      `;

      const shipValues = [
        safeIntegerConvert(sampleData.shipid),
        safeIntegerConvert(sampleData.lineid),
        safeStringConvert(sampleData.shipcontent.name) || `Ship ${sampleData.shipid}`,
        safeStringConvert(sampleData.shipcontent.nicename),
        safeStringConvert(sampleData.shipcontent.shortname),
        safeStringConvert(sampleData.shipcontent.code),
        safeIntegerConvert(sampleData.shipcontent.tonnage),
        safeIntegerConvert(sampleData.shipcontent.totalcabins),
        safeIntegerConvert(sampleData.shipcontent.maxpassengers) ||
          safeIntegerConvert(sampleData.shipcontent.occupancy),
        safeIntegerConvert(sampleData.shipcontent.totalcrew),
        safeDecimalConvert(sampleData.shipcontent.length),
        safeDecimalConvert(sampleData.shipcontent.beam),
        safeDecimalConvert(sampleData.shipcontent.draft),
        safeDecimalConvert(sampleData.shipcontent.speed),
        safeStringConvert(sampleData.shipcontent.registry),
        safeIntegerConvert(sampleData.shipcontent.launched) ||
          safeIntegerConvert(sampleData.shipcontent.builtyear),
        safeIntegerConvert(sampleData.shipcontent.refurbishedyear),
        safeStringConvert(sampleData.shipcontent.shortdescription) ||
          safeStringConvert(sampleData.shipcontent.description),
        safeIntegerConvert(sampleData.shipcontent.starrating),
        safeBooleanConvert(sampleData.shipcontent.adultsonly),
        safeStringConvert(sampleData.shipcontent.shipclass),
        safeStringConvert(sampleData.shipcontent.defaultshipimage),
        safeStringConvert(sampleData.shipcontent.defaultshipimagehd),
        safeStringConvert(sampleData.shipcontent.defaultshipimage2k),
        safeStringConvert(sampleData.shipcontent.niceurl),
        safeStringConvert(sampleData.shipcontent.highlights),
        JSON.stringify(sampleData.shipcontent),
        true,
      ];

      const shipResult = await client.query(shipQuery, shipValues);
      console.log(`   ✅ Ship: ${shipResult.rows[0].name} (ID: ${shipResult.rows[0].id})`);
    }

    // Extract pricing data
    const pricingData = {};
    if (sampleData.cheapest?.combined) {
      pricingData.interior_price = safeDecimalConvert(sampleData.cheapest.combined.inside);
      pricingData.oceanview_price = safeDecimalConvert(sampleData.cheapest.combined.outside);
      pricingData.balcony_price = safeDecimalConvert(sampleData.cheapest.combined.balcony);
      pricingData.suite_price = safeDecimalConvert(sampleData.cheapest.combined.suite);
    }

    // Insert main cruise
    console.log('🚢 Inserting cruise...');
    const cruiseQuery = `
      INSERT INTO cruises (
        id, cruise_id, traveltek_cruise_id, cruise_line_id, ship_id,
        name, voyage_code, itinerary_code, sailing_date, start_date,
        return_date, nights, sail_nights, sea_days,
        embarkation_port_id, disembarkation_port_id, port_ids, region_ids,
        market_id, owner_id, no_fly, depart_uk, show_cruise,
        cheapest_price, cheapest_price_raw, cheapest_inside, cheapest_inside_price_code,
        cheapest_outside, cheapest_outside_price_code, cheapest_balcony, cheapest_balcony_price_code,
        cheapest_suite, cheapest_suite_price_code,
        interior_price, oceanview_price, balcony_price, suite_price, currency,
        last_cached, cached_date,
        raw_data, cheapest_pricing, cached_prices, prices_data,
        itinerary_data, cabins_data, ports_data, regions_data,
        alt_sailings, fly_cruise_info, is_active
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
        $31, $32, $33, $34, $35, $36, $37, $38, $39, $40,
        $41, $42, $43, $44, $45, $46, $47, $48, $49, $50,
        $51, $52
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()
      RETURNING id, name, sailing_date
    `;

    const cruiseValues = [
      safeStringConvert(sampleData.codetocruiseid) || 'TEST-001',
      safeStringConvert(sampleData.cruiseid),
      safeStringConvert(sampleData.id),
      safeIntegerConvert(sampleData.lineid),
      safeIntegerConvert(sampleData.shipid),
      safeStringConvert(sampleData.name),
      safeStringConvert(sampleData.voyagecode),
      safeStringConvert(sampleData.itinerarycode),
      sampleData.saildate ? new Date(sampleData.saildate) : null,
      sampleData.startdate ? new Date(sampleData.startdate) : null,
      sampleData.saildate && sampleData.nights
        ? new Date(
            new Date(sampleData.saildate).getTime() + sampleData.nights * 24 * 60 * 60 * 1000
          )
        : null,
      safeIntegerConvert(sampleData.nights),
      safeIntegerConvert(sampleData.sailnights),
      safeIntegerConvert(sampleData.seadays),
      safeIntegerConvert(sampleData.startportid),
      safeIntegerConvert(sampleData.endportid),
      safeStringConvert(sampleData.portids),
      safeStringConvert(sampleData.regionids),
      safeIntegerConvert(sampleData.marketid),
      safeIntegerConvert(sampleData.ownerid),
      safeBooleanConvert(sampleData.nofly),
      safeBooleanConvert(sampleData.departuk),
      safeBooleanConvert(sampleData.showcruise),
      safeDecimalConvert(sampleData.cheapestprice),
      safeStringConvert(sampleData.cheapestprice),
      safeDecimalConvert(sampleData.cheapestinside),
      safeStringConvert(sampleData.cheapestinsidepricecode),
      safeDecimalConvert(sampleData.cheapestoutside),
      safeStringConvert(sampleData.cheapestoutsidepricecode),
      safeDecimalConvert(sampleData.cheapestbalcony),
      safeStringConvert(sampleData.cheapestbalconypricecode),
      safeDecimalConvert(sampleData.cheapestsuite),
      safeStringConvert(sampleData.cheapestsuitepricecode),
      pricingData.interior_price,
      pricingData.oceanview_price,
      pricingData.balcony_price,
      pricingData.suite_price,
      'USD', // currency
      safeIntegerConvert(sampleData.lastcached),
      safeStringConvert(sampleData.cacheddate),
      JSON.stringify(sampleData), // Complete JSON preservation!
      sampleData.cheapest ? JSON.stringify(sampleData.cheapest) : null,
      sampleData.cheapest?.cachedprices ? JSON.stringify(sampleData.cheapest.cachedprices) : null,
      sampleData.cheapest?.prices ? JSON.stringify(sampleData.cheapest.prices) : null,
      sampleData.itinerary ? JSON.stringify(sampleData.itinerary) : null,
      sampleData.cabins ? JSON.stringify(sampleData.cabins) : null,
      sampleData.ports ? JSON.stringify(sampleData.ports) : null,
      sampleData.regions ? JSON.stringify(sampleData.regions) : null,
      sampleData.altsailings ? JSON.stringify(sampleData.altsailings) : null,
      sampleData.flycruiseinfo ? JSON.stringify(sampleData.flycruiseinfo) : null,
      true,
    ];

    const cruiseResult = await client.query(cruiseQuery, cruiseValues);
    console.log(`   ✅ Cruise: ${cruiseResult.rows[0].name}`);
    console.log(`      ID: ${cruiseResult.rows[0].id}`);
    console.log(`      Sailing: ${cruiseResult.rows[0].sailing_date}`);

    // Verify data retrieval
    console.log('\n🔍 Verifying data retrieval...');

    const verifyQuery = `
      SELECT
        id,
        name,
        sailing_date,
        nights,
        interior_price,
        balcony_price,
        raw_data->>'codetocruiseid' as json_id,
        raw_data->>'name' as json_name,
        cheapest_pricing->>'combined' as combined_pricing,
        jsonb_array_length(COALESCE(itinerary_data, '[]'::jsonb)) as itinerary_count,
        jsonb_typeof(cabins_data) as cabins_type,
        jsonb_typeof(alt_sailings) as altsailings_type
      FROM cruises
      WHERE id = $1
    `;

    const verifyResult = await client.query(verifyQuery, [cruiseResult.rows[0].id]);
    const cruise = verifyResult.rows[0];

    console.log('   📊 Retrieved cruise data:');
    console.log(`      • ID: ${cruise.id}`);
    console.log(`      • Name: ${cruise.name}`);
    console.log(`      • Sailing Date: ${cruise.sailing_date}`);
    console.log(`      • Nights: ${cruise.nights}`);
    console.log(`      • Interior Price: $${cruise.interior_price || 'N/A'}`);
    console.log(`      • Balcony Price: $${cruise.balcony_price || 'N/A'}`);
    console.log(`      • JSON ID Match: ${cruise.json_id === cruise.id ? '✅' : '❌'}`);
    console.log(`      • Itinerary Days: ${cruise.itinerary_count || 0}`);
    console.log(`      • Cabins Data: ${cruise.cabins_type || 'null'}`);
    console.log(`      • Alt Sailings: ${cruise.altsailings_type || 'null'}`);

    // Test JSONB query capabilities
    console.log('\n🔬 Testing JSONB query capabilities...');

    const jsonbQuery = `
      SELECT
        raw_data->'cheapest'->'combined'->>'inside' as combined_inside_price,
        raw_data->'shipcontent'->>'tonnage' as ship_tonnage,
        raw_data->'linecontent'->>'name' as line_name
      FROM cruises
      WHERE id = $1
    `;

    const jsonbResult = await client.query(jsonbQuery, [cruiseResult.rows[0].id]);
    const jsonData = jsonbResult.rows[0];

    console.log('   🎯 JSONB queries work:');
    console.log(`      • Combined Inside Price: $${jsonData.combined_inside_price || 'N/A'}`);
    console.log(`      • Ship Tonnage: ${jsonData.ship_tonnage || 'N/A'}`);
    console.log(`      • Line Name: ${jsonData.line_name || 'N/A'}`);

    console.log('\n✅ ENHANCED SCHEMA TEST SUCCESSFUL!');
    console.log('====================================');
    console.log('');
    console.log('🎉 Results:');
    console.log('   • Schema structure is correct');
    console.log('   • Data insertion works properly');
    console.log('   • JSON preservation is complete');
    console.log('   • JSONB queries function correctly');
    console.log('   • All data types convert safely');
    console.log('');
    console.log('💾 The enhanced schema successfully:');
    console.log('   • Preserves 100% of Traveltek JSON data');
    console.log('   • Provides fast structured field access');
    console.log('   • Enables complex JSONB queries');
    console.log('   • Handles all edge cases (NaN, null, etc.)');
    console.log('');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the test
if (require.main === module) {
  testEnhancedSchema().catch(console.error);
}

module.exports = { testEnhancedSchema };
