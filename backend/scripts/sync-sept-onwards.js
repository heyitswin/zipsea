#!/usr/bin/env node

/**
 * Correct Drizzle ORM sync script using the same setup as the app
 * Uses postgres-js client like the main application
 */

require('dotenv').config();
const FTP = require('ftp');
const fs = require('fs');
const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { eq, sql } = require('drizzle-orm');

// Import schema the same way as the app
const schema = require('../dist/db/schema');

console.log('🚢 Traveltek Data Sync (Correct Drizzle Setup)');
console.log('===============================================\n');

// Create database connection the same way as the app
const dbSql = postgres(process.env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const db = drizzle(dbSql, { schema });

console.log('✅ Database connection created');
console.log('📦 Schema imported:', Object.keys(schema).length, 'exports');

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
const PROGRESS_FILE = '.sync-drizzle-correct.json';
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
  pricing: 0,
  snapshots: 0
};

// Utility to remove undefined values from objects (Drizzle best practice)
function removeUndefinedValues(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== undefined)
  );
}

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

function parseArrayField(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(v => toIntegerOrNull(v)).filter(v => v !== null);
  if (typeof value === 'string') {
    // Handle comma-separated strings (the actual format from Traveltek)
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
 * Process dependencies with proper Drizzle ORM
 */
async function processDependencies(data) {
  const lineId = toIntegerOrNull(data.lineid) || 1;
  const shipId = toIntegerOrNull(data.shipid) || 1;
  
  // Upsert cruise line using clean data
  // Fix: Extract name properly if it's an object
  let lineName = `Line ${lineId}`;
  if (data.linename) {
    if (typeof data.linename === 'object') {
      lineName = data.linename.name || data.linename.title || 
                 Object.values(data.linename).find(v => typeof v === 'string') ||
                 `Line ${lineId}`;
    } else {
      lineName = String(data.linename);
    }
  } else if (data.linecontent) {
    if (typeof data.linecontent === 'object') {
      lineName = data.linecontent.name || data.linecontent.title ||
                 Object.values(data.linecontent).find(v => typeof v === 'string') ||
                 `Line ${lineId}`;
    } else {
      lineName = String(data.linecontent);
    }
  }
  
  const lineData = removeUndefinedValues({
    id: lineId,
    name: lineName,
    code: 'L' + lineId,
    description: typeof data.linecontent === 'string' ? data.linecontent : null,
    isActive: true
  });
  
  const lineUpdateData = removeUndefinedValues({
    name: lineName,
    description: typeof data.linecontent === 'string' ? data.linecontent : null,
    updatedAt: new Date()
  });
  
  await db.insert(schema.cruiseLines)
    .values(lineData)
    .onConflictDoUpdate({
      target: schema.cruiseLines.id,
      set: lineUpdateData
    });
  
  // Upsert ship with content
  // Fix: Extract ship name properly if it's an object
  let shipName = `Ship ${shipId}`;
  if (data.shipname) {
    if (typeof data.shipname === 'object') {
      shipName = data.shipname.name || data.shipname.title ||
                 Object.values(data.shipname).find(v => typeof v === 'string') ||
                 `Ship ${shipId}`;
    } else {
      shipName = String(data.shipname);
    }
  }
  
  const shipData = {
    id: shipId,
    cruiseLineId: lineId,
    name: shipName,
    code: 'S' + shipId,
    isActive: true
  };
  
  // Add ship content if available (using actual field names from analysis)
  if (data.shipcontent) {
    const content = data.shipcontent;
    // shipclass is always null in samples
    if (content.shipclass) shipData.shipClass = content.shipclass;
    if (content.tonnage) shipData.tonnage = toIntegerOrNull(content.tonnage);
    if (content.totalcabins) shipData.totalCabins = toIntegerOrNull(content.totalcabins);
    if (content.occupancy) shipData.capacity = toIntegerOrNull(content.occupancy); // occupancy not limitof
    if (content.starrating) shipData.rating = toIntegerOrNull(content.starrating); // starrating not startrating
    if (content.shortdescription) shipData.description = content.shortdescription;
    if (content.highlights) shipData.highlights = content.highlights; // Always null in samples
    if (content.defaultshipimage) shipData.defaultImageUrl = content.defaultshipimage;
    if (content.defaultshipimage2k) shipData.defaultImageUrlHd = content.defaultshipimage2k;
    // shipimages is an object, not array
    if (content.shipimages) {
      if (Array.isArray(content.shipimages)) {
        shipData.images = content.shipimages;
      } else if (typeof content.shipimages === 'object') {
        // Convert object to array of image URLs
        shipData.images = Object.values(content.shipimages);
      }
    }
    if (content.additsoaly) shipData.additionalInfo = content.additsoaly;
    // Add missing fields
    if (content.totalcrew) shipData.decks = toIntegerOrNull(content.totalcrew); // Store crew count in decks field for now
    if (content.launched) {
      const year = content.launched.split('-')[0];
      if (year && year !== '0000') {
        shipData.launchedYear = toIntegerOrNull(year);
      }
    }
  }
  
  // Clean ship data before insert/update
  const cleanedShipData = removeUndefinedValues(shipData);
  
  // Build update data excluding undefined values
  const shipUpdateData = removeUndefinedValues({
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
  });
  
  await db.insert(schema.ships)
    .values(cleanedShipData)
    .onConflictDoUpdate({
      target: schema.ships.id,
      set: shipUpdateData
    });
  
  // Process ports - data.ports is an object keyed by port ID
  const portMapping = {};
  if (data.ports && typeof data.ports === 'object') {
    // Ports is an object where keys are port IDs
    for (const [portId, portData] of Object.entries(data.ports)) {
      const pid = toIntegerOrNull(portId);
      if (pid) {
        // If portData is an object with name, use it; otherwise use as string
        if (typeof portData === 'object' && portData.name) {
          portMapping[pid] = portData.name;
        } else if (typeof portData === 'string') {
          portMapping[pid] = portData;
        } else {
          portMapping[pid] = `Port ${pid}`;
        }
      }
    }
  }
  
  const allPortIds = new Set([
    toIntegerOrNull(data.startportid),
    toIntegerOrNull(data.endportid),
    ...parseArrayField(data.portids)
  ].filter(id => id !== null));
  
  for (const portId of allPortIds) {
    const portData = removeUndefinedValues({
      id: portId,
      name: portMapping[portId] || `Port ${portId}`,
      code: 'P' + portId,
      isActive: true
    });
    
    const portUpdateData = removeUndefinedValues({
      name: portMapping[portId] || `Port ${portId}`,
      updatedAt: new Date()
    });
    
    await db.insert(schema.ports)
      .values(portData)
      .onConflictDoUpdate({
        target: schema.ports.id,
        set: portUpdateData
      });
  }
  
  // Process regions - data.regions is an object keyed by region ID
  const regionMapping = {};
  if (data.regions && typeof data.regions === 'object') {
    for (const [regionId, regionData] of Object.entries(data.regions)) {
      const rid = toIntegerOrNull(regionId);
      if (rid) {
        if (typeof regionData === 'object' && regionData.name) {
          regionMapping[rid] = regionData.name;
        } else if (typeof regionData === 'string') {
          regionMapping[rid] = regionData;
        } else {
          regionMapping[rid] = `Region ${rid}`;
        }
      }
    }
  }
  
  const regionIds = parseArrayField(data.regionids);
  for (const regionId of regionIds) {
    const regionData = removeUndefinedValues({
      id: regionId,
      name: regionMapping[regionId] || `Region ${regionId}`,
      code: 'R' + regionId,
      isActive: true
    });
    
    const regionUpdateData = removeUndefinedValues({
      name: regionMapping[regionId] || `Region ${regionId}`,
      updatedAt: new Date()
    });
    
    await db.insert(schema.regions)
      .values(regionData)
      .onConflictDoUpdate({
        target: schema.regions.id,
        set: regionUpdateData
      });
  }
}

/**
 * Take price snapshot - captures current pricing for history tracking
 */
async function takePriceSnapshot(cruiseId) {
  try {
    // Get existing pricing records to create snapshots
    const existingPricing = await db.select()
      .from(schema.pricing)
      .where(eq(schema.pricing.cruiseId, cruiseId))
      .limit(10); // Sample a few pricing records for snapshot
    
    if (existingPricing.length > 0) {
      // Create snapshots for sample pricing records
      for (const price of existingPricing.slice(0, 3)) { // Just snapshot first 3 for performance
        const snapshotData = removeUndefinedValues({
          cruiseId: cruiseId,
          rateCode: price.rateCode,
          cabinCode: price.cabinCode,
          occupancyCode: price.occupancyCode,
          cabinType: price.cabinType,
          basePrice: price.basePrice,
          adultPrice: price.adultPrice,
          childPrice: price.childPrice,
          infantPrice: price.infantPrice,
          singlePrice: price.singlePrice,
          thirdAdultPrice: price.thirdAdultPrice,
          fourthAdultPrice: price.fourthAdultPrice,
          taxes: price.taxes,
          ncf: price.ncf,
          gratuity: price.gratuity,
          fuel: price.fuel,
          nonComm: price.nonComm,
          totalPrice: price.totalPrice,
          currency: price.currency || 'USD',
          isAvailable: price.isAvailable,
          changeType: 'update', // Required field
          changeReason: 'ftp_sync',
          snapshotDate: new Date()
        });
        
        await db.insert(schema.priceHistory).values(snapshotData);
      }
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
    const returnDateObj = new Date(sailDate);
    returnDateObj.setDate(returnDateObj.getDate() + nights);
    returnDate = returnDateObj.toISOString().split('T')[0];
  }
  
  const cruiseData = {
    id: cruiseId,
    codeToCruiseId: data.codetocruiseid || String(cruiseId),
    cruiseLineId: toIntegerOrNull(data.lineid) || 1,
    shipId: toIntegerOrNull(data.shipid) || 1,
    name: data.name || data.cruisename || data.itineraryname || `Cruise ${cruiseId}`, // Use 'name' field (verified to exist)
    voyageCode: data.voyagecode || null, // Important identifier
    sailingDate: sailDate,
    returnDate: returnDate,
    nights: nights,
    embarkPortId: toIntegerOrNull(data.startportid),
    disembarkPortId: toIntegerOrNull(data.endportid),
    regionIds: parseArrayField(data.regionids), // Comma-separated string like "12,3"
    portIds: parseArrayField(data.portids), // Comma-separated string like "378,383,2864"
    showCruise: data.showcruise === 'Y', // Fixed field name
    isActive: true,
    traveltekFilePath: filePath,
    marketId: toIntegerOrNull(data.marketid),
    ownerId: data.ownerid === 'system' ? null : toIntegerOrNull(data.ownerid), // Convert 'system' to null
    // Additional fields from schema
    sailNights: toIntegerOrNull(data.sailnights),
    seaDays: toIntegerOrNull(data.seadays),
    noFly: data.nofly === 'Y' || data.noFly === true,
    departUk: data.departuk === 'Y' || data.departUk === true,
    flyCruiseInfo: data.flycruiseinfo ? JSON.stringify(data.flycruiseinfo) : null,
    lineContent: data.linecontent ? data.linecontent.description : null,
    currency: data.currency || 'USD'
  };
  
  // Clean cruise data before insert/update
  const cleanedCruiseData = removeUndefinedValues(cruiseData);
  
  // Build update data excluding undefined values
  const cruiseUpdateData = removeUndefinedValues({
    name: cruiseData.name,
    codeToCruiseId: cruiseData.codeToCruiseId,
    sailingDate: cruiseData.sailingDate,
    returnDate: cruiseData.returnDate,
    nights: cruiseData.nights,
    sailNights: cruiseData.sailNights,
    seaDays: cruiseData.seaDays,
    embarkPortId: cruiseData.embarkPortId,
    disembarkPortId: cruiseData.disembarkPortId,
    regionIds: cruiseData.regionIds,
    portIds: cruiseData.portIds,
    showCruise: cruiseData.showCruise,
    noFly: cruiseData.noFly,
    departUk: cruiseData.departUk,
    flyCruiseInfo: cruiseData.flyCruiseInfo,
    lineContent: cruiseData.lineContent,
    currency: cruiseData.currency,
    marketId: cruiseData.marketId,
    ownerId: cruiseData.ownerId,
    traveltekFilePath: cruiseData.traveltekFilePath,
    updatedAt: new Date()
  });
  
  const result = await db.insert(schema.cruises)
    .values(cleanedCruiseData)
    .onConflictDoUpdate({
      target: schema.cruises.id,
      set: cruiseUpdateData
    })
    .returning({ id: schema.cruises.id });
  
  return result.length > 0;
}

/**
 * Process itinerary
 */
async function processItinerary(cruiseId, itinerary, sailDate) {
  if (!itinerary || !Array.isArray(itinerary)) return;
  
  try {
    // Delete existing itinerary
    await db.delete(schema.itineraries)
      .where(eq(schema.itineraries.cruiseId, cruiseId));
    
    // Calculate dates for each day
    const startDate = new Date(sailDate);
    if (isNaN(startDate.getTime())) {
      console.log(`   ⚠️  Invalid sailing date for cruise ${cruiseId}, skipping itinerary`);
      return;
    }
    
    // Insert new items
    for (let i = 0; i < itinerary.length; i++) {
      const day = itinerary[i];
      if (!day) continue;
      
      // Calculate the date for this day
      const dayDate = new Date(startDate);
      dayDate.setDate(dayDate.getDate() + i);
      const dayDateStr = dayDate.toISOString().split('T')[0];
      
      // Handle port ID - ensure it exists if not 0
      const portId = toIntegerOrNull(day.portid);
      if (portId && portId !== 0) {
        // Ensure port exists
        const dayPortData = removeUndefinedValues({
          id: portId,
          name: day.portname || day.port || `Port ${portId}`,
          code: 'P' + portId,
          isActive: true
        });
        
        await db.insert(schema.ports)
          .values(dayPortData)
          .onConflictDoNothing();
      }
      
      // Use the actual port name from itinerary day object
      const portName = day.name || day.itineraryname || day.portname || 'At Sea';
      
      await db.insert(schema.itineraries).values({
        cruiseId: cruiseId,
        dayNumber: i + 1,
        date: dayDateStr,
        portName: portName, // Use the name field from the day object!
        portId: (portId === 0 || !portId) ? null : portId,
        arrivalTime: day.arrivetime || day.arrivaltime || null, // Note: field is 'arrivetime' not 'arrivaltime'
        departureTime: day.departtime || day.departuretime || null, // Note: field is 'departtime'
        status: i === 0 ? 'embark' : (i === itinerary.length - 1 ? 'disembark' : 'port'),
        overnight: false,
        description: day.description || day.itinerarydescription || null,
        activities: [],
        shoreExcursions: []
      });
    }
    stats.itineraries++;
  } catch (error) {
    console.log(`   ⚠️  Itinerary failed: ${error.message}`);
  }
}

/**
 * Process pricing - Fixed to handle correct 2-level structure
 */
async function processDetailedPricing(cruiseId, prices) {
  if (!prices || typeof prices !== 'object' || Object.keys(prices).length === 0) {
    console.log(`   ℹ️  No static pricing data available for cruise ${cruiseId}`);
    return;
  }
  
  try {
    // Delete existing static pricing
    await db.delete(schema.pricing)
      .where(eq(schema.pricing.cruiseId, cruiseId));
    
    const cheapestPrices = {
      interiorPrice: null,
      oceanviewPrice: null,
      balconyPrice: null,
      suitePrice: null
    };
    
    let pricingCount = 0;
    
    // Process each rate code - FIXED: 2-level structure, not 3-level!
    for (const [rateCode, rateData] of Object.entries(prices)) {
      if (!rateData || typeof rateData !== 'object') continue;
      
      // cabinId appears to be numeric IDs like "43568" based on actual data
      for (const [cabinId, priceData] of Object.entries(rateData)) {
        if (!priceData || typeof priceData !== 'object') continue;
        
        // Extract cabin type from priceData.cabintype if available
        // Otherwise use the cabinId as the cabin code
        let cabinCode = priceData.cabintype || cabinId;
        let occupancyCode = '101'; // Default occupancy
        
        // If cabintype contains info like "Interior" or "IB", extract cabin category
        if (priceData.cabintype) {
          const upperType = priceData.cabintype.toUpperCase();
          if (upperType.includes('INTERIOR') || upperType.includes('INSIDE')) {
            cabinCode = 'INT';
          } else if (upperType.includes('OCEAN') || upperType.includes('OUTSIDE')) {
            cabinCode = 'OV';
          } else if (upperType.includes('BALCONY')) {
            cabinCode = 'BAL';
          } else if (upperType.includes('SUITE')) {
            cabinCode = 'STE';
          } else {
            // Use first few chars of cabintype or the ID
            cabinCode = priceData.cabintype.substring(0, 10);
          }
        }
        
        const basePrice = toDecimalOrNull(priceData.price || priceData.total);
        if (basePrice === null) continue;
          
        // Clean pricing data to avoid undefined values
        const pricingValues = {
          cruiseId: cruiseId,
          rateCode: rateCode,
          cabinCode: cabinCode,
          occupancyCode: occupancyCode,
          basePrice: basePrice,
          currency: priceData.currency || 'USD',
          isAvailable: true
        };
          
        // Add optional fields only if they have values
        if (priceData.cabintype) pricingValues.cabinType = priceData.cabintype;
        if (priceData.adultprice) pricingValues.adultPrice = toDecimalOrNull(priceData.adultprice);
        if (priceData.childprice) pricingValues.childPrice = toDecimalOrNull(priceData.childprice);
        if (priceData.infantprice) pricingValues.infantPrice = toDecimalOrNull(priceData.infantprice);
        if (priceData.singleprice) pricingValues.singlePrice = toDecimalOrNull(priceData.singleprice);
        if (priceData.thirdadultprice) pricingValues.thirdAdultPrice = toDecimalOrNull(priceData.thirdadultprice);
        if (priceData.fourthadultprice) pricingValues.fourthAdultPrice = toDecimalOrNull(priceData.fourthadultprice);
        if (priceData.taxes) pricingValues.taxes = toDecimalOrNull(priceData.taxes);
        if (priceData.ncf) pricingValues.ncf = toDecimalOrNull(priceData.ncf);
        if (priceData.gratuity) pricingValues.gratuity = toDecimalOrNull(priceData.gratuity);
        if (priceData.fuel) pricingValues.fuel = toDecimalOrNull(priceData.fuel);
        if (priceData.noncomm) pricingValues.nonComm = toDecimalOrNull(priceData.noncomm);
        if (priceData.fees) pricingValues.governmentFees = toDecimalOrNull(priceData.fees); // Map fees field
        if (priceData.total) pricingValues.totalPrice = toDecimalOrNull(priceData.total);
        
        await db.insert(schema.pricing).values(pricingValues);
        pricingCount++;
          
        // Track cheapest prices by cabin type
        const upperCode = cabinCode.toUpperCase();
        const price = parseFloat(basePrice);
        
        if (['I', 'INT', 'INTERIOR', 'IN'].some(c => upperCode.includes(c))) {
          if (!cheapestPrices.interiorPrice || price < parseFloat(cheapestPrices.interiorPrice)) {
            cheapestPrices.interiorPrice = basePrice;
          }
        } else if (['O', 'OV', 'OCEANVIEW', 'OCEAN'].some(c => upperCode.includes(c))) {
          if (!cheapestPrices.oceanviewPrice || price < parseFloat(cheapestPrices.oceanviewPrice)) {
            cheapestPrices.oceanviewPrice = basePrice;
          }
        } else if (['B', 'BA', 'BALCONY', 'BAL'].some(c => upperCode.includes(c))) {
          if (!cheapestPrices.balconyPrice || price < parseFloat(cheapestPrices.balconyPrice)) {
            cheapestPrices.balconyPrice = basePrice;
          }
        } else if (['S', 'SU', 'SUITE', 'ST'].some(c => upperCode.includes(c))) {
          if (!cheapestPrices.suitePrice || price < parseFloat(cheapestPrices.suitePrice)) {
            cheapestPrices.suitePrice = basePrice;
          }
        }
      }
    }
    
    if (pricingCount > 0) {
      console.log(`   ✅ Processed ${pricingCount} static pricing records`);
    }
    
    // Clean cheapest pricing data and only include defined values
    const cheapestPricingData = {
      cruiseId: cruiseId,
      currency: 'USD',
      lastUpdated: new Date()
    };
    
    // Only include prices that have values
    if (cheapestPrices.interiorPrice) cheapestPricingData.interiorPrice = cheapestPrices.interiorPrice;
    if (cheapestPrices.oceanviewPrice) cheapestPricingData.oceanviewPrice = cheapestPrices.oceanviewPrice;
    if (cheapestPrices.balconyPrice) cheapestPricingData.balconyPrice = cheapestPrices.balconyPrice;
    if (cheapestPrices.suitePrice) cheapestPricingData.suitePrice = cheapestPrices.suitePrice;
    
    // Build update data without undefined values
    const updateData = {
      currency: 'USD',
      lastUpdated: new Date()
    };
    if (cheapestPrices.interiorPrice) updateData.interiorPrice = cheapestPrices.interiorPrice;
    if (cheapestPrices.oceanviewPrice) updateData.oceanviewPrice = cheapestPrices.oceanviewPrice;
    if (cheapestPrices.balconyPrice) updateData.balconyPrice = cheapestPrices.balconyPrice;
    if (cheapestPrices.suitePrice) updateData.suitePrice = cheapestPrices.suitePrice;
    
    // Upsert cheapest pricing
    await db.insert(schema.cheapestPricing)
      .values(cheapestPricingData)
      .onConflictDoUpdate({
        target: schema.cheapestPricing.cruiseId,
        set: updateData
      });
    
    stats.pricing++;
  } catch (error) {
    console.log(`   ⚠️  Static pricing failed: ${error.message}`);
  }
}

// Removed processCachedPricing function - we only handle static pricing
/*
async function processCachedPricing(cruiseId, cachedPrices) {
  if (!cachedPrices || typeof cachedPrices !== 'object' || Object.keys(cachedPrices).length === 0) {
    return; // No cached pricing available
  }
  
  try {
    let cachedCount = 0;
    
    // Process cached pricing with same 2-level structure
    for (const [rateCode, rateData] of Object.entries(cachedPrices)) {
      if (!rateData || typeof rateData !== 'object') continue;
      
      for (const [cabinId, priceData] of Object.entries(rateData)) {
        if (!priceData || typeof priceData !== 'object') continue;
        
        // Parse cabinId - appears to be numeric in cached prices too
        let cabinCode = priceData.cabintype || cabinId;
        let occupancyCode = '101'; // Default occupancy
        
        if (priceData.cabintype) {
          const upperType = priceData.cabintype.toUpperCase();
          if (upperType.includes('INTERIOR') || upperType.includes('INSIDE')) {
            cabinCode = 'INT';
          } else if (upperType.includes('OCEAN') || upperType.includes('OUTSIDE')) {
            cabinCode = 'OV';
          } else if (upperType.includes('BALCONY')) {
            cabinCode = 'BAL';
          } else if (upperType.includes('SUITE')) {
            cabinCode = 'STE';
          } else {
            cabinCode = priceData.cabintype.substring(0, 10);
          }
        }
        
        const basePrice = toDecimalOrNull(priceData.price || priceData.total);
        if (basePrice === null) continue;
        
        const pricingValues = {
          cruiseId: cruiseId,
          rateCode: rateCode,
          cabinCode: cabinCode,
          occupancyCode: occupancyCode,
          basePrice: basePrice,
          currency: priceData.currency || 'USD',
          isAvailable: priceData.available !== false
        };
        
        // Add optional fields
        if (priceData.taxes) pricingValues.taxes = toDecimalOrNull(priceData.taxes);
        if (priceData.ncf) pricingValues.ncf = toDecimalOrNull(priceData.ncf);
        if (priceData.gratuity) pricingValues.gratuity = toDecimalOrNull(priceData.gratuity);
        if (priceData.fuel) pricingValues.fuel = toDecimalOrNull(priceData.fuel);
        if (priceData.fees) pricingValues.governmentFees = toDecimalOrNull(priceData.fees);
        if (priceData.total) pricingValues.totalPrice = toDecimalOrNull(priceData.total);
        
        await db.insert(schema.pricing).values(pricingValues);
        cachedCount++;
      }
    }
    
    if (cachedCount > 0) {
      console.log(`   ✅ Processed ${cachedCount} cached/live pricing records`);
      stats.pricing++;
    }
  } catch (error) {
    console.log(`   ⚠️  Cached pricing failed: ${error.message}`);
  }
}*/

/**
 * Process combined cheapest pricing
 */
async function processCombinedCheapest(cruiseId, data) {
  try {
    // Check for combined cheapest pricing
    const combined = data.cheapest?.combined;
    if (!combined) return;
    
    const cheapestData = removeUndefinedValues({
      cruiseId: cruiseId,
      currency: 'USD',
      lastUpdated: new Date(),
      // Combined prices from multiple sources
      interiorPrice: toDecimalOrNull(combined.inside),
      oceanviewPrice: toDecimalOrNull(combined.outside),
      balconyPrice: toDecimalOrNull(combined.balcony),
      suitePrice: toDecimalOrNull(combined.suite),
      // Price codes indicate source
      interiorPriceCode: combined.insidepricecode,
      oceanviewPriceCode: combined.outsidepricecode,
      balconyPriceCode: combined.balconypricecode,
      suitePriceCode: combined.suitepricecode
    });
    
    // Only update if we have at least one price
    if (cheapestData.interiorPrice || cheapestData.oceanviewPrice || 
        cheapestData.balconyPrice || cheapestData.suitePrice) {
      
      await db.insert(schema.cheapestPricing)
        .values(cheapestData)
        .onConflictDoUpdate({
          target: schema.cheapestPricing.cruiseId,
          set: removeUndefinedValues({
            interiorPrice: cheapestData.interiorPrice,
            oceanviewPrice: cheapestData.oceanviewPrice,
            balconyPrice: cheapestData.balconyPrice,
            suitePrice: cheapestData.suitePrice,
            lastUpdated: new Date()
          })
        });
      
      console.log(`   ✅ Updated combined cheapest pricing`);
    }
  } catch (error) {
    console.log(`   ⚠️  Combined cheapest pricing failed: ${error.message}`);
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
    
    // Data validation
    const nights = toIntegerOrNull(data.nights);
    if (nights > 100) {
      console.log(`   ⚠️  Unusual duration: ${nights} nights (${data.name || 'unnamed'})`);
      // This could be a world cruise or grand voyage
    }
    
    // Check if exists
    const existing = await db.select()
      .from(schema.cruises)
      .where(eq(schema.cruises.id, cruiseId))
      .limit(1);
    
    const isUpdate = existing.length > 0;
    
    if (isUpdate) {
      console.log(`   🔄 Updating cruise ${cruiseId}`);
      await takePriceSnapshot(cruiseId);
    } else {
      console.log(`   ✨ New cruise ${cruiseId}`);
    }
    
    // Process all data
    await processDependencies(data);
    
    // Process cruise
    await processCruiseData(data, filePath);
    
    if (isUpdate) {
      stats.updated++;
    } else {
      stats.inserted++;
    }
    
    // Process additional data
    if (data.itinerary) {
      await processItinerary(cruiseId, data.itinerary, data.saildate || data.startdate);
    }
    
    // Process all pricing sources
    if (data.prices) {
      await processDetailedPricing(cruiseId, data.prices);
    }
    
    // Note: cachedprices removed - we only process static pricing from data.prices
    
    // Process combined cheapest pricing (aggregated from all sources)
    await processCombinedCheapest(cruiseId, data);
    
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
    console.error(error.stack);
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
      
      for (const year of years) {
        console.log(`📅 Processing year ${year}...`);
        
        // Start from September for 2025, all months for other years
        const months = year === '2025' 
          ? ['09', '10', '11', '12']  // Sept-Dec for 2025
          : ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']; // All months for 2026+
        
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
  .then(async () => {
    saveProgress();
    console.log('\n✅ Sync Complete!');
    console.log('📊 Final Statistics:');
    console.log(`   • Processed: ${stats.processed} files`);
    console.log(`   • Inserted: ${stats.inserted} new cruises`);
    console.log(`   • Updated: ${stats.updated} existing cruises`);
    console.log(`   • Failed: ${stats.failed} files`);
    console.log(`   • Itineraries: ${stats.itineraries} processed`);
    console.log(`   • Pricing: ${stats.pricing} cruises with detailed pricing`);
    console.log(`   • Snapshots: ${stats.snapshots} price history records`);
    
    // Close database connection
    await dbSql.end();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('❌ Sync failed:', error);
    await dbSql.end();
    process.exit(1);
  });