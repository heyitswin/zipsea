#!/usr/bin/env node

require('dotenv').config();
const { db } = require('../dist/db/connection');
const { sql } = require('drizzle-orm');

(async () => {
  try {
    const result = await db.execute(sql`
      SELECT
        id,
        interior_price,
        oceanview_price,
        balcony_price,
        suite_price,
        cheapest_price
      FROM cruises
      WHERE id = '2143102'
    `);

    if (result && result.length > 0) {
      const cruise = result[0];
      console.log('=== Cruises table price fields for 2143102 ===');
      console.log(`interior_price:  ${cruise.interior_price === null ? 'NULL' : '$' + cruise.interior_price}`);
      console.log(`oceanview_price: ${cruise.oceanview_price === null ? 'NULL' : '$' + cruise.oceanview_price} <-- SHOULD BE NULL`);
      console.log(`balcony_price:   ${cruise.balcony_price === null ? 'NULL' : '$' + cruise.balcony_price}`);
      console.log(`suite_price:     ${cruise.suite_price === null ? 'NULL' : '$' + cruise.suite_price} <-- SHOULD BE NULL`);
      console.log(`cheapest_price:  ${cruise.cheapest_price === null ? 'NULL' : '$' + cruise.cheapest_price}`);

      if (cruise.oceanview_price !== null || cruise.suite_price !== null) {
        console.log('\n❌ ERROR: oceanview_price and/or suite_price are NOT NULL in cruises table!');
        console.log('These values should be NULL based on the FTP data.');
        console.log('This is causing the frontend to display incorrect prices.');
      }
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
})();
