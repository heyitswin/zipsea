#!/usr/bin/env node

/**
 * Price Accuracy Test Script
 *
 * Compares cached prices displayed on /cruises with live pricing from Traveltek API
 * Tests 100 Royal Caribbean cruises sailing in 2026
 */

const { Pool } = require('pg');
const fetch = require('node-fetch');
require('dotenv').config(); // Load from .env by default

const TRAVELTEK_API_URL =
  process.env.TRAVELTEK_API_BASE_URL || 'https://fusionapi.traveltek.net/2.1/json';
const TRAVELTEK_USERNAME = process.env.TRAVELTEK_API_USERNAME;
const TRAVELTEK_PASSWORD = process.env.TRAVELTEK_API_PASSWORD;

if (!TRAVELTEK_USERNAME || !TRAVELTEK_PASSWORD) {
  console.error('❌ Missing Traveltek credentials in environment variables');
  console.error('   Required: TRAVELTEK_API_USERNAME and TRAVELTEK_API_PASSWORD');
  process.exit(1);
}

let SESSION_KEY = null;
let SID = null;
let ACCESS_TOKEN = null;

const databaseUrl = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;
const isProduction = databaseUrl && databaseUrl.includes('render.com');

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

/**
 * Get OAuth access token
 */
async function getAccessToken() {
  try {
    const credentials = Buffer.from(`${TRAVELTEK_USERNAME}:${TRAVELTEK_PASSWORD}`).toString(
      'base64'
    );

    const response = await fetch(`${TRAVELTEK_API_URL}/token.pl`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&scope=portal',
    });

    const data = await response.json();

    if (!data.access_token) {
      throw new Error('Failed to get access token');
    }

    ACCESS_TOKEN = data.access_token;
    console.log('✅ OAuth token obtained successfully');
  } catch (error) {
    console.error('❌ Failed to get OAuth token:', error.message);
    throw error;
  }
}

/**
 * Create Traveltek session by performing a minimal cruise search
 */
async function createSession() {
  try {
    const today = new Date();
    const nextYear = new Date(today);
    nextYear.setMonth(nextYear.getMonth() + 12);

    const startdate = today.toISOString().split('T')[0];
    const enddate = nextYear.toISOString().split('T')[0];

    const url = new URL(`${TRAVELTEK_API_URL}/cruiseresults.pl`);
    url.searchParams.append('requestid', ACCESS_TOKEN); // Add OAuth token as requestid
    url.searchParams.append('startdate', startdate);
    url.searchParams.append('enddate', enddate);
    url.searchParams.append('lineid', '22,3'); // Royal Caribbean and Celebrity
    url.searchParams.append('adults', '2');
    url.searchParams.append('currency', 'USD');

    const response = await fetch(url.toString());
    const data = await response.json();

    // Extract sessionkey from meta.criteria.sessionkey
    SESSION_KEY = data.meta?.criteria?.sessionkey;
    SID = data.meta?.criteria?.sid || 'default';

    if (!SESSION_KEY) {
      console.error('API errors:', data.errors);
      throw new Error('Failed to create session: missing sessionkey in response');
    }

    console.log('✅ Traveltek session created successfully');
    console.log('');
  } catch (error) {
    console.error('❌ Failed to create Traveltek session:', error.message);
    throw error;
  }
}

/**
 * Fetch cabin grades from Traveltek API
 */
async function getLiveCabinPricing(codetocruiseid) {
  try {
    const url = new URL(`${TRAVELTEK_API_URL}/cruisecabingrades.pl`);
    url.searchParams.append('requestid', ACCESS_TOKEN); // Add OAuth token
    url.searchParams.append('sessionkey', SESSION_KEY);
    url.searchParams.append('type', 'cruise');
    url.searchParams.append('sid', SID);
    url.searchParams.append('codetocruiseid', codetocruiseid);
    url.searchParams.append('adults', '2');
    url.searchParams.append('currency', 'USD');

    const response = await fetch(url.toString());
    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return null;
    }

    // Find the cheapest price across all cabin grades
    let cheapestPrice = null;

    for (const cabin of data.results) {
      if (cabin.gridpricing && Array.isArray(cabin.gridpricing)) {
        for (const pricing of cabin.gridpricing) {
          if (pricing.available === 'Y' && pricing.price) {
            const price = parseFloat(pricing.price);
            if (!isNaN(price) && price > 0) {
              if (cheapestPrice === null || price < cheapestPrice) {
                cheapestPrice = price;
              }
            }
          }
        }
      }

      // Also check top-level cheapestprice
      if (cabin.cheapestprice) {
        const price = parseFloat(cabin.cheapestprice);
        if (!isNaN(price) && price > 0) {
          if (cheapestPrice === null || price < cheapestPrice) {
            cheapestPrice = price;
          }
        }
      }
    }

    return cheapestPrice;
  } catch (error) {
    console.error(`Error fetching live pricing for ${codetocruiseid}:`, error.message);
    return null;
  }
}

/**
 * Get cached price (same logic as frontend)
 */
function getCachedPrice(cruise) {
  const prices = [];

  // Check cheapest_pricing fields
  if (cruise.interior_price) prices.push(parseFloat(cruise.interior_price));
  if (cruise.oceanview_price) prices.push(parseFloat(cruise.oceanview_price));
  if (cruise.balcony_price) prices.push(parseFloat(cruise.balcony_price));
  if (cruise.suite_price) prices.push(parseFloat(cruise.suite_price));
  if (cruise.cheapest_price) prices.push(parseFloat(cruise.cheapest_price));

  return prices.length > 0 ? Math.min(...prices) : null;
}

/**
 * Main test function
 */
async function runTest() {
  console.log('🔬 Price Accuracy Test');
  console.log('======================');
  console.log('');
  console.log('📊 Testing: 10 specific Royal Caribbean cruises with confirmed live pricing');
  console.log('🎯 Goal: Compare cached prices vs live Traveltek API prices');
  console.log('');

  try {
    // Get OAuth token first, then create session
    await getAccessToken();
    await createSession();

    // Test specific cruises with known live pricing
    const cruiseIds = [
      '2106593', // harmony-of-the-seas-2026-03-01
      '2144436', // quantum-of-the-seas-2026-04-01
      '2219483', // utopia-of-the-seas-2026-05-01
      '2190559', // brilliance-of-the-seas-2026-06-01
      '2220320', // spectrum-of-the-seas-2026-07-03
      '2196018', // icon-of-the-seas-2026-08-01
      '2196221', // enchantment-of-the-seas-2026-09-05
      '2217443', // legend-of-the-seas-2026-10-01
      '2219709', // allure-of-the-seas-2026-11-01
      '2196078', // radiance-of-the-seas-2026-12-05
    ];

    const query = `
      SELECT
        c.id as cruise_id,
        c.name,
        c.sailing_date,
        c.nights,
        cp.interior_price,
        cp.oceanview_price,
        cp.balcony_price,
        cp.suite_price,
        cp.cheapest_price
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
      WHERE c.id = ANY($1)
        AND c.is_active = true
      ORDER BY c.sailing_date ASC
    `;

    console.log('📥 Fetching cruises from database...');
    const result = await pool.query(query, [cruiseIds]);
    const cruises = result.rows;

    console.log(`✅ Found ${cruises.length} cruises with confirmed live pricing`);
    console.log('');

    if (cruises.length === 0) {
      console.log('⚠️  No cruises found. Exiting.');
      process.exit(0);
    }

    // Test each cruise
    const results = [];
    let successCount = 0;
    let failCount = 0;

    console.log('🔄 Testing prices...');
    console.log('');

    for (let i = 0; i < cruises.length; i++) {
      const cruise = cruises[i];
      const cachedPrice = getCachedPrice(cruise);

      if (!cachedPrice) {
        console.log(`${i + 1}/${cruises.length} SKIP: ${cruise.cruise_id} - No cached price`);
        failCount++;
        continue;
      }

      // Get live pricing
      console.log(
        `${i + 1}/${cruises.length} Testing: ${cruise.cruise_id} (${cruise.sailing_date})`
      );
      const livePrice = await getLiveCabinPricing(cruise.cruise_id);

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));

      if (livePrice === null) {
        console.log(`  ⚠️  No live pricing available`);
        failCount++;
        results.push({
          cruise_id: cruise.cruise_id,
          name: cruise.name,
          sailing_date: cruise.sailing_date,
          cached_price: cachedPrice,
          cached_per_person: cachedPrice / 2,
          live_price: null,
          live_per_person: null,
          difference: null,
          difference_percent: null,
          status: 'NO_LIVE_PRICE',
        });
        continue;
      }

      // Calculate differences
      const difference = livePrice - cachedPrice;
      const differencePercent = ((difference / cachedPrice) * 100).toFixed(2);
      const isAccurate = Math.abs(differencePercent) <= 5; // Within 5% is considered accurate

      console.log(
        `  💰 Cached: $${cachedPrice.toFixed(2)} ($${(cachedPrice / 2).toFixed(2)}/person)`
      );
      console.log(`  💰 Live:   $${livePrice.toFixed(2)} ($${(livePrice / 2).toFixed(2)}/person)`);
      console.log(`  📊 Diff:   $${difference.toFixed(2)} (${differencePercent}%)`);
      console.log(`  ${isAccurate ? '✅' : '❌'} ${isAccurate ? 'Accurate' : 'Inaccurate'}`);
      console.log('');

      if (isAccurate) successCount++;
      else failCount++;

      results.push({
        cruise_id: cruise.cruise_id,
        name: cruise.name,
        sailing_date: cruise.sailing_date,
        cached_price: cachedPrice,
        cached_per_person: cachedPrice / 2,
        live_price: livePrice,
        live_per_person: livePrice / 2,
        difference,
        difference_percent: parseFloat(differencePercent),
        status: isAccurate ? 'ACCURATE' : 'INACCURATE',
      });
    }

    // Generate report
    console.log('');
    console.log('📈 FINAL REPORT');
    console.log('===============');
    console.log('');
    console.log(`Total cruises tested: ${cruises.length}`);
    console.log(`Successful comparisons: ${successCount + failCount}`);
    console.log(`No live pricing available: ${cruises.length - successCount - failCount}`);
    console.log('');
    console.log(`✅ Accurate (within 5%): ${successCount}`);
    console.log(`❌ Inaccurate (>5% diff): ${failCount}`);
    console.log(
      `Accuracy rate: ${((successCount / (successCount + failCount)) * 100).toFixed(2)}%`
    );
    console.log('');

    // Show most inaccurate
    const inaccurate = results
      .filter(r => r.status === 'INACCURATE')
      .sort((a, b) => Math.abs(b.difference_percent) - Math.abs(a.difference_percent))
      .slice(0, 10);

    if (inaccurate.length > 0) {
      console.log('🔴 Top 10 Most Inaccurate:');
      console.log('');
      inaccurate.forEach((r, i) => {
        console.log(`${i + 1}. ${r.cruise_id} - ${r.sailing_date}`);
        console.log(`   Cached: $${r.cached_price.toFixed(2)} | Live: $${r.live_price.toFixed(2)}`);
        console.log(`   Difference: $${r.difference.toFixed(2)} (${r.difference_percent}%)`);
        console.log('');
      });
    }

    // Calculate average difference
    const validResults = results.filter(r => r.live_price !== null);
    if (validResults.length > 0) {
      const avgDiff =
        validResults.reduce((sum, r) => sum + Math.abs(r.difference), 0) / validResults.length;
      const avgDiffPercent =
        validResults.reduce((sum, r) => sum + Math.abs(r.difference_percent), 0) /
        validResults.length;

      console.log('📊 Statistics:');
      console.log(`Average price difference: $${avgDiff.toFixed(2)}`);
      console.log(`Average percentage difference: ${avgDiffPercent.toFixed(2)}%`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the test
if (require.main === module) {
  runTest().catch(console.error);
}

module.exports = { runTest };
