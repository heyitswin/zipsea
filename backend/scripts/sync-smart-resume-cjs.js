#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const pg = require('pg');
const dotenv = require('dotenv');
const Client = require('ssh2-sftp-client');

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
      GROUP BY year, month
      ORDER BY year, month
    `);

    return result.rows.map(row => ({
      year: row.year,
      month: row.month,
      count: parseInt(row.cruise_count)
    }));
  } catch (error) {
    console.error('Error getting processed months:', error);
    return [];
  }
}

async function getLastSyncedMonth() {
  try {
    const result = await pool.query(`
      SELECT
        MAX(departure_date) as last_date,
        COUNT(*) as total_cruises
      FROM cruises
      WHERE departure_date IS NOT NULL
    `);

    if (result.rows[0]?.last_date) {
      const lastDate = new Date(result.rows[0].last_date);
      return {
        year: lastDate.getFullYear(),
        month: lastDate.getMonth() + 1,
        totalCruises: parseInt(result.rows[0].total_cruises)
      };
    }

    return null;
  } catch (error) {
    console.error('Error getting last synced month:', error);
    return null;
  }
}

async function loadCheckpoint() {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      const data = fs.readFileSync(CHECKPOINT_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading checkpoint:', error);
  }

  return {
    lastProcessedPath: null,
    processedFiles: [],
    processedMonths: [],
    totalFilesProcessed: 0,
    totalCruisesCreated: 0,
    totalCruisesUpdated: 0,
    errors: [],
    startTime: new Date().toISOString()
  };
}

async function saveCheckpoint(checkpoint) {
  try {
    const dir = path.dirname(CHECKPOINT_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
    console.log(`✅ Checkpoint saved: ${checkpoint.totalFilesProcessed} files processed`);
  } catch (error) {
    console.error('Error saving checkpoint:', error);
  }
}

async function getMonthsToProcess(startYear = 2025, startMonth = 1) {
  const endYear = 2028;
  const endMonth = 12;

  const months = [];

  for (let year = startYear; year <= endYear; year++) {
    const monthStart = (year === startYear) ? startMonth : 1;
    const monthEnd = (year === endYear) ? endMonth : 12;

    for (let month = monthStart; month <= monthEnd; month++) {
      months.push({ year, month });
    }
  }

  return months;
}

async function main() {
  console.log('🚀 Smart Resume FTP Sync Starting...');
  console.log('====================================');

  // Check database connection
  try {
    await pool.query('SELECT 1');
    console.log('✅ Database connected');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }

  // Load checkpoint
  const checkpoint = await loadCheckpoint();
  console.log(`📊 Checkpoint loaded: ${checkpoint.totalFilesProcessed} files already processed`);

  // Get last synced month from database
  const lastSynced = await getLastSyncedMonth();
  if (lastSynced) {
    console.log(`📅 Last synced month in DB: ${lastSynced.year}/${String(lastSynced.month).padStart(2, '0')}`);
    console.log(`📊 Total cruises in DB: ${lastSynced.totalCruises}`);
  } else {
    console.log('📅 No cruises found in database, starting fresh sync');
  }

  // Determine starting point
  let startYear = 2025;
  let startMonth = 1;

  if (lastSynced) {
    // Start from the next month after last synced
    startMonth = lastSynced.month + 1;
    startYear = lastSynced.year;

    if (startMonth > 12) {
      startMonth = 1;
      startYear++;
    }
  }

  console.log(`🎯 Will start syncing from: ${startYear}/${String(startMonth).padStart(2, '0')}`);

  // Get months to process
  const monthsToProcess = await getMonthsToProcess(startYear, startMonth);
  console.log(`📆 Months to process: ${monthsToProcess.length}`);

  if (monthsToProcess.length === 0) {
    console.log('✅ All months are already synced!');
    process.exit(0);
  }

  // Display plan
  console.log('\n📋 Sync Plan:');
  console.log('=============');
  monthsToProcess.slice(0, 5).forEach(({ year, month }) => {
    console.log(`  - ${year}/${String(month).padStart(2, '0')}`);
  });
  if (monthsToProcess.length > 5) {
    console.log(`  ... and ${monthsToProcess.length - 5} more months`);
  }

  console.log('\n⏳ Starting sync in 5 seconds...');
  console.log('   (Press Ctrl+C to cancel)\n');

  await new Promise(resolve => setTimeout(resolve, 5000));

  // TODO: Add actual sync logic here
  console.log('🚧 Sync logic not yet implemented in this version');
  console.log('📝 For now, you can use the existing sync scripts:');
  console.log('   - node scripts/sync-db-aware.js');
  console.log('   - node scripts/sync-complete-enhanced.js');

  await pool.end();
}

// Run the sync
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
