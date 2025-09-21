#!/usr/bin/env node

/**
 * COMPREHENSIVE PRODUCTION DATA PIPELINE TEST - FIXED VERSION
 * ============================================
 * THIS IS THE SOURCE OF TRUTH FOR DATA INTEGRITY
 *
 * FIXED: Column references match actual database schema
 * - webhook_events uses received_at (not created_at)
 * - cheapest_pricing uses interior_price (not interior)
 * - Fixed JavaScript errors
 *
 * Run: DATABASE_URL=<production_url> node scripts/test-production-comprehensive-fixed.js
 */

require('dotenv').config();
const { db } = require('../dist/db/connection');
const { sql } = require('drizzle-orm');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// ========================================
// CONFIGURATION
// ========================================
const CONFIG = {
  // Production API endpoint
  API_URL: 'https://zipsea-production.onrender.com',

  // Test sample sizes
  SAMPLES: {
    CRUISES_PER_LINE: 500,     // Test up to 500 cruises per line
    MAX_CRUISE_LINES: 50,      // Test all cruise lines
    PRICE_VALIDATION: 1000,    // Validate 1000 cruises for pricing
    API_TESTS: 100,            // Test 100 API responses
    CONSISTENCY_CHECKS: 2000    // Check 2000 records for consistency
  },

  // Thresholds for failures
  THRESHOLDS: {
    MIN_WEBHOOK_SUCCESS_RATE: 90,  // Minimum 90% webhook success
    MIN_PRICE_COVERAGE: 60,        // At least 60% should have prices
    MAX_STALE_DATA_PERCENT: 20,    // Max 20% data older than 30 days
    MIN_API_CONSISTENCY: 95,       // 95% API/DB match required
    MAX_PRICE_MISMATCH: 0.01       // Max $0.01 difference allowed
  },

  // Time windows
  TIME_WINDOWS: {
    RECENT: '1 hour',
    DAILY: '24 hours',
    WEEKLY: '7 days',
    MONTHLY: '30 days'
  }
};

// Test results collector
const results = {
  timestamp: new Date().toISOString(),
  environment: 'PRODUCTION',
  status: 'RUNNING',
  summary: {
    totalChecks: 0,
    passed: 0,
    failed: 0,
    warnings: 0,
    critical: 0
  },
  tests: {},
  cruiseLines: {},
  issues: [],
  warnings: [],
  critical: [],
  recommendations: []
};

// Utility functions
function log(message, level = 'info') {
  const colors = {
    'title': '\x1b[35m',   // Magenta
    'section': '\x1b[36m', // Cyan
    'info': '\x1b[0m',     // Default
    'success': '\x1b[32m', // Green
    'warning': '\x1b[33m', // Yellow
    'error': '\x1b[31m',   // Red
    'critical': '\x1b[91m' // Bright Red
  };

  const icons = {
    'title': '🚀',
    'section': '🔍',
    'info': '  ',
    'success': '✅',
    'warning': '⚠️',
    'error': '❌',
    'critical': '💥'
  };

  console.log(`${colors[level]}${icons[level]} ${message}\x1b[0m`);
}

function addIssue(severity, category, message, details = null) {
  const issue = {
    severity,
    category,
    message,
    details,
    timestamp: new Date().toISOString()
  };

  if (severity === 'critical') {
    results.critical.push(issue);
    results.summary.critical++;
    log(`CRITICAL: ${message}`, 'critical');
  } else if (severity === 'error') {
    results.issues.push(issue);
    results.summary.failed++;
    log(`ERROR: ${message}`, 'error');
  } else if (severity === 'warning') {
    results.warnings.push(issue);
    results.summary.warnings++;
    log(`WARNING: ${message}`, 'warning');
  }
}

function calculateHash(data) {
  return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
}

// ========================================
// TEST 1: WEBHOOK PIPELINE INTEGRITY
// ========================================
async function testWebhookPipeline() {
  log('TEST 1: WEBHOOK PIPELINE INTEGRITY', 'section');
  const test = { name: 'Webhook Pipeline', status: 'RUNNING', details: {} };

  try {
    // 1.1 Check webhook events table structure
    const tableCheck = await db.execute(sql`
      SELECT
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'webhook_events'
      ORDER BY ordinal_position
    `);

    test.details.tableStructure = {
      columns: tableCheck.length,
      hasRequiredFields: tableCheck.some(c => c.column_name === 'line_id') &&
                        tableCheck.some(c => c.column_name === 'status') &&
                        tableCheck.some(c => c.column_name === 'metadata')
    };

    // 1.2 Check webhook processing statistics - FIXED: use received_at
    const webhookStats = await db.execute(sql`
      SELECT
        line_id,
        cl.name as cruise_line_name,
        COUNT(*) as total_events,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
        MIN(received_at) as first_event,
        MAX(received_at) as last_event,
        AVG(CASE
          WHEN status = 'completed' AND processed_at > received_at
          THEN EXTRACT(EPOCH FROM (processed_at - received_at))
          ELSE NULL
        END) as avg_processing_time_seconds
      FROM webhook_events we
      LEFT JOIN cruise_lines cl ON cl.id = we.line_id
      WHERE we.received_at > NOW() - INTERVAL '7 days'
      GROUP BY we.line_id, cl.name
      ORDER BY total_events DESC
    `);

    test.details.webhookStats = {
      totalLines: webhookStats.length,
      totalEvents7d: webhookStats.reduce((sum, row) => sum + parseInt(row.total_events), 0),
      totalCompleted: webhookStats.reduce((sum, row) => sum + parseInt(row.completed), 0),
      totalFailed: webhookStats.reduce((sum, row) => sum + parseInt(row.failed), 0)
    };

    // Check success rates per line
    for (const lineStats of webhookStats) {
      const successRate = (lineStats.completed / lineStats.total_events * 100);
      const lineId = lineStats.line_id;

      if (!results.cruiseLines[lineId]) {
        results.cruiseLines[lineId] = {
          id: lineId,
          name: lineStats.cruise_line_name || `Line ${lineId}`,
          tests: {}
        };
      }

      results.cruiseLines[lineId].webhookStats = {
        total: parseInt(lineStats.total_events),
        completed: parseInt(lineStats.completed),
        failed: parseInt(lineStats.failed),
        pending: parseInt(lineStats.pending),
        processing: parseInt(lineStats.processing),
        successRate: successRate.toFixed(2) + '%',
        avgProcessingTime: lineStats.avg_processing_time_seconds
          ? parseFloat(lineStats.avg_processing_time_seconds).toFixed(2) + 's'
          : 'N/A',
        lastEvent: lineStats.last_event
      };

      if (successRate < CONFIG.THRESHOLDS.MIN_WEBHOOK_SUCCESS_RATE) {
        addIssue('warning', 'Webhook',
          `Low webhook success rate for ${lineStats.cruise_line_name}: ${successRate.toFixed(2)}%`,
          { lineId, failed: lineStats.failed, total: lineStats.total_events }
        );
      }

      // Check for stuck processing
      if (parseInt(lineStats.processing) > 0) {
        addIssue('warning', 'Webhook',
          `${lineStats.processing} webhooks stuck in processing for ${lineStats.cruise_line_name}`,
          { lineId, processing: lineStats.processing }
        );
      }
    }

    // 1.3 Check webhook event types distribution - FIXED: use received_at
    const eventTypes = await db.execute(sql`
      SELECT
        webhook_type,
        COUNT(*) as count,
        COUNT(DISTINCT line_id) as unique_lines
      FROM webhook_events
      WHERE received_at > NOW() - INTERVAL '24 hours'
      GROUP BY webhook_type
      ORDER BY count DESC
    `);

    test.details.eventTypes = eventTypes.map(e => ({
      type: e.webhook_type,
      count: parseInt(e.count),
      uniqueLines: parseInt(e.unique_lines)
    }));

    // 1.4 Check for webhook failures patterns - FIXED: use received_at
    const failurePatterns = await db.execute(sql`
      SELECT
        line_id,
        DATE(received_at) as date,
        COUNT(*) as failures,
        metadata->>'error' as error_message
      FROM webhook_events
      WHERE status = 'failed'
        AND received_at > NOW() - INTERVAL '7 days'
      GROUP BY line_id, DATE(received_at), metadata->>'error'
      HAVING COUNT(*) > 5
      ORDER BY failures DESC
      LIMIT 20
    `);

    if (failurePatterns.length > 0) {
      test.details.failurePatterns = failurePatterns.map(f => ({
        lineId: f.line_id,
        date: f.date,
        failures: parseInt(f.failures),
        error: f.error_message?.substring(0, 100)
      }));

      addIssue('warning', 'Webhook',
        `Found ${failurePatterns.length} recurring failure patterns`,
        test.details.failurePatterns
      );
    }

    test.status = test.details.webhookStats.totalFailed > test.details.webhookStats.totalCompleted
      ? 'FAILED' : 'PASSED';

    log(`  Total events (7d): ${test.details.webhookStats.totalEvents7d}`, 'info');
    log(`  Success rate: ${(test.details.webhookStats.totalCompleted / test.details.webhookStats.totalEvents7d * 100).toFixed(2)}%`,
        test.status === 'PASSED' ? 'success' : 'error');

  } catch (error) {
    test.status = 'FAILED';
    test.error = error.message;
    addIssue('critical', 'Webhook', `Webhook test crashed: ${error.message}`);
  }

  results.tests.webhookPipeline = test;
  results.summary.totalChecks++;
  if (test.status === 'PASSED') results.summary.passed++;
  else results.summary.failed++;

  return test.status === 'PASSED';
}

// ========================================
// TEST 2: DATABASE INTEGRITY & CONSTRAINTS
// ========================================
async function testDatabaseIntegrity() {
  log('TEST 2: DATABASE INTEGRITY & CONSTRAINTS', 'section');
  const test = { name: 'Database Integrity', status: 'RUNNING', details: {} };

  try {
    // 2.1 Check cruises table integrity
    const cruiseIntegrity = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(DISTINCT id) as unique_ids,
        COUNT(CASE WHEN cruise_line_id IS NULL THEN 1 END) as null_cruise_line,
        COUNT(CASE WHEN ship_id IS NULL THEN 1 END) as null_ship,
        COUNT(CASE WHEN sailing_date IS NULL THEN 1 END) as null_sailing,
        COUNT(CASE WHEN raw_data IS NULL OR raw_data::text = '{}' THEN 1 END) as no_raw_data,
        COUNT(CASE WHEN
          interior_price IS NULL AND
          oceanview_price IS NULL AND
          balcony_price IS NULL AND
          suite_price IS NULL
        THEN 1 END) as no_prices_at_all
      FROM cruises
      WHERE is_active = true
    `);

    test.details.cruiseIntegrity = {
      totalCruises: parseInt(cruiseIntegrity[0].total),
      uniqueIds: parseInt(cruiseIntegrity[0].unique_ids),
      nullCruiseLine: parseInt(cruiseIntegrity[0].null_cruise_line),
      nullShip: parseInt(cruiseIntegrity[0].null_ship),
      nullSailing: parseInt(cruiseIntegrity[0].null_sailing),
      noRawData: parseInt(cruiseIntegrity[0].no_raw_data),
      noPricesAtAll: parseInt(cruiseIntegrity[0].no_prices_at_all)
    };

    // Check for ID collisions
    if (test.details.cruiseIntegrity.totalCruises !== test.details.cruiseIntegrity.uniqueIds) {
      addIssue('critical', 'Database',
        `Duplicate cruise IDs detected! ${test.details.cruiseIntegrity.totalCruises - test.details.cruiseIntegrity.uniqueIds} duplicates`
      );
    }

    // Check for missing critical data
    if (test.details.cruiseIntegrity.nullCruiseLine > 0) {
      addIssue('error', 'Database',
        `${test.details.cruiseIntegrity.nullCruiseLine} cruises missing cruise_line_id`
      );
    }

    // 2.2 Check foreign key relationships
    const fkCheck = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN cl.id IS NULL THEN 1 END) as invalid_cruise_line,
        COUNT(CASE WHEN s.id IS NULL THEN 1 END) as invalid_ship,
        COUNT(CASE WHEN ep.id IS NULL AND c.embarkation_port_id IS NOT NULL THEN 1 END) as invalid_embark_port,
        COUNT(CASE WHEN dp.id IS NULL AND c.disembarkation_port_id IS NOT NULL THEN 1 END) as invalid_disembark_port
      FROM cruises c
      LEFT JOIN cruise_lines cl ON cl.id = c.cruise_line_id
      LEFT JOIN ships s ON s.id = c.ship_id
      LEFT JOIN ports ep ON ep.id = c.embarkation_port_id
      LEFT JOIN ports dp ON dp.id = c.disembarkation_port_id
      WHERE c.is_active = true
    `);

    test.details.foreignKeys = {
      invalidCruiseLine: parseInt(fkCheck[0].invalid_cruise_line),
      invalidShip: parseInt(fkCheck[0].invalid_ship),
      invalidEmbarkPort: parseInt(fkCheck[0].invalid_embark_port),
      invalidDisembarkPort: parseInt(fkCheck[0].invalid_disembark_port)
    };

    const fkIssues = Object.entries(test.details.foreignKeys)
      .filter(([key, value]) => value > 0);

    if (fkIssues.length > 0) {
      addIssue('error', 'Database',
        `Foreign key violations detected`,
        Object.fromEntries(fkIssues)
      );
    }

    // 2.3 Check cheapest_pricing table consistency
    const cheapestPricingCheck = await db.execute(sql`
      SELECT
        COUNT(DISTINCT cp.cruise_id) as cruises_with_cheapest,
        COUNT(DISTINCT c.id) as total_active_cruises,
        COUNT(CASE WHEN cp.cruise_id IS NULL THEN 1 END) as missing_cheapest_pricing
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON cp.cruise_id = c.id
      WHERE c.is_active = true
        AND c.sailing_date >= CURRENT_DATE
    `);

    test.details.cheapestPricingCoverage = {
      cruisesWithCheapest: parseInt(cheapestPricingCheck[0].cruises_with_cheapest),
      totalActiveCruises: parseInt(cheapestPricingCheck[0].total_active_cruises),
      coverage: ((parseInt(cheapestPricingCheck[0].cruises_with_cheapest) /
                 parseInt(cheapestPricingCheck[0].total_active_cruises)) * 100).toFixed(2) + '%'
    };

    // 2.4 Check for data type issues in price fields
    const priceTypeCheck = await db.execute(sql`
      SELECT
        COUNT(CASE WHEN interior_price < 0 THEN 1 END) as negative_interior,
        COUNT(CASE WHEN oceanview_price < 0 THEN 1 END) as negative_oceanview,
        COUNT(CASE WHEN balcony_price < 0 THEN 1 END) as negative_balcony,
        COUNT(CASE WHEN suite_price < 0 THEN 1 END) as negative_suite,
        COUNT(CASE WHEN interior_price > 100000 THEN 1 END) as excessive_interior,
        COUNT(CASE WHEN oceanview_price > 100000 THEN 1 END) as excessive_oceanview,
        COUNT(CASE WHEN balcony_price > 100000 THEN 1 END) as excessive_balcony,
        COUNT(CASE WHEN suite_price > 100000 THEN 1 END) as excessive_suite
      FROM cruises
      WHERE is_active = true
    `);

    test.details.priceValidation = {
      negativeValues: Object.entries(priceTypeCheck[0])
        .filter(([k, v]) => k.startsWith('negative'))
        .reduce((sum, [k, v]) => sum + parseInt(v), 0),
      excessiveValues: Object.entries(priceTypeCheck[0])
        .filter(([k, v]) => k.startsWith('excessive'))
        .reduce((sum, [k, v]) => sum + parseInt(v), 0)
    };

    if (test.details.priceValidation.negativeValues > 0) {
      addIssue('critical', 'Database',
        `Found ${test.details.priceValidation.negativeValues} negative price values!`
      );
    }

    if (test.details.priceValidation.excessiveValues > 0) {
      addIssue('warning', 'Database',
        `Found ${test.details.priceValidation.excessiveValues} excessive price values (>$100,000)`
      );
    }

    // 2.5 Check trigger functionality
    const triggerCheck = await db.execute(sql`
      SELECT
        trigger_name,
        event_manipulation,
        event_object_table,
        action_timing
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
        AND event_object_table IN ('cruises', 'cheapest_pricing')
    `);

    test.details.triggers = {
      count: triggerCheck.length,
      list: triggerCheck.map(t => t.trigger_name)
    };

    test.status = (test.details.cruiseIntegrity.nullCruiseLine === 0 &&
                  test.details.priceValidation.negativeValues === 0) ? 'PASSED' : 'FAILED';

    log(`  Total active cruises: ${test.details.cruiseIntegrity.totalCruises}`, 'info');
    log(`  Data integrity: ${test.status}`, test.status === 'PASSED' ? 'success' : 'error');

  } catch (error) {
    test.status = 'FAILED';
    test.error = error.message;
    addIssue('critical', 'Database', `Database integrity test crashed: ${error.message}`);
  }

  results.tests.databaseIntegrity = test;
  results.summary.totalChecks++;
  if (test.status === 'PASSED') results.summary.passed++;
  else results.summary.failed++;

  return test.status === 'PASSED';
}

// ========================================
// TEST 3: PRICE EXTRACTION VALIDATION
// ========================================
async function testPriceExtraction() {
  log('TEST 3: PRICE EXTRACTION VALIDATION', 'section');
  const test = { name: 'Price Extraction', status: 'RUNNING', details: {} };

  try {
    // 3.1 Get sample of cruises with raw_data to validate extraction - FIXED column names
    const sampleCruises = await db.execute(sql`
      SELECT
        c.id,
        c.cruise_line_id,
        cl.name as cruise_line_name,
        c.interior_price,
        c.oceanview_price,
        c.balcony_price,
        c.suite_price,
        c.cheapest_price,
        c.raw_data,
        cp.interior_price as cp_interior,
        cp.oceanview_price as cp_oceanview,
        cp.balcony_price as cp_balcony,
        cp.suite_price as cp_suite
      FROM cruises c
      LEFT JOIN cruise_lines cl ON cl.id = c.cruise_line_id
      LEFT JOIN cheapest_pricing cp ON cp.cruise_id = c.id
      WHERE c.raw_data IS NOT NULL
        AND c.raw_data::text != '{}'
        AND c.is_active = true
      ORDER BY c.updated_at DESC
      LIMIT ${CONFIG.SAMPLES.PRICE_VALIDATION}
    `);

    let correctExtractions = 0;
    let mismatches = [];
    let extractionIssues = {
      missingRawFields: 0,
      wrongFieldExtracted: 0,
      typeMismatch: 0,
      exceedsThreshold: 0
    };

    for (const cruise of sampleCruises) {
      try {
        const rawData = typeof cruise.raw_data === 'string'
          ? JSON.parse(cruise.raw_data)
          : cruise.raw_data;

        // Extract expected prices from raw data
        // Based on webhook-processor-optimized-v2.service.ts extraction logic
        const extractPrice = (value) => {
          if (!value) return null;
          if (typeof value === 'string' || typeof value === 'number') {
            const parsed = parseFloat(value);
            return isNaN(parsed) ? null : parsed;
          }
          if (value.price !== undefined) {
            const parsed = parseFloat(value.price);
            return isNaN(parsed) ? null : parsed;
          }
          if (value.value !== undefined) {
            const parsed = parseFloat(value.value);
            return isNaN(parsed) ? null : parsed;
          }
          return null;
        };

        // Check for correct fields in raw data
        const expectedFields = {
          interior: extractPrice(rawData.cheapestinside || rawData.cheapestinterior),
          oceanview: extractPrice(rawData.cheapestoutside || rawData.cheapestoceanview),
          balcony: extractPrice(rawData.cheapestbalcony),
          suite: extractPrice(rawData.cheapestsuite)
        };

        const actualFields = {
          interior: parseFloat(cruise.interior_price) || null,
          oceanview: parseFloat(cruise.oceanview_price) || null,
          balcony: parseFloat(cruise.balcony_price) || null,
          suite: parseFloat(cruise.suite_price) || null
        };

        // Validate extraction accuracy
        let cruiseCorrect = true;
        const cruiseMismatches = [];

        for (const [field, expected] of Object.entries(expectedFields)) {
          const actual = actualFields[field];

          // Both null is OK
          if (expected === null && actual === null) continue;

          // One null, other not = mismatch
          if ((expected === null) !== (actual === null)) {
            cruiseCorrect = false;
            cruiseMismatches.push({
              field,
              expected,
              actual,
              issue: 'null_mismatch'
            });
            extractionIssues.missingRawFields++;
            continue;
          }

          // Check value difference
          if (expected !== null && actual !== null) {
            const diff = Math.abs(expected - actual);
            if (diff > CONFIG.THRESHOLDS.MAX_PRICE_MISMATCH) {
              cruiseCorrect = false;
              cruiseMismatches.push({
                field,
                expected,
                actual,
                difference: diff,
                issue: 'value_mismatch'
              });

              if (diff > 100) {
                extractionIssues.wrongFieldExtracted++;
              } else {
                extractionIssues.exceedsThreshold++;
              }
            }
          }
        }

        if (cruiseCorrect) {
          correctExtractions++;
        } else {
          mismatches.push({
            cruiseId: cruise.id,
            cruiseLine: cruise.cruise_line_name,
            issues: cruiseMismatches
          });
        }

        // Check cheapest_price calculation
        const validPrices = Object.values(actualFields).filter(p => p !== null && p > 0);
        const expectedCheapest = validPrices.length > 0 ? Math.min(...validPrices) : null;
        const actualCheapest = parseFloat(cruise.cheapest_price) || null;

        if (expectedCheapest !== null && actualCheapest !== null) {
          const cheapestDiff = Math.abs(expectedCheapest - actualCheapest);
          if (cheapestDiff > CONFIG.THRESHOLDS.MAX_PRICE_MISMATCH) {
            extractionIssues.typeMismatch++;
          }
        }

      } catch (parseError) {
        extractionIssues.typeMismatch++;
      }
    }

    test.details.extraction = {
      totalSampled: sampleCruises.length,
      correctExtractions,
      accuracy: sampleCruises.length > 0
        ? (correctExtractions / sampleCruises.length * 100).toFixed(2) + '%'
        : 'N/A',
      issues: extractionIssues,
      mismatchCount: mismatches.length
    };

    // Store sample mismatches for debugging
    if (mismatches.length > 0) {
      test.details.sampleMismatches = mismatches.slice(0, 10);

      if (mismatches.length > sampleCruises.length * 0.1) {
        addIssue('error', 'Price Extraction',
          `High price extraction error rate: ${test.details.extraction.accuracy}`,
          { total: sampleCruises.length, mismatches: mismatches.length }
        );
      } else {
        addIssue('warning', 'Price Extraction',
          `${mismatches.length} price extraction mismatches found`,
          test.details.sampleMismatches
        );
      }
    }

    // 3.2 Check price consistency between tables - FIXED column names
    const priceConsistency = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(CASE
          WHEN ABS(COALESCE(c.interior_price, 0) - COALESCE(cp.interior_price, 0)) > 0.01
          THEN 1
        END) as interior_mismatch,
        COUNT(CASE
          WHEN ABS(COALESCE(c.oceanview_price, 0) - COALESCE(cp.oceanview_price, 0)) > 0.01
          THEN 1
        END) as oceanview_mismatch,
        COUNT(CASE
          WHEN ABS(COALESCE(c.balcony_price, 0) - COALESCE(cp.balcony_price, 0)) > 0.01
          THEN 1
        END) as balcony_mismatch,
        COUNT(CASE
          WHEN ABS(COALESCE(c.suite_price, 0) - COALESCE(cp.suite_price, 0)) > 0.01
          THEN 1
        END) as suite_mismatch
      FROM cruises c
      INNER JOIN cheapest_pricing cp ON cp.cruise_id = c.id
      WHERE c.is_active = true
        AND c.sailing_date >= CURRENT_DATE
      LIMIT ${CONFIG.SAMPLES.CONSISTENCY_CHECKS}
    `);

    test.details.tableConsistency = {
      totalChecked: parseInt(priceConsistency[0].total),
      interiorMismatch: parseInt(priceConsistency[0].interior_mismatch),
      oceanviewMismatch: parseInt(priceConsistency[0].oceanview_mismatch),
      balconyMismatch: parseInt(priceConsistency[0].balcony_mismatch),
      suiteMismatch: parseInt(priceConsistency[0].suite_mismatch)
    };

    const totalMismatches = Object.values(test.details.tableConsistency)
      .filter((v, i) => i > 0)
      .reduce((sum, v) => sum + v, 0);

    if (totalMismatches > 0) {
      addIssue('error', 'Price Extraction',
        `Price mismatches between cruises and cheapest_pricing tables`,
        test.details.tableConsistency
      );
    }

    test.status = correctExtractions >= sampleCruises.length * 0.9 ? 'PASSED' : 'FAILED';

    log(`  Samples tested: ${sampleCruises.length}`, 'info');
    log(`  Extraction accuracy: ${test.details.extraction.accuracy}`,
        parseFloat(test.details.extraction.accuracy) >= 90 ? 'success' : 'error');

  } catch (error) {
    test.status = 'FAILED';
    test.error = error.message;
    addIssue('critical', 'Price Extraction', `Price extraction test crashed: ${error.message}`);
  }

  results.tests.priceExtraction = test;
  results.summary.totalChecks++;
  if (test.status === 'PASSED') results.summary.passed++;
  else results.summary.failed++;

  return test.status === 'PASSED';
}

// ========================================
// TEST 4: DATA FRESHNESS & COVERAGE
// ========================================
async function testDataFreshness() {
  log('TEST 4: DATA FRESHNESS & COVERAGE', 'section');
  const test = { name: 'Data Freshness', status: 'RUNNING', details: {} };

  try {
    // 4.1 Overall data freshness
    const freshness = await db.execute(sql`
      SELECT
        COUNT(*) as total_active,
        COUNT(CASE WHEN updated_at > NOW() - INTERVAL '1 hour' THEN 1 END) as updated_1h,
        COUNT(CASE WHEN updated_at > NOW() - INTERVAL '24 hours' THEN 1 END) as updated_24h,
        COUNT(CASE WHEN updated_at > NOW() - INTERVAL '7 days' THEN 1 END) as updated_7d,
        COUNT(CASE WHEN updated_at > NOW() - INTERVAL '30 days' THEN 1 END) as updated_30d,
        COUNT(CASE WHEN updated_at < NOW() - INTERVAL '30 days' THEN 1 END) as stale_30d,
        MIN(updated_at) as oldest_update,
        MAX(updated_at) as newest_update
      FROM cruises
      WHERE is_active = true
        AND sailing_date >= CURRENT_DATE
    `);

    test.details.overallFreshness = {
      totalActive: parseInt(freshness[0].total_active),
      updatedLastHour: parseInt(freshness[0].updated_1h),
      updatedLast24h: parseInt(freshness[0].updated_24h),
      updatedLast7d: parseInt(freshness[0].updated_7d),
      updatedLast30d: parseInt(freshness[0].updated_30d),
      staleOver30d: parseInt(freshness[0].stale_30d),
      percentFresh24h: (parseInt(freshness[0].updated_24h) / parseInt(freshness[0].total_active) * 100).toFixed(2) + '%',
      percentStale: (parseInt(freshness[0].stale_30d) / parseInt(freshness[0].total_active) * 100).toFixed(2) + '%',
      oldestUpdate: freshness[0].oldest_update,
      newestUpdate: freshness[0].newest_update
    };

    // 4.2 Freshness by cruise line
    const linesFreshness = await db.execute(sql`
      SELECT
        cl.id,
        cl.name,
        COUNT(*) as total_cruises,
        COUNT(CASE WHEN c.updated_at > NOW() - INTERVAL '24 hours' THEN 1 END) as updated_24h,
        COUNT(CASE WHEN c.updated_at < NOW() - INTERVAL '30 days' THEN 1 END) as stale_30d,
        MAX(c.updated_at) as last_update,
        MIN(c.sailing_date) as earliest_sailing,
        MAX(c.sailing_date) as latest_sailing
      FROM cruises c
      JOIN cruise_lines cl ON cl.id = c.cruise_line_id
      WHERE c.is_active = true
        AND c.sailing_date >= CURRENT_DATE
      GROUP BY cl.id, cl.name
      ORDER BY total_cruises DESC
    `);

    test.details.linesFreshness = [];
    for (const line of linesFreshness) {
      const percentFresh = (line.updated_24h / line.total_cruises * 100);
      const percentStale = (line.stale_30d / line.total_cruises * 100);

      // FIXED: renamed variable from lineData to lineFreshnessData
      const lineFreshnessData = {
        id: line.id,
        name: line.name,
        totalCruises: parseInt(line.total_cruises),
        updated24h: parseInt(line.updated_24h),
        stale30d: parseInt(line.stale_30d),
        percentFresh: percentFresh.toFixed(2) + '%',
        percentStale: percentStale.toFixed(2) + '%',
        lastUpdate: line.last_update,
        sailingRange: `${line.earliest_sailing} to ${line.latest_sailing}`
      };

      test.details.linesFreshness.push(lineFreshnessData);

      // Update cruise line results
      if (!results.cruiseLines[line.id]) {
        results.cruiseLines[line.id] = {
          id: line.id,
          name: line.name,
          tests: {}
        };
      }
      results.cruiseLines[line.id].freshness = lineFreshnessData;

      // Flag stale lines
      if (percentStale > 50) {
        addIssue('warning', 'Data Freshness',
          `${line.name} has ${percentStale.toFixed(2)}% stale data (>30 days old)`,
          { lineId: line.id, stale: line.stale_30d, total: line.total_cruises }
        );
      }
    }

    // 4.3 Price coverage analysis
    const priceCoverage = await db.execute(sql`
      SELECT
        cl.id,
        cl.name,
        COUNT(*) as total,
        COUNT(CASE WHEN c.interior_price IS NOT NULL THEN 1 END) as has_interior,
        COUNT(CASE WHEN c.oceanview_price IS NOT NULL THEN 1 END) as has_oceanview,
        COUNT(CASE WHEN c.balcony_price IS NOT NULL THEN 1 END) as has_balcony,
        COUNT(CASE WHEN c.suite_price IS NOT NULL THEN 1 END) as has_suite,
        COUNT(CASE WHEN c.cheapest_price IS NOT NULL THEN 1 END) as has_cheapest,
        COUNT(CASE WHEN
          c.interior_price IS NOT NULL OR
          c.oceanview_price IS NOT NULL OR
          c.balcony_price IS NOT NULL OR
          c.suite_price IS NOT NULL
        THEN 1 END) as has_any_price
      FROM cruises c
      JOIN cruise_lines cl ON cl.id = c.cruise_line_id
      WHERE c.is_active = true
        AND c.sailing_date >= CURRENT_DATE
      GROUP BY cl.id, cl.name
      ORDER BY total DESC
    `);

    test.details.priceCoverage = {
      lines: [],
      overallStats: {
        totalCruises: 0,
        withAnyPrice: 0,
        withCheapest: 0
      }
    };

    for (const line of priceCoverage) {
      const anyPriceCoverage = (line.has_any_price / line.total * 100);

      // FIXED: renamed variable from lineData to lineCoverageData
      const lineCoverageData = {
        id: line.id,
        name: line.name,
        total: parseInt(line.total),
        coverage: {
          interior: (line.has_interior / line.total * 100).toFixed(2) + '%',
          oceanview: (line.has_oceanview / line.total * 100).toFixed(2) + '%',
          balcony: (line.has_balcony / line.total * 100).toFixed(2) + '%',
          suite: (line.has_suite / line.total * 100).toFixed(2) + '%',
          cheapest: (line.has_cheapest / line.total * 100).toFixed(2) + '%',
          any: anyPriceCoverage.toFixed(2) + '%'
        }
      };

      test.details.priceCoverage.lines.push(lineCoverageData);
      test.details.priceCoverage.overallStats.totalCruises += parseInt(line.total);
      test.details.priceCoverage.overallStats.withAnyPrice += parseInt(line.has_any_price);
      test.details.priceCoverage.overallStats.withCheapest += parseInt(line.has_cheapest);

      if (!results.cruiseLines[line.id]) {
        results.cruiseLines[line.id] = {
          id: line.id,
          name: line.name,
          tests: {}
        };
      }
      results.cruiseLines[line.id].priceCoverage = lineCoverageData;

      // Flag low coverage
      if (anyPriceCoverage < CONFIG.THRESHOLDS.MIN_PRICE_COVERAGE) {
        addIssue('warning', 'Data Coverage',
          `${line.name} has low price coverage: ${anyPriceCoverage.toFixed(2)}%`,
          { lineId: line.id, withPrice: line.has_any_price, total: line.total }
        );
      }
    }

    // 4.4 Check sailing date coverage
    const sailingCoverage = await db.execute(sql`
      SELECT
        DATE_TRUNC('month', sailing_date) as month,
        COUNT(*) as cruise_count,
        COUNT(DISTINCT cruise_line_id) as lines_count
      FROM cruises
      WHERE is_active = true
        AND sailing_date >= CURRENT_DATE
        AND sailing_date <= CURRENT_DATE + INTERVAL '24 months'
      GROUP BY DATE_TRUNC('month', sailing_date)
      ORDER BY month
    `);

    test.details.sailingCoverage = {
      months: sailingCoverage.length,
      totalFutureCruises: sailingCoverage.reduce((sum, m) => sum + parseInt(m.cruise_count), 0),
      averageLinesPerMonth: (sailingCoverage.reduce((sum, m) => sum + parseInt(m.lines_count), 0) / sailingCoverage.length).toFixed(1)
    };

    // Check for gaps in coverage
    const currentMonth = new Date();
    let expectedMonth = new Date(currentMonth);
    const gaps = [];

    for (const monthData of sailingCoverage) {
      const dataMonth = new Date(monthData.month);
      while (expectedMonth < dataMonth) {
        gaps.push(expectedMonth.toISOString().substring(0, 7));
        expectedMonth.setMonth(expectedMonth.getMonth() + 1);
      }
      expectedMonth.setMonth(expectedMonth.getMonth() + 1);
    }

    if (gaps.length > 0) {
      test.details.coverageGaps = gaps;
      addIssue('warning', 'Data Coverage',
        `Missing cruise data for ${gaps.length} months`,
        { gaps: gaps.slice(0, 5) }
      );
    }

    const stalePercent = parseFloat(test.details.overallFreshness.percentStale);
    test.status = stalePercent <= CONFIG.THRESHOLDS.MAX_STALE_DATA_PERCENT ? 'PASSED' : 'FAILED';

    log(`  Active cruises: ${test.details.overallFreshness.totalActive}`, 'info');
    log(`  Fresh (24h): ${test.details.overallFreshness.percentFresh24h}`, 'info');
    log(`  Stale (>30d): ${test.details.overallFreshness.percentStale}`,
        stalePercent <= CONFIG.THRESHOLDS.MAX_STALE_DATA_PERCENT ? 'success' : 'error');

  } catch (error) {
    test.status = 'FAILED';
    test.error = error.message;
    addIssue('critical', 'Data Freshness', `Data freshness test crashed: ${error.message}`);
  }

  results.tests.dataFreshness = test;
  results.summary.totalChecks++;
  if (test.status === 'PASSED') results.summary.passed++;
  else results.summary.failed++;

  return test.status === 'PASSED';
}

// ========================================
// TEST 5: API DATA ACCURACY
// ========================================
async function testAPIAccuracy() {
  log('TEST 5: API DATA ACCURACY', 'section');
  const test = { name: 'API Accuracy', status: 'RUNNING', details: {} };

  try {
    // Use native https for API calls
    const https = require('https');

    function apiCall(endpoint) {
      return new Promise((resolve, reject) => {
        https.get(CONFIG.API_URL + endpoint, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              resolve({
                status: res.statusCode,
                data: JSON.parse(data)
              });
            } catch (e) {
              reject(new Error(`Failed to parse API response: ${e.message}`));
            }
          });
        }).on('error', reject);
      });
    }

    // 5.1 Test search endpoint
    log('  Testing search endpoint...', 'info');
    const searchResponse = await apiCall('/api/v1/search/cruises?limit=50');

    if (searchResponse.status !== 200) {
      addIssue('error', 'API',
        `Search API returned status ${searchResponse.status}`
      );
      test.status = 'FAILED';
      return false;
    }

    const searchCruises = searchResponse.data.cruises || searchResponse.data.data || [];
    test.details.searchEndpoint = {
      cruisesReturned: searchCruises.length,
      withPrices: searchCruises.filter(c => c.price !== null && c.price !== undefined).length
    };

    // 5.2 Test detail endpoints and compare with database
    const apiDbComparisons = [];
    const detailTests = Math.min(searchCruises.length, CONFIG.SAMPLES.API_TESTS);

    for (let i = 0; i < detailTests; i++) {
      const cruise = searchCruises[i];

      try {
        // Get from API
        const detailResponse = await apiCall(`/api/v1/cruises/${cruise.id}`);
        const apiData = detailResponse.data.data || detailResponse.data;

        // Get from database
        const [dbData] = await db.execute(sql`
          SELECT
            id,
            name,
            sailing_date,
            nights,
            interior_price,
            oceanview_price,
            balcony_price,
            suite_price,
            cheapest_price
          FROM cruises
          WHERE id = ${cruise.id}
        `);

        if (!dbData) {
          addIssue('error', 'API',
            `Cruise ${cruise.id} exists in API but not in database`
          );
          continue;
        }

        // Compare prices
        const comparison = {
          id: cruise.id,
          matches: true,
          issues: []
        };

        const priceFields = [
          { api: 'interiorPrice', db: 'interior_price' },
          { api: 'oceanviewPrice', db: 'oceanview_price' },
          { api: 'balconyPrice', db: 'balcony_price' },
          { api: 'suitePrice', db: 'suite_price' },
          { api: 'cheapestPrice', db: 'cheapest_price' }
        ];

        for (const field of priceFields) {
          const apiValue = parseFloat(apiData[field.api]) || null;
          const dbValue = parseFloat(dbData[field.db]) || null;

          if (apiValue === null && dbValue === null) continue;

          if ((apiValue === null) !== (dbValue === null)) {
            comparison.matches = false;
            comparison.issues.push({
              field: field.api,
              api: apiValue,
              db: dbValue,
              issue: 'null_mismatch'
            });
          } else if (apiValue !== null && dbValue !== null) {
            const diff = Math.abs(apiValue - dbValue);
            if (diff > CONFIG.THRESHOLDS.MAX_PRICE_MISMATCH) {
              comparison.matches = false;
              comparison.issues.push({
                field: field.api,
                api: apiValue,
                db: dbValue,
                difference: diff,
                issue: 'value_mismatch'
              });
            }
          }
        }

        apiDbComparisons.push(comparison);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 50));

      } catch (detailError) {
        addIssue('warning', 'API',
          `Failed to test cruise ${cruise.id}: ${detailError.message}`
        );
      }
    }

    const matchingCount = apiDbComparisons.filter(c => c.matches).length;
    const accuracy = apiDbComparisons.length > 0
      ? (matchingCount / apiDbComparisons.length * 100)
      : 0;

    test.details.apiDbConsistency = {
      tested: apiDbComparisons.length,
      matching: matchingCount,
      mismatches: apiDbComparisons.length - matchingCount,
      accuracy: accuracy.toFixed(2) + '%',
      sampleIssues: apiDbComparisons
        .filter(c => !c.matches)
        .slice(0, 5)
        .map(c => ({ id: c.id, issues: c.issues }))
    };

    if (accuracy < CONFIG.THRESHOLDS.MIN_API_CONSISTENCY) {
      addIssue('error', 'API',
        `API/Database consistency below threshold: ${accuracy.toFixed(2)}%`,
        test.details.apiDbConsistency
      );
    }

    // 5.3 Test API response times
    const responseTimes = [];
    const testStart = Date.now();

    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      await apiCall('/api/v1/search/cruises?limit=1');
      responseTimes.push(Date.now() - start);
    }

    test.details.performance = {
      avgResponseTime: (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(0) + 'ms',
      minResponseTime: Math.min(...responseTimes) + 'ms',
      maxResponseTime: Math.max(...responseTimes) + 'ms'
    };

    test.status = accuracy >= CONFIG.THRESHOLDS.MIN_API_CONSISTENCY ? 'PASSED' : 'FAILED';

    log(`  API tests: ${apiDbComparisons.length}`, 'info');
    log(`  API/DB consistency: ${test.details.apiDbConsistency.accuracy}`,
        accuracy >= CONFIG.THRESHOLDS.MIN_API_CONSISTENCY ? 'success' : 'error');

  } catch (error) {
    test.status = 'FAILED';
    test.error = error.message;
    addIssue('critical', 'API', `API accuracy test crashed: ${error.message}`);
  }

  results.tests.apiAccuracy = test;
  results.summary.totalChecks++;
  if (test.status === 'PASSED') results.summary.passed++;
  else results.summary.failed++;

  return test.status === 'PASSED';
}

// ========================================
// TEST 6: COMPREHENSIVE DATA VALIDATION
// ========================================
async function testComprehensiveValidation() {
  log('TEST 6: COMPREHENSIVE DATA VALIDATION', 'section');
  const test = { name: 'Comprehensive Validation', status: 'RUNNING', details: {} };

  try {
    // 6.1 Check for corrupted raw_data
    const corruptedCheck = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(CASE
          WHEN raw_data::text LIKE '[%' THEN 1
        END) as starts_with_bracket,
        COUNT(CASE
          WHEN raw_data::text LIKE '"%' AND raw_data::text NOT LIKE '{%' THEN 1
        END) as character_by_character,
        COUNT(CASE
          WHEN LENGTH(raw_data::text) < 100 AND raw_data::text != '{}' THEN 1
        END) as suspiciously_short,
        COUNT(CASE
          WHEN raw_data IS NULL OR raw_data::text = '{}' THEN 1
        END) as empty_raw_data
      FROM cruises
      WHERE is_active = true
    `);

    test.details.rawDataIntegrity = {
      total: parseInt(corruptedCheck[0].total),
      corruptedTypes: {
        startsWithBracket: parseInt(corruptedCheck[0].starts_with_bracket),
        characterByCharacter: parseInt(corruptedCheck[0].character_by_character),
        suspiciouslyShort: parseInt(corruptedCheck[0].suspiciously_short),
        empty: parseInt(corruptedCheck[0].empty_raw_data)
      },
      totalCorrupted: parseInt(corruptedCheck[0].starts_with_bracket) +
                     parseInt(corruptedCheck[0].character_by_character) +
                     parseInt(corruptedCheck[0].suspiciously_short)
    };

    if (test.details.rawDataIntegrity.totalCorrupted > 0) {
      addIssue('critical', 'Data Integrity',
        `Found ${test.details.rawDataIntegrity.totalCorrupted} corrupted raw_data entries!`,
        test.details.rawDataIntegrity.corruptedTypes
      );
    }

    // 6.2 Check for price anomalies
    const priceAnomalies = await db.execute(sql`
      SELECT
        c.id,
        c.name,
        cl.name as cruise_line,
        c.interior_price,
        c.oceanview_price,
        c.balcony_price,
        c.suite_price,
        c.nights
      FROM cruises c
      JOIN cruise_lines cl ON cl.id = c.cruise_line_id
      WHERE c.is_active = true
        AND c.sailing_date >= CURRENT_DATE
        AND (
          -- Interior more expensive than oceanview
          (c.interior_price > c.oceanview_price AND c.oceanview_price IS NOT NULL)
          -- Oceanview more expensive than balcony
          OR (c.oceanview_price > c.balcony_price AND c.balcony_price IS NOT NULL)
          -- Balcony more expensive than suite
          OR (c.balcony_price > c.suite_price AND c.suite_price IS NOT NULL)
          -- Price per night over $5000
          OR (c.interior_price / NULLIF(c.nights, 0) > 5000)
          -- Price per night under $10
          OR (c.interior_price / NULLIF(c.nights, 0) < 10 AND c.interior_price IS NOT NULL)
        )
      LIMIT 50
    `);

    test.details.priceAnomalies = {
      count: priceAnomalies.length,
      samples: priceAnomalies.slice(0, 5).map(a => ({
        id: a.id,
        name: a.name,
        cruiseLine: a.cruise_line,
        prices: {
          interior: a.interior_price,
          oceanview: a.oceanview_price,
          balcony: a.balcony_price,
          suite: a.suite_price
        },
        pricePerNight: a.interior_price && a.nights
          ? (parseFloat(a.interior_price) / parseInt(a.nights)).toFixed(2)
          : 'N/A'
      }))
    };

    if (priceAnomalies.length > 0) {
      addIssue('warning', 'Price Validation',
        `Found ${priceAnomalies.length} cruises with illogical price hierarchies`,
        test.details.priceAnomalies.samples
      );
    }

    // 6.3 Check for duplicate cruises
    const duplicateCheck = await db.execute(sql`
      SELECT
        cruise_line_id,
        ship_id,
        sailing_date,
        nights,
        COUNT(*) as duplicate_count,
        STRING_AGG(id::text, ', ') as cruise_ids
      FROM cruises
      WHERE is_active = true
      GROUP BY cruise_line_id, ship_id, sailing_date, nights
      HAVING COUNT(*) > 1
      LIMIT 20
    `);

    test.details.duplicates = {
      groups: duplicateCheck.length,
      totalDuplicates: duplicateCheck.reduce((sum, d) => sum + parseInt(d.duplicate_count) - 1, 0)
    };

    if (duplicateCheck.length > 0) {
      test.details.duplicateSamples = duplicateCheck.slice(0, 5).map(d => ({
        cruiseLineId: d.cruise_line_id,
        shipId: d.ship_id,
        sailingDate: d.sailing_date,
        count: parseInt(d.duplicate_count),
        ids: d.cruise_ids
      }));

      addIssue('error', 'Data Integrity',
        `Found ${test.details.duplicates.totalDuplicates} duplicate cruises in ${test.details.duplicates.groups} groups`,
        test.details.duplicateSamples
      );
    }

    // 6.4 Verify trigger calculations
    const triggerValidation = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(CASE
          WHEN c.cheapest_price != LEAST(
            NULLIF(c.interior_price, 0),
            NULLIF(c.oceanview_price, 0),
            NULLIF(c.balcony_price, 0),
            NULLIF(c.suite_price, 0)
          ) THEN 1
        END) as incorrect_cheapest
      FROM cruises c
      WHERE c.is_active = true
        AND (c.interior_price IS NOT NULL
          OR c.oceanview_price IS NOT NULL
          OR c.balcony_price IS NOT NULL
          OR c.suite_price IS NOT NULL)
    `);

    test.details.triggerValidation = {
      totalWithPrices: parseInt(triggerValidation[0].total),
      incorrectCheapest: parseInt(triggerValidation[0].incorrect_cheapest)
    };

    if (test.details.triggerValidation.incorrectCheapest > 0) {
      addIssue('error', 'Data Integrity',
        `${test.details.triggerValidation.incorrectCheapest} cruises have incorrect cheapest_price calculation`
      );
    }

    // 6.5 Check webhook to cruise update correlation - FIXED: use received_at
    const updateCorrelation = await db.execute(sql`
      WITH recent_webhooks AS (
        SELECT
          line_id,
          DATE(received_at) as webhook_date,
          COUNT(*) as webhook_count
        FROM webhook_events
        WHERE received_at > NOW() - INTERVAL '7 days'
          AND status = 'completed'
        GROUP BY line_id, DATE(received_at)
      ),
      recent_updates AS (
        SELECT
          cruise_line_id,
          DATE(updated_at) as update_date,
          COUNT(*) as updated_cruises
        FROM cruises
        WHERE updated_at > NOW() - INTERVAL '7 days'
        GROUP BY cruise_line_id, DATE(updated_at)
      )
      SELECT
        rw.line_id,
        rw.webhook_date,
        rw.webhook_count,
        ru.updated_cruises,
        cl.name as cruise_line_name
      FROM recent_webhooks rw
      LEFT JOIN recent_updates ru
        ON ru.cruise_line_id = rw.line_id
        AND ru.update_date = rw.webhook_date
      LEFT JOIN cruise_lines cl ON cl.id = rw.line_id
      WHERE ru.updated_cruises IS NULL OR ru.updated_cruises = 0
      ORDER BY rw.webhook_date DESC, rw.webhook_count DESC
      LIMIT 20
    `);

    test.details.webhookUpdateCorrelation = {
      webhooksWithoutUpdates: updateCorrelation.length
    };

    if (updateCorrelation.length > 0) {
      test.details.noUpdateSamples = updateCorrelation.slice(0, 5).map(c => ({
        lineId: c.line_id,
        lineName: c.cruise_line_name,
        date: c.webhook_date,
        webhooks: parseInt(c.webhook_count),
        updates: parseInt(c.updated_cruises) || 0
      }));

      addIssue('warning', 'Pipeline Flow',
        `${updateCorrelation.length} cases where webhooks didn't result in cruise updates`,
        test.details.noUpdateSamples
      );
    }

    test.status = (test.details.rawDataIntegrity.totalCorrupted === 0 &&
                  test.details.triggerValidation.incorrectCheapest === 0 &&
                  test.details.duplicates.totalDuplicates === 0) ? 'PASSED' : 'FAILED';

    log(`  Data integrity checks: ${test.status}`,
        test.status === 'PASSED' ? 'success' : 'error');

  } catch (error) {
    test.status = 'FAILED';
    test.error = error.message;
    addIssue('critical', 'Comprehensive', `Comprehensive validation crashed: ${error.message}`);
  }

  results.tests.comprehensiveValidation = test;
  results.summary.totalChecks++;
  if (test.status === 'PASSED') results.summary.passed++;
  else results.summary.failed++;

  return test.status === 'PASSED';
}

// ========================================
// RECOMMENDATIONS ENGINE
// ========================================
function generateRecommendations() {
  log('\n📝 GENERATING RECOMMENDATIONS', 'section');

  // Based on issues found, generate actionable recommendations
  const recommendations = [];

  // Critical issues
  if (results.critical.length > 0) {
    recommendations.push({
      priority: 'CRITICAL',
      action: 'Immediate investigation required for critical failures',
      details: results.critical.map(c => c.message)
    });
  }

  // Webhook issues
  const webhookIssues = results.issues.filter(i => i.category === 'Webhook');
  if (webhookIssues.length > 0) {
    recommendations.push({
      priority: 'HIGH',
      action: 'Review webhook processing pipeline',
      steps: [
        'Check Redis/BullMQ worker status',
        'Verify FTP credentials are current',
        'Review webhook processor logs for errors',
        'Consider implementing retry mechanism for failed webhooks'
      ]
    });
  }

  // Data freshness issues
  const freshnessWarnings = results.warnings.filter(w => w.category === 'Data Freshness');
  if (freshnessWarnings.length > 0) {
    recommendations.push({
      priority: 'MEDIUM',
      action: 'Improve data freshness',
      steps: [
        'Schedule more frequent webhook triggers',
        'Implement catch-up sync for stale cruise lines',
        'Review cruise lines with >30 day old data',
        'Consider implementing incremental updates'
      ]
    });
  }

  // Price extraction issues
  const priceIssues = [...results.issues, ...results.warnings]
    .filter(i => i.category === 'Price Extraction');
  if (priceIssues.length > 0) {
    recommendations.push({
      priority: 'HIGH',
      action: 'Fix price extraction logic',
      steps: [
        'Review webhook-processor-optimized-v2.service.ts extraction logic',
        'Validate field mappings (cheapestinside → interior_price)',
        'Fix cruises with mismatched prices',
        'Implement validation checks in extraction pipeline'
      ]
    });
  }

  // Data integrity issues
  const integrityIssues = results.issues.filter(i => i.category === 'Data Integrity');
  if (integrityIssues.length > 0) {
    recommendations.push({
      priority: 'HIGH',
      action: 'Clean up data integrity issues',
      steps: [
        'Remove duplicate cruise entries',
        'Fix corrupted raw_data fields',
        'Recalculate cheapest_price for affected cruises',
        'Implement constraints to prevent future issues'
      ]
    });
  }

  // Performance recommendations
  if (results.tests.apiAccuracy?.details?.performance?.avgResponseTime) {
    const avgTime = parseInt(results.tests.apiAccuracy.details.performance.avgResponseTime);
    if (avgTime > 500) {
      recommendations.push({
        priority: 'LOW',
        action: 'Optimize API performance',
        steps: [
          'Add database indexes for common queries',
          'Implement caching layer',
          'Optimize cruise search queries',
          'Consider pagination limits'
        ]
      });
    }
  }

  results.recommendations = recommendations;

  if (recommendations.length > 0) {
    log(`Generated ${recommendations.length} recommendations`, 'info');
    recommendations.forEach(rec => {
      log(`  [${rec.priority}] ${rec.action}`,
          rec.priority === 'CRITICAL' ? 'critical' :
          rec.priority === 'HIGH' ? 'error' :
          rec.priority === 'MEDIUM' ? 'warning' : 'info');
    });
  }
}

// ========================================
// MAIN EXECUTION
// ========================================
async function runComprehensiveTest() {
  console.log('\n' + '='.repeat(80));
  log('COMPREHENSIVE PRODUCTION DATA PIPELINE TEST - FIXED VERSION', 'title');
  console.log('='.repeat(80));
  log(`Started at: ${new Date().toISOString()}`, 'info');
  log(`Environment: PRODUCTION`, 'info');
  log(`Database: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'Not configured'}`, 'info');
  console.log('='.repeat(80) + '\n');

  if (!process.env.DATABASE_URL) {
    log('FATAL: DATABASE_URL not configured!', 'critical');
    log('Run with: DATABASE_URL=<production_url> node scripts/test-production-comprehensive-fixed.js', 'error');
    process.exit(1);
  }

  const startTime = Date.now();

  try {
    // Run all tests
    await testWebhookPipeline();
    await testDatabaseIntegrity();
    await testPriceExtraction();
    await testDataFreshness();
    await testAPIAccuracy();
    await testComprehensiveValidation();

    // Generate recommendations
    generateRecommendations();

    // Calculate final status
    results.status = results.summary.critical > 0 ? 'CRITICAL_FAILURE' :
                    results.summary.failed > results.summary.passed ? 'FAILED' :
                    results.summary.warnings > 10 ? 'PASSED_WITH_WARNINGS' :
                    'PASSED';

    results.duration = ((Date.now() - startTime) / 1000).toFixed(2) + ' seconds';

    // Print summary
    console.log('\n' + '='.repeat(80));
    log('TEST SUMMARY', 'title');
    console.log('='.repeat(80));

    log(`Duration: ${results.duration}`, 'info');
    log(`Total Checks: ${results.summary.totalChecks}`, 'info');
    log(`Passed: ${results.summary.passed}`, 'success');
    log(`Failed: ${results.summary.failed}`, results.summary.failed > 0 ? 'error' : 'info');
    log(`Warnings: ${results.summary.warnings}`, results.summary.warnings > 0 ? 'warning' : 'info');
    log(`Critical: ${results.summary.critical}`, results.summary.critical > 0 ? 'critical' : 'info');

    // Print test results
    console.log('\n📊 TEST RESULTS:');
    for (const [name, test] of Object.entries(results.tests)) {
      const icon = test.status === 'PASSED' ? '✅' :
                   test.status === 'FAILED' ? '❌' : '⚠️';
      console.log(`  ${icon} ${test.name}: ${test.status}`);
    }

    // Print cruise line summary
    const linesSummary = Object.values(results.cruiseLines)
      .filter(line => line.webhookStats || line.freshness)
      .sort((a, b) => (b.webhookStats?.total || 0) - (a.webhookStats?.total || 0))
      .slice(0, 10);

    if (linesSummary.length > 0) {
      console.log('\n🚢 TOP CRUISE LINES:');
      for (const line of linesSummary) {
        console.log(`  ${line.name}:`);
        if (line.webhookStats) {
          console.log(`    Webhooks: ${line.webhookStats.total} (${line.webhookStats.successRate} success)`);
        }
        if (line.freshness) {
          console.log(`    Freshness: ${line.freshness.percentFresh} fresh, ${line.freshness.totalCruises} cruises`);
        }
      }
    }

    // Save detailed report
    const reportPath = path.join(__dirname, '../test-results');
    await fs.mkdir(reportPath, { recursive: true });
    const reportFile = path.join(reportPath, `comprehensive-test-${Date.now()}.json`);
    await fs.writeFile(reportFile, JSON.stringify(results, null, 2));
    log(`\n📄 Detailed report saved: ${reportFile}`, 'info');

    // Final verdict
    console.log('\n' + '='.repeat(80));
    const statusColors = {
      'PASSED': '\x1b[32m',
      'PASSED_WITH_WARNINGS': '\x1b[33m',
      'FAILED': '\x1b[31m',
      'CRITICAL_FAILURE': '\x1b[91m'
    };
    console.log(`${statusColors[results.status]}🎯 FINAL STATUS: ${results.status}\x1b[0m`);

    if (results.status === 'PASSED') {
      console.log('\x1b[32m✅ Your data pipeline is healthy and trustworthy!\x1b[0m');
    } else if (results.status === 'PASSED_WITH_WARNINGS') {
      console.log('\x1b[33m⚠️ Pipeline is functional but needs attention\x1b[0m');
    } else if (results.status === 'FAILED') {
      console.log('\x1b[31m❌ Pipeline has significant issues that need fixing\x1b[0m');
    } else {
      console.log('\x1b[91m💥 CRITICAL FAILURES DETECTED - IMMEDIATE ACTION REQUIRED\x1b[0m');
    }

    console.log('='.repeat(80) + '\n');

    // Exit with appropriate code
    process.exit(results.status === 'PASSED' ? 0 : 1);

  } catch (fatalError) {
    console.error('\n💥 FATAL ERROR:', fatalError);
    results.status = 'CRASHED';
    results.fatalError = fatalError.message;

    // Try to save whatever we have
    try {
      const reportPath = path.join(__dirname, '../test-results');
      await fs.mkdir(reportPath, { recursive: true });
      const reportFile = path.join(reportPath, `comprehensive-test-crash-${Date.now()}.json`);
      await fs.writeFile(reportFile, JSON.stringify(results, null, 2));
      console.error(`Crash report saved: ${reportFile}`);
    } catch (saveError) {
      console.error('Failed to save crash report:', saveError.message);
    }

    process.exit(2);
  }
}

// Execute if run directly
if (require.main === module) {
  runComprehensiveTest();
}

module.exports = { runComprehensiveTest };
