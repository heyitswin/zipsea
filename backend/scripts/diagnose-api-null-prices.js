require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function diagnoseAPINulls() {
  try {
    console.log('🔍 DIAGNOSING WHY API RETURNS NULL PRICES FOR SOME CRUISES');
    console.log('=' .repeat(60));

    // First, let's check cruise 2190299 specifically
    console.log('\n1️⃣ CHECKING CRUISE 2190299 SPECIFICALLY:\n');

    const specificResult = await pool.query(`
      SELECT
        c.id,
        c.name,
        c.interior_price as cruises_interior,
        c.oceanview_price as cruises_oceanview,
        c.balcony_price as cruises_balcony,
        c.suite_price as cruises_suite,
        c.cheapest_price as cruises_cheapest,
        cp.interior_price as cp_interior,
        cp.oceanview_price as cp_oceanview,
        cp.balcony_price as cp_balcony,
        cp.suite_price as cp_suite,
        cp.cheapest_price as cp_cheapest,
        c.updated_at as cruises_updated,
        cp.last_updated as cp_updated
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
      WHERE c.id = '2190299'
    `);

    if (specificResult.rows.length > 0) {
      const data = specificResult.rows[0];
      console.log('Cruises table prices:');
      console.log(`  Interior:  $${data.cruises_interior}`);
      console.log(`  Oceanview: $${data.cruises_oceanview}`);
      console.log(`  Balcony:   $${data.cruises_balcony}`);
      console.log(`  Suite:     $${data.cruises_suite}`);
      console.log(`  Cheapest:  $${data.cruises_cheapest}`);
      console.log(`  Updated:   ${data.cruises_updated}\n`);

      console.log('Cheapest_pricing table:');
      if (data.cp_interior) {
        console.log(`  Interior:  $${data.cp_interior}`);
        console.log(`  Oceanview: $${data.cp_oceanview}`);
        console.log(`  Balcony:   $${data.cp_balcony}`);
        console.log(`  Suite:     $${data.cp_suite}`);
        console.log(`  Cheapest:  $${data.cp_cheapest}`);
        console.log(`  Updated:   ${data.cp_updated}`);
      } else {
        console.log(`  ❌ NO ENTRY IN CHEAPEST_PRICING TABLE`);
      }
    }

    // Check what the API service query would return
    console.log('\n2️⃣ SIMULATING API SERVICE QUERY:\n');
    console.log('The API likely queries cruises table directly, not cheapest_pricing.');
    console.log('Let\'s check what fields the API would see:\n');

    const apiSimulation = await pool.query(`
      SELECT
        c.id,
        c.name,
        c.interior_price,
        c.oceanview_price,
        c.balcony_price,
        c.suite_price,
        c.cheapest_price,
        c.voyage_code,
        c.sailing_date,
        cl.name as cruise_line_name,
        s.name as ship_name
      FROM cruises c
      LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      LEFT JOIN ships s ON c.ship_id = s.id
      WHERE c.id = '2190299'
    `);

    if (apiSimulation.rows.length > 0) {
      const cruise = apiSimulation.rows[0];
      console.log('What the API query sees:');
      console.log(`  ID: ${cruise.id}`);
      console.log(`  Name: ${cruise.name}`);
      console.log(`  Interior: ${cruise.interior_price}`);
      console.log(`  Oceanview: ${cruise.oceanview_price}`);
      console.log(`  Balcony: ${cruise.balcony_price}`);
      console.log(`  Suite: ${cruise.suite_price}`);
      console.log(`  Cheapest: ${cruise.cheapest_price}`);
    }

    // Check if this is a data type issue
    console.log('\n3️⃣ CHECKING DATA TYPES:\n');

    const typeCheckResult = await pool.query(`
      SELECT
        pg_typeof(interior_price) as interior_type,
        pg_typeof(oceanview_price) as oceanview_type,
        pg_typeof(balcony_price) as balcony_type,
        pg_typeof(suite_price) as suite_type,
        pg_typeof(cheapest_price) as cheapest_type
      FROM cruises
      WHERE id = '2190299'
    `);

    if (typeCheckResult.rows.length > 0) {
      const types = typeCheckResult.rows[0];
      console.log('Column data types in cruises table:');
      Object.entries(types).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    }

    // Find pattern in cruises where API might return null
    console.log('\n4️⃣ FINDING PATTERN IN POTENTIAL API NULL CASES:\n');

    const patternResult = await pool.query(`
      WITH price_issues AS (
        SELECT
          c.id,
          c.name,
          c.interior_price,
          c.cheapest_price,
          cp.cruise_id as in_cheapest_pricing,
          CASE
            WHEN c.interior_price IS NULL THEN 'NULL_PRICES'
            WHEN c.cheapest_price IS NULL THEN 'NULL_CHEAPEST'
            WHEN cp.cruise_id IS NULL THEN 'MISSING_FROM_CP'
            WHEN c.cheapest_price != cp.cheapest_price THEN 'PRICE_MISMATCH'
            ELSE 'OK'
          END as issue_type
        FROM cruises c
        LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
        WHERE c.sailing_date > CURRENT_DATE
      )
      SELECT
        issue_type,
        COUNT(*) as count,
        ARRAY_AGG(id ORDER BY id LIMIT 5) as sample_ids
      FROM price_issues
      GROUP BY issue_type
      ORDER BY count DESC
    `);

    console.log('Issue distribution:');
    patternResult.rows.forEach(row => {
      console.log(`  ${row.issue_type}: ${row.count} cruises`);
      if (row.issue_type !== 'OK' && row.sample_ids.length > 0) {
        console.log(`    Sample IDs: ${row.sample_ids.join(', ')}`);
      }
    });

    // Check if the issue is in the API service code
    console.log('\n5️⃣ API SERVICE POTENTIAL ISSUES:\n');
    console.log('The API might be returning null because:');
    console.log('1. The Drizzle ORM query is not selecting price fields properly');
    console.log('2. The serialization is dropping decimal fields');
    console.log('3. The API is checking cheapest_pricing table but cruise is missing');
    console.log('4. There\'s a caching layer returning old data');

    // Check the exact data for cruise 2190299
    console.log('\n6️⃣ RAW DATABASE VALUES FOR 2190299:\n');

    const rawResult = await pool.query(`
      SELECT
        interior_price::text as interior_text,
        oceanview_price::text as oceanview_text,
        balcony_price::text as balcony_text,
        suite_price::text as suite_text,
        cheapest_price::text as cheapest_text
      FROM cruises
      WHERE id = '2190299'
    `);

    if (rawResult.rows.length > 0) {
      const raw = rawResult.rows[0];
      console.log('Raw text values in database:');
      console.log(`  Interior:  "${raw.interior_text}"`);
      console.log(`  Oceanview: "${raw.oceanview_text}"`);
      console.log(`  Balcony:   "${raw.balcony_text}"`);
      console.log(`  Suite:     "${raw.suite_text}"`);
      console.log(`  Cheapest:  "${raw.cheapest_text}"`);
    }

    console.log('\n' + '=' .repeat(60));
    console.log('\n🎯 DIAGNOSIS COMPLETE\n');
    console.log('Next steps:');
    console.log('1. Check the cruise.service.ts getCruiseDetails method');
    console.log('2. Verify the Drizzle ORM schema matches database columns');
    console.log('3. Check if the API is properly selecting price fields');
    console.log('4. Ensure decimal fields are being serialized correctly');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

diagnoseAPINulls();
