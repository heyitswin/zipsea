#!/usr/bin/env node

/**
 * Test script to verify that webhook processor now correctly stores complete cruise data
 * including itinerary, not just pricing
 */

require('dotenv').config();
const { db } = require('../dist/db/connection');
const { sql } = require('drizzle-orm');
const { WebhookProcessorOptimizedV2 } = require('../dist/services/webhook-processor-optimized-v2.service');

async function testCruiseSync(cruiseId) {
  console.log(`\n=== Testing Sync for Cruise ${cruiseId} ===\n`);

  try {
    // Get cruise info
    const query = sql`
      SELECT
        c.id,
        c.name,
        c.cruise_line_id,
        c.ship_id,
        c.sailing_date,
        c.raw_data,
        cl.name as cruise_line_name,
        s.name as ship_name
      FROM cruises c
      LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      LEFT JOIN ships s ON c.ship_id = s.id
      WHERE c.id = ${cruiseId}
      LIMIT 1
    `;

    const result = await db.execute(query);
    const cruise = (result.rows || result)[0];

    if (!cruise) {
      console.log('Cruise not found!');
      return;
    }

    console.log('Cruise Details:');
    console.log(`  Name: ${cruise.name}`);
    console.log(`  Line: ${cruise.cruise_line_name} (${cruise.cruise_line_id})`);
    console.log(`  Ship: ${cruise.ship_name} (${cruise.ship_id})`);
    console.log(`  Sailing: ${cruise.sailing_date}`);

    // Check current raw_data
    console.log('\n=== Current raw_data Analysis ===');
    if (cruise.raw_data) {
      const rawData = typeof cruise.raw_data === 'string'
        ? JSON.parse(cruise.raw_data)
        : cruise.raw_data;

      const keys = Object.keys(rawData);
      console.log(`Total fields in raw_data: ${keys.length}`);
      console.log(`Sample fields: ${keys.slice(0, 15).join(', ')}`);

      // Check for important fields
      console.log('\nImportant fields check:');
      console.log(`  ✓ Has itinerary: ${!!rawData.itinerary}`);
      if (rawData.itinerary) {
        console.log(`    - Itinerary length: ${rawData.itinerary.length} days`);
      }
      console.log(`  ✓ Has shipcontent: ${!!rawData.shipcontent}`);
      console.log(`  ✓ Has linecontent: ${!!rawData.linecontent}`);
      console.log(`  ✓ Has cheapest: ${!!rawData.cheapest}`);
      console.log(`  ✓ Has prices: ${!!rawData.prices}`);
      console.log(`  ✓ Has cabins: ${!!rawData.cabins}`);
      console.log(`  ✓ Has codetocruiseid: ${!!rawData.codetocruiseid}`);
      console.log(`  ✓ Has name: ${!!rawData.name}`);
    } else {
      console.log('No raw_data found');
    }

    // Build FTP path
    const sailingDate = new Date(cruise.sailing_date);
    const year = sailingDate.getFullYear();
    const month = String(sailingDate.getMonth() + 1).padStart(2, '0');
    const ftpPath = `${year}/${month}/${cruise.cruise_line_id}/${cruise.ship_id}/${cruiseId}.json`;

    console.log(`\n=== Processing from FTP ===`);
    console.log(`FTP Path: ${ftpPath}`);

    // Process through webhook processor
    const processor = new WebhookProcessorOptimizedV2();
    const file = {
      path: ftpPath,
      lineId: cruise.cruise_line_id,
      shipId: cruise.ship_id,
      cruiseId: cruiseId,
    };

    console.log('Processing file through WebhookProcessorOptimizedV2...');
    const success = await WebhookProcessorOptimizedV2.processFileStatic(file);

    if (success) {
      console.log('✅ Processing completed successfully!');

      // Check updated raw_data
      console.log('\n=== Verifying Updated Data ===');
      const checkQuery = sql`
        SELECT raw_data
        FROM cruises
        WHERE id = ${cruiseId}
        LIMIT 1
      `;

      const checkResult = await db.execute(checkQuery);
      const updatedCruise = (checkResult.rows || checkResult)[0];

      if (updatedCruise && updatedCruise.raw_data) {
        const updatedData = typeof updatedCruise.raw_data === 'string'
          ? JSON.parse(updatedCruise.raw_data)
          : updatedCruise.raw_data;

        const keys = Object.keys(updatedData);
        console.log(`Total fields after update: ${keys.length}`);

        console.log('\nField verification after update:');
        console.log(`  ✓ Has itinerary: ${!!updatedData.itinerary}`);
        if (updatedData.itinerary) {
          console.log(`    - Itinerary length: ${updatedData.itinerary.length} days`);
          console.log('    - Sample ports:');
          updatedData.itinerary.slice(0, 3).forEach((day, idx) => {
            const portName = day.name || day.itineraryname || day.portname || 'Unknown';
            console.log(`      Day ${idx + 1}: ${portName}`);
          });
        }
        console.log(`  ✓ Has shipcontent: ${!!updatedData.shipcontent}`);
        console.log(`  ✓ Has linecontent: ${!!updatedData.linecontent}`);
        console.log(`  ✓ Has all pricing data: ${!!updatedData.cheapest}`);

        // Check if we preserved everything
        if (updatedData.itinerary && updatedData.shipcontent && updatedData.linecontent) {
          console.log('\n✅ SUCCESS: Complete cruise data is now stored in raw_data!');
        } else {
          console.log('\n⚠️  WARNING: Some data may still be missing');
        }
      }
    } else {
      console.log('❌ Processing failed!');
    }

  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Run test
const cruiseId = process.argv[2] || '2094963'; // Default to Carnival Valor

console.log('=== Complete Data Sync Test ===');
console.log('This script tests if the webhook processor correctly stores');
console.log('complete cruise data (including itinerary) in raw_data field.');

testCruiseSync(cruiseId).then(() => {
  console.log('\n=== Test Complete ===');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
