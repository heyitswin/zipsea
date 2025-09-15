require('dotenv').config();
const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
const { sql } = require('drizzle-orm');
const Client = require('ftp');

async function resyncCruise() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  const db = drizzle(pool);

  try {
    console.log('=== Re-syncing Cruise 2173517 (Enchanted Princess) ===\n');

    // First check what's in raw_data
    const checkResult = await db.execute(sql`
      SELECT
        c.id,
        c.name,
        c.ship_id,
        c.cruise_line_id,
        c.sailing_date,
        c.raw_data,
        s.name as ship_name,
        cl.name as cruise_line
      FROM cruises c
      LEFT JOIN ships s ON c.ship_id = s.id
      LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      WHERE c.id = '2173517'
    `);

    if (checkResult.rows.length === 0) {
      console.log('❌ Cruise not found');
      process.exit(1);
    }

    const cruise = checkResult.rows[0];
    console.log('Current cruise info:');
    console.log(`  Name: ${cruise.name}`);
    console.log(`  Ship: ${cruise.ship_name} (ID: ${cruise.ship_id})`);
    console.log(`  Line: ${cruise.cruise_line} (ID: ${cruise.cruise_line_id})`);
    console.log(`  Sailing: ${cruise.sailing_date}`);

    // Check raw_data
    let currentRawData;
    try {
      currentRawData =
        typeof cruise.raw_data === 'string' ? JSON.parse(cruise.raw_data) : cruise.raw_data;
      console.log(`  Current raw_data type: ${typeof currentRawData}`);
      if (currentRawData && typeof currentRawData === 'object') {
        const keys = Object.keys(currentRawData);
        console.log(`  Current raw_data has ${keys.length} fields`);
        if (keys.length < 10) {
          console.log(`  Fields: ${keys.join(', ')}`);
        }
      }
    } catch (e) {
      console.log(`  Current raw_data: ${cruise.raw_data}`);
      console.log(`  ⚠️ raw_data is not valid JSON`);
    }

    // Determine FTP path - Use the actual cruise_line_id from database
    const sailingDate = new Date(cruise.sailing_date);
    const year = sailingDate.getFullYear();
    const month = sailingDate.getMonth() + 1;
    const ftpPath = `${year}/${month.toString().padStart(2, '0')}/${cruise.cruise_line_id}/${cruise.ship_id}/2173517.json`;

    console.log(`\n=== Downloading from FTP ===`);
    console.log(`  Path: ${ftpPath}`);

    // Connect to FTP
    const ftp = new Client();

    await new Promise((resolve, reject) => {
      ftp.on('ready', resolve);
      ftp.on('error', reject);

      ftp.connect({
        host: process.env.FTP_HOST,
        user: process.env.FTP_USER,
        password: process.env.FTP_PASSWORD,
        secure: false,
      });
    });

    console.log('  ✅ Connected to FTP');

    // Download the file
    const chunks = [];
    await new Promise((resolve, reject) => {
      ftp.get(ftpPath, (err, stream) => {
        if (err) {
          reject(err);
          return;
        }

        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', resolve);
        stream.on('error', reject);
      });
    });

    ftp.end();

    const fileContent = Buffer.concat(chunks).toString('utf-8');
    const data = JSON.parse(fileContent);

    console.log(`  ✅ Downloaded ${fileContent.length} bytes`);
    console.log(`  File has ${Object.keys(data).length} fields`);

    // Check for itinerary
    if (data.itinerary && Array.isArray(data.itinerary)) {
      console.log(`  ✅ Found itinerary with ${data.itinerary.length} days`);
    } else {
      console.log(`  ❌ No itinerary found in FTP file`);
    }

    // Update the database directly with complete data
    console.log('\n=== Updating database with complete data ===');

    await db.execute(sql`
      UPDATE cruises
      SET raw_data = ${JSON.stringify(data)}::jsonb
      WHERE id = '2173517'
    `);

    console.log('  ✅ Successfully updated cruise raw_data');

    // Verify the update
    console.log('\n=== Verifying update ===');
    const verifyResult = await db.execute(sql`
      SELECT
        jsonb_typeof(raw_data) as raw_data_type,
        CASE
          WHEN raw_data ? 'itinerary' THEN 'has_itinerary'
          ELSE 'no_itinerary'
        END as itinerary_status,
        jsonb_array_length(
          CASE
            WHEN jsonb_typeof(raw_data->'itinerary') = 'array'
            THEN raw_data->'itinerary'
            ELSE '[]'::jsonb
          END
        ) as itinerary_days
      FROM cruises
      WHERE id = '2173517'
    `);

    const updated = verifyResult.rows[0];
    console.log(`  Raw data type: ${updated.raw_data_type}`);
    console.log(`  Itinerary status: ${updated.itinerary_status}`);
    console.log(`  Itinerary days: ${updated.itinerary_days}`);

    if (updated.itinerary_status === 'has_itinerary') {
      console.log('\n✅ Cruise 2173517 successfully re-synced with itinerary!');
      console.log(
        'The itinerary should now be visible at https://www.zipsea.com/cruise/enchanted-princess-2025-09-13-2173517'
      );
    } else {
      console.log('\n⚠️ Re-sync completed but itinerary still not found');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

resyncCruise();
