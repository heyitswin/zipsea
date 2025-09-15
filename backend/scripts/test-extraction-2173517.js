require('dotenv').config();
const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
const { sql } = require('drizzle-orm');
const { extractItineraryFromRawData } = require('../dist/services/cruise-rawdata-extractor');

async function testExtraction() {
  // Use production database URL
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  const db = drizzle(pool);

  try {
    console.log('=== Testing Extraction for Cruise 2173517 ===\n');

    // Get the raw_data
    const result = await db.execute(sql`
      SELECT raw_data
      FROM cruises
      WHERE id = '2173517'
    `);

    if (result.rows.length === 0) {
      console.log('❌ Cruise not found');
      process.exit(1);
    }

    const rawData = result.rows[0].raw_data;

    // Use the actual extraction function
    console.log('Using the ACTUAL extraction function from cruise-rawdata-extractor...\n');
    const extracted = extractItineraryFromRawData(rawData);

    console.log(`Extracted ${extracted.length} days\n`);

    extracted.forEach((day, index) => {
      console.log(`Day ${index + 1}:`);
      console.log(`  portName: "${day.portName}"`);
      console.log(`  portId: ${day.portId}`);
      console.log(`  arrivalTime: ${day.arrivalTime}`);
      console.log(`  departureTime: ${day.departureTime}`);
      console.log(`  isSeaDay: ${day.isSeaDay}`);
      if (day.description) {
        console.log(`  description: ${day.description.substring(0, 50)}...`);
      }
      console.log('');
    });

    // Now simulate what getAllItineraryData does
    console.log('\n=== Simulating getAllItineraryData mapping ===\n');
    const mappedItinerary = extracted.map((day, index) => ({
      id: day.id || `2173517-day-${day.dayNumber || index + 1}`,
      cruiseId: '2173517',
      dayNumber: day.dayNumber || index + 1,
      date: new Date().toISOString(),
      portName: day.portName || 'Unknown Port',
      portId: day.portId,
      arrivalTime: day.arrivalTime,
      departureTime: day.departureTime,
      overnight: day.overnight,
      description: day.description,
      isSeaDay: day.isSeaDay,
      port: day.port,
    }));

    console.log('First mapped day:');
    console.log(JSON.stringify(mappedItinerary[0], null, 2));

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testExtraction();
