#!/usr/bin/env node
/**
 * Comprehensive test suite for the new webhook processor
 * Tests different cruise lines and monitors progress
 */

const axios = require('axios');
const { Pool } = require('pg');
require('dotenv').config();

// Configuration
const API_URL = process.env.API_URL || 'https://zipsea-backend.onrender.com';
const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_STAGING;

// Test cruise lines of different sizes
const TEST_LINES = [
  { id: 41, name: 'American Cruise Lines', expectedCruises: 1 },
  { id: 21, name: 'Crystal Cruises', expectedCruises: 5 },
  { id: 14, name: 'Holland America', expectedCruises: 1228 },
  { id: 22, name: 'Royal Caribbean', expectedCruises: 3102 },
  { id: 16, name: 'MSC Cruises', expectedCruises: 5956 }
];

let dbPool;

/**
 * Initialize database connection
 */
async function initDatabase() {
  if (!DATABASE_URL) {
    console.log('⚠️  No database URL found, skipping database checks');
    return false;
  }

  try {
    dbPool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false
    });

    const result = await dbPool.query('SELECT 1');
    console.log('✅ Database connected');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

/**
 * Get cruise statistics for a line
 */
async function getCruiseStats(lineId) {
  if (!dbPool) return null;

  try {
    const result = await dbPool.query(`
      SELECT
        COUNT(*) as total_cruises,
        COUNT(*) FILTER (WHERE sailing_date >= CURRENT_DATE) as future_cruises,
        COUNT(*) FILTER (WHERE last_traveltek_update > NOW() - INTERVAL '1 hour') as recently_updated,
        MIN(sailing_date) as earliest_sailing,
        MAX(sailing_date) as latest_sailing,
        MAX(last_traveltek_update) as last_update
      FROM cruises
      WHERE cruise_line_id = $1
    `, [lineId]);

    return result.rows[0];
  } catch (error) {
    console.error('Error getting cruise stats:', error.message);
    return null;
  }
}

/**
 * Monitor webhook processing progress
 */
async function monitorProgress(lineId, duration = 30000) {
  const startTime = Date.now();
  const checkInterval = 5000; // Check every 5 seconds

  console.log(`\n📊 Monitoring progress for ${duration/1000} seconds...`);

  const monitoring = setInterval(async () => {
    const elapsed = Date.now() - startTime;

    if (elapsed > duration) {
      clearInterval(monitoring);
      console.log('\n✅ Monitoring complete');
      return;
    }

    // Get updated stats
    const stats = await getCruiseStats(lineId);
    if (stats) {
      const progress = Math.round((elapsed / duration) * 100);
      console.log(`[${progress}%] Recently updated: ${stats.recently_updated} cruises | Last update: ${stats.last_update || 'N/A'}`);
    }

    // Check API diagnostics
    try {
      const response = await axios.get(`${API_URL}/api/webhooks/traveltek/diagnostics`);
      if (response.data.diagnostics?.activeLocks > 0) {
        console.log(`   🔒 Active locks: ${response.data.diagnostics.activeLocks}`);
      }
    } catch (error) {
      // Ignore errors
    }
  }, checkInterval);

  return new Promise(resolve => {
    setTimeout(() => {
      clearInterval(monitoring);
      resolve();
    }, duration);
  });
}

/**
 * Test webhook for a specific line
 */
async function testWebhook(lineId, lineName, expectedCruises) {
  console.log('\n' + '='.repeat(60));
  console.log(`🧪 Testing Line ${lineId}: ${lineName}`);
  console.log(`   Expected cruises: ~${expectedCruises}`);
  console.log('='.repeat(60));

  // Get initial stats
  const beforeStats = await getCruiseStats(lineId);
  if (beforeStats) {
    console.log(`\n📈 Before webhook:`);
    console.log(`   Total cruises: ${beforeStats.total_cruises}`);
    console.log(`   Future cruises: ${beforeStats.future_cruises}`);
    console.log(`   Recently updated: ${beforeStats.recently_updated}`);
    console.log(`   Last update: ${beforeStats.last_update || 'Never'}`);
  }

  // Trigger webhook
  console.log(`\n🚀 Triggering webhook...`);
  try {
    const response = await axios.post(
      `${API_URL}/api/webhooks/traveltek/test-comprehensive`,
      { lineId },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );

    if (response.data.success) {
      console.log(`✅ Webhook accepted`);
      console.log(`   Webhook ID: ${response.data.webhookId}`);
      console.log(`   Processor: ${response.data.processor}`);
    } else {
      console.log(`❌ Webhook rejected:`, response.data.message);
      return;
    }
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.log(`⏱️  Request timed out (expected for async processing)`);
    } else {
      console.error(`❌ Error:`, error.message);
      return;
    }
  }

  // Monitor progress
  const monitorDuration = expectedCruises > 1000 ? 60000 : 30000; // 1 min for large, 30s for small
  await monitorProgress(lineId, monitorDuration);

  // Get final stats
  const afterStats = await getCruiseStats(lineId);
  if (afterStats && beforeStats) {
    console.log(`\n📈 After webhook:`);
    console.log(`   Total cruises: ${afterStats.total_cruises}`);
    console.log(`   Recently updated: ${afterStats.recently_updated}`);
    console.log(`   Last update: ${afterStats.last_update || 'Never'}`);

    const updatedCount = afterStats.recently_updated - beforeStats.recently_updated;
    const successRate = afterStats.future_cruises > 0
      ? Math.round((updatedCount / afterStats.future_cruises) * 100)
      : 0;

    console.log(`\n🎯 Results:`);
    console.log(`   Cruises updated: ${updatedCount}`);
    console.log(`   Success rate: ${successRate}%`);

    if (updatedCount === 0) {
      console.log(`   ⚠️  No cruises were updated - check FTP connection and logs`);
    } else if (updatedCount < expectedCruises * 0.5) {
      console.log(`   ⚠️  Less than 50% updated - some files may be missing on FTP`);
    } else {
      console.log(`   ✅ Webhook processed successfully!`);
    }
  }
}

/**
 * Run comprehensive test suite
 */
async function runTests() {
  console.log('🚀 Comprehensive Webhook Test Suite');
  console.log('====================================');
  console.log(`API URL: ${API_URL}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('');

  // Initialize database
  const dbConnected = await initDatabase();

  // Test small line first
  await testWebhook(
    TEST_LINES[0].id,
    TEST_LINES[0].name,
    TEST_LINES[0].expectedCruises
  );

  // Ask if should continue
  console.log('\n' + '='.repeat(60));
  console.log('Small cruise line test complete.');
  console.log('Next test: Holland America (~1228 cruises)');
  console.log('This will take longer to process.');

  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const answer = await new Promise(resolve => {
    readline.question('\nContinue with larger test? (y/n): ', resolve);
  });
  readline.close();

  if (answer.toLowerCase() === 'y') {
    // Test medium-sized line
    await testWebhook(
      TEST_LINES[2].id,
      TEST_LINES[2].name,
      TEST_LINES[2].expectedCruises
    );
  }

  // Cleanup
  if (dbPool) {
    await dbPool.end();
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 Test suite complete!');
  console.log('Check Render logs for detailed processing information:');
  console.log('https://dashboard.render.com/web/srv-cqcph4lds78s739sl9og/logs');
  console.log('='.repeat(60));
}

// Run tests
runTests().catch(console.error);
