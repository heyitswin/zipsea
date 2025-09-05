#!/usr/bin/env node

/**
 * FINAL Fixed Initial FTP Sync Script
 * - Fixed download method to use proper streams
 * - Processes from 2025/09 to 2028/12
 * - Smart resume capability with checkpoints
 * - Detailed progress indicators
 * Date: 2025-09-05
 */

const ftp = require('basic-ftp');
const { Pool } = require('pg');
const fs = require('fs').promises;
const { createWriteStream } = require('fs');
const path = require('path');
const os = require('os');
require('dotenv').config({ path: '.env.local' });

// Configuration
const CONFIG = {
  START_YEAR: 2025,
  START_MONTH: 9,
  END_YEAR: 2028, // Process up to end of 2028
  END_MONTH: 12,
  BATCH_SIZE: 100, // Process 100 files per batch
  MAX_FTP_CONNECTIONS: 3, // Reduced to avoid overwhelming server
  CHECKPOINT_FILE: './sync-checkpoint.json',
  ERROR_LOG: './sync-errors.log',
  PROGRESS_LOG: './sync-progress.log',
  MAX_RETRIES: 3,
  RETRY_DELAY: 5000, // 5 seconds
  CONNECTION_TIMEOUT: 60000, // 60 seconds
  KEEP_ALIVE_INTERVAL: 30000, // Send NOOP every 30 seconds
  PROGRESS_UPDATE_INTERVAL: 10, // Update progress every 10 files
};

// Global state
let dbPool;
let ftpPool = [];
let keepAliveIntervals = [];
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
    max: 20, // Increased pool size for parallel processing
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
 * Create a single FTP connection with keep-alive
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

    // Set up keep-alive by sending NOOP commands
    // Check if connection is busy before sending NOOP
    const keepAlive = setInterval(async () => {
      // Only send NOOP if connection is not busy
      const connection = ftpPool.find(c => c.client === client);
      if (connection && !connection.busy) {
        try {
          await client.send('NOOP');
        } catch (e) {
          // Connection lost, will reconnect when needed
        }
      }
    }, CONFIG.KEEP_ALIVE_INTERVAL);

    keepAliveIntervals[index] = keepAlive;

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
    console.log(`   Connection ${i + 1}/${CONFIG.MAX_FTP_CONNECTIONS} established`);
  }

  console.log('✅ FTP connection pool ready\n');
}

/**
 * Get an available FTP connection from pool
 */
async function getFtpConnection() {
  // Find available connection
  let connection = ftpPool.find(c => !c.busy);

  if (!connection) {
    // Wait for a connection to become available
    await new Promise(resolve => setTimeout(resolve, 100));
    return getFtpConnection();
  }

  connection.busy = true;
  connection.lastUsed = Date.now();

  // Check if connection is still alive
  try {
    await connection.client.pwd();
  } catch (error) {
    console.log(`🔄 Reconnecting FTP connection ${connection.index}...`);
    stats.connectionResets++;

    // Clear old keep-alive
    if (keepAliveIntervals[connection.index]) {
      clearInterval(keepAliveIntervals[connection.index]);
    }

    // Reconnect
    try {
      await connection.client.close();
    } catch (e) {
      // Ignore close errors
    }

    connection.client = await createFtpConnection(connection.index);
  }

  return connection;
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

  let year = CONFIG.START_YEAR;
  let month = CONFIG.START_MONTH;

  // Process from 2025/09 up to 2028/12
  while (year < CONFIG.END_YEAR || (year === CONFIG.END_YEAR && month <= CONFIG.END_MONTH)) {
    months.push({ year, month });

    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  console.log(
    `📅 Will process months from ${CONFIG.START_YEAR}/${String(CONFIG.START_MONTH).padStart(2, '0')} to ${CONFIG.END_YEAR}/${String(CONFIG.END_MONTH).padStart(2, '0')}`
  );
  return months;
}

/**
 * Load checkpoint if exists
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
 * List all cruise files for a specific month
 */
async function listCruiseFiles(year, month) {
  const connection = await getFtpConnection();
  const files = [];

  try {
    const monthPath = `/${year}/${String(month).padStart(2, '0')}`;

    // Check if year directory exists
    const yearExists = await connection.client
      .list('/')
      .then(list => list.some(item => item.name === String(year)))
      .catch(() => false);

    if (!yearExists) {
      console.log(`   📁 Year ${year} not found on FTP server`);
      return files;
    }

    // Check if month directory exists
    const monthExists = await connection.client
      .list(`/${year}`)
      .then(list => list.some(item => item.name === String(month).padStart(2, '0')))
      .catch(() => false);

    if (!monthExists) {
      console.log(`   📁 Month ${monthPath} not found on FTP server`);
      return files;
    }

    // List all line directories
    const lineDirectories = await connection.client.list(monthPath);
    const lineDirs = lineDirectories.filter(d => d.type === 2);

    let fileCount = 0;
    for (const lineDir of lineDirs) {
      const linePath = `${monthPath}/${lineDir.name}`;

      // List all ship directories
      const shipDirectories = await connection.client.list(linePath);
      const shipDirs = shipDirectories.filter(d => d.type === 2);

      for (const shipDir of shipDirs) {
        const shipPath = `${linePath}/${shipDir.name}`;

        // List all cruise JSON files
        const cruiseFiles = await connection.client.list(shipPath);

        for (const file of cruiseFiles) {
          if (file.type === 1 && file.name.endsWith('.json')) {
            const filePath = `${shipPath}/${file.name}`;

            // Skip if already processed
            if (checkpoint.processedFiles.includes(filePath)) {
              continue;
            }

            files.push({
              path: filePath,
              lineId: parseInt(lineDir.name),
              shipId: parseInt(shipDir.name),
              cruiseId: path.basename(file.name, '.json'),
              size: file.size,
              date: file.date,
            });

            fileCount++;

            // Show progress while scanning
            if (fileCount % 100 === 0) {
              process.stdout.write(`\r   📊 Found ${fileCount} files...`);
            }
          }
        }
      }
    }

    if (fileCount > 0) {
      process.stdout.write(
        `\r   📊 Found ${files.length} new files to process (${fileCount} total)\n`
      );
    }

    return files;
  } catch (error) {
    console.error(
      `   ❌ Error listing files for ${year}/${String(month).padStart(2, '0')}:`,
      error.message
    );
    return files;
  } finally {
    releaseFtpConnection(connection);
  }
}

/**
 * Download file using temporary file (FIXED VERSION)
 */
async function downloadFile(filePath, retries = 0) {
  const connection = await getFtpConnection();

  try {
    // Always use temp file for reliability
    const tempFile = path.join(os.tmpdir(), `cruise-${Date.now()}-${Math.random()}.json`);

    // Download to temp file
    await connection.client.downloadTo(tempFile, filePath);

    // Read and parse the file
    const content = await fs.readFile(tempFile, 'utf8');
    const data = JSON.parse(content);

    // Clean up temp file
    await fs.unlink(tempFile).catch(() => {});

    return data;
  } catch (error) {
    if (retries < CONFIG.MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
      return downloadFile(filePath, retries + 1);
    }
    throw error;
  } finally {
    releaseFtpConnection(connection);
  }
}

/**
 * Display progress bar
 */
function displayProgress() {
  const percent = Math.round((stats.totalProcessed / stats.totalFiles) * 100) || 0;
  const barLength = 40;
  const filledLength = Math.round((barLength * percent) / 100);
  const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

  const elapsed = (Date.now() - stats.startTime) / 1000;
  const rate = stats.totalProcessed / elapsed || 0;
  const remaining = stats.totalFiles - stats.totalProcessed;
  const eta = remaining / rate || 0;

  // Format time
  const formatTime = seconds => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  console.clear();
  console.log('🚀 Zipsea Initial FTP Sync - FINAL VERSION');
  console.log('==========================================\n');

  // Overall progress
  console.log(`📅 Processing: ${stats.currentMonth}`);
  console.log(`📊 Overall Progress: ${bar} ${percent}%`);
  console.log(
    `📁 Files: ${stats.totalProcessed}/${stats.totalFiles} (${stats.totalSuccess} ✓, ${stats.totalFailed} ✗)`
  );
  console.log(
    `⏱️ Elapsed: ${formatTime(elapsed)} | ETA: ${formatTime(eta)} | Rate: ${rate.toFixed(1)} files/sec`
  );
  console.log('');

  // Monthly progress
  if (stats.monthlyFiles > 0) {
    const monthPercent = Math.round((stats.monthlyProcessed / stats.monthlyFiles) * 100) || 0;
    const monthBar =
      '█'.repeat(Math.round((barLength * monthPercent) / 100)) +
      '░'.repeat(barLength - Math.round((barLength * monthPercent) / 100));
    console.log(`📆 Current Month: ${monthBar} ${monthPercent}%`);
    console.log(
      `   Files: ${stats.monthlyProcessed}/${stats.monthlyFiles} (${stats.monthlySuccess} ✓, ${stats.monthlyFailed} ✗)`
    );
  }
  console.log('');

  // Database stats
  console.log('💾 Database Operations:');
  console.log(`   🚢 Cruises: ${stats.cruisesCreated} created, ${stats.cruisesUpdated} updated`);
  console.log(
    `   🏢 Lines: ${stats.linesCreated} | Ships: ${stats.shipsCreated} | Ports: ${stats.portsCreated}`
  );

  // Connection stats
  console.log('');
  console.log(
    `🔌 Connections: ${CONFIG.MAX_FTP_CONNECTIONS} active | Resets: ${stats.connectionResets}`
  );

  // Current batch
  if (stats.totalBatches > 0) {
    console.log(`📦 Batch: ${stats.currentBatch}/${stats.totalBatches}`);
  }

  // Errors
  if (checkpoint.errors.length > 0) {
    console.log('');
    console.log(`⚠️ Errors: ${checkpoint.errors.length} (see ${CONFIG.ERROR_LOG} for details)`);
  }
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
    if (data.ports && Array.isArray(data.ports)) {
      portsCreated = await ensurePortsExist(client, data);
    }

    // 4. Ensure regions exist
    if (data.regions && Array.isArray(data.regions)) {
      await ensureRegionsExist(client, data);
    }

    // 5. Upsert cruise record
    const cruiseCreated = await upsertCruise(client, data);

    // 6. Sync itinerary
    if (data.itinerary && Array.isArray(data.itinerary)) {
      await syncItinerary(client, data.codetocruiseid, data.itinerary);
    }

    // 7. Sync alternative sailings
    if (data.altsailings && Array.isArray(data.altsailings)) {
      await syncAlternativeSailings(client, data.codetocruiseid, data.altsailings);
    }

    // 8. Sync pricing data (simplified for initial sync)
    if (data.prices || data.cachedprices) {
      await syncPricing(client, data.codetocruiseid, data);
    }

    // 9. Sync cheapest pricing
    if (data.cheapest || data.cheapestinside || data.cheapestoutside) {
      await syncCheapestPricing(client, data.codetocruiseid, data);
    }

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

// Helper functions
async function ensureCruiseLineExists(client, lineId, data) {
  let lineInfo = {
    name: `Cruise Line ${lineId}`,
    code: `CL${lineId}`,
    description: '',
    engine_name: null,
    short_name: null,
    title: null,
  };

  if (data.linecontent && typeof data.linecontent === 'object') {
    const lc = data.linecontent;
    lineInfo.name = lc.name || lc.shortname || lc.title || lineInfo.name;
    lineInfo.code = lc.code || lineInfo.code;
    lineInfo.description = lc.description || '';
    lineInfo.engine_name = lc.enginename || null;
    lineInfo.short_name = lc.shortname || null;
    lineInfo.title = lc.title || null;
  } else if (typeof data.linecontent === 'string') {
    lineInfo.description = data.linecontent;
  }

  await client.query(
    `INSERT INTO cruise_lines (id, name, code, description, engine_name, short_name, title)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       code = EXCLUDED.code,
       updated_at = NOW()`,
    [
      lineId,
      lineInfo.name,
      lineInfo.code,
      lineInfo.description,
      lineInfo.engine_name,
      lineInfo.short_name,
      lineInfo.title,
    ]
  );
}

async function ensureShipExists(client, shipId, lineId, data) {
  let shipInfo = {
    name: `Ship ${shipId}`,
    code: `SH${shipId}`,
    nice_name: null,
    short_name: null,
    tonnage: null,
    total_cabins: null,
    max_passengers: null,
    crew: null,
    length: null,
    beam: null,
    draft: null,
    speed: null,
    registry: null,
    built_year: null,
    refurbished_year: null,
    description: null,
  };

  if (data.shipcontent && typeof data.shipcontent === 'object') {
    const sc = data.shipcontent;
    shipInfo.name = sc.name || sc.nicename || sc.shortname || shipInfo.name;
    shipInfo.code = sc.code || shipInfo.code;
    shipInfo.nice_name = sc.nicename || null;
    shipInfo.short_name = sc.shortname || null;
    shipInfo.tonnage = sc.tonnage || null;
    shipInfo.total_cabins = sc.totalcabins || null;
    shipInfo.max_passengers = sc.maxpassengers || null;
    shipInfo.crew = sc.crew || null;
    shipInfo.length = sc.length || null;
    shipInfo.beam = sc.beam || null;
    shipInfo.draft = sc.draft || null;
    shipInfo.speed = sc.speed || null;
    shipInfo.registry = sc.registry || null;
    shipInfo.built_year = sc.builtyear || null;
    shipInfo.refurbished_year = sc.refurbishedyear || null;
    shipInfo.description = sc.description || null;
  }

  await client.query(
    `INSERT INTO ships (id, cruise_line_id, name, nice_name, short_name, code,
                       tonnage, total_cabins, max_passengers, crew, length, beam,
                       draft, speed, registry, built_year, refurbished_year, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       code = EXCLUDED.code,
       updated_at = NOW()`,
    [
      shipId,
      lineId,
      shipInfo.name,
      shipInfo.nice_name,
      shipInfo.short_name,
      shipInfo.code,
      shipInfo.tonnage,
      shipInfo.total_cabins,
      shipInfo.max_passengers,
      shipInfo.crew,
      shipInfo.length,
      shipInfo.beam,
      shipInfo.draft,
      shipInfo.speed,
      shipInfo.registry,
      shipInfo.built_year,
      shipInfo.refurbished_year,
      shipInfo.description,
    ]
  );
}

async function ensurePortsExist(client, data) {
  let portsCreated = 0;

  if (data.portids && data.ports) {
    for (let i = 0; i < data.portids.length; i++) {
      const portId = data.portids[i];
      const portName = data.ports[i] || `Port ${portId}`;

      const result = await client.query(
        `INSERT INTO ports (id, name, code)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING
         RETURNING id`,
        [portId, portName, `P${portId}`]
      );

      if (result.rows.length > 0) portsCreated++;
    }
  }

  // Also ensure embark/disembark ports
  if (data.startportid) {
    const result = await client.query(
      `INSERT INTO ports (id, name, code)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [data.startportid, `Port ${data.startportid}`, `P${data.startportid}`]
    );
    if (result.rows.length > 0) portsCreated++;
  }

  if (data.endportid) {
    const result = await client.query(
      `INSERT INTO ports (id, name, code)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [data.endportid, `Port ${data.endportid}`, `P${data.endportid}`]
    );
    if (result.rows.length > 0) portsCreated++;
  }

  return portsCreated;
}

async function ensureRegionsExist(client, data) {
  if (data.regionids && data.regions) {
    for (let i = 0; i < data.regionids.length; i++) {
      const regionId = data.regionids[i];
      const regionName = data.regions[i] || `Region ${regionId}`;

      await client.query(
        `INSERT INTO regions (id, name, code)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [regionId, regionName, `R${regionId}`]
      );
    }
  }
}

async function upsertCruise(client, data) {
  const existing = await client.query('SELECT id FROM cruises WHERE id = $1', [
    String(data.codetocruiseid),
  ]);

  let cheapestPrice = null;
  const prices = [];

  if (data.cheapest) {
    if (data.cheapest.inside) prices.push(data.cheapest.inside);
    if (data.cheapest.outside) prices.push(data.cheapest.outside);
    if (data.cheapest.balcony) prices.push(data.cheapest.balcony);
    if (data.cheapest.suite) prices.push(data.cheapest.suite);
  }

  if (data.cheapestinside) prices.push(data.cheapestinside);
  if (data.cheapestoutside) prices.push(data.cheapestoutside);
  if (data.cheapestbalcony) prices.push(data.cheapestbalcony);
  if (data.cheapestsuite) prices.push(data.cheapestsuite);

  if (prices.length > 0) {
    cheapestPrice = Math.min(...prices.filter(p => p && !isNaN(p)));
  }

  const cruiseData = {
    id: String(data.codetocruiseid),
    cruise_id: String(data.cruiseid || data.codetocruiseid),
    cruise_line_id: data.lineid,
    ship_id: data.shipid,
    name: data.name || `Cruise ${data.codetocruiseid}`,
    voyage_code: data.voyagecode || null,
    itinerary_code: data.itinerarycode || null,
    sailing_date: data.saildate || data.startdate,
    nights: data.nights || 0,
    sail_nights: data.sailnights || null,
    sea_days: data.seadays || null,
    embarkation_port_id: data.startportid || null,
    disembarkation_port_id: data.endportid || null,
    port_ids: data.portids || null,
    region_ids: data.regionids || null,
    ports: data.ports ? JSON.stringify(data.ports) : null,
    regions: data.regions ? JSON.stringify(data.regions) : null,
    market_id: data.marketid || null,
    owner_id: data.ownerid || null,
    no_fly: data.nofly === 'Y' || data.nofly === true,
    depart_uk: data.departuk === true,
    show_cruise: data.showcruise !== false,
    fly_cruise_info: data.flycruiseinfo || null,
    line_content:
      typeof data.linecontent === 'object' ? JSON.stringify(data.linecontent) : data.linecontent,
    ship_content:
      typeof data.shipcontent === 'object' ? JSON.stringify(data.shipcontent) : data.shipcontent,
    last_cached: data.lastcached || null,
    cached_date: data.cacheddate || null,
    interior_price: data.cheapest?.inside || data.cheapestinside || null,
    oceanview_price: data.cheapest?.outside || data.cheapestoutside || null,
    balcony_price: data.cheapest?.balcony || data.cheapestbalcony || null,
    suite_price: data.cheapest?.suite || data.cheapestsuite || null,
    cheapest_price: cheapestPrice,
    interior_price_code: data.cheapestinsidepricecode || data.cheapest?.insidepricecode || null,
    oceanview_price_code: data.cheapestoutsidepricecode || data.cheapest?.outsidepricecode || null,
    balcony_price_code: data.cheapestbalconypricecode || data.cheapest?.balconypricecode || null,
    suite_price_code: data.cheapestsuitepricecode || data.cheapest?.suitepricecode || null,
  };

  // Calculate return date
  if (cruiseData.sailing_date && cruiseData.nights) {
    const sailDate = new Date(cruiseData.sailing_date);
    sailDate.setDate(sailDate.getDate() + cruiseData.nights);
    cruiseData.return_date = sailDate.toISOString().split('T')[0];
  }

  if (existing.rows.length === 0) {
    // Insert new cruise
    await client.query(
      `INSERT INTO cruises (
        id, cruise_id, cruise_line_id, ship_id, name, voyage_code, itinerary_code,
        sailing_date, return_date, nights, sail_nights, sea_days,
        embarkation_port_id, disembarkation_port_id, port_ids, region_ids,
        ports, regions, market_id, owner_id, no_fly, depart_uk, show_cruise,
        fly_cruise_info, line_content, ship_content, last_cached, cached_date,
        interior_price, oceanview_price, balcony_price, suite_price, cheapest_price,
        interior_price_code, oceanview_price_code, balcony_price_code, suite_price_code
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
        $31, $32, $33, $34, $35, $36, $37
      )`,
      [
        cruiseData.id,
        cruiseData.cruise_id,
        cruiseData.cruise_line_id,
        cruiseData.ship_id,
        cruiseData.name,
        cruiseData.voyage_code,
        cruiseData.itinerary_code,
        cruiseData.sailing_date,
        cruiseData.return_date,
        cruiseData.nights,
        cruiseData.sail_nights,
        cruiseData.sea_days,
        cruiseData.embarkation_port_id,
        cruiseData.disembarkation_port_id,
        cruiseData.port_ids,
        cruiseData.region_ids,
        cruiseData.ports,
        cruiseData.regions,
        cruiseData.market_id,
        cruiseData.owner_id,
        cruiseData.no_fly,
        cruiseData.depart_uk,
        cruiseData.show_cruise,
        cruiseData.fly_cruise_info,
        cruiseData.line_content,
        cruiseData.ship_content,
        cruiseData.last_cached,
        cruiseData.cached_date,
        cruiseData.interior_price,
        cruiseData.oceanview_price,
        cruiseData.balcony_price,
        cruiseData.suite_price,
        cruiseData.cheapest_price,
        cruiseData.interior_price_code,
        cruiseData.oceanview_price_code,
        cruiseData.balcony_price_code,
        cruiseData.suite_price_code,
      ]
    );
    return true;
  } else {
    // Update existing cruise
    await client.query(
      `UPDATE cruises SET
        cruise_line_id = $2, ship_id = $3, name = $4, voyage_code = $5, itinerary_code = $6,
        sailing_date = $7, return_date = $8, nights = $9, sail_nights = $10, sea_days = $11,
        embarkation_port_id = $12, disembarkation_port_id = $13, port_ids = $14, region_ids = $15,
        ports = $16, regions = $17, market_id = $18, owner_id = $19, no_fly = $20,
        depart_uk = $21, show_cruise = $22, fly_cruise_info = $23, line_content = $24,
        ship_content = $25, last_cached = $26, cached_date = $27, interior_price = $28,
        oceanview_price = $29, balcony_price = $30, suite_price = $31, cheapest_price = $32,
        interior_price_code = $33, oceanview_price_code = $34, balcony_price_code = $35,
        suite_price_code = $36, updated_at = NOW()
       WHERE id = $1`,
      [
        cruiseData.id,
        cruiseData.cruise_line_id,
        cruiseData.ship_id,
        cruiseData.name,
        cruiseData.voyage_code,
        cruiseData.itinerary_code,
        cruiseData.sailing_date,
        cruiseData.return_date,
        cruiseData.nights,
        cruiseData.sail_nights,
        cruiseData.sea_days,
        cruiseData.embarkation_port_id,
        cruiseData.disembarkation_port_id,
        cruiseData.port_ids,
        cruiseData.region_ids,
        cruiseData.ports,
        cruiseData.regions,
        cruiseData.market_id,
        cruiseData.owner_id,
        cruiseData.no_fly,
        cruiseData.depart_uk,
        cruiseData.show_cruise,
        cruiseData.fly_cruise_info,
        cruiseData.line_content,
        cruiseData.ship_content,
        cruiseData.last_cached,
        cruiseData.cached_date,
        cruiseData.interior_price,
        cruiseData.oceanview_price,
        cruiseData.balcony_price,
        cruiseData.suite_price,
        cruiseData.cheapest_price,
        cruiseData.interior_price_code,
        cruiseData.oceanview_price_code,
        cruiseData.balcony_price_code,
        cruiseData.suite_price_code,
      ]
    );
    return false;
  }
}

async function syncItinerary(client, cruiseId, itinerary) {
  // Delete existing itinerary
  await client.query('DELETE FROM itineraries WHERE cruise_id = $1', [String(cruiseId)]);

  // Insert new itinerary
  for (const day of itinerary) {
    await client.query(
      `INSERT INTO itineraries (
        cruise_id, day_number, date, port_id, port_name,
        arrival_time, departure_time, description, is_sea_day
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        String(cruiseId),
        day.day || 0,
        day.date || null,
        day.portid || null,
        day.port || null,
        day.arrive || null,
        day.depart || null,
        day.description || null,
        day.seaday === true,
      ]
    );
  }
}

async function syncAlternativeSailings(client, cruiseId, altSailings) {
  // Delete existing alternative sailings
  await client.query('DELETE FROM alternative_sailings WHERE base_cruise_id = $1', [
    String(cruiseId),
  ]);

  // Insert new alternative sailings
  for (const alt of altSailings) {
    await client.query(
      `INSERT INTO alternative_sailings (
        base_cruise_id, alternative_date, alternative_cruise_id, price
      ) VALUES ($1, $2, $3, $4)`,
      [String(cruiseId), alt.date || null, alt.cruiseid || null, alt.price || null]
    );
  }
}

async function syncPricing(client, cruiseId, data) {
  // Simplified for initial sync - just capture sample prices
  if (data.prices && typeof data.prices === 'object') {
    await processPriceObject(client, cruiseId, data.prices, 'static');
  }

  if (data.cachedprices && typeof data.cachedprices === 'object') {
    await processPriceObject(client, cruiseId, data.cachedprices, 'cached');
  }
}

async function processPriceObject(client, cruiseId, prices, source) {
  // Sample first few prices for initial sync
  let count = 0;
  const MAX_PRICES = 5;

  for (const [rateCode, cabins] of Object.entries(prices)) {
    if (count >= MAX_PRICES) break;

    if (typeof cabins === 'object') {
      for (const [cabinCode, occupancies] of Object.entries(cabins)) {
        if (count >= MAX_PRICES) break;

        if (typeof occupancies === 'object') {
          for (const [occupancyCode, priceData] of Object.entries(occupancies)) {
            if (count >= MAX_PRICES) break;

            if (priceData && typeof priceData === 'object') {
              await client.query(
                `INSERT INTO pricing (
                  cruise_id, rate_code, cabin_code, occupancy_code,
                  price, base_price, tax, taxes, ncf, gratuities, gratuity,
                  total, total_price, commission, net_price,
                  price_source, currency
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                ON CONFLICT DO NOTHING`,
                [
                  String(cruiseId),
                  rateCode,
                  cabinCode,
                  occupancyCode,
                  priceData.price || null,
                  priceData.baseprice || priceData.price || null,
                  priceData.tax || null,
                  priceData.taxes || null,
                  priceData.ncf || null,
                  priceData.gratuities || null,
                  priceData.gratuity || null,
                  priceData.total || null,
                  priceData.totalprice || null,
                  priceData.commission || null,
                  priceData.netprice || null,
                  source,
                  priceData.currency || 'USD',
                ]
              );
              count++;
            }
          }
        }
      }
    }
  }
}

async function syncCheapestPricing(client, cruiseId, data) {
  // Delete existing cheapest pricing
  await client.query('DELETE FROM cheapest_pricing WHERE cruise_id = $1', [String(cruiseId)]);

  // Prepare cheapest pricing data
  const cheapest = data.cheapest || {};

  // Calculate overall cheapest
  const prices = [];
  if (cheapest.inside || data.cheapestinside) prices.push(cheapest.inside || data.cheapestinside);
  if (cheapest.outside || data.cheapestoutside)
    prices.push(cheapest.outside || data.cheapestoutside);
  if (cheapest.balcony || data.cheapestbalcony)
    prices.push(cheapest.balcony || data.cheapestbalcony);
  if (cheapest.suite || data.cheapestsuite) prices.push(cheapest.suite || data.cheapestsuite);

  const cheapestPrice = prices.length > 0 ? Math.min(...prices.filter(p => p && !isNaN(p))) : null;

  await client.query(
    `INSERT INTO cheapest_pricing (
      cruise_id, cheapest_price,
      interior_price, oceanview_price, balcony_price, suite_price,
      interior_price_code, oceanview_price_code, balcony_price_code, suite_price_code,
      currency
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      String(cruiseId),
      cheapestPrice,
      cheapest.inside || data.cheapestinside || null,
      cheapest.outside || data.cheapestoutside || null,
      cheapest.balcony || data.cheapestbalcony || null,
      cheapest.suite || data.cheapestsuite || null,
      data.cheapestinsidepricecode || cheapest.insidepricecode || null,
      data.cheapestoutsidepricecode || cheapest.outsidepricecode || null,
      data.cheapestbalconypricecode || cheapest.balconypricecode || null,
      data.cheapestsuitepricecode || cheapest.suitepricecode || null,
      'USD',
    ]
  );
}

/**
 * Process files in parallel batches
 */
async function processFileBatch(files) {
  const batchStartTime = Date.now();

  const results = await Promise.allSettled(
    files.map(async fileInfo => {
      try {
        const data = await downloadFile(fileInfo.path);
        await processCruiseData(fileInfo, data);

        stats.totalSuccess++;
        stats.monthlySuccess++;

        // Mark as processed
        checkpoint.processedFiles.push(fileInfo.path);

        return { success: true, file: fileInfo.path };
      } catch (error) {
        stats.totalFailed++;
        stats.monthlyFailed++;

        checkpoint.errors.push({
          file: fileInfo.path,
          error: error.message,
          time: new Date().toISOString(),
        });

        return { success: false, file: fileInfo.path, error: error.message };
      } finally {
        stats.totalProcessed++;
        stats.monthlyProcessed++;

        // Update progress display
        if (stats.totalProcessed % CONFIG.PROGRESS_UPDATE_INTERVAL === 0) {
          displayProgress();
        }
      }
    })
  );

  // Save checkpoint after each batch
  await saveCheckpoint();

  const batchTime = (Date.now() - batchStartTime) / 1000;
  console.log(`\n✅ Batch completed in ${batchTime.toFixed(1)}s`);

  return results;
}

/**
 * Save error log
 */
async function saveErrorLog() {
  if (checkpoint.errors.length > 0) {
    const errorLog = checkpoint.errors.map(e => `${e.time} - ${e.file}: ${e.error}`).join('\n');
    await fs.appendFile(CONFIG.ERROR_LOG, errorLog + '\n');
  }
}

/**
 * Main sync function
 */
async function main() {
  console.log('🚀 Zipsea Initial FTP Sync - FINAL VERSION');
  console.log('==========================================');
  console.log(
    `📅 Processing from ${CONFIG.START_YEAR}/${String(CONFIG.START_MONTH).padStart(2, '0')} to ${CONFIG.END_YEAR}/${String(CONFIG.END_MONTH).padStart(2, '0')}`
  );
  console.log(`📦 Batch size: ${CONFIG.BATCH_SIZE} files`);
  console.log(`🔌 Persistent connections: ${CONFIG.MAX_FTP_CONNECTIONS}`);
  console.log('💾 Resume capability: ENABLED');
  console.log('🔧 Download method: Temp files (FIXED)');
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
    const startIndex = checkpoint.lastProcessedMonth
      ? months.findIndex(
          m => `${m.year}/${String(m.month).padStart(2, '0')}` === checkpoint.lastProcessedMonth
        ) + 1
      : 0;

    const monthsToProcess = months.slice(startIndex);

    if (monthsToProcess.length === 0) {
      console.log('✅ All months already processed!');
      return;
    }

    console.log(
      `📅 Processing ${monthsToProcess.length} months starting from ${monthsToProcess[0].year}/${String(monthsToProcess[0].month).padStart(2, '0')}\n`
    );

    // Process each month
    for (const { year, month } of monthsToProcess) {
      const monthStr = `${year}/${String(month).padStart(2, '0')}`;
      stats.currentMonth = monthStr;

      console.log(`\n📅 Processing ${monthStr}...`);

      // Reset monthly stats
      stats.monthlyFiles = 0;
      stats.monthlyProcessed = 0;
      stats.monthlySuccess = 0;
      stats.monthlyFailed = 0;

      // List files for this month
      const files = await listCruiseFiles(year, month);

      if (files.length === 0) {
        console.log(`   ⚠️ No files found for ${monthStr}`);
        checkpoint.lastProcessedMonth = monthStr;
        await saveCheckpoint();
        continue;
      }

      stats.monthlyFiles = files.length;
      stats.totalFiles += files.length;

      console.log(`   📁 Found ${files.length} files to process`);

      // Process files in batches
      const totalBatches = Math.ceil(files.length / CONFIG.BATCH_SIZE);
      stats.totalBatches = totalBatches;

      for (let i = 0; i < files.length; i += CONFIG.BATCH_SIZE) {
        const batch = files.slice(i, i + CONFIG.BATCH_SIZE);
        stats.currentBatch = Math.floor(i / CONFIG.BATCH_SIZE) + 1;

        console.log(
          `\n📦 Processing batch ${stats.currentBatch}/${totalBatches} (${batch.length} files)`
        );

        await processFileBatch(batch);

        // Update checkpoint
        checkpoint.lastProcessedMonth = monthStr;
        checkpoint.lastProcessedFile = batch[batch.length - 1].path;
        await saveCheckpoint();
      }

      console.log(
        `\n✅ Completed ${monthStr}: ${stats.monthlySuccess} successful, ${stats.monthlyFailed} failed`
      );
    }

    // Final statistics
    const elapsed = (Date.now() - stats.startTime) / 1000;
    console.log('\n' + '='.repeat(50));
    console.log('✅ SYNC COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(50));
    console.log(`⏱️ Total time: ${(elapsed / 60).toFixed(1)} minutes`);
    console.log(`📁 Files processed: ${stats.totalProcessed}/${stats.totalFiles}`);
    console.log(
      `✅ Successful: ${stats.totalSuccess} (${Math.round((stats.totalSuccess / stats.totalProcessed) * 100)}%)`
    );
    console.log(`❌ Failed: ${stats.totalFailed}`);
    console.log(`🚢 Cruises: ${stats.cruisesCreated} created, ${stats.cruisesUpdated} updated`);
    console.log(
      `🏢 Entities: ${stats.linesCreated} lines, ${stats.shipsCreated} ships, ${stats.portsCreated} ports`
    );
    console.log(`🔌 Connection resets: ${stats.connectionResets}`);
    console.log(`📊 Average processing: ${stats.averageProcessingTime.toFixed(0)}ms per file`);
    console.log(`📈 Average rate: ${(stats.totalProcessed / elapsed).toFixed(1)} files/sec`);

    if (checkpoint.errors.length > 0) {
      console.log(
        `\n⚠️ ${checkpoint.errors.length} errors occurred. Check ${CONFIG.ERROR_LOG} for details.`
      );
      await saveErrorLog();
    }

    // Clean up checkpoint file on successful completion
    await fs.unlink(CONFIG.CHECKPOINT_FILE).catch(() => {});
    console.log('\n✅ Checkpoint cleared (sync fully completed)');

    console.log('\n📝 Next steps:');
    console.log('1. Review any errors in sync-errors.log');
    console.log('2. Verify data integrity with test queries');
    console.log('3. Resume webhook processing:');
    console.log('   node scripts/resume-webhooks.js');
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    console.error('Stack:', error.stack);

    // Save checkpoint on error
    await saveCheckpoint();
    console.log('\n💾 Checkpoint saved. Run the script again to resume from where it stopped.');

    process.exit(1);
  } finally {
    // Clean up connections
    console.log('\n🧹 Cleaning up connections...');

    // Clear keep-alive intervals
    keepAliveIntervals.forEach(interval => clearInterval(interval));

    // Close FTP connections
    for (const conn of ftpPool) {
      try {
        await conn.client.close();
      } catch (e) {
        // Ignore close errors
      }
    }

    // Close database pool
    if (dbPool) {
      await dbPool.end();
    }

    console.log('✅ Cleanup complete');
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { main };
