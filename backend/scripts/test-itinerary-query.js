#!/usr/bin/env node

require('dotenv').config();
const { db } = require('../dist/db/connection');
const { sql } = require('drizzle-orm');

async function testItineraryQuery() {
  console.log('Testing itinerary query directly...\n');

  try {
    // Test 1: Direct SQL query
    console.log('1. Direct SQL query to cruise_itinerary:');
    const directResult = await db.execute(sql`
      SELECT * FROM cruise_itinerary
      WHERE cruise_id = '2143102'
      ORDER BY day_number
      LIMIT 5
    `);

    console.log(`   Found ${directResult.length} items`);
    if (directResult.length > 0) {
      console.log('   ✅ Data exists in cruise_itinerary table');
      directResult.forEach(item => {
        console.log(`     Day ${item.day_number}: ${item.port_name}`);
      });
    }

    // Test 2: Check if itineraries table exists
    console.log('\n2. Checking table names:');
    const tables = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('itineraries', 'cruise_itinerary')
    `);

    tables.forEach(t => {
      console.log(`   - ${t.table_name} exists`);
    });

    // Test 3: Import the schema and test
    console.log('\n3. Testing with imported schema:');
    const { itineraries } = require('../dist/db/schema/itineraries');
    const { ports } = require('../dist/db/schema/ports');
    const { eq, asc } = require('drizzle-orm');

    try {
      const schemaResult = await db
        .select({
          itinerary: itineraries,
          port: ports,
        })
        .from(itineraries)
        .leftJoin(ports, eq(itineraries.portId, ports.id))
        .where(eq(itineraries.cruiseId, '2143102'))
        .orderBy(asc(itineraries.dayNumber))
        .limit(5);

      console.log(`   Schema query returned ${schemaResult.length} items`);
      if (schemaResult.length > 0) {
        console.log('   ✅ Schema is working correctly!');
      } else {
        console.log('   ❌ Schema query returned empty - table mismatch');
      }
    } catch (schemaError) {
      console.log('   ❌ Schema query failed:', schemaError.message);
      if (schemaError.message.includes('itineraries')) {
        console.log('   -> Schema still pointing to "itineraries" table instead of "cruise_itinerary"');
        console.log('   -> Need to rebuild and redeploy!');
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

testItineraryQuery().catch(console.error);
