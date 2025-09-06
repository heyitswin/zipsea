#!/usr/bin/env node
/**
 * Database-Aware Sync Script
 * Checks what's in the database before processing to prevent reprocessing
 */

const ftp = require('basic-ftp');
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
const { Writable } = require('stream');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Configuration
const CONFIG = {
  START_YEAR: 2025,
  START_MONTH: 1,
  END_YEAR: 2028,
  END_MONTH: 12,
  BATCH_SIZE: 100,
  MAX_CONNECTIONS: 5,
  CHECKPOINT_FILE: './sync-db-aware-checkpoint.json',
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000,
  CONNECTION_TIMEOUT: 30000,
  KEEP_ALIVE_INTERVAL: 30000,
  MIN_CRUISES_PER_MONTH: 100, // Consider month processed if it has at least this many cruises
};

// Global state
let dbPool;
let ftpConnectionPool = [];
let checkpoint = {
  lastProcessedMonth: null,
  processedFiles: [],
  totalFilesProcessed: 0,
  errors: [],
  startTime: null,
};

// Initialize database connection pool
async function initializeDatabase() {
  dbPool = new Pool({
    connectionString: process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await dbPool.query('SELECT 1');
    console.log('✅ Database connection established');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    throw error;
  }
}

// Get all processed months from database
async function getProcessedMonthsFromDB() {
  try {
    const result = await dbPool.query(
      `
      SELECT DISTINCT
        EXTRACT(YEAR FROM sailing_date)::int as year,
        EXTRACT(MONTH FROM sailing_date)::int as month,
        COUNT(*) as cruise_count
      FROM cruises
      WHERE sailing_date IS NOT NULL
        AND EXTRACT(YEAR FROM sailing_date) >= 2025
      GROUP BY year, month
      HAVING COUNT(*) >= $1
      ORDER BY year, month
    `,
      [CONFIG.MIN_CRUISES_PER_MONTH]
    );

    const processedMonths = new Map();
    console.log('\n📊 Database Analysis - Months with significant data:');
    console.log('═══════════════════════════════════════════════════');

    result.rows.forEach(row => {
      const key = `${row.year}/${String(row.month).padStart(2, '0')}`;
      processedMonths.set(key, parseInt(row.cruise_count));
      console.log(`   ✅ ${key}: ${row.cruise_count.toLocaleString()} cruises`);
    });

    return processedMonths;
  } catch (error) {
    console.error('Error analyzing database:', error);
    return new Map();
  }
}

// Find the next month to process
async function findNextMonthToProcess() {
  const processedMonths = await getProcessedMonthsFromDB();

  // Find the first gap in processed months
  const currentDate = new Date();
  const maxDate = new Date(CONFIG.END_YEAR, CONFIG.END_MONTH - 1, 1);

  for (let year = CONFIG.START_YEAR; year <= CONFIG.END_YEAR; year++) {
    const startMonth = year === CONFIG.START_YEAR ? CONFIG.START_MONTH : 1;
    const endMonth = year === CONFIG.END_YEAR ? CONFIG.END_MONTH : 12;

    for (let month = startMonth; month <= endMonth; month++) {
      const monthKey = `${year}/${String(month).padStart(2, '0')}`;
      const monthDate = new Date(year, month - 1, 1);

      // Skip if too far in the future
      if (monthDate > maxDate) {
        console.log(`\n✅ All months up to ${maxDate.toISOString().slice(0, 7)} have been checked`);
        return null;
      }

      // If this month isn't processed or has very few cruises, process it
      if (!processedMonths.has(monthKey)) {
        console.log(`\n🎯 Next unprocessed month: ${monthKey}`);
        return { year, month };
      }
    }
  }

  console.log('\n✅ All months have been processed!');
  return null;
}

// Check if we should skip a specific month
async function shouldSkipMonth(year, month) {
  try {
    const result = await dbPool.query(
      `
      SELECT COUNT(*) as count
      FROM cruises
      WHERE EXTRACT(YEAR FROM sailing_date) = $1
        AND EXTRACT(MONTH FROM sailing_date) = $2
    `,
      [year, month]
    );

    const cruiseCount = parseInt(result.rows[0].count);

    if (cruiseCount >= CONFIG.MIN_CRUISES_PER_MONTH) {
      console.log(
        `   ⏭️  Skipping ${year}/${String(month).padStart(2, '0')} (${cruiseCount.toLocaleString()} cruises already in database)`
      );
      return true;
    }

    console.log(
      `   📝 Processing ${year}/${String(month).padStart(2, '0')} (only ${cruiseCount} cruises in database)`
    );
    return false;
  } catch (error) {
    console.error(`Error checking month ${year}/${month}:`, error.message);
    return false;
  }
}

// Load checkpoint
async function loadCheckpoint() {
  try {
    const data = await fs.readFile(CONFIG.CHECKPOINT_FILE, 'utf8');
    checkpoint = JSON.parse(data);
    console.log('📚 Loaded checkpoint:', {
      lastMonth: checkpoint.lastProcessedMonth,
      filesProcessed: checkpoint.totalFilesProcessed,
    });
  } catch (error) {
    console.log('📝 No checkpoint found, starting fresh');
    checkpoint.startTime = new Date().toISOString();
  }
}

// Save checkpoint
async function saveCheckpoint() {
  try {
    await fs.writeFile(CONFIG.CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
  } catch (error) {
    console.error('Error saving checkpoint:', error.message);
  }
}

// Initialize FTP connection pool
async function initializeFTPPool() {
  for (let i = 0; i < CONFIG.MAX_CONNECTIONS; i++) {
    const client = new ftp.Client();
    client.ftp.verbose = false;
    client.ftp.timeout = CONFIG.CONNECTION_TIMEOUT;
    ftpConnectionPool.push({ client, busy: false });
  }
}

// Get an available FTP connection
async function getFTPConnection() {
  // Find an idle connection
  let connection = ftpConnectionPool.find(c => !c.busy);

  if (!connection) {
    // Wait and retry
    await new Promise(resolve => setTimeout(resolve, 1000));
    return getFTPConnection();
  }

  connection.busy = true;

  // Ensure connection is alive
  try {
    await connection.client.pwd();
  } catch (error) {
    // Reconnect if needed
    try {
      await connection.client.access({
        host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
        user: process.env.TRAVELTEK_FTP_USER || process.env.TRAVELTEK_FTP_USERNAME,
        password: process.env.TRAVELTEK_FTP_PASSWORD,
        secure: false,
      });
    } catch (connectError) {
      connection.busy = false;
      throw connectError;
    }
  }

  return connection;
}

// Release FTP connection
function releaseFTPConnection(connection) {
  if (connection) {
    connection.busy = false;
  }
}

// Process a single cruise file
async function processCruiseFile(fileContent, fileName) {
  try {
    const data = JSON.parse(fileContent);

    if (!data.cruise) {
      return { success: false, error: 'No cruise data found' };
    }

    const cruise = data.cruise;

    // Extract all data (similar to existing sync script)
    const result = await dbPool.query(
      `
      INSERT INTO cruises (
        cruise_id, cruise_line_id, ship_id, ship_name,
        sailing_date, return_date, embarkation_port_id, disembarkation_port_id,
        duration, name, cruise_name,
        interior_price, oceanview_price, balcony_price, suite_price,
        embarkation_time, disembarkation_time,
        raw_data, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5::date, $6::date, $7, $8, $9, $10, $11,
        $12::decimal, $13::decimal, $14::decimal, $15::decimal,
        $16, $17, $18::jsonb, NOW(), NOW()
      )
      ON CONFLICT (cruise_id)
      DO UPDATE SET
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()
      RETURNING cruise_id
    `,
      [
        cruise.id,
        cruise.cruiselineId || cruise.cruiseLineId,
        cruise.shipId,
        cruise.shipName || data.shipcontent?.title,
        cruise.departureDate,
        cruise.arrivalDate,
        cruise.departurePort || data.sailingRegion?.departurePort,
        cruise.arrivalPort || data.sailingRegion?.arrivalPort,
        cruise.duration,
        cruise.name,
        cruise.cruiseName || cruise.name,
        data.cheapest?.combined?.inside || null,
        data.cheapest?.combined?.outside || null,
        data.cheapest?.combined?.balcony || null,
        data.cheapest?.combined?.suite || null,
        cruise.embarkationTime,
        cruise.disembarkationTime,
        JSON.stringify(data),
      ]
    );

    return { success: true, cruiseId: result.rows[0].cruise_id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Process a month's worth of data
async function processMonth(year, month) {
  // First check if we should skip this month
  if (await shouldSkipMonth(year, month)) {
    return { skipped: true, processed: 0, errors: 0 };
  }

  const monthStr = String(month).padStart(2, '0');
  const monthPath = `${year}/${monthStr}`;

  console.log(`\n📅 Processing ${monthPath}`);
  console.log('═══════════════════════════════════════');

  let connection = null;
  let processed = 0;
  let errors = 0;
  let skipped = 0;

  try {
    connection = await getFTPConnection();

    // List files in the month directory
    const files = await connection.client.list(monthPath);
    const jsonFiles = files.filter(f => f.name.endsWith('.json'));

    console.log(`📁 Found ${jsonFiles.length} JSON files`);

    if (jsonFiles.length === 0) {
      releaseFTPConnection(connection);
      return { skipped: false, processed: 0, errors: 0 };
    }

    // Process files in batches
    for (let i = 0; i < jsonFiles.length; i += CONFIG.BATCH_SIZE) {
      const batch = jsonFiles.slice(i, i + CONFIG.BATCH_SIZE);

      const batchPromises = batch.map(async file => {
        const filePath = `${monthPath}/${file.name}`;

        // Check if already processed
        if (checkpoint.processedFiles.includes(filePath)) {
          skipped++;
          return;
        }

        let fileConnection = null;
        try {
          fileConnection = await getFTPConnection();

          // Download file to memory
          const chunks = [];
          const writable = new Writable({
            write(chunk, encoding, callback) {
              chunks.push(chunk);
              callback();
            },
          });

          await fileConnection.client.downloadTo(writable, filePath);
          const fileContent = Buffer.concat(chunks).toString('utf8');

          // Process the cruise data
          const result = await processCruiseFile(fileContent, file.name);

          if (result.success) {
            processed++;
            checkpoint.processedFiles.push(filePath);
            checkpoint.totalFilesProcessed++;
          } else {
            errors++;
            checkpoint.errors.push({ file: filePath, error: result.error });
          }
        } catch (error) {
          errors++;
          checkpoint.errors.push({ file: filePath, error: error.message });
        } finally {
          releaseFTPConnection(fileConnection);
        }
      });

      await Promise.all(batchPromises);

      // Progress update
      const totalProcessed = i + batch.length;
      console.log(
        `   ⚡ Progress: ${totalProcessed}/${jsonFiles.length} files (${processed} added, ${errors} errors, ${skipped} skipped)`
      );

      // Save checkpoint periodically
      if (totalProcessed % 500 === 0) {
        checkpoint.lastProcessedMonth = monthPath;
        await saveCheckpoint();
      }
    }

    checkpoint.lastProcessedMonth = monthPath;
    await saveCheckpoint();

    console.log(
      `✅ Month complete: ${processed} cruises added, ${errors} errors, ${skipped} skipped`
    );
  } catch (error) {
    console.error(`❌ Error processing month ${monthPath}:`, error.message);
  } finally {
    releaseFTPConnection(connection);
  }

  return { skipped: false, processed, errors };
}

// Main sync function
async function sync() {
  console.log('🚀 Database-Aware Traveltek Sync');
  console.log('═══════════════════════════════════════');
  console.log('This script checks the database before processing to avoid duplicates\n');

  try {
    // Initialize
    await initializeDatabase();
    await initializeFTPPool();
    await loadCheckpoint();

    // Connect all FTP clients
    console.log('📡 Establishing FTP connections...');
    for (const conn of ftpConnectionPool) {
      await conn.client.access({
        host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
        user: process.env.TRAVELTEK_FTP_USER || process.env.TRAVELTEK_FTP_USERNAME,
        password: process.env.TRAVELTEK_FTP_PASSWORD,
        secure: false,
      });
    }
    console.log('✅ FTP connections established\n');

    // Find next month to process
    const nextMonth = await findNextMonthToProcess();

    if (!nextMonth) {
      console.log('\n✨ All data is up to date!');
      return;
    }

    // Process months starting from the next unprocessed one
    let year = nextMonth.year;
    let month = nextMonth.month;
    let totalProcessed = 0;
    let totalErrors = 0;

    while (year <= CONFIG.END_YEAR) {
      if (year === CONFIG.END_YEAR && month > CONFIG.END_MONTH) {
        break;
      }

      const result = await processMonth(year, month);

      if (!result.skipped) {
        totalProcessed += result.processed;
        totalErrors += result.errors;
      }

      // Move to next month
      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    }

    // Final summary
    console.log('\n🎉 Sync Complete!');
    console.log('═══════════════════════════════════════');
    console.log(`✅ Total cruises processed: ${totalProcessed.toLocaleString()}`);
    console.log(`❌ Total errors: ${totalErrors}`);
    console.log(
      `⏱️  Total time: ${Math.round((Date.now() - new Date(checkpoint.startTime)) / 60000)} minutes`
    );
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    // Cleanup
    for (const conn of ftpConnectionPool) {
      conn.client.close();
    }
    if (dbPool) {
      await dbPool.end();
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Graceful shutdown initiated...');
  await saveCheckpoint();

  for (const conn of ftpConnectionPool) {
    conn.client.close();
  }

  if (dbPool) {
    await dbPool.end();
  }

  process.exit(0);
});

// Run the sync
sync().catch(console.error);
