#!/usr/bin/env node

/**
 * Fixed UPSERT sync script with proper SQL syntax
 * Uses INSERT ... ON CONFLICT DO UPDATE without RETURNING clause issues
 */

require('dotenv').config();
const FTP = require('ftp');
const fs = require('fs');
const { db } = require('../dist/db/connection');
const { sql } = require('drizzle-orm');

console.log('🚢 Complete Traveltek Data Sync (UPSERT Fixed)');
console.log('===============================================\n');

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
const PROGRESS_FILE = '.sync-upsert-progress.json';
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
      stream.on('data', chunk => data += chunk.toString());
      stream.on('end', () => {
        clearTimeout(timeout);
        resolve(data);
      });
      stream.on('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  });
}

// List directory
async function listDirectory(client, dirPath) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('List timeout')), 15000);
    
    client.list(dirPath, (err, list) => {
      clearTimeout(timeout);
      if (err) reject(err);
      else resolve(list || []);
    });
  });
}

// Save progress
function saveProgress() {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

/**
 * Process complete cruise data with UPSERT
 */
async function processCompleteCruise(client, filePath) {
  try {
    stats.processed++;
    
    // Download JSON
    const jsonContent = await downloadFile(client, filePath);
    const data = JSON.parse(jsonContent);
    
    const cruiseId = toIntegerOrNull(data.cruiseid);
    if (!cruiseId) {
      throw new Error(`Invalid cruise ID: ${data.cruiseid}`);
    }
    
    // Check if exists before processing
    const existingResult = await db.execute(sql`
      SELECT id FROM cruises WHERE id = ${cruiseId} LIMIT 1
    `);
    const wasExisting = existingResult.rows && existingResult.rows.length > 0;
    
    // 1. Process dependencies (always upsert)
    await processDependencies(data);
    
    // 2. Process ship content if available
    if (data.shipcontent) {
      await processShipContent(data.shipid, data.shipcontent);
    }
    
    // 3. Process main cruise data with UPSERT
    await upsertCruiseData(data, filePath);
    
    // 4. Process itinerary
    if (data.itinerary && data.itinerary.length > 0) {
      await processItinerary(cruiseId, data.itinerary);
      stats.itineraries += data.itinerary.length;
    }
    
    // 5. Process cabin definitions
    if (data.cabins && Object.keys(data.cabins).length > 0) {
      await processCabins(data.shipid, data.cabins);
      stats.cabins += Object.keys(data.cabins).length;
    }
    
    // 6. Process detailed pricing
    if (data.prices && Object.keys(data.prices).length > 0) {
      await processDetailedPricing(cruiseId, data.prices);
    }
    
    // 7. Process cheapest pricing
    await processCheapestPricing(cruiseId, data);
    
    // 8. Process alternative sailings
    if (data.altsailings && data.altsailings.length > 0) {
      await processAlternativeSailings(cruiseId, data.altsailings);
    }
    
    if (wasExisting) {
      stats.updated++;
      console.log(`      🔄 Updated cruise ${cruiseId}`);
    } else {
      stats.inserted++;
      console.log(`      ✅ Added cruise ${cruiseId}`);
    }
    
    // Mark as processed
    progress[filePath] = { 
      cruiseId, 
      processed: new Date().toISOString(),
      updated: wasExisting 
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
 * Process dependencies with UPSERT
 */
async function processDependencies(data) {
  const lineId = toIntegerOrNull(data.lineid) || 1;
  const shipId = toIntegerOrNull(data.shipid) || 1;
  
  // Upsert cruise line
  await db.execute(sql`
    INSERT INTO cruise_lines (id, name, code, description, is_active)
    VALUES (
      ${lineId},
      ${data.linename || data.linecontent || `Line ${lineId}`},
      ${'L' + lineId},
      ${data.linecontent || null},
      true
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      updated_at = NOW()
  `);
  
  // Upsert ship
  await db.execute(sql`
    INSERT INTO ships (id, cruise_line_id, name, code, is_active)
    VALUES (
      ${shipId},
      ${lineId},
      ${data.shipname || `Ship ${shipId}`},
      ${'S' + shipId},
      true
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      updated_at = NOW()
  `);
  
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
    await db.execute(sql`
      INSERT INTO ports (id, name, code, is_active)
      VALUES (
        ${portId},
        ${portMapping[portId] || `Port ${portId}`},
        ${'P' + portId},
        true
      )
      ON CONFLICT (id) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, ports.name),
        updated_at = NOW()
    `);
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
    await db.execute(sql`
      INSERT INTO regions (id, name, code, is_active)
      VALUES (
        ${regionId},
        ${regionMapping[regionId] || `Region ${regionId}`},
        ${'R' + regionId},
        true
      )
      ON CONFLICT (id) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, regions.name),
        updated_at = NOW()
    `);
  }
}

/**
 * Process ship content
 */
async function processShipContent(shipId, content) {
  if (!shipId || !content) return;
  
  const shipIdNum = toIntegerOrNull(shipId);
  if (!shipIdNum) return;
  
  await db.execute(sql`
    UPDATE ships SET
      name = COALESCE(${content.name}, ships.name),
      code = COALESCE(${content.code}, ships.code),
      ship_class = COALESCE(${content.shipclass}, ships.ship_class),
      tonnage = COALESCE(${toIntegerOrNull(content.tonnage)}, ships.tonnage),
      total_cabins = COALESCE(${toIntegerOrNull(content.totalcabins)}, ships.total_cabins),
      capacity = COALESCE(${toIntegerOrNull(content.limitof)}, ships.capacity),
      rating = COALESCE(${toIntegerOrNull(content.startrating)}, ships.rating),
      description = COALESCE(${content.shortdescription}, ships.description),
      highlights = COALESCE(${content.highlights}, ships.highlights),
      default_image_url = COALESCE(${content.defaultshipimage}, ships.default_image_url),
      default_image_url_hd = COALESCE(${content.defaultshipimage2k}, ships.default_image_url_hd),
      images = COALESCE(${JSON.stringify(content.shipimages || [])}, ships.images),
      additional_info = COALESCE(${content.additsoaly}, ships.additional_info),
      updated_at = NOW()
    WHERE id = ${shipIdNum}
  `);
}

/**
 * UPSERT cruise data
 */
async function upsertCruiseData(data, filePath) {
  const cruiseId = toIntegerOrNull(data.cruiseid);
  const sailDate = parseDateField(data.saildate || data.startdate);
  const nights = toIntegerOrNull(data.nights) || 0;
  const returnDate = new Date(sailDate);
  returnDate.setDate(returnDate.getDate() + nights);
  
  // Use INSERT ON CONFLICT DO UPDATE
  await db.execute(sql`
    INSERT INTO cruises (
      id, code_to_cruise_id, cruise_line_id, ship_id, name,
      itinerary_code, voyage_code, sailing_date, return_date, nights,
      sail_nights, sea_days, embark_port_id, disembark_port_id,
      region_ids, port_ids, market_id, owner_id,
      no_fly, depart_uk, show_cruise, fly_cruise_info, line_content,
      traveltek_file_path, last_cached, cached_date, currency, is_active
    ) VALUES (
      ${cruiseId},
      ${data.codetocruiseid || String(cruiseId)},
      ${toIntegerOrNull(data.lineid) || 1},
      ${toIntegerOrNull(data.shipid) || 1},
      ${data.name || `Cruise ${cruiseId}`},
      ${data.itinerarycode || null},
      ${data.voyagecode || null},
      ${sailDate},
      ${returnDate.toISOString()},
      ${nights},
      ${toIntegerOrNull(data.sailnights)},
      ${toIntegerOrNull(data.seadays)},
      ${toIntegerOrNull(data.startportid)},
      ${toIntegerOrNull(data.endportid)},
      ${JSON.stringify(parseArrayField(data.regionids))},
      ${JSON.stringify(parseArrayField(data.portids))},
      ${toIntegerOrNull(data.marketid)},
      ${toIntegerOrNull(data.ownerid)},
      ${toBoolean(data.nofly) || false},
      ${toBoolean(data.departuk) || false},
      ${data.showcruise !== false},
      ${data.flycruiseinfo || null},
      ${data.linecontent || null},
      ${filePath},
      ${parseDateField(data.lastcached)},
      ${parseDateField(data.cacheddate)},
      ${data.currency || 'USD'},
      true
    )
    ON CONFLICT (id) DO UPDATE SET
      code_to_cruise_id = EXCLUDED.code_to_cruise_id,
      cruise_line_id = EXCLUDED.cruise_line_id,
      ship_id = EXCLUDED.ship_id,
      name = EXCLUDED.name,
      itinerary_code = EXCLUDED.itinerary_code,
      voyage_code = EXCLUDED.voyage_code,
      sailing_date = EXCLUDED.sailing_date,
      return_date = EXCLUDED.return_date,
      nights = EXCLUDED.nights,
      sail_nights = EXCLUDED.sail_nights,
      sea_days = EXCLUDED.sea_days,
      embark_port_id = EXCLUDED.embark_port_id,
      disembark_port_id = EXCLUDED.disembark_port_id,
      region_ids = EXCLUDED.region_ids,
      port_ids = EXCLUDED.port_ids,
      market_id = EXCLUDED.market_id,
      owner_id = EXCLUDED.owner_id,
      no_fly = EXCLUDED.no_fly,
      depart_uk = EXCLUDED.depart_uk,
      show_cruise = EXCLUDED.show_cruise,
      fly_cruise_info = EXCLUDED.fly_cruise_info,
      line_content = EXCLUDED.line_content,
      traveltek_file_path = EXCLUDED.traveltek_file_path,
      last_cached = EXCLUDED.last_cached,
      cached_date = EXCLUDED.cached_date,
      currency = EXCLUDED.currency,
      updated_at = NOW()
  `);
}

/**
 * Process itinerary data
 */
async function processItinerary(cruiseId, itineraryData) {
  // Delete existing itinerary
  await db.execute(sql`
    DELETE FROM itineraries WHERE cruise_id = ${cruiseId}
  `);
  
  // Insert new itinerary
  for (const day of itineraryData) {
    const portId = toIntegerOrNull(day.portid);
    
    await db.execute(sql`
      INSERT INTO itineraries (
        cruise_id, day_number, date, port_name, port_id,
        arrival_time, departure_time, status, overnight, description
      ) VALUES (
        ${cruiseId},
        ${toIntegerOrNull(day.day) || 0},
        ${parseDateField(day.date)},
        ${day.port || null},
        ${portId},
        ${day.arrive || null},
        ${day.depart || null},
        ${day.status || 'port'},
        ${toBoolean(day.overnight) || false},
        ${day.description || null}
      )
    `);
  }
}

/**
 * Process cabin definitions with UPSERT
 */
async function processCabins(shipId, cabinsData) {
  const shipIdNum = toIntegerOrNull(shipId);
  if (!shipIdNum) return;
  
  for (const [code, cabin] of Object.entries(cabinsData)) {
    await db.execute(sql`
      INSERT INTO cabin_categories (
        ship_id, cabin_code, cabin_code_alt, name, description,
        category, category_alt, color_code, color_code_alt,
        image_url, image_url_hd, is_default,
        valid_from, valid_to, max_occupancy, min_occupancy
      ) VALUES (
        ${shipIdNum},
        ${cabin.cabincode || code},
        ${cabin.cabincode2 || null},
        ${cabin.name || null},
        ${cabin.description || null},
        ${cabin.codtype || null},
        ${cabin.codtype2 || null},
        ${cabin.colourcode || null},
        ${cabin.colourcode2 || null},
        ${cabin.imageurl || null},
        ${cabin.imageurl2k || null},
        ${toBoolean(cabin.isdefault) || false},
        ${parseDateField(cabin.validfrom)},
        ${parseDateField(cabin.validto)},
        ${toIntegerOrNull(cabin.maxoccupancy)},
        ${toIntegerOrNull(cabin.minoccupancy) || 1}
      )
      ON CONFLICT (ship_id, cabin_code) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, cabin_categories.name),
        description = COALESCE(EXCLUDED.description, cabin_categories.description),
        category = COALESCE(EXCLUDED.category, cabin_categories.category),
        color_code = COALESCE(EXCLUDED.color_code, cabin_categories.color_code),
        image_url = COALESCE(EXCLUDED.image_url, cabin_categories.image_url),
        max_occupancy = COALESCE(EXCLUDED.max_occupancy, cabin_categories.max_occupancy),
        updated_at = NOW()
    `);
  }
}

/**
 * Process detailed pricing matrix
 */
async function processDetailedPricing(cruiseId, pricesData) {
  // Delete existing pricing for this cruise
  await db.execute(sql`
    DELETE FROM pricing WHERE cruise_id = ${cruiseId}
  `);
  
  let pricingCount = 0;
  
  // Process nested pricing structure: RATECODE -> CABIN -> OCCUPANCY
  for (const [rateCode, cabins] of Object.entries(pricesData)) {
    if (typeof cabins !== 'object') continue;
    
    for (const [cabinCode, occupancies] of Object.entries(cabins)) {
      if (typeof occupancies !== 'object') continue;
      
      for (const [occupancyCode, priceData] of Object.entries(occupancies)) {
        if (typeof priceData !== 'object') continue;
        
        await db.execute(sql`
          INSERT INTO pricing (
            cruise_id, rate_code, cabin_code, occupancy_code, cabin_type,
            base_price, adult_price, child_price, infant_price, single_price,
            third_adult_price, fourth_adult_price, taxes, ncf, gratuity,
            fuel, non_comm, port_charges, government_fees, total_price,
            commission, is_available, inventory, waitlist, guarantee,
            price_type, price_timestamp
          ) VALUES (
            ${cruiseId},
            ${rateCode},
            ${cabinCode},
            ${occupancyCode},
            ${priceData.cabintype || null},
            ${toDecimalOrNull(priceData.price)},
            ${toDecimalOrNull(priceData.adultprice)},
            ${toDecimalOrNull(priceData.childprice)},
            ${toDecimalOrNull(priceData.infantprice)},
            ${toDecimalOrNull(priceData.singleprice)},
            ${toDecimalOrNull(priceData.thirdadultprice)},
            ${toDecimalOrNull(priceData.fourthadultprice)},
            ${toDecimalOrNull(priceData.taxes)},
            ${toDecimalOrNull(priceData.ncf)},
            ${toDecimalOrNull(priceData.gratuity)},
            ${toDecimalOrNull(priceData.fuel)},
            ${toDecimalOrNull(priceData.noncomm)},
            ${toDecimalOrNull(priceData.portcharges)},
            ${toDecimalOrNull(priceData.governmentfees)},
            ${toDecimalOrNull(priceData.totalprice) || toDecimalOrNull(priceData.price)},
            ${toDecimalOrNull(priceData.commission)},
            ${priceData.available !== false},
            ${toIntegerOrNull(priceData.inventory)},
            ${toBoolean(priceData.waitlist) || false},
            ${toBoolean(priceData.guarantee) || false},
            ${'static'},
            ${new Date().toISOString()}
          )
        `);
        
        pricingCount++;
      }
    }
  }
  
  stats.pricing += pricingCount;
}

/**
 * Process cheapest pricing with UPSERT
 */
async function processCheapestPricing(cruiseId, data) {
  await db.execute(sql`
    INSERT INTO cheapest_pricing (
      cruise_id,
      cheapest_price, cheapest_cabin_type, cheapest_taxes,
      cheapest_ncf, cheapest_gratuity, cheapest_fuel, cheapest_non_comm,
      interior_price, interior_taxes, interior_ncf, interior_gratuity,
      interior_fuel, interior_non_comm, interior_price_code,
      oceanview_price, oceanview_taxes, oceanview_ncf, oceanview_gratuity,
      oceanview_fuel, oceanview_non_comm, oceanview_price_code,
      balcony_price, balcony_taxes, balcony_ncf, balcony_gratuity,
      balcony_fuel, balcony_non_comm, balcony_price_code,
      suite_price, suite_taxes, suite_ncf, suite_gratuity,
      suite_fuel, suite_non_comm, suite_price_code,
      currency, last_updated
    ) VALUES (
      ${cruiseId},
      ${toDecimalOrNull(data.cheapest?.price)},
      ${data.cheapest?.cabintype || null},
      ${toDecimalOrNull(data.cheapest?.taxes)},
      ${toDecimalOrNull(data.cheapest?.ncf)},
      ${toDecimalOrNull(data.cheapest?.gratuity)},
      ${toDecimalOrNull(data.cheapest?.fuel)},
      ${toDecimalOrNull(data.cheapest?.noncomm)},
      ${toDecimalOrNull(data.cheapestinside?.price)},
      ${toDecimalOrNull(data.cheapestinside?.taxes)},
      ${toDecimalOrNull(data.cheapestinside?.ncf)},
      ${toDecimalOrNull(data.cheapestinside?.gratuity)},
      ${toDecimalOrNull(data.cheapestinside?.fuel)},
      ${toDecimalOrNull(data.cheapestinside?.noncomm)},
      ${data.cheapestinsidepricecode || null},
      ${toDecimalOrNull(data.cheapestoutside?.price)},
      ${toDecimalOrNull(data.cheapestoutside?.taxes)},
      ${toDecimalOrNull(data.cheapestoutside?.ncf)},
      ${toDecimalOrNull(data.cheapestoutside?.gratuity)},
      ${toDecimalOrNull(data.cheapestoutside?.fuel)},
      ${toDecimalOrNull(data.cheapestoutside?.noncomm)},
      ${data.cheapestoutsidepricecode || null},
      ${toDecimalOrNull(data.cheapestbalcony?.price)},
      ${toDecimalOrNull(data.cheapestbalcony?.taxes)},
      ${toDecimalOrNull(data.cheapestbalcony?.ncf)},
      ${toDecimalOrNull(data.cheapestbalcony?.gratuity)},
      ${toDecimalOrNull(data.cheapestbalcony?.fuel)},
      ${toDecimalOrNull(data.cheapestbalcony?.noncomm)},
      ${data.cheapestbalconypricecode || null},
      ${toDecimalOrNull(data.cheapestsuite?.price)},
      ${toDecimalOrNull(data.cheapestsuite?.taxes)},
      ${toDecimalOrNull(data.cheapestsuite?.ncf)},
      ${toDecimalOrNull(data.cheapestsuite?.gratuity)},
      ${toDecimalOrNull(data.cheapestsuite?.fuel)},
      ${toDecimalOrNull(data.cheapestsuite?.noncomm)},
      ${data.cheapestsuitepricecode || null},
      ${data.currency || 'USD'},
      ${new Date().toISOString()}
    )
    ON CONFLICT (cruise_id) DO UPDATE SET
      cheapest_price = EXCLUDED.cheapest_price,
      cheapest_cabin_type = EXCLUDED.cheapest_cabin_type,
      cheapest_taxes = EXCLUDED.cheapest_taxes,
      cheapest_ncf = EXCLUDED.cheapest_ncf,
      cheapest_gratuity = EXCLUDED.cheapest_gratuity,
      cheapest_fuel = EXCLUDED.cheapest_fuel,
      cheapest_non_comm = EXCLUDED.cheapest_non_comm,
      interior_price = EXCLUDED.interior_price,
      interior_taxes = EXCLUDED.interior_taxes,
      interior_ncf = EXCLUDED.interior_ncf,
      interior_gratuity = EXCLUDED.interior_gratuity,
      interior_fuel = EXCLUDED.interior_fuel,
      interior_non_comm = EXCLUDED.interior_non_comm,
      interior_price_code = EXCLUDED.interior_price_code,
      oceanview_price = EXCLUDED.oceanview_price,
      oceanview_taxes = EXCLUDED.oceanview_taxes,
      oceanview_ncf = EXCLUDED.oceanview_ncf,
      oceanview_gratuity = EXCLUDED.oceanview_gratuity,
      oceanview_fuel = EXCLUDED.oceanview_fuel,
      oceanview_non_comm = EXCLUDED.oceanview_non_comm,
      oceanview_price_code = EXCLUDED.oceanview_price_code,
      balcony_price = EXCLUDED.balcony_price,
      balcony_taxes = EXCLUDED.balcony_taxes,
      balcony_ncf = EXCLUDED.balcony_ncf,
      balcony_gratuity = EXCLUDED.balcony_gratuity,
      balcony_fuel = EXCLUDED.balcony_fuel,
      balcony_non_comm = EXCLUDED.balcony_non_comm,
      balcony_price_code = EXCLUDED.balcony_price_code,
      suite_price = EXCLUDED.suite_price,
      suite_taxes = EXCLUDED.suite_taxes,
      suite_ncf = EXCLUDED.suite_ncf,
      suite_gratuity = EXCLUDED.suite_gratuity,
      suite_fuel = EXCLUDED.suite_fuel,
      suite_non_comm = EXCLUDED.suite_non_comm,
      suite_price_code = EXCLUDED.suite_price_code,
      currency = EXCLUDED.currency,
      last_updated = EXCLUDED.last_updated
  `);
}

/**
 * Process alternative sailings
 */
async function processAlternativeSailings(baseCruiseId, altSailings) {
  // Delete existing alternatives
  await db.execute(sql`
    DELETE FROM alternative_sailings WHERE base_cruise_id = ${baseCruiseId}
  `);
  
  // Insert new alternatives
  for (const alt of altSailings) {
    const altCruiseId = toIntegerOrNull(alt.cruiseid);
    if (!altCruiseId) continue;
    
    await db.execute(sql`
      INSERT INTO alternative_sailings (
        base_cruise_id, alternative_cruise_id, sailing_date, price
      ) VALUES (
        ${baseCruiseId},
        ${altCruiseId},
        ${parseDateField(alt.saildate)},
        ${toDecimalOrNull(alt.price)}
      )
    `);
  }
}

/**
 * Process a directory of cruise files
 */
async function processDirectory(client, dirPath) {
  try {
    const files = await listDirectory(client, dirPath);
    const jsonFiles = files.filter(f => f.type === '-' && f.name.endsWith('.json'));
    
    console.log(`   📂 ${dirPath}: ${jsonFiles.length} files`);
    
    for (const file of jsonFiles) {
      const filePath = `${dirPath}/${file.name}`;
      await processCompleteCruise(client, filePath);
    }
  } catch (error) {
    console.log(`   ⚠️ Directory error: ${error.message}`);
  }
}

/**
 * Main sync function
 */
async function sync() {
  const client = new FTP();
  
  return new Promise((resolve, reject) => {
    client.on('ready', async () => {
      console.log('✅ Connected to FTP\n');
      
      try {
        // Get current database stats
        const cruiseCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM cruises`);
        const cruiseCount = cruiseCountResult.rows?.[0]?.count || 0;
        console.log(`📊 Current database: ${cruiseCount} cruises\n`);
        
        // Process years and months
        const years = process.env.SYNC_YEARS ? 
          process.env.SYNC_YEARS.split(',') : 
          ['2025', '2026'];
        
        for (const year of years) {
          console.log(`\n📅 YEAR ${year}`);
          console.log('─'.repeat(40));
          
          for (let month = 1; month <= 12; month++) {
            const monthStr = month.toString().padStart(2, '0');
            console.log(`\n📆 Processing ${year}/${monthStr}...`);
            
            try {
              const monthPath = `/${year}/${monthStr}`;
              const lineDirs = await listDirectory(client, monthPath);
              
              for (const lineDir of lineDirs.filter(d => d.type === 'd')) {
                const linePath = `${monthPath}/${lineDir.name}`;
                const shipDirs = await listDirectory(client, linePath);
                
                for (const shipDir of shipDirs.filter(d => d.type === 'd')) {
                  const shipPath = `${linePath}/${shipDir.name}`;
                  await processDirectory(client, shipPath);
                }
              }
              
              saveProgress();
              console.log(`   ✅ ${year}/${monthStr} complete`);
              
            } catch (error) {
              console.log(`   ⚠️ Month error: ${error.message}`);
            }
          }
        }
        
        // Final summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 SYNC COMPLETE');
        console.log('='.repeat(60));
        console.log(`Processed: ${stats.processed} files`);
        console.log(`✅ Inserted: ${stats.inserted} new cruises`);
        console.log(`🔄 Updated: ${stats.updated} existing cruises`);
        console.log(`❌ Failed: ${stats.failed}`);
        console.log(`📍 Itineraries: ${stats.itineraries} days`);
        console.log(`🛏️ Cabins: ${stats.cabins} definitions`);
        console.log(`💰 Pricing: ${stats.pricing} entries`);
        
        // Final database count
        const finalCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM cruises`);
        const finalCount = finalCountResult.rows?.[0]?.count || 0;
        console.log(`\n📊 Final database: ${finalCount} cruises`);
        
        client.end();
        resolve();
        
      } catch (error) {
        console.error('Sync error:', error);
        client.end();
        reject(error);
      }
    });
    
    client.on('error', (err) => {
      console.error('FTP error:', err.message);
      reject(err);
    });
    
    client.connect(ftpConfig);
  });
}

// Run sync
console.log('Starting complete data sync with fixed UPSERT...');
console.log('This version properly updates existing cruises\n');

sync()
  .then(() => {
    console.log('\n✨ Complete sync finished!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal:', error.message);
    process.exit(1);
  });