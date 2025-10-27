#!/usr/bin/env node
/**
 * Multi-Cruise Pricing Comparison Script
 *
 * Compares cached database prices against live Traveltek API pricing
 * for multiple Royal Caribbean cruises to verify pricing accuracy.
 *
 * Usage:
 *   node scripts/compare-pricing-multiple-cruises.js
 *
 * Environment:
 *   Requires DATABASE_URL_PRODUCTION or DATABASE_URL
 *   Requires TRAVELTEK_API_USERNAME and TRAVELTEK_API_PASSWORD
 */

require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');
const fetch = require('node-fetch');

// Configuration
const TRAVELTEK_API_URL = process.env.TRAVELTEK_API_BASE_URL || 'https://fusionapi.traveltek.net/2.1/json';
const TRAVELTEK_USERNAME = process.env.TRAVELTEK_API_USERNAME;
const TRAVELTEK_PASSWORD = process.env.TRAVELTEK_API_PASSWORD;

// Test cruises - mix of different sailing dates and ships
const TEST_CRUISES = [
  '2106593', // harmony-of-the-seas-2026-03-01 (confirmed working)
  '2144436', // quantum-of-the-seas-2026-04-01
  '2219483', // utopia-of-the-seas-2026-05-01
  '2190559', // brilliance-of-the-seas-2026-06-01
  '2220320', // spectrum-of-the-seas-2026-07-03
];

const databaseUrl = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;
const isProduction = databaseUrl && databaseUrl.includes('render.com');

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

let ACCESS_TOKEN = null;
let SESSION_KEY = null;
let SID = null;

/**
 * Get OAuth access token from Traveltek
 */
async function getAccessToken() {
  const credentials = Buffer.from(`${TRAVELTEK_USERNAME}:${TRAVELTEK_PASSWORD}`).toString('base64');

  const response = await fetch(`${TRAVELTEK_API_URL}/token.pl`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=portal',
  });

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  ACCESS_TOKEN = data.access_token;
  console.log('✅ Got OAuth access token');
}

/**
 * Create Traveltek session
 */
async function createSession(adults = 2) {
  const today = new Date();
  const nextYear = new Date(today);
  nextYear.setMonth(nextYear.getMonth() + 12);

  const url = new URL(`${TRAVELTEK_API_URL}/cruiseresults.pl`);
  url.searchParams.append('requestid', ACCESS_TOKEN);
  url.searchParams.append('startdate', today.toISOString().split('T')[0]);
  url.searchParams.append('enddate', nextYear.toISOString().split('T')[0]);
  url.searchParams.append('lineid', '22,3');
  url.searchParams.append('adults', adults.toString());
  url.searchParams.append('currency', 'USD');

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Failed to create session: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  SESSION_KEY = data.meta?.criteria?.sessionkey;
  SID = data.meta?.criteria?.sid || '52471';

  if (!SESSION_KEY) {
    throw new Error('No session key in response');
  }

  console.log(`✅ Created session with adults=${adults}`);
}

/**
 * Get live cabin pricing from Traveltek API
 */
async function getLiveCabinPricing(codetocruiseid, adults = 2) {
  const url = new URL(`${TRAVELTEK_API_URL}/cruisecabingrades.pl`);
  url.searchParams.append('requestid', ACCESS_TOKEN);
  url.searchParams.append('sessionkey', SESSION_KEY);
  url.searchParams.append('type', 'cruise');
  url.searchParams.append('sid', SID);
  url.searchParams.append('codetocruiseid', codetocruiseid);
  url.searchParams.append('adults', adults.toString());
  url.searchParams.append('currency', 'USD');

  const response = await fetch(url.toString());

  if (!response.ok) {
    console.error(`API error for cruise ${codetocruiseid}: ${response.status}`);
    return null;
  }

  const data = await response.json();

  if (!data.results || data.results.length === 0) {
    return null;
  }

  // Find cheapest price across all cabin grades
  let cheapestPrice = null;
  let cheapestCabin = null;

  for (const cabin of data.results) {
    if (cabin.gridpricing && Array.isArray(cabin.gridpricing)) {
      for (const pricing of cabin.gridpricing) {
        if (pricing.available === 'Y' && pricing.price) {
          const price = parseFloat(pricing.price);
          if (!isNaN(price) && price > 0) {
            if (cheapestPrice === null || price < cheapestPrice) {
              cheapestPrice = price;
              cheapestCabin = {
                name: cabin.name,
                code: cabin.cabincode,
                type: cabin.codtype,
              };
            }
          }
        }
      }
    }
  }

  return { price: cheapestPrice, cabin: cheapestCabin };
}

/**
 * Get cached pricing from database
 */
async function getCachedPricing(cruiseIds) {
  const query = `
    SELECT
      c.id,
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
    ORDER BY c.sailing_date ASC
  `;

  const result = await pool.query(query, [cruiseIds]);
  return result.rows;
}

/**
 * Main comparison function
 */
async function comparePricing() {
  console.log('🔍 Multi-Cruise Pricing Comparison');
  console.log('═'.repeat(80));
  console.log('');

  try {
    // Step 1: Get OAuth token
    console.log('📡 Authenticating with Traveltek API...');
    await getAccessToken();
    console.log('');

    // Step 2: Get cached pricing from database
    console.log('💾 Fetching cached pricing from database...');
    const cachedData = await getCachedPricing(TEST_CRUISES);
    console.log(`Found ${cachedData.length} cruises in database`);
    console.log('');

    // Step 3: Compare each cruise
    const results = [];

    for (let i = 0; i < cachedData.length; i++) {
      const cruise = cachedData[i];
      const cruiseNum = i + 1;

      console.log(`${cruiseNum}/${cachedData.length} Testing: ${cruise.name} (${cruise.id})`);
      console.log(`   Sailing: ${new Date(cruise.sailing_date).toLocaleDateString()}`);

      // Create fresh session for each cruise to avoid session mismatch
      await createSession(2);

      // Get live pricing
      const liveData = await getLiveCabinPricing(cruise.id, 2);

      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));

      // Calculate cached price
      const cachedPrice = cruise.cheapest_price ? parseFloat(cruise.cheapest_price) :
                          (cruise.interior_price ? parseFloat(cruise.interior_price) : null);

      if (!liveData || !liveData.price) {
        console.log(`   ⚠️  No live pricing available`);
        results.push({
          id: cruise.id,
          name: cruise.name,
          sailing_date: cruise.sailing_date,
          cached_total: cachedPrice ? cachedPrice * 2 : null,
          cached_per_person: cachedPrice,
          live_total: null,
          live_per_person: null,
          difference: null,
          difference_percent: null,
          status: 'NO_LIVE_PRICING',
        });
      } else {
        const liveTotal = liveData.price;
        const livePerPerson = liveTotal / 2;
        const cachedTotal = cachedPrice * 2;

        const difference = liveTotal - cachedTotal;
        const percentDiff = ((difference / cachedTotal) * 100).toFixed(2);

        console.log(`   💰 Cached: $${cachedTotal.toFixed(2)} ($${cachedPrice.toFixed(2)}/person)`);
        console.log(`   💰 Live:   $${liveTotal.toFixed(2)} ($${livePerPerson.toFixed(2)}/person)`);
        console.log(`   📊 Diff:   $${difference.toFixed(2)} (${percentDiff}%)`);
        console.log(`   🏨 Cabin:  ${liveData.cabin.name} (${liveData.cabin.type})`);

        const isAccurate = Math.abs(parseFloat(percentDiff)) <= 5;
        console.log(`   ${isAccurate ? '✅' : '❌'} ${isAccurate ? 'ACCURATE' : 'INACCURATE'}`);

        results.push({
          id: cruise.id,
          name: cruise.name,
          sailing_date: cruise.sailing_date,
          cached_total: cachedTotal,
          cached_per_person: cachedPrice,
          live_total: liveTotal,
          live_per_person: livePerPerson,
          difference: difference,
          difference_percent: parseFloat(percentDiff),
          status: isAccurate ? 'ACCURATE' : 'INACCURATE',
          live_cabin: liveData.cabin,
        });
      }

      console.log('');
    }

    // Step 4: Summary
    console.log('═'.repeat(80));
    console.log('SUMMARY');
    console.log('═'.repeat(80));
    console.log('');

    const withLivePricing = results.filter(r => r.status !== 'NO_LIVE_PRICING');
    const accurate = results.filter(r => r.status === 'ACCURATE');
    const noLivePricing = results.filter(r => r.status === 'NO_LIVE_PRICING');

    console.log(`Total Cruises Tested: ${results.length}`);
    console.log(`With Live Pricing: ${withLivePricing.length}`);
    console.log(`No Live Pricing: ${noLivePricing.length}`);
    console.log('');

    if (withLivePricing.length > 0) {
      console.log(`Accurate (within 5%): ${accurate.length}/${withLivePricing.length}`);
      console.log(`Inaccurate (>5% diff): ${withLivePricing.length - accurate.length}/${withLivePricing.length}`);
      console.log('');

      const totalDiff = withLivePricing.reduce((sum, r) => sum + Math.abs(r.difference || 0), 0);
      const avgDiff = totalDiff / withLivePricing.length;
      console.log(`Average Difference: $${avgDiff.toFixed(2)}`);

      const totalPercentDiff = withLivePricing.reduce((sum, r) => sum + Math.abs(r.difference_percent || 0), 0);
      const avgPercentDiff = totalPercentDiff / withLivePricing.length;
      console.log(`Average % Difference: ${avgPercentDiff.toFixed(2)}%`);
    }

    console.log('');
    console.log('═'.repeat(80));
    console.log('PRICING ACCURACY ANALYSIS');
    console.log('═'.repeat(80));
    console.log('');
    console.log('NOTE: Cached prices are stored PER PERSON (for 2 adults)');
    console.log('      Live prices are TOTAL for 2 guests');
    console.log('      For accurate comparison, we multiply cached by 2');
    console.log('');

    await pool.end();

  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

// Run the comparison
comparePricing();
