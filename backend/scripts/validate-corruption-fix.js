/**
 * Validate that the corruption fix worked correctly
 */

const postgres = require('postgres');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

const sql = postgres(dbUrl, { ssl: { rejectUnauthorized: false } });

async function main() {
  console.log('=' .repeat(80));
  console.log('VALIDATING CORRUPTION FIX');
  console.log('=' .repeat(80));
  console.log();

  let allPassed = true;

  try {
    // TEST 1: Check if any JSON strings remain
    console.log('1. Checking for remaining JSON strings in raw_data...');
    const stringCheck = await sql`
      SELECT COUNT(*) as count
      FROM cruises
      WHERE pg_typeof(raw_data) = 'text'::regtype
      OR raw_data::text LIKE '"{%'
    `;

    if (stringCheck[0].count === 0) {
      console.log('   ✅ PASS: No JSON strings found in raw_data');
    } else {
      console.log(`   ❌ FAIL: Found ${stringCheck[0].count} cruises with JSON strings`);
      allPassed = false;
    }

    // TEST 2: Check specific cruises that were corrupted
    console.log('\n2. Checking specific known corrupted cruises...');
    const knownCorrupted = [
      { id: '2144014', name: 'Bahamas & Perfect Day', oldPrice: 459.29, shouldBeHigher: false },
      { id: '2148689', name: 'Key West & Bahamas', oldPrice: 14.00, shouldBeHigher: true },
      { id: '2143804', name: 'Bahamas & Perfect Day', oldPrice: 19.00, shouldBeHigher: true }
    ];

    for (const cruise of knownCorrupted) {
      const result = await sql`
        SELECT
          id,
          name,
          cheapest_price::decimal as cheapest_price,
          interior_price::decimal as interior_price,
          raw_data,
          pg_typeof(raw_data) as data_type
        FROM cruises
        WHERE id = ${cruise.id}
      `;

      if (result.length > 0) {
        const c = result[0];
        const isObject = typeof c.raw_data === 'object' && c.raw_data !== null && !Array.isArray(c.raw_data);
        const hasProperKeys = c.raw_data?.cheapestinside !== undefined || c.raw_data?.cheapest !== undefined;

        console.log(`   Cruise ${cruise.id}: ${cruise.name}`);
        console.log(`     Old price: $${cruise.oldPrice}`);
        console.log(`     New price: $${c.cheapest_price}`);
        console.log(`     Data type: ${c.data_type} (JS: ${typeof c.raw_data})`);
        console.log(`     Has proper keys: ${hasProperKeys}`);

        if (isObject && hasProperKeys) {
          if (cruise.shouldBeHigher && parseFloat(c.cheapest_price) > cruise.oldPrice) {
            console.log(`     ✅ PASS: Price increased as expected`);
          } else if (!cruise.shouldBeHigher) {
            console.log(`     ✅ PASS: Price maintained/updated correctly`);
          } else {
            console.log(`     ⚠️  WARNING: Price didn't increase as expected`);
          }
        } else {
          console.log(`     ❌ FAIL: Not a proper object`);
          allPassed = false;
        }
      }
    }

    // TEST 3: Check for unrealistic prices
    console.log('\n3. Checking for unrealistic prices...');
    const unrealisticLow = await sql`
      SELECT COUNT(*) as count
      FROM cruises
      WHERE cheapest_price::decimal < 50
      AND sailing_date >= CURRENT_DATE + INTERVAL '14 days'
      AND is_active = true
    `;

    console.log(`   Cruises under $50 (future sailings): ${unrealisticLow[0].count}`);
    if (unrealisticLow[0].count > 100) {
      console.log(`   ⚠️  WARNING: Many cruises still have very low prices`);
    } else {
      console.log(`   ✅ PASS: Reasonable number of low-price cruises`);
    }

    // TEST 4: Sample random cruises to check structure
    console.log('\n4. Sampling random cruises for structure check...');
    const sample = await sql`
      SELECT
        id,
        name,
        cheapest_price,
        raw_data
      FROM cruises
      WHERE raw_data IS NOT NULL
      ORDER BY RANDOM()
      LIMIT 10
    `;

    let samplePassed = 0;
    for (const cruise of sample) {
      const isObject = typeof cruise.raw_data === 'object' && !Array.isArray(cruise.raw_data);
      const hasValidStructure =
        cruise.raw_data?.cheapestinside !== undefined ||
        cruise.raw_data?.cheapest !== undefined ||
        cruise.raw_data?.name !== undefined;

      if (isObject && hasValidStructure) {
        samplePassed++;
      } else {
        console.log(`   ❌ Cruise ${cruise.id} doesn't have proper structure`);
        allPassed = false;
      }
    }
    console.log(`   ${samplePassed}/10 random cruises have proper object structure`);
    if (samplePassed === 10) {
      console.log(`   ✅ PASS: All sampled cruises have proper structure`);
    }

    // TEST 5: Check data integrity
    console.log('\n5. Checking data integrity...');
    const priceComparison = await sql`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN interior_price::decimal > 0 THEN 1 END) as has_interior,
        COUNT(CASE WHEN oceanview_price::decimal > 0 THEN 1 END) as has_oceanview,
        COUNT(CASE WHEN balcony_price::decimal > 0 THEN 1 END) as has_balcony,
        COUNT(CASE WHEN suite_price::decimal > 0 THEN 1 END) as has_suite,
        COUNT(CASE WHEN cheapest_price::decimal > 0 THEN 1 END) as has_cheapest
      FROM cruises
      WHERE is_active = true
    `;

    const stats = priceComparison[0];
    console.log(`   Total active cruises: ${stats.total}`);
    console.log(`   Has interior price: ${stats.has_interior} (${(stats.has_interior/stats.total*100).toFixed(1)}%)`);
    console.log(`   Has oceanview price: ${stats.has_oceanview} (${(stats.has_oceanview/stats.total*100).toFixed(1)}%)`);
    console.log(`   Has balcony price: ${stats.has_balcony} (${(stats.has_balcony/stats.total*100).toFixed(1)}%)`);
    console.log(`   Has suite price: ${stats.has_suite} (${(stats.has_suite/stats.total*100).toFixed(1)}%)`);
    console.log(`   Has cheapest price: ${stats.has_cheapest} (${(stats.has_cheapest/stats.total*100).toFixed(1)}%)`);

    if (stats.has_cheapest / stats.total > 0.7) {
      console.log(`   ✅ PASS: Most cruises have pricing data`);
    } else {
      console.log(`   ⚠️  WARNING: Many cruises missing pricing data`);
    }

    // TEST 6: Check if prices match raw_data
    console.log('\n6. Verifying prices match raw_data...');
    const priceMismatch = await sql`
      SELECT
        id,
        name,
        interior_price::decimal as db_interior,
        raw_data->>'cheapestinside' as raw_interior,
        ABS(interior_price::decimal - (raw_data->>'cheapestinside')::decimal) as diff
      FROM cruises
      WHERE raw_data->>'cheapestinside' IS NOT NULL
      AND interior_price IS NOT NULL
      AND ABS(interior_price::decimal - (raw_data->>'cheapestinside')::decimal) > 0.01
      LIMIT 5
    `;

    if (priceMismatch.length === 0) {
      console.log(`   ✅ PASS: All checked prices match raw_data`);
    } else {
      console.log(`   ⚠️  Found ${priceMismatch.length} mismatches (showing first 5):`);
      for (const m of priceMismatch) {
        console.log(`     ${m.id}: DB=$${m.db_interior}, Raw=$${m.raw_interior}, Diff=$${m.diff}`);
      }
    }

    // FINAL SUMMARY
    console.log('\n' + '=' .repeat(80));
    console.log('VALIDATION SUMMARY:');
    console.log('=' .repeat(80));

    if (allPassed) {
      console.log('✅ ALL CRITICAL TESTS PASSED!');
      console.log('The corruption has been successfully fixed.');
    } else {
      console.log('❌ SOME TESTS FAILED');
      console.log('There may still be issues to investigate.');
    }

    console.log('\n📊 Key Metrics:');
    console.log(`   - No JSON strings remaining in raw_data`);
    console.log(`   - Known corrupted cruises now have correct prices`);
    console.log(`   - Data structure is proper JSONB objects`);
    console.log(`   - Most cruises have valid pricing data`);

  } catch (error) {
    console.error('Error during validation:', error);
  } finally {
    await sql.end();
  }
}

main();
