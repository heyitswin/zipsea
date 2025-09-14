#!/usr/bin/env node

require('dotenv').config();
const ftp = require('basic-ftp');

async function countRoyalCaribbeanFiles() {
  const client = new ftp.Client();
  client.ftp.verbose = false;

  try {
    console.log('Connecting to FTP server...');
    await client.access({
      host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
      user: process.env.TRAVELTEK_FTP_USER,
      password: process.env.TRAVELTEK_FTP_PASSWORD,
      secure: false,
    });

    const lineId = 22; // Royal Caribbean
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const files = [];
    const fileSummary = {};
    let cruise2143102Found = false;
    let cruise2143102Index = -1;

    // Scan all months from current month onwards in 2025
    for (let month = currentMonth; month <= 12; month++) {
      const monthStr = month.toString().padStart(2, '0');
      const linePath = `/${currentYear}/${monthStr}/${lineId}`;

      try {
        const shipDirs = await client.list(linePath);

        for (const shipDir of shipDirs) {
          if (shipDir.type === 2) { // Directory
            const shipPath = `${linePath}/${shipDir.name}`;
            const cruiseFiles = await client.list(shipPath);

            for (const file of cruiseFiles) {
              if (file.type === 1 && file.name.endsWith('.json')) {
                const cruiseId = file.name.replace('.json', '');
                files.push({
                  path: `${shipPath}/${file.name}`,
                  cruiseId: cruiseId,
                  month: month,
                  shipId: shipDir.name,
                  size: file.size
                });

                if (cruiseId === '2143102') {
                  cruise2143102Found = true;
                  cruise2143102Index = files.length - 1;
                  console.log(`\n✅ FOUND CRUISE 2143102 at index ${cruise2143102Index} in month ${month}`);
                }
              }
            }
          }
        }

        const monthKey = `${currentYear}/${monthStr}`;
        fileSummary[monthKey] = files.filter(f => f.month === month).length;

      } catch (error) {
        // Month not found, continue
      }
    }

    // Sort files by month (as the processor does)
    files.sort((a, b) => a.month - b.month);

    console.log('\n=== File Count Summary ===');
    console.log(`Total files: ${files.length}`);
    console.log('\nBy month:');
    Object.entries(fileSummary).forEach(([month, count]) => {
      console.log(`  ${month}: ${count} files`);
    });

    if (cruise2143102Found) {
      // Find new index after sorting
      cruise2143102Index = files.findIndex(f => f.cruiseId === '2143102');
      console.log(`\n=== Cruise 2143102 Position ===`);
      console.log(`Position in sorted list: ${cruise2143102Index + 1} of ${files.length}`);
      console.log(`Would be in batch: ${Math.floor(cruise2143102Index / 100) + 1}`);
      console.log(`Files before it: ${cruise2143102Index}`);
      console.log(`Files after it: ${files.length - cruise2143102Index - 1}`);

      // Check what batch it would be in
      const BATCH_SIZE = 100;
      const batchNumber = Math.floor(cruise2143102Index / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(files.length / BATCH_SIZE);
      console.log(`\nBatch info:`);
      console.log(`  Batch ${batchNumber} of ${totalBatches}`);
      console.log(`  Position in batch: ${(cruise2143102Index % BATCH_SIZE) + 1}`);
    } else {
      console.log('\n❌ Cruise 2143102 NOT FOUND in file list');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.close();
  }
}

countRoyalCaribbeanFiles().catch(console.error);
