const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixAllCruisesRobust() {
  try {
    await client.connect();
    console.log('🚀 ROBUST FIX FOR ALL CRUISES - V2');
    console.log('=' + '='.repeat(70));
    console.log('');

    // Get initial count
    const initialCount = await client.query(`
      SELECT COUNT(*) as total
      FROM cruises
      WHERE raw_data IS NOT NULL
      AND jsonb_typeof(raw_data) != 'object'
    `);

    const totalToFix = parseInt(initialCount.rows[0].total);
    console.log(`Found ${totalToFix} cruises with double-encoded JSON to fix\n`);

    if (totalToFix === 0) {
      console.log('✨ All cruises already fixed!');
      await client.end();
      return;
    }

    let totalFixed = 0;
    let totalErrors = 0;
    let totalPricesAdded = 0;
    const batchSize = 100; // Smaller batch size for stability

    console.log('Processing in batches of', batchSize, '...\n');

    while (totalFixed < totalToFix) {
      try {
        // Get next batch
        const batch = await client.query(`
          SELECT id, cruise_id, raw_data::text as raw_data_str
          FROM cruises
          WHERE raw_data IS NOT NULL
          AND jsonb_typeof(raw_data) != 'object'
          LIMIT $1
        `, [batchSize]);

        if (batch.rows.length === 0) break;

        // Process each cruise in batch
        for (const row of batch.rows) {
          try {
            // Parse double-encoded JSON
            let parsed;
            try {
              parsed = JSON.parse(JSON.parse(row.raw_data_str));
            } catch (e) {
              // Try single parse if double parse fails
              parsed = JSON.parse(row.raw_data_str);
            }

            // Update raw_data
            await client.query(`
              UPDATE cruises
              SET raw_data = $1::jsonb
              WHERE id = $2
            `, [JSON.stringify(parsed), row.id]);

            // Extract prices if available
            const prices = {
              interior: null,
              oceanview: null,
              balcony: null,
              suite: null
            };

            // Try multiple field names for compatibility
            if (parsed.cheapestinside) prices.interior = parseFloat(String(parsed.cheapestinside));
            if (parsed.cheapestoutside) prices.oceanview = parseFloat(String(parsed.cheapestoutside));
            if (parsed.cheapestbalcony) prices.balcony = parseFloat(String(parsed.cheapestbalcony));
            if (parsed.cheapestsuite) prices.suite = parseFloat(String(parsed.cheapestsuite));

            // Also try alternative field names
            if (!prices.interior && parsed.cheapest_inside) prices.interior = parseFloat(String(parsed.cheapest_inside));
            if (!prices.oceanview && parsed.cheapest_outside) prices.oceanview = parseFloat(String(parsed.cheapest_outside));
            if (!prices.balcony && parsed.cheapest_balcony) prices.balcony = parseFloat(String(parsed.cheapest_balcony));
            if (!prices.suite && parsed.cheapest_suite) prices.suite = parseFloat(String(parsed.cheapest_suite));

            // Update prices if any found
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
            totalErrors++;
            console.error(`  Error fixing cruise ${row.cruise_id}: ${err.message}`);
          }
        }

        // Progress update
        const percent = Math.round((totalFixed / totalToFix) * 100);
        console.log(`Progress: ${totalFixed}/${totalToFix} (${percent}%) - Prices: ${totalPricesAdded}, Errors: ${totalErrors}`);

      } catch (batchErr) {
        console.error('Batch error:', batchErr.message);
        // Continue with next batch
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ PHASE 1 COMPLETE');
    console.log(`  Fixed: ${totalFixed} cruises`);
    console.log(`  Prices added: ${totalPricesAdded}`);
    console.log(`  Errors: ${totalErrors}`);

    // PHASE 2: Extract missing prices from proper JSON
    console.log('\n📊 PHASE 2: Extracting missing prices...\n');

    const missingPrices = await client.query(`
      SELECT c.id, c.raw_data
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
      WHERE jsonb_typeof(c.raw_data) = 'object'
        AND (
          c.raw_data->>'cheapestinside' IS NOT NULL
          OR c.raw_data->>'cheapestoutside' IS NOT NULL
          OR c.raw_data->>'cheapestbalcony' IS NOT NULL
          OR c.raw_data->>'cheapestsuite' IS NOT NULL
        )
        AND COALESCE(cp.interior_price, cp.oceanview_price, cp.balcony_price, cp.suite_price) IS NULL
    `);

    console.log(`Found ${missingPrices.rows.length} cruises with missing price extractions`);

    let extractedCount = 0;
    for (const row of missingPrices.rows) {
      try {
        const prices = {
          interior: row.raw_data.cheapestinside ? parseFloat(String(row.raw_data.cheapestinside)) : null,
          oceanview: row.raw_data.cheapestoutside ? parseFloat(String(row.raw_data.cheapestoutside)) : null,
          balcony: row.raw_data.cheapestbalcony ? parseFloat(String(row.raw_data.cheapestbalcony)) : null,
          suite: row.raw_data.cheapestsuite ? parseFloat(String(row.raw_data.cheapestsuite)) : null
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

    console.log(`✅ Extracted prices for ${extractedCount} cruises`);

    // Final status
    console.log('\n' + '='.repeat(70));
    console.log('📊 FINAL STATUS CHECK');

    const finalStatus = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN jsonb_typeof(raw_data) = 'object' THEN 1 END) as proper_json,
        COUNT(CASE WHEN jsonb_typeof(raw_data) != 'object' AND raw_data IS NOT NULL THEN 1 END) as still_broken
      FROM cruises
    `);

    const pricingStatus = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN cp.interior_price IS NOT NULL OR cp.oceanview_price IS NOT NULL
                    OR cp.balcony_price IS NOT NULL OR cp.suite_price IS NOT NULL THEN 1 END) as has_prices
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
    `);

    console.log(`  Total cruises: ${finalStatus.rows[0].total}`);
    console.log(`  ✅ Proper JSON: ${finalStatus.rows[0].proper_json}`);
    console.log(`  ❌ Still broken: ${finalStatus.rows[0].still_broken}`);
    console.log(`  💰 Has prices: ${pricingStatus.rows[0].has_prices}`);

    const fixPercent = Math.round((finalStatus.rows[0].proper_json / finalStatus.rows[0].total) * 100);
    const pricePercent = Math.round((pricingStatus.rows[0].has_prices / pricingStatus.rows[0].total) * 100);

    console.log(`\n  JSON fixed: ${fixPercent}%`);
    console.log(`  Price coverage: ${pricePercent}%`);

    console.log('\n✨ FIX COMPLETE!');

  } catch (err) {
    console.error('Fatal error:', err);
  } finally {
    await client.end();
    process.exit(0);
  }
}

// Run immediately
fixAllCruisesRobust();
