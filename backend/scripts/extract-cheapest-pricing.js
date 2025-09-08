#!/usr/bin/env node

const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_URL_PRODUCTION,
  ssl:
    process.env.NODE_ENV === 'production' || process.env.DATABASE_URL?.includes('render.com')
      ? { rejectUnauthorized: false }
      : false,
});

async function extractCheapestPricing() {
  try {
    await client.connect();

    console.log('💰 Extracting Cheapest Pricing Data');
    console.log('='.repeat(60));

    // First, clear the existing cheapest_pricing table
    await client.query('TRUNCATE TABLE cheapest_pricing');
    console.log('✅ Cleared existing cheapest_pricing table');

    // Get all cruises with cheapest pricing data
    const cruisesWithPricing = await client.query(`
      SELECT
        id,
        raw_data->>'cheapestprice' as cheapestprice,
        raw_data->>'cheapestinside' as cheapestinside,
        raw_data->>'cheapestoutside' as cheapestoutside,
        raw_data->>'cheapestbalcony' as cheapestbalcony,
        raw_data->>'cheapestsuite' as cheapestsuite
      FROM cruises
      WHERE is_active = true
        AND sailing_date >= CURRENT_DATE
        AND raw_data->>'cheapestprice' IS NOT NULL
        AND raw_data->>'cheapestprice' != 'null'
        AND raw_data->>'cheapestprice' != ''
    `);

    console.log(`\n📊 Found ${cruisesWithPricing.rows.length} cruises with cheapest pricing`);

    let inserted = 0;
    let failed = 0;
    const batchSize = 100;

    // Process in batches
    for (let i = 0; i < cruisesWithPricing.rows.length; i += batchSize) {
      const batch = cruisesWithPricing.rows.slice(i, i + batchSize);
      const values = [];
      const placeholders = [];
      let paramCount = 0;

      for (const cruise of batch) {
        // Parse the prices
        const cheapestPrice = parseFloat(cruise.cheapestprice) || null;
        const interiorPrice = parseFloat(cruise.cheapestinside) || null;
        const oceanviewPrice = parseFloat(cruise.cheapestoutside) || null;
        const balconyPrice = parseFloat(cruise.cheapestbalcony) || null;
        const suitePrice = parseFloat(cruise.cheapestsuite) || null;

        // Skip if no valid cheapest price
        if (!cheapestPrice) continue;

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
          `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, NOW())`
        );
        paramCount += 6;
      }

      if (placeholders.length > 0) {
        try {
          const query = `
            INSERT INTO cheapest_pricing (
              cruise_id, cheapest_price, interior_price, oceanview_price,
              balcony_price, suite_price, last_updated
            ) VALUES ${placeholders.join(', ')}
            ON CONFLICT (cruise_id) DO UPDATE SET
              cheapest_price = EXCLUDED.cheapest_price,
              interior_price = EXCLUDED.interior_price,
              oceanview_price = EXCLUDED.oceanview_price,
              balcony_price = EXCLUDED.balcony_price,
              suite_price = EXCLUDED.suite_price,
              last_updated = NOW()
          `;

          await client.query(query, values);
          inserted += placeholders.length;

          if ((i + batchSize) % 1000 === 0 || i + batchSize >= cruisesWithPricing.rows.length) {
            console.log(
              `  Processed ${Math.min(i + batchSize, cruisesWithPricing.rows.length)}/${cruisesWithPricing.rows.length} cruises...`
            );
          }
        } catch (error) {
          console.error(`❌ Batch insert failed:`, error.message);
          failed += batch.length;
        }
      }
    }

    console.log(`\n✅ Extraction Complete:`);
    console.log(`  Successfully inserted: ${inserted} records`);
    console.log(`  Failed: ${failed} records`);

    // Verify the results
    const stats = await client.query(`
      SELECT
        COUNT(*) as total_records,
        MIN(cheapest_price) as min_price,
        MAX(cheapest_price) as max_price,
        AVG(cheapest_price) as avg_price,
        COUNT(interior_price) as has_interior,
        COUNT(oceanview_price) as has_oceanview,
        COUNT(balcony_price) as has_balcony,
        COUNT(suite_price) as has_suite
      FROM cheapest_pricing
    `);

    const s = stats.rows[0];
    console.log(`\n📈 Cheapest Pricing Table Statistics:`);
    console.log(`  Total records: ${s.total_records}`);
    console.log(`  Price range: $${s.min_price} - $${s.max_price}`);
    console.log(`  Average price: $${Math.round(s.avg_price)}`);
    console.log(
      `  Has interior pricing: ${s.has_interior} (${Math.round((s.has_interior / s.total_records) * 100)}%)`
    );
    console.log(
      `  Has oceanview pricing: ${s.has_oceanview} (${Math.round((s.has_oceanview / s.total_records) * 100)}%)`
    );
    console.log(
      `  Has balcony pricing: ${s.has_balcony} (${Math.round((s.has_balcony / s.total_records) * 100)}%)`
    );
    console.log(
      `  Has suite pricing: ${s.has_suite} (${Math.round((s.has_suite / s.total_records) * 100)}%)`
    );

    // Check which cruise lines have the best coverage
    const lineStats = await client.query(`
      SELECT
        cl.name as cruise_line,
        COUNT(c.id) as total_cruises,
        COUNT(cp.cruise_id) as cruises_with_pricing,
        ROUND(COUNT(cp.cruise_id)::numeric / COUNT(c.id) * 100, 2) as coverage_percent
      FROM cruises c
      INNER JOIN cruise_lines cl ON cl.id = c.cruise_line_id
      LEFT JOIN cheapest_pricing cp ON cp.cruise_id = c.id
      WHERE c.is_active = true
        AND c.sailing_date >= CURRENT_DATE
      GROUP BY cl.id, cl.name
      HAVING COUNT(c.id) > 100
      ORDER BY coverage_percent DESC
      LIMIT 10
    `);

    console.log(`\n🚢 Top Cruise Lines by Pricing Coverage:`);
    lineStats.rows.forEach(row => {
      console.log(
        `  ${row.cruise_line}: ${row.cruises_with_pricing}/${row.total_cruises} (${row.coverage_percent}%)`
      );
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

extractCheapestPricing().catch(console.error);
