#!/usr/bin/env node

/**
 * Verify Enhanced Sync Data
 * Tests that all data is being captured correctly from Traveltek JSON
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
});

async function verifyData() {
  console.log('🔍 VERIFYING ENHANCED SYNC DATA');
  console.log('================================\n');

  try {
    // 1. Check basic counts
    console.log('📊 Data Counts:');
    const counts = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM cruises) as cruises,
        (SELECT COUNT(*) FROM cruise_lines) as lines,
        (SELECT COUNT(*) FROM ships) as ships,
        (SELECT COUNT(*) FROM ports) as ports,
        (SELECT COUNT(*) FROM regions) as regions
    `);
    console.table(counts.rows[0]);

    // 2. Sample a cruise to check all fields
    console.log('\n🚢 Sample Cruise Data:');
    const cruise = await pool.query(`
      SELECT
        id,
        cruise_id,
        name,
        sailing_date,
        nights,
        cheapest_price,
        interior_price,
        oceanview_price,
        balcony_price,
        suite_price,
        currency,
        CASE
          WHEN raw_data IS NOT NULL THEN 'Yes (' || pg_size_pretty(length(raw_data::text)::bigint) || ')'
          ELSE 'No'
        END as has_raw_data,
        CASE
          WHEN cheapest_pricing IS NOT NULL THEN 'Yes'
          ELSE 'No'
        END as has_cheapest_pricing,
        CASE
          WHEN itinerary_data IS NOT NULL THEN 'Yes'
          ELSE 'No'
        END as has_itinerary,
        CASE
          WHEN cabins_data IS NOT NULL THEN 'Yes'
          ELSE 'No'
        END as has_cabins
      FROM cruises
      LIMIT 1
    `);

    if (cruise.rows.length > 0) {
      console.table(cruise.rows[0]);
    }

    // 3. Check nested JSON data preservation
    console.log('\n🔍 Checking Nested JSON Data:');
    const jsonData = await pool.query(`
      SELECT
        id,
        raw_data->>'codetocruiseid' as json_id,
        raw_data->>'name' as json_name,
        raw_data->'shipcontent'->>'name' as json_ship_name,
        raw_data->'linecontent'->>'name' as json_line_name,
        raw_data->'cheapest'->'combined'->>'balcony' as json_balcony_price,
        jsonb_array_length(COALESCE(raw_data->'itinerary', '[]'::jsonb)) as itinerary_days,
        raw_data->'cabins' IS NOT NULL as has_cabin_data,
        raw_data->'ports' IS NOT NULL as has_port_data
      FROM cruises
      WHERE raw_data IS NOT NULL
      LIMIT 5
    `);

    if (jsonData.rows.length > 0) {
      console.table(jsonData.rows);
    }

    // 4. Check 3-level nested data
    console.log('\n🔍 Testing 3-Level Nested Data Access:');
    const deepNested = await pool.query(`
      SELECT
        id,
        raw_data->'shipcontent'->'shipdecks'->>'38' IS NOT NULL as has_deck_38,
        raw_data->'cheapest'->'cachedprices'->>'outside' as cached_outside_price,
        raw_data#>>'{shipcontent,shipimages,0,imageurl}' as first_ship_image,
        raw_data#>>'{itinerary,0,name}' as first_port_name,
        jsonb_typeof(raw_data->'cabins') as cabins_type,
        jsonb_typeof(raw_data->'ports') as ports_type,
        jsonb_typeof(raw_data->'regions') as regions_type
      FROM cruises
      WHERE raw_data IS NOT NULL
      LIMIT 3
    `);

    if (deepNested.rows.length > 0) {
      console.table(deepNested.rows);
    }

    // 5. Check foreign key relationships
    console.log('\n🔗 Foreign Key Relationships:');
    const relationships = await pool.query(`
      SELECT
        c.id as cruise_id,
        c.name as cruise_name,
        cl.name as line_name,
        s.name as ship_name,
        p1.name as embark_port,
        p2.name as disembark_port
      FROM cruises c
      LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      LEFT JOIN ships s ON c.ship_id = s.id
      LEFT JOIN ports p1 ON c.embarkation_port_id = p1.id
      LEFT JOIN ports p2 ON c.disembarkation_port_id = p2.id
      LIMIT 3
    `);

    if (relationships.rows.length > 0) {
      console.table(relationships.rows);
    }

    // 6. Check data completeness
    console.log('\n✅ Data Completeness Check:');
    const completeness = await pool.query(`
      SELECT
        COUNT(*) as total_cruises,
        COUNT(raw_data) as has_raw_data,
        COUNT(cheapest_pricing) as has_cheapest_pricing,
        COUNT(itinerary_data) as has_itinerary,
        COUNT(cabins_data) as has_cabins,
        COUNT(CASE WHEN interior_price IS NOT NULL OR oceanview_price IS NOT NULL
                   OR balcony_price IS NOT NULL OR suite_price IS NOT NULL
              THEN 1 END) as has_any_price
      FROM cruises
    `);

    const stats = completeness.rows[0];
    console.log(`   Total Cruises: ${stats.total_cruises}`);
    console.log(
      `   With Raw JSON: ${stats.has_raw_data} (${((stats.has_raw_data / stats.total_cruises) * 100).toFixed(1)}%)`
    );
    console.log(
      `   With Pricing: ${stats.has_any_price} (${((stats.has_any_price / stats.total_cruises) * 100).toFixed(1)}%)`
    );
    console.log(
      `   With Itinerary: ${stats.has_itinerary} (${((stats.has_itinerary / stats.total_cruises) * 100).toFixed(1)}%)`
    );
    console.log(
      `   With Cabins: ${stats.has_cabins} (${((stats.has_cabins / stats.total_cruises) * 100).toFixed(1)}%)`
    );

    // 7. Sample actual JSON to verify structure
    console.log('\n📄 Sample Raw JSON Structure:');
    const rawJson = await pool.query(`
      SELECT
        id,
        raw_data
      FROM cruises
      WHERE raw_data IS NOT NULL
      LIMIT 1
    `);

    if (rawJson.rows.length > 0) {
      const data = rawJson.rows[0].raw_data;
      console.log('   Top-level keys:', Object.keys(data).slice(0, 10).join(', '), '...');
      if (data.shipcontent) {
        console.log('   Ship keys:', Object.keys(data.shipcontent).slice(0, 5).join(', '), '...');
      }
      if (data.cheapest) {
        console.log('   Cheapest keys:', Object.keys(data.cheapest).join(', '));
      }
      if (data.itinerary && data.itinerary[0]) {
        console.log(
          '   Itinerary[0] keys:',
          Object.keys(data.itinerary[0]).slice(0, 5).join(', '),
          '...'
        );
      }
    }

    console.log('\n✅ Verification Complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

verifyData();
