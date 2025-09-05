#!/usr/bin/env node

/**
 * Test processing a single file to diagnose sync issues
 * This will help identify exactly where the process is failing
 */

const ftp = require('basic-ftp');
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function testSingleFile() {
  console.log('🧪 Testing Single File Processing');
  console.log('=================================\n');

  const ftpConfig = {
    host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
    user: process.env.TRAVELTEK_FTP_USER,
    password: process.env.TRAVELTEK_FTP_PASSWORD,
    secure: false,
    timeout: 30000,
    verbose: true
  };

  const databaseUrl = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;

  // Step 1: Find a test file
  console.log('1️⃣ Finding a test file...');

  const ftpClient = new ftp.Client();
  ftpClient.ftp.verbose = true;

  let testFile = null;

  try {
    await ftpClient.access(ftpConfig);
    console.log('✅ FTP connected\n');

    // List cruise lines in 2025/09
    const lines = await ftpClient.list('/2025/09');
    console.log(`Found ${lines.length} cruise lines\n`);

    // Find first cruise file
    for (const line of lines.filter(l => l.type === 2)) {
      const ships = await ftpClient.list(`/2025/09/${line.name}`);

      for (const ship of ships.filter(s => s.type === 2)) {
        const files = await ftpClient.list(`/2025/09/${line.name}/${ship.name}`);
        const jsonFile = files.find(f => f.type === 1 && f.name.endsWith('.json'));

        if (jsonFile) {
          testFile = {
            path: `/2025/09/${line.name}/${ship.name}/${jsonFile.name}`,
            lineId: parseInt(line.name),
            shipId: parseInt(ship.name),
            cruiseId: jsonFile.name.replace('.json', ''),
            size: jsonFile.size
          };
          break;
        }
      }
      if (testFile) break;
    }

    if (!testFile) {
      console.error('❌ No test file found!');
      return;
    }

    console.log('📁 Test file found:');
    console.log(`   Path: ${testFile.path}`);
    console.log(`   Size: ${testFile.size} bytes`);
    console.log(`   Line ID: ${testFile.lineId}`);
    console.log(`   Ship ID: ${testFile.shipId}`);
    console.log(`   Cruise ID: ${testFile.cruiseId}\n`);

    // Step 2: Download the file
    console.log('2️⃣ Downloading file...');

    let fileContent = '';
    const chunks = [];

    try {
      await ftpClient.downloadTo(
        {
          write(chunk) {
            chunks.push(chunk);
            console.log(`   Downloaded ${chunks.length} chunks...`);
            return true;
          },
          end() {
            console.log('   Download complete');
            return true;
          }
        },
        testFile.path
      );

      fileContent = Buffer.concat(chunks).toString();
      console.log(`✅ Downloaded ${fileContent.length} bytes\n`);

    } catch (downloadError) {
      console.error('❌ Download failed:', downloadError.message);
      console.error('Full error:', downloadError);
      return;
    }

    // Step 3: Parse JSON
    console.log('3️⃣ Parsing JSON...');

    let data;
    try {
      data = JSON.parse(fileContent);
      console.log('✅ JSON parsed successfully');
      console.log(`   Cruise ID: ${data.codetocruiseid || data.cruiseid}`);
      console.log(`   Name: ${data.name || 'No name'}`);
      console.log(`   Sailing date: ${data.saildate || data.startdate}`);
      console.log(`   Has prices: ${!!(data.prices || data.cachedprices || data.cheapest)}\n`);
    } catch (parseError) {
      console.error('❌ JSON parse failed:', parseError.message);
      console.log('First 500 chars of file:', fileContent.substring(0, 500));
      return;
    }

    // Step 4: Test database connection
    console.log('4️⃣ Testing database...');

    const dbClient = new Client({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('render.com') ? { rejectUnauthorized: false } : false
    });

    try {
      await dbClient.connect();
      console.log('✅ Database connected\n');

      // Step 5: Try to insert cruise line
      console.log('5️⃣ Testing cruise line insert...');

      const lineName = data.linecontent?.name || `Cruise Line ${testFile.lineId}`;

      await dbClient.query('BEGIN');

      try {
        await dbClient.query(
          `INSERT INTO cruise_lines (id, name, code)
           VALUES ($1, $2, $3)
           ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
          [testFile.lineId, lineName, `CL${testFile.lineId}`]
        );
        console.log(`✅ Cruise line inserted/updated: ${lineName}\n`);

        // Step 6: Try to insert ship
        console.log('6️⃣ Testing ship insert...');

        const shipName = data.shipcontent?.name || `Ship ${testFile.shipId}`;

        await dbClient.query(
          `INSERT INTO ships (id, cruise_line_id, name, code)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
          [testFile.shipId, testFile.lineId, shipName, `SH${testFile.shipId}`]
        );
        console.log(`✅ Ship inserted/updated: ${shipName}\n`);

        // Step 7: Try to insert cruise
        console.log('7️⃣ Testing cruise insert...');

        const cruiseId = String(data.codetocruiseid || data.cruiseid);
        const cruiseName = data.name || `Cruise ${cruiseId}`;
        const sailingDate = data.saildate || data.startdate;

        await dbClient.query(
          `INSERT INTO cruises (
            id, cruise_id, cruise_line_id, ship_id, name, sailing_date, nights
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
          [
            cruiseId,
            cruiseId,
            testFile.lineId,
            testFile.shipId,
            cruiseName,
            sailingDate,
            data.nights || 7
          ]
        );
        console.log(`✅ Cruise inserted/updated: ${cruiseName}\n`);

        await dbClient.query('COMMIT');
        console.log('✅ Database transaction committed successfully!\n');

      } catch (dbError) {
        await dbClient.query('ROLLBACK');
        console.error('❌ Database operation failed:', dbError.message);
        console.error('SQL State:', dbError.code);
        console.error('Detail:', dbError.detail);
        console.error('Hint:', dbError.hint);
        console.error('Full error:', dbError);
      }

    } catch (connectError) {
      console.error('❌ Database connection failed:', connectError.message);
    } finally {
      await dbClient.end();
    }

  } catch (ftpError) {
    console.error('❌ FTP error:', ftpError.message);
    console.error('Full error:', ftpError);
  } finally {
    await ftpClient.close();
  }

  console.log('\n📊 Test Summary:');
  console.log('================');
  console.log('If all steps passed, the sync should work.');
  console.log('If a step failed, that\'s where the main sync is failing.');
  console.log('\nTo check sync errors on Render:');
  console.log('1. Run: cat sync-errors.log | tail -50');
  console.log('2. Or run: node scripts/check-sync-errors.js');
  console.log('\nTo reset and retry:');
  console.log('1. Clear checkpoint: rm sync-checkpoint.json');
  console.log('2. Clear errors: rm sync-errors.log');
  console.log('3. Run sync again: node scripts/initial-ftp-sync-fixed.js');
}

// Run the test
testSingleFile().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
