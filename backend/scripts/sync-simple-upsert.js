#!/usr/bin/env node

/**
 * Simplified UPSERT sync script that works with Drizzle ORM
 * Uses simpler SQL syntax to avoid template literal issues
 */

require('dotenv').config();
const FTP = require('ftp');
const fs = require('fs');
const { db } = require('../dist/db/connection');
const { sql } = require('drizzle-orm');

console.log('🚢 Complete Traveltek Data Sync (Simple UPSERT)');
console.log('================================================\n');

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
const PROGRESS_FILE = '.sync-simple-progress.json';
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
  cabins: 0,
  pricing: 0,
  snapshots: 0
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

function toBoolean(value) {
  if (value === 'Y' || value === 'true' || value === true || value === 1) return true;
  if (value === 'N' || value === 'false' || value === false || value === 0) return false;
  return null;
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
    return isNaN(date.getTime()) ? null : date.toISOString();
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
 * Simple UPSERT using separate check and insert/update
 */
async function simpleUpsert(table, id, insertData, updateData) {
  try {
    // Check if exists
    const existing = await db.execute(sql`
      SELECT id FROM ${sql.identifier(table)} WHERE id = ${id}
    `);
    
    if (existing.rows && existing.rows.length > 0) {
      // Update
      const setClause = Object.entries(updateData)
        .map(([key, value]) => sql`${sql.identifier(key)} = ${value}`)
        .reduce((a, b) => sql`${a}, ${b}`);
      
      await db.execute(sql`
        UPDATE ${sql.identifier(table)}
        SET ${setClause}, updated_at = NOW()
        WHERE id = ${id}
      `);
      return 'updated';
    } else {
      // Insert
      const columns = Object.keys(insertData);
      const values = Object.values(insertData);
      
      const columnList = columns.map(c => sql.identifier(c)).reduce((a, b) => sql`${a}, ${b}`);
      const valueList = values.reduce((a, b) => sql`${a}, ${b}`);
      
      await db.execute(sql`
        INSERT INTO ${sql.identifier(table)} (${columnList})
        VALUES (${valueList})
      `);
      return 'inserted';
    }
  } catch (error) {
    // If we get a unique constraint error, it means another process inserted it
    // Just try to update
    if (error.message.includes('duplicate key')) {
      const setClause = Object.entries(updateData)
        .map(([key, value]) => sql`${sql.identifier(key)} = ${value}`)
        .reduce((a, b) => sql`${a}, ${b}`);
      
      await db.execute(sql`
        UPDATE ${sql.identifier(table)}
        SET ${setClause}, updated_at = NOW()
        WHERE id = ${id}
      `);
      return 'updated';
    }
    throw error;
  }
}

/**
 * Process dependencies
 */
async function processDependencies(data) {
  const lineId = toIntegerOrNull(data.lineid) || 1;
  const shipId = toIntegerOrNull(data.shipid) || 1;
  
  // Upsert cruise line
  await simpleUpsert('cruise_lines', lineId, {
    id: lineId,
    name: data.linename || data.linecontent || `Line ${lineId}`,
    code: 'L' + lineId,
    description: data.linecontent || null,
    is_active: true
  }, {
    name: data.linename || data.linecontent || `Line ${lineId}`,
    description: data.linecontent || null
  });
  
  // Upsert ship
  await simpleUpsert('ships', shipId, {
    id: shipId,
    cruise_line_id: lineId,
    name: data.shipname || `Ship ${shipId}`,
    code: 'S' + shipId,
    is_active: true
  }, {
    name: data.shipname || `Ship ${shipId}`
  });
  
  // Process ports
  const portMapping = {};
  if (data.ports && Array.isArray(data.ports)) {
    const portIds = parseArrayField(data.portids);
    for (let i = 0; i < portIds.length && i < data.ports.length; i++) {
      portMapping[portIds[i]] = data.ports[i];
    }
  }
  
  const allPortIds = new Set([
    toIntegerOrNull(data.startportid),
    toIntegerOrNull(data.endportid),
    ...parseArrayField(data.portids)
  ].filter(id => id !== null));
  
  for (const portId of allPortIds) {
    await simpleUpsert('ports', portId, {
      id: portId,
      name: portMapping[portId] || `Port ${portId}`,
      code: 'P' + portId,
      is_active: true
    }, {
      name: portMapping[portId] || `Port ${portId}`
    });
  }
  
  // Process regions
  const regionMapping = {};
  if (data.regions && Array.isArray(data.regions)) {
    const regionIds = parseArrayField(data.regionids);
    for (let i = 0; i < regionIds.length && i < data.regions.length; i++) {
      regionMapping[regionIds[i]] = data.regions[i];
    }
  }
  
  const regionIds = parseArrayField(data.regionids);
  for (const regionId of regionIds) {
    await simpleUpsert('regions', regionId, {
      id: regionId,
      name: regionMapping[regionId] || `Region ${regionId}`,
      code: 'R' + regionId,
      is_active: true
    }, {
      name: regionMapping[regionId] || `Region ${regionId}`
    });
  }
}

/**
 * Take price snapshot before updating
 */
async function takePriceSnapshot(cruiseId) {
  try {
    // Get current pricing
    const pricing = await db.execute(sql`
      SELECT * FROM cheapest_pricing WHERE cruise_id = ${cruiseId}
    `);
    
    if (pricing.rows && pricing.rows.length > 0) {
      const current = pricing.rows[0];
      await db.execute(sql`
        INSERT INTO price_history (
          cruise_id, interior_price, oceanview_price, 
          balcony_price, suite_price, currency, snapshot_date
        ) VALUES (
          ${cruiseId},
          ${current.interior_price},
          ${current.oceanview_price},
          ${current.balcony_price},
          ${current.suite_price},
          ${current.currency || 'USD'},
          NOW()
        )
      `);
      stats.snapshots++;
    }
  } catch (error) {
    console.log(`   ⚠️  Snapshot failed: ${error.message}`);
  }
}

/**
 * Process cruise data
 */
async function processCruiseData(data, filePath, isUpdate) {
  const cruiseId = toIntegerOrNull(data.cruiseid);
  const sailDate = parseDateField(data.saildate || data.startdate);
  const nights = toIntegerOrNull(data.nights) || 0;
  const returnDate = new Date(sailDate);
  returnDate.setDate(returnDate.getDate() + nights);
  
  const cruiseData = {
    id: cruiseId,
    cruise_line_id: toIntegerOrNull(data.lineid) || 1,
    ship_id: toIntegerOrNull(data.shipid) || 1,
    name: data.cruisename || data.name || `Cruise ${cruiseId}`,
    description: data.cruisedescription || data.description || null,
    sailing_date: sailDate,
    return_date: returnDate.toISOString(),
    nights: nights,
    embark_port_id: toIntegerOrNull(data.startportid),
    disembark_port_id: toIntegerOrNull(data.endportid),
    region_ids: JSON.stringify(parseArrayField(data.regionids)),
    port_ids: JSON.stringify(parseArrayField(data.portids)),
    show_cruise: toBoolean(data.showCruise),
    is_active: true,
    traveltek_cruise_id: cruiseId,
    traveltek_file_path: filePath,
    market_id: toIntegerOrNull(data.marketid),
    owner_id: toIntegerOrNull(data.ownerid),
    cruise_details: JSON.stringify({
      ports: data.ports || [],
      regions: data.regions || [],
      alternativeDates: data.alternativeDates || [],
      meta: data.meta || {}
    })
  };
  
  const result = await simpleUpsert('cruises', cruiseId, cruiseData, {
    name: cruiseData.name,
    description: cruiseData.description,
    sailing_date: cruiseData.sailing_date,
    return_date: cruiseData.return_date,
    nights: cruiseData.nights,
    embark_port_id: cruiseData.embark_port_id,
    disembark_port_id: cruiseData.disembark_port_id,
    region_ids: cruiseData.region_ids,
    port_ids: cruiseData.port_ids,
    show_cruise: cruiseData.show_cruise,
    cruise_details: cruiseData.cruise_details
  });
  
  return result === 'updated';
}

/**
 * Process itinerary
 */
async function processItinerary(cruiseId, itinerary) {
  if (!itinerary || !Array.isArray(itinerary)) return;
  
  // Delete existing itinerary items
  await db.execute(sql`
    DELETE FROM itinerary_items WHERE cruise_id = ${cruiseId}
  `);
  
  // Insert new itinerary items
  for (let i = 0; i < itinerary.length; i++) {
    const day = itinerary[i];
    if (!day) continue;
    
    await db.execute(sql`
      INSERT INTO itinerary_items (
        cruise_id, day_number, port_id, arrival_time,
        departure_time, description, is_sea_day
      ) VALUES (
        ${cruiseId},
        ${i + 1},
        ${toIntegerOrNull(day.portid)},
        ${day.arrivaltime || null},
        ${day.departuretime || null},
        ${day.description || day.portname || null},
        ${day.portid === 0 || day.portname === 'At Sea'}
      )
    `);
  }
  stats.itineraries++;
}

/**
 * Process cabin definitions
 */
async function processCabins(shipId, cabins) {
  if (!cabins || typeof cabins !== 'object') return;
  
  const shipIdNum = toIntegerOrNull(shipId);
  if (!shipIdNum) return;
  
  for (const [cabinCode, cabin] of Object.entries(cabins)) {
    if (!cabin || typeof cabin !== 'object') continue;
    
    // Check if cabin exists
    const existing = await db.execute(sql`
      SELECT id FROM cabin_definitions
      WHERE ship_id = ${shipIdNum} AND cabin_code = ${cabinCode}
    `);
    
    if (!existing.rows || existing.rows.length === 0) {
      await db.execute(sql`
        INSERT INTO cabin_definitions (
          ship_id, cabin_code, cabin_type, description,
          max_occupancy, deck_number, amenities, size_sqft,
          has_balcony, has_window
        ) VALUES (
          ${shipIdNum},
          ${cabinCode},
          ${cabin.type || cabin.category || 'Standard'},
          ${cabin.description || null},
          ${toIntegerOrNull(cabin.maxoccupancy || cabin.capacity)},
          ${toIntegerOrNull(cabin.deck)},
          ${JSON.stringify(cabin.amenities || [])},
          ${toIntegerOrNull(cabin.size)},
          ${cabin.balcony === true || cabin.hasBalcony === true},
          ${cabin.window === true || cabin.hasWindow === true}
        )
      `);
      stats.cabins++;
    }
  }
}

/**
 * Process detailed pricing
 */
async function processDetailedPricing(cruiseId, prices) {
  if (!prices || typeof prices !== 'object') return;
  
  // Delete existing detailed pricing
  await db.execute(sql`
    DELETE FROM detailed_pricing WHERE cruise_id = ${cruiseId}
  `);
  
  // Process each rate code
  for (const [rateCode, rateData] of Object.entries(prices)) {
    if (!rateData || typeof rateData !== 'object') continue;
    
    // Process each cabin category
    for (const [cabinCode, priceData] of Object.entries(rateData)) {
      if (!priceData || typeof priceData !== 'object') continue;
      
      const price = toDecimalOrNull(priceData.price || priceData.total);
      if (price === null) continue;
      
      await db.execute(sql`
        INSERT INTO detailed_pricing (
          cruise_id, rate_code, cabin_code, price,
          currency, occupancy, includes_taxes,
          includes_port_charges, booking_class
        ) VALUES (
          ${cruiseId},
          ${rateCode},
          ${cabinCode},
          ${price},
          ${priceData.currency || 'USD'},
          ${toIntegerOrNull(priceData.occupancy) || 2},
          ${priceData.includesTaxes === true},
          ${priceData.includesPortCharges === true},
          ${priceData.bookingClass || null}
        )
      `);
    }
  }
  
  // Update cheapest pricing
  const cabinTypes = {
    'interior': ['I', 'INT', 'INTERIOR', 'IN'],
    'oceanview': ['O', 'OV', 'OCEANVIEW', 'OCEAN'],
    'balcony': ['B', 'BA', 'BALCONY', 'BAL'],
    'suite': ['S', 'SU', 'SUITE', 'ST']
  };
  
  const cheapestPrices = {
    interior: null,
    oceanview: null,
    balcony: null,
    suite: null
  };
  
  // Find cheapest price for each cabin type
  for (const [type, codes] of Object.entries(cabinTypes)) {
    for (const rateData of Object.values(prices)) {
      if (!rateData) continue;
      for (const [cabinCode, priceData] of Object.entries(rateData)) {
        if (!priceData) continue;
        const upperCode = cabinCode.toUpperCase();
        if (codes.some(c => upperCode.includes(c))) {
          const price = toDecimalOrNull(priceData.price || priceData.total);
          if (price && (!cheapestPrices[type] || price < cheapestPrices[type])) {
            cheapestPrices[type] = price;
          }
        }
      }
    }
  }
  
  // Update cheapest pricing table
  await simpleUpsert('cheapest_pricing', cruiseId, {
    cruise_id: cruiseId,
    interior_price: cheapestPrices.interior,
    oceanview_price: cheapestPrices.oceanview,
    balcony_price: cheapestPrices.balcony,
    suite_price: cheapestPrices.suite,
    currency: 'USD'
  }, {
    interior_price: cheapestPrices.interior,
    oceanview_price: cheapestPrices.oceanview,
    balcony_price: cheapestPrices.balcony,
    suite_price: cheapestPrices.suite
  });
  
  stats.pricing++;
}

/**
 * Process a single cruise file with complete data
 */
async function processCompleteCruise(client, filePath) {
  try {
    stats.processed++;
    
    // Skip if already processed
    if (progress[filePath]) {
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
    
    // Check if cruise exists
    const existing = await db.execute(sql`
      SELECT id FROM cruises WHERE id = ${cruiseId}
    `);
    const isUpdate = existing.rows && existing.rows.length > 0;
    
    if (isUpdate) {
      console.log(`   🔄 Updating cruise ${cruiseId}`);
      // Take price snapshot before updating
      await takePriceSnapshot(cruiseId);
    } else {
      console.log(`   ✨ New cruise ${cruiseId}`);
    }
    
    // Process all data
    await processDependencies(data);
    
    // Process ship content if available
    if (data.shipcontent) {
      const shipId = toIntegerOrNull(data.shipid);
      if (shipId) {
        await db.execute(sql`
          UPDATE ships 
          SET ship_content = ${JSON.stringify(data.shipcontent)},
              updated_at = NOW()
          WHERE id = ${shipId}
        `);
      }
    }
    
    // Process main cruise data
    const wasUpdate = await processCruiseData(data, filePath, isUpdate);
    
    if (wasUpdate) {
      stats.updated++;
    } else {
      stats.inserted++;
    }
    
    // Process additional data
    if (data.itinerary) {
      await processItinerary(cruiseId, data.itinerary);
    }
    
    if (data.cabins) {
      await processCabins(data.shipid, data.cabins);
    }
    
    if (data.prices) {
      await processDetailedPricing(cruiseId, data.prices);
    }
    
    // Mark as processed
    progress[filePath] = {
      cruiseId,
      processed: new Date().toISOString(),
      updated: wasUpdate
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
 * Process a directory of cruise files
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
          
          // List cruise lines in this month
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
                
                // List ships in this cruise line
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

// Run the sync
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
    console.log(`   • Cabins: ${stats.cabins} definitions added`);
    console.log(`   • Pricing: ${stats.pricing} cruises with detailed pricing`);
    console.log(`   • Snapshots: ${stats.snapshots} price history records`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  });