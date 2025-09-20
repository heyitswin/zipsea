#!/usr/bin/env node

/**
 * Simplified API pricing test using curl commands
 * For use in Render shell where fetch might not work
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function testWithCurl() {
  console.log('🔍 API PRICING TEST (using curl)');
  console.log('='.repeat(70));

  const apiUrl = 'https://zipsea-production.onrender.com';
  console.log(`\n📡 Testing API: ${apiUrl}`);
  console.log('-'.repeat(40));

  try {
    // Test 1: Search API
    console.log('\n1. Testing Search API...');
    const searchCmd = `curl -s "${apiUrl}/api/v1/search/cruises?limit=2"`;
    console.log(`   Running: ${searchCmd}`);

    const { stdout: searchData, stderr: searchErr } = await execPromise(searchCmd);

    if (searchErr) {
      console.log(`   ❌ curl error: ${searchErr}`);
      return;
    }

    try {
      const searchResult = JSON.parse(searchData);

      if (searchResult.data && searchResult.data.length > 0) {
        console.log(`   ✅ Search API returned ${searchResult.data.length} cruises`);

        const firstCruise = searchResult.data[0];
        console.log(`\n   First cruise: ${firstCruise.name}`);
        console.log(`   ID: ${firstCruise.id}`);

        // Check pricing
        if (firstCruise.pricing) {
          console.log('   ✅ Pricing object exists:');
          console.log(`      Interior: $${firstCruise.pricing.interior || 'null'}`);
          console.log(`      Oceanview: $${firstCruise.pricing.oceanview || 'null'}`);
          console.log(`      Balcony: $${firstCruise.pricing.balcony || 'null'}`);
          console.log(`      Suite: $${firstCruise.pricing.suite || 'null'}`);
        }

        // Test 2: Cruise Detail API
        console.log(`\n2. Testing Cruise Detail API (ID: ${firstCruise.id})...`);
        const detailCmd = `curl -s "${apiUrl}/api/v1/cruises/${firstCruise.id}"`;
        console.log(`   Running: ${detailCmd}`);

        const { stdout: detailData, stderr: detailErr } = await execPromise(detailCmd);

        if (detailErr) {
          console.log(`   ❌ curl error: ${detailErr}`);
          return;
        }

        const detailResult = JSON.parse(detailData);
        const cruise = detailResult.data;

        if (cruise) {
          console.log('   ✅ Cruise details returned');
          console.log(`   Name: ${cruise.name}`);

          // Check individual price fields
          const hasPrices =
            cruise.interiorPrice !== undefined ||
            cruise.oceanviewPrice !== undefined ||
            cruise.balconyPrice !== undefined ||
            cruise.suitePrice !== undefined;

          if (hasPrices) {
            console.log('   ✅ Individual price fields exist:');
            console.log(`      Interior: $${cruise.interiorPrice || 'null'}`);
            console.log(`      Oceanview: $${cruise.oceanviewPrice || 'null'}`);
            console.log(`      Balcony: $${cruise.balconyPrice || 'null'}`);
            console.log(`      Suite: $${cruise.suitePrice || 'null'}`);
            console.log(`      Cheapest: $${cruise.cheapestPrice || 'null'}`);
          } else {
            console.log('   ⚠️ Individual price fields missing!');
            console.log('   Available fields:', Object.keys(cruise).slice(0, 10).join(', '), '...');
          }

          // Check cheapestPricing object
          if (cruise.cheapestPricing) {
            console.log('\n   ✅ Cheapest pricing object exists:');
            console.log(`      Interior: $${cruise.cheapestPricing.interior || 'null'}`);
            console.log(`      Oceanview: $${cruise.cheapestPricing.oceanview || 'null'}`);
            console.log(`      Balcony: $${cruise.cheapestPricing.balcony || 'null'}`);
            console.log(`      Suite: $${cruise.cheapestPricing.suite || 'null'}`);
          }
        }

      } else {
        console.log('   ⚠️ No cruises returned from search');
      }

    } catch (parseErr) {
      console.log(`   ❌ Failed to parse JSON response`);
      console.log('   Response preview:', searchData.substring(0, 200));
    }

  } catch (error) {
    console.log(`\n❌ Error: ${error.message}`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ TEST COMPLETE');
}

// Run the test
testWithCurl().catch(console.error);
