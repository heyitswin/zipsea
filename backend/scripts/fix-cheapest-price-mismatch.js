#!/usr/bin/env node

/**
 * Fix cheapest_price mismatch issue
 *
 * Problem: cheapest_price is incorrectly using values from cheapest_inside/cheapest_outside
 * instead of calculating from actual cabin prices (interior_price, oceanview_price, etc.)
 *
 * This affects 16,603+ cruises where cheapest_price doesn't match the actual minimum cabin price.
 *
 * Example: Cruise 2190299
 * - interior_price: 522.00 (correct)
 * - cheapest_inside: 1093.18 (from raw JSON)
 * - cheapest_price: 1093.18 (WRONG - should be 522.00)
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_URL_PRODUCTION,
  ssl: process.env.NODE_ENV === 'production' || process.env.DATABASE_URL?.includes('render.com')
    ? { rejectUnauthorized: false }
    : false
});

async function fixCheapestPrices() {
  const client = await pool.connect();

  try {
    console.log('Starting cheapest_price fix...\n');

    // First, get the count of mismatches
    const countResult = await client.query(`
      WITH price_check AS (
        SELECT
          id,
          cheapest_price,
          LEAST(
            NULLIF(interior_price, 0),
            NULLIF(oceanview_price, 0),
            NULLIF(balcony_price, 0),
            NULLIF(suite_price, 0)
          ) as calculated_cheapest
        FROM cruises
        WHERE is_active = true
          AND cheapest_price IS NOT NULL
      )
      SELECT COUNT(*) as total_mismatches
      FROM price_check
      WHERE cheapest_price != calculated_cheapest
        AND calculated_cheapest IS NOT NULL
    `);

    const totalMismatches = parseInt(countResult.rows[0].total_mismatches);
    console.log(`Found ${totalMismatches} cruises with incorrect cheapest_price\n`);

    if (totalMismatches === 0) {
      console.log('No mismatches found. All prices are correct!');
      return;
    }

    // Show some examples before fixing
    console.log('Examples of mismatches (showing first 5):');
    const examples = await client.query(`
      WITH price_check AS (
        SELECT
          id,
          name,
          interior_price,
          oceanview_price,
          balcony_price,
          suite_price,
          cheapest_price,
          LEAST(
            NULLIF(interior_price, 0),
            NULLIF(oceanview_price, 0),
            NULLIF(balcony_price, 0),
            NULLIF(suite_price, 0)
          ) as calculated_cheapest
        FROM cruises
        WHERE is_active = true
          AND cheapest_price IS NOT NULL
      )
      SELECT *
      FROM price_check
      WHERE cheapest_price != calculated_cheapest
        AND calculated_cheapest IS NOT NULL
      ORDER BY id
      LIMIT 5
    `);

    for (const row of examples.rows) {
      console.log(`\nID ${row.id}: ${row.name}`);
      console.log(`  Cabin prices: Interior=${row.interior_price}, Ocean=${row.oceanview_price}, Balcony=${row.balcony_price}, Suite=${row.suite_price}`);
      console.log(`  Current cheapest_price: ${row.cheapest_price}`);
      console.log(`  Should be: ${row.calculated_cheapest}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('Fixing cheapest_price for all mismatched cruises...');
    console.log('='.repeat(60) + '\n');

    // Fix all mismatches in one query
    const updateResult = await client.query(`
      WITH price_fix AS (
        SELECT
          id,
          LEAST(
            NULLIF(interior_price, 0),
            NULLIF(oceanview_price, 0),
            NULLIF(balcony_price, 0),
            NULLIF(suite_price, 0)
          ) as new_cheapest
        FROM cruises
        WHERE is_active = true
      )
      UPDATE cruises
      SET cheapest_price = price_fix.new_cheapest,
          updated_at = NOW()
      FROM price_fix
      WHERE cruises.id = price_fix.id
        AND cruises.cheapest_price != price_fix.new_cheapest
        AND price_fix.new_cheapest IS NOT NULL
      RETURNING cruises.id
    `);

    console.log(`✅ Fixed ${updateResult.rowCount} cruises\n`);

    // Verify the fix for our specific example cruise
    const verifyResult = await client.query(`
      SELECT
        id,
        name,
        interior_price,
        cheapest_price,
        LEAST(
          NULLIF(interior_price, 0),
          NULLIF(oceanview_price, 0),
          NULLIF(balcony_price, 0),
          NULLIF(suite_price, 0)
        ) as calculated_cheapest
      FROM cruises
      WHERE id = '2190299'
    `);

    if (verifyResult.rows.length > 0) {
      const cruise = verifyResult.rows[0];
      console.log('Verification for cruise 2190299:');
      console.log(`  Name: ${cruise.name}`);
      console.log(`  Interior price: ${cruise.interior_price}`);
      console.log(`  New cheapest_price: ${cruise.cheapest_price}`);
      console.log(`  Calculated cheapest: ${cruise.calculated_cheapest}`);
      console.log(`  ✅ Match: ${cruise.cheapest_price === cruise.calculated_cheapest}`);
    }

    // Check if there are any remaining mismatches
    const finalCheck = await client.query(`
      WITH price_check AS (
        SELECT
          id,
          cheapest_price,
          LEAST(
            NULLIF(interior_price, 0),
            NULLIF(oceanview_price, 0),
            NULLIF(balcony_price, 0),
            NULLIF(suite_price, 0)
          ) as calculated_cheapest
        FROM cruises
        WHERE is_active = true
          AND cheapest_price IS NOT NULL
      )
      SELECT COUNT(*) as remaining_mismatches
      FROM price_check
      WHERE cheapest_price != calculated_cheapest
        AND calculated_cheapest IS NOT NULL
    `);

    const remaining = parseInt(finalCheck.rows[0].remaining_mismatches);
    console.log(`\n${remaining === 0 ? '✅' : '⚠️'} Remaining mismatches: ${remaining}`);

    if (remaining === 0) {
      console.log('\n🎉 All cheapest_price values have been corrected!');
    } else {
      console.log('\n⚠️ Some mismatches remain. These may need manual review.');
    }

  } catch (error) {
    console.error('Error fixing cheapest prices:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the fix
fixCheapestPrices()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  });
