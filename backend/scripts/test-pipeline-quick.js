#!/usr/bin/env node

/**
 * QUICK PIPELINE VALIDATION
 * Fast checks for critical pipeline components
 *
 * Run: node scripts/test-pipeline-quick.js
 */

require('dotenv').config();
const { db } = require('../dist/db/connection');
const { sql } = require('drizzle-orm');
// Use fetch-polyfill or native fetch if available
const fetch =
  globalThis.fetch ||
  (() => {
    throw new Error('fetch not available - install node-fetch or use Node 18+');
  });

async function quickValidation() {
  console.log('\n🚀 QUICK PIPELINE VALIDATION');
  console.log('='.repeat(60));

  const issues = [];
  const warnings = [];

  try {
    // 1. Check recent webhook activity
    console.log('\n1️⃣ Webhook Activity (24h)');
    const [webhookStats] = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(DISTINCT line_id) as unique_lines,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        MAX(created_at) as latest
      FROM webhook_events
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `);

    console.log(`   Total: ${webhookStats.total} events`);
    console.log(`   Lines: ${webhookStats.unique_lines} cruise lines`);
    console.log(
      `   Success rate: ${((webhookStats.completed / webhookStats.total) * 100).toFixed(1)}%`
    );

    if (webhookStats.total === 0) {
      issues.push('No webhooks received in 24h');
    }
    if (webhookStats.failed > webhookStats.completed) {
      issues.push('More failed webhooks than successful');
    }

    // 2. Check data freshness
    console.log('\n2️⃣ Data Freshness');
    const [freshness] = await db.execute(sql`
      SELECT
        COUNT(*) as total_active,
        COUNT(CASE WHEN updated_at > NOW() - INTERVAL '1 hour' THEN 1 END) as updated_1h,
        COUNT(CASE WHEN updated_at > NOW() - INTERVAL '24 hours' THEN 1 END) as updated_24h,
        COUNT(CASE WHEN updated_at > NOW() - INTERVAL '7 days' THEN 1 END) as updated_7d,
        COUNT(CASE WHEN updated_at < NOW() - INTERVAL '30 days' THEN 1 END) as stale_30d
      FROM cruises
      WHERE is_active = true AND sailing_date >= CURRENT_DATE
    `);

    const freshPercent = ((freshness.updated_24h / freshness.total_active) * 100).toFixed(1);
    const stalePercent = ((freshness.stale_30d / freshness.total_active) * 100).toFixed(1);

    console.log(`   Total active: ${freshness.total_active} cruises`);
    console.log(`   Updated <1h: ${freshness.updated_1h}`);
    console.log(`   Updated <24h: ${freshness.updated_24h} (${freshPercent}%)`);
    console.log(`   Stale >30d: ${freshness.stale_30d} (${stalePercent}%)`);

    if (parseFloat(freshPercent) < 10) {
      warnings.push(`Only ${freshPercent}% updated in 24h`);
    }
    if (parseFloat(stalePercent) > 50) {
      issues.push(`${stalePercent}% of data is >30 days old`);
    }

    // 3. Check pricing completeness
    console.log('\n3️⃣ Pricing Coverage');
    const [pricing] = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN cheapest_price IS NOT NULL THEN 1 END) as has_cheapest,
        COUNT(CASE WHEN interior_price IS NOT NULL OR oceanview_price IS NOT NULL
                    OR balcony_price IS NOT NULL OR suite_price IS NOT NULL THEN 1 END) as has_any_price,
        COUNT(CASE WHEN raw_data IS NOT NULL AND raw_data::text != '{}' THEN 1 END) as has_raw_data
      FROM cruises
      WHERE is_active = true AND sailing_date >= CURRENT_DATE
    `);

    const cheapestCoverage = ((pricing.has_cheapest / pricing.total) * 100).toFixed(1);
    const anyCoverage = ((pricing.has_any_price / pricing.total) * 100).toFixed(1);
    const rawDataCoverage = ((pricing.has_raw_data / pricing.total) * 100).toFixed(1);

    console.log(
      `   Cheapest price: ${pricing.has_cheapest}/${pricing.total} (${cheapestCoverage}%)`
    );
    console.log(`   Any price: ${pricing.has_any_price}/${pricing.total} (${anyCoverage}%)`);
    console.log(`   Raw data: ${pricing.has_raw_data}/${pricing.total} (${rawDataCoverage}%)`);

    if (parseFloat(anyCoverage) < 50) {
      issues.push(`Low pricing coverage: ${anyCoverage}%`);
    }

    // 4. Check top cruise lines
    console.log('\n4️⃣ Top Cruise Lines (by recent updates)');
    const topLines = await db.execute(sql`
      SELECT
        cl.name,
        COUNT(*) as total_cruises,
        COUNT(CASE WHEN c.updated_at > NOW() - INTERVAL '24 hours' THEN 1 END) as updated_24h,
        MAX(c.updated_at) as last_update
      FROM cruises c
      JOIN cruise_lines cl ON cl.id = c.cruise_line_id
      WHERE c.is_active = true
      GROUP BY cl.id, cl.name
      ORDER BY updated_24h DESC
      LIMIT 5
    `);

    for (const line of topLines) {
      const percent = ((line.updated_24h / line.total_cruises) * 100).toFixed(1);
      console.log(
        `   ${line.name}: ${line.updated_24h}/${line.total_cruises} updated (${percent}%)`
      );
    }

    // 5. Quick API check
    console.log('\n5️⃣ API Health Check');
    const apiUrl = 'https://zipsea-production.onrender.com';

    try {
      // Health check
      const healthRes = await fetch(`${apiUrl}/health`);
      const health = await healthRes.json();
      console.log(`   Health: ${health.status === 'ok' ? '✅ OK' : '❌ NOT OK'}`);

      // Search check
      const searchRes = await fetch(`${apiUrl}/api/v1/search/cruises?limit=1`);
      const searchData = await searchRes.json();
      const hasCruises = (searchData.cruises || searchData.data || []).length > 0;
      console.log(`   Search API: ${hasCruises ? '✅ Returns data' : '❌ No data'}`);

      if (!hasCruises) {
        issues.push('Search API returns no cruises');
      }

      // Detail check
      if (hasCruises) {
        const cruiseId = (searchData.cruises || searchData.data)[0].id;
        const detailRes = await fetch(`${apiUrl}/api/v1/cruises/${cruiseId}`);
        const detailData = await detailRes.json();
        const detail = detailData.data || detailData;

        const hasPrices =
          detail.interiorPrice !== undefined ||
          detail.oceanviewPrice !== undefined ||
          detail.balconyPrice !== undefined ||
          detail.suitePrice !== undefined;

        console.log(`   Detail API: ${hasPrices ? '✅ Has prices' : '⚠️ No prices'}`);

        if (!hasPrices) {
          warnings.push('Detail API missing price fields');
        }
      }
    } catch (apiError) {
      issues.push(`API check failed: ${apiError.message}`);
    }

    // 6. Check for price mismatches
    console.log('\n6️⃣ Price Consistency Sample');
    const mismatches = await db.execute(sql`
      SELECT
        c.id,
        c.name,
        c.interior_price,
        cp.interior::numeric as cp_interior
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON cp.cruise_id = c.id
      WHERE c.interior_price IS NOT NULL
        AND cp.interior IS NOT NULL
        AND ABS(c.interior_price - cp.interior::numeric) > 0.01
      LIMIT 5
    `);

    if (mismatches.length > 0) {
      console.log(`   ⚠️ Found ${mismatches.length} price mismatches`);
      warnings.push(`${mismatches.length} price mismatches between tables`);
    } else {
      console.log(`   ✅ No price mismatches in sample`);
    }

    // RESULTS SUMMARY
    console.log('\n' + '='.repeat(60));
    console.log('📋 VALIDATION SUMMARY');
    console.log('='.repeat(60));

    if (issues.length === 0 && warnings.length === 0) {
      console.log('\n✅ All checks passed - Pipeline is healthy!\n');
      return 0;
    }

    if (warnings.length > 0) {
      console.log('\n⚠️ WARNINGS:');
      warnings.forEach(w => console.log(`  • ${w}`));
    }

    if (issues.length > 0) {
      console.log('\n❌ ISSUES:');
      issues.forEach(i => console.log(`  • ${i}`));
    }

    console.log(
      '\n' + (issues.length > 0 ? '❌ VALIDATION FAILED' : '⚠️ VALIDATION PASSED WITH WARNINGS')
    );
    console.log('='.repeat(60) + '\n');

    return issues.length > 0 ? 1 : 0;
  } catch (error) {
    console.error('\n💥 FATAL ERROR:', error.message);
    return 1;
  }
}

// Run if called directly
if (require.main === module) {
  quickValidation()
    .then(code => process.exit(code))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { quickValidation };
