#!/usr/bin/env node
/**
 * Verify that pricing data is being updated correctly
 * Checks cheapest_pricing table and data integrity
 */

const { Pool } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;

async function verifyPricing(lineId) {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('🔍 PRICING DATA VERIFICATION');
    console.log('============================');
    console.log(`Checking Line ID: ${lineId}`);
    console.log('');

    // 1. Check cruise line info
    const lineInfo = await pool.query(
      `
      SELECT id, name, code, is_active
      FROM cruise_lines
      WHERE id = $1
    `,
      [lineId]
    );

    if (lineInfo.rows.length === 0) {
      console.log('❌ Cruise line not found');
      return;
    }

    console.log(`📍 ${lineInfo.rows[0].name} (${lineInfo.rows[0].code})`);
    console.log('');

    // 2. Overall statistics
    const stats = await pool.query(
      `
      SELECT
        COUNT(DISTINCT c.id) as total_cruises,
        COUNT(DISTINCT c.id) FILTER (WHERE c.sailing_date >= CURRENT_DATE) as future_cruises,
        COUNT(DISTINCT cp.cruise_id) as cruises_with_pricing,
        COUNT(DISTINCT cp.cruise_id) FILTER (WHERE cp.cheapest_price IS NOT NULL) as complete_pricing,
        COUNT(DISTINCT c.id) FILTER (WHERE c.raw_data IS NOT NULL) as cruises_with_raw_data,
        COUNT(DISTINCT c.id) FILTER (WHERE c.last_traveltek_update > NOW() - INTERVAL '24 hours') as updated_24h,
        COUNT(DISTINCT c.id) FILTER (WHERE c.last_traveltek_update > NOW() - INTERVAL '1 hour') as updated_1h
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON cp.cruise_id = c.id
      WHERE c.cruise_line_id = $1
    `,
      [lineId]
    );

    const s = stats.rows[0];
    console.log('📊 STATISTICS:');
    console.log(`   Total Cruises: ${s.total_cruises}`);
    console.log(`   Future Cruises: ${s.future_cruises}`);
    console.log(
      `   With Pricing: ${s.cruises_with_pricing} (${Math.round((s.cruises_with_pricing / s.future_cruises) * 100)}%)`
    );
    console.log(`   Complete Pricing: ${s.complete_pricing}`);
    console.log(`   With Raw Data: ${s.cruises_with_raw_data}`);
    console.log(`   Updated (24h): ${s.updated_24h}`);
    console.log(`   Updated (1h): ${s.updated_1h}`);
    console.log('');

    // 3. Pricing distribution
    const pricing = await pool.query(
      `
      SELECT
        COUNT(*) as count,
        MIN(cheapest_price) as min_price,
        AVG(cheapest_price)::decimal(10,2) as avg_price,
        MAX(cheapest_price) as max_price,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cheapest_price)::decimal(10,2) as median_price,
        COUNT(*) FILTER (WHERE cheapest_price < 100) as under_100,
        COUNT(*) FILTER (WHERE cheapest_price BETWEEN 100 AND 500) as range_100_500,
        COUNT(*) FILTER (WHERE cheapest_price BETWEEN 500 AND 1000) as range_500_1000,
        COUNT(*) FILTER (WHERE cheapest_price BETWEEN 1000 AND 2000) as range_1000_2000,
        COUNT(*) FILTER (WHERE cheapest_price > 2000) as over_2000
      FROM cheapest_pricing cp
      JOIN cruises c ON c.id = cp.cruise_id
      WHERE c.cruise_line_id = $1
        AND c.sailing_date >= CURRENT_DATE
    `,
      [lineId]
    );

    const p = pricing.rows[0];
    if (p && p.count > 0) {
      console.log('💰 PRICING DISTRIBUTION:');
      console.log(`   Min: $${p.min_price}`);
      console.log(`   Avg: $${p.avg_price}`);
      console.log(`   Median: $${p.median_price}`);
      console.log(`   Max: $${p.max_price}`);
      console.log('');
      console.log('   Price Ranges:');
      console.log(`   < $100: ${p.under_100}`);
      console.log(`   $100-500: ${p.range_100_500}`);
      console.log(`   $500-1000: ${p.range_500_1000}`);
      console.log(`   $1000-2000: ${p.range_1000_2000}`);
      console.log(`   > $2000: ${p.over_2000}`);
      console.log('');
    }

    // 4. Recent pricing updates
    const recent = await pool.query(
      `
      SELECT
        c.cruise_id,
        c.name,
        c.sailing_date,
        cp.cheapest_price,
        cp.interior_price,
        cp.oceanview_price,
        cp.balcony_price,
        cp.suite_price,
        cp.currency,
        cp.last_updated,
        c.last_traveltek_update
      FROM cruises c
      JOIN cheapest_pricing cp ON cp.cruise_id = c.id
      WHERE c.cruise_line_id = $1
        AND cp.last_updated > NOW() - INTERVAL '1 hour'
      ORDER BY cp.last_updated DESC
      LIMIT 10
    `,
      [lineId]
    );

    if (recent.rows.length > 0) {
      console.log('🆕 RECENT PRICING UPDATES (last hour):');
      recent.rows.forEach(r => {
        const time = new Date(r.last_updated).toLocaleTimeString();
        console.log(`   ${time} - ${r.name || r.cruise_id}`);
        console.log(`      Sailing: ${new Date(r.sailing_date).toLocaleDateString()}`);
        console.log(`      Cheapest: $${r.cheapest_price} ${r.currency}`);
        console.log(
          `      Cabins: IN=$${r.interior_price || 'N/A'}, OV=$${r.oceanview_price || 'N/A'}, BA=$${r.balcony_price || 'N/A'}, SU=$${r.suite_price || 'N/A'}`
        );
        console.log('');
      });
    } else {
      console.log('⚠️  No pricing updates in the last hour');
    }

    // 5. Data quality checks
    console.log('🔍 DATA QUALITY CHECKS:');

    // Check for missing pricing
    const missingPricing = await pool.query(
      `
      SELECT COUNT(*) as count
      FROM cruises c
      WHERE c.cruise_line_id = $1
        AND c.sailing_date >= CURRENT_DATE
        AND NOT EXISTS (
          SELECT 1 FROM cheapest_pricing cp
          WHERE cp.cruise_id = c.id
        )
    `,
      [lineId]
    );

    console.log(`   Cruises without pricing: ${missingPricing.rows[0].count}`);

    // Check for stale pricing
    const stalePricing = await pool.query(
      `
      SELECT COUNT(*) as count
      FROM cruises c
      JOIN cheapest_pricing cp ON cp.cruise_id = c.id
      WHERE c.cruise_line_id = $1
        AND c.sailing_date >= CURRENT_DATE
        AND cp.last_updated < NOW() - INTERVAL '7 days'
    `,
      [lineId]
    );

    console.log(`   Cruises with stale pricing (>7 days): ${stalePricing.rows[0].count}`);

    // Check for suspicious pricing
    const suspiciousPricing = await pool.query(
      `
      SELECT COUNT(*) as count
      FROM cheapest_pricing cp
      JOIN cruises c ON c.id = cp.cruise_id
      WHERE c.cruise_line_id = $1
        AND (
          cp.cheapest_price < 10
          OR cp.cheapest_price > 50000
          OR cp.interior_price > cp.suite_price
        )
    `,
      [lineId]
    );

    console.log(
      `   Suspicious pricing (too low/high/inverted): ${suspiciousPricing.rows[0].count}`
    );

    // Check cabin price consistency
    const inconsistentPricing = await pool.query(
      `
      SELECT COUNT(*) as count
      FROM cheapest_pricing cp
      JOIN cruises c ON c.id = cp.cruise_id
      WHERE c.cruise_line_id = $1
        AND cp.cheapest_price > LEAST(
          COALESCE(cp.interior_price, 999999),
          COALESCE(cp.oceanview_price, 999999),
          COALESCE(cp.balcony_price, 999999),
          COALESCE(cp.suite_price, 999999)
        )
    `,
      [lineId]
    );

    console.log(`   Inconsistent cheapest price: ${inconsistentPricing.rows[0].count}`);

    // Summary
    console.log('');
    console.log('📋 SUMMARY:');
    const coverage = Math.round((s.cruises_with_pricing / s.future_cruises) * 100);
    const freshness = Math.round((s.updated_24h / s.future_cruises) * 100);

    if (coverage > 90) {
      console.log(`   ✅ Excellent pricing coverage: ${coverage}%`);
    } else if (coverage > 70) {
      console.log(`   ⚠️  Good pricing coverage: ${coverage}%`);
    } else {
      console.log(`   ❌ Poor pricing coverage: ${coverage}%`);
    }

    if (freshness > 50) {
      console.log(`   ✅ Fresh data: ${freshness}% updated in last 24h`);
    } else {
      console.log(`   ⚠️  Stale data: only ${freshness}% updated in last 24h`);
    }

    if (missingPricing.rows[0].count === 0 && suspiciousPricing.rows[0].count === 0) {
      console.log('   ✅ Data quality looks good');
    } else {
      console.log('   ⚠️  Some data quality issues found');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

// Get line ID from command line
const lineId = process.argv[2];
if (!lineId) {
  console.log('Usage: node verify-pricing-updates.js <lineId>');
  console.log('Example: node verify-pricing-updates.js 16');
  process.exit(1);
}

verifyPricing(lineId);
