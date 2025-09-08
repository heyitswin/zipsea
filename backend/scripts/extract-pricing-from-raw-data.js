#!/usr/bin/env node

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_URL_PRODUCTION,
  ssl: process.env.NODE_ENV === 'production' || process.env.DATABASE_URL?.includes('render.com')
    ? { rejectUnauthorized: false }
    : false,
});

async function extractPricingFromRawData() {
  console.log('💰 EXTRACTING PRICING FROM RAW_DATA');
  console.log('=' .repeat(80));
  console.log('Time:', new Date().toISOString());
  console.log('');

  const client = await pool.connect();

  try {
    // 1. CHECK CURRENT STATUS
    console.log('📊 CHECKING CURRENT STATUS');
    console.log('-'.repeat(40));

    const statusCheck = await client.query(`
      SELECT
        COUNT(*) as total_cruises,
        COUNT(CASE WHEN raw_data IS NOT NULL THEN 1 END) as with_raw_data,
        COUNT(CASE WHEN raw_data->>'cheapest' IS NOT NULL THEN 1 END) as with_cheapest_data
      FROM cruises
      WHERE is_active = true
        AND sailing_date >= CURRENT_DATE
    `);

    console.log(`Total active cruises: ${statusCheck.rows[0].total_cruises}`);
    console.log(`With raw_data: ${statusCheck.rows[0].with_raw_data}`);
    console.log(`With cheapest pricing in raw_data: ${statusCheck.rows[0].with_cheapest_data}`);

    // Check existing cheapest_pricing records
    const existingPricing = await client.query(`
      SELECT COUNT(DISTINCT cruise_id) as count
      FROM cheapest_pricing
    `);

    console.log(`Existing cheapest_pricing records: ${existingPricing.rows[0].count}`);

    // 2. EXTRACT PRICING FROM RAW_DATA
    console.log('\n📦 EXTRACTING PRICING DATA');
    console.log('-'.repeat(40));

    // Get cruises with pricing data in raw_data but not in cheapest_pricing
    const cruisesToExtract = await client.query(`
      SELECT
        c.id,
        c.name,
        c.raw_data,
        c.raw_data->'cheapest' as cheapest_data,
        c.raw_data->'cheapest'->'combined' as combined_prices
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
      WHERE c.is_active = true
        AND c.sailing_date >= CURRENT_DATE
        AND c.raw_data IS NOT NULL
        AND c.raw_data->>'cheapest' IS NOT NULL
        AND cp.cruise_id IS NULL
      LIMIT 1000
    `);

    console.log(`Found ${cruisesToExtract.rows.length} cruises to extract pricing from`);

    if (cruisesToExtract.rows.length === 0) {
      console.log('✅ All cruises with pricing data have been extracted!');
      return;
    }

    // 3. PROCESS IN BATCHES
    const batchSize = 100;
    let extracted = 0;
    let failed = 0;

    for (let i = 0; i < cruisesToExtract.rows.length; i += batchSize) {
      const batch = cruisesToExtract.rows.slice(i, i + batchSize);
      const values = [];
      const placeholders = [];
      let paramCount = 0;

      for (const cruise of batch) {
        try {
          const cheapest = cruise.cheapest_data || {};
          const combined = cheapest.combined || {};

          // Extract prices - handle various formats
          let interiorPrice = null;
          let oceanviewPrice = null;
          let balconyPrice = null;
          let suitePrice = null;

          // Try different field names for compatibility
          interiorPrice = parseFloat(combined.inside || combined.interior || cheapest.cheapestinside) || null;
          oceanviewPrice = parseFloat(combined.outside || combined.oceanview || cheapest.cheapestoutside) || null;
          balconyPrice = parseFloat(combined.balcony || cheapest.cheapestbalcony) || null;
          suitePrice = parseFloat(combined.suite || cheapest.cheapestsuite) || null;

          // Calculate cheapest price
          const prices = [interiorPrice, oceanviewPrice, balconyPrice, suitePrice].filter(p => p && p > 0);
          const cheapestPrice = prices.length > 0 ? Math.min(...prices) : null;

          if (!cheapestPrice) {
            // Try to get from cheapestprice field directly
            const directPrice = parseFloat(cruise.raw_data.cheapestprice || cheapest.cheapestprice);
            if (directPrice && directPrice > 0) {
              values.push(
                cruise.id,
                directPrice,
                interiorPrice,
                oceanviewPrice,
                balconyPrice,
                suitePrice
              );

              const base = paramCount;
              placeholders.push(
                `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`
              );
              paramCount += 6;
            }
          } else {
            values.push(
              cruise.id,
              cheapestPrice,
              interiorPrice,
              oceanviewPrice,
              balconyPrice,
              suitePrice
            );

            const base = paramCount;
            placeholders.push(
              `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`
            );
            paramCount += 6;
          }
        } catch (err) {
          console.log(`⚠️  Failed to extract pricing for cruise ${cruise.id}:`, err.message);
          failed++;
        }
      }

      if (placeholders.length > 0) {
        try {
          const query = `
            INSERT INTO cheapest_pricing (
              cruise_id, cheapest_price, interior_price, oceanview_price,
              balcony_price, suite_price
            ) VALUES ${placeholders.join(', ')}
            ON CONFLICT (cruise_id) DO UPDATE SET
              cheapest_price = EXCLUDED.cheapest_price,
              interior_price = EXCLUDED.interior_price,
              oceanview_price = EXCLUDED.oceanview_price,
              balcony_price = EXCLUDED.balcony_price,
              suite_price = EXCLUDED.suite_price
          `;

          await client.query(query, values);
          extracted += placeholders.length;
          console.log(`✅ Batch ${Math.floor(i/batchSize) + 1}: Extracted ${placeholders.length} pricing records`);
        } catch (err) {
          console.error('❌ Batch insert failed:', err.message);
          failed += batch.length;
        }
      }
    }

    // 4. UPDATE CRUISE TABLE WITH PRICES
    console.log('\n🔄 UPDATING CRUISE TABLE WITH EXTRACTED PRICES');
    console.log('-'.repeat(40));

    const updateResult = await client.query(`
      UPDATE cruises c
      SET
        interior_price = cp.interior_price,
        oceanview_price = cp.oceanview_price,
        balcony_price = cp.balcony_price,
        suite_price = cp.suite_price
      FROM cheapest_pricing cp
      WHERE c.id = cp.cruise_id
        AND (
          c.interior_price IS NULL OR
          c.oceanview_price IS NULL OR
          c.balcony_price IS NULL OR
          c.suite_price IS NULL
        )
    `);

    console.log(`✅ Updated ${updateResult.rowCount} cruise records with pricing`);

    // 5. FINAL STATUS
    console.log('\n📊 FINAL STATUS');
    console.log('-'.repeat(40));

    const finalStatus = await client.query(`
      SELECT
        COUNT(DISTINCT c.id) as total_cruises,
        COUNT(DISTINCT cp.cruise_id) as cruises_with_pricing,
        AVG(cp.cheapest_price) as avg_price,
        MIN(cp.cheapest_price) as min_price,
        MAX(cp.cheapest_price) as max_price
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
      WHERE c.is_active = true
        AND c.sailing_date >= CURRENT_DATE
    `);

    const coverage = (finalStatus.rows[0].cruises_with_pricing / finalStatus.rows[0].total_cruises) * 100;

    console.log(`Total active cruises: ${finalStatus.rows[0].total_cruises}`);
    console.log(`Cruises with pricing: ${finalStatus.rows[0].cruises_with_pricing}`);
    console.log(`Coverage: ${coverage.toFixed(1)}%`);
    console.log(`Average price: $${parseFloat(finalStatus.rows[0].avg_price).toFixed(2)}`);
    console.log(`Price range: $${parseFloat(finalStatus.rows[0].min_price).toFixed(2)} - $${parseFloat(finalStatus.rows[0].max_price).toFixed(2)}`);

    console.log('\n✅ EXTRACTION COMPLETE');
    console.log(`Extracted: ${extracted} records`);
    console.log(`Failed: ${failed} records`);

  } catch (error) {
    console.error('❌ Extraction failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the extraction
extractPricingFromRawData()
  .then(() => {
    console.log('\n' + '='.repeat(80));
    console.log('Completed at:', new Date().toISOString());
    process.exit(0);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
