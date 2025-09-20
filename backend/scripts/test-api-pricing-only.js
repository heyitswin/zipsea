#!/usr/bin/env node

/**
 * API-only pricing test script for Render shell
 * Tests both search and detail endpoints for price fields
 * No database connection required
 */

const fetch = require('node-fetch');

async function testAPIPricing() {
  console.log('🔍 API PRICING VALIDATION TEST');
  console.log('=' .repeat(70));

  // Use localhost when running on Render shell
  const apiUrl = process.env.API_URL || 'http://localhost:3001';
  console.log(`\n📡 Testing API: ${apiUrl}`);
  console.log('-'.repeat(40));

  try {
    // Test 1: Search API
    console.log('\n1. Testing Search API...');
    const searchUrl = `${apiUrl}/api/v1/search/cruises?limit=5`;
    const searchResponse = await fetch(searchUrl);

    if (!searchResponse.ok) {
      console.log(`   ❌ Search API failed: ${searchResponse.status}`);
      return;
    }

    const searchData = await searchResponse.json();

    if (searchData.data && searchData.data.length > 0) {
      console.log(`   ✅ Search API returned ${searchData.data.length} cruises`);

      const firstCruise = searchData.data[0];
      console.log(`\n   First cruise: ${firstCruise.name}`);
      console.log(`   ID: ${firstCruise.id}`);

      // Check pricing object
      if (firstCruise.pricing) {
        console.log('   ✅ Pricing object exists:');
        console.log(`      Interior: $${firstCruise.pricing.interior || 'null'}`);
        console.log(`      Oceanview: $${firstCruise.pricing.oceanview || 'null'}`);
        console.log(`      Balcony: $${firstCruise.pricing.balcony || 'null'}`);
        console.log(`      Suite: $${firstCruise.pricing.suite || 'null'}`);
        console.log(`      Lowest: $${firstCruise.pricing.lowest || 'null'}`);
      } else {
        console.log('   ⚠️ No pricing object in search results');
      }

      // Test 2: Cruise Detail API
      console.log(`\n2. Testing Cruise Detail API (ID: ${firstCruise.id})...`);
      const detailUrl = `${apiUrl}/api/v1/cruises/${firstCruise.id}`;
      const detailResponse = await fetch(detailUrl);

      if (!detailResponse.ok) {
        console.log(`   ❌ Detail API failed: ${detailResponse.status}`);
        return;
      }

      const detailResponseJson = await detailResponse.json();
      const detailData = detailResponseJson.data;

      if (detailData) {
        console.log('   ✅ Cruise details returned');
        console.log(`   Name: ${detailData.name}`);

        // Check individual price fields
        const hasPrices =
          detailData.interiorPrice !== undefined ||
          detailData.oceanviewPrice !== undefined ||
          detailData.balconyPrice !== undefined ||
          detailData.suitePrice !== undefined;

        if (hasPrices) {
          console.log('   ✅ Individual price fields exist:');
          console.log(`      Interior: $${detailData.interiorPrice || 'null'}`);
          console.log(`      Oceanview: $${detailData.oceanviewPrice || 'null'}`);
          console.log(`      Balcony: $${detailData.balconyPrice || 'null'}`);
          console.log(`      Suite: $${detailData.suitePrice || 'null'}`);
          console.log(`      Cheapest: $${detailData.cheapestPrice || 'null'}`);
        } else {
          console.log('   ⚠️ Individual price fields missing!');
          console.log('   Available fields:', Object.keys(detailData).join(', '));
        }

        // Check cheapestPricing object
        if (detailData.cheapestPricing) {
          console.log('\n   ✅ Cheapest pricing object exists:');
          console.log(`      Interior: $${detailData.cheapestPricing.interior || 'null'}`);
          console.log(`      Oceanview: $${detailData.cheapestPricing.oceanview || 'null'}`);
          console.log(`      Balcony: $${detailData.cheapestPricing.balcony || 'null'}`);
          console.log(`      Suite: $${detailData.cheapestPricing.suite || 'null'}`);
        }

        // Check pricing object
        if (detailData.pricing) {
          console.log('\n   ✅ Pricing object exists');
          if (detailData.pricing.cabinTypes) {
            const cabinCount = Object.keys(detailData.pricing.cabinTypes).length;
            console.log(`      ${cabinCount} cabin types available`);
          }
        }
      } else {
        console.log('   ❌ No data in detail response');
      }

      // Test 3: Sample multiple cruises
      console.log('\n3. Testing multiple cruises for price consistency...');
      let cruisesWithPrices = 0;
      let cruisesWithoutPrices = 0;

      for (let i = 0; i < Math.min(5, searchData.data.length); i++) {
        const cruise = searchData.data[i];
        const detailRes = await fetch(`${apiUrl}/api/v1/cruises/${cruise.id}`);

        if (detailRes.ok) {
          const detailJson = await detailRes.json();
          const detail = detailJson.data;

          const hasPrices =
            detail.interiorPrice !== undefined ||
            detail.oceanviewPrice !== undefined ||
            detail.balconyPrice !== undefined ||
            detail.suitePrice !== undefined;

          if (hasPrices) {
            cruisesWithPrices++;
          } else {
            cruisesWithoutPrices++;
          }

          console.log(`   Cruise ${i + 1}: ${hasPrices ? '✅ Has prices' : '⚠️ No prices'}`);
        }
      }

      console.log(`\n   Summary: ${cruisesWithPrices} with prices, ${cruisesWithoutPrices} without prices`);

    } else {
      console.log('   ⚠️ No cruises returned from search');
    }

  } catch (error) {
    console.log(`\n❌ Error during testing: ${error.message}`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ API PRICING TEST COMPLETE');
}

// Run the test
testAPIPricing().catch(console.error);
