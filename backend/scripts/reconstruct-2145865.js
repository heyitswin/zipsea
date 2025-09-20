require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function reconstructAndAnalyze() {
  try {
    const result = await pool.query(`
      SELECT raw_data
      FROM cruises
      WHERE id = '2145865'
    `);

    if (result.rows.length > 0) {
      const corruptedData = result.rows[0].raw_data;

      console.log('🔧 RECONSTRUCTING CORRUPTED JSON FOR CRUISE 2145865');
      console.log('=' .repeat(60));

      // Reconstruct the JSON string from character-by-character storage
      const chars = [];
      let i = 0;
      while (corruptedData[i.toString()] !== undefined) {
        chars.push(corruptedData[i.toString()]);
        i++;
      }

      const reconstructedString = chars.join('');
      console.log(`\nReconstructed ${i} characters`);

      // Parse the reconstructed JSON
      const actualData = JSON.parse(reconstructedString);

      // Save to file for inspection
      fs.writeFileSync('/tmp/cruise-2145865-reconstructed.json', JSON.stringify(actualData, null, 2));
      console.log('Reconstructed data saved to: /tmp/cruise-2145865-reconstructed.json');

      console.log('\n📊 ACTUAL PRICES FROM RECONSTRUCTED DATA:');
      console.log('-' .repeat(50));

      // Check top-level cheapest fields
      console.log('\nTop-level cheapest fields:');
      console.log(`  cheapestinside:  $${actualData.cheapestinside || 'NOT FOUND'}`);
      console.log(`  cheapestoutside: $${actualData.cheapestoutside || 'NOT FOUND'}`);
      console.log(`  cheapestbalcony: $${actualData.cheapestbalcony || 'NOT FOUND'}`);
      console.log(`  cheapestsuite:   $${actualData.cheapestsuite || 'NOT FOUND'}`);

      // Check cheapest object
      if (actualData.cheapest) {
        console.log('\nCheapest object:');
        if (actualData.cheapest.combined) {
          console.log('  cheapest.combined:');
          console.log(`    inside:  $${actualData.cheapest.combined.inside || 'N/A'}`);
          console.log(`    outside: $${actualData.cheapest.combined.outside || 'N/A'}`);
          console.log(`    balcony: $${actualData.cheapest.combined.balcony || 'N/A'}`);
          console.log(`    suite:   $${actualData.cheapest.combined.suite || 'N/A'}`);
        }
      }

      // Check for individual cheapest objects
      if (actualData.cheapestinside_obj) {
        console.log('\ncheapestinside_obj:');
        console.log(`  price: $${actualData.cheapestinside_obj.price || 'N/A'}`);
        console.log(`  adultprice: $${actualData.cheapestinside_obj.adultprice || 'N/A'}`);
      }

      // Check cabins
      if (actualData.cabins) {
        const cabinKeys = Object.keys(actualData.cabins);
        console.log(`\n📦 Cabins: ${cabinKeys.length} total`);

        // Analyze cabin prices by type
        const pricesByType = {
          interior: [],
          oceanview: [],
          balcony: [],
          suite: []
        };

        Object.values(actualData.cabins).forEach(cabin => {
          if (cabin.price) {
            const price = parseFloat(cabin.price);
            const type = (cabin.cabintype || '').toLowerCase();

            if (type.includes('inside') || type.includes('interior')) {
              pricesByType.interior.push(price);
            } else if (type.includes('outside') || type.includes('ocean')) {
              pricesByType.oceanview.push(price);
            } else if (type.includes('balcony')) {
              pricesByType.balcony.push(price);
            } else if (type.includes('suite')) {
              pricesByType.suite.push(price);
            }
          }
        });

        console.log('\nLowest cabin prices by type:');
        Object.entries(pricesByType).forEach(([type, prices]) => {
          if (prices.length > 0) {
            prices.sort((a, b) => a - b);
            console.log(`  ${type}: $${prices[0]} (from ${prices.length} cabins)`);
          } else {
            console.log(`  ${type}: No cabins found`);
          }
        });

        // Show first 3 cabins as examples
        const firstThree = Object.entries(actualData.cabins).slice(0, 3);
        console.log('\nFirst 3 cabins:');
        firstThree.forEach(([id, cabin]) => {
          console.log(`  ${id}: $${cabin.price} - ${cabin.cabintype || 'Unknown'} (${cabin.category || 'N/A'})`);
        });
      }

      // Compare with database
      console.log('\n⚠️  CURRENT DATABASE PRICES:');
      const dbPrices = await pool.query(`
        SELECT interior_price, oceanview_price, balcony_price, suite_price
        FROM cruises
        WHERE id = '2145865'
      `);

      if (dbPrices.rows.length > 0) {
        const prices = dbPrices.rows[0];
        console.log(`  Interior:  $${prices.interior_price} ❌ WRONG`);
        console.log(`  Oceanview: $${prices.oceanview_price} ❌ WRONG`);
        console.log(`  Balcony:   $${prices.balcony_price} ❌ WRONG`);
        console.log(`  Suite:     $${prices.suite_price} ❌ WRONG`);
      }

      console.log('\n🎯 DIAGNOSIS:');
      console.log('-' .repeat(50));
      console.log('1. Raw_data is corrupted (character-by-character storage)');
      console.log('2. Webhook processor cannot parse corrupted data');
      console.log('3. Database has wrong prices ($101 instead of actual prices)');
      console.log('4. Need to fix corrupted raw_data and re-process prices');

    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

reconstructAndAnalyze();
