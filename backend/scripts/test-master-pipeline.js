#!/usr/bin/env node

/**
 * MASTER TEST SCRIPT - Source of Truth for Entire Data Pipeline
 *
 * Tests:
 * 1. Webhook triggers and cruise line updates
 * 2. FTP data retrieval and processing
 * 3. Database storage correctness
 * 4. Price extraction accuracy
 * 5. API serving correct data
 *
 * Run with: node scripts/test-master-pipeline.js
 */

require('dotenv').config();
const { Client } = require('basic-ftp');
const { db } = require('../dist/db/connection');
const { sql } = require('drizzle-orm');
// Use fetch-polyfill or native fetch if available
const fetch = globalThis.fetch || (() => {
  throw new Error('fetch not available - install node-fetch or use Node 18+');
});
const fs = require('fs').promises;
const path = require('path');

// Configuration
const CONFIG = {
  FTP: {
    host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
    user: process.env.TRAVELTEK_FTP_USER,
    password: process.env.TRAVELTEK_FTP_PASSWORD,
    secure: false,
    timeout: 30000
  },
  API_URL: process.env.API_URL || 'https://zipsea-production.onrender.com',
  DATABASE_URL: process.env.DATABASE_URL,
  SAMPLE_SIZE: 100, // Number of cruises to test per line
  MAX_CRUISE_LINES: 10, // Limit cruise lines for testing
};

// Test results structure
const testResults = {
  timestamp: new Date().toISOString(),
  summary: {
    totalTests: 0,
    passed: 0,
    failed: 0,
    warnings: 0
  },
  cruiseLines: {},
  pipelineTests: {
    webhookTriggers: null,
    ftpDataRetrieval: null,
    databaseStorage: null,
    priceExtraction: null,
    apiServing: null
  },
  errors: [],
  warnings: []
};

// Utility functions
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '📊',
    success: '✅',
    warning: '⚠️',
    error: '❌',
    section: '🔍'
  }[level] || '•';

  console.log(`[${timestamp}] ${prefix} ${message}`);
}

function calculatePriceChanges(oldPrices, newPrices) {
  const changes = {};
  const fields = ['interiorPrice', 'oceanviewPrice', 'balconyPrice', 'suitePrice', 'cheapestPrice'];

  for (const field of fields) {
    const oldVal = parseFloat(oldPrices?.[field] || 0);
    const newVal = parseFloat(newPrices?.[field] || 0);

    if (oldVal !== newVal) {
      changes[field] = {
        old: oldVal,
        new: newVal,
        change: newVal - oldVal,
        percentChange: oldVal > 0 ? ((newVal - oldVal) / oldVal * 100).toFixed(2) + '%' : 'N/A'
      };
    }
  }

  return changes;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ========================================
// TEST 1: Check Webhook Events & Cruise Line Updates
// ========================================
async function testWebhookAndCruiseLineUpdates() {
  log('TEST 1: Webhook Events & Cruise Line Updates', 'section');
  const test = { passed: true, details: {} };

  try {
    // Query webhook events from the last 24 hours
    const query = sql`
      SELECT
        we.line_id,
        cl.name as cruise_line_name,
        COUNT(*) as webhook_count,
        MAX(we.created_at) as last_webhook,
        MIN(we.created_at) as first_webhook,
        COUNT(DISTINCT DATE(we.created_at)) as active_days,
        SUM(CASE WHEN we.status = 'completed' THEN 1 ELSE 0 END) as completed_count,
        SUM(CASE WHEN we.status = 'failed' THEN 1 ELSE 0 END) as failed_count
      FROM webhook_events we
      LEFT JOIN cruise_lines cl ON cl.id = we.line_id
      WHERE we.created_at > NOW() - INTERVAL '24 hours'
      GROUP BY we.line_id, cl.name
      ORDER BY last_webhook DESC
    `;

    const result = await db.execute(query);

    if (result.length === 0) {
      test.passed = false;
      test.error = 'No webhook events found in the last 24 hours';
      testResults.warnings.push('No recent webhook activity detected');
    } else {
      log(`Found ${result.length} cruise lines with recent webhook activity`, 'success');

      // Store cruise line update information
      for (const row of result) {
        const lineId = row.line_id;
        testResults.cruiseLines[lineId] = {
          id: lineId,
          name: row.cruise_line_name || `Line ${lineId}`,
          lastWebhook: row.last_webhook,
          webhookCount24h: parseInt(row.webhook_count),
          completedWebhooks: parseInt(row.completed_count),
          failedWebhooks: parseInt(row.failed_count),
          activeDays: parseInt(row.active_days),
          cruises: {}
        };

        log(`  ${row.cruise_line_name || `Line ${lineId}`}: ${row.webhook_count} webhooks, ${row.completed_count} completed, ${row.failed_count} failed`, 'info');
      }
    }

    // Check cruise updates per line
    const cruiseUpdatesQuery = sql`
      SELECT
        cruise_line_id,
        COUNT(*) as total_cruises,
        COUNT(CASE WHEN updated_at > NOW() - INTERVAL '24 hours' THEN 1 END) as updated_24h,
        COUNT(CASE WHEN updated_at > NOW() - INTERVAL '7 days' THEN 1 END) as updated_7d,
        MIN(sailing_date) as earliest_sailing,
        MAX(sailing_date) as latest_sailing
      FROM cruises
      WHERE is_active = true
      GROUP BY cruise_line_id
      ORDER BY updated_24h DESC
      LIMIT ${CONFIG.MAX_CRUISE_LINES}
    `;

    const cruiseUpdates = await db.execute(cruiseUpdatesQuery);

    for (const row of cruiseUpdates) {
      if (testResults.cruiseLines[row.cruise_line_id]) {
        testResults.cruiseLines[row.cruise_line_id].totalCruises = parseInt(row.total_cruises);
        testResults.cruiseLines[row.cruise_line_id].updatedLast24h = parseInt(row.updated_24h);
        testResults.cruiseLines[row.cruise_line_id].updatedLast7d = parseInt(row.updated_7d);
        testResults.cruiseLines[row.cruise_line_id].dateRange = {
          earliest: row.earliest_sailing,
          latest: row.latest_sailing
        };
      }
    }

  } catch (error) {
    test.passed = false;
    test.error = error.message;
    testResults.errors.push(`Webhook test failed: ${error.message}`);
  }

  testResults.pipelineTests.webhookTriggers = test;
  return test.passed;
}

// ========================================
// TEST 2: Verify FTP Data Retrieval
// ========================================
async function testFTPDataRetrieval() {
  log('TEST 2: FTP Data Retrieval', 'section');
  const test = { passed: true, details: {} };

  if (!CONFIG.FTP.user || !CONFIG.FTP.password) {
    log('FTP credentials not configured - skipping FTP test', 'warning');
    test.skipped = true;
    testResults.warnings.push('FTP credentials not configured');
    testResults.pipelineTests.ftpDataRetrieval = test;
    return true;
  }

  const client = new Client();

  try {
    // Connect to FTP
    await client.access(CONFIG.FTP);
    log('Connected to FTP server', 'success');

    // Get current year and month
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    // Check data availability for current month
    const basePath = `/cruiseline/${year}/${month}`;

    try {
      const directories = await client.list(basePath);
      const cruiseLineCount = directories.filter(d => d.isDirectory).length;

      log(`Found ${cruiseLineCount} cruise lines in ${year}/${month}`, 'success');
      test.details.currentMonthLines = cruiseLineCount;
      test.details.ftpPath = basePath;

      // Sample check: Get file count for first few cruise lines
      let totalFiles = 0;
      let sampleLines = 0;

      for (const dir of directories.filter(d => d.isDirectory).slice(0, 5)) {
        const linePath = `${basePath}/${dir.name}`;
        const shipDirs = await client.list(linePath);

        for (const shipDir of shipDirs.filter(d => d.isDirectory).slice(0, 2)) {
          const shipPath = `${linePath}/${shipDir.name}`;
          const cruiseFiles = await client.list(shipPath);
          const jsonFiles = cruiseFiles.filter(f => f.name.endsWith('.json'));
          totalFiles += jsonFiles.length;
        }
        sampleLines++;
      }

      test.details.sampleFileCount = totalFiles;
      test.details.sampledLines = sampleLines;
      log(`Sampled ${totalFiles} cruise files across ${sampleLines} lines`, 'info');

    } catch (ftpError) {
      test.passed = false;
      test.error = `FTP navigation failed: ${ftpError.message}`;
      testResults.errors.push(`FTP test failed: ${ftpError.message}`);
    }

  } catch (error) {
    test.passed = false;
    test.error = error.message;
    testResults.errors.push(`FTP connection failed: ${error.message}`);
  } finally {
    client.close();
  }

  testResults.pipelineTests.ftpDataRetrieval = test;
  return test.passed;
}

// ========================================
// TEST 3: Verify Database Storage
// ========================================
async function testDatabaseStorage() {
  log('TEST 3: Database Storage Verification', 'section');
  const test = { passed: true, details: {} };

  try {
    // Check cruises table integrity
    const integrityQuery = sql`
      SELECT
        COUNT(*) as total_cruises,
        COUNT(DISTINCT cruise_line_id) as unique_lines,
        COUNT(DISTINCT ship_id) as unique_ships,
        COUNT(CASE WHEN interior_price IS NOT NULL THEN 1 END) as has_interior,
        COUNT(CASE WHEN oceanview_price IS NOT NULL THEN 1 END) as has_oceanview,
        COUNT(CASE WHEN balcony_price IS NOT NULL THEN 1 END) as has_balcony,
        COUNT(CASE WHEN suite_price IS NOT NULL THEN 1 END) as has_suite,
        COUNT(CASE WHEN cheapest_price IS NOT NULL THEN 1 END) as has_cheapest,
        COUNT(CASE WHEN raw_data IS NOT NULL THEN 1 END) as has_raw_data,
        COUNT(CASE WHEN raw_data::text != '{}' THEN 1 END) as has_valid_raw_data
      FROM cruises
      WHERE is_active = true
        AND sailing_date >= CURRENT_DATE
    `;

    const [integrity] = await db.execute(integrityQuery);

    test.details = {
      totalActiveCruises: parseInt(integrity.total_cruises),
      uniqueCruiseLines: parseInt(integrity.unique_lines),
      uniqueShips: parseInt(integrity.unique_ships),
      withPricing: {
        interior: parseInt(integrity.has_interior),
        oceanview: parseInt(integrity.has_oceanview),
        balcony: parseInt(integrity.has_balcony),
        suite: parseInt(integrity.has_suite),
        cheapest: parseInt(integrity.has_cheapest)
      },
      withRawData: parseInt(integrity.has_raw_data),
      withValidRawData: parseInt(integrity.has_valid_raw_data),
      pricingCoverage: {
        interior: (integrity.has_interior / integrity.total_cruises * 100).toFixed(2) + '%',
        oceanview: (integrity.has_oceanview / integrity.total_cruises * 100).toFixed(2) + '%',
        balcony: (integrity.has_balcony / integrity.total_cruises * 100).toFixed(2) + '%',
        suite: (integrity.has_suite / integrity.total_cruises * 100).toFixed(2) + '%',
        cheapest: (integrity.has_cheapest / integrity.total_cruises * 100).toFixed(2) + '%'
      }
    };

    log(`Database contains ${integrity.total_cruises} active cruises`, 'success');
    log(`Pricing coverage: ${integrity.has_cheapest}/${integrity.total_cruises} (${test.details.pricingCoverage.cheapest})`, 'info');

    // Check data freshness
    const freshnessQuery = sql`
      SELECT
        COUNT(CASE WHEN updated_at > NOW() - INTERVAL '1 hour' THEN 1 END) as updated_1h,
        COUNT(CASE WHEN updated_at > NOW() - INTERVAL '24 hours' THEN 1 END) as updated_24h,
        COUNT(CASE WHEN updated_at > NOW() - INTERVAL '7 days' THEN 1 END) as updated_7d,
        COUNT(CASE WHEN updated_at > NOW() - INTERVAL '30 days' THEN 1 END) as updated_30d
      FROM cruises
      WHERE is_active = true
    `;

    const [freshness] = await db.execute(freshnessQuery);

    test.details.dataFreshness = {
      lastHour: parseInt(freshness.updated_1h),
      last24Hours: parseInt(freshness.updated_24h),
      last7Days: parseInt(freshness.updated_7d),
      last30Days: parseInt(freshness.updated_30d)
    };

    log(`Data freshness: ${freshness.updated_24h} cruises updated in last 24h`, 'info');

    // Verify cheapest_pricing table
    const cheapestPricingQuery = sql`
      SELECT
        COUNT(*) as total_records,
        COUNT(DISTINCT cruise_id) as unique_cruises,
        COUNT(CASE WHEN interior IS NOT NULL THEN 1 END) as has_interior,
        COUNT(CASE WHEN oceanview IS NOT NULL THEN 1 END) as has_oceanview,
        COUNT(CASE WHEN balcony IS NOT NULL THEN 1 END) as has_balcony,
        COUNT(CASE WHEN suite IS NOT NULL THEN 1 END) as has_suite
      FROM cheapest_pricing
    `;

    const [cheapestPricing] = await db.execute(cheapestPricingQuery);

    test.details.cheapestPricingTable = {
      totalRecords: parseInt(cheapestPricing.total_records),
      uniqueCruises: parseInt(cheapestPricing.unique_cruises),
      withInterior: parseInt(cheapestPricing.has_interior),
      withOceanview: parseInt(cheapestPricing.has_oceanview),
      withBalcony: parseInt(cheapestPricing.has_balcony),
      withSuite: parseInt(cheapestPricing.has_suite)
    };

  } catch (error) {
    test.passed = false;
    test.error = error.message;
    testResults.errors.push(`Database test failed: ${error.message}`);
  }

  testResults.pipelineTests.databaseStorage = test;
  return test.passed;
}

// ========================================
// TEST 4: Verify Price Extraction
// ========================================
async function testPriceExtraction() {
  log('TEST 4: Price Extraction Verification', 'section');
  const test = { passed: true, details: { samples: [] } };

  try {
    // Get a sample of cruises with raw_data to verify extraction
    const sampleQuery = sql`
      SELECT
        c.id,
        c.cruise_id,
        c.name,
        c.cruise_line_id,
        cl.name as cruise_line_name,
        c.interior_price,
        c.oceanview_price,
        c.balcony_price,
        c.suite_price,
        c.cheapest_price,
        c.raw_data,
        cp.interior as cp_interior,
        cp.oceanview as cp_oceanview,
        cp.balcony as cp_balcony,
        cp.suite as cp_suite
      FROM cruises c
      LEFT JOIN cruise_lines cl ON cl.id = c.cruise_line_id
      LEFT JOIN cheapest_pricing cp ON cp.cruise_id = c.id
      WHERE c.raw_data IS NOT NULL
        AND c.raw_data::text != '{}'
        AND c.is_active = true
      ORDER BY c.updated_at DESC
      LIMIT ${CONFIG.SAMPLE_SIZE}
    `;

    const samples = await db.execute(sampleQuery);
    let correctExtractions = 0;
    let mismatches = [];

    for (const cruise of samples) {
      if (!cruise.raw_data) continue;

      const rawData = typeof cruise.raw_data === 'string'
        ? JSON.parse(cruise.raw_data)
        : cruise.raw_data;

      // Extract prices from raw data
      const extractPrice = (value) => {
        if (!value) return null;
        if (typeof value === 'string' || typeof value === 'number') {
          return parseFloat(value);
        }
        if (value.price !== undefined) {
          return parseFloat(value.price);
        }
        if (value.value !== undefined) {
          return parseFloat(value.value);
        }
        return null;
      };

      const expectedPrices = {
        interior: extractPrice(rawData.cheapestinside || rawData.cheapestinterior),
        oceanview: extractPrice(rawData.cheapestoutside || rawData.cheapestoceanview),
        balcony: extractPrice(rawData.cheapestbalcony),
        suite: extractPrice(rawData.cheapestsuite),
      };

      const actualPrices = {
        interior: parseFloat(cruise.interior_price) || null,
        oceanview: parseFloat(cruise.oceanview_price) || null,
        balcony: parseFloat(cruise.balcony_price) || null,
        suite: parseFloat(cruise.suite_price) || null,
      };

      // Compare prices
      let isCorrect = true;
      const cruiseMismatches = [];

      for (const [key, expected] of Object.entries(expectedPrices)) {
        const actual = actualPrices[key];
        if (expected !== null && actual !== null) {
          const diff = Math.abs(expected - actual);
          if (diff > 0.01) { // Allow for minor float differences
            isCorrect = false;
            cruiseMismatches.push({
              field: key,
              expected,
              actual,
              difference: diff
            });
          }
        }
      }

      if (isCorrect) {
        correctExtractions++;
      } else {
        mismatches.push({
          cruiseId: cruise.id,
          name: cruise.name,
          cruiseLine: cruise.cruise_line_name,
          mismatches: cruiseMismatches
        });
      }

      // Add to sample details (first 5 only for brevity)
      if (test.details.samples.length < 5) {
        test.details.samples.push({
          id: cruise.id,
          name: cruise.name.substring(0, 50),
          cruiseLine: cruise.cruise_line_name,
          prices: actualPrices,
          rawDataPrices: expectedPrices,
          match: isCorrect
        });
      }
    }

    test.details.totalSampled = samples.length;
    test.details.correctExtractions = correctExtractions;
    test.details.accuracy = samples.length > 0
      ? (correctExtractions / samples.length * 100).toFixed(2) + '%'
      : 'N/A';
    test.details.mismatchCount = mismatches.length;

    if (mismatches.length > 0) {
      test.details.sampleMismatches = mismatches.slice(0, 5);
      test.passed = mismatches.length < samples.length * 0.1; // Pass if <10% mismatches
      if (!test.passed) {
        testResults.errors.push(`Price extraction accuracy too low: ${test.details.accuracy}`);
      } else {
        testResults.warnings.push(`Price extraction has ${mismatches.length} mismatches`);
      }
    }

    log(`Price extraction accuracy: ${correctExtractions}/${samples.length} (${test.details.accuracy})`,
        test.passed ? 'success' : 'warning');

  } catch (error) {
    test.passed = false;
    test.error = error.message;
    testResults.errors.push(`Price extraction test failed: ${error.message}`);
  }

  testResults.pipelineTests.priceExtraction = test;
  return test.passed;
}

// ========================================
// TEST 5: Verify API Serving
// ========================================
async function testAPIServing() {
  log('TEST 5: API Data Serving', 'section');
  const test = { passed: true, details: { endpoints: {} } };

  try {
    // Test search endpoint
    log('Testing search endpoint...', 'info');
    const searchResponse = await fetch(`${CONFIG.API_URL}/api/v1/search/cruises?limit=10`);

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      const cruises = searchData.cruises || searchData.data || [];

      test.details.endpoints.search = {
        status: 'OK',
        cruiseCount: cruises.length,
        hasPrices: cruises.filter(c => c.price !== null).length
      };

      log(`Search API returned ${cruises.length} cruises`, 'success');

      // Test detail endpoint for each cruise
      let detailTests = 0;
      let detailPassed = 0;
      const detailSamples = [];

      for (const cruise of cruises.slice(0, 5)) {
        const detailResponse = await fetch(`${CONFIG.API_URL}/api/v1/cruises/${cruise.id}`);

        if (detailResponse.ok) {
          const detailData = await detailResponse.json();
          const cruiseDetail = detailData.data || detailData;

          detailTests++;

          // Verify price fields exist
          const hasPriceFields =
            cruiseDetail.interiorPrice !== undefined ||
            cruiseDetail.oceanviewPrice !== undefined ||
            cruiseDetail.balconyPrice !== undefined ||
            cruiseDetail.suitePrice !== undefined ||
            cruiseDetail.cheapestPrice !== undefined;

          if (hasPriceFields) {
            detailPassed++;
          }

          detailSamples.push({
            id: cruise.id,
            name: cruiseDetail.name?.substring(0, 50),
            hasPriceFields,
            prices: {
              interior: cruiseDetail.interiorPrice,
              oceanview: cruiseDetail.oceanviewPrice,
              balcony: cruiseDetail.balconyPrice,
              suite: cruiseDetail.suitePrice,
              cheapest: cruiseDetail.cheapestPrice
            }
          });
        }

        await sleep(100); // Rate limiting
      }

      test.details.endpoints.detail = {
        tested: detailTests,
        passed: detailPassed,
        samples: detailSamples
      };

      log(`Detail API: ${detailPassed}/${detailTests} cruises have price fields`,
          detailPassed === detailTests ? 'success' : 'warning');

    } else {
      test.passed = false;
      test.error = `Search API failed: ${searchResponse.status}`;
      testResults.errors.push(`API test failed: ${test.error}`);
    }

    // Compare API data with database
    if (test.details.endpoints.detail && test.details.endpoints.detail.samples.length > 0) {
      log('Verifying API data matches database...', 'info');

      const sampleIds = test.details.endpoints.detail.samples.map(s => s.id);
      const dbQuery = sql`
        SELECT
          id,
          interior_price,
          oceanview_price,
          balcony_price,
          suite_price,
          cheapest_price
        FROM cruises
        WHERE id = ANY(${sampleIds})
      `;

      const dbCruises = await db.execute(dbQuery);
      const dbMap = {};
      for (const cruise of dbCruises) {
        dbMap[cruise.id] = cruise;
      }

      let matchCount = 0;
      const apiDbComparison = [];

      for (const apiCruise of test.details.endpoints.detail.samples) {
        const dbCruise = dbMap[apiCruise.id];

        if (dbCruise) {
          const matches =
            parseFloat(apiCruise.prices.interior || 0) === parseFloat(dbCruise.interior_price || 0) &&
            parseFloat(apiCruise.prices.oceanview || 0) === parseFloat(dbCruise.oceanview_price || 0) &&
            parseFloat(apiCruise.prices.balcony || 0) === parseFloat(dbCruise.balcony_price || 0) &&
            parseFloat(apiCruise.prices.suite || 0) === parseFloat(dbCruise.suite_price || 0);

          if (matches) matchCount++;

          apiDbComparison.push({
            id: apiCruise.id,
            matches,
            api: apiCruise.prices,
            db: {
              interior: dbCruise.interior_price,
              oceanview: dbCruise.oceanview_price,
              balcony: dbCruise.balcony_price,
              suite: dbCruise.suite_price,
              cheapest: dbCruise.cheapest_price
            }
          });
        }
      }

      test.details.apiDbConsistency = {
        tested: apiDbComparison.length,
        matching: matchCount,
        accuracy: apiDbComparison.length > 0
          ? (matchCount / apiDbComparison.length * 100).toFixed(2) + '%'
          : 'N/A',
        samples: apiDbComparison.slice(0, 3)
      };

      log(`API/DB consistency: ${matchCount}/${apiDbComparison.length} match (${test.details.apiDbConsistency.accuracy})`,
          matchCount === apiDbComparison.length ? 'success' : 'warning');
    }

  } catch (error) {
    test.passed = false;
    test.error = error.message;
    testResults.errors.push(`API serving test failed: ${error.message}`);
  }

  testResults.pipelineTests.apiServing = test;
  return test.passed;
}

// ========================================
// MAIN TEST RUNNER
// ========================================
async function runMasterTests() {
  console.log('\n' + '='.repeat(80));
  console.log(' '.repeat(20) + '🚀 MASTER PIPELINE TEST SUITE 🚀');
  console.log('='.repeat(80) + '\n');

  const startTime = Date.now();

  try {
    // Run all tests
    const tests = [
      { name: 'Webhook & Updates', fn: testWebhookAndCruiseLineUpdates },
      { name: 'FTP Data', fn: testFTPDataRetrieval },
      { name: 'Database Storage', fn: testDatabaseStorage },
      { name: 'Price Extraction', fn: testPriceExtraction },
      { name: 'API Serving', fn: testAPIServing }
    ];

    for (const test of tests) {
      testResults.summary.totalTests++;

      try {
        const passed = await test.fn();

        if (passed) {
          testResults.summary.passed++;
        } else {
          testResults.summary.failed++;
        }

        console.log(); // Add spacing between tests
      } catch (error) {
        testResults.summary.failed++;
        log(`${test.name} crashed: ${error.message}`, 'error');
      }
    }

    // Generate summary report
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(80));
    console.log(' '.repeat(25) + '📊 TEST SUMMARY 📊');
    console.log('='.repeat(80));

    console.log(`\n⏱️  Duration: ${duration} seconds`);
    console.log(`📈 Total Tests: ${testResults.summary.totalTests}`);
    console.log(`✅ Passed: ${testResults.summary.passed}`);
    console.log(`❌ Failed: ${testResults.summary.failed}`);
    console.log(`⚠️  Warnings: ${testResults.warnings.length}`);

    // Pipeline status overview
    console.log('\n🔄 PIPELINE STATUS:');
    for (const [key, test of Object.entries(testResults.pipelineTests)) {
      const status = test.skipped ? '⏭️ SKIPPED' :
                     test.passed ? '✅ PASSED' :
                     '❌ FAILED';
      const name = key.replace(/([A-Z])/g, ' $1').toUpperCase();
      console.log(`  ${status} - ${name}`);
    }

    // Cruise line summary
    if (Object.keys(testResults.cruiseLines).length > 0) {
      console.log('\n📚 CRUISE LINE UPDATES (Last 24h):');
      const sortedLines = Object.values(testResults.cruiseLines)
        .sort((a, b) => (b.updatedLast24h || 0) - (a.updatedLast24h || 0))
        .slice(0, 10);

      for (const line of sortedLines) {
        console.log(`  ${line.name}: ${line.updatedLast24h || 0} cruises updated, ${line.webhookCount24h || 0} webhooks`);
      }
    }

    // Warnings
    if (testResults.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      testResults.warnings.forEach(w => console.log(`  • ${w}`));
    }

    // Errors
    if (testResults.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      testResults.errors.forEach(e => console.log(`  • ${e}`));
    }

    // Save results to file
    const reportPath = path.join(__dirname, `../test-results/master-test-${Date.now()}.json`);
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(testResults, null, 2));
    console.log(`\n📄 Full report saved to: ${reportPath}`);

    // Overall status
    const overallPassed = testResults.summary.failed === 0;
    console.log('\n' + '='.repeat(80));
    console.log(overallPassed ?
      '✅ PIPELINE TEST SUITE PASSED' :
      '❌ PIPELINE TEST SUITE FAILED');
    console.log('='.repeat(80) + '\n');

    process.exit(overallPassed ? 0 : 1);

  } catch (error) {
    console.error('\n💥 CRITICAL ERROR:', error);
    process.exit(1);
  }
}

// Run tests if called directly
if (require.main === module) {
  runMasterTests().catch(console.error);
}

module.exports = { runMasterTests, testResults };
