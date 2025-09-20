#!/usr/bin/env node
require('dotenv').config();
const postgres = require('postgres');

const client = postgres(process.env.DATABASE_URL, { ssl: 'require' });

async function debugVirginVoyages() {
  try {
    console.log('🔍 DEBUGGING VIRGIN VOYAGES PRICING ISSUES');
    console.log('=' .repeat(60));

    // Get a problematic Virgin Voyages cruise
    const cruiseId = '2163741'; // This one showed major mismatches

    const result = await client`
      SELECT
        id,
        name,
        interior_price,
        oceanview_price,
        balcony_price,
        suite_price,
        raw_data,
        updated_at
      FROM cruises
      WHERE id = ${cruiseId}
    `;

    if (result.length === 0) {
      console.log('Cruise not found');
      return;
    }

    const cruise = result[0];
    console.log(`\nCruise ${cruiseId}: ${cruise.name}`);
    console.log('Updated:', cruise.updated_at);

    console.log('\n📊 DATABASE PRICES:');
    console.log('  Interior:', cruise.interior_price);
    console.log('  Oceanview:', cruise.oceanview_price);
    console.log('  Balcony:', cruise.balcony_price);
    console.log('  Suite:', cruise.suite_price);

    // Check raw_data structure
    let rawData = cruise.raw_data;

    // Parse if string
    if (typeof rawData === 'string') {
      rawData = JSON.parse(rawData);
    }

    console.log('\n🔍 RAW DATA STRUCTURE:');
    console.log('Top-level keys:', Object.keys(rawData).slice(0, 30).join(', '));

    // Check various price locations
    console.log('\n💰 PRICE FIELDS IN RAW DATA:');

    // Check top-level cheapest fields
    console.log('\nTop-level cheapest fields:');
    console.log('  cheapestinside:', rawData.cheapestinside);
    console.log('  cheapestoutside:', rawData.cheapestoutside);
    console.log('  cheapestbalcony:', rawData.cheapestbalcony);
    console.log('  cheapestsuite:', rawData.cheapestsuite);

    // Check cheapest object
    if (rawData.cheapest) {
      console.log('\ncheapest object:');
      console.log('  Keys:', Object.keys(rawData.cheapest).join(', '));

      if (rawData.cheapest.combined) {
        console.log('\ncheapest.combined:');
        console.log('  inside:', rawData.cheapest.combined.inside);
        console.log('  outside:', rawData.cheapest.combined.outside);
        console.log('  balcony:', rawData.cheapest.combined.balcony);
        console.log('  suite:', rawData.cheapest.combined.suite);
      }

      if (rawData.cheapest.prices) {
        console.log('\ncheapest.prices:');
        console.log('  inside:', rawData.cheapest.prices.inside);
        console.log('  outside:', rawData.cheapest.prices.outside);
        console.log('  balcony:', rawData.cheapest.prices.balcony);
        console.log('  suite:', rawData.cheapest.prices.suite);
      }
    }

    // Check if there are cabin-specific price fields
    console.log('\n🏠 CABIN PRICE STRUCTURES:');

    // Look for any field containing 'price' or 'cabin'
    const priceFields = Object.keys(rawData).filter(key =>
      key.toLowerCase().includes('price') ||
      key.toLowerCase().includes('cabin') ||
      key.toLowerCase().includes('inside') ||
      key.toLowerCase().includes('outside') ||
      key.toLowerCase().includes('balcony') ||
      key.toLowerCase().includes('suite')
    );

    console.log('Price-related fields:', priceFields.join(', '));

    // Check specific Virgin Voyages structure
    if (rawData.prices) {
      console.log('\nprices object exists:');
      const priceKeys = Object.keys(rawData.prices).slice(0, 5);
      console.log('  First 5 keys:', priceKeys.join(', '));

      // Check first price entry
      const firstPriceKey = priceKeys[0];
      if (firstPriceKey) {
        const firstPrice = rawData.prices[firstPriceKey];
        console.log(`\n  Sample price entry (${firstPriceKey}):`);
        console.log('    Type:', typeof firstPrice);
        if (typeof firstPrice === 'object' && firstPrice) {
          console.log('    Keys:', Object.keys(firstPrice).join(', '));

          // Check for nested cabin structure
          if (firstPrice.cabins) {
            const cabinKeys = Object.keys(firstPrice.cabins).slice(0, 3);
            console.log('    Cabin keys:', cabinKeys.join(', '));

            const firstCabinKey = cabinKeys[0];
            if (firstCabinKey) {
              const cabin = firstPrice.cabins[firstCabinKey];
              console.log(`\n    Sample cabin (${firstCabinKey}):`);
              console.log('      Keys:', Object.keys(cabin).join(', '));
              if (cabin.occupancy) {
                console.log('      Occupancy keys:', Object.keys(cabin.occupancy).join(', '));
                const firstOccupancy = Object.keys(cabin.occupancy)[0];
                if (firstOccupancy) {
                  console.log(`      Sample occupancy (${firstOccupancy}):`, cabin.occupancy[firstOccupancy]);
                }
              }
            }
          }
        }
      }
    }

    // Check if there's a different structure for Virgin
    if (rawData.cabins) {
      console.log('\ncabins object exists:');
      const cabinKeys = Object.keys(rawData.cabins).slice(0, 5);
      console.log('  First 5 cabin keys:', cabinKeys.join(', '));

      const firstCabin = rawData.cabins[cabinKeys[0]];
      if (firstCabin) {
        console.log(`\n  Sample cabin (${cabinKeys[0]}):`);
        console.log('    Keys:', Object.keys(firstCabin).slice(0, 10).join(', '));
        console.log('    cabin_type:', firstCabin.cabin_type || firstCabin.cabintype);
        console.log('    price:', firstCabin.price);
      }
    }

    console.log('\n💡 ANALYSIS:');
    console.log('The mismatch suggests Virgin Voyages prices are stored differently.');
    console.log('We need to identify the correct extraction logic for this cruise line.');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
  }
}

debugVirginVoyages();
