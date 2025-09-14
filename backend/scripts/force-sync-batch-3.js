#!/usr/bin/env node

require('dotenv').config();
const ftp = require('basic-ftp');
const { WebhookProcessorOptimizedV2 } = require('../dist/services/webhook-processor-optimized-v2.service');

async function forceSyncBatch3() {
  const client = new ftp.Client();
  client.ftp.verbose = false;

  try {
    console.log('Force syncing batch 3 files for Royal Caribbean...\n');

    await client.access({
      host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
      user: process.env.TRAVELTEK_FTP_USER,
      password: process.env.TRAVELTEK_FTP_PASSWORD,
      secure: false,
    });

    const lineId = 22;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Discover all files
    const files = [];
    const availableYears = [currentYear];

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
        } catch (error) {
          // Silent
        }
      }
    }

    // Sort files exactly as processor does
    files.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });

    console.log(`Total files: ${files.length}`);

    // Get batch 3 (files 200-299)
    const batch3Start = 200;
    const batch3End = 300;
    const batch3Files = files.slice(batch3Start, Math.min(batch3End, files.length));

    console.log(`\nProcessing batch 3: files ${batch3Start + 1} to ${batch3Start + batch3Files.length}`);
    console.log(`Batch contains ${batch3Files.length} files`);

    // Check for cruise 2143102
    const cruise2143102 = batch3Files.find(f => f.cruiseId === '2143102');
    if (cruise2143102) {
      console.log(`\n✅ Cruise 2143102 found in batch at position ${batch3Files.indexOf(cruise2143102) + 1}`);
      console.log(`  Path: ${cruise2143102.path}`);
      console.log(`  Size: ${cruise2143102.size} bytes`);
    } else {
      console.log('\n⚠️ Cruise 2143102 NOT in this batch');
    }

    // Process files in smaller chunks to avoid timeouts
    console.log('\nProcessing files in chunks of 5...');
    const CHUNK_SIZE = 5;
    let processed = 0;
    let updated = 0;
    let failed = 0;

    for (let i = 0; i < batch3Files.length; i += CHUNK_SIZE) {
      const chunk = batch3Files.slice(i, i + CHUNK_SIZE);
      console.log(`\nProcessing chunk ${Math.floor(i / CHUNK_SIZE) + 1}: files ${i + 1}-${Math.min(i + CHUNK_SIZE, batch3Files.length)}`);

      const results = await Promise.allSettled(
        chunk.map(async (file) => {
          try {
            console.log(`  Processing ${file.cruiseId}...`);
            const result = await WebhookProcessorOptimizedV2.processFileStatic(file);
            if (result) {
              console.log(`    ✅ ${file.cruiseId} updated`);
              updated++;
            } else {
              console.log(`    ⚠️ ${file.cruiseId} processed but not updated`);
            }
            processed++;
            return result;
          } catch (error) {
            console.error(`    ❌ ${file.cruiseId} failed: ${error.message}`);
            failed++;
            throw error;
          }
        })
      );

      // Add delay between chunks to prevent overwhelming the system
      if (i + CHUNK_SIZE < batch3Files.length) {
        console.log('  Waiting 2 seconds before next chunk...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log('\n=== Final Results ===');
    console.log(`Processed: ${processed}/${batch3Files.length}`);
    console.log(`Updated: ${updated}`);
    console.log(`Failed: ${failed}`);

    if (cruise2143102) {
      // Check if it was updated
      const { db } = require('../dist/db/connection');
      const { cheapestPricing } = require('../dist/db/schema');
      const { eq } = require('drizzle-orm');
      const { sql } = require('drizzle-orm');

      const result = await db.execute(sql`
        SELECT interior_price, balcony_price
        FROM cheapest_pricing
        WHERE cruise_id = '2143102'
      `);

      if (result && result.length > 0) {
        const pricing = result[0];
        console.log('\n=== Cruise 2143102 Pricing After Sync ===');
        console.log(`Interior: $${pricing.interior_price} ${Math.abs(pricing.interior_price - 801) < 1 ? '✅ UPDATED!' : '❌ Not updated'}`);
        console.log(`Balcony: $${pricing.balcony_price} ${Math.abs(pricing.balcony_price - 1354) < 1 ? '✅ UPDATED!' : '❌ Not updated'}`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.close();
    process.exit(0);
  }
}

forceSyncBatch3().catch(console.error);
