require('dotenv').config();
const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
const { sql } = require('drizzle-orm');
const Client = require('ftp');

async function resyncPrincessCruise() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  const db = drizzle(pool);

  console.log('=== Checking Princess Cruises (Line 20) for cruise 2173517 ===\n');

  try {
    // First verify the cruise exists
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
      console.log('❌ Cruise 2173517 not found');
      process.exit(1);
    }

    const cruise = checkResult.rows[0];
    console.log('Found cruise:');
    console.log(`  Name: ${cruise.name}`);
    console.log(`  Ship: ${cruise.ship_name} (ID: ${cruise.ship_id})`);
    console.log(`  Line: ${cruise.cruise_line} (ID: ${cruise.cruise_line_id})`);
    console.log(`  Sailing: ${cruise.sailing_date}`);

    // Parse existing raw_data
    let currentRawData;
    try {
      currentRawData =
        typeof cruise.raw_data === 'string' ? JSON.parse(cruise.raw_data) : cruise.raw_data;
      const keys = Object.keys(currentRawData || {});
      console.log(`  Current raw_data has ${keys.length} fields`);
      if (currentRawData?.itinerary) {
        console.log(`  ✅ Already has itinerary with ${currentRawData.itinerary.length} days`);
        process.exit(0);
      } else {
        console.log(`  ❌ No itinerary in current data`);
      }
    } catch (e) {
      console.log(`  ⚠️ Error parsing raw_data`);
    }

    // Try to download from FTP
    const sailingDate = new Date(cruise.sailing_date);
    const year = sailingDate.getFullYear();
    const month = sailingDate.getMonth() + 1;

    // Princess Cruises is line 20 in our database
    const ftpPath = `${year}/${month.toString().padStart(2, '0')}/20/${cruise.ship_id}/2173517.json`;

    console.log(`\n=== Attempting FTP download ===`);
    console.log(`  Path: ${ftpPath}`);

    const ftp = new Client();

    await new Promise((resolve, reject) => {
      ftp.on('ready', resolve);
      ftp.on('error', reject);

      ftp.connect({
        host: process.env.TRAVELTEK_FTP_HOST,
        user: process.env.TRAVELTEK_FTP_USER,
        password: process.env.TRAVELTEK_FTP_PASSWORD,
        secure: false,
      });
    });

    console.log('  ✅ Connected to FTP');

    // List directory to debug
    console.log('\n  Listing directory to verify file exists...');
    await new Promise((resolve, reject) => {
      const dirPath = `${year}/${month.toString().padStart(2, '0')}/20/${cruise.ship_id}/`;
      ftp.list(dirPath, (err, list) => {
        if (err) {
          console.log(`  Could not list directory: ${err.message}`);
          reject(err);
          return;
        }
        console.log(`  Found ${list.length} files in directory`);
        const targetFile = list.find(f => f.name === '2173517.json');
        if (targetFile) {
          console.log(`  ✅ File 2173517.json exists (${targetFile.size} bytes)`);
        } else {
          console.log(`  ❌ File 2173517.json not found`);
          console.log(
            `  Available files: ${list
              .slice(0, 5)
              .map(f => f.name)
              .join(', ')}...`
          );
        }
        resolve();
      });
    }).catch(err => {
      console.log('  Directory listing failed, trying direct download...');
    });

    // Try to download the file
    const chunks = [];
    try {
      await new Promise((resolve, reject) => {
        ftp.get(ftpPath, (err, stream) => {
          if (err) {
            console.log(`  ❌ FTP download failed: ${err.message}`);
            reject(err);
            return;
          }

          stream.on('data', chunk => chunks.push(chunk));
          stream.on('end', resolve);
          stream.on('error', reject);
        });
      });

      const fileContent = Buffer.concat(chunks).toString('utf-8');
      const data = JSON.parse(fileContent);

      console.log(`  ✅ Downloaded ${fileContent.length} bytes`);
      console.log(`  File has ${Object.keys(data).length} fields`);

      if (data.itinerary && Array.isArray(data.itinerary)) {
        console.log(`  ✅ Found itinerary with ${data.itinerary.length} days`);

        // Update database with complete data
        console.log('\n=== Updating database ===');
        await db.execute(sql`
          UPDATE cruises
          SET raw_data = ${JSON.stringify(data)}::jsonb
          WHERE id = '2173517'
        `);

        console.log('  ✅ Successfully updated cruise with complete data');
      } else {
        console.log(`  ❌ No itinerary in FTP file`);
      }
    } catch (err) {
      console.log(`\n❌ FTP Error: ${err.message}`);
    }

    ftp.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

resyncPrincessCruise();
