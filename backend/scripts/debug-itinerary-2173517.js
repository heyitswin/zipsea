require('dotenv').config();
const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
const { sql } = require('drizzle-orm');

async function debugItinerary() {
  // Use production database URL
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  const db = drizzle(pool);

  try {
    console.log('=== Debugging Itinerary for Cruise 2173517 ===\n');

    // Get the raw_data
    const result = await db.execute(sql`
      SELECT
        raw_data,
        raw_data->'itinerary' as itinerary_field
      FROM cruises
      WHERE id = '2173517'
    `);

    if (result.rows.length === 0) {
      console.log('❌ Cruise not found');
      process.exit(1);
    }

    const cruise = result.rows[0];

    // Check the raw_data structure
    console.log('Raw data type:', typeof cruise.raw_data);

    if (cruise.raw_data) {
      const rawData = typeof cruise.raw_data === 'string'
        ? JSON.parse(cruise.raw_data)
        : cruise.raw_data;

      console.log('Raw data has these top-level keys:', Object.keys(rawData).sort().join(', '));

      if (rawData.itinerary) {
        console.log('\n✅ Itinerary field exists');
        console.log('Itinerary type:', typeof rawData.itinerary);
        console.log('Is array:', Array.isArray(rawData.itinerary));
        console.log('Itinerary length:', rawData.itinerary.length);

        if (rawData.itinerary.length > 0) {
          console.log('\nFirst itinerary day structure:');
          const firstDay = rawData.itinerary[0];
          console.log(JSON.stringify(firstDay, null, 2));

          console.log('\nAll itinerary days:');
          rawData.itinerary.forEach((day, index) => {
            console.log(`  Day ${index + 1}: ${day.port || day.portname || 'Unknown'}`);
          });
        }
      } else {
        console.log('\n❌ No itinerary field in raw_data');
      }

      // Check if itinerary might be under a different key
      const possibleItineraryKeys = ['itin', 'Itinerary', 'route', 'ports', 'daybydays'];
      console.log('\nChecking alternative itinerary keys:');
      possibleItineraryKeys.forEach(key => {
        if (rawData[key]) {
          console.log(`  ✅ Found '${key}' field (${typeof rawData[key]})`);
          if (Array.isArray(rawData[key])) {
            console.log(`     Array with ${rawData[key].length} items`);
          }
        }
      });
    }

    // Test the extraction function directly
    console.log('\n=== Testing Extraction Function ===');
    const extractItineraryFromRawData = (rawData) => {
      if (!rawData) return [];

      // Handle string data
      if (typeof rawData === 'string') {
        try {
          rawData = JSON.parse(rawData);
        } catch (e) {
          console.log('Failed to parse raw_data string');
          return [];
        }
      }

      // Extract itinerary
      if (rawData.itinerary && Array.isArray(rawData.itinerary)) {
        console.log(`Extracting ${rawData.itinerary.length} itinerary days`);
        return rawData.itinerary.map((day, index) => ({
          dayNumber: day.day || index + 1,
          port: day.port || day.portname || 'Unknown',
          arrivalTime: day.arrive || day.arrival || null,
          departureTime: day.depart || day.departure || null,
          description: day.description || null
        }));
      }

      console.log('No itinerary array found in raw_data');
      return [];
    };

    const extractedItinerary = extractItineraryFromRawData(cruise.raw_data);
    console.log(`\nExtracted ${extractedItinerary.length} itinerary days`);
    if (extractedItinerary.length > 0) {
      console.log('Sample extracted day:', JSON.stringify(extractedItinerary[0], null, 2));
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

debugItinerary();
