#!/usr/bin/env node

// Fix cheapest_pricing table to match corrected cruises table prices

const { Pool } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;

async function fixCheapestPricingTable() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('Starting cheapest_pricing table fix...\n');

    // Update cheapest_pricing table from cruises table
    const updateQuery = `
      UPDATE cheapest_pricing cp
      SET
        cheapest_price = c.cheapest_price::numeric,
        interior_price = c.interior_price::numeric,
        oceanview_price = c.oceanview_price::numeric,
        balcony_price = c.balcony_price::numeric,
        suite_price = c.suite_price::numeric,
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
          cp.cheapest_price != c.cheapest_price::numeric OR
          cp.interior_price != c.interior_price::numeric OR
          cp.oceanview_price != c.oceanview_price::numeric OR
          cp.balcony_price != c.balcony_price::numeric OR
          cp.suite_price != c.suite_price::numeric OR
          cp.cheapest_price IS NULL AND c.cheapest_price IS NOT NULL OR
          cp.interior_price IS NULL AND c.interior_price IS NOT NULL OR
          cp.oceanview_price IS NULL AND c.oceanview_price IS NOT NULL OR
          cp.balcony_price IS NULL AND c.balcony_price IS NOT NULL OR
          cp.suite_price IS NULL AND c.suite_price IS NOT NULL
        );
    `;

    console.log('Updating cheapest_pricing table from cruises table...');
    const updateResult = await pool.query(updateQuery);
    console.log(`✅ Updated ${updateResult.rowCount} records in cheapest_pricing table\n`);

    // Insert or update missing records from cruises table
    const insertQuery = `
      INSERT INTO cheapest_pricing (
        cruise_id,
        cheapest_price,
        interior_price,
        oceanview_price,
        balcony_price,
        suite_price,
        cheapest_cabin_type,
        currency,
        last_updated
      )
      SELECT
        c.cruise_id,
        c.cheapest_price::numeric,
        c.interior_price::numeric,
        c.oceanview_price::numeric,
        c.balcony_price::numeric,
        c.suite_price::numeric,
        CASE
          WHEN c.cheapest_price::numeric = c.interior_price::numeric THEN 'inside'
          WHEN c.cheapest_price::numeric = c.oceanview_price::numeric THEN 'outside'
          WHEN c.cheapest_price::numeric = c.balcony_price::numeric THEN 'balcony'
          WHEN c.cheapest_price::numeric = c.suite_price::numeric THEN 'suite'
          ELSE 'inside'
        END,
        'USD',
        NOW()
      FROM cruises c
      WHERE c.cheapest_price IS NOT NULL
      ON CONFLICT (cruise_id) DO UPDATE
      SET
        cheapest_price = EXCLUDED.cheapest_price,
        interior_price = EXCLUDED.interior_price,
        oceanview_price = EXCLUDED.oceanview_price,
        balcony_price = EXCLUDED.balcony_price,
        suite_price = EXCLUDED.suite_price,
        cheapest_cabin_type = EXCLUDED.cheapest_cabin_type,
        last_updated = NOW();
    `;

    console.log('Inserting missing records into cheapest_pricing table...');
    const insertResult = await pool.query(insertQuery);
    console.log(`✅ Inserted ${insertResult.rowCount} new records into cheapest_pricing table\n`);

    // Verify cruise 2190299
    const verifyQuery = `
      SELECT
        c.cruise_id,
        c.name,
        c.cheapest_price::numeric as cruise_cheapest,
        c.interior_price::numeric as cruise_interior,
        cp.cheapest_price as cp_cheapest,
        cp.interior_price as cp_interior
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON c.cruise_id = cp.cruise_id
      WHERE c.cruise_id = '2190299';
    `;

    const verifyResult = await pool.query(verifyQuery);
    if (verifyResult.rows.length > 0) {
      const row = verifyResult.rows[0];
      console.log('Verification for cruise 2190299:');
      console.log(`  Name: ${row.name}`);
      console.log(
        `  Cruises table - cheapest: $${row.cruise_cheapest}, interior: $${row.cruise_interior}`
      );
      console.log(
        `  Cheapest_pricing table - cheapest: $${row.cp_cheapest}, interior: $${row.cp_interior}`
      );
      console.log(
        `  ✅ Tables match: ${row.cruise_cheapest == row.cp_cheapest && row.cruise_interior == row.cp_interior}\n`
      );
    }

    console.log('✅ Script completed successfully');
  } catch (error) {
    console.error('Error fixing cheapest_pricing table:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixCheapestPricingTable();
