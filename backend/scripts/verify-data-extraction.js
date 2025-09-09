const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
});

async function verifyDataExtraction() {
  try {
    await client.connect();
    console.log('Connected to database\n');

    // 1. Check total counts
    console.log('=== DATA POPULATION SUMMARY ===\n');

    const tables = ['cruises', 'cruise_lines', 'ships', 'ports', 'regions', 'itineraries'];
    for (const table of tables) {
      try {
        const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`${table}: ${result.rows[0].count} records`);
      } catch (err) {
        console.log(`${table}: Table does not exist`);
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
        COUNT(CASE WHEN suite_price > 0 THEN 1 END) as valid_suite_price
      FROM cruises
    `;

    const cruiseFields = await client.query(cruiseFieldsQuery);
    const cf = cruiseFields.rows[0];

    console.log(`Total cruises: ${cf.total_cruises}`);
    console.log(`\nRequired fields:`);
    console.log(`  - ID: ${cf.has_id} (${((cf.has_id / cf.total_cruises) * 100).toFixed(1)}%)`);
    console.log(
      `  - Cruise ID: ${cf.has_cruise_id} (${((cf.has_cruise_id / cf.total_cruises) * 100).toFixed(1)}%)`
    );
    console.log(
      `  - Line ID: ${cf.has_line_id} (${((cf.has_line_id / cf.total_cruises) * 100).toFixed(1)}%)`
    );
    console.log(
      `  - Ship ID: ${cf.has_ship_id} (${((cf.has_ship_id / cf.total_cruises) * 100).toFixed(1)}%)`
    );
    console.log(
      `  - Name: ${cf.has_name} (${((cf.has_name / cf.total_cruises) * 100).toFixed(1)}%)`
    );
    console.log(
      `  - Sailing Date: ${cf.has_sailing_date} (${((cf.has_sailing_date / cf.total_cruises) * 100).toFixed(1)}%)`
    );
    console.log(
      `  - Return Date: ${cf.has_return_date} (${((cf.has_return_date / cf.total_cruises) * 100).toFixed(1)}%)`
    );
    console.log(
      `  - Nights: ${cf.has_nights} (${((cf.has_nights / cf.total_cruises) * 100).toFixed(1)}%)`
    );

    console.log(`\nPricing fields (has value):`);
    console.log(
      `  - Interior: ${cf.has_interior_price} (${((cf.has_interior_price / cf.total_cruises) * 100).toFixed(1)}%)`
    );
    console.log(
      `  - Oceanview: ${cf.has_oceanview_price} (${((cf.has_oceanview_price / cf.total_cruises) * 100).toFixed(1)}%)`
    );
    console.log(
      `  - Balcony: ${cf.has_balcony_price} (${((cf.has_balcony_price / cf.total_cruises) * 100).toFixed(1)}%)`
    );
    console.log(
      `  - Suite: ${cf.has_suite_price} (${((cf.has_suite_price / cf.total_cruises) * 100).toFixed(1)}%)`
    );

    console.log(`\nPricing fields (> 0):`);
    console.log(
      `  - Interior > 0: ${cf.valid_interior_price} (${((cf.valid_interior_price / cf.total_cruises) * 100).toFixed(1)}%)`
    );
    console.log(
      `  - Oceanview > 0: ${cf.valid_oceanview_price} (${((cf.valid_oceanview_price / cf.total_cruises) * 100).toFixed(1)}%)`
    );
    console.log(
      `  - Balcony > 0: ${cf.valid_balcony_price} (${((cf.valid_balcony_price / cf.total_cruises) * 100).toFixed(1)}%)`
    );
    console.log(
      `  - Suite > 0: ${cf.valid_suite_price} (${((cf.valid_suite_price / cf.total_cruises) * 100).toFixed(1)}%)`
    );

    // 3. Compare with raw JSONB data
    console.log('\n=== JSONB vs EXTRACTED DATA COMPARISON ===\n');

    const comparisonQuery = `
      SELECT
        COUNT(*) as total_raw_cruises,
        COUNT(DISTINCT data->>'codetocruiseid') as unique_cruise_ids,
        COUNT(CASE WHEN data->>'name' IS NOT NULL THEN 1 END) as raw_has_name,
        COUNT(CASE WHEN data->>'saildate' IS NOT NULL THEN 1 END) as raw_has_saildate,
        COUNT(CASE WHEN data->'cheapest'->>'inside' IS NOT NULL THEN 1 END) as raw_has_interior,
        COUNT(CASE WHEN data->'cheapest'->>'outside' IS NOT NULL THEN 1 END) as raw_has_oceanview,
        COUNT(CASE WHEN data->'cheapest'->>'balcony' IS NOT NULL THEN 1 END) as raw_has_balcony,
        COUNT(CASE WHEN data->'cheapest'->>'suite' IS NOT NULL THEN 1 END) as raw_has_suite
      FROM traveltek_cruises_raw
    `;

    const rawData = await client.query(comparisonQuery);
    const rd = rawData.rows[0];

    console.log(`Raw JSONB records: ${rd.total_raw_cruises}`);
    console.log(`Unique cruise IDs in raw: ${rd.unique_cruise_ids}`);
    console.log(`Extracted cruises: ${cf.total_cruises}`);
    console.log(`\nField comparison (Raw → Extracted):`);
    console.log(`  - Name: ${rd.raw_has_name} → ${cf.has_name}`);
    console.log(`  - Sailing Date: ${rd.raw_has_saildate} → ${cf.has_sailing_date}`);
    console.log(`  - Interior Price: ${rd.raw_has_interior} → ${cf.has_interior_price}`);
    console.log(`  - Oceanview Price: ${rd.raw_has_oceanview} → ${cf.has_oceanview_price}`);
    console.log(`  - Balcony Price: ${rd.raw_has_balcony} → ${cf.has_balcony_price}`);
    console.log(`  - Suite Price: ${rd.raw_has_suite} → ${cf.has_suite_price}`);

    // 4. Sample data verification
    console.log('\n=== SAMPLE DATA VERIFICATION ===\n');

    const sampleQuery = `
      SELECT
        c.id,
        c.name,
        c.sailing_date,
        c.nights,
        cl.name as cruise_line,
        s.name as ship,
        c.interior_price,
        c.oceanview_price,
        c.balcony_price,
        c.suite_price,
        r.data->>'name' as raw_name,
        r.data->>'saildate' as raw_saildate,
        (r.data->'cheapest'->>'inside')::numeric as raw_interior,
        (r.data->'cheapest'->>'outside')::numeric as raw_oceanview,
        (r.data->'cheapest'->>'balcony')::numeric as raw_balcony,
        (r.data->'cheapest'->>'suite')::numeric as raw_suite
      FROM cruises c
      LEFT JOIN traveltek_cruises_raw r ON r.data->>'codetocruiseid' = c.id
      LEFT JOIN cruise_lines cl ON cl.id = c.cruise_line_id
      LEFT JOIN ships s ON s.id = c.ship_id
      LIMIT 5
    `;

    const samples = await client.query(sampleQuery);

    console.log('Sample cruises with raw data comparison:');
    samples.rows.forEach((row, i) => {
      console.log(`\n${i + 1}. Cruise ID: ${row.id}`);
      console.log(`   Name: "${row.name}" vs Raw: "${row.raw_name}"`);
      console.log(`   Line/Ship: ${row.cruise_line} / ${row.ship}`);
      console.log(`   Date: ${row.sailing_date} vs Raw: ${row.raw_saildate}`);
      console.log(`   Nights: ${row.nights}`);
      console.log(`   Prices (Extracted vs Raw):`);
      console.log(`     Interior: $${row.interior_price} vs $${row.raw_interior}`);
      console.log(`     Oceanview: $${row.oceanview_price} vs $${row.raw_oceanview}`);
      console.log(`     Balcony: $${row.balcony_price} vs $${row.raw_balcony}`);
      console.log(`     Suite: $${row.suite_price} vs $${row.raw_suite}`);
    });

    // 5. Check for missing relationships
    console.log('\n=== RELATIONSHIP INTEGRITY ===\n');

    const integrityQuery = `
      SELECT
        (SELECT COUNT(*) FROM cruises WHERE cruise_line_id NOT IN (SELECT id FROM cruise_lines)) as missing_lines,
        (SELECT COUNT(*) FROM cruises WHERE ship_id NOT IN (SELECT id FROM ships)) as missing_ships,
        (SELECT COUNT(*) FROM cruises WHERE embarkation_port_id IS NOT NULL AND embarkation_port_id NOT IN (SELECT id FROM ports)) as missing_embark_ports,
        (SELECT COUNT(*) FROM cruises WHERE disembarkation_port_id IS NOT NULL AND disembarkation_port_id NOT IN (SELECT id FROM ports)) as missing_disembark_ports,
        (SELECT COUNT(*) FROM itineraries WHERE cruise_id NOT IN (SELECT id FROM cruises)) as orphan_itineraries
    `;

    const integrity = await client.query(integrityQuery);
    const int = integrity.rows[0];

    console.log(`Missing cruise lines: ${int.missing_lines}`);
    console.log(`Missing ships: ${int.missing_ships}`);
    console.log(`Missing embarkation ports: ${int.missing_embark_ports}`);
    console.log(`Missing disembarkation ports: ${int.missing_disembark_ports}`);
    console.log(`Orphan itineraries: ${int.orphan_itineraries}`);

    // 6. Check for data issues
    console.log('\n=== POTENTIAL DATA ISSUES ===\n');

    const issuesQuery = `
      SELECT
        COUNT(CASE WHEN sailing_date < CURRENT_DATE THEN 1 END) as past_cruises,
        COUNT(CASE WHEN sailing_date > CURRENT_DATE + INTERVAL '2 years' THEN 1 END) as far_future_cruises,
        COUNT(CASE WHEN nights <= 0 OR nights > 365 THEN 1 END) as invalid_nights,
        COUNT(CASE WHEN interior_price = 0 AND oceanview_price = 0 AND balcony_price = 0 AND suite_price = 0 THEN 1 END) as no_pricing,
        COUNT(CASE WHEN name IS NULL OR name = '' THEN 1 END) as missing_names
      FROM cruises
    `;

    const issues = await client.query(issuesQuery);
    const iss = issues.rows[0];

    console.log(`Past cruises: ${iss.past_cruises}`);
    console.log(`Cruises > 2 years out: ${iss.far_future_cruises}`);
    console.log(`Invalid nights: ${iss.invalid_nights}`);
    console.log(`No pricing data: ${iss.no_pricing}`);
    console.log(`Missing names: ${iss.missing_names}`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

verifyDataExtraction();
