#!/usr/bin/env node

/**
 * Simple Initial FTP Sync Script - Final Fixed Version
 * - No connection pooling to avoid race conditions
 * - Creates new connection for each operation
 * - Processes from 2025/09 onwards to current month
 * - Basic resume capability
 * - Fixed SQL parameter count and field type conversion
 * - Handles "NaN" string values properly
 * Date: 2025-01-14
 */

const ftp = require('basic-ftp');
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Configuration
const CONFIG = {
  START_YEAR: 2025,
  START_MONTH: 9,
  BATCH_SIZE: 20, // Small batches for stability
  CHECKPOINT_FILE: './sync-checkpoint.json',
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000,
  CONNECTION_TIMEOUT: 30000,
};

// Global state
let dbPool;
let checkpoint = {
  lastProcessedMonth: null,
  processedFiles: [],
  totalFilesProcessed: 0,
  errors: [],
  startTime: null,
};

// Statistics
const stats = {
  totalFiles: 0,
  totalProcessed: 0,
  totalSuccess: 0,
  totalFailed: 0,
  cruisesCreated: 0,
  cruisesUpdated: 0,
  linesCreated: 0,
  shipsCreated: 0,
  startTime: Date.now(),
};

/**
 * Initialize database connection pool
 */
async function initDatabase() {
  const databaseUrl = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('No database URL found in environment variables');
  }

  dbPool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('render.com') ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  const client = await dbPool.connect();
  try {
    await client.query('SELECT 1');
    console.log('✅ Database connection established');
  } finally {
    client.release();
  }
}

/**
 * Create a new FTP connection
 */
async function createFtpConnection() {
  const ftpConfig = {
    host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
    user: process.env.TRAVELTEK_FTP_USER,
    password: process.env.TRAVELTEK_FTP_PASSWORD,
    secure: false,
    timeout: CONFIG.CONNECTION_TIMEOUT,
    verbose: false,
  };

  const client = new ftp.Client();
  client.ftp.verbose = false;

  await client.access(ftpConfig);
  return client;
}

/**
 * Get list of months to process
 */
function getMonthsToProcess() {
  const months = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  let year = CONFIG.START_YEAR;
  let month = CONFIG.START_MONTH;

  while (year < currentYear || (year === currentYear && month <= currentMonth)) {
    months.push({ year, month });

    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return months;
}

/**
 * Load checkpoint from previous run
 */
async function loadCheckpoint() {
  try {
    const data = await fs.readFile(CONFIG.CHECKPOINT_FILE, 'utf8');
    checkpoint = JSON.parse(data);
    console.log('📥 Loaded checkpoint from previous run');
    console.log(`   Files processed: ${checkpoint.totalFilesProcessed}`);
    return true;
  } catch (error) {
    console.log('📝 No checkpoint found, starting fresh');
    checkpoint.startTime = Date.now();
    return false;
  }
}

/**
 * Save checkpoint
 */
async function saveCheckpoint() {
  checkpoint.totalFilesProcessed = stats.totalProcessed;
  await fs.writeFile(CONFIG.CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
}

/**
 * List all cruise JSON files in a month directory
 */
async function listCruiseFiles(year, month) {
  const client = await createFtpConnection();

  try {
    const monthPath = `/${year}/${String(month).padStart(2, '0')}`;
    console.log(`   📂 Scanning ${monthPath}...`);

    let lineDirectories = [];
    try {
      lineDirectories = await client.list(monthPath);
    } catch (error) {
      if (error.code === 550) {
        console.log(`   ⚠️ Directory ${monthPath} not found`);
        return [];
      }
      throw error;
    }

    const files = [];

    for (const lineDir of lineDirectories) {
      if (!lineDir.isDirectory) continue;

      const lineId = parseInt(lineDir.name);
      if (isNaN(lineId)) continue;

      const linePath = `${monthPath}/${lineDir.name}`;

      try {
        const shipDirectories = await client.list(linePath);

        for (const shipDir of shipDirectories) {
          if (!shipDir.isDirectory) continue;

          const shipId = parseInt(shipDir.name);
          if (isNaN(shipId)) continue;

          const shipPath = `${linePath}/${shipDir.name}`;

          try {
            const cruiseFiles = await client.list(shipPath);

            for (const file of cruiseFiles) {
              if (!file.isFile || !file.name.endsWith('.json')) continue;

              const codetocruiseid = file.name.replace('.json', '');
              files.push({
                path: `${shipPath}/${file.name}`,
                size: file.size,
                lineId,
                shipId,
                codetocruiseid,
                month: `${year}/${String(month).padStart(2, '0')}`,
              });
            }
          } catch (error) {
            console.log(`     ⚠️ Error reading ship directory ${shipPath}: ${error.message}`);
          }
        }
      } catch (error) {
        console.log(`   ⚠️ Error reading line directory ${linePath}: ${error.message}`);
      }
    }

    return files;
  } finally {
    await client.close();
  }
}

/**
 * Download a single file
 */
async function downloadFile(filePath) {
  const client = await createFtpConnection();

  try {
    // Create temp directory if it doesn't exist
    await fs.mkdir('./temp', { recursive: true });

    const tempFilePath = `./temp/${path.basename(filePath)}`;
    await client.downloadTo(tempFilePath, filePath);

    const data = await fs.readFile(tempFilePath, 'utf8');

    // Clean up temp file
    try {
      await fs.unlink(tempFilePath);
    } catch (e) {
      // Ignore cleanup errors
    }

    return JSON.parse(data);
  } finally {
    await client.close();
  }
}

/**
 * Ensure cruise line exists in database
 */
async function ensureCruiseLineExists(client, lineId, data) {
  const linecontent = data.linecontent || {};

  await client.query(
    `
    INSERT INTO cruise_lines (id, name, code, description, engine_name, short_name, title, nice_url, logo, is_active, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      updated_at = NOW()
  `,
    [
      lineId,
      linecontent.name || `Line ${lineId}`,
      linecontent.code || null,
      linecontent.description || null,
      linecontent.enginename || null,
      linecontent.shortname || null,
      linecontent.title || null,
      linecontent.niceurl || null,
      linecontent.logo || null,
      true,
    ]
  );
}

/**
 * Ensure ship exists in database
 */
async function ensureShipExists(client, shipId, lineId, data) {
  const shipcontent = data.shipcontent || {};

  await client.query(
    `
    INSERT INTO ships (id, cruise_line_id, name, nice_name, short_name, code, tonnage, total_cabins, max_passengers, crew, length, beam, draft, speed, registry, built_year, refurbished_year, description, star_rating, adults_only, ship_class, default_ship_image, default_ship_image_hd, default_ship_image_2k, nice_url, is_active, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      cruise_line_id = EXCLUDED.cruise_line_id,
      updated_at = NOW()
  `,
    [
      shipId,
      lineId,
      shipcontent.name || `Ship ${shipId}`,
      shipcontent.nicename || null,
      shipcontent.shortname || null,
      shipcontent.code || null,
      shipcontent.tonnage || null,
      shipcontent.totalcabins || null,
      shipcontent.maxpassengers || shipcontent.occupancy || null,
      shipcontent.totalcrew || null,
      shipcontent.length || null,
      shipcontent.beam || null,
      shipcontent.draft || null,
      shipcontent.speed || null,
      shipcontent.registry || null,
      shipcontent.launched ? new Date(shipcontent.launched).getFullYear() : null,
      shipcontent.refurbishedyear || null,
      shipcontent.shortdescription || null,
      shipcontent.starrating || null,
      shipcontent.adultsonly === 'Y',
      shipcontent.shipclass || null,
      shipcontent.defaultshipimage || null,
      shipcontent.defaultshipimagehd || null,
      shipcontent.defaultshipimage2k || null,
      shipcontent.niceurl || null,
      true,
    ]
  );
}

/**
 * Ensure ports exist in database
 */
async function ensurePortsExist(client, data) {
  if (!data.ports || Object.keys(data.ports).length === 0) {
    return 0;
  }

  let portsCreated = 0;

  for (const [portId, portName] of Object.entries(data.ports)) {
    try {
      await client.query(
        `
        INSERT INTO ports (id, name, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          updated_at = NOW()
      `,
        [portId, portName, true]
      );
      portsCreated++;
    } catch (error) {
      // Continue with other ports
    }
  }

  return portsCreated;
}

/**
 * Safe integer conversion - handles "system", "NaN" strings, null, undefined
 */
function safeIntegerConvert(value) {
  // Handle all problematic values
  if (value === null || value === undefined || value === '' || value === 'NaN' || value === 'system') {
    return null;
  }

  // Handle numeric strings that might be NaN when parsed
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || trimmed === 'NaN' || trimmed === 'system' || isNaN(parseInt(trimmed))) {
      return null;
    }
  }

  const parsed = parseInt(value);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Upsert cruise record
 */
async function upsertCruise(client, data) {
  const cruiseId = data.codetocruiseid;
  const sailingDate = data.saildate || data.startdate;
  const returnDate = sailingDate && data.nights
    ? new Date(new Date(sailingDate).getTime() + (data.nights * 24 * 60 * 60 * 1000))
    : null;

  // Extract cheapest prices
  const cheapest = data.cheapest?.combined || data.cheapest?.prices || {};
  const interiorPrice = parseFloat(cheapest.inside || data.cheapestinside || 0) || null;
  const oceanviewPrice = parseFloat(cheapest.outside || data.cheapestoutside || 0) || null;
  const balconyPrice = parseFloat(cheapest.balcony || data.cheapestbalcony || 0) || null;
  const suitePrice = parseFloat(cheapest.suite || data.cheapestsuite || 0) || null;

  const cheapestPrice = Math.min(
    ...[interiorPrice, oceanviewPrice, balconyPrice, suitePrice].filter(p => p > 0)
  );

  // Convert problematic fields safely
  const marketId = safeIntegerConvert(data.marketid);  // Handles "system", "NaN", etc.
  const ownerId = safeIntegerConvert(data.ownerid);    // Handles "system", "NaN", etc.

  const result = await client.query(
    `
    INSERT INTO cruises (
      id, cruise_id, cruise_line_id, ship_id, name, voyage_code, itinerary_code,
      sailing_date, return_date, nights, sail_nights, sea_days,
      embarkation_port_id, disembarkation_port_id, port_ids, region_ids,
      ports, regions, market_id, owner_id, no_fly, depart_uk, show_cruise,
      fly_cruise_info, line_content, ship_content, last_cached, cached_date,
      interior_price, oceanview_price, balcony_price, suite_price, cheapest_price,
      interior_price_code, oceanview_price_code, balcony_price_code, suite_price_code,
      currency, is_active, created_at, updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
      $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34,
      $35, $36, $37, $38, $39, NOW(), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      interior_price = EXCLUDED.interior_price,
      oceanview_price = EXCLUDED.oceanview_price,
      balcony_price = EXCLUDED.balcony_price,
      suite_price = EXCLUDED.suite_price,
      cheapest_price = EXCLUDED.cheapest_price,
      updated_at = NOW()
    RETURNING (xmax = 0) AS inserted
  `,
    [
      cruiseId,
      data.cruiseid || cruiseId,
      data.lineid,
      data.shipid,
      data.name || `Cruise ${cruiseId}`,
      data.voyagecode || null,
      data.itinerarycode || null,
      sailingDate || null,
      returnDate || null,
      data.nights || null,
      data.sailnights || null,
      data.seadays || null,
      data.startportid || null,
      data.endportid || null,
      data.portids || null,
      data.regionids || null,
      data.ports ? JSON.stringify(data.ports) : null,
      data.regions ? JSON.stringify(data.regions) : null,
      marketId, // Now safely handles "system" and "NaN"
      ownerId,  // Now safely handles "system" and "NaN"
      data.nofly === 'Y',
      data.departuk === 'Y',
      data.showcruise !== 'N',
      data.flycruiseinfo || null,
      data.linecontent ? JSON.stringify(data.linecontent) : null,
      data.shipcontent ? JSON.stringify(data.shipcontent) : null,
      data.lastcached || null,
      data.cacheddate || null,
      interiorPrice,
      oceanviewPrice,
      balconyPrice,
      suitePrice,
      isFinite(cheapestPrice) ? cheapestPrice : null,
      cheapest.insidepricecode || data.cheapestinsidepricecode || null,
      cheapest.outsidepricecode || data.cheapestoutsidepricecode || null,
      cheapest.balconypricecode || data.cheapestbalconypricecode || null,
      cheapest.suitepricecode || data.cheapestsuitepricecode || null,
      'USD',
      true, // is_active
    ]
  );

  return result.rows[0].inserted;
}

/**
 * Process a single cruise data file
 */
async function processCruiseData(fileInfo, data) {
  const client = await dbPool.connect();

  try {
    await client.query('BEGIN');

    // Track operations
    let lineCreated = false;
    let shipCreated = false;

    // 1. Ensure cruise line exists
    const lineResult = await client.query('SELECT id FROM cruise_lines WHERE id = $1', [
      fileInfo.lineId,
    ]);

    if (lineResult.rows.length === 0) {
      lineCreated = true;
      await ensureCruiseLineExists(client, fileInfo.lineId, data);
    }

    // 2. Ensure ship exists
    const shipResult = await client.query('SELECT id FROM ships WHERE id = $1', [fileInfo.shipId]);

    if (shipResult.rows.length === 0) {
      shipCreated = true;
      await ensureShipExists(client, fileInfo.shipId, fileInfo.lineId, data);
    }

    // 3. Ensure ports exist
    if (data.ports && Object.keys(data.ports).length > 0) {
      await ensurePortsExist(client, data);
    }

    // 4. Upsert cruise record
    const cruiseCreated = await upsertCruise(client, data);

    await client.query('COMMIT');

    // Update statistics
    if (cruiseCreated) stats.cruisesCreated++;
    else stats.cruisesUpdated++;

    if (lineCreated) stats.linesCreated++;
    if (shipCreated) stats.shipsCreated++;

    return { success: true };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Process files in batches
 */
async function processFileBatch(files) {
  for (const fileInfo of files) {
    try {
      // Check if already processed
      if (checkpoint.processedFiles.includes(fileInfo.path)) {
        console.log(`   ⏭️ Skipping: ${path.basename(fileInfo.path)}`);
        stats.totalProcessed++;
        continue;
      }

      console.log(`   📥 Processing: ${path.basename(fileInfo.path)}`);
      const data = await downloadFile(fileInfo.path);
      await processCruiseData(fileInfo, data);

      stats.totalSuccess++;
      checkpoint.processedFiles.push(fileInfo.path);
      stats.totalProcessed++;

      console.log(`     ✅ Success - Cruises: ${stats.cruisesCreated}+${stats.cruisesUpdated}, Lines: ${stats.linesCreated}, Ships: ${stats.shipsCreated}`);

      // Progress update
      if (stats.totalProcessed % 10 === 0) {
        console.log(`     📊 Progress: ${stats.totalProcessed}/${stats.totalFiles} (${((stats.totalProcessed / stats.totalFiles) * 100).toFixed(1)}%)`);
      }

    } catch (error) {
      stats.totalFailed++;
      const errorMsg = `Failed to process ${fileInfo.path}: ${error.message}`;
      console.log(`     ❌ ${errorMsg}`);
      checkpoint.errors.push(errorMsg);
    }

    // Small delay to prevent overwhelming
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Save checkpoint after each batch
  await saveCheckpoint();
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Zipsea Simple Initial FTP Sync - Final Fixed');
  console.log('================================================');
  console.log('📅 Processing from 2025/09 onwards to current month');
  console.log(`📦 Batch size: ${CONFIG.BATCH_SIZE} files`);
  console.log('💾 Resume capability: ENABLED');
  console.log('🔧 Fixed: SQL parameters, "system" strings, "NaN" strings');
  console.log('');

  try {
    // Initialize
    await initDatabase();
    await loadCheckpoint();

    // Get months to process
    const months = getMonthsToProcess();
    console.log(`📅 Found ${months.length} months to process\n`);

    // Filter out already processed months
    const resumeFromMonth = checkpoint.lastProcessedMonth;
    const filteredMonths = resumeFromMonth
      ? months.filter(({ year, month }) => `${year}/${String(month).padStart(2, '0')}` > resumeFromMonth)
      : months;

    console.log(`📅 Processing ${filteredMonths.length} months\n`);

    for (const { year, month } of filteredMonths) {
      const monthStr = `${year}/${String(month).padStart(2, '0')}`;
      console.log(`📅 Processing ${monthStr}...`);

      const files = await listCruiseFiles(year, month);
      console.log(`   📊 Found ${files.length} files...`);

      if (files.length === 0) {
        console.log(`   ⚠️ No files found for ${monthStr}`);
        checkpoint.lastProcessedMonth = monthStr;
        await saveCheckpoint();
        continue;
      }

      // Update total files count
      stats.totalFiles += files.length;

      // Process files in batches
      for (let i = 0; i < files.length; i += CONFIG.BATCH_SIZE) {
        const batch = files.slice(i, i + CONFIG.BATCH_SIZE);
        console.log(`   🔄 Processing batch ${Math.floor(i / CONFIG.BATCH_SIZE) + 1}/${Math.ceil(files.length / CONFIG.BATCH_SIZE)} (${batch.length} files)...`);

        await processFileBatch(batch);

        checkpoint.lastProcessedMonth = monthStr;
        await saveCheckpoint();
      }

      console.log(`   ✅ Month ${monthStr} completed!\n`);
    }

    // Final statistics
    const elapsed = (Date.now() - stats.startTime) / 1000;
    console.log('\n🎉 Initial FTP Sync completed successfully!');
    console.log('==========================================');
    console.log(`⏱️ Total time: ${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`);
    console.log(`📊 Files processed: ${stats.totalProcessed} (${stats.totalSuccess} ✓, ${stats.totalFailed} ✗)`);
    console.log(`🚢 Cruises: ${stats.cruisesCreated} created, ${stats.cruisesUpdated} updated`);
    console.log(`🏢 Cruise lines: ${stats.linesCreated} created`);
    console.log(`⛵ Ships: ${stats.shipsCreated} created`);
    console.log('');

    // Clean up checkpoint file
    try {
      await fs.unlink(CONFIG.CHECKPOINT_FILE);
      console.log('🧹 Checkpoint file cleaned up');
    } catch (e) {
      // Ignore cleanup errors
    }

    console.log('✅ Ready to resume webhooks: node scripts/resume-webhooks.js');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    console.error('Stack:', error.stack);

    // Save checkpoint on error
    await saveCheckpoint();
    console.log('\n💾 Checkpoint saved. Run the script again to resume.');

    process.exit(1);
  } finally {
    if (dbPool) {
      await dbPool.end();
    }
  }
}

// Run the script
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✨ Simple FTP sync completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Simple FTP sync failed:', error.message);
      process.exit(1);
    });
}

module.exports = { main };
