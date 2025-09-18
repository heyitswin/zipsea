const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixAllCruises() {
  try {
    await client.connect();
    console.log('🚀 COMPREHENSIVE FIX FOR ALL CRUISES');
    console.log('=' + '='.repeat(70));
    console.log('');

    // STEP 1: Fix all double-encoded JSON
    console.log('STEP 1: Fixing double-encoded JSON for ALL cruises...');

    let totalFixed = 0;
    let totalPricesAdded = 0;
    let batch = 0;
    const batchSize = 500;

    while (true) {
      const doubleEncoded = await client.query(`
        SELECT id, cruise_id, raw_data::text as raw_data_str
        FROM cruises
        WHERE raw_data IS NOT NULL
        AND jsonb_typeof(raw_data) != 'object'
        LIMIT $1
      `, [batchSize]);

      if (doubleEncoded.rows.length === 0) break;

      batch++;
      console.log(`  Processing batch ${batch} (${doubleEncoded.rows.length} cruises)...`);

      for (const row of doubleEncoded.rows) {
        try {
          // Parse the double-encoded JSON
          const parsed = JSON.parse(JSON.parse(row.raw_data_str));

          // Update raw_data to proper JSON
          await client.query(`
            UPDATE cruises
            SET raw_data = $1::jsonb
            WHERE id = $2
          `, [JSON.stringify(parsed), row.id]);

          // Extract and store prices
          const prices = {
            interior: parsed.cheapestinside ? parseFloat(String(parsed.cheapestinside)) : null,
            oceanview: parsed.cheapestoutside ? parseFloat(String(parsed.cheapestoutside)) : null,
            balcony: parsed.cheapestbalcony ? parseFloat(String(parsed.cheapestbalcony)) : null,
            suite: parsed.cheapestsuite ? parseFloat(String(parsed.cheapestsuite)) : null
          };

          if (prices.interior || prices.oceanview || prices.balcony || prices.suite) {
            await client.query(`
              INSERT INTO cheapest_pricing (cruise_id, interior_price, oceanview_price, balcony_price, suite_price)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (cruise_id)
              DO UPDATE SET
                interior_price = COALESCE(EXCLUDED.interior_price, cheapest_pricing.interior_price),
                oceanview_price = COALESCE(EXCLUDED.oceanview_price, cheapest_pricing.oceanview_price),
                balcony_price = COALESCE(EXCLUDED.balcony_price, cheapest_pricing.balcony_price),
                suite_price = COALESCE(EXCLUDED.suite_price, cheapest_pricing.suite_price)
            `, [row.id, prices.interior, prices.oceanview, prices.balcony, prices.suite]);
            totalPricesAdded++;
          }

          totalFixed++;
        } catch (err) {
          // Continue on error
        }
      }

      if (batch % 10 === 0) {
        console.log(`    Progress: Fixed ${totalFixed} cruises, added prices for ${totalPricesAdded}`);
      }
    }

    console.log(`  ✅ Fixed ${totalFixed} double-encoded cruises, added prices for ${totalPricesAdded}\n`);

    // STEP 2: Extract missing prices from proper JSON
    console.log('STEP 2: Extracting missing prices from cruises with proper JSON...');

    const missingPrices = await client.query(`
      SELECT c.id, c.cruise_id, c.raw_data
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
      WHERE jsonb_typeof(c.raw_data) = 'object'
        AND (c.raw_data->>'cheapestinside' IS NOT NULL
          OR c.raw_data->>'cheapestoutside' IS NOT NULL
          OR c.raw_data->>'cheapestbalcony' IS NOT NULL
          OR c.raw_data->>'cheapestsuite' IS NOT NULL)
        AND (cp.interior_price IS NULL
          AND cp.oceanview_price IS NULL
          AND cp.balcony_price IS NULL
          AND cp.suite_price IS NULL)
    `);

    console.log(`  Found ${missingPrices.rows.length} cruises with missing price extractions`);

    let extractedCount = 0;
    for (const row of missingPrices.rows) {
      try {
        const rawData = row.raw_data;

        const prices = {
          interior: rawData.cheapestinside ? parseFloat(String(rawData.cheapestinside)) : null,
          oceanview: rawData.cheapestoutside ? parseFloat(String(rawData.cheapestoutside)) : null,
          balcony: rawData.cheapestbalcony ? parseFloat(String(rawData.cheapestbalcony)) : null,
          suite: rawData.cheapestsuite ? parseFloat(String(rawData.cheapestsuite)) : null
        };

        if (prices.interior || prices.oceanview || prices.balcony || prices.suite) {
          await client.query(`
            INSERT INTO cheapest_pricing (cruise_id, interior_price, oceanview_price, balcony_price, suite_price)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (cruise_id)
            DO UPDATE SET
              interior_price = COALESCE(EXCLUDED.interior_price, cheapest_pricing.interior_price),
              oceanview_price = COALESCE(EXCLUDED.oceanview_price, cheapest_pricing.oceanview_price),
              balcony_price = COALESCE(EXCLUDED.balcony_price, cheapest_pricing.balcony_price),
              suite_price = COALESCE(EXCLUDED.suite_price, cheapest_pricing.suite_price)
          `, [row.id, prices.interior, prices.oceanview, prices.balcony, prices.suite]);
          extractedCount++;
        }
      } catch (err) {
        // Continue
      }
    }

    console.log(`  ✅ Extracted prices for ${extractedCount} cruises\n`);

    // STEP 3: Final verification
    console.log('STEP 3: Final verification...');

    const finalStatus = await client.query(`
      SELECT
        COUNT(*) as total_cruises,
        COUNT(CASE WHEN jsonb_typeof(raw_data) = 'object' THEN 1 END) as proper_json,
        COUNT(CASE WHEN jsonb_typeof(raw_data) != 'object' AND raw_data IS NOT NULL THEN 1 END) as still_double_encoded,
        COUNT(CASE WHEN cp.interior_price IS NOT NULL OR cp.oceanview_price IS NOT NULL
                    OR cp.balcony_price IS NOT NULL OR cp.suite_price IS NOT NULL THEN 1 END) as has_prices
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
    `);

    console.log('=' + '='.repeat(70));
    console.log('✅ FINAL STATUS:');
    console.log(`  Total cruises: ${finalStatus.rows[0].total_cruises}`);
    console.log(`  Proper JSON: ${finalStatus.rows[0].proper_json}`);
    console.log(`  Still double-encoded: ${finalStatus.rows[0].still_double_encoded}`);
    console.log(`  Has prices: ${finalStatus.rows[0].has_prices}`);

    const percentWithPrices = Math.round((finalStatus.rows[0].has_prices / finalStatus.rows[0].total_cruises) * 100);
    console.log(`  Coverage: ${percentWithPrices}% of cruises have prices`);

    // Check NCL specifically
    const nclStatus = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN cp.interior_price IS NOT NULL OR cp.oceanview_price IS NOT NULL
                    OR cp.balcony_price IS NOT NULL OR cp.suite_price IS NOT NULL THEN 1 END) as with_prices
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
      WHERE c.cruise_line_id = 17
        AND c.sailing_date >= '2025-12-01'
        AND c.sailing_date < '2026-01-01'
    `);

    console.log(`\n  NCL December 2025: ${nclStatus.rows[0].with_prices} of ${nclStatus.rows[0].total} have prices`);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
    process.exit(0);
  }
}

// Run the fix
fixAllCruises();
