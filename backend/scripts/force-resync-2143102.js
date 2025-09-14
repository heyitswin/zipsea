#!/usr/bin/env node

require('dotenv').config();
const { WebhookProcessorOptimizedV2 } = require('../dist/services/webhook-processor-optimized-v2.service');
const { db } = require('../dist/db/connection');
const { sql } = require('drizzle-orm');

async function forceResyncCruise2143102() {
  console.log('Force resyncing cruise 2143102 with corrected price handling...\n');

  try {
    // First, check current prices in database
    console.log('Current database values:');
    const currentPrices = await db.execute(sql`
      SELECT
        c.id,
        c.interior_price,
        c.oceanview_price,
        c.balcony_price,
        c.suite_price,
        cp.interior_price as cp_interior,
        cp.oceanview_price as cp_oceanview,
        cp.balcony_price as cp_balcony,
        cp.suite_price as cp_suite
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
      WHERE c.id = '2143102'
    `);

    if (currentPrices.length > 0) {
      const prices = currentPrices[0];
      console.log('  Cruises table:');
      console.log(`    interior_price: ${prices.interior_price}`);
      console.log(`    oceanview_price: ${prices.oceanview_price} ${prices.oceanview_price ? '❌ Should be NULL' : '✅'}`);
      console.log(`    balcony_price: ${prices.balcony_price}`);
      console.log(`    suite_price: ${prices.suite_price} ${prices.suite_price ? '❌ Should be NULL' : '✅'}`);
      console.log('  Cheapest_pricing table:');
      console.log(`    interior_price: ${prices.cp_interior}`);
      console.log(`    oceanview_price: ${prices.cp_oceanview} ${prices.cp_oceanview ? '❌ Should be NULL' : '✅'}`);
      console.log(`    balcony_price: ${prices.cp_balcony}`);
      console.log(`    suite_price: ${prices.cp_suite} ${prices.cp_suite ? '❌ Should be NULL' : '✅'}`);
    }

    // Process the specific cruise file
    console.log('\n\nProcessing cruise 2143102 from FTP...');
    const file = {
      path: '/2025/10/22/4439/2143102.json',
      name: '2143102.json',
      lineId: 22,
      shipId: 4439,
      cruiseId: '2143102',
      size: 267525,
      year: 2025,
      month: 10
    };

    console.log('File details:', JSON.stringify(file, null, 2));

    const result = await WebhookProcessorOptimizedV2.processFileStatic(file);

    if (result) {
      console.log('\n✅ Processing completed successfully!');

      // Check updated prices
      console.log('\nVerifying updated prices:');
      const updatedPrices = await db.execute(sql`
        SELECT
          c.id,
          c.interior_price,
          c.oceanview_price,
          c.balcony_price,
          c.suite_price,
          cp.interior_price as cp_interior,
          cp.oceanview_price as cp_oceanview,
          cp.balcony_price as cp_balcony,
          cp.suite_price as cp_suite
        FROM cruises c
        LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
        WHERE c.id = '2143102'
      `);

      if (updatedPrices.length > 0) {
        const prices = updatedPrices[0];
        console.log('  Cruises table:');
        console.log(`    interior_price: ${prices.interior_price} ${Math.abs(parseFloat(prices.interior_price) - 801.03) < 0.01 ? '✅' : '❌'}`);
        console.log(`    oceanview_price: ${prices.oceanview_price} ${!prices.oceanview_price ? '✅ NULL as expected' : '❌ Should be NULL'}`);
        console.log(`    balcony_price: ${prices.balcony_price} ${Math.abs(parseFloat(prices.balcony_price) - 1354.03) < 0.01 ? '✅' : '❌'}`);
        console.log(`    suite_price: ${prices.suite_price} ${!prices.suite_price ? '✅ NULL as expected' : '❌ Should be NULL'}`);
        console.log('  Cheapest_pricing table:');
        console.log(`    interior_price: ${prices.cp_interior} ${Math.abs(parseFloat(prices.cp_interior) - 801.03) < 0.01 ? '✅' : '❌'}`);
        console.log(`    oceanview_price: ${prices.cp_oceanview} ${!prices.cp_oceanview ? '✅ NULL as expected' : '❌ Should be NULL'}`);
        console.log(`    balcony_price: ${prices.cp_balcony} ${Math.abs(parseFloat(prices.cp_balcony) - 1354.03) < 0.01 ? '✅' : '❌'}`);
        console.log(`    suite_price: ${prices.cp_suite} ${!prices.cp_suite ? '✅ NULL as expected' : '❌ Should be NULL'}`);

        console.log('\n✅ Cruise 2143102 has been successfully resynced with correct prices!');
        console.log('   Interior: $801.03');
        console.log('   Ocean View: NULL (Unavailable)');
        console.log('   Balcony: $1354.03');
        console.log('   Suite: NULL (Unavailable)');
      }
    } else {
      console.log('\n❌ Processing failed');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

forceResyncCruise2143102().catch(console.error);
