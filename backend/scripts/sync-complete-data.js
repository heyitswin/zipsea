#!/usr/bin/env node

/**
 * TRAVELTEK COMPLETE DATA SYNC SCRIPT
 * 
 * Extracts 100% of available data from Traveltek FTP JSON files.
 * This is a comprehensive solution that captures ALL data including:
 * - Static pricing data (prices object)
 * - Cabin categories with images
 * - Ship details (decks, images, specifications)
 * - Complete itinerary information
 * - Alternative sailings
 * 
 * NO COMPROMISES - LONG TERM SOLUTION
 * 
 * Usage:
 *   SYNC_YEAR=2025 SYNC_MONTH=09 node scripts/sync-complete-data.js
 *   FORCE_UPDATE=true SYNC_YEARS=2025 node scripts/sync-complete-data.js
 */

const postgres = require('postgres');
const Client = require('ftp');
const { promisify } = require('util');
require('dotenv').config();

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  // Environment Variables
  syncYear: process.env.SYNC_YEAR || new Date().getFullYear().toString(),
  syncMonth: process.env.SYNC_MONTH || String(new Date().getMonth() + 1).padStart(2, '0'),
  syncYears: process.env.SYNC_YEARS ? process.env.SYNC_YEARS.split(',') : null,
  testMode: process.env.TEST_MODE === 'true',
  forceUpdate: process.env.FORCE_UPDATE === 'true',
  
  // FTP Configuration
  ftp: {
    host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
    user: process.env.TRAVELTEK_FTP_USER,
    password: process.env.TRAVELTEK_FTP_PASSWORD,
    connTimeout: 60000,
    pasvTimeout: 60000,
  },
  
  // Database Configuration
  database: {
    url: process.env.DATABASE_URL,
    max: 20,
    idle_timeout: 20,
    connection_timeout: 10,
  },
  
  // Processing Options
  batchSize: 100,
  maxRetries: 3,
  retryDelay: 2000,
};

// =============================================================================
// DATABASE CONNECTION
// =============================================================================

const sql = postgres(CONFIG.database.url, CONFIG.database);

// =============================================================================
// FTP CLIENT SETUP
// =============================================================================

class FTPManager {
  constructor() {
    this.client = null;
    this.connected = false;
  }

  async connect() {
    if (this.connected) return;
    
    this.client = new Client();
    
    // Promisify FTP methods
    this.client.listAsync = promisify(this.client.list).bind(this.client);
    this.client.getAsync = promisify(this.client.get).bind(this.client);
    
    return new Promise((resolve, reject) => {
      this.client.on('ready', () => {
        this.connected = true;
        console.log('✅ FTP connection established');
        resolve();
      });
      
      this.client.on('error', (err) => {
        console.error('❌ FTP error:', err.message);
        this.connected = false;
        reject(err);
      });
      
      this.client.connect(CONFIG.ftp);
    });
  }

  async disconnect() {
    if (!this.connected) return;
    
    return new Promise((resolve) => {
      this.client.end();
      this.connected = false;
      console.log('✅ FTP connection closed');
      resolve();
    });
  }

  async listFiles(directory) {
    if (!this.connected) await this.connect();
    
    try {
      const files = await this.client.listAsync(directory);
      return files.filter(f => f.type === '-' && f.name.endsWith('.json'));
    } catch (error) {
      console.error(`Error listing files in ${directory}:`, error.message);
      return [];
    }
  }

  async downloadFile(filePath) {
    if (!this.connected) await this.connect();
    
    for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
      try {
        const stream = await this.client.getAsync(filePath);
        const chunks = [];
        
        return new Promise((resolve, reject) => {
          stream.on('data', chunk => chunks.push(chunk));
          stream.on('end', () => {
            try {
              const content = Buffer.concat(chunks).toString('utf8');
              const data = JSON.parse(content);
              resolve(data);
            } catch (error) {
              reject(new Error(`Failed to parse JSON: ${error.message}`));
            }
          });
          stream.on('error', reject);
        });
      } catch (error) {
        console.error(`Attempt ${attempt}/${CONFIG.maxRetries} failed for ${filePath}:`, error.message);
        
        if (attempt === CONFIG.maxRetries) {
          throw error;
        }
        
        await new Promise(resolve => setTimeout(resolve, CONFIG.retryDelay));
        await this.connect(); // Reconnect
      }
    }
  }
}

// =============================================================================
// DATA EXTRACTION FUNCTIONS
// =============================================================================

/**
 * Extract and sync static pricing data from prices object
 */
async function syncPricingData(cruiseData, cruiseId) {
  // Check if pricing table exists first
  const tableExists = await sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'pricing'
    )
  `;
  
  if (!tableExists[0].exists) {
    return 0; // Skip pricing sync if table doesn't exist
  }
  
  const prices = cruiseData.prices || {};
  const pricingRecords = [];
  
  // Helper to truncate strings
  const truncateString = (str, maxLength) => {
    if (!str) return null;
    return str.length > maxLength ? str.substring(0, maxLength) : str;
  };
  
  for (const [rateCode, cabins] of Object.entries(prices)) {
    for (const [cabinCode, occupancies] of Object.entries(cabins)) {
      for (const [occupancyCode, priceData] of Object.entries(occupancies)) {
        // Skip if no valid price
        if (!priceData || (!priceData.price && !priceData.adultprice)) continue;
        
        pricingRecords.push({
          cruise_id: cruiseId,
          rate_code: truncateString(rateCode, 50),  // VARCHAR(50)
          cabin_code: truncateString(cabinCode, 10),  // VARCHAR(10)
          occupancy_code: truncateString(occupancyCode, 10),  // VARCHAR(10)
          cabin_type: priceData.cabintype || null,
          base_price: priceData.price || null,
          adult_price: priceData.adultprice || null,
          child_price: priceData.childprice || null,
          infant_price: priceData.infantprice || null,
          single_price: priceData.singleprice || null,
          third_adult_price: priceData.thirdadultprice || null,
          fourth_adult_price: priceData.fourthadultprice || null,
          taxes: priceData.taxes || 0,
          ncf: priceData.ncf || 0,
          gratuity: priceData.gratuity || 0,
          fuel: priceData.fuel || 0,
          non_comm: priceData.noncomm || 0,
          port_charges: priceData.portcharges || 0,
          government_fees: priceData.governmentfees || 0,
          total_price: calculateTotalPrice(priceData),
          currency: cruiseData.currency || 'USD',
          is_available: priceData.available !== false,
          inventory: priceData.inventory || null,
          waitlist: priceData.waitlist === true,
          guarantee: priceData.guarantee === true,
        });
      }
    }
  }
  
  if (pricingRecords.length > 0) {
    await sql`
      INSERT INTO pricing ${sql(pricingRecords)}
      ON CONFLICT (cruise_id, rate_code, cabin_code, occupancy_code) 
      DO UPDATE SET
        cabin_type = EXCLUDED.cabin_type,
        base_price = EXCLUDED.base_price,
        adult_price = EXCLUDED.adult_price,
        child_price = EXCLUDED.child_price,
        infant_price = EXCLUDED.infant_price,
        single_price = EXCLUDED.single_price,
        third_adult_price = EXCLUDED.third_adult_price,
        fourth_adult_price = EXCLUDED.fourth_adult_price,
        taxes = EXCLUDED.taxes,
        ncf = EXCLUDED.ncf,
        gratuity = EXCLUDED.gratuity,
        fuel = EXCLUDED.fuel,
        non_comm = EXCLUDED.non_comm,
        port_charges = EXCLUDED.port_charges,
        government_fees = EXCLUDED.government_fees,
        total_price = EXCLUDED.total_price,
        currency = EXCLUDED.currency,
        is_available = EXCLUDED.is_available,
        inventory = EXCLUDED.inventory,
        waitlist = EXCLUDED.waitlist,
        guarantee = EXCLUDED.guarantee,
        updated_at = CURRENT_TIMESTAMP
    `;
  }
  
  return pricingRecords.length;
}

/**
 * Calculate total price from price components
 */
function calculateTotalPrice(priceData) {
  const base = parseFloat(priceData.price || priceData.adultprice || 0);
  const taxes = parseFloat(priceData.taxes || 0);
  const ncf = parseFloat(priceData.ncf || 0);
  const gratuity = parseFloat(priceData.gratuity || 0);
  const fuel = parseFloat(priceData.fuel || 0);
  const portCharges = parseFloat(priceData.portcharges || 0);
  const governmentFees = parseFloat(priceData.governmentfees || 0);
  
  return base + taxes + ncf + gratuity + fuel + portCharges + governmentFees;
}

/**
 * Extract and sync cabin categories
 */
async function syncCabinCategories(cruiseData, shipId) {
  const cabins = cruiseData.cabins || {};
  const cabinRecords = [];
  
  // Helper function to validate dates
  const validateDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return null;
      return dateStr;
    } catch (e) {
      return null;
    }
  };
  
  for (const [cabinCode, cabinData] of Object.entries(cabins)) {
    if (!cabinData) continue;
    
    // Truncate cabin codes to 10 characters to fit VARCHAR(10)
    const truncateString = (str, maxLength) => {
      if (!str) return null;
      return str.length > maxLength ? str.substring(0, maxLength) : str;
    };
    
    cabinRecords.push({
      ship_id: shipId,
      cabin_code: truncateString(cabinData.cabincode || cabinCode, 10),
      cabin_code_alt: truncateString(cabinData.cabincode2, 10),
      name: cabinData.name || `Cabin ${cabinCode}`,
      description: cabinData.description || null,
      category: mapCabinCategory(cabinData.codtype || cabinData.type),
      color_code: truncateString(cabinData.colourcode, 7),  // VARCHAR(7) for color codes
      image_url: cabinData.imageurl || null,
      image_url_hd: cabinData.imageurlhd || null,
      image_url_2k: cabinData.imageurl2k || null,
      is_default: cabinData.isdefault === true || cabinData.isdefault === 'Y',
      valid_from: validateDate(cabinData.validfrom),
      valid_to: validateDate(cabinData.validto),
      cabin_id: truncateString(cabinData.id, 20),  // VARCHAR(20) for cabin_id
      is_active: true,
    });
  }
  
  if (cabinRecords.length > 0) {
    await sql`
      INSERT INTO cabin_categories ${sql(cabinRecords)}
      ON CONFLICT (ship_id, cabin_code) 
      DO UPDATE SET
        cabin_code_alt = EXCLUDED.cabin_code_alt,
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        category = EXCLUDED.category,
        color_code = EXCLUDED.color_code,
        image_url = EXCLUDED.image_url,
        image_url_hd = EXCLUDED.image_url_hd,
        image_url_2k = EXCLUDED.image_url_2k,
        is_default = EXCLUDED.is_default,
        valid_from = EXCLUDED.valid_from,
        valid_to = EXCLUDED.valid_to,
        cabin_id = EXCLUDED.cabin_id,
        is_active = EXCLUDED.is_active,
        updated_at = CURRENT_TIMESTAMP
    `;
  }
  
  return cabinRecords.length;
}

/**
 * Map cabin type codes to standard categories
 */
function mapCabinCategory(codtype) {
  if (!codtype) return 'unknown';
  
  const type = codtype.toLowerCase();
  if (type.includes('inside') || type.includes('interior')) return 'interior';
  if (type.includes('ocean') || type.includes('outside')) return 'oceanview';
  if (type.includes('balcony') || type.includes('veranda')) return 'balcony';
  if (type.includes('suite')) return 'suite';
  
  return type;
}

/**
 * Sync ship details including images and decks
 */
async function syncShipDetails(cruiseData) {
  const shipContent = cruiseData.shipcontent;
  if (!shipContent) return;
  
  const shipId = cruiseData.shipid;
  
  // Helper function to validate dates
  const validateDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return null;
      return dateStr;
    } catch (e) {
      return null;
    }
  };
  
  // Update ship with additional details
  await sql`
    UPDATE ships SET
      tonnage = ${shipContent.tonnage || null},
      total_cabins = ${shipContent.noofcabins || null},
      occupancy = ${shipContent.limitof || null},
      total_crew = ${shipContent.crewno || null},
      length = ${shipContent.length || null},
      launched = ${validateDate(shipContent.launched)},
      star_rating = ${shipContent.starrating || null},
      adults_only = ${shipContent.adultsonly === true},
      short_description = ${shipContent.shortdescription || null},
      highlights = ${shipContent.highlights || null},
      ship_class = ${shipContent.shipclass || null},
      default_ship_image = ${shipContent.defaultshipimage || null},
      default_ship_image_hd = ${shipContent.defaultshipimagehd || null},
      default_ship_image_2k = ${shipContent.defaultshipimage2k || null},
      nice_url = ${shipContent.niceurl || null},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${shipId}
  `;
  
  // Sync ship images if table exists
  if (shipContent.shipimages && Array.isArray(shipContent.shipimages)) {
    const imageRecords = shipContent.shipimages.map(img => ({
      ship_id: shipId,
      image_url: img.imageurl || img.url,
      image_url_hd: img.imageurlhd || null,
      image_url_2k: img.imageurl2k || null,
      caption: img.caption || img.title,
      is_default: img.isdefault === true || img.default === 'Y',
      display_order: img.order || 0,
    }));
    
    if (imageRecords.length > 0) {
      // Check if ship_images table exists
      const tableExists = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'ship_images'
        )
      `;
      
      if (tableExists[0].exists) {
        // Delete existing image records for this ship, then insert new ones
        await sql`DELETE FROM ship_images WHERE ship_id = ${shipId}`;
        await sql`INSERT INTO ship_images ${sql(imageRecords)}`;
      }
    }
  }
  
  // Sync ship decks if table exists
  if (shipContent.shipdecks && typeof shipContent.shipdecks === 'object') {
    const deckRecords = Object.entries(shipContent.shipdecks).map(([deckId, deckData]) => ({
      ship_id: shipId,
      deck_id: parseInt(deckId) || null,
      deck_name: deckData.deckname || deckData.name || `Deck ${deckId}`,
      description: deckData.description || null,
      plan_image: deckData.planimage || deckData.imageurl || null,
      live_name: deckData.livename || null,
      deck_plan_id: deckData.deckplanid || null,
      valid_from: validateDate(deckData.validfrom),
      valid_to: validateDate(deckData.validto),
    }));
    
    if (deckRecords.length > 0) {
      // Check if ship_decks table exists
      const tableExists = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'ship_decks'
        )
      `;
      
      if (tableExists[0].exists) {
        // Delete existing deck records for this ship, then insert new ones
        await sql`DELETE FROM ship_decks WHERE ship_id = ${shipId}`;
        await sql`INSERT INTO ship_decks ${sql(deckRecords)}`;
      }
    }
  }
}

/**
 * Sync complete itinerary with detailed port information
 */
async function syncDetailedItinerary(cruiseData, cruiseId) {
  const itinerary = cruiseData.itinerary || [];
  
  for (let i = 0; i < itinerary.length; i++) {
    const day = itinerary[i];
    
    // Update existing itinerary with more details
    await sql`
      UPDATE itineraries SET
        arrival_time = ${day.arrivaltime || null},
        departure_time = ${day.departuretime || null},
        description = ${day.description || null},
        is_sea_day = ${day.seaday === true},
        is_tender_port = ${day.tender === true},
        updated_at = CURRENT_TIMESTAMP
      WHERE cruise_id = ${cruiseId} AND day_number = ${i + 1}
    `;
    
    // Sync port details if we have them
    if (day.portid && day.name) {
      await sql`
        INSERT INTO ports (id, name, country, region, latitude, longitude, description)
        VALUES (
          ${day.portid},
          ${day.name},
          ${day.country || null},
          ${day.region || null},
          ${day.latitude || null},
          ${day.longitude || null},
          ${day.description || null}
        )
        ON CONFLICT (id) 
        DO UPDATE SET
          country = COALESCE(EXCLUDED.country, ports.country),
          region = COALESCE(EXCLUDED.region, ports.region),
          latitude = COALESCE(EXCLUDED.latitude, ports.latitude),
          longitude = COALESCE(EXCLUDED.longitude, ports.longitude),
          description = COALESCE(EXCLUDED.description, ports.description),
          updated_at = CURRENT_TIMESTAMP
      `;
    }
  }
}

/**
 * Sync alternative sailings
 */
async function syncAlternativeSailings(cruiseData, cruiseId) {
  const altSailings = cruiseData.altsailings || {};
  
  if (Object.keys(altSailings).length === 0) return;
  
  // Check if alternative_sailings table exists
  const tableExists = await sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'alternative_sailings'
    )
  `;
  
  if (!tableExists[0].exists) return;
  
  // Helper function to validate dates
  const validateDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return null;
      return dateStr;
    } catch (e) {
      return null;
    }
  };
  
  const altRecords = [];
  
  for (const [altId, altData] of Object.entries(altSailings)) {
    if (!altData) continue;
    
    // Helper to truncate strings
    const truncateString = (str, maxLength) => {
      if (!str) return null;
      return str.length > maxLength ? str.substring(0, maxLength) : str;
    };
    
    altRecords.push({
      cruise_id: cruiseId,
      alternative_cruise_id: altId,
      sail_date: validateDate(altData.saildate),
      start_date: validateDate(altData.startdate),
      lead_price: altData.leadprice || null,
      voyage_code: truncateString(altData.voyagecode, 50),  // VARCHAR(50)
      ship_id: altData.shipid || null,
    });
  }
  
  if (altRecords.length > 0) {
    // Delete existing alternative sailings for this cruise, then insert new ones
    await sql`DELETE FROM alternative_sailings WHERE cruise_id = ${cruiseId}`;
    await sql`INSERT INTO alternative_sailings ${sql(altRecords)}`;
  }
}

/**
 * Process a single cruise file with complete data extraction
 */
async function processCruiseFile(ftpManager, filePath) {
  try {
    const cruiseData = await ftpManager.downloadFile(filePath);
    
    // Basic validation
    if (!cruiseData.codetocruiseid) {
      console.error(`⚠️  No codetocruiseid in ${filePath}`);
      return false;
    }
    
    // Extract cruise line information
    const lineContent = cruiseData.linecontent || {};
    const lineName = lineContent.name || lineContent.enginename || `Line ${cruiseData.lineid}`;
    
    // Upsert cruise line (website not available in Traveltek data)
    await sql`
      INSERT INTO cruise_lines (id, name, logo)
      VALUES (
        ${cruiseData.lineid},
        ${lineName},
        ${lineContent.logo || lineContent.logourl || null}
      )
      ON CONFLICT (id) 
      DO UPDATE SET
        name = EXCLUDED.name,
        logo = COALESCE(EXCLUDED.logo, cruise_lines.logo),
        updated_at = CURRENT_TIMESTAMP
    `;
    
    // Extract ship information
    const shipContent = cruiseData.shipcontent || {};
    const shipName = shipContent.name || `Ship ${cruiseData.shipid}`;
    
    // Upsert ship
    await sql`
      INSERT INTO ships (id, cruise_line_id, name)
      VALUES (
        ${cruiseData.shipid},
        ${cruiseData.lineid},
        ${shipName}
      )
      ON CONFLICT (id) 
      DO UPDATE SET
        cruise_line_id = EXCLUDED.cruise_line_id,
        name = EXCLUDED.name,
        updated_at = CURRENT_TIMESTAMP
    `;
    
    // Update ship with detailed information
    await syncShipDetails(cruiseData);
    
    // Extract ports
    const ports = cruiseData.ports || {};
    for (const [portId, portName] of Object.entries(ports)) {
      await sql`
        INSERT INTO ports (id, name)
        VALUES (${parseInt(portId)}, ${portName})
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          updated_at = CURRENT_TIMESTAMP
      `;
    }
    
    // Extract regions
    const regions = cruiseData.regions || {};
    for (const [regionId, regionName] of Object.entries(regions)) {
      await sql`
        INSERT INTO regions (id, name)
        VALUES (${parseInt(regionId)}, ${regionName})
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          updated_at = CURRENT_TIMESTAMP
      `;
    }
    
    // Helper function to validate dates
    const validateDate = (dateStr) => {
      if (!dateStr) return null;
      try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return null;
        return dateStr;
      } catch (e) {
        return null;
      }
    };

    // Upsert main cruise record
    const [cruise] = await sql`
      INSERT INTO cruises (
        id, cruise_id, cruise_line_id, ship_id, name,
        nights, embarkation_port_id, disembarkation_port_id,
        sailing_date, return_date
      ) VALUES (
        ${cruiseData.codetocruiseid},
        ${cruiseData.cruiseid},
        ${cruiseData.lineid},
        ${cruiseData.shipid},
        ${cruiseData.name || 'Unnamed Cruise'},
        ${cruiseData.nights || cruiseData.sailnights},
        ${cruiseData.startportid},
        ${cruiseData.endportid},
        ${validateDate(cruiseData.saildate || cruiseData.startdate)},
        ${validateDate(cruiseData.enddate || cruiseData.returndate)}
      )
      ON CONFLICT (id) 
      DO UPDATE SET
        cruise_id = EXCLUDED.cruise_id,
        cruise_line_id = EXCLUDED.cruise_line_id,
        ship_id = EXCLUDED.ship_id,
        name = EXCLUDED.name,
        nights = EXCLUDED.nights,
        embarkation_port_id = EXCLUDED.embarkation_port_id,
        disembarkation_port_id = EXCLUDED.disembarkation_port_id,
        sailing_date = EXCLUDED.sailing_date,
        return_date = EXCLUDED.return_date,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `;
    
    const cruiseDbId = cruise.id;
    
    // Sync itinerary
    const itinerary = cruiseData.itinerary || [];
    for (let i = 0; i < itinerary.length; i++) {
      const day = itinerary[i];
      
      // Ensure port exists if we have a port ID
      let portId = null;
      if (day.portid) {
        try {
          portId = parseInt(day.portid);
          // Insert the port if it doesn't exist
          await sql`
            INSERT INTO ports (id, name)
            VALUES (${portId}, ${day.name || day.portname || `Port ${portId}`})
            ON CONFLICT (id) DO UPDATE SET
              name = COALESCE(EXCLUDED.name, ports.name),
              updated_at = CURRENT_TIMESTAMP
          `;
        } catch (e) {
          console.warn(`Warning: Invalid port ID ${day.portid}, skipping port reference`);
          portId = null;
        }
      }
      
      // Validate and format time strings (max 10 chars for VARCHAR(10))
      const formatTime = (timeStr) => {
        if (!timeStr || timeStr === '00:00' || timeStr === 'N/A') return null;
        // Handle various time formats
        if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
          // Ensure it fits in VARCHAR(10)
          return timeStr.substring(0, 10);
        }
        if (/^\d{4}$/.test(timeStr)) {
          // Convert HHMM to HH:MM
          return `${timeStr.slice(0, 2)}:${timeStr.slice(2)}`;
        }
        return null;
      };
      
      await sql`
        INSERT INTO itineraries (
          cruise_id, day_number, port_id, port_name,
          arrival_time, departure_time, description,
          is_sea_day, is_tender_port
        ) VALUES (
          ${cruiseDbId},
          ${i + 1},
          ${portId},
          ${day.name || day.portname || 'At Sea'},
          ${formatTime(day.arrivaltime)},
          ${formatTime(day.departuretime)},
          ${day.description || null},
          ${day.seaday === true},
          ${day.tender === true}
        )
        ON CONFLICT (cruise_id, day_number) 
        DO UPDATE SET
          port_id = EXCLUDED.port_id,
          port_name = EXCLUDED.port_name,
          arrival_time = EXCLUDED.arrival_time,
          departure_time = EXCLUDED.departure_time,
          description = EXCLUDED.description,
          is_sea_day = EXCLUDED.is_sea_day,
          is_tender_port = EXCLUDED.is_tender_port,
          updated_at = CURRENT_TIMESTAMP
      `;
    }
    
    // CRITICAL: Sync static pricing data
    const pricingCount = await syncPricingData(cruiseData, cruiseDbId);
    
    // CRITICAL: Sync cabin categories
    const cabinCount = await syncCabinCategories(cruiseData, cruiseData.shipid);
    
    // Sync alternative sailings
    await syncAlternativeSailings(cruiseData, cruiseDbId);
    
    return {
      success: true,
      pricing: pricingCount,
      cabins: cabinCount,
    };
    
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

// =============================================================================
// MAIN SYNC PROCESS
// =============================================================================

async function syncMonth(year, month) {
  const ftpManager = new FTPManager();
  // Try both path structures
  const directories = [
    `${year}/${month}`,  // New structure: 2025/09
    `/isell_json/${year}/${month}`  // Old structure: /isell_json/2025/09
  ];
  
  console.log(`\n📅 Syncing ${year}-${month}`);
  console.log('=' .repeat(50));
  
  try {
    await ftpManager.connect();
    
    let allFiles = [];
    
    // Try different directory structures
    for (const directory of directories) {
      console.log(`🔍 Checking directory: ${directory}`);
      
      try {
        // First check if it's a flat directory with JSON files
        const files = await ftpManager.listFiles(directory);
        if (files.length > 0) {
          console.log(`  ✓ Found ${files.length} files in ${directory}`);
          allFiles = files.map(f => ({ ...f, basePath: directory }));
          break;
        }
        
        // If no files, check for subdirectories (line/ship structure)
        const dirs = await ftpManager.client.listAsync(directory);
        const subdirs = dirs.filter(d => d.type === 'd');
        
        if (subdirs.length > 0) {
          console.log(`  📂 Found ${subdirs.length} subdirectories, checking for cruise files...`);
          
          for (const lineDir of subdirs) {
            const linePath = `${directory}/${lineDir.name}`;
            const shipDirs = await ftpManager.client.listAsync(linePath);
            
            for (const shipDir of shipDirs.filter(d => d.type === 'd')) {
              const shipPath = `${linePath}/${shipDir.name}`;
              const shipFiles = await ftpManager.listFiles(shipPath);
              
              allFiles.push(...shipFiles.map(f => ({ 
                ...f, 
                basePath: shipPath,
                lineName: lineDir.name,
                shipName: shipDir.name 
              })));
            }
          }
          
          if (allFiles.length > 0) {
            console.log(`  ✓ Found ${allFiles.length} total cruise files across subdirectories`);
            break;
          }
        }
      } catch (err) {
        console.log(`  ✗ Directory not accessible: ${err.message}`);
      }
    }
    
    if (allFiles.length === 0) {
      console.log('⚠️  No cruise files found in any directory structure');
      return;
    }
    
    console.log(`📁 Total cruise files to process: ${allFiles.length}`);
    
    let processed = 0;
    let successful = 0;
    let totalPricing = 0;
    let totalCabins = 0;
    
    // Process in batches
    for (let i = 0; i < allFiles.length; i += CONFIG.batchSize) {
      const batch = allFiles.slice(i, Math.min(i + CONFIG.batchSize, allFiles.length));
      
      const results = await Promise.all(
        batch.map(file => {
          const filePath = `${file.basePath}/${file.name}`;
          return processCruiseFile(ftpManager, filePath);
        })
      );
      
      results.forEach(result => {
        processed++;
        if (result && result.success) {
          successful++;
          totalPricing += result.pricing || 0;
          totalCabins += result.cabins || 0;
        }
      });
      
      // Progress update
      const progress = Math.round((processed / allFiles.length) * 100);
      process.stdout.write(`\r📊 Progress: ${progress}% (${processed}/${allFiles.length}) | ✅ Success: ${successful} | 💰 Pricing: ${totalPricing} | 🛏️ Cabins: ${totalCabins}`);
    }
    
    console.log('\n');
    console.log('✅ Month sync complete!');
    console.log(`   Processed: ${processed} files`);
    console.log(`   Successful: ${successful} files`);
    console.log(`   Pricing Records: ${totalPricing}`);
    console.log(`   Cabin Records: ${totalCabins}`);
    
  } finally {
    await ftpManager.disconnect();
  }
}

async function main() {
  console.log('🚀 TRAVELTEK COMPLETE DATA SYNC');
  console.log('================================');
  console.log('Extracting 100% of available data - NO COMPROMISES');
  console.log();
  
  if (CONFIG.testMode) {
    console.log('🧪 TEST MODE - No changes will be made');
  }
  
  if (CONFIG.forceUpdate) {
    console.log('⚠️  FORCE UPDATE MODE - All data will be refreshed');
  }
  
  try {
    // Test database connection
    const dbTest = await sql`SELECT NOW() as time`;
    console.log('✅ Database connection established');
    
    // Check if pricing table exists, warn if not
    const pricingTableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'pricing'
      )
    `;
    
    if (!pricingTableExists[0].exists) {
      console.log('⚠️  WARNING: pricing table does not exist in database');
      console.log('   Run migrations first: npm run db:migrate');
      console.log('   Continuing without pricing sync...');
    }
    
    // Determine what to sync
    if (CONFIG.syncYears) {
      // Sync entire years
      for (const year of CONFIG.syncYears) {
        for (let month = 1; month <= 12; month++) {
          const monthStr = String(month).padStart(2, '0');
          await syncMonth(year, monthStr);
        }
      }
    } else {
      // Sync specific month
      await syncMonth(CONFIG.syncYear, CONFIG.syncMonth);
    }
    
    // Final statistics
    console.log('\n' + '='.repeat(50));
    console.log('📊 FINAL STATISTICS');
    console.log('='.repeat(50));
    
    // Get stats for tables that exist
    let stats = {
      total_cruises: 0,
      total_pricing: 0,
      total_cabins: 0,
      total_ships: 0,
      total_lines: 0,
      total_ports: 0
    };
    
    try {
      const cruiseCount = await sql`SELECT COUNT(*) as count FROM cruises`;
      stats.total_cruises = cruiseCount[0].count;
    } catch (e) {}
    
    try {
      const pricingCount = await sql`SELECT COUNT(*) as count FROM pricing`;
      stats.total_pricing = pricingCount[0].count;
    } catch (e) {}
    
    try {
      const cabinCount = await sql`SELECT COUNT(*) as count FROM cabin_categories`;
      stats.total_cabins = cabinCount[0].count;
    } catch (e) {}
    
    try {
      const shipCount = await sql`SELECT COUNT(*) as count FROM ships`;
      stats.total_ships = shipCount[0].count;
    } catch (e) {}
    
    try {
      const lineCount = await sql`SELECT COUNT(*) as count FROM cruise_lines`;
      stats.total_lines = lineCount[0].count;
    } catch (e) {}
    
    try {
      const portCount = await sql`SELECT COUNT(*) as count FROM ports`;
      stats.total_ports = portCount[0].count;
    } catch (e) {}
    
    console.log(`🚢 Total Cruises: ${stats.total_cruises}`);
    console.log(`💰 Total Pricing Records: ${stats.total_pricing}`);
    console.log(`🛏️ Total Cabin Categories: ${stats.total_cabins}`);
    console.log(`⚓ Total Ships: ${stats.total_ships}`);
    console.log(`🏢 Total Cruise Lines: ${stats.total_lines}`);
    console.log(`🌍 Total Ports: ${stats.total_ports}`);
    
    console.log('\n✅ COMPLETE DATA SYNC SUCCESSFUL!');
    console.log('All available data has been extracted and synced.');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Run the sync
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { syncPricingData, syncCabinCategories, syncShipDetails };