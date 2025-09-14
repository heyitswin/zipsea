#!/usr/bin/env node

require('dotenv').config();
const { db } = require('../dist/db/connection');
const { sql } = require('drizzle-orm');

(async () => {
  try {
    // Check cruise_itinerary table
    const itineraryResult = await db.execute(sql`
      SELECT *
      FROM cruise_itinerary
      WHERE cruise_id = '2143102'
      LIMIT 10
    `);

    console.log('=== cruise_itinerary table for cruise 2143102 ===');
    if (itineraryResult && itineraryResult.length > 0) {
      console.log(`Found ${itineraryResult.length} itinerary items\n`);
      itineraryResult.forEach((item, index) => {
        console.log(`Day ${item.day_number || index + 1}:`);
        console.log(`  Port: ${item.port_name || 'N/A'}`);
        console.log(`  Arrive: ${item.arrival_time || 'N/A'}`);
        console.log(`  Depart: ${item.departure_time || 'N/A'}`);
        console.log('');
      });
    } else {
      console.log('❌ No itinerary items found in cruise_itinerary table for cruise 2143102');
    }

    // Check table structure
    const structureResult = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'cruise_itinerary'
      ORDER BY ordinal_position
    `);

    console.log('\n=== cruise_itinerary table structure ===');
    if (structureResult && structureResult.length > 0) {
      structureResult.forEach(col => {
        console.log(`  ${col.column_name}: ${col.data_type}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
})();
