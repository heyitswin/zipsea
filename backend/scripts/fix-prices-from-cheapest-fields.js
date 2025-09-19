#!/usr/bin/env node

// Fix cruise prices to use cheapest* fields from raw data as per documentation
// According to cruise-pricing-system.md:
// - cheapestinside → interior_price
// - cheapestoutside → oceanview_price
// - cheapestbalcony → balcony_price
// - cheapestsuite → suite_price

const { Pool } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;

async function fixCruisePricesFromCheapestFields() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('Starting to fix cruise prices from cheapest* fields in raw_data...\n');

    // First check how many cruises have raw_data with cheapest* fields
    const checkQuery = `
      SELECT COUNT(*) as total_with_data
      FROM cruises
      WHERE raw_data IS NOT NULL
        AND (
          raw_data->>'cheapestinside' IS NOT NULL OR
          raw_data->>'cheapestoutside' IS NOT NULL OR
          raw_data->>'cheapestbalcony' IS NOT NULL OR
          raw_data->>'cheapestsuite' IS NOT NULL
        );
    `;

    const checkResult = await pool.query(checkQuery);
    console.log(`Found ${checkResult.rows[0].total_with_data} cruises with cheapest* fields in raw_data\n`);

    // Check current status for cruise 2190299 before fix
    console.log('Checking cruise 2190299 before fix:');
    const beforeQuery = `
      SELECT
        id,
        cruise_id,
        name,
        interior_price,
        oceanview_price,
        balcony_price,
        suite_price,
        cheapest_price,
        raw_data->>'cheapestinside' as raw_interior,
        raw_data->>'cheapestoutside' as raw_oceanview,
        raw_data->>'cheapestbalcony' as raw_balcony,
        raw_data->>'cheapestsuite' as raw_suite
      FROM cruises
      WHERE id = '2190299';
    `;

    const beforeResult = await pool.query(beforeQuery);
    if (beforeResult.rows.length > 0) {
      const row = beforeResult.rows[0];
      console.log(`  Name: ${row.name}`);
      console.log(`  Current prices: Interior=$${row.interior_price}, Ocean=$${row.oceanview_price}, Balcony=$${row.balcony_price}, Suite=$${row.suite_price}`);
      console.log(`  Raw data prices: Interior=$${row.raw_interior}, Ocean=$${row.raw_oceanview}, Balcony=$${row.raw_balcony}, Suite=$${row.raw_suite}\n`);
    }

    // Update all cruises with prices from cheapest* fields in raw_data
    const updateQuery = `
      UPDATE cruises
      SET
        interior_price = CASE
          WHEN raw_data->>'cheapestinside' IS NOT NULL
            AND raw_data->>'cheapestinside' != ''
            AND raw_data->>'cheapestinside' ~ '^[0-9]+\.?[0-9]*$'
          THEN raw_data->>'cheapestinside'
          ELSE interior_price
        END,
        oceanview_price = CASE
          WHEN raw_data->>'cheapestoutside' IS NOT NULL
            AND raw_data->>'cheapestoutside' != ''
            AND raw_data->>'cheapestoutside' ~ '^[0-9]+\.?[0-9]*$'
          THEN raw_data->>'cheapestoutside'
          ELSE oceanview_price
        END,
        balcony_price = CASE
          WHEN raw_data->>'cheapestbalcony' IS NOT NULL
            AND raw_data->>'cheapestbalcony' != ''
            AND raw_data->>'cheapestbalcony' ~ '^[0-9]+\.?[0-9]*$'
          THEN raw_data->>'cheapestbalcony'
          ELSE balcony_price
        END,
        suite_price = CASE
          WHEN raw_data->>'cheapestsuite' IS NOT NULL
            AND raw_data->>'cheapestsuite' != ''
            AND raw_data->>'cheapestsuite' ~ '^[0-9]+\.?[0-9]*$'
          THEN raw_data->>'cheapestsuite'
          ELSE suite_price
        END,
        cheapest_price = LEAST(
          NULLIF(CASE
            WHEN raw_data->>'cheapestinside' IS NOT NULL
              AND raw_data->>'cheapestinside' != ''
              AND raw_data->>'cheapestinside' ~ '^[0-9]+\.?[0-9]*$'
            THEN (raw_data->>'cheapestinside')::numeric
            ELSE interior_price::numeric
          END, 0),
          NULLIF(CASE
            WHEN raw_data->>'cheapestoutside' IS NOT NULL
              AND raw_data->>'cheapestoutside' != ''
              AND raw_data->>'cheapestoutside' ~ '^[0-9]+\.?[0-9]*$'
            THEN (raw_data->>'cheapestoutside')::numeric
            ELSE oceanview_price::numeric
          END, 0),
          NULLIF(CASE
            WHEN raw_data->>'cheapestbalcony' IS NOT NULL
              AND raw_data->>'cheapestbalcony' != ''
              AND raw_data->>'cheapestbalcony' ~ '^[0-9]+\.?[0-9]*$'
            THEN (raw_data->>'cheapestbalcony')::numeric
            ELSE balcony_price::numeric
          END, 0),
          NULLIF(CASE
            WHEN raw_data->>'cheapestsuite' IS NOT NULL
              AND raw_data->>'cheapestsuite' != ''
              AND raw_data->>'cheapestsuite' ~ '^[0-9]+\.?[0-9]*$'
            THEN (raw_data->>'cheapestsuite')::numeric
            ELSE suite_price::numeric
          END, 0)
        ),
        updated_at = NOW()
      WHERE raw_data IS NOT NULL
        AND (
          raw_data->>'cheapestinside' IS NOT NULL OR
          raw_data->>'cheapestoutside' IS NOT NULL OR
          raw_data->>'cheapestbalcony' IS NOT NULL OR
          raw_data->>'cheapestsuite' IS NOT NULL
        );
    `;

    console.log('Updating all cruise prices from cheapest* fields...');
    const updateResult = await pool.query(updateQuery);
    console.log(`✅ Updated ${updateResult.rowCount} cruises with prices from cheapest* fields\n`);

    // Also update cheapest_pricing table
    const updateCheapestQuery = `
      UPDATE cheapest_pricing cp
      SET
        interior_price = c.interior_price::numeric,
        oceanview_price = c.oceanview_price::numeric,
        balcony_price = c.balcony_price::numeric,
        suite_price = c.suite_price::numeric,
        cheapest_price = c.cheapest_price::numeric,
        cheapest_cabin_type = CASE
          WHEN c.cheapest_price::numeric = c.interior_price::numeric THEN 'inside'
          WHEN c.cheapest_price::numeric = c.oceanview_price::numeric THEN 'outside'
          WHEN c.cheapest_price::numeric = c.balcony_price::numeric THEN 'balcony'
          WHEN c.cheapest_price::numeric = c.suite_price::numeric THEN 'suite'
          ELSE cp.cheapest_cabin_type
        END,
        last_updated = NOW()
      FROM cruises c
      WHERE cp.cruise_id = c.cruise_id
        AND (
          cp.interior_price != c.interior_price::numeric OR
          cp.oceanview_price != c.oceanview_price::numeric OR
          cp.balcony_price != c.balcony_price::numeric OR
          cp.suite_price != c.suite_price::numeric OR
          cp.cheapest_price != c.cheapest_price::numeric
        );
    `;

    console.log('Updating cheapest_pricing table...');
    const updateCheapestResult = await pool.query(updateCheapestQuery);
    console.log(`✅ Updated ${updateCheapestResult.rowCount} records in cheapest_pricing table\n`);

    // Check status for cruise 2190299 after fix
    console.log('Checking cruise 2190299 after fix:');
    const afterQuery = `
      SELECT
        c.id,
        c.cruise_id,
        c.name,
        c.interior_price,
        c.oceanview_price,
        c.balcony_price,
        c.suite_price,
        c.cheapest_price,
        cp.interior_price as cp_interior,
        cp.oceanview_price as cp_oceanview,
        cp.balcony_price as cp_balcony,
        cp.suite_price as cp_suite,
        cp.cheapest_price as cp_cheapest
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON c.cruise_id = cp.cruise_id
      WHERE c.id = '2190299';
    `;

    const afterResult = await pool.query(afterQuery);
    if (afterResult.rows.length > 0) {
      const row = afterResult.rows[0];
      console.log(`  Name: ${row.name}`);
      console.log(`  Cruises table: Interior=$${row.interior_price}, Ocean=$${row.oceanview_price}, Balcony=$${row.balcony_price}, Suite=$${row.suite_price}`);
      console.log(`  Cheapest: $${row.cheapest_price}`);
      console.log(`  Cheapest_pricing table: Interior=$${row.cp_interior}, Ocean=$${row.cp_oceanview}, Balcony=$${row.cp_balcony}, Suite=$${row.cp_suite}`);
      console.log(`  ✅ Tables match: ${row.interior_price == row.cp_interior && row.oceanview_price == row.cp_oceanview}\n`);
    }

    // Show some examples of updated cruises
    const examplesQuery = `
      SELECT
        id,
        cruise_id,
        name,
        interior_price,
        oceanview_price,
        balcony_price,
        suite_price,
        cheapest_price
      FROM cruises
      WHERE raw_data->>'cheapestinside' IS NOT NULL
        AND interior_price::numeric = (raw_data->>'cheapestinside')::numeric
      ORDER BY updated_at DESC
      LIMIT 5;
    `;

    const examplesResult = await pool.query(examplesQuery);
    if (examplesResult.rows.length > 0) {
      console.log('Examples of cruises updated with cheapest* prices:');
      for (const cruise of examplesResult.rows) {
        console.log(`  ${cruise.name}: Interior=$${cruise.interior_price}, Ocean=$${cruise.oceanview_price}, Balcony=$${cruise.balcony_price}, Suite=$${cruise.suite_price}`);
      }
    }

    console.log('\n✅ Script completed successfully');
    console.log('Prices are now using the cheapest* fields from raw_data as documented.');

  } catch (error) {
    console.error('Error fixing cruise prices:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixCruisePricesFromCheapestFields();
