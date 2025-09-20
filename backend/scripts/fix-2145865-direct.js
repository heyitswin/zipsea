#!/usr/bin/env node
require('dotenv').config();
const postgres = require('postgres');

const client = postgres(process.env.DATABASE_URL, { ssl: 'require' });

async function fixCruise2145865() {
  try {
    // Get the corrupted raw_data
    const result = await client`
      SELECT raw_data
      FROM cruises
      WHERE id = '2145865'
    `;

    if (result.length === 0) {
      console.log('Cruise 2145865 not found');
      return;
    }

    const corruptedData = result[0].raw_data;

    // Check if it's actually corrupted
    if (!corruptedData['0']) {
      console.log('Raw data does not appear to be corrupted');
      return;
    }

    console.log('Found corrupted raw_data with', Object.keys(corruptedData).length, 'character keys');

    // Reconstruct the JSON string from character-by-character storage
    let jsonString = '';
    let index = 0;
    while (corruptedData[index.toString()] !== undefined) {
      jsonString += corruptedData[index.toString()];
      index++;
    }

    console.log('Reconstructed JSON string of length:', jsonString.length);

    // Parse the reconstructed JSON
    const properData = JSON.parse(jsonString);

    // Extract prices from the correct fields
    const prices = {
      interior: parseFloat(properData.cheapestinside?.replace(/[^0-9.-]/g, '') || 0) || null,
      oceanview: parseFloat(properData.cheapestoutside?.replace(/[^0-9.-]/g, '') || 0) || null,
      balcony: parseFloat(properData.cheapestbalcony?.replace(/[^0-9.-]/g, '') || 0) || null,
      suite: parseFloat(properData.cheapestsuite?.replace(/[^0-9.-]/g, '') || 0) || null
    };

    console.log('\nExtracted prices:');
    console.log('  Interior:  $' + prices.interior);
    console.log('  Oceanview: $' + prices.oceanview);
    console.log('  Balcony:   $' + prices.balcony);
    console.log('  Suite:     $' + prices.suite);

    // Calculate cheapest price
    const validPrices = Object.values(prices).filter(p => p && p > 0);
    const cheapestPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;

    console.log('  Cheapest:  $' + cheapestPrice);

    // Update the database
    console.log('\nUpdating database...');
    const updateResult = await client`
      UPDATE cruises
      SET
        raw_data = ${properData},
        interior_price = ${prices.interior},
        oceanview_price = ${prices.oceanview},
        balcony_price = ${prices.balcony},
        suite_price = ${prices.suite},
        cheapest_price = ${cheapestPrice},
        updated_at = NOW()
      WHERE id = '2145865'
      RETURNING id, interior_price, oceanview_price, balcony_price, suite_price, cheapest_price
    `;

    if (updateResult.length > 0) {
      console.log('\n✅ Successfully updated cruise 2145865:');
      const updated = updateResult[0];
      console.log('  Interior:  $' + updated.interior_price);
      console.log('  Oceanview: $' + updated.oceanview_price);
      console.log('  Balcony:   $' + updated.balcony_price);
      console.log('  Suite:     $' + updated.suite_price);
      console.log('  Cheapest:  $' + updated.cheapest_price);
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
  }
}

fixCruise2145865();
