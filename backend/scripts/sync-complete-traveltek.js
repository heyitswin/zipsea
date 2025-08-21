#!/usr/bin/env node

/**
 * Complete Traveltek Data Sync Script
 * Captures ALL data from Traveltek JSON export files
 * Based on official API documentation
 */

require('dotenv').config();
const FTP = require('ftp');
const fs = require('fs');
const { Pool } = require('pg');

console.log('🚢 Complete Traveltek Data Sync');
console.log('================================\n');

// Configuration
const YEAR = process.env.YEAR || '2025';
const MONTH = process.env.MONTH || '09';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '5');
const RESUME = process.env.RESUME === 'true';

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
  currentLineId: null,
  currentShipId: null,
  stats: {
    cruisesProcessed: 0,
    cruisesInserted: 0,
    cruisesUpdated: 0,
    pricesInserted: 0,
    cachedPricesInserted: 0,
    itinerariesInserted: 0,
    errors: 0
  }
};

if (RESUME && fs.existsSync(PROGRESS_FILE)) {
  progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
  console.log('📂 Resuming from previous progress');
  console.log(`   Processed: ${progress.processedFiles.length} files`);
}

// Save progress
function saveProgress() {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// Parse comma-separated IDs
function parseCommaSeparatedIds(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.join(',');
  return '';
}

// Parse date safely
function parseDate(value) {
  if (!value) return null;
  try {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
  } catch {
    return null;
  }
}

// Parse time safely
function parseTime(value) {
  if (!value) return null;
  // Handle both "08:00" and "2025-06-15T08:00:00Z" formats
  if (value.includes('T')) {
    return value.split('T')[1].split('Z')[0];
  }
  return value;
}

// Parse decimal safely
function parseDecimal(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

// Parse integer safely
function parseInteger(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = parseInt(value);
  return isNaN(num) ? null : num;
}

// Parse boolean from Y/N
function parseBoolean(value) {
  return value === 'Y' || value === 'true' || value === true;
}

/**
 * Process cruise line
 */
async function processCruiseLine(client, data) {
  const lineId = data.lineid;
  if (!lineId) return;
  
  const lineContent = data.linecontent || {};
  
  const values = [
    lineId,
    lineContent.name || `Cruise Line ${lineId}`,
    lineContent.code || null,
    lineContent.shortname || null,
    lineContent.description || null,
    lineContent.enginename || null,
    lineContent.logo || null,
    lineContent.niceurl || null
  ];
  
  await client.query(`
    INSERT INTO cruise_lines (id, name, code, shortname, description, enginename, logo_url, niceurl)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      code = EXCLUDED.code,
      shortname = EXCLUDED.shortname,
      description = EXCLUDED.description,
      enginename = EXCLUDED.enginename,
      logo_url = EXCLUDED.logo_url,
      niceurl = EXCLUDED.niceurl,
      updated_at = CURRENT_TIMESTAMP
  `, values);
}

/**
 * Process ship and related data
 */
async function processShip(client, data) {
  const shipId = data.shipid;
  if (!shipId) return;
  
  const shipContent = data.shipcontent || {};
  
  // Insert/update ship
  const shipValues = [
    shipId,
    data.lineid,
    shipContent.name || `Ship ${shipId}`,
    shipContent.code || null,
    shipContent.niceurl || null,
    parseInteger(shipContent.occupancy),
    parseInteger(shipContent.length),
    shipContent.shipclass || null,
    parseInteger(shipContent.totalcabins),
    parseInteger(shipContent.tonnage),
    parseInteger(shipContent.totalcrew),
    parseInteger(shipContent.starrating),
    parseBoolean(shipContent.adultsonly),
    shipContent.shortdescription || null,
    shipContent.highlights || null,
    parseDate(shipContent.launched),
    shipContent.defaultshipimage || null,
    shipContent.defaultshipimagehd || null,
    shipContent.defaultshipimage2k || null
  ];
  
  await client.query(`
    INSERT INTO ships (
      id, cruise_line_id, name, code, niceurl, occupancy, length, 
      ship_class, total_cabins, tonnage, total_crew, star_rating,
      adults_only, short_description, highlights, launched,
      default_image, default_image_hd, default_image_2k
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      code = EXCLUDED.code,
      niceurl = EXCLUDED.niceurl,
      occupancy = EXCLUDED.occupancy,
      length = EXCLUDED.length,
      ship_class = EXCLUDED.ship_class,
      total_cabins = EXCLUDED.total_cabins,
      tonnage = EXCLUDED.tonnage,
      total_crew = EXCLUDED.total_crew,
      star_rating = EXCLUDED.star_rating,
      adults_only = EXCLUDED.adults_only,
      short_description = EXCLUDED.short_description,
      highlights = EXCLUDED.highlights,
      launched = EXCLUDED.launched,
      default_image = EXCLUDED.default_image,
      default_image_hd = EXCLUDED.default_image_hd,
      default_image_2k = EXCLUDED.default_image_2k,
      updated_at = CURRENT_TIMESTAMP
  `, shipValues);
  
  // Process ship images
  if (shipContent.shipimages && Array.isArray(shipContent.shipimages)) {
    for (const img of shipContent.shipimages) {
      await client.query(`
        INSERT INTO ship_images (
          ship_id, image_url, image_url_hd, image_url_2k, caption, is_default
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT DO NOTHING
      `, [
        shipId,
        img.imageurl || null,
        img.imageurlhd || null,
        img.imageurl2k || null,
        img.caption || null,
        parseBoolean(img.default)
      ]);
    }
  }
  
  // Process ship decks
  if (shipContent.shipdecks && typeof shipContent.shipdecks === 'object') {
    for (const [deckId, deck] of Object.entries(shipContent.shipdecks)) {
      await client.query(`
        INSERT INTO ship_decks (
          id, ship_id, deck_name, description, live_name, plan_image,
          deck_plan_id, valid_from, valid_to
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          deck_name = EXCLUDED.deck_name,
          description = EXCLUDED.description,
          live_name = EXCLUDED.live_name,
          plan_image = EXCLUDED.plan_image,
          deck_plan_id = EXCLUDED.deck_plan_id,
          valid_from = EXCLUDED.valid_from,
          valid_to = EXCLUDED.valid_to
      `, [
        parseInteger(deck.id || deckId),
        shipId,
        deck.deckname || null,
        deck.description || null,
        deck.livename || null,
        deck.planimage || null,
        parseInteger(deck.deckplanid),
        parseDate(deck.validfrom),
        parseDate(deck.validto)
      ]);
    }
  }
}

/**
 * Process ports
 */
async function processPorts(client, data) {
  if (!data.ports || typeof data.ports !== 'object') return;
  
  for (const [portId, portName] of Object.entries(data.ports)) {
    const id = parseInteger(portId);
    if (!id) continue;
    
    await client.query(`
      INSERT INTO ports (id, name)
      VALUES ($1, $2)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        updated_at = CURRENT_TIMESTAMP
    `, [id, portName || `Port ${id}`]);
  }
}

/**
 * Process regions
 */
async function processRegions(client, data) {
  if (!data.regions || typeof data.regions !== 'object') return;
  
  for (const [regionId, regionName] of Object.entries(data.regions)) {
    await client.query(`
      INSERT INTO regions (id, name)
      VALUES ($1, $2)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        updated_at = CURRENT_TIMESTAMP
    `, [parseInteger(regionId), regionName]);
  }
}

/**
 * Process cabin types
 */
async function processCabinTypes(client, shipId, data) {
  if (!data.cabins || typeof data.cabins !== 'object') return;
  
  for (const [cabinId, cabin] of Object.entries(data.cabins)) {
    await client.query(`
      INSERT INTO cabin_types (
        id, ship_id, cabin_code, cabin_code2, name, description,
        cod_type, colour_code, is_default, image_url, image_url_hd,
        image_url_2k, valid_from, valid_to
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO UPDATE SET
        cabin_code = EXCLUDED.cabin_code,
        cabin_code2 = EXCLUDED.cabin_code2,
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        cod_type = EXCLUDED.cod_type,
        colour_code = EXCLUDED.colour_code,
        is_default = EXCLUDED.is_default,
        image_url = EXCLUDED.image_url,
        image_url_hd = EXCLUDED.image_url_hd,
        image_url_2k = EXCLUDED.image_url_2k,
        valid_from = EXCLUDED.valid_from,
        valid_to = EXCLUDED.valid_to
    `, [
      cabin.id || cabinId,
      shipId,
      cabin.cabincode || null,
      cabin.cabincode2 || null,
      cabin.name || null,
      cabin.description || null,
      cabin.codtype || null,
      cabin.colourcode || null,
      parseBoolean(cabin.isdefault),
      cabin.imageurl || null,
      cabin.imageurlhd || null,
      cabin.imageurl2k || null,
      parseDate(cabin.validfrom),
      parseDate(cabin.validto)
    ]);
  }
}

/**
 * Process cruise
 */
async function processCruise(client, data, filePath) {
  const cruiseId = data.cruiseid;
  const codeToId = data.codetocruiseid;
  
  if (!cruiseId || !codeToId) {
    console.log('⚠️ Missing cruise ID, skipping');
    return;
  }
  
  // Insert/update cruise
  const cruiseValues = [
    cruiseId,
    codeToId,
    data.lineid,
    data.shipid,
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
    parseCommaSeparatedIds(data.portids),
    parseCommaSeparatedIds(data.regionids),
    parseInteger(data.marketid),
    data.ownerid || 'system',
    parseBoolean(data.nofly),
    parseBoolean(data.departuk),
    parseBoolean(data.showcruise),
    data.flycruiseinfo || null,
    parseInteger(data.lastcached),
    data.lastcached ? new Date(data.lastcached * 1000) : null,
    filePath
  ];
  
  await client.query(`
    INSERT INTO cruises (
      id, code_to_cruise_id, cruise_line_id, ship_id, name, voyage_code,
      itinerary_code, sailing_date, start_date, nights, sail_nights, sea_days,
      embark_port_id, disembark_port_id, port_ids, region_ids, market_id,
      owner_id, no_fly, depart_uk, show_cruise, fly_cruise_info,
      last_cached, cached_date, traveltek_file_path
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
  `, cruiseValues);
  
  progress.stats.cruisesProcessed++;
}

/**
 * Process itinerary
 */
async function processItinerary(client, cruiseId, data) {
  if (!data.itinerary || !Array.isArray(data.itinerary)) return;
  
  // Delete existing itinerary for this cruise
  await client.query('DELETE FROM itineraries WHERE cruise_id = $1', [cruiseId]);
  
  for (const day of data.itinerary) {
    // First ensure the port exists if we have a port ID
    const portId = parseInteger(day.portid);
    if (portId && day.name) {
      await client.query(`
        INSERT INTO ports (id, name)
        VALUES ($1, $2)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          updated_at = CURRENT_TIMESTAMP
      `, [portId, day.name]);
    }
    
    await client.query(`
      INSERT INTO itineraries (
        cruise_id, day_number, order_id, port_id, port_name, itinerary_name,
        arrive_date, depart_date, arrive_time, depart_time, latitude, longitude,
        description, short_description, itinerary_description,
        idl_crossed, supercedes, owner_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
    `, [
      cruiseId,
      parseInteger(day.day),
      parseInteger(day.orderid),
      portId,  // May be null if port doesn't exist
      day.name || null,
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
  
  progress.stats.itinerariesInserted += data.itinerary.length;
}

/**
 * Process static prices
 */
async function processStaticPrices(client, cruiseId, data) {
  if (!data.prices || typeof data.prices !== 'object') return;
  
  // Delete existing static prices for this cruise
  await client.query('DELETE FROM static_prices WHERE cruise_id = $1', [cruiseId]);
  
  for (const [rateCode, cabins] of Object.entries(data.prices)) {
    if (typeof cabins !== 'object') continue;
    
    for (const [cabinId, pricing] of Object.entries(cabins)) {
      if (typeof pricing !== 'object') continue;
      
      await client.query(`
        INSERT INTO static_prices (
          cruise_id, rate_code, cabin_id, cabin_type,
          price, adult_price, child_price, infant_price,
          third_adult_price, fourth_adult_price, fifth_adult_price, single_price,
          taxes, ncf, gratuity, fuel, noncomm
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (cruise_id, rate_code, cabin_id) DO UPDATE SET
          cabin_type = EXCLUDED.cabin_type,
          price = EXCLUDED.price,
          adult_price = EXCLUDED.adult_price,
          child_price = EXCLUDED.child_price,
          infant_price = EXCLUDED.infant_price,
          third_adult_price = EXCLUDED.third_adult_price,
          fourth_adult_price = EXCLUDED.fourth_adult_price,
          fifth_adult_price = EXCLUDED.fifth_adult_price,
          single_price = EXCLUDED.single_price,
          taxes = EXCLUDED.taxes,
          ncf = EXCLUDED.ncf,
          gratuity = EXCLUDED.gratuity,
          fuel = EXCLUDED.fuel,
          noncomm = EXCLUDED.noncomm,
          updated_at = CURRENT_TIMESTAMP
      `, [
        cruiseId,
        rateCode,
        cabinId,
        pricing.cabintype || null,
        parseDecimal(pricing.price),
        parseDecimal(pricing.adultprice),
        parseDecimal(pricing.childprice),
        parseDecimal(pricing.infantprice),
        parseDecimal(pricing.thirdadultprice),
        parseDecimal(pricing.fourthadultprice),
        parseDecimal(pricing.fifthadultprice),
        parseDecimal(pricing.singleprice),
        parseDecimal(pricing.taxes),
        parseDecimal(pricing.ncf),
        parseDecimal(pricing.gratuity),
        parseDecimal(pricing.fuel),
        parseDecimal(pricing.noncomm)
      ]);
      
      progress.stats.pricesInserted++;
    }
  }
}

/**
 * Process cached prices
 */
async function processCachedPrices(client, cruiseId, data) {
  if (!data.cachedprices || typeof data.cachedprices !== 'object') return;
  
  // Delete existing cached prices for this cruise
  await client.query('DELETE FROM cached_prices WHERE cruise_id = $1', [cruiseId]);
  
  for (const [rateCode, cabinArray] of Object.entries(data.cachedprices)) {
    if (!Array.isArray(cabinArray)) continue;
    
    for (const cabin of cabinArray) {
      await client.query(`
        INSERT INTO cached_prices (
          cruise_id, rate_code, cabin_id, cabin_code,
          price, taxes, ncf, fees,
          adults, children, infants,
          currency, fare_type, onboard_credit, obc_currency,
          cached_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (cruise_id, rate_code, cabin_id, adults, children, infants) DO UPDATE SET
          cabin_code = EXCLUDED.cabin_code,
          price = EXCLUDED.price,
          taxes = EXCLUDED.taxes,
          ncf = EXCLUDED.ncf,
          fees = EXCLUDED.fees,
          currency = EXCLUDED.currency,
          fare_type = EXCLUDED.fare_type,
          onboard_credit = EXCLUDED.onboard_credit,
          obc_currency = EXCLUDED.obc_currency,
          cached_at = EXCLUDED.cached_at
      `, [
        cruiseId,
        rateCode,
        cabin.cabinid || null,
        cabin.cabincode || null,
        parseDecimal(cabin.price),
        parseDecimal(cabin.taxes),
        parseDecimal(cabin.ncf),
        parseDecimal(cabin.fees),
        parseInteger(cabin.adults),
        parseInteger(cabin.children),
        parseInteger(cabin.infants),
        cabin.currency || 'USD',
        cabin.faretype || null,
        parseDecimal(cabin.onboardcredit),
        cabin.obccurrency || null,
        cabin.cachedat ? new Date(cabin.cachedat) : null
      ]);
      
      progress.stats.cachedPricesInserted++;
    }
  }
}

/**
 * Process cheapest prices
 */
async function processCheapestPrices(client, cruiseId, data) {
  // Extract cheapest prices from various sources
  const cheapest = data.cheapest || {};
  const staticPrices = cheapest.prices || {};
  const cachedPrices = cheapest.cachedprices || {};
  const combined = cheapest.combined || {};
  
  await client.query(`
    INSERT INTO cheapest_prices (
      cruise_id,
      static_inside, static_inside_code,
      static_outside, static_outside_code,
      static_balcony, static_balcony_code,
      static_suite, static_suite_code,
      cached_inside, cached_inside_code,
      cached_outside, cached_outside_code,
      cached_balcony, cached_balcony_code,
      cached_suite, cached_suite_code,
      combined_inside, combined_inside_code, combined_inside_source,
      combined_outside, combined_outside_code, combined_outside_source,
      combined_balcony, combined_balcony_code, combined_balcony_source,
      combined_suite, combined_suite_code, combined_suite_source,
      cheapest_price, cheapest_cabin_type
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31)
    ON CONFLICT (cruise_id) DO UPDATE SET
      static_inside = EXCLUDED.static_inside,
      static_inside_code = EXCLUDED.static_inside_code,
      static_outside = EXCLUDED.static_outside,
      static_outside_code = EXCLUDED.static_outside_code,
      static_balcony = EXCLUDED.static_balcony,
      static_balcony_code = EXCLUDED.static_balcony_code,
      static_suite = EXCLUDED.static_suite,
      static_suite_code = EXCLUDED.static_suite_code,
      cached_inside = EXCLUDED.cached_inside,
      cached_inside_code = EXCLUDED.cached_inside_code,
      cached_outside = EXCLUDED.cached_outside,
      cached_outside_code = EXCLUDED.cached_outside_code,
      cached_balcony = EXCLUDED.cached_balcony,
      cached_balcony_code = EXCLUDED.cached_balcony_code,
      cached_suite = EXCLUDED.cached_suite,
      cached_suite_code = EXCLUDED.cached_suite_code,
      combined_inside = EXCLUDED.combined_inside,
      combined_inside_code = EXCLUDED.combined_inside_code,
      combined_inside_source = EXCLUDED.combined_inside_source,
      combined_outside = EXCLUDED.combined_outside,
      combined_outside_code = EXCLUDED.combined_outside_code,
      combined_outside_source = EXCLUDED.combined_outside_source,
      combined_balcony = EXCLUDED.combined_balcony,
      combined_balcony_code = EXCLUDED.combined_balcony_code,
      combined_balcony_source = EXCLUDED.combined_balcony_source,
      combined_suite = EXCLUDED.combined_suite,
      combined_suite_code = EXCLUDED.combined_suite_code,
      combined_suite_source = EXCLUDED.combined_suite_source,
      cheapest_price = EXCLUDED.cheapest_price,
      cheapest_cabin_type = EXCLUDED.cheapest_cabin_type,
      last_updated = CURRENT_TIMESTAMP
  `, [
    cruiseId,
    parseDecimal(staticPrices.inside),
    staticPrices.insidepricecode || null,
    parseDecimal(staticPrices.outside),
    staticPrices.outsidepricecode || null,
    parseDecimal(staticPrices.balcony),
    staticPrices.balconypricecode || null,
    parseDecimal(staticPrices.suite),
    staticPrices.suitepricecode || null,
    parseDecimal(cachedPrices.inside),
    cachedPrices.insidepricecode || null,
    parseDecimal(cachedPrices.outside),
    cachedPrices.outsidepricecode || null,
    parseDecimal(cachedPrices.balcony),
    cachedPrices.balconypricecode || null,
    parseDecimal(cachedPrices.suite),
    cachedPrices.suitepricecode || null,
    parseDecimal(combined.inside),
    combined.insidepricecode || null,
    combined.insidesource || null,
    parseDecimal(combined.outside),
    combined.outsidepricecode || null,
    combined.outsidesource || null,
    parseDecimal(combined.balcony),
    combined.balconypricecode || null,
    combined.balconysource || null,
    parseDecimal(combined.suite),
    combined.suitepricecode || null,
    combined.suitesource || null,
    parseDecimal(data.cheapestprice),
    data.cheapestinside ? 'inside' : (data.cheapestoutside ? 'outside' : (data.cheapestbalcony ? 'balcony' : 'suite'))
  ]);
}

/**
 * Process alternative sailings
 */
async function processAlternativeSailings(client, cruiseId, data) {
  if (!data.altsailings || typeof data.altsailings !== 'object') return;
  
  // Delete existing alternative sailings
  await client.query('DELETE FROM alternative_sailings WHERE cruise_id = $1', [cruiseId]);
  
  for (const [altCruiseCode, sailing] of Object.entries(data.altsailings)) {
    await client.query(`
      INSERT INTO alternative_sailings (
        cruise_id, alt_cruise_code_to_id, sail_date, start_date,
        ship_id, voyage_code, lead_price
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (cruise_id, alt_cruise_code_to_id) DO UPDATE SET
        sail_date = EXCLUDED.sail_date,
        start_date = EXCLUDED.start_date,
        ship_id = EXCLUDED.ship_id,
        voyage_code = EXCLUDED.voyage_code,
        lead_price = EXCLUDED.lead_price
    `, [
      cruiseId,
      parseInteger(altCruiseCode),
      parseDate(sailing.saildate),
      parseDate(sailing.startdate),
      parseInteger(sailing.shipid),
      sailing.voyagecode || null,
      parseDecimal(sailing.leadprice)
    ]);
  }
}

/**
 * Process a single cruise file
 */
async function processCruiseFile(client, filePath, data) {
  try {
    await client.query('BEGIN');
    
    // Process all data components
    await processCruiseLine(client, data);
    await processShip(client, data);
    await processPorts(client, data);
    await processRegions(client, data);
    await processCabinTypes(client, data.shipid, data);
    await processCruise(client, data, filePath);
    
    const cruiseId = data.cruiseid;
    if (cruiseId) {
      await processItinerary(client, cruiseId, data);
      await processStaticPrices(client, cruiseId, data);
      await processCachedPrices(client, cruiseId, data);
      await processCheapestPrices(client, cruiseId, data);
      await processAlternativeSailings(client, cruiseId, data);
    }
    
    await client.query('COMMIT');
    
    progress.processedFiles.push(filePath);
    saveProgress();
    
    console.log(`✅ Processed: ${filePath}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`❌ Error processing ${filePath}:`, error.message);
    progress.stats.errors++;
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
            
            // Skip if already processed
            if (progress.currentLineId && lineId < progress.currentLineId) continue;
            
            console.log(`\n📁 Processing Line ${lineId}...`);
            progress.currentLineId = lineId;
            
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
                  
                  // Skip if already processed
                  if (progress.currentShipId && shipId < progress.currentShipId) continue;
                  
                  console.log(`  📁 Ship ${shipId}...`);
                  progress.currentShipId = shipId;
                  
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
                        if (progress.processedFiles.includes(filePath)) continue;
                        
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
                
                progress.currentShipId = null;
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
    }
  }
  
  saveProgress();
}

// Main execution
async function main() {
  try {
    console.log('🚀 Starting Traveltek Complete Sync');
    console.log(`📅 Year: ${YEAR}, Month: ${MONTH}`);
    console.log(`📦 Batch size: ${BATCH_SIZE}`);
    console.log(`📂 Resume: ${RESUME}\n`);
    
    await syncFromFTP();
    
    console.log('\n✅ Sync completed!');
    console.log('\n📊 Statistics:');
    console.log(`   Cruises processed: ${progress.stats.cruisesProcessed}`);
    console.log(`   Static prices inserted: ${progress.stats.pricesInserted}`);
    console.log(`   Cached prices inserted: ${progress.stats.cachedPricesInserted}`);
    console.log(`   Itineraries inserted: ${progress.stats.itinerariesInserted}`);
    console.log(`   Errors: ${progress.stats.errors}`);
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the sync
main();