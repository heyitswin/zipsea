#!/usr/bin/env node

const fetch = require('node-fetch');

async function testCruiseAPI() {
  console.log('Testing API for cruise 2143102\n');
  console.log('================================\n');

  const cruiseId = '2143102';

  // Test production API
  const apiUrl = `https://api.zipsea.com/api/v1/cruises/${cruiseId}`;

  console.log(`Fetching: ${apiUrl}\n`);

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (response.ok && data.success) {
      console.log('✅ API returned successfully\n');

      // Check basic info
      console.log('📊 BASIC INFO:');
      console.log(`  ID: ${data.data.id}`);
      console.log(`  Name: ${data.data.name}`);
      console.log(`  Ship: ${data.data.ship?.name}`);
      console.log(`  Sailing Date: ${data.data.sailingDate}`);

      // Check pricing data
      console.log('\n💰 PRICING DATA:');
      if (data.data.cheapestPricing) {
        const pricing = data.data.cheapestPricing;
        console.log('  Found cheapestPricing object:');

        if (pricing.overall) {
          console.log(`    Overall: $${pricing.overall.price}`);
        }

        if (pricing.interior) {
          console.log(`    Interior: $${pricing.interior.price}`);
        }

        if (pricing.oceanview) {
          console.log(`    Ocean View: $${pricing.oceanview.price}`);
        }

        if (pricing.balcony) {
          console.log(`    Balcony: $${pricing.balcony.price}`);
        }

        if (pricing.suite) {
          console.log(`    Suite: $${pricing.suite.price}`);
        }

        if (!pricing.interior && !pricing.oceanview && !pricing.balcony && !pricing.suite) {
          console.log('    ⚠️  No cabin pricing found in cheapestPricing object');
        }
      } else {
        console.log('  ❌ No cheapestPricing object in response');
      }

      // Check alternative format
      console.log('\n🔍 OTHER PRICING FIELDS:');
      if (data.data.pricing) {
        console.log(`  Has "pricing" field with ${data.data.pricing.options?.length || 0} options`);
      }

      if (data.data.interior_price !== undefined) {
        console.log(`  interior_price: $${data.data.interior_price}`);
      }

      if (data.data.cheapest_inside !== undefined) {
        console.log(`  cheapest_inside: $${data.data.cheapest_inside}`);
      }

      // Check raw data
      if (data.data.rawData) {
        console.log('\n📦 RAW DATA:');
        console.log('  Has rawData field');
        if (data.data.rawData.cheapest) {
          console.log('  Has rawData.cheapest object');
        }
        if (data.data.rawData.prices) {
          console.log('  Has rawData.prices object');
        }
      }

      // Show the actual structure
      console.log('\n\n🔧 FULL RESPONSE STRUCTURE (first 2000 chars):');
      console.log(JSON.stringify(data, null, 2).substring(0, 2000));
    } else {
      console.log('❌ API error:', data.error || 'Unknown error');
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

testCruiseAPI();
