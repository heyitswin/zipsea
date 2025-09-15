#!/usr/bin/env node

/**
 * Test script to verify webhook change detection logic
 */

const { Pool } = require('pg');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Simulate the change detection logic from webhook processor
async function hasDataChanged(oldData, newData) {
  const changes = [];

  // Compare cheapest pricing
  const oldCheapest = JSON.stringify(oldData.cheapest || {});
  const newCheapest = JSON.stringify(newData.cheapest || {});
  if (oldCheapest !== newCheapest) {
    changes.push('cheapest_pricing');
  }

  // Compare cabin categories
  const oldCabins = JSON.stringify(oldData.cabin_categories || []);
  const newCabins = JSON.stringify(newData.cabin_categories || []);
  if (oldCabins !== newCabins) {
    changes.push('cabin_categories');
  }

  // Compare itinerary
  const oldItinerary = JSON.stringify(oldData.itinerary || []);
  const newItinerary = JSON.stringify(newData.itinerary || []);
  if (oldItinerary !== newItinerary) {
    changes.push('itinerary');
  }

  // Compare availability
  const oldAvailability = oldData.is_available;
  const newAvailability = newData.is_available;
  if (oldAvailability !== newAvailability) {
    changes.push('availability');
  }

  return {
    changed: changes.length > 0,
    changes,
  };
}

async function testChangeDetection() {
  console.log('🔍 Testing webhook change detection logic...\n');

  // Test case 1: Identical data
  console.log('Test 1: Identical data');
  const data1 = {
    cheapest: { price: 1000, currency: 'USD' },
    cabin_categories: ['Interior', 'Ocean View'],
    itinerary: [{ port: 'Miami', day: 1 }],
    is_available: true,
  };
  const result1 = await hasDataChanged(data1, data1);
  console.log(`  Result: ${result1.changed ? '❌ Changed' : '✅ No change'} (Expected: No change)`);
  console.log(`  Changes detected: ${result1.changes.join(', ') || 'None'}\n`);

  // Test case 2: Price change
  console.log('Test 2: Price change');
  const data2Old = {
    cheapest: { price: 1000, currency: 'USD' },
    cabin_categories: ['Interior', 'Ocean View'],
    itinerary: [{ port: 'Miami', day: 1 }],
    is_available: true,
  };
  const data2New = {
    cheapest: { price: 950, currency: 'USD' },
    cabin_categories: ['Interior', 'Ocean View'],
    itinerary: [{ port: 'Miami', day: 1 }],
    is_available: true,
  };
  const result2 = await hasDataChanged(data2Old, data2New);
  console.log(`  Result: ${result2.changed ? '✅ Changed' : '❌ No change'} (Expected: Changed)`);
  console.log(`  Changes detected: ${result2.changes.join(', ') || 'None'}\n`);

  // Test case 3: New cabin category
  console.log('Test 3: New cabin category');
  const data3Old = {
    cheapest: { price: 1000, currency: 'USD' },
    cabin_categories: ['Interior', 'Ocean View'],
    itinerary: [{ port: 'Miami', day: 1 }],
    is_available: true,
  };
  const data3New = {
    cheapest: { price: 1000, currency: 'USD' },
    cabin_categories: ['Interior', 'Ocean View', 'Balcony'],
    itinerary: [{ port: 'Miami', day: 1 }],
    is_available: true,
  };
  const result3 = await hasDataChanged(data3Old, data3New);
  console.log(`  Result: ${result3.changed ? '✅ Changed' : '❌ No change'} (Expected: Changed)`);
  console.log(`  Changes detected: ${result3.changes.join(', ') || 'None'}\n`);

  // Test case 4: Availability change
  console.log('Test 4: Availability change');
  const data4Old = {
    cheapest: { price: 1000, currency: 'USD' },
    cabin_categories: ['Interior', 'Ocean View'],
    itinerary: [{ port: 'Miami', day: 1 }],
    is_available: true,
  };
  const data4New = {
    cheapest: { price: 1000, currency: 'USD' },
    cabin_categories: ['Interior', 'Ocean View'],
    itinerary: [{ port: 'Miami', day: 1 }],
    is_available: false,
  };
  const result4 = await hasDataChanged(data4Old, data4New);
  console.log(`  Result: ${result4.changed ? '✅ Changed' : '❌ No change'} (Expected: Changed)`);
  console.log(`  Changes detected: ${result4.changes.join(', ') || 'None'}\n`);

  // Test case 5: Multiple changes
  console.log('Test 5: Multiple changes');
  const data5Old = {
    cheapest: { price: 1000, currency: 'USD' },
    cabin_categories: ['Interior'],
    itinerary: [{ port: 'Miami', day: 1 }],
    is_available: true,
  };
  const data5New = {
    cheapest: { price: 850, currency: 'USD' },
    cabin_categories: ['Interior', 'Ocean View', 'Balcony'],
    itinerary: [
      { port: 'Miami', day: 1 },
      { port: 'Nassau', day: 2 },
    ],
    is_available: false,
  };
  const result5 = await hasDataChanged(data5Old, data5New);
  console.log(`  Result: ${result5.changed ? '✅ Changed' : '❌ No change'} (Expected: Changed)`);
  console.log(`  Changes detected: ${result5.changes.join(', ') || 'None'}\n`);

  // Test with actual database data
  if (process.env.DATABASE_URL) {
    console.log('📊 Testing with actual database data...\n');

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    try {
      // Get a sample cruise using raw SQL
      const result = await pool.query('SELECT cruise_id, raw_data FROM cruises LIMIT 1');

      if (result.rows.length > 0) {
        const cruise = result.rows[0];
        console.log(`Testing with cruise ID: ${cruise.cruise_id}`);

        // Test no change
        const rawData = cruise.raw_data || {};
        const noChangeResult = await hasDataChanged(rawData, rawData);
        console.log(`  Same data: ${noChangeResult.changed ? '❌ Changed' : '✅ No change'}`);

        // Test with modified price
        const modifiedData = { ...rawData };
        if (modifiedData.cheapest) {
          modifiedData.cheapest = {
            ...modifiedData.cheapest,
            price: (modifiedData.cheapest.price || 0) + 100,
          };
        }
        const priceChangeResult = await hasDataChanged(rawData, modifiedData);
        console.log(
          `  Price modified: ${priceChangeResult.changed ? '✅ Changed' : '❌ No change'}`
        );
        console.log(`  Changes: ${priceChangeResult.changes.join(', ')}\n`);
      } else {
        console.log('No cruises found in database\n');
      }
    } catch (error) {
      console.error('Database test error:', error.message);
    } finally {
      await pool.end();
    }
  }

  console.log('✅ Change detection tests completed');
}

// Run tests
testChangeDetection().catch(console.error);
