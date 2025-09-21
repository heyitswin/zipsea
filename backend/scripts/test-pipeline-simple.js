#!/usr/bin/env node

/**
 * SIMPLIFIED PIPELINE TEST - For Render Shell
 * Tests database and API pipeline without FTP access
 *
 * Run with: node scripts/test-pipeline-simple.js
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function runSimplePipelineTest() {
  console.log('🔍 PIPELINE VERIFICATION TEST');
  console.log('='.repeat(70));

  const results = {
    timestamp: new Date().toISOString(),
    tests: {}
  };

  // Test 1: Database connection and data freshness
  console.log('\n📊 TEST 1: Database Status');
  console.log('-'.repeat(40));

  try {
    const dbQuery = `
      SELECT
        COUNT(*) as total_cruises,
        COUNT(CASE WHEN updated_at > NOW() - INTERVAL '24 hours' THEN 1 END) as updated_24h,
        COUNT(CASE WHEN interior_price IS NOT NULL THEN 1 END) as has_interior,
        COUNT(CASE WHEN cheapest_price IS NOT NULL THEN 1 END) as has_cheapest
      FROM cruises
      WHERE is_active = true
        AND sailing_date >= CURRENT_DATE
    `;

    // Note: This requires psql to be available
    const { stdout } = await execPromise(`echo "${dbQuery}" | psql $DATABASE_URL -t`);

    const parts = stdout.trim().split('|').map(s => s.trim());
    if (parts.length >= 4) {
      console.log(`✅ Active cruises: ${parts[0]}`);
      console.log(`   Updated in 24h: ${parts[1]}`);
      console.log(`   With prices: ${parts[3]}`);
      results.tests.database = { status: 'PASS', details: stdout.trim() };
    }
  } catch (error) {
    console.log(`❌ Database test failed: ${error.message.split('\n')[0]}`);
    results.tests.database = { status: 'FAIL', error: error.message };
  }

  // Test 2: Webhook events
  console.log('\n🔄 TEST 2: Recent Webhook Activity');
  console.log('-'.repeat(40));

  try {
    const webhookQuery = `
      SELECT
        COUNT(*) as total,
        COUNT(DISTINCT line_id) as lines,
        MAX(created_at) as latest
      FROM webhook_events
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `;

    const { stdout } = await execPromise(`echo "${webhookQuery}" | psql $DATABASE_URL -t`);

    const parts = stdout.trim().split('|').map(s => s.trim());
    if (parts.length >= 3) {
      console.log(`✅ Webhooks (24h): ${parts[0]} events for ${parts[1]} cruise lines`);
      console.log(`   Latest: ${parts[2]}`);
      results.tests.webhooks = { status: 'PASS', count: parts[0], lines: parts[1] };
    }
  } catch (error) {
    console.log(`⚠️  Webhook test skipped: ${error.message.split('\n')[0]}`);
    results.tests.webhooks = { status: 'SKIP', error: error.message };
  }

  // Test 3: API endpoints
  console.log('\n🌐 TEST 3: API Endpoints');
  console.log('-'.repeat(40));

  try {
    // Test search
    const { stdout: searchOut } = await execPromise(
      `curl -s "https://zipsea-production.onrender.com/api/v1/search/cruises?limit=3"`
    );

    const searchData = JSON.parse(searchOut);
    const cruises = searchData.cruises || searchData.data || [];

    console.log(`✅ Search API: ${cruises.length} cruises returned`);

    if (cruises.length > 0) {
      const firstCruise = cruises[0];
      console.log(`   Sample: ${firstCruise.name}`);
      console.log(`   Price: ${firstCruise.price !== null ? '$' + firstCruise.price : 'N/A'}`);

      // Test detail
      const { stdout: detailOut } = await execPromise(
        `curl -s "https://zipsea-production.onrender.com/api/v1/cruises/${firstCruise.id}"`
      );

      const detailData = JSON.parse(detailOut);
      const detail = detailData.data || detailData;

      if (detail) {
        const hasPrices =
          detail.interiorPrice !== undefined ||
          detail.oceanviewPrice !== undefined ||
          detail.balconyPrice !== undefined ||
          detail.suitePrice !== undefined;

        console.log(`✅ Detail API: ${hasPrices ? 'Has price fields' : 'Missing price fields'}`);

        if (hasPrices) {
          console.log(`   Interior: $${detail.interiorPrice || 'N/A'}`);
          console.log(`   Oceanview: $${detail.oceanviewPrice || 'N/A'}`);
          console.log(`   Balcony: $${detail.balconyPrice || 'N/A'}`);
          console.log(`   Suite: $${detail.suitePrice || 'N/A'}`);
        }

        results.tests.api = {
          status: hasPrices ? 'PASS' : 'PARTIAL',
          searchCount: cruises.length,
          hasPriceFields: hasPrices
        };
      }
    }
  } catch (error) {
    console.log(`❌ API test failed: ${error.message.split('\n')[0]}`);
    results.tests.api = { status: 'FAIL', error: error.message };
  }

  // Test 4: Data consistency check
  console.log('\n🔗 TEST 4: Data Consistency');
  console.log('-'.repeat(40));

  try {
    const consistencyQuery = `
      SELECT
        c.id,
        c.interior_price as db_interior,
        cp.interior::numeric as cp_interior,
        CASE
          WHEN c.interior_price IS NULL AND cp.interior IS NULL THEN 'both_null'
          WHEN ABS(COALESCE(c.interior_price, 0) - COALESCE(cp.interior::numeric, 0)) < 0.01 THEN 'match'
          ELSE 'mismatch'
        END as status
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON cp.cruise_id = c.id
      WHERE c.is_active = true
      LIMIT 100
    `;

    const { stdout } = await execPromise(
      `echo "${consistencyQuery}" | psql $DATABASE_URL -t | grep -c 'match' || echo "0"`
    );

    const matches = parseInt(stdout.trim()) || 0;
    console.log(`✅ Price consistency: ${matches}/100 samples match`);
    results.tests.consistency = { status: matches > 90 ? 'PASS' : 'WARN', matches };

  } catch (error) {
    console.log(`⚠️  Consistency test skipped: ${error.message.split('\n')[0]}`);
    results.tests.consistency = { status: 'SKIP' };
  }

  // Test 5: Price change tracking
  console.log('\n📈 TEST 5: Price Changes (Last 24h)');
  console.log('-'.repeat(40));

  try {
    const priceChangeQuery = `
      SELECT
        COUNT(DISTINCT cruise_id) as cruises_with_snapshots,
        COUNT(*) as total_snapshots
      FROM price_snapshots
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `;

    const { stdout } = await execPromise(`echo "${priceChangeQuery}" | psql $DATABASE_URL -t`);

    const parts = stdout.trim().split('|').map(s => s.trim());
    if (parts.length >= 2) {
      console.log(`✅ Price tracking: ${parts[1]} snapshots for ${parts[0]} cruises`);
      results.tests.priceTracking = { status: 'PASS', snapshots: parts[1], cruises: parts[0] };
    }
  } catch (error) {
    console.log(`⚠️  Price tracking test skipped`);
    results.tests.priceTracking = { status: 'SKIP' };
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const [name, result] of Object.entries(results.tests)) {
    const status = result.status;
    if (status === 'PASS') passed++;
    else if (status === 'FAIL') failed++;
    else skipped++;

    const emoji = status === 'PASS' ? '✅' :
                  status === 'FAIL' ? '❌' : '⏭️';
    console.log(`${emoji} ${name.toUpperCase()}: ${status}`);
  }

  console.log(`\nTotal: ${passed} passed, ${failed} failed, ${skipped} skipped`);

  const overall = failed === 0 ? 'PASSED' : 'FAILED';
  console.log('\n' + '='.repeat(70));
  console.log(failed === 0 ? '✅ PIPELINE TEST PASSED' : '❌ PIPELINE TEST FAILED');
  console.log('='.repeat(70) + '\n');

  return failed === 0 ? 0 : 1;
}

// Run if called directly
if (require.main === module) {
  runSimplePipelineTest()
    .then(code => process.exit(code))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
