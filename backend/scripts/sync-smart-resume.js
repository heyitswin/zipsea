#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';
import Client from 'ssh2-sftp-client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { Pool } = pg;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_URL_PRODUCTION,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// SFTP Configuration
const sftpConfig = {
  host: process.env.TRAVELTEK_FTP_HOST || 'ftp.traveltek.net',
  port: parseInt(process.env.TRAVELTEK_FTP_PORT || '22'),
  username: process.env.TRAVELTEK_FTP_USERNAME,
  password: process.env.TRAVELTEK_FTP_PASSWORD,
  readyTimeout: 60000,
  retries: 3,
  retry_delay: 5000
};

// Configuration
const REMOTE_BASE_PATH = process.env.TRAVELTEK_FTP_PATH || '/';
const LOCAL_BACKUP_DIR = '/Volumes/Data_2TB/zipsea-ftp-backup';
const CHECKPOINT_FILE = path.join(__dirname, '../data/sync-checkpoint.json');
const BATCH_SIZE = 10;
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

async function getProcessedMonths() {
  try {
    const result = await pool.query(`
      SELECT DISTINCT
        EXTRACT(YEAR FROM departure_date)::int as year,
        EXTRACT(MONTH FROM departure_date)::int as month,
        COUNT(*) as cruise_count
      FROM cruises
      WHERE departure_date IS NOT NULL
        AND EXTRACT(YEAR FROM departure_date) >= 2025
      GROUP BY year, month
      ORDER BY year, month
    `);

    const processedMonths = new Set();
    console.log('\n📊 Database Status:');
    console.log('═══════════════════════════════════════');

    result.rows.forEach(row => {
      const key = `${row.year}-${String(row.month).padStart(2, '0')}`;
      processedMonths.add(key);
      console.log(`   ✅ ${row.year}/${String(row.month).padStart(2, '0')}: ${row.cruise_count.toLocaleString()} cruises`);
    });

    return processedMonths;
  } catch (error) {
    console.error('Error querying database:', error);
    return new Set();
  }
}

async function shouldProcessMonth(year, month, processedMonths) {
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;

  // Check if this month has significant data already
  if (processedMonths.has(monthKey)) {
    try {
      const result = await pool.query(`
        SELECT COUNT(*) as count
        FROM cruises
        WHERE EXTRACT(YEAR FROM departure_date) = $1
          AND EXTRACT(MONTH FROM departure_date) = $2
      `, [year, month]);

      const cruiseCount = parseInt(result.rows[0].count);

      // If we have more than 100 cruises for this month, consider it processed
      if (cruiseCount > 100) {
        console.log(`   ⏭️  Skipping ${year}/${String(month).padStart(2, '0')} (${cruiseCount.toLocaleString()} cruises already in database)`);
        return false;
      }
    } catch (error) {
      console.error(`Error checking month ${year}/${month}:`, error);
    }
  }

  return true;
}

async function findNextUnprocessedMonth(processedMonths) {
  const currentDate = new Date();
  const maxYear = currentDate.getFullYear() + 2; // Look up to 2 years ahead

  // Start from 2025/01 and find the first unprocessed month
  for (let year = 2025; year <= maxYear; year++) {
    for (let month = 1; month <= 12; month++) {
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      if (!processedMonths.has(monthKey)) {
        // Check if this is a future month beyond reasonable booking window
        const monthDate = new Date(year, month - 1, 1);
        const monthsAhead = (monthDate.getFullYear() - currentDate.getFullYear()) * 12 +
                           (monthDate.getMonth() - currentDate.getMonth());

        if (monthsAhead > 24) { // Don't process more than 24 months ahead
          console.log(`\n✅ All months up to ${year}/${String(month - 1).padStart(2, '0')} have been processed`);
          return null;
        }

        return { year, month };
      }
    }
  }

  return null;
}

async function syncMonth(sftp, year, month) {
  const monthStr = String(month).padStart(2, '0');
  const remotePath = `${REMOTE_BASE_PATH}/${year}/${monthStr}`;
  const localPath = path.join(LOCAL_BACKUP_DIR, String(year), monthStr);

  console.log(`\n📁 Processing ${year}/${monthStr}`);
  console.log(`   Remote: ${remotePath}`);
  console.log(`   Local: ${localPath}`);

  try {
    // Check if remote directory exists
    const exists = await sftp.exists(remotePath);
    if (!exists) {
      console.log(`   ⚠️  Remote directory doesn't exist, skipping`);
      return { processed: 0, errors: 0 };
    }

    // List files in remote directory
    const files = await sftp.list(remotePath);
    const jsonFiles = files.filter(f => f.name.endsWith('.json'));

    if (jsonFiles.length === 0) {
      console.log(`   📭 No JSON files found`);
      return { processed: 0, errors: 0 };
    }

    console.log(`   📋 Found ${jsonFiles.length} JSON files`);

    // Ensure local directory exists
    await fs.promises.mkdir(localPath, { recursive: true });

    let processed = 0;
    let errors = 0;

    // Process files in batches
    for (let i = 0; i < jsonFiles.length; i += BATCH_SIZE) {
      const batch = jsonFiles.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async (file) => {
        const remoteFile = `${remotePath}/${file.name}`;
        const localFile = path.join(localPath, file.name);

        try {
          // Check if file already exists locally
          if (fs.existsSync(localFile)) {
            const stats = await fs.promises.stat(localFile);
            if (stats.size === file.size) {
              // File already downloaded, skip
              return;
            }
          }

          // Download file
          await sftp.fastGet(remoteFile, localFile);
          processed++;

          if (processed % 10 === 0) {
            console.log(`   ⬇️  Downloaded ${processed}/${jsonFiles.length} files`);
          }
        } catch (error) {
          console.error(`   ❌ Error downloading ${file.name}:`, error.message);
          errors++;
        }
      }));
    }

    console.log(`   ✅ Completed: ${processed} downloaded, ${errors} errors`);
    return { processed, errors };

  } catch (error) {
    console.error(`   ❌ Error processing month:`, error);
    return { processed: 0, errors: 1 };
  }
}

async function processCruiseData(filePath) {
  try {
    const data = await fs.promises.readFile(filePath, 'utf8');
    const jsonData = JSON.parse(data);

    if (!jsonData.cruise) return 0;

    const cruise = jsonData.cruise;

    // Prepare cruise data for database
    const cruiseData = {
      cruise_id: cruise.id,
      cruise_line_id: cruise.cruiseLineId,
      ship_id: cruise.shipId,
      departure_date: cruise.departureDate,
      arrival_date: cruise.arrivalDate,
      duration: cruise.duration,
      name: cruise.name,
      raw_data: jsonData
    };

    // Upsert to database
    await pool.query(`
      INSERT INTO cruises (
        cruise_id, cruise_line_id, ship_id,
        departure_date, arrival_date, duration,
        name, raw_data, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())
      ON CONFLICT (cruise_id)
      DO UPDATE SET
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()
    `, [
      cruiseData.cruise_id,
      cruiseData.cruise_line_id,
      cruiseData.ship_id,
      cruiseData.departure_date,
      cruiseData.arrival_date,
      cruiseData.duration,
      cruiseData.name,
      JSON.stringify(cruiseData.raw_data)
    ]);

    return 1;
  } catch (error) {
    console.error(`Error processing cruise data from ${filePath}:`, error.message);
    return 0;
  }
}

async function processDownloadedFiles(year, month) {
  const monthStr = String(month).padStart(2, '0');
  const localPath = path.join(LOCAL_BACKUP_DIR, String(year), monthStr);

  console.log(`\n🔄 Processing downloaded files for ${year}/${monthStr}`);

  try {
    const files = await fs.promises.readdir(localPath);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    if (jsonFiles.length === 0) {
      console.log('   📭 No JSON files to process');
      return;
    }

    console.log(`   📋 Processing ${jsonFiles.length} JSON files`);

    let processed = 0;
    let errors = 0;

    // Process in batches
    for (let i = 0; i < jsonFiles.length; i += BATCH_SIZE) {
      const batch = jsonFiles.slice(i, i + BATCH_SIZE);

      const results = await Promise.all(batch.map(async (file) => {
        const filePath = path.join(localPath, file);
        return await processCruiseData(filePath);
      }));

      processed += results.filter(r => r > 0).length;
      errors += results.filter(r => r === 0).length;

      if ((i + BATCH_SIZE) % 50 === 0 || i + BATCH_SIZE >= jsonFiles.length) {
        console.log(`   💾 Processed ${Math.min(i + BATCH_SIZE, jsonFiles.length)}/${jsonFiles.length} files`);
      }
    }

    console.log(`   ✅ Database update complete: ${processed} cruises added/updated, ${errors} errors`);

  } catch (error) {
    console.error('Error processing downloaded files:', error);
  }
}

async function main() {
  console.log('🚀 Smart Sync Resume - Database-Driven Approach');
  console.log('════════════════════════════════════════════════');

  const sftp = new Client();

  try {
    // Get processed months from database
    const processedMonths = await getProcessedMonths();

    // Find next unprocessed month
    const nextMonth = await findNextUnprocessedMonth(processedMonths);

    if (!nextMonth) {
      console.log('\n✅ All available months have been processed!');
      await pool.end();
      return;
    }

    console.log(`\n🎯 Starting from: ${nextMonth.year}/${String(nextMonth.month).padStart(2, '0')}`);

    // Connect to SFTP
    console.log('\n📡 Connecting to SFTP server...');
    await sftp.connect(sftpConfig);
    console.log('   ✅ Connected successfully');

    // Process months starting from the next unprocessed one
    let year = nextMonth.year;
    let month = nextMonth.month;
    const currentDate = new Date();
    const maxDate = new Date(currentDate.getFullYear() + 2, currentDate.getMonth(), 1);

    while (new Date(year, month - 1, 1) <= maxDate) {
      // Check if we should process this month
      if (await shouldProcessMonth(year, month, processedMonths)) {
        // Download files from SFTP
        const { processed, errors } = await syncMonth(sftp, year, month);

        if (processed > 0) {
          // Process the downloaded files into database
          await processDownloadedFiles(year, month);

          // Update our processed months set
          processedMonths.add(`${year}-${String(month).padStart(2, '0')}`);
        }

        // Small delay between months
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Move to next month
      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    }

    console.log('\n✅ Sync completed successfully!');

  } catch (error) {
    console.error('\n❌ Sync failed:', error);
    process.exit(1);
  } finally {
    await sftp.end();
    await pool.end();
  }
}

// Run the sync
main().catch(console.error);
