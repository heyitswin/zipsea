/**
 * Fix suspicious and negative cruise prices
 */

const postgres = require('postgres');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const prodUrl = process.env.DATABASE_URL_PRODUCTION || 'postgresql://zipsea_user:aOLItWeqKie3hDgFOd2k8wjJNU2KtLVd@dpg-d2idqjjipnbc73abma3g-a.oregon-postgres.render.com/zipsea_db';
const sql = postgres(prodUrl, { ssl: { rejectUnauthorized: false } });

async function main() {
  console.log('=' .repeat(80));
  console.log('FIXING SUSPICIOUS AND NEGATIVE CRUISE PRICES');
  console.log('=' .repeat(80));
  console.log();

  try {
    // 1. Find cruises with negative prices
    console.log('Finding cruises with negative prices...');
    const negativePrices = await sql`
      SELECT
        id, cruise_id, name, sailing_date,
        interior_price, oceanview_price, balcony_price, suite_price, cheapest_price
      FROM cruises
      WHERE (
        interior_price::decimal < 0 OR
        oceanview_price::decimal < 0 OR
        balcony_price::decimal < 0 OR
        suite_price::decimal < 0 OR
        cheapest_price::decimal < 0
      )
      AND is_active = true
    `;

    console.log(`Found ${negativePrices.length} cruises with negative prices\n`);

    if (negativePrices.length > 0) {
      console.log('Cruises with negative prices:');
      for (const cruise of negativePrices) {
        console.log(`- ${cruise.id}: ${cruise.name}`);
        console.log(`  Interior: $${cruise.interior_price}, Ocean: $${cruise.oceanview_price}, Balcony: $${cruise.balcony_price}, Suite: $${cruise.suite_price}`);
      }
      console.log();

      // Deactivate cruises with negative prices (they're clearly corrupted)
      console.log('Deactivating cruises with negative prices...');
      await sql`
        UPDATE cruises
        SET is_active = false,
            updated_at = CURRENT_TIMESTAMP
        WHERE (
          interior_price::decimal < 0 OR
          oceanview_price::decimal < 0 OR
          balcony_price::decimal < 0 OR
          suite_price::decimal < 0 OR
          cheapest_price::decimal < 0
        )
        AND is_active = true
      `;
      console.log('✅ Deactivated cruises with negative prices\n');
    }

    // 2. Fix the cruise with wrong prices (2164424)
    console.log('Fixing cruise 2164424 with wrong prices...');
    const cruise2164424 = await sql`
      SELECT id, raw_data
      FROM cruises
      WHERE id = '2164424'
    `;

    if (cruise2164424.length > 0 && cruise2164424[0].raw_data) {
      const rawData = cruise2164424[0].raw_data;

      // Extract correct prices
      let correctPrices = {
        interior: null,
        oceanview: null,
        balcony: null,
        suite: null
      };

      // Check for direct fields
      if (rawData.cheapestinside) correctPrices.interior = parseFloat(rawData.cheapestinside);
      if (rawData.cheapestoutside) correctPrices.oceanview = parseFloat(rawData.cheapestoutside);
      if (rawData.cheapestbalcony) correctPrices.balcony = parseFloat(rawData.cheapestbalcony);
      if (rawData.cheapestsuite) correctPrices.suite = parseFloat(rawData.cheapestsuite);

      // Check prices object
      if (rawData.cheapest?.prices) {
        if (!correctPrices.interior && rawData.cheapest.prices.inside)
          correctPrices.interior = parseFloat(rawData.cheapest.prices.inside);
        if (!correctPrices.oceanview && rawData.cheapest.prices.outside)
          correctPrices.oceanview = parseFloat(rawData.cheapest.prices.outside);
        if (!correctPrices.balcony && rawData.cheapest.prices.balcony)
          correctPrices.balcony = parseFloat(rawData.cheapest.prices.balcony);
        if (!correctPrices.suite && rawData.cheapest.prices.suite)
          correctPrices.suite = parseFloat(rawData.cheapest.prices.suite);
      }

      console.log('Current prices:', {
        interior: 85, oceanview: 165, balcony: 225, suite: 715
      });
      console.log('Correct prices from raw_data:', correctPrices);

      if (correctPrices.interior || correctPrices.oceanview || correctPrices.balcony || correctPrices.suite) {
        // Calculate new cheapest
        const allPrices = [
          correctPrices.interior,
          correctPrices.oceanview,
          correctPrices.balcony,
          correctPrices.suite
        ].filter(p => p && p > 0);

        const cheapest = Math.min(...allPrices);

        await sql`
          UPDATE cruises
          SET
            interior_price = ${correctPrices.interior?.toString() || null},
            oceanview_price = ${correctPrices.oceanview?.toString() || null},
            balcony_price = ${correctPrices.balcony?.toString() || null},
            suite_price = ${correctPrices.suite?.toString() || null},
            cheapest_price = ${cheapest.toString()},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = '2164424'
        `;
        console.log('✅ Fixed cruise 2164424 prices\n');
      }
    }

    // 3. Report on suspiciously low prices
    console.log('Analyzing suspiciously low prices (< $50)...');
    const suspiciouslyLow = await sql`
      SELECT
        COUNT(*) as count,
        MIN(cheapest_price::decimal) as min_price,
        MAX(cheapest_price::decimal) as max_price
      FROM cruises
      WHERE cheapest_price::decimal > 0
      AND cheapest_price::decimal < 50
      AND sailing_date >= '2025-10-01'
      AND is_active = true
    `;

    console.log(`Found ${suspiciouslyLow[0].count} active cruises with prices between $0-$50`);
    console.log(`Price range: $${suspiciouslyLow[0].min_price} - $${suspiciouslyLow[0].max_price}`);
    console.log();

    // Get a sample for manual review
    const samples = await sql`
      SELECT id, name, cheapest_price, sailing_date, cruise_line_id
      FROM cruises
      WHERE cheapest_price::decimal > 0
      AND cheapest_price::decimal < 50
      AND sailing_date >= '2025-10-01'
      AND is_active = true
      ORDER BY cheapest_price
      LIMIT 10
    `;

    console.log('Sample of low-priced cruises for manual review:');
    for (const cruise of samples) {
      console.log(`- $${cruise.cheapest_price}: ${cruise.name} (${new Date(cruise.sailing_date).toISOString().split('T')[0]})`);
    }
    console.log();
    console.log('⚠️  These may need manual review to determine if prices are legitimate');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

// Run with confirmation
const args = process.argv.slice(2);
if (args.includes('--execute')) {
  main();
} else {
  console.log('This script will:');
  console.log('1. Deactivate cruises with negative prices');
  console.log('2. Fix cruise 2164424 with wrong prices');
  console.log('3. Report on suspiciously low prices');
  console.log();
  console.log('Run with --execute to apply fixes');
}
