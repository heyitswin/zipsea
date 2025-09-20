require('dotenv').config();
const { Pool } = require('pg');

// Use production URL if available, otherwise use default
const connectionString = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;

console.log('Connecting to:', connectionString.includes('production') ? 'PRODUCTION' : 'STAGING/LOCAL');

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkCruise() {
  try {
    // Check cruises table
    const cruiseResult = await pool.query(`
      SELECT
        id,
        name,
        interior_price,
        oceanview_price,
        balcony_price,
        suite_price,
        cheapest_price,
        updated_at,
        CASE
          WHEN raw_data IS NOT NULL AND raw_data::text LIKE '{"0":%' THEN 'CORRUPTED'
          WHEN raw_data IS NOT NULL THEN 'VALID JSON'
          ELSE 'NULL'
        END as raw_data_status
      FROM cruises
      WHERE id = '2190299'
    `);

    if (cruiseResult.rows.length > 0) {
      const cruise = cruiseResult.rows[0];
      console.log('\n=== CRUISE 2190299 CURRENT STATUS ===');
      console.log('Name:', cruise.name);
      console.log('\nCurrent Prices in Database:');
      console.log('  Interior:', cruise.interior_price || 'NULL');
      console.log('  Oceanview:', cruise.oceanview_price || 'NULL');
      console.log('  Balcony:', cruise.balcony_price || 'NULL');
      console.log('  Suite:', cruise.suite_price || 'NULL');
      console.log('  Cheapest:', cruise.cheapest_price || 'NULL');
      console.log('\nRaw Data Status:', cruise.raw_data_status);
      console.log('Last Updated:', cruise.updated_at);

      // Check cheapest_pricing table
      const pricingResult = await pool.query(`
        SELECT
          interior,
          oceanview,
          balcony,
          suite,
          updated_at
        FROM cheapest_pricing
        WHERE cruise_id = '2190299'
      `);

      if (pricingResult.rows.length > 0) {
        const pricing = pricingResult.rows[0];
        console.log('\n=== CHEAPEST_PRICING TABLE ===');
        console.log('  Interior:', pricing.interior || 'NULL');
        console.log('  Oceanview:', pricing.oceanview || 'NULL');
        console.log('  Balcony:', pricing.balcony || 'NULL');
        console.log('  Suite:', pricing.suite || 'NULL');
        console.log('  Updated:', pricing.updated_at);
      } else {
        console.log('\n⚠️  No entry in cheapest_pricing table');
      }

      // Check raw_data for expected prices
      const rawDataResult = await pool.query(`
        SELECT
          raw_data::text as raw_text
        FROM cruises
        WHERE id = '2190299'
      `);

      if (rawDataResult.rows.length > 0 && rawDataResult.rows[0].raw_text) {
        const rawText = rawDataResult.rows[0].raw_text;

        // Check if it's corrupted or valid JSON
        if (rawText.startsWith('{"0":')) {
          console.log('\n❌ RAW_DATA IS CORRUPTED (character-by-character storage)');
        } else {
          try {
            const rawData = JSON.parse(rawText);
            console.log('\n=== RAW_DATA PRICES (from FTP) ===');
            console.log('These are the EXPECTED prices per documentation:');
            console.log('  cheapestinside:', rawData.cheapestinside || 'NOT FOUND');
            console.log('  cheapestoutside:', rawData.cheapestoutside || 'NOT FOUND');
            console.log('  cheapestbalcony:', rawData.cheapestbalcony || 'NOT FOUND');
            console.log('  cheapestsuite:', rawData.cheapestsuite || 'NOT FOUND');

            // Compare with what should be
            const expected = {
              interior: '1091.18',
              oceanview: '1391.18',
              balcony: '1919.18',
              suite: '3512.18'
            };

            console.log('\n=== PRICE COMPARISON ===');
            console.log('                Current DB  →  Expected (from raw_data)');
            console.log(`  Interior:     ${cruise.interior_price || 'NULL'}  →  ${expected.interior} ${cruise.interior_price === expected.interior ? '✅' : '❌'}`);
            console.log(`  Oceanview:    ${cruise.oceanview_price || 'NULL'}  →  ${expected.oceanview} ${cruise.oceanview_price === expected.oceanview ? '✅' : '❌'}`);
            console.log(`  Balcony:      ${cruise.balcony_price || 'NULL'}  →  ${expected.balcony} ${cruise.balcony_price === expected.balcony ? '✅' : '❌'}`);
            console.log(`  Suite:        ${cruise.suite_price || 'NULL'}  →  ${expected.suite} ${cruise.suite_price === expected.suite ? '✅' : '❌'}`);

            if (cruise.interior_price !== expected.interior ||
                cruise.oceanview_price !== expected.oceanview ||
                cruise.balcony_price !== expected.balcony ||
                cruise.suite_price !== expected.suite) {
              console.log('\n⚠️  PRICES NEED TO BE UPDATED!');
            } else {
              console.log('\n✅ All prices are correct!');
            }
          } catch (e) {
            console.log('\n❌ Could not parse raw_data as JSON:', e.message);
          }
        }
      }

    } else {
      console.log('❌ Cruise 2190299 not found in database');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkCruise();
