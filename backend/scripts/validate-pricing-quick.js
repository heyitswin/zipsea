#!/usr/bin/env node

/**
 * QUICK PRICING VALIDATION
 *
 * Quick check to verify pricing is working correctly
 * Can be run on Render shell with: node scripts/validate-pricing-quick.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function validatePricingQuick() {
  console.log('\n🚀 QUICK PRICING VALIDATION\n');

  try {
    // 1. Check how many cruises have prices
    const priceStats = await pool.query(`
      SELECT
        COUNT(*) as total_cruises,
        COUNT(CASE WHEN interior_price IS NOT NULL THEN 1 END) as with_interior,
        COUNT(CASE WHEN oceanview_price IS NOT NULL THEN 1 END) as with_oceanview,
        COUNT(CASE WHEN balcony_price IS NOT NULL THEN 1 END) as with_balcony,
        COUNT(CASE WHEN suite_price IS NOT NULL THEN 1 END) as with_suite,
        COUNT(CASE WHEN cheapest_price IS NOT NULL THEN 1 END) as with_cheapest,
        COUNT(CASE WHEN
          interior_price IS NOT NULL OR
          oceanview_price IS NOT NULL OR
          balcony_price IS NOT NULL OR
          suite_price IS NOT NULL
        THEN 1 END) as with_any_price
      FROM cruises
      WHERE is_active = true
        AND sailing_date >= CURRENT_DATE
    `);

    const stats = priceStats.rows[0];
    const pctWithPrice = ((stats.with_any_price / stats.total_cruises) * 100).toFixed(1);

    console.log('📊 PRICING STATISTICS:');
    console.log(`   Total active cruises: ${stats.total_cruises}`);
    console.log(`   With any price: ${stats.with_any_price} (${pctWithPrice}%)`);
    console.log(`   With interior price: ${stats.with_interior}`);
    console.log(`   With oceanview price: ${stats.with_oceanview}`);
    console.log(`   With balcony price: ${stats.with_balcony}`);
    console.log(`   With suite price: ${stats.with_suite}`);
    console.log(`   With cheapest_price: ${stats.with_cheapest}`);
    console.log('');

    // 2. Show sample cruises with complete pricing
    console.log('📋 SAMPLE CRUISES WITH COMPLETE PRICING:');
    const samples = await pool.query(`
      SELECT
        c.id,
        c.name,
        c.sailing_date,
        c.interior_price,
        c.oceanview_price,
        c.balcony_price,
        c.suite_price,
        c.cheapest_price,
        cl.name as cruise_line,
        s.name as ship
      FROM cruises c
      JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      JOIN ships s ON c.ship_id = s.id
      WHERE c.is_active = true
        AND c.sailing_date >= CURRENT_DATE
        AND c.interior_price IS NOT NULL
        AND c.oceanview_price IS NOT NULL
        AND c.balcony_price IS NOT NULL
        AND c.suite_price IS NOT NULL
      ORDER BY c.sailing_date
      LIMIT 3
    `);

    samples.rows.forEach((cruise, i) => {
      console.log(`\n   ${i + 1}. ${cruise.name}`);
      console.log(`      ${cruise.cruise_line} - ${cruise.ship}`);
      console.log(`      Sailing: ${cruise.sailing_date}`);
      console.log(`      Interior:  $${cruise.interior_price}`);
      console.log(`      Oceanview: $${cruise.oceanview_price}`);
      console.log(`      Balcony:   $${cruise.balcony_price}`);
      console.log(`      Suite:     $${cruise.suite_price}`);
      console.log(`      Cheapest:  $${cruise.cheapest_price}`);

      // Validate cheapest calculation
      const minPrice = Math.min(
        cruise.interior_price,
        cruise.oceanview_price,
        cruise.balcony_price,
        cruise.suite_price
      );

      if (Math.abs(cruise.cheapest_price - minPrice) < 1) {
        console.log(`      ✅ Cheapest price correct`);
      } else {
        console.log(`      ⚠️ Cheapest price mismatch (should be $${minPrice})`);
      }
    });

    // 3. Check for pricing issues
    console.log('\n\n🔍 CHECKING FOR ISSUES:');

    // Check for mismatched cheapest_price
    const mismatchedPrices = await pool.query(`
      SELECT COUNT(*) as count
      FROM cruises
      WHERE is_active = true
        AND sailing_date >= CURRENT_DATE
        AND cheapest_price IS NOT NULL
        AND (interior_price IS NOT NULL OR oceanview_price IS NOT NULL OR
             balcony_price IS NOT NULL OR suite_price IS NOT NULL)
        AND ABS(cheapest_price - LEAST(
          COALESCE(interior_price, 999999),
          COALESCE(oceanview_price, 999999),
          COALESCE(balcony_price, 999999),
          COALESCE(suite_price, 999999)
        )) > 1
    `);

    if (mismatchedPrices.rows[0].count > 0) {
      console.log(`   ⚠️ ${mismatchedPrices.rows[0].count} cruises have incorrect cheapest_price`);
    } else {
      console.log(`   ✅ All cheapest_price values are correct`);
    }

    // Check for cruises with cheapest_price but no cabin prices
    const orphanedCheapest = await pool.query(`
      SELECT COUNT(*) as count
      FROM cruises
      WHERE is_active = true
        AND sailing_date >= CURRENT_DATE
        AND cheapest_price IS NOT NULL
        AND interior_price IS NULL
        AND oceanview_price IS NULL
        AND balcony_price IS NULL
        AND suite_price IS NULL
    `);

    if (orphanedCheapest.rows[0].count > 0) {
      console.log(`   ⚠️ ${orphanedCheapest.rows[0].count} cruises have cheapest_price but no cabin prices`);
    } else {
      console.log(`   ✅ No orphaned cheapest_price values`);
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    if (pctWithPrice < 50) {
      console.log('⚠️ STATUS: Less than 50% of cruises have pricing');
      console.log('   ACTION: Run sync script to update pricing data');
    } else if (pctWithPrice < 80) {
      console.log('⚠️ STATUS: Pricing coverage is moderate');
      console.log('   ACTION: Consider running sync for recent cruises');
    } else {
      console.log('✅ STATUS: Good pricing coverage');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

validatePricingQuick();
