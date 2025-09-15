#!/usr/bin/env node

/**
 * Re-sync cruises that have incomplete raw_data (only pricing instead of full cruise data)
 * This script identifies cruises with incomplete data and triggers re-sync from FTP
 */

require('dotenv').config();
const { db } = require('../dist/db/connection');
const { sql } = require('drizzle-orm');
const ftp = require('basic-ftp');
const { WebhookProcessorOptimizedV2 } = require('../dist/services/webhook-processor-optimized-v2.service');

async function identifyIncompleteCruises() {
  console.log('=== Identifying Cruises with Incomplete Data ===\n');

  try {
    // Find cruises where raw_data doesn't have itinerary field
    // These cruises only have pricing data, not complete cruise information
    const query = sql`
      SELECT
        c.id,
        c.name,
        c.cruise_line_id,
        c.ship_id,
        c.sailing_date,
        c.raw_data->'itinerary' as has_itinerary,
        jsonb_object_keys(c.raw_data) as raw_data_keys,
        cl.name as cruise_line_name,
        s.name as ship_name
      FROM cruises c
      LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      LEFT JOIN ships s ON c.ship_id = s.id
      WHERE
        c.raw_data IS NOT NULL
        AND c.raw_data->'itinerary' IS NULL
        AND c.sailing_date >= CURRENT_DATE
      ORDER BY c.sailing_date
      LIMIT 100
    `;

    const result = await db.execute(query);
    const cruises = result.rows || result;

    console.log(`Found ${cruises.length} cruises with incomplete data\n`);

    // Group by cruise line for efficient processing
    const byLine = {};
    cruises.forEach(cruise => {
      const lineId = cruise.cruise_line_id;
      if (!byLine[lineId]) {
        byLine[lineId] = {
          lineName: cruise.cruise_line_name,
          cruises: []
        };
      }
      byLine[lineId].cruises.push(cruise);
    });

    return byLine;
  } catch (error) {
    console.error('Error identifying incomplete cruises:', error);
    throw error;
  }
}

async function resyncCruise(cruise, ftpClient) {
  const sailingDate = new Date(cruise.sailing_date);
  const year = sailingDate.getFullYear();
  const month = String(sailingDate.getMonth() + 1).padStart(2, '0');

  // Path structure: [year]/[month]/[lineId]/[shipId]/[cruiseId].json
  const ftpPath = `${year}/${month}/${cruise.cruise_line_id}/${cruise.ship_id}/${cruise.id}.json`;

  console.log(`  Checking FTP for: ${ftpPath}`);

  try {
    // Download file to buffer
    const chunks = [];
    const stream = require('stream');
    const writeStream = new stream.Writable({
      write(chunk, encoding, callback) {
        chunks.push(chunk);
        callback();
      }
    });

    await ftpClient.downloadTo(writeStream, ftpPath);

    if (chunks.length === 0) {
      console.log(`    ❌ Empty file`);
      return false;
    }

    const content = Buffer.concat(chunks).toString();
    const data = JSON.parse(content);

    // Check if this file has complete data
    if (data.itinerary) {
      console.log(`    ✅ Found complete data with ${data.itinerary.length} day itinerary`);

      // Process this file through the webhook processor
      const processor = new WebhookProcessorOptimizedV2();
      const file = {
        path: ftpPath,
        lineId: cruise.cruise_line_id,
        shipId: cruise.ship_id,
        cruiseId: cruise.id,
        size: content.length
      };

      const success = await WebhookProcessorOptimizedV2.processFileStatic(file);

      if (success) {
        console.log(`    ✅ Successfully re-synced cruise ${cruise.id}`);
        return true;
      } else {
        console.log(`    ❌ Failed to process cruise ${cruise.id}`);
        return false;
      }
    } else {
      console.log(`    ⚠️  File exists but has no itinerary data`);
      return false;
    }
  } catch (error) {
    if (error.code === 550) {
      console.log(`    ⚠️  File not found on FTP`);
    } else {
      console.log(`    ❌ Error: ${error.message}`);
    }
    return false;
  }
}

async function main() {
  console.log('=== Re-sync Cruises with Incomplete Data ===\n');
  console.log('This script will:');
  console.log('1. Find cruises that only have pricing data in raw_data');
  console.log('2. Download the complete data from FTP');
  console.log('3. Update the database with complete cruise information\n');

  const ftpClient = new ftp.Client();

  try {
    // Get list of incomplete cruises
    const cruisesByLine = await identifyIncompleteCruises();

    if (Object.keys(cruisesByLine).length === 0) {
      console.log('No cruises with incomplete data found!');
      return;
    }

    // Connect to FTP
    console.log('\n=== Connecting to FTP ===');
    const ftpConfig = {
      host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
      user: process.env.TRAVELTEK_FTP_USER || 'CEP_9_USD',
      password: process.env.TRAVELTEK_FTP_PASSWORD,
      secure: false
    };

    if (!ftpConfig.password) {
      console.error('FTP password not found in environment!');
      process.exit(1);
    }

    await ftpClient.access(ftpConfig);
    console.log('Connected to FTP successfully!\n');

    // Process each cruise line
    let totalProcessed = 0;
    let totalSuccess = 0;

    for (const [lineId, lineData] of Object.entries(cruisesByLine)) {
      console.log(`\n=== Processing ${lineData.lineName} (Line ${lineId}) ===`);
      console.log(`Found ${lineData.cruises.length} cruises to check\n`);

      for (const cruise of lineData.cruises) {
        console.log(`\nCruise: ${cruise.name} (${cruise.id})`);
        console.log(`  Ship: ${cruise.ship_name}`);
        console.log(`  Sailing: ${cruise.sailing_date}`);

        const success = await resyncCruise(cruise, ftpClient);
        totalProcessed++;
        if (success) totalSuccess++;

        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log('\n=== Summary ===');
    console.log(`Total cruises processed: ${totalProcessed}`);
    console.log(`Successfully re-synced: ${totalSuccess}`);
    console.log(`Failed/Skipped: ${totalProcessed - totalSuccess}`);

  } catch (error) {
    console.error('Error during re-sync:', error);
  } finally {
    ftpClient.close();
    console.log('\nFTP connection closed');
    process.exit(0);
  }
}

// Add command line option to run in dry-run mode
const args = process.argv.slice(2);
if (args.includes('--dry-run')) {
  console.log('DRY RUN MODE - Will only identify cruises, not re-sync\n');
  identifyIncompleteCruises().then(cruisesByLine => {
    for (const [lineId, lineData] of Object.entries(cruisesByLine)) {
      console.log(`\n${lineData.lineName} (Line ${lineId}):`);
      lineData.cruises.forEach(cruise => {
        console.log(`  - ${cruise.name} (${cruise.id}) - Sailing: ${cruise.sailing_date}`);
      });
    }
    process.exit(0);
  });
} else {
  main().catch(console.error);
}
