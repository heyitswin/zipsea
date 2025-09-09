const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false
});

async function verifyDataExtraction() {
  try {
    await client.connect();
    console.log('Connected to database\n');

    // 1. Check total counts
    console.log('=== DATA POPULATION SUMMARY ===\n');

    const tables = [
      'cruises',
      'cruise_lines',
      'ships',
      'ports',
      'regions',
      'itineraries',
      'cheapest_prices',
      'static_prices',
      'cached_prices'
    ];

    for (const table of tables) {
      try {
        const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`${table}: ${result.rows[0].count} records`);
      } catch (err) {
        console.log(`${table}: Table does not exist or error`);
      }
    }

    // 2. Check cruises table field population
    console.log('\n=== CRUISES TABLE FIELD ANALYSIS ===\n');

    const cruiseFieldsQuery = `
      SELECT
        COUNT(*) as total_cruises,
        COUNT(id) as has_id,
        COUNT(cruise_id) as has_cruise_id,
        COUNT(cruise_line_id) as has_line_id,
        COUNT(ship_id) as has_ship_id,
        COUNT(name) as has_name,
        COUNT(sailing_date) as has_sailing_date,
        COUNT(return_date) as has_return_date,
        COUNT(nights) as has_nights,
        COUNT(embarkation_port_id) as has_embark_port,
        COUNT(disembarkation_port_id) as has_disembark_port,
        COUNT(interior_price) as has_interior_price,
        COUNT(oceanview_price) as has_oceanview_price,
        COUNT(balcony_price) as has_balcony_price,
        COUNT(suite_price) as has_suite_price,
        COUNT(CASE WHEN interior_price > 0 THEN 1 END) as valid_interior_price,
        COUNT(CASE WHEN oceanview_price > 0 THEN 1 END) as valid_oceanview_price,
        COUNT(CASE WHEN balcony_price > 0 THEN 1 END) as valid_balcony_price,
        COUNT(CASE WHEN suite_price > 0 THEN 1 END) as valid_suite_price,
        COUNT(CASE WHEN interior_price IS NULL AND oceanview_price IS NULL
                   AND balcony_price IS NULL AND suite_price IS NULL THEN 1 END) as no_pricing_at_all
      FROM cruises
    `;

    const cruiseFields = await client.query(cruiseFieldsQuery);
    const cf = cruiseFields.rows[0];

    console.log(`Total cruises: ${cf.total_cruises}`);
    console.log(`\n✅ Required fields (should be 100%):`);
    console.log(`  - ID: ${cf.has_id} (${(cf.has_id/cf.total_cruises*100).toFixed(1)}%)`);
    console.log(`  - Cruise ID: ${cf.has_cruise_id} (${(cf.has_cruise_id/cf.total_cruises*100).toFixed(1)}%)`);
    console.log(`  - Line ID: ${cf.has_line_id} (${(cf.has_line_id/cf.total_cruises*100).toFixed(1)}%)`);
    console.log(`  - Ship ID: ${cf.has_ship_id} (${(cf.has_ship_id/cf.total_cruises*100).toFixed(1)}%)`);
    console.log(`  - Name: ${cf.has_name} (${(cf.has_name/cf.total_cruises*100).toFixed(1)}%)`);
    console.log(`  - Sailing Date: ${cf.has_sailing_date} (${(cf.has_sailing_date/cf.total_cruises*100).toFixed(1)}%)`);
    console.log(`  - Return Date: ${cf.has_return_date} (${(cf.has_return_date/cf.total_cruises*100).toFixed(1)}%)`);
    console.log(`  - Nights: ${cf.has_nights} (${(cf.has_nights/cf.total_cruises*100).toFixed(1)}%)`);

    console.log(`\n💰 Pricing fields (NOT NULL):`);
    console.log(`  - Interior: ${cf.has_interior_price} (${(cf.has_interior_price/cf.total_cruises*100).toFixed(1)}%)`);
    console.log(`  - Oceanview: ${cf.has_oceanview_price} (${(cf.has_oceanview_price/cf.total_cruises*100).toFixed(1)}%)`);
    console.log(`  - Balcony: ${cf.has_balcony_price} (${(cf.has_balcony_price/cf.total_cruises*100).toFixed(1)}%)`);
    console.log(`  - Suite: ${cf.has_suite_price} (${(cf.has_suite_price/cf.total_cruises*100).toFixed(1)}%)`);

    console.log(`\n💵 Valid pricing (> $0):`);
    console.log(`  - Interior > 0: ${cf.valid_interior_price} (${(cf.valid_interior_price/cf.total_cruises*100).toFixed(1)}%)`);
    console.log(`  - Oceanview > 0: ${cf.valid_oceanview_price} (${(cf.valid_oceanview_price/cf.total_cruises*100).toFixed(1)}%)`);
    console.log(`  - Balcony > 0: ${cf.valid_balcony_price} (${(cf.valid_balcony_price/cf.total_cruises*100).toFixed(1)}%)`);
    console.log(`  - Suite > 0: ${cf.valid_suite_price} (${(cf.valid_suite_price/cf.total_cruises*100).toFixed(1)}%)`);

    console.log(`\n⚠️  Cruises with NO pricing at all: ${cf.no_pricing_at_all} (${(cf.no_pricing_at_all/cf.total_cruises*100).toFixed(1)}%)`);

    // 3. Check cheapest_prices table
    console.log('\n=== CHEAPEST PRICES TABLE ANALYSIS ===\n');

    const cheapestQuery = `
      SELECT
        COUNT(*) as total_records,
        COUNT(DISTINCT cruise_id) as unique_cruises,
        COUNT(interior_price) as has_interior,
        COUNT(oceanview_price) as has_oceanview,
        COUNT(balcony_price) as has_balcony,
        COUNT(suite_price) as has_suite,
        MIN(interior_price) as min_interior,
        MAX(interior_price) as max_interior,
        AVG(interior_price)::numeric(10,2) as avg_interior
      FROM cheapest_prices
    `;

    const cheapest = await client.query(cheapestQuery);
    const ch = cheapest.rows[0];

    console.log(`Total records: ${ch.total_records}`);
    console.log(`Unique cruises: ${ch.unique_cruises}`);
    console.log(`Interior prices: ${ch.has_interior}`);
    console.log(`Price range: $${ch.min_interior} - $${ch.max_interior} (avg: $${ch.avg_interior})`);

    // 4. Sample data with all prices
    console.log('\n=== SAMPLE CRUISES WITH PRICING ===\n');

    const sampleQuery = `
      SELECT
        c.id,
        c.name,
        cl.name as cruise_line,
        s.name as ship,
        c.sailing_date,
        c.nights,
        c.interior_price,
        c.oceanview_price,
        c.balcony_price,
        c.suite_price,
        cp.interior_price as cp_interior,
        cp.oceanview_price as cp_oceanview,
        cp.balcony_price as cp_balcony,
        cp.suite_price as cp_suite
      FROM cruises c
      LEFT JOIN cruise_lines cl ON cl.id = c.cruise_line_id
      LEFT JOIN ships s ON s.id = c.ship_id
      LEFT JOIN cheapest_prices cp ON cp.cruise_id = c.id
      WHERE c.interior_price IS NOT NULL
        AND c.oceanview_price IS NOT NULL
        AND c.balcony_price IS NOT NULL
        AND c.suite_price IS NOT NULL
      ORDER BY c.sailing_date DESC
      LIMIT 5
    `;

    const samples = await client.query(sampleQuery);

    samples.rows.forEach((row, i) => {
      console.log(`\n${i + 1}. ${row.name}`);
      console.log(`   ID: ${row.id}`);
      console.log(`   ${row.cruise_line} - ${row.ship}`);
      console.log(`   Sailing: ${row.sailing_date} (${row.nights} nights)`);
      console.log(`   Prices from cruises table:`);
      console.log(`     Interior: $${row.interior_price}`);
      console.log(`     Oceanview: $${row.oceanview_price}`);
      console.log(`     Balcony: $${row.balcony_price}`);
      console.log(`     Suite: $${row.suite_price}`);
      if (row.cp_interior) {
        console.log(`   Prices from cheapest_prices table:`);
        console.log(`     Interior: $${row.cp_interior}`);
        console.log(`     Oceanview: $${row.cp_oceanview}`);
        console.log(`     Balcony: $${row.cp_balcony}`);
        console.log(`     Suite: $${row.cp_suite}`);
      }
    });

    // 5. Check for relationship integrity
    console.log('\n=== RELATIONSHIP INTEGRITY ===\n');

    const integrityQuery = `
      SELECT
        (SELECT COUNT(*) FROM cruises WHERE cruise_line_id NOT IN (SELECT id FROM cruise_lines)) as missing_lines,
        (SELECT COUNT(*) FROM cruises WHERE ship_id NOT IN (SELECT id FROM ships)) as missing_ships,
        (SELECT COUNT(*) FROM cruises WHERE embarkation_port_id IS NOT NULL AND embarkation_port_id NOT IN (SELECT id FROM ports)) as missing_embark_ports,
        (SELECT COUNT(*) FROM cruises WHERE disembarkation_port_id IS NOT NULL AND disembarkation_port_id NOT IN (SELECT id FROM ports)) as missing_disembark_ports,
        (SELECT COUNT(DISTINCT c.id) FROM cruises c WHERE NOT EXISTS (SELECT 1 FROM cheapest_prices cp WHERE cp.cruise_id = c.id)) as cruises_without_cheapest_prices
    `;

    const integrity = await client.query(integrityQuery);
    const int = integrity.rows[0];

    console.log(`❌ Missing cruise lines: ${int.missing_lines}`);
    console.log(`❌ Missing ships: ${int.missing_ships}`);
    console.log(`❌ Missing embarkation ports: ${int.missing_embark_ports}`);
    console.log(`❌ Missing disembarkation ports: ${int.missing_disembark_ports}`);
    console.log(`⚠️  Cruises without cheapest_prices records: ${int.cruises_without_cheapest_prices}`);

    // 6. Check date ranges
    console.log('\n=== DATE RANGE ANALYSIS ===\n');

    const dateQuery = `
      SELECT
        MIN(sailing_date) as earliest_sailing,
        MAX(sailing_date) as latest_sailing,
        COUNT(CASE WHEN sailing_date < CURRENT_DATE THEN 1 END) as past_cruises,
        COUNT(CASE WHEN sailing_date >= CURRENT_DATE AND sailing_date < CURRENT_DATE + INTERVAL '30 days' THEN 1 END) as next_30_days,
        COUNT(CASE WHEN sailing_date >= CURRENT_DATE + INTERVAL '30 days' AND sailing_date < CURRENT_DATE + INTERVAL '90 days' THEN 1 END) as next_30_90_days,
        COUNT(CASE WHEN sailing_date >= CURRENT_DATE + INTERVAL '90 days' THEN 1 END) as beyond_90_days
      FROM cruises
    `;

    const dates = await client.query(dateQuery);
    const dt = dates.rows[0];

    console.log(`Earliest sailing: ${dt.earliest_sailing}`);
    console.log(`Latest sailing: ${dt.latest_sailing}`);
    console.log(`Past cruises: ${dt.past_cruises}`);
    console.log(`Next 30 days: ${dt.next_30_days}`);
    console.log(`30-90 days out: ${dt.next_30_90_days}`);
    console.log(`Beyond 90 days: ${dt.beyond_90_days}`);

    // 7. Check pricing distribution
    console.log('\n=== PRICING DISTRIBUTION ===\n');

    const pricingQuery = `
      SELECT
        'Interior' as cabin_type,
        COUNT(*) as count,
        MIN(interior_price) as min_price,
        MAX(interior_price) as max_price,
        AVG(interior_price)::numeric(10,2) as avg_price,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY interior_price)::numeric(10,2) as median_price
      FROM cruises WHERE interior_price > 0
      UNION ALL
      SELECT
        'Oceanview' as cabin_type,
        COUNT(*) as count,
        MIN(oceanview_price) as min_price,
        MAX(oceanview_price) as max_price,
        AVG(oceanview_price)::numeric(10,2) as avg_price,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY oceanview_price)::numeric(10,2) as median_price
      FROM cruises WHERE oceanview_price > 0
      UNION ALL
      SELECT
        'Balcony' as cabin_type,
        COUNT(*) as count,
        MIN(balcony_price) as min_price,
        MAX(balcony_price) as max_price,
        AVG(balcony_price)::numeric(10,2) as avg_price,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY balcony_price)::numeric(10,2) as median_price
      FROM cruises WHERE balcony_price > 0
      UNION ALL
      SELECT
        'Suite' as cabin_type,
        COUNT(*) as count,
        MIN(suite_price) as min_price,
        MAX(suite_price) as max_price,
        AVG(suite_price)::numeric(10,2) as avg_price,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY suite_price)::numeric(10,2) as median_price
      FROM cruises WHERE suite_price > 0
    `;

    const pricing = await client.query(pricingQuery);

    console.log('Cabin Type  | Count  | Min     | Max      | Average  | Median');
    console.log('------------|--------|---------|----------|----------|--------');
    pricing.rows.forEach(row => {
      console.log(
        `${row.cabin_type.padEnd(11)} | ${row.count.toString().padEnd(6)} | $${row.min_price.toString().padEnd(6)} | $${row.max_price.toString().padEnd(7)} | $${row.avg_price.toString().padEnd(7)} | $${row.median_price}`
      );
    });

    // 8. Final Summary
    console.log('\n=== EXTRACTION QUALITY SUMMARY ===\n');

    const hasAnyPrice = cf.total_cruises - cf.no_pricing_at_all;
    const completeness = (hasAnyPrice / cf.total_cruises * 100).toFixed(1);

    if (completeness > 90) {
      console.log(`✅ EXCELLENT: ${completeness}% of cruises have at least one price`);
    } else if (completeness > 75) {
      console.log(`⚠️  GOOD: ${completeness}% of cruises have at least one price`);
    } else {
      console.log(`❌ NEEDS ATTENTION: Only ${completeness}% of cruises have pricing data`);
    }

    console.log(`\nData extraction appears to be ${completeness > 75 ? 'SUCCESSFUL' : 'INCOMPLETE'}`);

    if (int.missing_lines > 0 || int.missing_ships > 0) {
      console.log('\n⚠️  WARNING: Some foreign key relationships are broken!');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

verifyDataExtraction();
