const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

async function checkBotticelliData() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    console.log('Checking MS Botticelli cruise data...\n');

    // Get cruise info
    const cruiseResult = await pool.query(`
      SELECT
        id,
        cruiseLineName,
        shipName,
        destinationName,
        departureDate,
        itinerary,
        featuredImageUrl,
        cabinOptions
      FROM cruises
      WHERE shipName ILIKE '%botticelli%'
      LIMIT 5
    `);

    if (cruiseResult.rows.length === 0) {
      console.log('No MS Botticelli cruises found in database');
      return;
    }

    console.log(`Found ${cruiseResult.rows.length} MS Botticelli cruise(s)\n`);

    for (const cruise of cruiseResult.rows) {
      console.log('='.repeat(60));
      console.log(`Cruise ID: ${cruise.id}`);
      console.log(`Ship: ${cruise.shipName}`);
      console.log(`Cruise Line: ${cruise.cruiseLineName}`);
      console.log(`Destination: ${cruise.destinationName}`);
      console.log(`Departure: ${cruise.departureDate}`);
      console.log(`Featured Image URL: ${cruise.featuredImageUrl || 'MISSING'}`);

      // Check cabin options
      if (cruise.cabinOptions) {
        console.log('\nCabin Options:');
        const cabins = JSON.parse(cruise.cabinOptions);

        for (const cabin of cabins) {
          console.log(`\n  ${cabin.cabinType}:`);
          console.log(`    - Price: ${cabin.price || 'N/A'}`);
          console.log(`    - Description: ${cabin.description || 'MISSING'}`);
          console.log(`    - Photo URL: ${cabin.photoUrl || 'MISSING'}`);
          console.log(
            `    - Amenities: ${cabin.amenities ? cabin.amenities.join(', ') : 'MISSING'}`
          );
        }
      } else {
        console.log('\nCabin Options: MISSING');
      }

      // Check itinerary images
      if (cruise.itinerary) {
        console.log('\nItinerary Port Images:');
        const itinerary = JSON.parse(cruise.itinerary);

        for (const port of itinerary) {
          console.log(`  ${port.port}: ${port.imageUrl || 'MISSING'}`);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
  } catch (error) {
    console.error('Error checking cruise data:', error);
  } finally {
    await pool.end();
  }
}

checkBotticelliData();
