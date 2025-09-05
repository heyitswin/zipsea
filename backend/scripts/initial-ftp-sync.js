#!/usr/bin/env node

/**
 * Initial FTP Sync Script
 * Efficiently populates database from Traveltek FTP server
 * Starts from 2025/09/* and processes in parallel batches
 * Date: 2025-09-04
 */

const ftp = require('basic-ftp');
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
require('dotenv').config({ path: '.env.local' });

// Configuration
const CONFIG = {
  YEAR: 2025,
  MONTH: 9, // September
  BATCH_SIZE: 50, // Process 50 files at a time
  MAX_PARALLEL_DOWNLOADS: 5, // Max concurrent FTP connections
  TEMP_DIR: path.join(os.tmpdir(), 'zipsea-sync'),
  PROGRESS_FILE: './sync-progress.json',
  ERROR_LOG: './sync-errors.log',
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000, // ms
};

// Database connection pool
let dbPool;

// FTP connection pool
const ftpConnections = [];

// Statistics
const stats = {
  totalFiles: 0,
  processedFiles: 0,
  successfulFiles: 0,
  failedFiles: 0,
  cruisesCreated: 0,
  cruisesUpdated: 0,
  startTime: Date.now(),
  errors: [],
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
    max: 10, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  // Test connection
  const client = await dbPool.connect();
  try {
    await client.query('SELECT 1');
    console.log('✅ Database connection established');
  } finally {
    client.release();
  }
}

/**
 * Create FTP connection pool
 */
async function createFtpPool() {
  const ftpConfig = {
    host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
    user: process.env.TRAVELTEK_FTP_USER,
    password: process.env.TRAVELTEK_FTP_PASSWORD,
    secure: false,
    timeout: 30000,
  };

  if (!ftpConfig.user || !ftpConfig.password) {
    throw new Error('FTP credentials not found in environment variables');
  }

  // Create connection pool
  for (let i = 0; i < CONFIG.MAX_PARALLEL_DOWNLOADS; i++) {
    const client = new ftp.Client();
    client.ftp.verbose = false;
    await client.access(ftpConfig);
    ftpConnections.push(client);
  }

  console.log(`✅ Created ${CONFIG.MAX_PARALLEL_DOWNLOADS} FTP connections`);
}

/**
 * Get available FTP connection from pool
 */
async function getFtpConnection() {
  return ftpConnections.shift();
}

/**
 * Return FTP connection to pool
 */
function returnFtpConnection(client) {
  ftpConnections.push(client);
}

/**
 * List all cruise files for a specific month
 */
async function listCruiseFiles(year, month) {
  const client = await getFtpConnection();
  const files = [];

  try {
    const monthPath = `/${year}/${String(month).padStart(2, '0')}`;
    console.log(`📂 Scanning ${monthPath}...`);

    // List all line directories
    const lineDirectories = await client.list(monthPath);

    for (const lineDir of lineDirectories) {
      if (lineDir.type === 2) {
        // Directory
        const linePath = `${monthPath}/${lineDir.name}`;

        // List all ship directories
        const shipDirectories = await client.list(linePath);

        for (const shipDir of shipDirectories) {
          if (shipDir.type === 2) {
            // Directory
            const shipPath = `${linePath}/${shipDir.name}`;

            // List all cruise JSON files
            const cruiseFiles = await client.list(shipPath);

            for (const file of cruiseFiles) {
              if (file.type === 1 && file.name.endsWith('.json')) {
                files.push({
                  path: `${shipPath}/${file.name}`,
                  lineId: parseInt(lineDir.name),
                  shipId: parseInt(shipDir.name),
                  cruiseId: path.basename(file.name, '.json'),
                  size: file.size,
                  date: file.date,
                });
              }
            }
          }
        }
      }
    }

    return files;
  } finally {
    returnFtpConnection(client);
  }
}

/**
 * Download a single file with retry logic
 */
async function downloadFile(filePath, retries = 0) {
  const client = await getFtpConnection();

  try {
    const tempFile = path.join(CONFIG.TEMP_DIR, path.basename(filePath));
    const writeStream = await fs.open(tempFile, 'w');

    await client.downloadTo(writeStream, filePath);
    await writeStream.close();

    const content = await fs.readFile(tempFile, 'utf8');
    await fs.unlink(tempFile); // Clean up temp file

    return JSON.parse(content);
  } catch (error) {
    if (retries < CONFIG.MAX_RETRIES) {
      console.log(`⚠️ Retry ${retries + 1}/${CONFIG.MAX_RETRIES} for ${filePath}`);
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
      return downloadFile(filePath, retries + 1);
    }
    throw error;
  } finally {
    returnFtpConnection(client);
  }
}

/**
 * Process a single cruise data file
 */
async function processCruiseData(fileInfo, data) {
  const client = await dbPool.connect();

  try {
    await client.query('BEGIN');

    // 1. Ensure cruise line exists
    await ensureCruiseLineExists(client, data.lineid, data);

    // 2. Ensure ship exists
    await ensureShipExists(client, data.shipid, data.lineid, data);

    // 3. Ensure ports exist
    if (data.ports && Array.isArray(data.ports)) {
      await ensurePortsExist(client, data);
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

    // 8. Sync pricing data
    if (data.prices || data.cachedprices) {
      await syncPricing(client, data.codetocruiseid, data);
    }

    // 9. Sync cheapest pricing
    if (data.cheapest || data.cheapestinside || data.cheapestoutside) {
      await syncCheapestPricing(client, data.codetocruiseid, data);
    }

    await client.query('COMMIT');

    if (cruiseCreated) {
      stats.cruisesCreated++;
    } else {
      stats.cruisesUpdated++;
    }

    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Ensure cruise line exists
 */
async function ensureCruiseLineExists(client, lineId, data) {
  const existingLine = await client.query('SELECT id FROM cruise_lines WHERE id = $1', [lineId]);

  if (existingLine.rows.length === 0) {
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
       ON CONFLICT (id) DO NOTHING`,
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
}

/**
 * Ensure ship exists
 */
async function ensureShipExists(client, shipId, lineId, data) {
  const existingShip = await client.query('SELECT id FROM ships WHERE id = $1', [shipId]);

  if (existingShip.rows.length === 0) {
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
       ON CONFLICT (id) DO NOTHING`,
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
}

/**
 * Ensure ports exist
 */
async function ensurePortsExist(client, data) {
  if (data.portids && data.ports) {
    for (let i = 0; i < data.portids.length; i++) {
      const portId = data.portids[i];
      const portName = data.ports[i] || `Port ${portId}`;

      await client.query(
        `INSERT INTO ports (id, name, code)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [portId, portName, `P${portId}`]
      );
    }
  }

  // Also ensure embark/disembark ports
  if (data.startportid) {
    await client.query(
      `INSERT INTO ports (id, name, code)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [data.startportid, `Port ${data.startportid}`, `P${data.startportid}`]
    );
  }

  if (data.endportid) {
    await client.query(
      `INSERT INTO ports (id, name, code)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [data.endportid, `Port ${data.endportid}`, `P${data.endportid}`]
    );
  }
}

/**
 * Ensure regions exist
 */
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

/**
 * Upsert cruise record
 */
async function upsertCruise(client, data) {
  // Check if cruise exists
  const existing = await client.query('SELECT id FROM cruises WHERE id = $1', [
    String(data.codetocruiseid),
  ]);

  // Calculate cheapest price
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

/**
 * Sync itinerary data
 */
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

/**
 * Sync alternative sailings
 */
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

/**
 * Sync pricing data (simplified for initial sync)
 */
async function syncPricing(client, cruiseId, data) {
  // For initial sync, we'll just ensure cheapest prices are captured
  // Full pricing sync can be done separately if needed

  // Process static prices
  if (data.prices && typeof data.prices === 'object') {
    await processPriceObject(client, cruiseId, data.prices, 'static');
  }

  // Process cached prices
  if (data.cachedprices && typeof data.cachedprices === 'object') {
    await processPriceObject(client, cruiseId, data.cachedprices, 'cached');
  }
}

/**
 * Process price object (simplified)
 */
async function processPriceObject(client, cruiseId, prices, source) {
  // Sample a few prices for initial sync (full sync can be done later)
  let count = 0;
  const MAX_PRICES = 10; // Limit for initial sync

  for (const [rateCode, cabins] of Object.entries(prices)) {
    if (count >= MAX_PRICES) break;

    for (const [cabinCode, occupancies] of Object.entries(cabins)) {
      if (count >= MAX_PRICES) break;

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

/**
 * Sync cheapest pricing
 */
async function syncCheapestPricing(client, cruiseId, data) {
  // Delete existing cheapest pricing
  await client.query('DELETE FROM cheapest_pricing WHERE cruise_id = $1', [String(cruiseId)]);

  // Prepare cheapest pricing data
  const cheapest = data.cheapest || {};

  await client.query(
    `INSERT INTO cheapest_pricing (
      cruise_id,
      cheapest_price, interior_price, oceanview_price, balcony_price, suite_price,
      interior_price_code, oceanview_price_code, balcony_price_code, suite_price_code,
      currency
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      String(cruiseId),
      null, // Will be calculated
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
 * Process files in batches
 */
async function processFileBatch(files) {
  const results = await Promise.allSettled(
    files.map(async fileInfo => {
      try {
        const data = await downloadFile(fileInfo.path);
        await processCruiseData(fileInfo, data);
        stats.successfulFiles++;
        return { success: true, file: fileInfo.path };
      } catch (error) {
        stats.failedFiles++;
        stats.errors.push({
          file: fileInfo.path,
          error: error.message,
        });
        return { success: false, file: fileInfo.path, error: error.message };
      } finally {
        stats.processedFiles++;

        // Print progress
        if (stats.processedFiles % 10 === 0) {
          const elapsed = (Date.now() - stats.startTime) / 1000;
          const rate = stats.processedFiles / elapsed;
          console.log(
            `📊 Progress: ${stats.processedFiles}/${stats.totalFiles} files (${rate.toFixed(1)} files/sec)`
          );
        }
      }
    })
  );

  return results;
}

/**
 * Save progress to file
 */
async function saveProgress() {
  await fs.writeFile(CONFIG.PROGRESS_FILE, JSON.stringify(stats, null, 2));
}

/**
 * Save errors to log file
 */
async function saveErrors() {
  const errorLog = stats.errors
    .map(e => `${new Date().toISOString()} - ${e.file}: ${e.error}`)
    .join('\n');
  await fs.appendFile(CONFIG.ERROR_LOG, errorLog + '\n');
}

/**
 * Main sync function
 */
async function main() {
  console.log('🚀 Zipsea Initial FTP Sync');
  console.log('=========================');
  console.log(`📅 Syncing data for: ${CONFIG.YEAR}/${String(CONFIG.MONTH).padStart(2, '0')}`);
  console.log(`📦 Batch size: ${CONFIG.BATCH_SIZE} files`);
  console.log(`🔄 Parallel downloads: ${CONFIG.MAX_PARALLEL_DOWNLOADS}`);
  console.log('');

  try {
    // Create temp directory
    await fs.mkdir(CONFIG.TEMP_DIR, { recursive: true });

    // Initialize database
    await initDatabase();

    // Create FTP connection pool
    await createFtpPool();

    // List all cruise files
    console.log('📋 Listing cruise files...');
    const files = await listCruiseFiles(CONFIG.YEAR, CONFIG.MONTH);
    stats.totalFiles = files.length;

    console.log(`📁 Found ${files.length} cruise files to process`);

    if (files.length === 0) {
      console.log('⚠️ No files found to process');
      return;
    }

    // Process files in batches
    console.log('🔄 Starting batch processing...');
    for (let i = 0; i < files.length; i += CONFIG.BATCH_SIZE) {
      const batch = files.slice(i, i + CONFIG.BATCH_SIZE);
      console.log(
        `\n📦 Processing batch ${Math.floor(i / CONFIG.BATCH_SIZE) + 1}/${Math.ceil(files.length / CONFIG.BATCH_SIZE)}`
      );

      await processFileBatch(batch);

      // Save progress after each batch
      await saveProgress();
    }

    // Print final statistics
    const elapsed = (Date.now() - stats.startTime) / 1000;
    console.log('\n✅ Sync completed!');
    console.log('==================');
    console.log(`⏱️ Total time: ${elapsed.toFixed(1)} seconds`);
    console.log(`📁 Files processed: ${stats.processedFiles}/${stats.totalFiles}`);
    console.log(`✅ Successful: ${stats.successfulFiles}`);
    console.log(`❌ Failed: ${stats.failedFiles}`);
    console.log(`🚢 Cruises created: ${stats.cruisesCreated}`);
    console.log(`🔄 Cruises updated: ${stats.cruisesUpdated}`);
    console.log(`📊 Average rate: ${(stats.processedFiles / elapsed).toFixed(1)} files/sec`);

    if (stats.errors.length > 0) {
      console.log(
        `\n⚠️ ${stats.errors.length} errors occurred. Check ${CONFIG.ERROR_LOG} for details.`
      );
      await saveErrors();
    }

    // Save final progress
    await saveProgress();
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    // Close FTP connections
    for (const client of ftpConnections) {
      await client.close();
    }

    // Close database pool
    if (dbPool) {
      await dbPool.end();
    }

    // Clean up temp directory
    try {
      await fs.rmdir(CONFIG.TEMP_DIR, { recursive: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { main };
