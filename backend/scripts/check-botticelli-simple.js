const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

async function checkBotticelli() {
  // Use the production database URL
  const client = new Client({
    connectionString: 'postgresql://zipsea_user:aOLItWeqKie3hDgFOd2k8wjJNU2KtLVd@dpg-d2idqjjipnbc73abma3g-a.oregon-postgres.render.com/zipsea_db',
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('Connected to database\n');

    // Simple query to check MS Botticelli cruises
    const result = await client.query(`
      SELECT
        id,
        "cruiseLineName",
        "shipName",
        "destinationName",
        "departureDate"
      FROM cruises
      WHERE "shipName" ILIKE '%botticelli%'
      LIMIT 5
    `);

    console.log(`Found ${result.rows.length} MS Botticelli cruise(s):\n`);

    for (const row of result.rows) {
      console.log(`ID: ${row.id}`);
      console.log(`Ship: ${row.shipName}`);
      console.log(`Line: ${row.cruiseLineName}`);
      console.log(`Destination: ${row.destinationName}`);
      console.log(`Departure: ${row.departureDate}`);
      console.log('-'.repeat(40));
    }

    if (result.rows.length > 0) {
      // Check the structure of one cruise in detail
      const detailResult = await client.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'cruises'
        AND column_name LIKE '%image%'
        OR column_name LIKE '%photo%'
        OR column_name LIKE '%cabin%'
        ORDER BY column_name
      `);

      console.log('\nRelevant columns in cruises table:');
      for (const col of detailResult.rows) {
        console.log(`  ${col.column_name}: ${col.data_type}`);
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkBotticelli();
