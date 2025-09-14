#!/usr/bin/env node

require('dotenv').config();
const { db } = require('../dist/db/connection');
const { sql } = require('drizzle-orm');
const ftp = require('basic-ftp');

async function checkRoyalCaribbeanCounts() {
  console.log('=== Royal Caribbean Cruise Count Analysis ===\n');

  // 1. Check database count
  try {
    const dbResult = await db.execute(sql`
      SELECT
        COUNT(*) as total_cruises,
        COUNT(DISTINCT id) as unique_cruises
      FROM cruises
      WHERE cruise_line_id = 22
    `);

    console.log('DATABASE counts:');
    console.log(`  Total cruises: ${dbResult[0].total_cruises}`);
    console.log(`  Unique cruise IDs: ${dbResult[0].unique_cruises}`);

    // Check for duplicates
    const duplicatesResult = await db.execute(sql`
      SELECT
        id,
        COUNT(*) as count
      FROM cruises
      WHERE cruise_line_id = 22
      GROUP BY id
      HAVING COUNT(*) > 1
      LIMIT 10
    `);

    if (duplicatesResult.length > 0) {
      console.log('\n❌ DUPLICATES FOUND:');
      duplicatesResult.forEach(row => {
        console.log(`  Cruise ID ${row.id}: ${row.count} copies`);
      });
    } else {
      console.log('\n✅ No duplicates in database');
    }

  } catch (error) {
    console.error('Database error:', error.message);
  }

  // 2. Check FTP file count
  const client = new ftp.Client();
  client.ftp.verbose = false;

  try {
    console.log('\n\nFTP counts:');
    console.log('Connecting to FTP...');

    await client.access({
      host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
      user: process.env.TRAVELTEK_FTP_USER,
      password: process.env.TRAVELTEK_FTP_PASSWORD,
      secure: false,
    });

    const lineId = 22;
    const currentYear = 2025;
    const currentMonth = 9;
    let totalFiles = 0;
    let uniqueCruiseIds = new Set();
    let monthCounts = {};

    // Scan all months from current month onwards
    for (let month = currentMonth; month <= 12; month++) {
      const monthStr = month.toString().padStart(2, '0');
      const linePath = `/${currentYear}/${monthStr}/${lineId}`;

      try {
        const shipDirs = await client.list(linePath);
        let monthFileCount = 0;

        for (const shipDir of shipDirs) {
          if (shipDir.type === 2) { // Directory
            const shipPath = `${linePath}/${shipDir.name}`;
            const cruiseFiles = await client.list(shipPath);

            for (const file of cruiseFiles) {
              if (file.type === 1 && file.name.endsWith('.json')) {
                totalFiles++;
                monthFileCount++;
                const cruiseId = file.name.replace('.json', '');
                uniqueCruiseIds.add(cruiseId);
              }
            }
          }
        }

        monthCounts[`${currentYear}/${monthStr}`] = monthFileCount;
      } catch (error) {
        // Month not found
      }
    }

    console.log(`  Total files on FTP: ${totalFiles}`);
    console.log(`  Unique cruise IDs: ${uniqueCruiseIds.size}`);
    console.log(`  Files per cruise: ${(totalFiles / uniqueCruiseIds.size).toFixed(2)}`);

    console.log('\n  Files by month:');
    Object.entries(monthCounts).forEach(([month, count]) => {
      console.log(`    ${month}: ${count} files`);
    });

    // Check for 2026 files
    console.log('\n  Checking for 2026 files...');
    let files2026 = 0;
    for (let month = 1; month <= 12; month++) {
      const monthStr = month.toString().padStart(2, '0');
      const linePath = `/2026/${monthStr}/${lineId}`;

      try {
        const shipDirs = await client.list(linePath);
        for (const shipDir of shipDirs) {
          if (shipDir.type === 2) {
            const shipPath = `${linePath}/${shipDir.name}`;
            const cruiseFiles = await client.list(shipPath);
            files2026 += cruiseFiles.filter(f => f.type === 1 && f.name.endsWith('.json')).length;
          }
        }
      } catch (error) {
        // Month not found
      }
    }

    if (files2026 > 0) {
      console.log(`    2026 files found: ${files2026}`);
      totalFiles += files2026;
    }

    console.log(`\n  TOTAL FILES (2025 + 2026): ${totalFiles}`);

    // Now calculate what might cause 13,511
    console.log('\n\n=== ANALYSIS: Why 13,511? ===');
    console.log(`  Database cruises: 3,161`);
    console.log(`  FTP files found: ${totalFiles}`);
    console.log(`  Ratio: ${(13511 / 3161).toFixed(2)}x database count`);
    console.log(`  Ratio: ${(13511 / totalFiles).toFixed(2)}x FTP files`);

    // Check if it's processing multiple years
    const yearsToCheck = [2025, 2026, 2027, 2028, 2029];
    console.log(`\n  If processor scans ${yearsToCheck.length} years with ~${totalFiles} files each:`);
    console.log(`    Expected: ${totalFiles * yearsToCheck.length} files`);

    // Check if it's processing all months for multiple years
    console.log(`\n  If processor scans all 12 months regardless of current month:`);
    console.log(`    12 months * ~${Math.round(totalFiles/4)} files per month = ~${12 * Math.round(totalFiles/4)} files`);

  } catch (error) {
    console.error('FTP error:', error.message);
  } finally {
    client.close();
  }

  process.exit(0);
}

checkRoyalCaribbeanCounts().catch(console.error);
