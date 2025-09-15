require('dotenv').config();
const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
const { sql } = require('drizzle-orm');

async function checkCruise() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  const db = drizzle(pool);

  try {
    console.log('=== Checking Cruise 2173517 (Enchanted Princess) ===\n');

    const result = await db.execute(sql`
      SELECT
        c.id,
        c.name,
        c.ship_id,
        c.sailing_date,
        s.name as ship_name,
        cl.name as cruise_line,
        jsonb_typeof(c.raw_data) as raw_data_type,
        CASE
          WHEN c.raw_data IS NULL THEN 'no_data'
          WHEN jsonb_typeof(c.raw_data) = 'object' THEN
            CASE
              WHEN c.raw_data ? 'itinerary' THEN 'has_itinerary'
              ELSE 'no_itinerary'
            END
          ELSE 'invalid_type'
        END as itinerary_status,
        jsonb_array_length(
          CASE
            WHEN jsonb_typeof(c.raw_data->'itinerary') = 'array'
            THEN c.raw_data->'itinerary'
            ELSE '[]'::jsonb
          END
        ) as itinerary_days
      FROM cruises c
      LEFT JOIN ships s ON c.ship_id = s.id
      LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      WHERE c.id = '2173517'
    `);

    if (result.rows.length === 0) {
      console.log('❌ Cruise 2173517 NOT FOUND in database');
    } else {
      const cruise = result.rows[0];
      console.log('✅ Cruise found in database:');
      console.log(`  Name: ${cruise.name}`);
      console.log(`  Ship: ${cruise.ship_name}`);
      console.log(`  Line: ${cruise.cruise_line}`);
      console.log(`  Sailing: ${cruise.sailing_date}`);
      console.log(`  Raw data type: ${cruise.raw_data_type}`);
      console.log(`  Itinerary status: ${cruise.itinerary_status}`);
      console.log(`  Itinerary days: ${cruise.itinerary_days}`);
    }

    // Check cruise_itinerary table
    const itineraryResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM cruise_itinerary
      WHERE cruise_id = '2173517'
    `);

    console.log(`\n  Entries in cruise_itinerary table: ${itineraryResult.rows[0].count}`);

    // Check raw_data fields
    if (result.rows.length > 0) {
      const fieldsResult = await db.execute(sql`
        SELECT
          jsonb_object_keys(raw_data) as field_name
        FROM cruises
        WHERE id = '2173517'
        AND raw_data IS NOT NULL
        AND jsonb_typeof(raw_data) = 'object'
      `);

      const fields = fieldsResult.rows.map(r => r.field_name);
      console.log(`\n  Raw data has ${fields.length} fields`);

      // Check for key fields
      const keyFields = ['itinerary', 'cheapest', 'prices', 'cabins', 'cruisename', 'shipname'];
      console.log('\n  Key fields present:');
      keyFields.forEach(field => {
        if (fields.includes(field)) {
          console.log(`    ✅ ${field}`);
        } else {
          console.log(`    ❌ ${field}`);
        }
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkCruise();
