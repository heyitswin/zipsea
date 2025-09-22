/**
 * Check raw_data field for cruise 2144014
 */

const postgres = require('postgres');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const databaseUrl = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;
const sql = postgres(databaseUrl, {
  ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function checkRawData() {
  try {
    const result = await sql`
      SELECT
        id,
        cruise_id,
        name,
        sailing_date,
        interior_price,
        oceanview_price,
        balcony_price,
        suite_price,
        cheapest_price,
        raw_data,
        updated_at
      FROM cruises
      WHERE id = '2144014'
    `;

    if (result.length === 0) {
      console.log('Cruise 2144014 not found');
      return;
    }

    const cruise = result[0];
    console.log('CRUISE 2144014 DATABASE INFO:');
    console.log('=' .repeat(60));
    console.log('Name:', cruise.name);
    console.log('Sailing Date:', cruise.sailing_date);
    console.log('Last Updated:', cruise.updated_at);
    console.log();

    console.log('CURRENT DATABASE PRICES:');
    console.log('  Interior:  $', cruise.interior_price);
    console.log('  Oceanview: $', cruise.oceanview_price);
    console.log('  Balcony:   $', cruise.balcony_price);
    console.log('  Suite:     $', cruise.suite_price);
    console.log('  Cheapest:  $', cruise.cheapest_price);
    console.log();

    if (cruise.raw_data) {
      console.log('RAW DATA FIELD EXISTS ✅');

      // Parse raw_data
      let rawData;
      try {
        rawData = typeof cruise.raw_data === 'string'
          ? JSON.parse(cruise.raw_data)
          : cruise.raw_data;
      } catch (e) {
        console.log('Error parsing raw_data:', e.message);
        return;
      }

      // Save to file for inspection
      fs.writeFileSync('cruise-2144014-rawdata.json', JSON.stringify(rawData, null, 2));
      console.log('Saved raw_data to cruise-2144014-rawdata.json');
      console.log();

      // Check for cheapest fields
      console.log('CHECKING FOR cheapestX FIELDS IN RAW DATA:');
      console.log('  cheapestinterior:', rawData.cheapestinterior || 'NOT FOUND');
      console.log('  cheapestoutside:', rawData.cheapestoutside || 'NOT FOUND');
      console.log('  cheapestbalcony:', rawData.cheapestbalcony || 'NOT FOUND');
      console.log('  cheapestsuite:', rawData.cheapestsuite || 'NOT FOUND');
      console.log();

      // Check if these match what's in the database
      if (rawData.cheapestinterior || rawData.cheapestoutside ||
          rawData.cheapestbalcony || rawData.cheapestsuite) {
        console.log('COMPARISON:');
        console.log('Category    | Database    | Raw Data cheapestX | Match?');
        console.log('-'.repeat(60));

        const formatPrice = (price) => price ? `$${price}`.padEnd(11) : 'null'.padEnd(11);

        console.log(`Interior    | ${formatPrice(cruise.interior_price)} | ${formatPrice(rawData.cheapestinterior)} | ${cruise.interior_price == rawData.cheapestinterior ? '✅' : '❌ MISMATCH'}`);
        console.log(`Oceanview   | ${formatPrice(cruise.oceanview_price)} | ${formatPrice(rawData.cheapestoutside)} | ${cruise.oceanview_price == rawData.cheapestoutside ? '✅' : '❌ MISMATCH'}`);
        console.log(`Balcony     | ${formatPrice(cruise.balcony_price)} | ${formatPrice(rawData.cheapestbalcony)} | ${cruise.balcony_price == rawData.cheapestbalcony ? '✅' : '❌ MISMATCH'}`);
        console.log(`Suite       | ${formatPrice(cruise.suite_price)} | ${formatPrice(rawData.cheapestsuite)} | ${cruise.suite_price == rawData.cheapestsuite ? '✅' : '❌ MISMATCH'}`);
      }

      // Check for pricing array
      if (rawData.pricing && Array.isArray(rawData.pricing)) {
        console.log('\nPRICING ARRAY FOUND with', rawData.pricing.length, 'items');

        // Extract lowest prices from array
        const byCategory = {};
        rawData.pricing.forEach(p => {
          const cat = p.cabin_category?.toLowerCase();
          if (!byCategory[cat]) byCategory[cat] = [];
          byCategory[cat].push(parseFloat(p.price));
        });

        console.log('\nLowest prices from pricing array:');
        const extractedPrices = {};
        for (const [cat, prices] of Object.entries(byCategory)) {
          if (prices.length > 0) {
            const lowest = Math.min(...prices);
            extractedPrices[cat] = lowest;
            console.log(`  ${cat}: $${lowest}`);
          }
        }

        // Check if DB matches pricing array
        console.log('\nDoes DB match pricing array instead of cheapestX?');
        console.log('  Interior:', extractedPrices.interior == cruise.interior_price ? `✅ YES (array: ${extractedPrices.interior})` : '❌ NO');
        console.log('  Oceanview:', extractedPrices.oceanview == cruise.oceanview_price ? `✅ YES (array: ${extractedPrices.oceanview})` : '❌ NO');
        console.log('  Balcony:', extractedPrices.balcony == cruise.balcony_price ? `✅ YES (array: ${extractedPrices.balcony})` : '❌ NO');
        console.log('  Suite:', extractedPrices.suite == cruise.suite_price ? `✅ YES (array: ${extractedPrices.suite})` : '❌ NO');

        const allMatchArray =
          extractedPrices.interior == cruise.interior_price &&
          extractedPrices.oceanview == cruise.oceanview_price &&
          extractedPrices.balcony == cruise.balcony_price &&
          extractedPrices.suite == cruise.suite_price;

        if (allMatchArray) {
          console.log('\n' + '🔍'.repeat(20));
          console.log('PROBLEM CONFIRMED!');
          console.log('🔍'.repeat(20));
          console.log('Webhook processor IS extracting from pricing array');
          console.log('instead of using the cheapestX fields!');
        }
      }

      // Check for other price structures
      if (rawData.cheapest) {
        console.log('\n"cheapest" object found:');
        console.log('  Keys:', Object.keys(rawData.cheapest));
        if (rawData.cheapest.combined) {
          console.log('  cheapest.combined:', rawData.cheapest.combined);
        }
        if (rawData.cheapest.prices) {
          console.log('  cheapest.prices:', rawData.cheapest.prices);
        }
      }

    } else {
      console.log('❌ NO RAW DATA STORED');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

checkRawData();
