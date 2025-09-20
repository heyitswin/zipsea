#!/usr/bin/env node
require('dotenv').config();
const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { cruises, cheapestPricing } = require('../dist/db/schema');
const { eq } = require('drizzle-orm');
const https = require('https');

const DATABASE_URL = process.env.DATABASE_URL;
const client = postgres(DATABASE_URL, { ssl: 'require' });
const db = drizzle(client);

function fetchFromAPI(cruiseId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'zipsea-production.onrender.com',
      path: `/api/cruises/${cruiseId}`,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function debugApiResponse() {
  try {
    const cruiseId = '2145865';

    console.log('🔍 DEBUGGING CRUISE', cruiseId);
    console.log('=' .repeat(50));

    // 1. Check cruises table
    console.log('\n1️⃣ CRUISES TABLE:');
    const cruiseData = await db
      .select()
      .from(cruises)
      .where(eq(cruises.id, cruiseId))
      .limit(1);

    if (cruiseData.length > 0) {
      const cruise = cruiseData[0];
      console.log('  Interior Price:', cruise.interiorPrice);
      console.log('  Oceanview Price:', cruise.oceanviewPrice);
      console.log('  Balcony Price:', cruise.balconyPrice);
      console.log('  Suite Price:', cruise.suitePrice);
      console.log('  Cheapest Price:', cruise.cheapestPrice);
    }

    // 2. Check cheapest_pricing table
    console.log('\n2️⃣ CHEAPEST_PRICING TABLE:');
    const cheapestData = await db
      .select()
      .from(cheapestPricing)
      .where(eq(cheapestPricing.cruiseId, cruiseId))
      .limit(1);

    if (cheapestData.length > 0) {
      const pricing = cheapestData[0];
      console.log('  Interior Price:', pricing.interiorPrice);
      console.log('  Oceanview Price:', pricing.oceanviewPrice);
      console.log('  Balcony Price:', pricing.balconyPrice);
      console.log('  Suite Price:', pricing.suitePrice);
      console.log('  Cheapest Price:', pricing.cheapestPrice);
      console.log('  Last Updated:', pricing.lastUpdated);
    } else {
      console.log('  No data in cheapest_pricing table');
    }

    // 3. Check what API returns
    console.log('\n3️⃣ API RESPONSE:');
    const apiResponse = await fetchFromAPI(cruiseId);

    if (apiResponse.success && apiResponse.data) {
      const data = apiResponse.data;
      console.log('  Interior Price:', data.interiorPrice);
      console.log('  Oceanview Price:', data.oceanviewPrice);
      console.log('  Balcony Price:', data.balconyPrice);
      console.log('  Suite Price:', data.suitePrice);
      console.log('  Cheapest Price:', data.cheapestPrice);

      // Check cheapestPricing object in API response
      if (data.cheapestPricing) {
        console.log('\n  cheapestPricing object:');
        if (data.cheapestPricing.interior) {
          console.log('    Interior:', data.cheapestPricing.interior.price);
        }
        if (data.cheapestPricing.oceanview) {
          console.log('    Oceanview:', data.cheapestPricing.oceanview.price);
        }
      }
    }

    // 4. Compare
    console.log('\n4️⃣ COMPARISON:');
    const dbPrice = cruiseData[0]?.interiorPrice;
    const apiPrice = apiResponse.data?.interiorPrice;
    const cheapestTablePrice = cheapestData[0]?.interiorPrice;

    console.log('  Database (cruises):', dbPrice);
    console.log('  Database (cheapest_pricing):', cheapestTablePrice);
    console.log('  API Response:', apiPrice);

    if (dbPrice === apiPrice) {
      console.log('  ✅ API matches cruises table');
    } else if (String(cheapestTablePrice) === apiPrice) {
      console.log('  ⚠️ API matches cheapest_pricing table (WRONG!)');
    } else {
      console.log('  ❌ API doesn\'t match either table');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

debugApiResponse();
