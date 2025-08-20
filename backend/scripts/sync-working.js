#!/usr/bin/env node

/**
 * Working sync script using Drizzle ORM directly
 * Avoids SQL template literal issues that cause syntax errors
 */

require('dotenv').config();
const FTP = require('ftp');
const fs = require('fs');
const { db } = require('../dist/db/connection');
const { 
  cruises, 
  cruiseLines, 
  ships, 
  ports, 
  regions,
  cheapestPricing,
  priceHistory,
  itineraryItems,
  cabinDefinitions,
  detailedPricing
} = require('../dist/db/schema');
const { eq } = require('drizzle-orm');

console.log('🚢 Traveltek Complete Data Sync (Drizzle ORM Version)');
console.log('======================================================\n');

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
const PROGRESS_FILE = '.sync-drizzle-progress.json';
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
  return isNaN(num) ? null : num.toString();
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
    return isNaN(date.getTime()) ? null : date;
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
 * Process dependencies using Drizzle ORM
 */
async function processDependencies(data) {
  const lineId = toIntegerOrNull(data.lineid) || 1;
  const shipId = toIntegerOrNull(data.shipid) || 1;
  
  // Upsert cruise line
  try {
    await db.insert(cruiseLines).values({
      id: lineId,
      name: data.linename || data.linecontent || `Line ${lineId}`,
      code: 'L' + lineId,
      description: data.linecontent || null,
      isActive: true
    }).onConflictDoUpdate({
      target: cruiseLines.id,
      set: {
        name: data.linename || data.linecontent || `Line ${lineId}`,
        description: data.linecontent || null,
        updatedAt: new Date()
      }
    });
  } catch (e) {
    // Ignore duplicate errors
  }
  
  // Upsert ship with ship content fields
  try {
    const shipData = {
      id: shipId,
      cruiseLineId: lineId,
      name: data.shipname || `Ship ${shipId}`,
      code: 'S' + shipId,
      isActive: true
    };
    
    // Add ship content fields if available
    if (data.shipcontent) {
      const content = data.shipcontent;
      if (content.shipclass) shipData.shipClass = content.shipclass;
      if (content.tonnage) shipData.tonnage = toIntegerOrNull(content.tonnage);
      if (content.totalcabins) shipData.totalCabins = toIntegerOrNull(content.totalcabins);
      if (content.limitof) shipData.capacity = toIntegerOrNull(content.limitof);
      if (content.startrating) shipData.rating = toIntegerOrNull(content.startrating);
      if (content.shortdescription) shipData.description = content.shortdescription;
      if (content.highlights) shipData.highlights = content.highlights;
      if (content.defaultshipimage) shipData.defaultImageUrl = content.defaultshipimage;
      if (content.defaultshipimage2k) shipData.defaultImageUrlHd = content.defaultshipimage2k;
      if (content.shipimages) shipData.images = content.shipimages || [];
      if (content.additsoaly) shipData.additionalInfo = content.additsoaly;
    }
    
    await db.insert(ships).values(shipData).onConflictDoUpdate({
      target: ships.id,
      set: {
        name: shipData.name,
        shipClass: shipData.shipClass,
        tonnage: shipData.tonnage,
        totalCabins: shipData.totalCabins,
        capacity: shipData.capacity,
        rating: shipData.rating,
        description: shipData.description,
        highlights: shipData.highlights,
        defaultImageUrl: shipData.defaultImageUrl,
        defaultImageUrlHd: shipData.defaultImageUrlHd,
        images: shipData.images,
        additionalInfo: shipData.additionalInfo,
        updatedAt: new Date()
      }
    });
  } catch (e) {
    console.log(`   ⚠️  Ship upsert error: ${e.message}`);
  }
  
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
    try {
      await db.insert(ports).values({
        id: portId,
        name: portMapping[portId] || `Port ${portId}`,
        code: 'P' + portId,
        isActive: true
      }).onConflictDoUpdate({
        target: ports.id,
        set: {
          name: portMapping[portId] || `Port ${portId}`,
          updatedAt: new Date()
        }
      });
    } catch (e) {
      // Ignore duplicate errors
    }
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
    try {
      await db.insert(regions).values({
        id: regionId,
        name: regionMapping[regionId] || `Region ${regionId}`,
        code: 'R' + regionId,
        isActive: true
      }).onConflictDoUpdate({
        target: regions.id,
        set: {
          name: regionMapping[regionId] || `Region ${regionId}`,
          updatedAt: new Date()
        }
      });
    } catch (e) {
      // Ignore duplicate errors
    }
  }
}

/**
 * Take price snapshot
 */
async function takePriceSnapshot(cruiseId) {
  try {
    const existing = await db.select()
      .from(cheapestPricing)
      .where(eq(cheapestPricing.cruiseId, cruiseId))
      .limit(1);
    
    if (existing.length > 0) {
      const current = existing[0];
      await db.insert(priceHistory).values({
        cruiseId: cruiseId,
        interiorPrice: current.interiorPrice,
        oceanviewPrice: current.oceanviewPrice,
        balconyPrice: current.balconyPrice,
        suitePrice: current.suitePrice,
        currency: current.currency || 'USD',
        snapshotDate: new Date()
      });
      stats.snapshots++;
    }
  } catch (error) {
    console.log(`   ⚠️  Snapshot failed: ${error.message}`);
  }
}

/**
 * Process cruise data
 */
async function processCruiseData(data, filePath) {
  const cruiseId = toIntegerOrNull(data.cruiseid);
  const sailDate = parseDateField(data.saildate || data.startdate);
  const nights = toIntegerOrNull(data.nights) || 0;
  
  let returnDate = null;
  if (sailDate) {
    returnDate = new Date(sailDate);
    returnDate.setDate(returnDate.getDate() + nights);
  }
  
  const cruiseData = {
    id: cruiseId,
    cruiseLineId: toIntegerOrNull(data.lineid) || 1,
    shipId: toIntegerOrNull(data.shipid) || 1,
    name: data.cruisename || data.name || `Cruise ${cruiseId}`,
    description: data.cruisedescription || data.description || null,
    sailingDate: sailDate,
    returnDate: returnDate,
    nights: nights,
    embarkPortId: toIntegerOrNull(data.startportid),
    disembarkPortId: toIntegerOrNull(data.endportid),
    regionIds: parseArrayField(data.regionids),
    portIds: parseArrayField(data.portids),
    showCruise: toBoolean(data.showCruise),
    isActive: true,
    traveltekCruiseId: cruiseId,
    traveltekFilePath: filePath,
    marketId: toIntegerOrNull(data.marketid),
    ownerId: toIntegerOrNull(data.ownerid),
    cruiseDetails: {
      ports: data.ports || [],
      regions: data.regions || [],
      alternativeDates: data.alternativeDates || [],
      meta: data.meta || {}
    }
  };
  
  try {
    const result = await db.insert(cruises)
      .values(cruiseData)
      .onConflictDoUpdate({
        target: cruises.id,
        set: {
          name: cruiseData.name,
          description: cruiseData.description,
          sailingDate: cruiseData.sailingDate,
          returnDate: cruiseData.returnDate,
          nights: cruiseData.nights,
          embarkPortId: cruiseData.embarkPortId,
          disembarkPortId: cruiseData.disembarkPortId,
          regionIds: cruiseData.regionIds,
          portIds: cruiseData.portIds,
          showCruise: cruiseData.showCruise,
          cruiseDetails: cruiseData.cruiseDetails,
          updatedAt: new Date()
        }
      });
    
    return true;
  } catch (error) {
    console.log(`   ⚠️  Cruise upsert failed: ${error.message}`);
    return false;
  }
}

/**
 * Process itinerary
 */
async function processItinerary(cruiseId, itinerary) {
  if (!itinerary || !Array.isArray(itinerary)) return;
  
  try {
    // Delete existing itinerary
    await db.delete(itineraryItems)
      .where(eq(itineraryItems.cruiseId, cruiseId));
    
    // Insert new items
    for (let i = 0; i < itinerary.length; i++) {
      const day = itinerary[i];
      if (!day) continue;
      
      await db.insert(itineraryItems).values({
        cruiseId: cruiseId,
        dayNumber: i + 1,
        portId: toIntegerOrNull(day.portid),
        arrivalTime: day.arrivaltime || null,
        departureTime: day.departuretime || null,
        description: day.description || day.portname || null,
        isSeaDay: day.portid === 0 || day.portname === 'At Sea'
      });
    }
    stats.itineraries++;
  } catch (error) {
    console.log(`   ⚠️  Itinerary failed: ${error.message}`);
  }
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
    
    try {
      await db.insert(cabinDefinitions).values({
        shipId: shipIdNum,
        cabinCode: cabinCode,
        cabinType: cabin.type || cabin.category || 'Standard',
        description: cabin.description || null,
        maxOccupancy: toIntegerOrNull(cabin.maxoccupancy || cabin.capacity),
        deckNumber: toIntegerOrNull(cabin.deck),
        amenities: cabin.amenities || [],
        sizeSqft: toIntegerOrNull(cabin.size),
        hasBalcony: cabin.balcony === true || cabin.hasBalcony === true,
        hasWindow: cabin.window === true || cabin.hasWindow === true
      }).onConflictDoNothing();
      stats.cabins++;
    } catch (error) {
      // Ignore duplicate errors
    }
  }
}

/**
 * Process detailed pricing
 */
async function processDetailedPricing(cruiseId, prices) {
  if (!prices || typeof prices !== 'object') return;
  
  try {
    // Delete existing pricing
    await db.delete(detailedPricing)
      .where(eq(detailedPricing.cruiseId, cruiseId));
    
    // Process each rate code
    for (const [rateCode, rateData] of Object.entries(prices)) {
      if (!rateData || typeof rateData !== 'object') continue;
      
      // Process each cabin category
      for (const [cabinCode, priceData] of Object.entries(rateData)) {
        if (!priceData || typeof priceData !== 'object') continue;
        
        const price = toDecimalOrNull(priceData.price || priceData.total);
        if (price === null) continue;
        
        await db.insert(detailedPricing).values({
          cruiseId: cruiseId,
          rateCode: rateCode,
          cabinCode: cabinCode,
          price: price,
          currency: priceData.currency || 'USD',
          occupancy: toIntegerOrNull(priceData.occupancy) || 2,
          includesTaxes: priceData.includesTaxes === true,
          includesPortCharges: priceData.includesPortCharges === true,
          bookingClass: priceData.bookingClass || null
        });
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
      interiorPrice: null,
      oceanviewPrice: null,
      balconyPrice: null,
      suitePrice: null
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
            const fieldName = type + 'Price';
            if (price && (!cheapestPrices[fieldName] || parseFloat(price) < parseFloat(cheapestPrices[fieldName]))) {
              cheapestPrices[fieldName] = price;
            }
          }
        }
      }
    }
    
    // Upsert cheapest pricing
    await db.insert(cheapestPricing).values({
      cruiseId: cruiseId,
      interiorPrice: cheapestPrices.interiorPrice,
      oceanviewPrice: cheapestPrices.oceanviewPrice,
      balconyPrice: cheapestPrices.balconyPrice,
      suitePrice: cheapestPrices.suitePrice,
      currency: 'USD'
    }).onConflictDoUpdate({
      target: cheapestPricing.cruiseId,
      set: {
        interiorPrice: cheapestPrices.interiorPrice,
        oceanviewPrice: cheapestPrices.oceanviewPrice,
        balconyPrice: cheapestPrices.balconyPrice,
        suitePrice: cheapestPrices.suitePrice,
        updatedAt: new Date()
      }
    });
    
    stats.pricing++;
  } catch (error) {
    console.log(`   ⚠️  Pricing failed: ${error.message}`);
  }
}

/**
 * Process a single cruise file
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
    const existing = await db.select()
      .from(cruises)
      .where(eq(cruises.id, cruiseId))
      .limit(1);
    
    const isUpdate = existing.length > 0;
    
    if (isUpdate) {
      console.log(`   🔄 Updating cruise ${cruiseId}`);
      await takePriceSnapshot(cruiseId);
    } else {
      console.log(`   ✨ New cruise ${cruiseId}`);
    }
    
    // Process all data (including ship content in dependencies)
    await processDependencies(data);
    
    // Process cruise
    const wasSuccessful = await processCruiseData(data, filePath);
    
    if (wasSuccessful) {
      if (isUpdate) {
        stats.updated++;
      } else {
        stats.inserted++;
      }
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
          
          // List cruise lines
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
                
                // List ships
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
    console.log(`   • Cabins: ${stats.cabins} definitions added`);
    console.log(`   • Pricing: ${stats.pricing} cruises with detailed pricing`);
    console.log(`   • Snapshots: ${stats.snapshots} price history records`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  });