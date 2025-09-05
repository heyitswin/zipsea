#!/usr/bin/env node

/**
 * Initial FTP Sync Script - Race Condition Fixed
 * - Removes conflicting keep-alive mechanism that causes race conditions
 * - Uses simpler connection management with proper connection reuse
 * - Processes from 2025/09 onwards to current month
 * - Smart resume capability with checkpoints
 * - Detailed progress indicators
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
  BATCH_SIZE: 50, // Reduced for stability
  MAX_FTP_CONNECTIONS: 2, // Reduced to minimize race conditions
  CHECKPOINT_FILE: './sync-checkpoint.json',
  ERROR_LOG: './sync-errors.log',
  PROGRESS_LOG: './sync-progress.log',
  MAX_RETRIES: 3,
  RETRY_DELAY: 5000, // 5 seconds
  CONNECTION_TIMEOUT: 60000, // 60 seconds
  MEMORY_DOWNLOAD_LIMIT: 10 * 1024 * 1024, // 10MB
  PROGRESS_UPDATE_INTERVAL: 10,
};

// Global state
let dbPool;
let ftpPool = [];
let checkpoint = {
  lastProcessedMonth: null,
  lastProcessedFile: null,
  processedFiles: [],
  totalFilesProcessed: 0,
  totalFilesFound: 0,
  errors: [],
  startTime: null,
  lastCheckpointTime: null,
};

// Statistics
const stats = {
  currentMonth: '',
  monthlyFiles: 0,
  monthlyProcessed: 0,
  monthlySuccess: 0,
  monthlyFailed: 0,
  totalFiles: 0,
  totalProcessed: 0,
  totalSuccess: 0,
  totalFailed: 0,
  cruisesCreated: 0,
  cruisesUpdated: 0,
  linesCreated: 0,
  shipsCreated: 0,
  portsCreated: 0,
  startTime: Date.now(),
  currentBatch: 0,
  totalBatches: 0,
  connectionResets: 0,
  averageProcessingTime: 0,
  estimatedTimeRemaining: 0,
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
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  // Test connection
  const client = await dbPool.connect();
  try {
    await client.query('SELECT 1');
    console.log('✅ Database connection established');

    // Check if system_flags table exists and webhooks are paused
    const flagCheck = await client
      .query(
        `
      SELECT flag_value
      FROM system_flags
      WHERE flag_name = 'webhooks_paused'
    `
      )
      .catch(() => null);

    if (!flagCheck || !flagCheck.rows[0]?.flag_value) {
      console.log('⚠️ WARNING: Webhooks may not be paused!');
      console.log('   Run: node scripts/pause-webhooks-clear-flags.js');
      console.log('   Continue anyway? (Ctrl+C to cancel)');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  } finally {
    client.release();
  }
}

/**
 * Create a single FTP connection without keep-alive
 */
async function createFtpConnection(index) {
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

  try {
    await client.access(ftpConfig);
    console.log(`   Connection ${index + 1} established`);
    return client;
  } catch (error) {
    console.error(`❌ Failed to create FTP connection ${index}:`, error.message);
    throw error;
  }
}

/**
 * Initialize FTP connection pool
 */
async function initFtpPool() {
  console.log(`🔄 Creating ${CONFIG.MAX_FTP_CONNECTIONS} persistent FTP connections...`);

  ftpPool = [];
  for (let i = 0; i < CONFIG.MAX_FTP_CONNECTIONS; i++) {
    const client = await createFtpConnection(i);
    ftpPool.push({
      client,
      index: i,
      busy: false,
      lastUsed: Date.now(),
    });
  }

  console.log('✅ FTP connection pool ready\n');
}

/**
 * Get an available FTP connection from pool
 */
async function getFtpConnection() {
  let attempts = 0;
  const maxAttempts = 50; // 5 seconds timeout

  while (attempts < maxAttempts) {
    // Find available connection
    const connection = ftpPool.find(c => !c.busy);

    if (connection) {
      connection.busy = true;
      connection.lastUsed = Date.now();

      // Test if connection is still alive
      try {
        await connection.client.pwd();
        return connection;
      } catch (error) {
        console.log(`🔄 Reconnecting FTP connection ${connection.index}...`);
        stats.connectionResets++;

        // Reconnect
        try {
          await connection.client.close();
        } catch (e) {
          // Ignore close errors
        }

        connection.client = await createFtpConnection(connection.index);
        return connection;
      }
    }

    // Wait and retry
    attempts++;
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  throw new Error('No FTP connection available after timeout');
}

/**
 * Return FTP connection to pool
 */
function releaseFtpConnection(connection) {
  if (connection) {
    connection.busy = false;
    connection.lastUsed = Date.now();
  }
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
    console.log(`   Last processed: ${checkpoint.lastProcessedMonth || 'None'}`);
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
  checkpoint.lastCheckpointTime = Date.now();
  checkpoint.totalFilesProcessed = stats.totalProcessed;
  await fs.writeFile(CONFIG.CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
}

/**
 * List all cruise JSON files in a month directory
 */
async function listCruiseFiles(year, month) {
  const connection = await getFtpConnection();

  try {
    const monthPath = `/${year}/${String(month).padStart(2, '0')}`;
    console.log(`   📂 Scanning ${monthPath}...`);

    let lineDirectories = [];
    try {
      lineDirectories = await connection.client.list(monthPath);
    } catch (error) {
      if (error.code === 550) {
        console.log(`   ⚠️ Directory ${monthPath} not found (may not exist yet)`);
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
        const shipDirectories = await connection.client.list(linePath);

        for (const shipDir of shipDirectories) {
          if (!shipDir.isDirectory) continue;

          const shipId = parseInt(shipDir.name);
          if (isNaN(shipId)) continue;

          const shipPath = `${linePath}/${shipDir.name}`;

          try {
            const cruiseFiles = await connection.client.list(shipPath);

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
    releaseFtpConnection(connection);
  }
}

/**
 * Download a single file to memory
 */
async function downloadFile(filePath, fileSize) {
  const connection = await getFtpConnection();

  try {
    if (fileSize > CONFIG.MEMORY_DOWNLOAD_LIMIT) {
      throw new Error(`File too large for memory download: ${fileSize} bytes`);
    }

    const stream = await connection.client.downloadToDir('./temp', path.basename(filePath));
    const tempFilePath = `./temp/${path.basename(filePath)}`;

    const data = await fs.readFile(tempFilePath, 'utf8');

    // Clean up temp file
    try {
      await fs.unlink(tempFilePath);
    } catch (e) {
      // Ignore cleanup errors
    }

    return JSON.parse(data);
  } finally {
    releaseFtpConnection(connection);
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
      code = EXCLUDED.code,
      description = EXCLUDED.description,
      engine_name = EXCLUDED.engine_name,
      short_name = EXCLUDED.short_name,
      title = EXCLUDED.title,
      nice_url = EXCLUDED.nice_url,
      logo = EXCLUDED.logo,
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
      cruise_line_id = EXCLUDED.cruise_line_id,
      name = EXCLUDED.name,
      nice_name = EXCLUDED.nice_name,
      short_name = EXCLUDED.short_name,
      code = EXCLUDED.code,
      tonnage = EXCLUDED.tonnage,
      total_cabins = EXCLUDED.total_cabins,
      max_passengers = EXCLUDED.max_passengers,
      crew = EXCLUDED.crew,
      length = EXCLUDED.length,
      beam = EXCLUDED.beam,
      draft = EXCLUDED.draft,
      speed = EXCLUDED.speed,
      registry = EXCLUDED.registry,
      built_year = EXCLUDED.built_year,
      refurbished_year = EXCLUDED.refurbished_year,
      description = EXCLUDED.description,
      star_rating = EXCLUDED.star_rating,
      adults_only = EXCLUDED.adults_only,
      ship_class = EXCLUDED.ship_class,
      default_ship_image = EXCLUDED.default_ship_image,
      default_ship_image_hd = EXCLUDED.default_ship_image_hd,
      default_ship_image_2k = EXCLUDED.default_ship_image_2k,
      nice_url = EXCLUDED.nice_url,
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
      console.log(`     ⚠️ Error creating port ${portId}: ${error.message}`);
    }
  }

  return portsCreated;
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
      cruise_id = EXCLUDED.cruise_id,
      cruise_line_id = EXCLUDED.cruise_line_id,
      ship_id = EXCLUDED.ship_id,
      name = EXCLUDED.name,
      voyage_code = EXCLUDED.voyage_code,
      itinerary_code = EXCLUDED.itinerary_code,
      sailing_date = EXCLUDED.sailing_date,
      return_date = EXCLUDED.return_date,
      nights = EXCLUDED.nights,
      sail_nights = EXCLUDED.sail_nights,
      sea_days = EXCLUDED.sea_days,
      embarkation_port_id = EXCLUDED.embarkation_port_id,
      disembarkation_port_id = EXCLUDED.disembarkation_port_id,
      port_ids = EXCLUDED.port_ids,
      region_ids = EXCLUDED.region_ids,
      ports = EXCLUDED.ports,
      regions = EXCLUDED.regions,
      market_id = EXCLUDED.market_id,
      owner_id = EXCLUDED.owner_id,
      no_fly = EXCLUDED.no_fly,
      depart_uk = EXCLUDED.depart_uk,
      show_cruise = EXCLUDED.show_cruise,
      fly_cruise_info = EXCLUDED.fly_cruise_info,
      line_content = EXCLUDED.line_content,
      ship_content = EXCLUDED.ship_content,
      last_cached = EXCLUDED.last_cached,
      cached_date = EXCLUDED.cached_date,
      interior_price = EXCLUDED.interior_price,
      oceanview_price = EXCLUDED.oceanview_price,
      balcony_price = EXCLUDED.balcony_price,
      suite_price = EXCLUDED.suite_price,
      cheapest_price = EXCLUDED.cheapest_price,
      interior_price_code = EXCLUDED.interior_price_code,
      oceanview_price_code = EXCLUDED.oceanview_price_code,
      balcony_price_code = EXCLUDED.balcony_price_code,
      suite_price_code = EXCLUDED.suite_price_code,
      currency = EXCLUDED.currency,
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
      data.marketid || null,
      data.ownerid || null,
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
    ]
  );

  return result.rows[0].inserted;
}

/**
 * Process a single cruise data file
 */
async function processCruiseData(fileInfo, data) {
  const client = await dbPool.connect();
  const startTime = Date.now();

  try {
    await client.query('BEGIN');

    // Track operations
    let lineCreated = false;
    let shipCreated = false;
    let portsCreated = 0;

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
      portsCreated = await ensurePortsExist(client, data);
    }

    // 4. Upsert cruise record
    const cruiseCreated = await upsertCruise(client, data);

    await client.query('COMMIT');

    // Update statistics
    if (cruiseCreated) stats.cruisesCreated++;
    else stats.cruisesUpdated++;

    if (lineCreated) stats.linesCreated++;
    if (shipCreated) stats.shipsCreated++;
    stats.portsCreated += portsCreated;

    // Calculate average processing time
    const processingTime = Date.now() - startTime;
    stats.averageProcessingTime =
      (stats.averageProcessingTime * (stats.totalSuccess - 1) + processingTime) /
      stats.totalSuccess;

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
  const batchStartTime = Date.now();

  for (const fileInfo of files) {
    try {
      // Check if already processed
      if (checkpoint.processedFiles.includes(fileInfo.path)) {
        console.log(`   ⏭️ Skipping already processed: ${path.basename(fileInfo.path)}`);
        stats.totalProcessed++;
        continue;
      }

      const data = await downloadFile(fileInfo.path, fileInfo.size);
      await processCruiseData(fileInfo, data);

      stats.totalSuccess++;
      stats.monthlySuccess++;

      // Mark as processed
      checkpoint.processedFiles.push(fileInfo.path);
      stats.totalProcessed++;

      // Progress update
      if (stats.totalProcessed % CONFIG.PROGRESS_UPDATE_INTERVAL === 0) {
        const elapsed = (Date.now() - stats.startTime) / 1000;
        const rate = stats.totalProcessed / elapsed;
        const remaining = stats.totalFiles - stats.totalProcessed;
        const eta = remaining / rate;

        console.log(
          `     📊 Progress: ${stats.totalProcessed}/${stats.totalFiles} (${(
            (stats.totalProcessed / stats.totalFiles) *
            100
          ).toFixed(1)}%) | Rate: ${rate.toFixed(1)}/s | ETA: ${Math.round(eta / 60)}min`
        );
      }
    } catch (error) {
      stats.totalFailed++;
      stats.monthlyFailed++;

      const errorMsg = `Failed to process ${fileInfo.path}: ${error.message}`;
      console.log(`     ❌ ${errorMsg}`);
      checkpoint.errors.push(errorMsg);

      // Continue processing other files
    }
  }

  // Save checkpoint after each batch
  await saveCheckpoint();

  const batchTime = (Date.now() - batchStartTime) / 1000;
  console.log(`   ⏱️ Batch completed in ${batchTime.toFixed(1)}s`);
}

/**
 * Update progress display
 */
function updateProgress() {
  const elapsed = (Date.now() - stats.startTime) / 1000;
  const rate = stats.totalProcessed / elapsed;
  const remaining = stats.totalFiles - stats.totalProcessed;
  const eta = remaining > 0 ? remaining / rate : 0;

  console.log(`
📊 Overall Progress: ${'█'.repeat(Math.floor((stats.totalProcessed / stats.totalFiles) * 40))}${'░'.repeat(40 - Math.floor((stats.totalProcessed / stats.totalFiles) * 40))} ${((stats.totalProcessed / stats.totalFiles) * 100).toFixed(1)}%
📁 Files: ${stats.totalProcessed}/${stats.totalFiles} (${stats.totalSuccess} ✓, ${stats.totalFailed} ✗)
⏱️ Elapsed: ${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s | ETA: ${Math.floor(eta / 60)}m ${Math.floor(eta % 60)}s | Rate: ${rate.toFixed(1)} files/sec

📆 Current Month: ${'█'.repeat(Math.floor((stats.monthlyProcessed / stats.monthlyFiles) * 30))}${'░'.repeat(30 - Math.floor((stats.monthlyProcessed / stats.monthlyFiles) * 30))} ${stats.monthlyFiles > 0 ? ((stats.monthlyProcessed / stats.monthlyFiles) * 100).toFixed(1) : 0}%
   Files: ${stats.monthlyProcessed}/${stats.monthlyFiles} (${stats.monthlySuccess} ✓, ${stats.monthlyFailed} ✗)

💾 Database Operations:
   🚢 Cruises: ${stats.cruisesCreated} created, ${stats.cruisesUpdated} updated
   🏢 Lines: ${stats.linesCreated} | Ships: ${stats.shipsCreated} | Ports: ${stats.portsCreated}

🔌 Connections: ${ftpPool.filter(c => !c.busy).length}/${ftpPool.length} available | Resets: ${stats.connectionResets}
`);
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Zipsea Initial FTP Sync - Race Condition Fixed');
  console.log('==================================================');
  console.log('📅 Processing from 2025/09 onwards to current month');
  console.log(`📦 Batch size: ${CONFIG.BATCH_SIZE} files`);
  console.log(`🔌 Persistent connections: ${CONFIG.MAX_FTP_CONNECTIONS}`);
  console.log('💾 Resume capability: ENABLED');
  console.log('');

  try {
    // Initialize
    await initDatabase();
    await loadCheckpoint();
    await initFtpPool();

    // Get months to process
    const months = getMonthsToProcess();
    console.log(`📅 Found ${months.length} months to process\n`);

    // Filter out already processed months
    const resumeFromMonth = checkpoint.lastProcessedMonth;
    const filteredMonths = resumeFromMonth
      ? months.filter(({ year, month }) => `${year}/${String(month).padStart(2, '0')}` > resumeFromMonth)
      : months;

    console.log(`📅 Processing ${filteredMonths.length} months starting from ${filteredMonths[0]?.year}/${String(filt
