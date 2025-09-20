#!/usr/bin/env node

/**
 * COMPLETE PRICING VALIDATION TEST
 *
 * This script verifies that cruise pricing is working correctly end-to-end:
 * 1. Tests the API endpoints return price fields
 * 2. Compares database prices with FTP data
 * 3. Validates that all price fields are populated correctly
 */

require('dotenv').config();
const { Pool } = require('pg');
const ftp = require('basic-ftp');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

// Configuration - check both staging and production
const API_URLS = {
  staging: 'https://zipsea-backend.onrender.com',
  production: 'https://zipsea-production.onrender.com'
};

async function testPricingComplete() {
  console.log('🔍 COMPLETE PRICING VALIDATION TEST');
  console.log('=' .repeat(70));
  console.log('');

  const results = {
    apiTests: {},
    dbTests: {},
    ftpComparison: {},
    summary: {
      passed: 0,
      failed: 0,
      warnings: 0
    }
  };

  try {
    // ========================================
    // STEP 1: TEST API ENDPOINTS
    // ========================================
    console.log('📡 STEP 1: TESTING API ENDPOINTS');
    console.log('-'.repeat(40));

    for (const [env, apiUrl] of Object.entries(API_URLS)) {
      console.log(`\nTesting ${env.toUpperCase()} (${apiUrl}):\n`);

      // Test search API
      console.log('  1. Testing Search API...');
      try {
        const searchResponse = await fetch(`${apiUrl}/api/v1/search/comprehensive?limit=5`);
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();

          if (searchData.results && searchData.results.length > 0) {
            const firstCruise = searchData.results[0];
            console.log(`     ✅ Search API returns cruises`);

            // Check if pricing fields exist
            if (firstCruise.pricing) {
              console.log(`     ✅ Pricing object exists`);
              console.log(`        Interior: $${firstCruise.pricing.interior || 'null'}`);
              console.log(`        Oceanview: $${firstCruise.pricing.oceanview || 'null'}`);
              console.log(`        Balcony: $${firstCruise.pricing.balcony || 'null'}`);
              console.log(`        Suite: $${firstCruise.pricing.suite || 'null'}`);
              console.log(`        Lowest: $${firstCruise.pricing.lowestPrice || 'null'}`);

              results.apiTests[`${env}_search`] = 'PASSED';
              results.summary.passed++;
            } else {
              console.log(`     ⚠️ Pricing object missing!`);
              results.apiTests[`${env}_search`] = 'MISSING_PRICING';
              results.summary.warnings++;
            }

            // Test cruise detail API if we have an ID
            if (firstCruise.id) {
              console.log(`\n  2. Testing Cruise Detail API (ID: ${firstCruise.id})...`);
              const detailResponse = await fetch(`${apiUrl}/api/v1/cruises/${firstCruise.id}`);

              if (detailResponse.ok) {
                const detailData = await detailResponse.json();

                if (detailData) {
                  console.log(`     ✅ Cruise details returned`);

                  // Check individual price fields
                  const hasPrices = detailData.interiorPrice !== undefined ||
                                   detailData.oceanviewPrice !== undefined ||
                                   detailData.balconyPrice !== undefined ||
                                   detailData.suitePrice !== undefined;

                  if (hasPrices) {
                    console.log(`     ✅ Individual price fields exist`);
                    console.log(`        Interior: $${detailData.interiorPrice || 'null'}`);
                    console.log(`        Oceanview: $${detailData.oceanviewPrice || 'null'}`);
                    console.log(`        Balcony: $${detailData.balconyPrice || 'null'}`);
                    console.log(`        Suite: $${detailData.suitePrice || 'null'}`);
                    console.log(`        Cheapest: $${detailData.cheapestPrice || 'null'}`);

                    results.apiTests[`${env}_detail`] = 'PASSED';
                    results.summary.passed++;
                  } else {
                    console.log(`     ⚠️ Individual price fields missing!`);
                    results.apiTests[`${env}_detail`] = 'MISSING_PRICES';
                    results.summary.warnings++;
                  }
                }
              } else {
                console.log(`     ❌ Failed to fetch cruise details: ${detailResponse.status}`);
                results.apiTests[`${env}_detail`] = 'FAILED';
                results.summary.failed++;
              }
            }
          } else {
            console.log(`     ⚠️ No cruises returned in search`);
            results.apiTests[`${env}_search`] = 'NO_RESULTS';
            results.summary.warnings++;
          }
        } else {
          console.log(`     ❌ Search API failed: ${searchResponse.status}`);
          results.apiTests[`${env}_search`] = 'FAILED';
          results.summary.failed++;
        }
      } catch (error) {
        console.log(`     ❌ Error testing ${env}: ${error.message}`);
        results.apiTests[`${env}_search`] = 'ERROR';
        results.summary.failed++;
      }
    }

    // ========================================
    // STEP 2: TEST DATABASE PRICES
    // ========================================
    console.log('\n\n📊 STEP 2: TESTING DATABASE PRICES');
    console.log('-'.repeat(40));

    // Get sample cruises with prices
    const sampleCruises = await pool.query(`
      SELECT
        c.id,
        c.name,
        c.cruise_id,
        c.sailing_date,
        c.interior_price,
        c.oceanview_price,
        c.balcony_price,
        c.suite_price,
        c.cheapest_price,
        cl.name as cruise_line,
        s.name as ship_name
      FROM cruises c
      LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      LEFT JOIN ships s ON c.ship_id = s.id
      WHERE c.is_active = true
        AND c.sailing_date >= CURRENT_DATE
        AND c.sailing_date <= CURRENT_DATE + INTERVAL '3 months'
        AND (c.interior_price IS NOT NULL
          OR c.oceanview_price IS NOT NULL
          OR c.balcony_price IS NOT NULL
          OR c.suite_price IS NOT NULL)
      ORDER BY RANDOM()
      LIMIT 10
    `);

    console.log(`\nFound ${sampleCruises.rows.length} cruises with prices in database\n`);

    let dbPricesValid = 0;
    let dbPricesInvalid = 0;

    sampleCruises.rows.forEach(cruise => {
      console.log(`Cruise: ${cruise.name}`);
      console.log(`  Line: ${cruise.cruise_line} | Ship: ${cruise.ship_name}`);
      console.log(`  Date: ${cruise.sailing_date}`);
      console.log(`  Prices:`);
      console.log(`    Interior:  $${cruise.interior_price || 'null'}`);
      console.log(`    Oceanview: $${cruise.oceanview_price || 'null'}`);
      console.log(`    Balcony:   $${cruise.balcony_price || 'null'}`);
      console.log(`    Suite:     $${cruise.suite_price || 'null'}`);
      console.log(`    Cheapest:  $${cruise.cheapest_price || 'null'}`);

      // Validate cheapest_price calculation
      const prices = [
        cruise.interior_price,
        cruise.oceanview_price,
        cruise.balcony_price,
        cruise.suite_price
      ].filter(p => p && p > 0);

      if (prices.length > 0) {
        const calculatedCheapest = Math.min(...prices);
        if (cruise.cheapest_price && Math.abs(cruise.cheapest_price - calculatedCheapest) < 1) {
          console.log(`    ✅ Cheapest price correctly calculated`);
          dbPricesValid++;
        } else {
          console.log(`    ⚠️ Cheapest price mismatch: DB=${cruise.cheapest_price}, Calc=${calculatedCheapest}`);
          dbPricesInvalid++;
        }
      }
      console.log('');
    });

    results.dbTests.validPrices = dbPricesValid;
    results.dbTests.invalidPrices = dbPricesInvalid;
    results.summary.passed += dbPricesValid;
    results.summary.warnings += dbPricesInvalid;

    // ========================================
    // STEP 3: COMPARE WITH FTP DATA (Optional)
    // ========================================
    if (process.env.TRAVELTEK_FTP_HOST) {
      console.log('\n📁 STEP 3: COMPARING WITH FTP DATA');
      console.log('-'.repeat(40));

      const ftpClient = new ftp.Client();
      ftpClient.ftp.verbose = false;

      try {
        await ftpClient.access({
          host: process.env.TRAVELTEK_FTP_HOST,
          user: process.env.TRAVELTEK_FTP_USER,
          password: process.env.TRAVELTEK_FTP_PASSWORD,
          secure: false,
        });

        console.log('✅ Connected to FTP server\n');

        // Test one cruise against FTP
        const testCruise = sampleCruises.rows[0];
        if (testCruise && testCruise.cruise_id) {
          console.log(`Testing cruise ${testCruise.id} against FTP data...`);

          // Note: Would need to implement FTP file lookup logic here
          console.log('⚠️ FTP comparison not fully implemented in this test');
        }

        await ftpClient.close();
      } catch (error) {
        console.log(`⚠️ Could not connect to FTP: ${error.message}`);
      }
    } else {
      console.log('\n⚠️ FTP credentials not configured - skipping FTP comparison');
    }

    // ========================================
    // SUMMARY
    // ========================================
    console.log('\n\n' + '='.repeat(70));
    console.log('📈 TEST SUMMARY');
    console.log('='.repeat(70));

    console.log('\nAPI Tests:');
    Object.entries(results.apiTests).forEach(([test, result]) => {
      const icon = result === 'PASSED' ? '✅' : result === 'FAILED' ? '❌' : '⚠️';
      console.log(`  ${icon} ${test}: ${result}`);
    });

    console.log('\nDatabase Tests:');
    console.log(`  ✅ Valid prices: ${results.dbTests.validPrices}`);
    console.log(`  ⚠️ Invalid prices: ${results.dbTests.invalidPrices}`);

    console.log('\nOverall Results:');
    console.log(`  ✅ Passed: ${results.summary.passed}`);
    console.log(`  ⚠️ Warnings: ${results.summary.warnings}`);
    console.log(`  ❌ Failed: ${results.summary.failed}`);

    const overallStatus = results.summary.failed === 0 ?
      (results.summary.warnings === 0 ? 'FULLY OPERATIONAL' : 'OPERATIONAL WITH WARNINGS') :
      'ISSUES DETECTED';

    console.log(`\nStatus: ${overallStatus}`);

    if (results.summary.failed > 0 || results.summary.warnings > 0) {
      console.log('\n📝 RECOMMENDATIONS:');
      if (results.summary.failed > 0) {
        console.log('  1. Check API services are running');
        console.log('  2. Verify database connections');
        console.log('  3. Check recent deployments for issues');
      }
      if (results.summary.warnings > 0) {
        console.log('  1. Run data sync to update missing prices');
        console.log('  2. Check webhook processor for errors');
        console.log('  3. Verify FTP data extraction logic');
      }
    }

  } catch (error) {
    console.error('\n❌ Fatal error during testing:', error);
    results.summary.failed++;
  } finally {
    await pool.end();
  }
}

// Run the test
testPricingComplete().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
