#!/usr/bin/env node

/**
 * Test Line 5 (Cunard) Bulk FTP Download
 *
 * This script tests the bulk download process specifically for Line 5
 */

require('dotenv').config();
const ftp = require('basic-ftp');
const { Client } = require('pg');

const logger = {
  info: (message, ...args) => console.log(`[INFO] ${message}`, ...args),
  error: (message, ...args) => console.error(`[ERROR] ${message}`, ...args),
  warn: (message, ...args) => console.warn(`[WARN] ${message}`, ...args)
};

async function testLine5BulkDownload() {
  logger.info('🔍 TESTING LINE 5 (CUNARD) BULK FTP DOWNLOAD');
  logger.info('='.repeat(80));

  let ftpClient = null;
  let dbClient = null;

  try {
    // 1. Connect to database to get Line 5 cruises
    logger.info('\n📊 Step 1: Getting Line 5 cruises from database...');
    const databaseUrl = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL or DATABASE_URL_PRODUCTION environment variable not set');
    }

    dbClient = new Client({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('render.com') ? { rejectUnauthorized: false } : false
    });
    await dbClient.connect();

    // Get a sample of Line 5 cruises
    const cruisesQuery = `
      SELECT
        c.id, c.cruise_id, c.name, c.sailing_date, c.nights,
        s.id as ship_id, s.name as ship_name
      FROM cruises c
      JOIN ships s ON c.ship_id = s.id
      WHERE s.cruise_line_id = 5 AND c.is_active = true
      ORDER BY c.sailing_date
      LIMIT 5;
    `;

    const cruisesResult = await dbClient.query(cruisesQuery);
    const cruises = cruisesResult.rows;

    if (cruises.length === 0) {
      logger.error('❌ No active Line 5 cruises found in database');
      return;
    }

    logger.info(`✅ Found ${cruises.length} Line 5 cruises to test`);
    cruises.forEach(cruise => {
      logger.info(`  - Cruise ${cruise.cruise_id}: ${cruise.name} on ${cruise.ship_name}, sailing ${new Date(cruise.sailing_date).toISOString().split('T')[0]}`);
    });

    // 2. Connect to FTP
    logger.info('\n🔌 Step 2: Connecting to FTP server...');
    ftpClient = new ftp.Client();
    ftpClient.ftp.verbose = false; // Set to true for debugging

    await ftpClient.access({
      host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
      user: process.env.TRAVELTEK_FTP_USER,
      password: process.env.TRAVELTEK_FTP_PASSWORD,
      secure: false
    });

    logger.info('✅ FTP connection successful');

    // 3. Test downloading each cruise file
    logger.info('\n📥 Step 3: Testing file downloads...');
    let successCount = 0;
    let failureCount = 0;
    const failedCruises = [];

    for (const cruise of cruises) {
      const sailingDate = new Date(cruise.sailing_date);
      const year = sailingDate.getFullYear();
      const month = String(sailingDate.getMonth() + 1).padStart(2, '0');
      const webhookLineId = 5; // For Cunard, webhook ID = database ID = 5
      const shipId = cruise.ship_id;
      const fileName = `${cruise.cruise_id}.json`;

      // Try different path variations
      const pathsToTry = [
        `/${year}/${month}/${webhookLineId}/${shipId}/${fileName}`,
        `/isell_json/${year}/${month}/${webhookLineId}/${shipId}/${fileName}`,
        `/${year}/${month}/5/${shipId}/${fileName}`, // Explicit 5
        `/isell_json/${year}/${month}/5/${shipId}/${fileName}` // Explicit 5 with isell_json
      ];

      logger.info(`\n  Testing cruise ${cruise.cruise_id} (${cruise.name}):`);
      logger.info(`    Ship: ${cruise.ship_name} (ID: ${shipId})`);
      logger.info(`    Sailing: ${year}-${month}`);

      let downloaded = false;
      let workingPath = null;

      for (const path of pathsToTry) {
        try {
          logger.info(`    Trying path: ${path}`);

          // Try to download to buffer
          const buffer = await ftpClient.downloadTo(null, path);

          if (buffer) {
            logger.info(`    ✅ SUCCESS! Downloaded from: ${path}`);
            successCount++;
            downloaded = true;
            workingPath = path;

            // Parse the JSON to verify it's valid
            try {
              const content = buffer.toString('utf8');
              const data = JSON.parse(content);
              logger.info(`    📋 File size: ${buffer.length} bytes`);
              logger.info(`    📋 Cruise name in file: ${data.cruiseName || 'N/A'}`);
            } catch (parseErr) {
              logger.warn(`    ⚠️ File downloaded but failed to parse as JSON`);
            }

            break; // Stop trying other paths once successful
          }
        } catch (err) {
          // This path didn't work, try next one
          continue;
        }
      }

      if (!downloaded) {
        logger.error(`    ❌ FAILED: Could not download cruise ${cruise.cruise_id} from any path`);
        failureCount++;
        failedCruises.push({
          cruiseId: cruise.cruise_id,
          name: cruise.name,
          shipId: shipId,
          shipName: cruise.ship_name,
          year,
          month
        });
      }
    }

    // 4. Summary
    logger.info('\n' + '='.repeat(80));
    logger.info('📊 SUMMARY');
    logger.info('='.repeat(80));
    logger.info(`Total cruises tested: ${cruises.length}`);
    logger.info(`✅ Successful downloads: ${successCount}`);
    logger.info(`❌ Failed downloads: ${failureCount}`);
    logger.info(`Success rate: ${successCount > 0 ? Math.round((successCount / cruises.length) * 100) : 0}%`);

    if (failedCruises.length > 0) {
      logger.info('\n❌ Failed cruises:');
      failedCruises.forEach(fc => {
        logger.info(`  - Cruise ${fc.cruiseId}: ${fc.name}`);
        logger.info(`    Ship: ${fc.shipName} (ID: ${fc.shipId})`);
        logger.info(`    Expected path: /${fc.year}/${fc.month}/5/${fc.shipId}/${fc.cruiseId}.json`);
      });

      logger.info('\n🔧 TROUBLESHOOTING SUGGESTIONS:');
      logger.info('1. Check if the cruise files exist on the FTP server');
      logger.info('2. Verify the ship IDs match between database and FTP');
      logger.info('3. Check if files are in a different year/month folder');
      logger.info('4. Verify FTP permissions for these specific files');
    }

  } catch (error) {
    logger.error('❌ Test failed:', error.message);
    if (error.stack) {
      logger.error('Stack trace:', error.stack);
    }
  } finally {
    // Cleanup
    if (ftpClient) {
      await ftpClient.close().catch(() => {});
    }
    if (dbClient) {
      await dbClient.end().catch(() => {});
    }
  }
}

// Run the test
testLine5BulkDownload().catch(error => {
  logger.error('❌ Unhandled error:', error);
  process.exit(1);
});
