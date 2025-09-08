#!/usr/bin/env node
/**
 * Real-time webhook monitoring with database verification
 * Shows actual cruise updates, pricing changes, and processing progress
 */

const { Pool } = require('pg');
const axios = require('axios');
require('dotenv').config();

// Configuration
const DATABASE_URL = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;
const API_URL = 'https://zipsea-production.onrender.com';
const REFRESH_INTERVAL = 3000; // Check every 3 seconds

let dbPool;
let startTime;
let initialStats = {};

/**
 * Initialize database connection
 */
async function initDatabase() {
  if (!DATABASE_URL) {
    console.error('❌ No DATABASE_URL found. Set DATABASE_URL_PRODUCTION in .env');
    process.exit(1);
  }

  dbPool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false,
    max: 5
  });

  try {
    await dbPool.query('SELECT 1');
    console.log('✅ Connected to production database');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
}

/**
 * Get comprehensive stats for a cruise line
 */
async function getCruiseLineStats(lineId) {
  try {
    const result = await dbPool.query(`
      SELECT
        cl.name as line_name,
        COUNT(DISTINCT c.id) as total_cruises,
        COUNT(DISTINCT c.id) FILTER (WHERE c.sailing_date >= CURRENT_DATE) as future_cruises,
        COUNT(DISTINCT c.id) FILTER (WHERE c.last_traveltek_update > NOW() - INTERVAL '1 hour') as recently_updated,
        COUNT(DISTINCT c.id) FILTER (WHERE c.last_traveltek_update > $1) as updated_this_session,
        COUNT(DISTINCT cp.cruise_id) as cruises_with_pricing,
        COUNT(DISTINCT cp.cruise_id) FILTER (WHERE cp.last_updated > NOW() - INTERVAL '1 hour') as pricing_recently_updated,
        COUNT(DISTINCT cp.cruise_id) FILTER (WHERE cp.last_updated > $1) as pricing_updated_this_session,
        MAX(c.last_traveltek_update) as last_cruise_update,
        MAX(cp.last_updated) as last_pricing_update,
        MIN(cp.cheapest_price) as min_price,
        MAX(cp.cheapest_price) as max_price,
        AVG(cp.cheapest_price)::decimal(10,2) as avg_price
      FROM cruise_lines cl
      LEFT JOIN cruises c ON c.cruise_line_id = cl.id
      LEFT JOIN cheapest_pricing cp ON cp.cruise_id = c.id
      WHERE cl.id = $2
      GROUP BY cl.id, cl.name
    `, [startTime || new Date(), lineId]);

    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting stats:', error.message);
    return null;
  }
}

/**
 * Get recent cruise updates with pricing details
 */
async function getRecentUpdates(lineId, limit = 5) {
  try {
    const result = await dbPool.query(`
      SELECT
        c.id,
        c.cruise_id,
        c.name,
        c.sailing_date,
        c.last_traveltek_update,
        cp.cheapest_price,
        cp.interior_price,
        cp.oceanview_price,
        cp.balcony_price,
        cp.suite_price,
        cp.last_updated as pricing_updated,
        CASE
          WHEN c.raw_data IS NOT NULL THEN 'Yes'
          ELSE 'No'
        END as has_raw_data
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON cp.cruise_id = c.id
      WHERE c.cruise_line_id = $1
        AND c.last_traveltek_update > NOW() - INTERVAL '10 minutes'
      ORDER BY c.last_traveltek_update DESC
      LIMIT $2
    `, [lineId, limit]);

    return result.rows;
  } catch (error) {
    console.error('Error getting recent updates:', error.message);
    return [];
  }
}

/**
 * Monitor a specific cruise line
 */
async function monitorCruiseLine(lineId) {
  console.clear();
  console.log('🔄 WEBHOOK PROCESSING MONITOR - PRODUCTION');
  console.log('=' .repeat(60));
  console.log(`Monitoring Line ID: ${lineId}`);
  console.log(`Started: ${startTime.toISOString()}`);
  console.log('=' .repeat(60));

  // Get current stats
  const stats = await getCruiseLineStats(lineId);

  if (!stats) {
    console.log('❌ Could not fetch stats');
    return;
  }

  // Calculate progress
  const cruisesProcessed = stats.updated_this_session || 0;
  const pricingProcessed = stats.pricing_updated_this_session || 0;
  const processRate = cruisesProcessed > 0
    ? Math.round((cruisesProcessed / stats.future_cruises) * 100)
    : 0;

  console.log('\n📊 CRUISE LINE STATS:');
  console.log(`   Name: ${stats.line_name}`);
  console.log(`   Total Cruises: ${stats.total_cruises}`);
  console.log(`   Future Cruises: ${stats.future_cruises}`);
  console.log(`   Has Pricing: ${stats.cruises_with_pricing}`);
  console.log('');

  console.log('📈 PROCESSING PROGRESS:');
  console.log(`   Cruises Updated This Session: ${cruisesProcessed} (${processRate}%)`);
  console.log(`   Pricing Updated This Session: ${pricingProcessed}`);
  console.log(`   Recently Updated (1hr): ${stats.recently_updated}`);
  console.log(`   Last Update: ${stats.last_cruise_update ? new Date(stats.last_cruise_update).toLocaleTimeString() : 'Never'}`);
  console.log('');

  console.log('💰 PRICING STATS:');
  console.log(`   Min Price: $${stats.min_price || 'N/A'}`);
  console.log(`   Avg Price: $${stats.avg_price || 'N/A'}`);
  console.log(`   Max Price: $${stats.max_price || 'N/A'}`);
  console.log('');

  // Show recent updates
  const recentUpdates = await getRecentUpdates(lineId);
  if (recentUpdates.length > 0) {
    console.log('🆕 RECENT UPDATES:');
    recentUpdates.forEach(cruise => {
      const time = new Date(cruise.last_traveltek_update).toLocaleTimeString();
      const prices = [];
      if (cruise.interior_price) prices.push(`IN:$${cruise.interior_price}`);
      if (cruise.oceanview_price) prices.push(`OV:$${cruise.oceanview_price}`);
      if (cruise.balcony_price) prices.push(`BA:$${cruise.balcony_price}`);
      if (cruise.suite_price) prices.push(`SU:$${cruise.suite_price}`);

      console.log(`   ${time} - ${cruise.name || cruise.cruise_id}`);
      console.log(`      Sailing: ${new Date(cruise.sailing_date).toLocaleDateString()}`);
      console.log(`      Cheapest: $${cruise.cheapest_price || 'N/A'}`);
      if (prices.length > 0) {
        console.log(`      Cabins: ${prices.join(', ')}`);
      }
      console.log(`      Raw Data: ${cruise.has_raw_data}`);
      console.log('');
    });
  }

  // Progress bar
  if (stats.future_cruises > 0) {
    const barLength = 40;
    const filled = Math.round((cruisesProcessed / stats.future_cruises) * barLength);
    const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
    console.log(`Progress: [${bar}] ${processRate}%`);
  }

  console.log('\nPress Ctrl+C to stop monitoring');
}

/**
 * Start monitoring
 */
async function startMonitoring() {
  // Get cruise line to monitor
  const lineId = process.argv[2];

  if (!lineId) {
    console.log('Usage: node monitor-webhook-realtime.js <lineId>');
    console.log('Example: node monitor-webhook-realtime.js 16  # Monitor MSC Cruises');
    console.log('\nCommon Line IDs:');
    console.log('  16 - MSC Cruises (~6000 cruises)');
    console.log('  22 - Royal Caribbean (~3000 cruises)');
    console.log('  14 - Holland America (~1200 cruises)');
    console.log('  21 - Crystal Cruises (5 cruises)');
    process.exit(1);
  }

  console.log('🚀 Starting real-time monitoring...');
  startTime = new Date();

  // Initialize database
  await initDatabase();

  // Get initial stats
  initialStats = await getCruiseLineStats(lineId);

  // Start monitoring loop
  const interval = setInterval(async () => {
    await monitorCruiseLine(lineId);
  }, REFRESH_INTERVAL);

  // Initial display
  await monitorCruiseLine(lineId);

  // Handle shutdown
  process.on('SIGINT', async () => {
    clearInterval(interval);
    console.log('\n\n📊 FINAL SUMMARY');
    console.log('=' .repeat(60));

    const finalStats = await getCruiseLineStats(lineId);
    if (finalStats) {
      console.log(`Total Cruises Processed: ${finalStats.updated_this_session}`);
      console.log(`Total Pricing Updated: ${finalStats.pricing_updated_this_session}`);
      console.log(`Success Rate: ${Math.round((finalStats.pricing_updated_this_session / finalStats.updated_this_session) * 100)}%`);

      const duration = (Date.now() - startTime.getTime()) / 1000;
      console.log(`Duration: ${Math.round(duration)}s`);
      console.log(`Processing Rate: ${Math.round(finalStats.updated_this_session / (duration / 60))} cruises/min`);
    }

    if (dbPool) await dbPool.end();
    process.exit(0);
  });
}

// Start monitoring
startMonitoring().catch(console.error);
