#!/usr/bin/env node

/**
 * Test Initial Sync Script
 * Tests the sync process with a small batch of files
 * Date: 2025-09-04
 */

const ftp = require('basic-ftp');
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function testSync() {
  console.log('🧪 Testing Initial Sync Process');
  console.log('================================\n');

  // Test configuration
  const ftpConfig = {
    host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
    user: process.env.TRAVELTEK_FTP_USER,
    password: process.env.TRAVELTEK_FTP_PASSWORD,
    secure: false,
    timeout: 30000
  };

  const databaseUrl = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;

  // Step 1: Check environment variables
  console.log('1️⃣ Checking environment variables...');

  if (!ftpConfig.user || !ftpConfig.password) {
    console.error('❌ FTP credentials not found in environment variables');
    console.error('   Please set TRAVELTEK_FTP_USER and TRAVELTEK_FTP_PASSWORD');
    process.exit(1);
  }
  console.log('✅ FTP credentials found');

  if (!databaseUrl) {
    console.error('❌ Database URL not found in environment variables');
    console.error('   Please set DATABASE_URL or DATABASE_URL_PRODUCTION');
    process.exit(1);
  }
  console.log('✅ Database URL found');
  console.log('');

  // Step 2: Test database connection
  console.log('2️⃣ Testing database connection...');
  const dbClient = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('render.com') ? { rejectUnauthorized: false } : false
  });

  try {
    await dbClient.connect();

    // Check if tables exist
    const tablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('cruises', 'cruise_lines', 'ships', 'ports', 'pricing')
      ORDER BY table_name
    `;

    const result = await dbClient.query(tablesQuery);

    if (result.rows.length === 0) {
      console.error('❌ No tables found! Please run schema-enhanced.js first');
      process.exit(1);
    }

    console.log('✅ Database connected');
    console.log(`   Found tables: ${result.rows.map(r => r.table_name).join(', ')}`);

    // Check existing data
    const countQuery = `
      SELECT
        (SELECT COUNT(*) FROM cruises) as cruises,
        (SELECT COUNT(*) FROM cruise_lines) as lines,
        (SELECT COUNT(*) FROM ships) as ships,
        (SELECT COUNT(*) FROM ports) as ports
    `;

    const counts = await dbClient.query(countQuery);
    const c = counts.rows[0];
    console.log(`   Current data: ${c.cruises} cruises, ${c.lines} lines, ${c.ships} ships, ${c.ports} ports`);

  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  } finally {
    await dbClient.end();
  }
  console.log('');

  // Step 3: Test FTP connection
  console.log('3️⃣ Testing FTP connection...');
  const ftpClient = new ftp.Client();
  ftpClient.ftp.verbose = false;

  try {
    await ftpClient.access(ftpConfig);
    console.log('✅ FTP connected successfully');

    // List directories
    const rootList = await ftpClient.list('/2025/09');
    console.log(`   Found ${rootList.filter(f => f.type === 2).length} cruise lines in 2025/09`);

    // Find a cruise line with data
    let testLineId = null;
    let testShipId = null;
    let testFile = null;

    for (const lineDir of rootList.filter(f => f.type === 2)) {
      const linePath = `/2025/09/${lineDir.name}`;
      const shipList = await ftpClient.list(linePath);

      if (shipList.length > 0) {
        const shipDir = shipList.find(f => f.type === 2);
        if (shipDir) {
          const shipPath = `${linePath}/${shipDir.name}`;
          const fileList = await ftpClient.list(shipPath);
          const jsonFile = fileList.find(f => f.type === 1 && f.name.endsWith('.json'));

          if (jsonFile) {
            testLineId = lineDir.name;
            testShipId = shipDir.name;
            testFile = `${shipPath}/${jsonFile.name}`;
            break;
          }
        }
      }
    }

    if (!testFile) {
      console.error('❌ No test file found in FTP server');
      process.exit(1);
    }

    console.log(`   Test file: ${testFile}`);
    console.log(`   Line ID: ${testLineId}, Ship ID: ${testShipId}`);
    console.log('');

    // Step 4: Download and parse test file
    console.log('4️⃣ Downloading and parsing test file...');

    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const tempFile = path.join(os.tmpdir(), 'test-cruise.json');

    const writeStream = fs.createWriteStream(tempFile);
    await ftpClient.downloadTo(writeStream, testFile);

    const content = fs.readFileSync(tempFile, 'utf8');
    const data = JSON.parse(content);

    console.log('✅ File downloaded and parsed successfully');
    console.log(`   Cruise ID: ${data.codetocruiseid}`);
    console.log(`   Name: ${data.name}`);
    console.log(`   Sailing Date: ${data.saildate || data.startdate}`);
    console.log(`   Nights: ${data.nights}`);
    console.log(`   Has pricing: ${!!(data.prices || data.cachedprices || data.cheapest)}`);
    console.log('');

    // Clean up temp file
    fs.unlinkSync(tempFile);

    // Step 5: Test database insert
    console.log('5️⃣ Testing database insert...');

    const testClient = new Client({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('render.com') ? { rejectUnauthorized: false } : false
    });

    await testClient.connect();

    try {
      await testClient.query('BEGIN');

      // Test cruise line insert
      const lineName = data.linecontent?.name || `Test Line ${testLineId}`;
      await testClient.query(
        `INSERT INTO cruise_lines (id, name, code)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [parseInt(testLineId), lineName, `CL${testLineId}`]
      );

      // Test ship insert
      const shipName = data.shipcontent?.name || `Test Ship ${testShipId}`;
      await testClient.query(
        `INSERT INTO ships (id, cruise_line_id, name, code)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [parseInt(testShipId), parseInt(testLineId), shipName, `SH${testShipId}`]
      );

      // Test cruise insert (simplified)
      const cruiseId = String(data.codetocruiseid);
      const existing = await testClient.query(
        'SELECT id FROM cruises WHERE id = $1',
        [cruiseId]
      );

      if (existing.rows.length === 0) {
        await testClient.query(
          `INSERT INTO cruises (
            id, cruise_id, cruise_line_id, ship_id, name, sailing_date, nights
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            cruiseId,
            String(data.cruiseid || cruiseId),
            parseInt(testLineId),
            parseInt(testShipId),
            data.name || 'Test Cruise',
            data.saildate || data.startdate,
            data.nights || 7
          ]
        );
        console.log('✅ Test cruise inserted successfully');
      } else {
        console.log('✅ Test cruise already exists (will update)');
      }

      await testClient.query('COMMIT');

    } catch (error) {
      await testClient.query('ROLLBACK');
      console.error('❌ Database insert failed:', error.message);
      process.exit(1);
    } finally {
      await testClient.end();
    }

  } catch (error) {
    console.error('❌ FTP connection failed:', error.message);
    console.error('   Please check FTP credentials and network connection');
    process.exit(1);
  } finally {
    await ftpClient.close();
  }

  console.log('');
  console.log('✅ All tests passed!');
  console.log('===================');
  console.log('');
  console.log('📋 Next steps:');
  console.log('1. Run the enhanced schema script if not already done:');
  console.log('   node scripts/schema-enhanced.js');
  console.log('');
  console.log('2. Run the full initial sync:');
  console.log('   node scripts/initial-ftp-sync.js');
  console.log('');
  console.log('The initial sync will:');
  console.log('- Process all cruises from 2025/09');
  console.log('- Create/update cruise lines, ships, ports, and regions');
  console.log('- Import cruise details, itineraries, and pricing');
  console.log('- Process files in parallel batches for efficiency');
  console.log('- Save progress and handle errors gracefully');
}

// Run the test
if (require.main === module) {
  testSync().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { testSync };
