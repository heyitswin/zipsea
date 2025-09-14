#!/usr/bin/env node

require('dotenv').config();
const ftp = require('basic-ftp');

async function analyzeProcessingCount() {
  console.log('=== Why 13,511 Cruises Processed? ===\n');

  const client = new ftp.Client();
  client.ftp.verbose = false;

  try {
    await client.access({
      host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
      user: process.env.TRAVELTEK_FTP_USER,
      password: process.env.TRAVELTEK_FTP_PASSWORD,
      secure: false,
    });

    const lineId = 22; // Royal Caribbean
    let totalFiles = 0;
    let filesByYear = {};

    // Check multiple years (webhook processor scans all available years)
    const yearsToCheck = [2025, 2026, 2027, 2028, 2029, 2030];

    for (const year of yearsToCheck) {
      let yearCount = 0;

      for (let month = 1; month <= 12; month++) {
        const monthStr = month.toString().padStart(2, '0');
        const linePath = `/${year}/${monthStr}/${lineId}`;

        try {
          const shipDirs = await client.list(linePath);

          for (const shipDir of shipDirs) {
            if (shipDir.type === 2) { // Directory
              const shipPath = `${linePath}/${shipDir.name}`;
              const cruiseFiles = await client.list(shipPath);

              for (const file of cruiseFiles) {
                if (file.type === 1 && file.name.endsWith('.json')) {
                  yearCount++;
                  totalFiles++;
                }
              }
            }
          }
        } catch (error) {
          // Month/year doesn't exist, continue
        }
      }

      if (yearCount > 0) {
        filesByYear[year] = yearCount;
        console.log(`${year}: ${yearCount} files`);
      }
    }

    console.log(`\nTOTAL FILES FOUND: ${totalFiles}`);

    console.log('\n=== ANALYSIS ===');
    console.log(`Database has: 3,161 unique cruises`);
    console.log(`FTP has: ${totalFiles} total files across all years`);
    console.log(`Webhook reported: 13,511 cruises processed`);

    console.log('\n=== POSSIBLE EXPLANATIONS ===');

    // Check if it's re-processing files
    if (totalFiles < 13511) {
      const ratio = Math.round(13511 / totalFiles);
      console.log(`1. DUPLICATE PROCESSING: Each file processed ${ratio} times`);
      console.log(`   - Files might be added to queue multiple times`);
      console.log(`   - Batch processing might be counting each file multiple times`);
    }

    // Check if it's counting operations, not files
    console.log(`\n2. COUNTING OPERATIONS, NOT FILES:`);
    console.log(`   - Each file might generate multiple database operations`);
    console.log(`   - Could be counting: insert cruise + update pricing + snapshot = 3 ops per file`);
    console.log(`   - ${totalFiles} files × 3 operations = ${totalFiles * 3} operations`);

    // Check if worker is processing files multiple times
    console.log(`\n3. WORKER RETRY LOGIC:`);
    console.log(`   - Failed files might be retried multiple times`);
    console.log(`   - Each retry counts as a new "processed" item`);

    // Most likely scenario
    console.log(`\n4. MOST LIKELY: CUMULATIVE COUNT`);
    console.log(`   - The count might be cumulative over multiple runs`);
    console.log(`   - If line 22 was processed multiple times today`);
    console.log(`   - Each run adds to the total without resetting`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.close();
  }
}

analyzeProcessingCount().catch(console.error);
