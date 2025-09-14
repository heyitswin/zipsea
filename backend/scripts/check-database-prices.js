#!/usr/bin/env node

require('dotenv').config();
const { db } = require('../dist/db/connection');
const { sql } = require('drizzle-orm');

(async () => {
  try {
    console.log('Checking database values for cruise 2143102...\n');

    // Check cheapest_pricing table
    const pricingResult = await db.execute(sql`
      SELECT
        cruise_id,
        interior_price,
        oceanview_price,
        balcony_price,
        suite_price,
        cheapest_price
      FROM cheapest_pricing
      WHERE cruise_id = '2143102'
    `);

    if (pricingResult && pricingResult.length > 0) {
      const pricing = pricingResult[0];
      console.log('=== cheapest_pricing table ===');
      console.log(`Interior:    ${pricing.interior_price === null ? 'NULL' : '$' + pricing.interior_price}`);
      console.log(`Ocean View:  ${pricing.oceanview_price === null ? 'NULL' : '$' + pricing.oceanview_price}`);
      console.log(`Balcony:     ${pricing.balcony_price === null ? 'NULL' : '$' + pricing.balcony_price}`);
      console.log(`Suite:       ${pricing.suite_price === null ? 'NULL' : '$' + pricing.suite_price}`);
      console.log(`Cheapest:    ${pricing.cheapest_price === null ? 'NULL' : '$' + pricing.cheapest_price}`);
    }

    // Check cruises table raw_data field
    const cruiseResult = await db.execute(sql`
      SELECT
        id,
        raw_data::text as raw_data_str
      FROM cruises
      WHERE id = '2143102'
    `);

    if (cruiseResult && cruiseResult.length > 0) {
      const cruise = cruiseResult[0];
      console.log('\n=== cruises table raw_data ===');

      try {
        const rawData = JSON.parse(cruise.raw_data_str);
        console.log('cheapestinside:', rawData.cheapestinside);
        console.log('cheapestoutside:', rawData.cheapestoutside);
        console.log('cheapestbalcony:', rawData.cheapestbalcony);
        console.log('cheapestsuite:', rawData.cheapestsuite);

        if (rawData.cheapest && rawData.cheapest.combined) {
          console.log('\nCombined in raw_data:');
          console.log('  inside:', rawData.cheapest.combined.inside);
          console.log('  outside:', rawData.cheapest.combined.outside);
          console.log('  balcony:', rawData.cheapest.combined.balcony);
          console.log('  suite:', rawData.cheapest.combined.suite);
        }
      } catch (e) {
        console.log('Could not parse raw_data JSON');
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
})();
