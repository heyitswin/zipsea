#!/usr/bin/env node

require('dotenv').config();
const ftp = require('basic-ftp');

async function simulateBatchProcessing() {
  const client = new ftp.Client();
  client.ftp.verbose = false;

  try {
    console.log('Simulating webhook processor file discovery and batching...\n');

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

    // This simulates EXACTLY what discoverFiles() does
    const files = [];
    const availableYears = [currentYear]; // 2025

    for (const year of availableYears) {
      const startMonth = year === currentYear ? currentMonth : 1;
      const endMonth = 12;

      for (let month = startMonth; month <= endMonth; month++) {
        const monthStr = month.toString().padStart(2, '0');
        const linePath = `/${year}/${monthStr}/${lineId}`;

        try {
          const shipDirs = await client.list(linePath);

          for (const shipDir of shipDirs) {
            if (shipDir.type === 2) {
              const shipPath = `${linePath}/${shipDir.name}`;
              const cruiseFiles = await client.list(shipPath);

              for (const file of cruiseFiles) {
                if (file.type === 1 && file.name.endsWith('.json')) {
                  files.push({
                    path: `${shipPath}/${file.name}`,
                    name: file.name,
                    lineId: lineId,
                    shipId: parseInt(shipDir.name) || 0,
                    cruiseId: file.name.replace('.json', ''),
                    size: file.size,
                    year: year,
                    month: month,
                  });
                }
              }
            }
          }

          if (files.length > 0) {
            console.log(`Found ${files.length} files in ${year}/${monthStr}`);
          }
        } catch (error) {
          // No data for this month
        }
      }
    }

    // Sort files by date (year/month) - EXACTLY as processor does
    files.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });

    console.log(`\nTotal files discovered: ${files.length}`);

    // Find cruise 2143102
    const cruise2143102Index = files.findIndex(f => f.cruiseId === '2143102');
    if (cruise2143102Index >= 0) {
      console.log(`\n✅ Cruise 2143102 found at index ${cruise2143102Index}`);
      console.log(`File: ${files[cruise2143102Index].path}`);
      console.log(`Size: ${files[cruise2143102Index].size} bytes`);
      console.log(`Month: ${files[cruise2143102Index].month}`);
    } else {
      console.log('\n❌ Cruise 2143102 NOT FOUND');
    }

    // Create batches EXACTLY as processor does
    const MAX_FILES_PER_JOB = 100;
    const batches = [];

    for (let i = 0; i < files.length; i += MAX_FILES_PER_JOB) {
      batches.push(files.slice(i, i + MAX_FILES_PER_JOB));
    }

    console.log(`\n=== Batch Creation ===`);
    console.log(`Creating ${batches.length} jobs (${files.length} files / ${MAX_FILES_PER_JOB} per job)`);

    // Check which batch contains cruise 2143102
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const cruise = batch.find(f => f.cruiseId === '2143102');
      if (cruise) {
        console.log(`\n✅ Cruise 2143102 is in BATCH ${i + 1} of ${batches.length}`);
        console.log(`  Position in batch: ${batch.indexOf(cruise) + 1} of ${batch.length}`);
        console.log(`  This batch would have priority: ${batches.length - i}`);
        console.log(`  This batch would have delay: ${i * 2000}ms`);

        // Show files around it in the batch
        const idx = batch.indexOf(cruise);
        console.log('\n  Files in same batch around cruise 2143102:');
        for (let j = Math.max(0, idx - 2); j <= Math.min(batch.length - 1, idx + 2); j++) {
          const marker = j === idx ? ' >>> ' : '     ';
          console.log(`${marker}${j}: ${batch[j].cruiseId} (${batch[j].path})`);
        }
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.close();
  }
}

simulateBatchProcessing().catch(console.error);
