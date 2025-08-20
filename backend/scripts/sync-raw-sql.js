#!/usr/bin/env node

/**
 * Raw SQL sync script that avoids all Drizzle ORM issues
 * Uses direct SQL with proper UPSERT syntax
 */

require('dotenv').config();
const FTP = require('ftp');
const fs = require('fs');
const { db } = require('../dist/db/connection');
const { sql } = require('drizzle-orm');

console.log('🚢 Traveltek Complete Data Sync (Raw SQL)');
console.log('=========================================\n');

const ftpConfig = {
  host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
  user: process.env.TRAVELTEK_FTP_USER,
  password: process.env.TRAVELTEK_FTP_PASSWORD,
  port: 21,
  secure: false,
  connTimeout: 30000,
  pasvTimeout: 30000
};

// Progress tracking
const PROGRESS_FILE = '.sync-raw-sql.json';
let progress = {};
if (fs.existsSync(PROGRESS_FILE)) {
  progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
}

// Statistics
let stats = {
  processed: 0,
  inserted: 0,
  updated: 0,
  failed: 0,
  itineraries: 0,
  pricing: 0
};

// Data converters
function toIntegerOrNull(value) {
  if (value === null || value === undefined || value === '' || value === 'system') {
    return null;
  }
  const num = Number(value);
  return isNaN(num) ? null : Math.floor(num);
}

function toDecimalOrNull(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'object') {
    return null;
  }
  const num = Number(value);
  return isNaN(num) ? null : num;
}

function parseArrayField(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(v => toIntegerOrNull(v)).filter(v => v !== null);
  if (typeof value === 'string') {
    return value.split(',').map(v => toIntegerOrNull(v.trim())).filter(v => v !== null);
  }
  return [];
}

function parseDateField(value) {
  if (!value) return null;
  try {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
  } catch (e) {
    return null;
  }
}

// Save progress
function saveProgress() {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// Download file from FTP
async function downloadFile(client, filePath) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Download timeout')), 20000);
    
    client.get(filePath, (err, stream) => {
      if (err) {
        clearTimeout(timeout);
        reject(err);
        return;
      }
      
      let data = '';
      stream.on('data', chunk => data += chunk);
      stream.on('end', () => {
        clearTimeout(timeout);
        try {
          resolve(JSON.parse(data));
        } catch (parseErr) {
          reject(parseErr);
        }
      });
      stream.on('error', err => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  });
}

/**
 * Process all cruise data using raw SQL
 */
async function processCompleteCruise(client, filePath) {
  try {
    stats.processed++;
    
    // Skip if already processed (unless FORCE_UPDATE is set)
    if (progress[filePath] && process.env.FORCE_UPDATE !== 'true') {
      console.log(`   ⏭️  Already processed: ${filePath}`);
      return;
    }
    
    console.log(`   📥 Downloading: ${filePath}`);
    const data = await downloadFile(client, filePath);
    
    const cruiseId = toIntegerOrNull(data.cruiseid);
    if (!cruiseId) {
      console.log(`   ⚠️  Invalid cruise ID in ${filePath}`);
      return;
    }
    
    // Check if exists
    const existingResult = await db.execute(sql`SELECT id FROM cruises WHERE id = ${cruiseId}`);
    const isUpdate = existingResult.rows && existingResult.rows.length > 0;
    
    if (isUpdate) {
      console.log(`   🔄 Updating cruise ${cruiseId}`);
    } else {
      console.log(`   ✨ New cruise ${cruiseId}`);
    }
    
    // 1. Upsert cruise line
    const lineId = toIntegerOrNull(data.lineid) || 1;
    await db.execute(sql`
      INSERT INTO cruise_lines (id, name, code, is_active, created_at, updated_at)
      VALUES (${lineId}, ${data.linename || `Line ${lineId}`}, ${'L' + lineId}, true, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
    `);
    
    // 2. Upsert ship
    const shipId = toIntegerOrNull(data.shipid) || 1;
    await db.execute(sql`
      INSERT INTO ships (id, cruise_line_id, name, code, is_active, created_at, updated_at)
      VALUES (${shipId}, ${lineId}, ${data.shipname || `Ship ${shipId}`}, ${'S' + shipId}, true, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
    `);
    
    // 3. Process ports
    const allPortIds = new Set([
      toIntegerOrNull(data.startportid),
      toIntegerOrNull(data.endportid),
      ...parseArrayField(data.portids)
    ].filter(id => id !== null));
    
    const portMapping = {};
    if (data.ports && Array.isArray(data.ports)) {
      const portIds = parseArrayField(data.portids);
      for (let i = 0; i < portIds.length && i < data.ports.length; i++) {
        portMapping[portIds[i]] = data.ports[i];
      }
    }
    
    for (const portId of allPortIds) {
      await db.execute(sql`
        INSERT INTO ports (id, name, code, is_active, created_at, updated_at)
        VALUES (${portId}, ${portMapping[portId] || `Port ${portId}`}, ${'P' + portId}, true, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET name = COALESCE(EXCLUDED.name, ports.name), updated_at = NOW()
      `);
    }
    
    // 4. Process regions
    const regionIds = parseArrayField(data.regionids);
    const regionMapping = {};
    if (data.regions && Array.isArray(data.regions)) {
      for (let i = 0; i < regionIds.length && i < data.regions.length; i++) {
        regionMapping[regionIds[i]] = data.regions[i];
      }
    }
    
    for (const regionId of regionIds) {
      await db.execute(sql`
        INSERT INTO regions (id, name, code, is_active, created_at, updated_at)
        VALUES (${regionId}, ${regionMapping[regionId] || `Region ${regionId}`}, ${'R' + regionId}, true, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET name = COALESCE(EXCLUDED.name, regions.name), updated_at = NOW()
      `);
    }
    
    // 5. Upsert main cruise
    const sailDate = parseDateField(data.saildate || data.startdate);
    const nights = toIntegerOrNull(data.nights) || 0;
    let returnDate = null;
    if (sailDate) {
      const returnDateObj = new Date(sailDate);
      returnDateObj.setDate(returnDateObj.getDate() + nights);
      returnDate = returnDateObj.toISOString().split('T')[0];
    }
    
    await db.execute(sql`
      INSERT INTO cruises (
        id, code_to_cruise_id, cruise_line_id, ship_id, name, description,
        sailing_date, return_date, nights, embark_port_id, disembark_port_id,
        region_ids, port_ids, show_cruise, is_active, traveltek_cruise_id,
        traveltek_file_path, market_id, owner_id, cruise_details,
        created_at, updated_at
      )
      VALUES (
        ${cruiseId}, ${data.codetocruiseid || String(cruiseId)}, ${lineId}, ${shipId},
        ${data.cruisename || data.name || `Cruise ${cruiseId}`},
        ${data.cruisedescription || data.description}, ${sailDate}, ${returnDate}, ${nights},
        ${toIntegerOrNull(data.startportid)}, ${toIntegerOrNull(data.endportid)},
        ${JSON.stringify(regionIds)}, ${JSON.stringify(parseArrayField(data.portids))},
        ${data.showCruise === 'Y'}, true, ${cruiseId}, ${filePath},
        ${toIntegerOrNull(data.marketid)}, ${toIntegerOrNull(data.ownerid)},
        ${JSON.stringify({
          ports: data.ports || [],
          regions: data.regions || [],
          meta: data.meta || {}
        })}, NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        sailing_date = EXCLUDED.sailing_date,
        return_date = EXCLUDED.return_date,
        nights = EXCLUDED.nights,
        embark_port_id = EXCLUDED.embark_port_id,
        disembark_port_id = EXCLUDED.disembark_port_id,
        region_ids = EXCLUDED.region_ids,
        port_ids = EXCLUDED.port_ids,
        show_cruise = EXCLUDED.show_cruise,
        cruise_details = EXCLUDED.cruise_details,
        updated_at = NOW()
    `);
    
    if (isUpdate) {
      stats.updated++;
    } else {
      stats.inserted++;
    }
    
    // 6. Process itinerary
    if (data.itinerary && Array.isArray(data.itinerary) && sailDate) {
      await db.execute(sql`DELETE FROM itineraries WHERE cruise_id = ${cruiseId}`);
      
      const startDate = new Date(sailDate);
      for (let i = 0; i < data.itinerary.length; i++) {
        const day = data.itinerary[i];
        if (!day) continue;
        
        const dayDate = new Date(startDate);
        dayDate.setDate(dayDate.getDate() + i);
        const dayDateStr = dayDate.toISOString().split('T')[0];
        
        const portId = toIntegerOrNull(day.portid);
        
        await db.execute(sql`
          INSERT INTO itineraries (
            id, cruise_id, day_number, date, port_name, port_id,
            arrival_time, departure_time, status, overnight, description,
            activities, shore_excursions, created_at
          ) VALUES (
            gen_random_uuid(), ${cruiseId}, ${i + 1}, ${dayDateStr}, 
            ${day.portname || day.port || 'At Sea'},
            ${(portId === 0 || !portId) ? null : portId},
            ${day.arrivaltime || day.arrive}, ${day.departuretime || day.depart},
            ${i === 0 ? 'embark' : (i === data.itinerary.length - 1 ? 'disembark' : 'port')},
            false, ${day.description}, '[]', '[]', NOW()
          )
        `);
      }
      stats.itineraries++;
    }
    
    // 7. Process pricing
    if (data.prices && typeof data.prices === 'object') {
      await db.execute(sql`DELETE FROM pricing WHERE cruise_id = ${cruiseId}`);
      
      const cheapestPrices = { interior: null, oceanview: null, balcony: null, suite: null };
      
      for (const [rateCode, rateData] of Object.entries(data.prices)) {
        if (!rateData || typeof rateData !== 'object') continue;
        
        for (const [cabinCode, cabinData] of Object.entries(rateData)) {
          if (!cabinData || typeof cabinData !== 'object') continue;
          
          for (const [occupancyCode, priceData] of Object.entries(cabinData)) {
            if (!priceData || typeof priceData !== 'object') continue;
            
            const basePrice = toDecimalOrNull(priceData.price || priceData.total);
            if (basePrice === null) continue;
            
            // Insert pricing record
            await db.execute(sql`
              INSERT INTO pricing (
                id, cruise_id, rate_code, cabin_code, occupancy_code,
                base_price, currency, pricing_type, is_available, created_at, updated_at
              ) VALUES (
                gen_random_uuid(), ${cruiseId}, ${rateCode}, ${cabinCode}, ${occupancyCode},
                ${basePrice}, ${priceData.currency || 'USD'}, 'STATIC', true, NOW(), NOW()
              )
            `);
            
            // Track cheapest prices
            const upperCode = cabinCode.toUpperCase();
            if (['I', 'INT', 'INTERIOR', 'IN'].some(c => upperCode.includes(c))) {
              if (!cheapestPrices.interior || parseFloat(basePrice) < parseFloat(cheapestPrices.interior)) {
                cheapestPrices.interior = basePrice;
              }
            } else if (['O', 'OV', 'OCEANVIEW', 'OCEAN'].some(c => upperCode.includes(c))) {
              if (!cheapestPrices.oceanview || parseFloat(basePrice) < parseFloat(cheapestPrices.oceanview)) {
                cheapestPrices.oceanview = basePrice;
              }
            } else if (['B', 'BA', 'BALCONY', 'BAL'].some(c => upperCode.includes(c))) {
              if (!cheapestPrices.balcony || parseFloat(basePrice) < parseFloat(cheapestPrices.balcony)) {
                cheapestPrices.balcony = basePrice;
              }
            } else if (['S', 'SU', 'SUITE', 'ST'].some(c => upperCode.includes(c))) {
              if (!cheapestPrices.suite || parseFloat(basePrice) < parseFloat(cheapestPrices.suite)) {
                cheapestPrices.suite = basePrice;
              }
            }
          }
        }
      }
      
      // Update cheapest pricing
      await db.execute(sql`
        INSERT INTO cheapest_pricing (id, cruise_id, interior_price, oceanview_price, balcony_price, suite_price, currency, created_at, updated_at)
        VALUES (gen_random_uuid(), ${cruiseId}, ${cheapestPrices.interior}, ${cheapestPrices.oceanview}, ${cheapestPrices.balcony}, ${cheapestPrices.suite}, 'USD', NOW(), NOW())
        ON CONFLICT (cruise_id) DO UPDATE SET
          interior_price = EXCLUDED.interior_price,
          oceanview_price = EXCLUDED.oceanview_price,
          balcony_price = EXCLUDED.balcony_price,
          suite_price = EXCLUDED.suite_price,
          updated_at = NOW()
      `);
      stats.pricing++;
    }
    
    // Mark as processed
    progress[filePath] = {
      cruiseId,
      processed: new Date().toISOString(),
      updated: isUpdate
    };
    
    // Save progress every 10 cruises
    if (stats.processed % 10 === 0) {
      saveProgress();
      console.log(`   📊 Progress: ${stats.inserted} new, ${stats.updated} updated, ${stats.failed} failed`);
    }
    
  } catch (error) {
    stats.failed++;
    console.log(`   ❌ Failed: ${error.message}`);
  }
}

/**
 * Process a directory
 */
async function processDirectory(client, dirPath) {
  return new Promise((resolve) => {
    client.list(dirPath, (err, list) => {
      if (err) {
        console.log(`   ⚠️  Could not list ${dirPath}: ${err.message}`);
        resolve();
        return;
      }
      
      const jsonFiles = list.filter(item => item.name.endsWith('.json'));
      console.log(`   📁 Found ${jsonFiles.length} JSON files in ${dirPath}`);
      
      (async () => {
        for (const file of jsonFiles) {
          const filePath = `${dirPath}/${file.name}`;
          await processCompleteCruise(client, filePath);
        }
        resolve();
      })();
    });
  });
}

/**
 * Main sync function
 */
async function sync() {
  console.log('📝 Configuration:');
  console.log(`   Host: ${ftpConfig.host}`);
  console.log(`   User: ${ftpConfig.user}`);
  console.log(`   Force Update: ${process.env.FORCE_UPDATE === 'true' ? 'Yes' : 'No'}`);
  console.log(`   Years: ${process.env.SYNC_YEARS || '2025,2026'}\n`);
  
  const client = new FTP();
  
  return new Promise((resolve, reject) => {
    client.on('ready', async () => {
      console.log('✅ Connected to FTP server\n');
      
      const years = (process.env.SYNC_YEARS || '2025,2026').split(',');
      const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
      
      for (const year of years) {
        console.log(`📅 Processing year ${year}...`);
        
        for (const month of months) {
          const monthPath = `/${year}/${month}`;
          
          await new Promise((monthResolve) => {
            client.list(monthPath, async (err, lineList) => {
              if (err) {
                console.log(`   ⏭️  No data for ${monthPath}`);
                monthResolve();
                return;
              }
              
              const lineDirs = lineList.filter(item => item.type === 'd');
              console.log(`   📂 Month ${month}: ${lineDirs.length} cruise lines`);
              
              for (const lineDir of lineDirs) {
                const linePath = `${monthPath}/${lineDir.name}`;
                
                await new Promise((lineResolve) => {
                  client.list(linePath, async (err, shipList) => {
                    if (err) {
                      lineResolve();
                      return;
                    }
                    
                    const shipDirs = shipList.filter(item => item.type === 'd');
                    
                    for (const shipDir of shipDirs) {
                      const shipPath = `${linePath}/${shipDir.name}`;
                      await processDirectory(client, shipPath);
                    }
                    
                    lineResolve();
                  });
                });
              }
              
              monthResolve();
            });
          });
        }
      }
      
      client.end();
      resolve();
    });
    
    client.on('error', (err) => {
      console.error('❌ FTP Error:', err.message);
      reject(err);
    });
    
    console.log('🔄 Connecting to FTP server...');
    client.connect(ftpConfig);
  });
}

// Run sync
sync()
  .then(() => {
    saveProgress();
    console.log('\n✅ Sync Complete!');
    console.log('📊 Final Statistics:');
    console.log(`   • Processed: ${stats.processed} files`);
    console.log(`   • Inserted: ${stats.inserted} new cruises`);
    console.log(`   • Updated: ${stats.updated} existing cruises`);
    console.log(`   • Failed: ${stats.failed} files`);
    console.log(`   • Itineraries: ${stats.itineraries} processed`);
    console.log(`   • Pricing: ${stats.pricing} cruises with detailed pricing`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  });