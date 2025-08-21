#!/usr/bin/env node

/**
 * Fixed Traveltek Data Sync Script
 * Uses code_to_cruise_id as the unique identifier for each sailing
 * Allows multiple sailings with the same cruise_id but different dates
 */

require('dotenv').config();
const FTP = require('ftp');
const fs = require('fs');
const { Pool } = require('pg');

console.log('🚢 Fixed Traveltek Data Sync');
console.log('==============================\n');
console.log('ℹ️ Using code_to_cruise_id as unique identifier');
console.log('ℹ️ Allows multiple sailings with same cruise ID\n');

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
const PROGRESS_FILE = `.sync-progress-fixed-${YEAR}-${MONTH}.json`;
let progress = {
  year: YEAR,
  month: MONTH,
  processedFiles: [],
  failedFiles: [],
  stats: {
    cruisesProcessed: 0,
    cruisesInserted: 0,
    cruisesUpdated: 0,
    duplicateSailings: 0,
    errors: 0
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
  if (value === 'Y' || value === 'true' || value === true) return true;
  if (value === 'N' || value === 'false' || value === false) return false;
  return null;
}

/**
 * Process a cruise file
 */
async function processCruiseFile(client, filePath, data) {
  const cruiseId = parseInteger(data.cruiseid);
  const codeToId = parseInteger(data.codetocruiseid);
  
  if (!cruiseId || !codeToId) {
    console.log('⚠️ Missing cruise ID, skipping');
    return;
  }
  
  try {
    // Check if this is a duplicate sailing (same cruise_id but different code_to_cruise_id)
    const existing = await client.query(
      'SELECT id, sailing_date FROM cruises WHERE cruise_id = $1 AND code_to_cruise_id != $2',
      [cruiseId, codeToId]
    );
    
    if (existing.rows.length > 0) {
      progress.stats.duplicateSailings++;
      console.log(`📅 Cruise ${cruiseId} has ${existing.rows.length + 1} sailings`);
    }
    
    // Use the actual primary key (id) which should be auto-generated
    // We'll insert with code_to_cruise_id as unique identifier
    const result = await client.query(`
      INSERT INTO cruises (
        id, code_to_cruise_id, cruise_line_id, ship_id, name,
        voyage_code, itinerary_code, sailing_date, start_date,
        nights, sail_nights, sea_days, embark_port_id, disembark_port_id,
        port_ids, region_ids, market_id, owner_id, no_fly, depart_uk,
        show_cruise, fly_cruise_info, last_cached, cached_date,
        traveltek_file_path
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
      ON CONFLICT (id) DO UPDATE SET
        -- Only update if this exact sailing (same code_to_cruise_id)
        name = CASE WHEN cruises.code_to_cruise_id = $2 THEN EXCLUDED.name ELSE cruises.name END,
        voyage_code = CASE WHEN cruises.code_to_cruise_id = $2 THEN EXCLUDED.voyage_code ELSE cruises.voyage_code END,
        sailing_date = CASE WHEN cruises.code_to_cruise_id = $2 THEN EXCLUDED.sailing_date ELSE cruises.sailing_date END,
        nights = CASE WHEN cruises.code_to_cruise_id = $2 THEN EXCLUDED.nights ELSE cruises.nights END,
        last_cached = CASE WHEN cruises.code_to_cruise_id = $2 THEN EXCLUDED.last_cached ELSE cruises.last_cached END,
        cached_date = CASE WHEN cruises.code_to_cruise_id = $2 THEN EXCLUDED.cached_date ELSE cruises.cached_date END,
        updated_at = CASE WHEN cruises.code_to_cruise_id = $2 THEN CURRENT_TIMESTAMP ELSE cruises.updated_at END
      RETURNING id, (xmax = 0) as inserted
    `, [
      codeToId, // Use code_to_cruise_id as the primary ID
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
    
    if (result.rows[0].inserted) {
      progress.stats.cruisesInserted++;
      console.log(`✅ Inserted cruise ${cruiseId} (sailing: ${data.saildate})`);
    } else {
      progress.stats.cruisesUpdated++;
      console.log(`📝 Updated cruise ${cruiseId} (sailing: ${data.saildate})`);
    }
    
    progress.stats.cruisesProcessed++;
    
    // Process itinerary
    if (data.itinerary && Array.isArray(data.itinerary)) {
      // Use code_to_cruise_id to reference the cruise
      await client.query('DELETE FROM itineraries WHERE cruise_id = $1', [codeToId]);
      
      for (const day of data.itinerary) {
        await client.query(`
          INSERT INTO itineraries (
            cruise_id, day_number, order_id, port_id, port_name,
            itinerary_name, arrive_date, depart_date, arrive_time,
            depart_time, latitude, longitude, description,
            short_description, itinerary_description, idl_crossed,
            supercedes, owner_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        `, [
          codeToId, // Reference by code_to_cruise_id
          parseInteger(day.day),
          parseInteger(day.orderid),
          parseInteger(day.portid),
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
    
    // Process static prices
    if (data.prices && typeof data.prices === 'object') {
      await client.query('DELETE FROM static_prices WHERE cruise_id = $1', [codeToId]);
      
      for (const [rateCode, cabins] of Object.entries(data.prices)) {
        if (typeof cabins !== 'object') continue;
        
        for (const [cabinId, pricing] of Object.entries(cabins)) {
          if (typeof pricing !== 'object') continue;
          
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
            codeToId, // Reference by code_to_cruise_id
            rateCode,
            cabinId,
            null,
            parseDecimal(pricing.price || pricing['2'] || pricing['1']),
            parseDecimal(pricing.taxes),
            parseDecimal(pricing.ncf),
            parseDecimal(pricing.gratuity)
          ]);
        }
      }
    }
    
    // Mark as processed
    progress.processedFiles.push(filePath);
    
  } catch (error) {
    console.error(`❌ Error processing cruise ${cruiseId}:`, error.message);
    progress.failedFiles.push({ path: filePath, error: error.message });
    progress.stats.errors++;
    
    if (!SKIP_ERRORS) {
      throw error;
    }
  }
}

/**
 * Main sync function
 */
async function sync() {
  const ftpClient = new FTP();
  const pgClient = await pool.connect();
  
  return new Promise((resolve, reject) => {
    ftpClient.on('ready', async () => {
      console.log('✅ Connected to FTP server\n');
      
      try {
        const basePath = `/${YEAR}/${MONTH}`;
        console.log(`📁 Processing ${basePath}\n`);
        
        // Navigate directories
        ftpClient.list(basePath, async (err, lineList) => {
          if (err) {
            console.error('Error listing cruise lines:', err);
            ftpClient.end();
            pgClient.release();
            return reject(err);
          }
          
          for (const lineItem of lineList) {
            if (lineItem.type !== 'd') continue;
            
            const linePath = `${basePath}/${lineItem.name}`;
            console.log(`\n📂 Processing line: ${lineItem.name}`);
            
            await new Promise((resolveShips) => {
              ftpClient.list(linePath, async (err, shipList) => {
                if (err) {
                  console.error(`Error listing ships for line ${lineItem.name}:`, err);
                  resolveShips();
                  return;
                }
                
                for (const shipItem of shipList) {
                  if (shipItem.type !== 'd') continue;
                  
                  const shipPath = `${linePath}/${shipItem.name}`;
                  console.log(`  🚢 Processing ship: ${shipItem.name}`);
                  
                  await new Promise((resolveCruises) => {
                    ftpClient.list(shipPath, async (err, cruiseList) => {
                      if (err) {
                        console.error(`Error listing cruises for ship ${shipItem.name}:`, err);
                        resolveCruises();
                        return;
                      }
                      
                      let batch = [];
                      for (const cruiseItem of cruiseList) {
                        if (!cruiseItem.name.endsWith('.json')) continue;
                        
                        const filePath = `${shipPath}/${cruiseItem.name}`;
                        
                        // Skip if already processed
                        if (progress.processedFiles.includes(filePath)) {
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

// Run sync
sync()
  .then(async () => {
    console.log('\n✅ Sync completed successfully!\n');
    console.log('📊 Statistics:');
    console.log(`  Processed: ${progress.stats.cruisesProcessed} cruises`);
    console.log(`  Inserted: ${progress.stats.cruisesInserted} new cruises`);
    console.log(`  Updated: ${progress.stats.cruisesUpdated} existing cruises`);
    console.log(`  Duplicate Sailings: ${progress.stats.duplicateSailings} (same cruise, different dates)`);
    console.log(`  Errors: ${progress.stats.errors}`);
    
    await pool.end();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('❌ Sync failed:', error);
    await pool.end();
    process.exit(1);
  });