#!/usr/bin/env node

require('dotenv').config();
const { db } = require('../dist/db/connection');
const { sql } = require('drizzle-orm');

(async () => {
  try {
    console.log('Checking itinerary data in database for cruise 2143102...\n');

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
      console.log('=== Cruises table raw_data ===');

      try {
        const rawData = JSON.parse(cruise.raw_data_str);

        if (rawData.itinerary) {
          console.log('✅ Itinerary field EXISTS in raw_data');
          console.log(`Number of itinerary items: ${Object.keys(rawData.itinerary).length}`);

          // Show first few items
          const items = Object.entries(rawData.itinerary).slice(0, 3);
          console.log('\nFirst 3 itinerary items from database:');
          items.forEach(([key, item]) => {
            console.log(`  ${key}: Day ${item.day}, Port: ${item.port || 'N/A'}`);
          });
        } else {
          console.log('❌ Itinerary field NOT FOUND in raw_data');
        }

        if (rawData.ports) {
          console.log('\n✅ Ports field exists in raw_data');
          console.log(`Number of ports: ${Object.keys(rawData.ports).length}`);

          // Show ports
          const ports = Object.entries(rawData.ports).slice(0, 5);
          console.log('\nPorts from database:');
          ports.forEach(([key, port]) => {
            console.log(`  ${key}: ${port.name || port}`);
          });
        }

        if (rawData.itinerarydescription) {
          console.log('\n✅ Itinerary description exists:');
          console.log(rawData.itinerarydescription.substring(0, 200) + '...');
        }

      } catch (e) {
        console.log('Could not parse raw_data JSON:', e.message);
      }
    }

    // Check if there's an itinerary table
    const itineraryResult = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE '%itinerary%'
    `);

    console.log('\n=== Itinerary-related tables ===');
    if (itineraryResult && itineraryResult.length > 0) {
      itineraryResult.forEach(row => {
        console.log(`  - ${row.table_name}`);
      });
    } else {
      console.log('  No itinerary-related tables found');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
})();
