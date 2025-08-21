#!/usr/bin/env node

/**
 * Robust Traveltek Data Sync Script
 * Handles all edge cases and missing data gracefully
 */

require('dotenv').config();
const FTP = require('ftp');
const fs = require('fs');
const { Pool } = require('pg');

console.log('🚢 Robust Traveltek Data Sync');
console.log('==============================\n');

// Configuration
const YEAR = process.env.YEAR || '2025';
const MONTH = process.env.MONTH || '09';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '10');
const SKIP_ERRORS = process.env.SKIP_ERRORS !== 'false';

const ftpConfig = {
  host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
  user: process.env.TRAVELTEK_FTP_USER,
  password: process.env.TRAVELTEK_FTP_PASSWORD,
  port: 21,
  secure: false,
  connTimeout: 30000,
  pasvTimeout: 30000
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Progress tracking
const PROGRESS_FILE = `.sync-progress-${YEAR}-${MONTH}.json`;
let progress = {
  year: YEAR,
  month: MONTH,
  processedFiles: [],
  failedFiles: [],
  stats: {
    cruisesProcessed: 0,
    cruisesInserted: 0,
    cruisesUpdated: 0,
    portsCreated: 0,
    regionsCreated: 0,
    errors: 0,
    skipped: 0
  }
};

if (fs.existsSync(PROGRESS_FILE)) {
  const saved = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
  if (saved.year === YEAR && saved.month === MONTH) {
    progress = saved;
    console.log('📂 Resuming from previous progress');
    console.log(`   Processed: ${progress.processedFiles.length} files`);
    console.log(`   Failed: ${progress.failedFiles.length} files\n`);
  }
}

// Save progress
function saveProgress() {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// Helpers
function parseInteger(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = parseInt(value);
  return isNaN(num) ? null : num;
}

function parseDecimal(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

function parseDate(value) {
  if (!value) return null;
  try {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
  } catch {
    return null;
  }
}

function parseTime(value) {
  if (!value) return null;
  if (value.includes('T')) {
    return value.split('T')[1].split('Z')[0];
  }
  return value;
}

function parseBoolean(value) {
  return value === 'Y' || value === 'true' || value === true;
}

/**
 * Ensure all referenced entities exist
 */
async function ensureEntitiesExist(client, data) {
  // Ensure cruise line exists
  if (data.lineid) {
    const lineId = parseInteger(data.lineid);
    const lineName = data.linecontent?.name || 
                     data.linecontent?.shortname || 
                     `Cruise Line ${lineId}`;
    
    await client.query(`
      INSERT INTO cruise_lines (id, name)
      VALUES ($1, $2)
      ON CONFLICT (id) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, cruise_lines.name)
    `, [lineId, lineName]);
  }
  
  // Ensure ship exists
  if (data.shipid && data.lineid) {
    const shipId = parseInteger(data.shipid);
    const shipName = data.shipcontent?.name || 
                     data.shipcontent?.shortname || 
                     `Ship ${shipId}`;
    
    await client.query(`
      INSERT INTO ships (id, cruise_line_id, name)
      VALUES ($1, $2, $3)
      ON CONFLICT (id) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, ships.name)
    `, [shipId, parseInteger(data.lineid), shipName]);
  }
  
  // Process all ports from various sources
  const allPorts = new Map();
  
  // From ports object
  if (data.ports && typeof data.ports === 'object') {
    for (const [portId, portName] of Object.entries(data.ports)) {
      const id = parseInteger(portId);
      if (id) allPorts.set(id, portName);
    }
  }
  
  // From itinerary
  if (data.itinerary && Array.isArray(data.itinerary)) {
    for (const day of data.itinerary) {
      const portId = parseInteger(day.portid);
      if (portId && day.name) {
        allPorts.set(portId, day.name);
      }
    }
  }
  
  // From embark/disembark ports
  const embarkId = parseInteger(data.startportid);
  const disembarkId = parseInteger(data.endportid);
  
  if (embarkId && !allPorts.has(embarkId)) {
    allPorts.set(embarkId, `Port ${embarkId}`);
  }
  if (disembarkId && !allPorts.has(disembarkId)) {
    allPorts.set(disembarkId, `Port ${disembarkId}`);
  }
  
  // Insert all ports
  for (const [portId, portName] of allPorts.entries()) {
    await client.query(`
      INSERT INTO ports (id, name)
      VALUES ($1, $2)
      ON CONFLICT (id) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, ports.name)
    `, [portId, portName || `Port ${portId}`]);
    progress.stats.portsCreated++;
  }
  
  // Process regions
  if (data.regions && typeof data.regions === 'object') {
    for (const [regionId, regionName] of Object.entries(data.regions)) {
      const id = parseInteger(regionId);
      if (id) {
        await client.query(`
          INSERT INTO regions (id, name)
          VALUES ($1, $2)
          ON CONFLICT (id) DO UPDATE SET
            name = COALESCE(EXCLUDED.name, regions.name)
        `, [id, regionName || `Region ${id}`]);
        progress.stats.regionsCreated++;
      }
    }
  }
}

/**
 * Process complete cruise data
 */
async function processCruiseData(client, data, filePath) {
  // First ensure all referenced entities exist
  await ensureEntitiesExist(client, data);
  
  // Process cruise
  const cruiseId = parseInteger(data.cruiseid);
  const codeToId = parseInteger(data.codetocruiseid);
  
  if (!cruiseId || !codeToId) {
    throw new Error('Missing cruise ID');
  }
  
  // Insert/update cruise - use UPSERT to handle duplicates
  await client.query(`
    INSERT INTO cruises (
      id, code_to_cruise_id, cruise_line_id, ship_id, name,
      voyage_code, itinerary_code, sailing_date, start_date,
      nights, sail_nights, sea_days, embark_port_id, disembark_port_id,
      port_ids, region_ids, market_id, owner_id, no_fly, depart_uk,
      show_cruise, fly_cruise_info, last_cached, cached_date,
      traveltek_file_path
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
    ON CONFLICT (id) DO UPDATE SET
      code_to_cruise_id = EXCLUDED.code_to_cruise_id,
      cruise_line_id = EXCLUDED.cruise_line_id,
      ship_id = EXCLUDED.ship_id,
      name = EXCLUDED.name,
      voyage_code = EXCLUDED.voyage_code,
      itinerary_code = EXCLUDED.itinerary_code,
      sailing_date = EXCLUDED.sailing_date,
      start_date = EXCLUDED.start_date,
      nights = EXCLUDED.nights,
      sail_nights = EXCLUDED.sail_nights,
      sea_days = EXCLUDED.sea_days,
      embark_port_id = EXCLUDED.embark_port_id,
      disembark_port_id = EXCLUDED.disembark_port_id,
      port_ids = EXCLUDED.port_ids,
      region_ids = EXCLUDED.region_ids,
      market_id = EXCLUDED.market_id,
      owner_id = EXCLUDED.owner_id,
      no_fly = EXCLUDED.no_fly,
      depart_uk = EXCLUDED.depart_uk,
      show_cruise = EXCLUDED.show_cruise,
      fly_cruise_info = EXCLUDED.fly_cruise_info,
      last_cached = EXCLUDED.last_cached,
      cached_date = EXCLUDED.cached_date,
      traveltek_file_path = EXCLUDED.traveltek_file_path,
      updated_at = CURRENT_TIMESTAMP
  `, [
    cruiseId,
    codeToId,
    parseInteger(data.lineid),
    parseInteger(data.shipid),
    data.name || null,
    data.voyagecode || null,
    data.itinerarycode || null,
    parseDate(data.saildate),
    parseDate(data.startdate),
    parseInteger(data.nights),
    parseInteger(data.sailnights),
    parseInteger(data.seadays),
    parseInteger(data.startportid),
    parseInteger(data.endportid),
    data.portids || '',
    data.regionids || '',
    parseInteger(data.marketid),
    data.ownerid || 'system',
    parseBoolean(data.nofly),
    parseBoolean(data.departuk),
    parseBoolean(data.showcruise),
    data.flycruiseinfo || null,
    parseInteger(data.lastcached),
    data.lastcached ? new Date(parseInteger(data.lastcached) * 1000) : null,
    filePath
  ]);
  
  progress.stats.cruisesProcessed++;
  // Note: We can't easily distinguish between insert/update with ON CONFLICT
  // but both are successfully processed
  
  // Process itinerary
  if (data.itinerary && Array.isArray(data.itinerary)) {
    await client.query('DELETE FROM itineraries WHERE cruise_id = $1', [cruiseId]);
    
    for (const day of data.itinerary) {
      const portId = parseInteger(day.portid);
      
      // Only insert if we have valid data
      if (day.day || day.orderid) {
        await client.query(`
          INSERT INTO itineraries (
            cruise_id, day_number, order_id, port_id, port_name,
            itinerary_name, arrive_date, depart_date, arrive_time,
            depart_time, latitude, longitude, description,
            short_description, itinerary_description, idl_crossed,
            supercedes, owner_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        `, [
          cruiseId,
          parseInteger(day.day),
          parseInteger(day.orderid),
          portId,  // Can be null
          day.name || day.itineraryname || null,
          day.itineraryname || null,
          parseDate(day.arrivedate),
          parseDate(day.departdate),
          parseTime(day.arrivetime),
          parseTime(day.departtime),
          parseDecimal(day.latitude),
          parseDecimal(day.longitude),
          day.description || null,
          day.shortdescription || null,
          day.itinerarydescription || null,
          day.idlcrossed || null,
          parseInteger(day.supercedes),
          day.ownerid || 'system'
        ]);
      }
    }
  }
  
  // Process cabin types
  if (data.cabins && typeof data.cabins === 'object') {
    for (const [cabinId, cabin] of Object.entries(data.cabins)) {
      await client.query(`
        INSERT INTO cabin_types (
          id, ship_id, cabin_code, cabin_code2, name, description,
          cod_type, colour_code, is_default
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description
      `, [
        cabin.id || cabinId,
        parseInteger(data.shipid),
        cabin.cabincode || null,
        cabin.cabincode2 || null,
        cabin.name || null,
        cabin.description || null,
        cabin.codtype || null,
        cabin.colourcode || null,
        parseBoolean(cabin.isdefault)
      ]);
    }
  }
  
  // Process static prices (simplified - just store basic prices)
  if (data.prices && typeof data.prices === 'object') {
    await client.query('DELETE FROM static_prices WHERE cruise_id = $1', [cruiseId]);
    
    for (const [rateCode, cabins] of Object.entries(data.prices)) {
      if (typeof cabins !== 'object') continue;
      
      for (const [cabinId, pricing] of Object.entries(cabins)) {
        if (typeof pricing !== 'object') continue;
        const pricingData = pricing;
        
        await client.query(`
          INSERT INTO static_prices (
            cruise_id, rate_code, cabin_id, cabin_type,
            price, taxes, ncf, gratuity
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (cruise_id, rate_code, cabin_id) DO UPDATE SET
            price = EXCLUDED.price,
            taxes = EXCLUDED.taxes,
            ncf = EXCLUDED.ncf,
            gratuity = EXCLUDED.gratuity
        `, [
          cruiseId,
          rateCode,
          cabinId,
          pricingData.cabintype || null,
          parseDecimal(pricingData.price),
          parseDecimal(pricingData.taxes),
          parseDecimal(pricingData.ncf),
          parseDecimal(pricingData.gratuity)
        ]);
      }
    }
  }
  
  // Process cheapest prices (simplified)
  const cheapest = data.cheapest || {};
  const combined = cheapest.combined || {};
  
  await client.query(`
    INSERT INTO cheapest_prices (
      cruise_id,
      combined_inside, combined_outside, combined_balcony, combined_suite,
      cheapest_price
    ) VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (cruise_id) DO UPDATE SET
      combined_inside = EXCLUDED.combined_inside,
      combined_outside = EXCLUDED.combined_outside,
      combined_balcony = EXCLUDED.combined_balcony,
      combined_suite = EXCLUDED.combined_suite,
      cheapest_price = EXCLUDED.cheapest_price,
      last_updated = CURRENT_TIMESTAMP
  `, [
    cruiseId,
    parseDecimal(combined.inside || data.cheapestinside),
    parseDecimal(combined.outside || data.cheapestoutside),
    parseDecimal(combined.balcony || data.cheapestbalcony),
    parseDecimal(combined.suite || data.cheapestsuite),
    parseDecimal(data.cheapestprice)
  ]);
}

/**
 * Process a single cruise file
 */
async function processCruiseFile(client, filePath, data) {
  try {
    await client.query('BEGIN');
    await processCruiseData(client, data, filePath);
    await client.query('COMMIT');
    
    progress.processedFiles.push(filePath);
    saveProgress();
    
    console.log(`✅ Processed: ${filePath}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    
    if (SKIP_ERRORS) {
      console.log(`⚠️ Skipped (error): ${filePath} - ${error.message}`);
      progress.failedFiles.push({ path: filePath, error: error.message });
      progress.stats.skipped++;
    } else {
      throw error;
    }
  }
}

/**
 * Download and process files from FTP
 */
async function syncFromFTP() {
  const ftpClient = new FTP();
  const pgClient = await pool.connect();
  
  return new Promise((resolve, reject) => {
    ftpClient.on('ready', async () => {
      console.log('✅ Connected to FTP\n');
      
      try {
        const basePath = `/${YEAR}/${MONTH.padStart(2, '0')}`;
        console.log(`📂 Processing ${basePath}...\n`);
        
        // List cruise lines
        ftpClient.list(basePath, async (err, lineList) => {
          if (err) {
            console.error('Error listing cruise lines:', err);
            ftpClient.end();
            pgClient.release();
            return reject(err);
          }
          
          for (const lineItem of lineList) {
            if (lineItem.type !== 'd') continue;
            
            const lineId = lineItem.name;
            const linePath = `${basePath}/${lineId}`;
            
            console.log(`\n📁 Processing Line ${lineId}...`);
            
            // List ships
            await new Promise((resolveShips) => {
              ftpClient.list(linePath, async (err, shipList) => {
                if (err) {
                  console.error(`Error listing ships for line ${lineId}:`, err);
                  resolveShips();
                  return;
                }
                
                for (const shipItem of shipList) {
                  if (shipItem.type !== 'd') continue;
                  
                  const shipId = shipItem.name;
                  const shipPath = `${linePath}/${shipId}`;
                  
                  console.log(`  📁 Ship ${shipId}...`);
                  
                  // List cruise files
                  await new Promise((resolveCruises) => {
                    ftpClient.list(shipPath, async (err, cruiseList) => {
                      if (err) {
                        console.error(`Error listing cruises for ship ${shipId}:`, err);
                        resolveCruises();
                        return;
                      }
                      
                      let batch = [];
                      
                      for (const cruiseItem of cruiseList) {
                        if (!cruiseItem.name.endsWith('.json')) continue;
                        
                        const filePath = `${shipPath}/${cruiseItem.name}`;
                        
                        // Skip if already processed
                        if (progress.processedFiles.includes(filePath)) {
                          console.log(`⏭️ Already processed: ${filePath}`);
                          continue;
                        }
                        
                        // Skip if previously failed
                        if (progress.failedFiles.some(f => f.path === filePath)) {
                          console.log(`⏭️ Previously failed: ${filePath}`);
                          continue;
                        }
                        
                        batch.push(filePath);
                        
                        // Process in batches
                        if (batch.length >= BATCH_SIZE) {
                          await processBatch(ftpClient, pgClient, batch);
                          batch = [];
                        }
                      }
                      
                      // Process remaining
                      if (batch.length > 0) {
                        await processBatch(ftpClient, pgClient, batch);
                      }
                      
                      resolveCruises();
                    });
                  });
                }
                
                resolveShips();
              });
            });
          }
          
          ftpClient.end();
          pgClient.release();
          resolve();
        });
        
      } catch (error) {
        console.error('Sync error:', error);
        ftpClient.end();
        pgClient.release();
        reject(error);
      }
    });
    
    ftpClient.on('error', (err) => {
      console.error('FTP error:', err);
      pgClient.release();
      reject(err);
    });
    
    ftpClient.connect(ftpConfig);
  });
}

/**
 * Process a batch of files
 */
async function processBatch(ftpClient, pgClient, filePaths) {
  for (const filePath of filePaths) {
    try {
      // Download file
      const data = await new Promise((resolve, reject) => {
        ftpClient.get(filePath, (err, stream) => {
          if (err) return reject(err);
          
          let content = '';
          stream.on('data', chunk => content += chunk);
          stream.on('end', () => {
            try {
              resolve(JSON.parse(content));
            } catch (e) {
              reject(e);
            }
          });
          stream.on('error', reject);
        });
      });
      
      // Process file
      await processCruiseFile(pgClient, filePath, data);
      
    } catch (error) {
      console.error(`❌ Failed to process ${filePath}:`, error.message);
      progress.stats.errors++;
      
      if (!SKIP_ERRORS) {
        throw error;
      }
    }
  }
  
  saveProgress();
}

// Main execution
async function main() {
  try {
    console.log('🚀 Starting Robust Traveltek Sync');
    console.log(`📅 Year: ${YEAR}, Month: ${MONTH}`);
    console.log(`📦 Batch size: ${BATCH_SIZE}`);
    console.log(`⚠️ Skip errors: ${SKIP_ERRORS}\n`);
    
    await syncFromFTP();
    
    console.log('\n✅ Sync completed!');
    console.log('\n📊 Statistics:');
    console.log(`   Cruises processed: ${progress.stats.cruisesProcessed}`);
    console.log(`   Ports created: ${progress.stats.portsCreated}`);
    console.log(`   Regions created: ${progress.stats.regionsCreated}`);
    console.log(`   Files processed: ${progress.processedFiles.length}`);
    console.log(`   Files failed: ${progress.failedFiles.length}`);
    console.log(`   Errors: ${progress.stats.errors}`);
    
    if (progress.failedFiles.length > 0) {
      console.log('\n⚠️ Failed files:');
      for (const failed of progress.failedFiles.slice(0, 10)) {
        console.log(`   ${failed.path}: ${failed.error}`);
      }
      if (progress.failedFiles.length > 10) {
        console.log(`   ... and ${progress.failedFiles.length - 10} more`);
      }
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the sync
main();