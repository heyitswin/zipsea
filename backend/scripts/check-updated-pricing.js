#!/usr/bin/env node

require('dotenv').config();
const { db } = require('../dist/db/connection');
const { sql } = require('drizzle-orm');

(async () => {
  try {
    const result = await db.execute(sql`
      SELECT
        cruise_id,
        interior_price,
        oceanview_price,
        balcony_price,
        suite_price
      FROM cheapest_pricing
      WHERE cruise_id = '2143102'
    `);

    if (result && result.length > 0) {
      const pricing = result[0];
      console.log('Cruise 2143102 pricing after manual sync:');
      console.log('==========================================');
      console.log(
        `Interior:    $${pricing.interior_price} ${pricing.interior_price == 801 ? '✅ UPDATED!' : '❌ Still old price (should be $801)'}`
      );
      console.log(`Ocean View:  $${pricing.oceanview_price || 'N/A'}`);
      console.log(
        `Balcony:     $${pricing.balcony_price} ${pricing.balcony_price == 1354 ? '✅ UPDATED!' : '❌ Still old price (should be $1354)'}`
      );
      console.log(`Suite:       $${pricing.suite_price || 'N/A'}`);

      console.log('\nComparison:');
      console.log('Old prices (Sep 11): Interior $424, Ocean View $764, Balcony $934');
      console.log('New prices (current FTP): Interior $801, Ocean View N/A, Balcony $1354');
    } else {
      console.log('No pricing found for cruise 2143102');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
})();
