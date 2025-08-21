#!/usr/bin/env node

/**
 * Final Fixed Traveltek Data Sync Script
 * 
 * Correctly handles the primary key issue:
 * - Uses code_to_cruise_id as the actual ID (since it's unique)
 * - Stores cruiseid as a regular field for grouping
 * 
 * Based on Traveltek API documentation:
 * - cruiseid: Can be duplicated (same cruise, different sailings)
 * - codetocruiseid: Always unique (specific sailing)
 */

require('dotenv').config();
const FTP = require('ftp');
const fs = require('fs');
const { Pool } = require('pg');

console.log('🚢 Traveltek Data Sync - Final Version');
console.log('======================================\n');

// Configuration
const YEAR = process.env.SYNC_YEARS || '2025';
const MONTH = process.env.SYNC_MONTH || '09';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '10');
const FORCE_UPDATE = process.env.FORCE_UPDATE === 'true';

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
  stats: {
    cruisesProcessed: 0,
    cruisesInserted: 0,
    cruisesUpdated: 0,
    errors: 0
  }
};

if (fs.existsSync(PROGRESS_FILE) && !FORCE_UPDATE) {
  const saved = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
  if (saved.year === YEAR && saved.month === MONTH) {
    progress = saved;
    console.log('📂 Resuming from previous progress');
    console.log(`   Processed: ${progress.processedFiles.length} files\n`);
  }
}

// Save progress
function saveProgress() {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// Helper functions
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

function parseBoolean(value) {
  if (value === 'Y' || value === 'true' || value === true) return true;
  if (value === 'N' || value === 'false' || value === false) return false;
  return null;
}

/**
 * Process cruise data with correct primary key handling
 */
async function processCruiseData(client, data, filePath) {
  const cruiseId = parseInteger(data.cruiseid); // Can be duplicated
  const codeToId = parseInteger(data.codetocruiseid); // Always unique
  
  if (!cruiseId || !codeToId) {
    console.log('⚠️ Missing required IDs, skipping');
    return;
  }
  
  try {
    // IMPORTANT: Use code_to_cruise_id as the primary key (id column)
    // Store cruiseid as a regular field for grouping
    const result = await client.query(`
      INSERT INTO cruises (
        id, -- This is code_to_cruise_id (unique)
        code_to_cruise_id, -- Also store it here for clarity
        cruise_line_id, ship_id, name,
        voyage_code, itinerary_code, sailing_date, start_date,
        nights, sail_nights, sea_days, embark_port_id, disembark_port_id,
        port_ids, region_ids, market_id, owner_id, no_fly, depart_uk,
        show_cruise, fly_cruise_info, last_cached, cached_date,
        traveltek_file_path
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        voyage_code = EXCLUDED.voyage_code,
        sailing_date = EXCLUDED.sailing_date,
        nights = EXCLUDED.nights,
        port_ids = EXCLUDED.port_ids,
        region_ids = EXCLUDED.region_ids,
        last_cached = EXCLUDED.last_cached,
        cached_date = EXCLUDED.cached_date,
        traveltek_file_path = EXCLUDED.traveltek_file_path,
        updated_at = CURRENT_TIMESTAMP
      RETURNING (xmax = 0) as inserted
    `, [
      codeToId, // Use as primary key (id)
      codeToId, // Also store in code_to_cruise_id field
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
    
    if (result.rows[0]?.inserted) {
      progress.stats.cruisesInserted++;
      console.log(`✅ Inserted: Cruise ${cruiseId} sailing ${data.saildate} (ID: ${codeToId})`);
    } else {
      progress.stats.cruisesUpdated++;
      console.log(`📝 Updated: Cruise ${cruiseId} sailing ${data.saildate} (ID: ${codeToId})`);
    }
    
    // Process itinerary (reference by code_to_cruise_id)
    if (data.itinerary && Array.isArray(data.itinerary)) {
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
          day.name || null,
          day.itineraryname || null,
          parseDate(day.arrivedate),
          parseDate(day.departdate),
          day.arrivetime || null,
          day.departtime || null,
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
    
    // Process static prices (reference by code_to_cruise_id)
    if (data.prices && typeof data.prices === 'object') {
      await client.query('DELETE FROM static_prices WHERE cruise_id = $1', [codeToId]);
      
      for (const [rateCode, cabins] of Object.entries(data.prices)) {
        if (typeof cabins !== 'object') continue;
        
        for (const [cabinId, occupancies] of Object.entries(cabins)) {
          if (typeof occupancies !== 'object') continue;
          
          // Handle different pricing structures
          let pricing = occupancies;
          if (typeof occupancies['2'] === 'object') {
            pricing = occupancies['2']; // Default to 2-person occupancy
          }
          
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
            pricing.cabintype || null,
            parseDecimal(pricing.price),
            parseDecimal(pricing.taxes),
            parseDecimal(pricing.ncf),
            parseDecimal(pricing.gratuity)
          ]);
        }
      }
    }
    
    progress.stats.cruisesProcessed++;
    
  } catch (error) {
    console.error(`❌ Error processing cruise ${cruiseId}:`, error.message);
    progress.stats.errors++;
    throw error;
  }
}

/**
 * Process a single file
 */
async function processFile(ftpClient, pgClient, filePath) {
  return new Promise((resolve, reject) => {
    ftpClient.get(filePath, (err, stream) => {
      if (err) return reject(err);
      
      let content = '';
      stream.on('data', chunk => content += chunk);
      stream.on('end', async () => {
        try {
          const data = JSON.parse(content);
          await processCruiseData(pgClient, data, filePath);
          progress.processedFiles.push(filePath);
          saveProgress();
          resolve();
        } catch (e) {
          reject(e);
        }
      });
      stream.on('error', reject);
    });
  });
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
      
      const basePath = `/${YEAR}/${MONTH}`;
      console.log(`📁 Processing ${basePath}\n`);
      
      ftpClient.list(basePath, async (err, lineList) => {
        if (err) {
          console.error('Error:', err);
          ftpClient.end();
          pgClient.release();
          return reject(err);
        }
        
        try {
          for (const lineItem of lineList) {
            if (lineItem.type !== 'd') continue;
            
            const linePath = `${basePath}/${lineItem.name}`;
            console.log(`\n📂 Line ${lineItem.name}`);
            
            await new Promise((resolveShips) => {
              ftpClient.list(linePath, async (err, shipList) => {
                if (err) {
                  resolveShips();
                  return;
                }
                
                for (const shipItem of shipList) {
                  if (shipItem.type !== 'd') continue;
                  
                  const shipPath = `${linePath}/${shipItem.name}`;
                  console.log(`  🚢 Ship ${shipItem.name}`);
                  
                  await new Promise((resolveCruises) => {
                    ftpClient.list(shipPath, async (err, cruiseList) => {
                      if (err) {
                        resolveCruises();
                        return;
                      }
                      
                      let batch = [];
                      for (const cruiseItem of cruiseList) {
                        if (!cruiseItem.name.endsWith('.json')) continue;
                        
                        const filePath = `${shipPath}/${cruiseItem.name}`;
                        
                        // Skip if already processed (unless forced)
                        if (!FORCE_UPDATE && progress.processedFiles.includes(filePath)) {
                          continue;
                        }
                        
                        batch.push(filePath);
                        
                        // Process in batches
                        if (batch.length >= BATCH_SIZE) {
                          for (const file of batch) {
                            try {
                              await processFile(ftpClient, pgClient, file);
                            } catch (error) {
                              console.error(`    ❌ Failed: ${file}`);
                              progress.stats.errors++;
                            }
                          }
                          batch = [];
                        }
                      }
                      
                      // Process remaining files
                      for (const file of batch) {
                        try {
                          await processFile(ftpClient, pgClient, file);
                        } catch (error) {
                          console.error(`    ❌ Failed: ${file}`);
                          progress.stats.errors++;
                        }
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
          
        } catch (error) {
          ftpClient.end();
          pgClient.release();
          reject(error);
        }
      });
    });
    
    ftpClient.on('error', (err) => {
      console.error('FTP error:', err);
      pgClient.release();
      reject(err);
    });
    
    ftpClient.connect(ftpConfig);
  });
}

// Run the sync
sync()
  .then(async () => {
    console.log('\n✅ Sync completed!\n');
    console.log('📊 Final Statistics:');
    console.log(`  Processed: ${progress.stats.cruisesProcessed} cruises`);
    console.log(`  Inserted: ${progress.stats.cruisesInserted} new cruises`);
    console.log(`  Updated: ${progress.stats.cruisesUpdated} existing cruises`);
    console.log(`  Errors: ${progress.stats.errors}`);
    
    // Show sample of data
    const client = await pool.connect();
    
    // Count unique cruises vs total sailings
    const stats = await client.query(`
      SELECT 
        COUNT(DISTINCT code_to_cruise_id) as total_sailings,
        COUNT(DISTINCT CONCAT(cruise_line_id, '-', ship_id, '-', nights, '-', port_ids)) as unique_cruises
      FROM cruises
      WHERE is_active = true
    `);
    
    console.log(`\n📈 Database Statistics:`);
    console.log(`  Total Sailings: ${stats.rows[0].total_sailings}`);
    console.log(`  Unique Cruises: ${stats.rows[0].unique_cruises}`);
    
    client.release();
    await pool.end();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('❌ Sync failed:', error);
    await pool.end();
    process.exit(1);
  });