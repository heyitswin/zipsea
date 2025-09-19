#!/usr/bin/env node

// Verify that cheapest_price is correctly calculated from cabin prices
// Run this after the webhook processor fix to ensure it's working

const { Pool } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;

async function verifyPriceFix() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    console.log('Verifying cheapest_price calculation...\n');

    // Check for mismatches where cheapest_price doesn't match MIN of cabin prices
    const mismatchQuery = `
      SELECT
        id,
        cruise_id,
        cheapest_price::numeric,
        interior_price::numeric,
        oceanview_price::numeric,
        balcony_price::numeric,
        suite_price::numeric,
        LEAST(
          NULLIF(interior_price::numeric, 0),
          NULLIF(oceanview_price::numeric, 0),
          NULLIF(balcony_price::numeric, 0),
          NULLIF(suite_price::numeric, 0)
        ) as calculated_cheapest,
        raw_data->>'cheapestinside' as raw_cheapest_inside
      FROM cruises
      WHERE cheapest_price IS NOT NULL
        AND LEAST(
          NULLIF(interior_price::numeric, 0),
          NULLIF(oceanview_price::numeric, 0),
          NULLIF(balcony_price::numeric, 0),
          NULLIF(suite_price::numeric, 0)
        ) IS NOT NULL
        AND ABS(cheapest_price::numeric - LEAST(
          NULLIF(interior_price::numeric, 0),
          NULLIF(oceanview_price::numeric, 0),
          NULLIF(balcony_price::numeric, 0),
          NULLIF(suite_price::numeric, 0)
        )) > 0.01
      LIMIT 10;
    `;

    const mismatchResult = await pool.query(mismatchQuery);

    if (mismatchResult.rows.length === 0) {
      console.log('✅ SUCCESS: All cheapest_price values correctly match MIN of cabin prices!\n');
    } else {
      console.log(`⚠️  WARNING: Found ${mismatchResult.rows.length} cruises with mismatched prices:\n`);

      for (const row of mismatchResult.rows) {
        console.log(`Cruise ${row.cruise_id}:`);
        console.log(`  Current cheapest_price: $${row.cheapest_price}`);
        console.log(`  Calculated from cabins: $${row.calculated_cheapest}`);
        console.log(`  Cabin prices: Interior=$${row.interior_price}, Oceanview=$${row.oceanview_price}, Balcony=$${row.balcony_price}, Suite=$${row.suite_price}`);
        console.log(`  Raw JSON cheapestinside: ${row.raw_cheapest_inside}\n`);
      }
    }

    // Count total mismatches
    const countQuery = `
      SELECT COUNT(*) as mismatch_count
      FROM cruises
      WHERE cheapest_price IS NOT NULL
        AND LEAST(
          NULLIF(interior_price::numeric, 0),
          NULLIF(oceanview_price::numeric, 0),
          NULLIF(balcony_price::numeric, 0),
          NULLIF(suite_price::numeric, 0)
        ) IS NOT NULL
        AND ABS(cheapest_price::numeric - LEAST(
          NULLIF(interior_price::numeric, 0),
          NULLIF(oceanview_price::numeric, 0),
          NULLIF(balcony_price::numeric, 0),
          NULLIF(suite_price::numeric, 0)
        )) > 0.01;
    `;

    const countResult = await pool.query(countQuery);
    const mismatchCount = countResult.rows[0].mismatch_count;

    if (mismatchCount > 0) {
      console.log(`\n❌ Total mismatches found: ${mismatchCount} cruises`);
      console.log('These cruises still need to be fixed. Run fix-cheapest-price-mismatch.js to correct them.\n');
    }

    // Check a specific cruise that was previously problematic
    const specificQuery = `
      SELECT
        cruise_id,
        cheapest_price::numeric,
        interior_price::numeric,
        oceanview_price::numeric,
        balcony_price::numeric,
        suite_price::numeric,
        raw_data->>'cheapestinside' as raw_cheapest_inside
      FROM cruises
      WHERE cruise_id = '2190299';
    `;

    const specificResult = await pool.query(specificQuery);
    if (specificResult.rows.length > 0) {
      const cruise = specificResult.rows[0];
      console.log('\nSpecific cruise 2190299 (previously problematic):');
      console.log(`  cheapest_price: $${cruise.cheapest_price}`);
      console.log(`  interior_price: $${cruise.interior_price}`);
      console.log(`  Should match: ${cruise.cheapest_price == cruise.interior_price ? '✅ YES' : '❌ NO'}\n`);
    }

  } catch (error) {
    console.error('Error verifying prices:', error);
  } finally {
    await pool.end();
  }
}

verifyPriceFix();
