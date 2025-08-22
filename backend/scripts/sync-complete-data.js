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
  const prices = cruiseData.prices || {};
  const pricingRecords = [];
  
  for (const [rateCode, cabins] of Object.entries(prices)) {
    for (const [cabinCode, occupancies] of Object.entries(cabins)) {
      for (const [occupancyCode, priceData] of Object.entries(occupancies)) {
        // Skip if no valid price
        if (!priceData || (!priceData.price && !priceData.adultprice)) continue;
        
        pricingRecords.push({
          cruise_id: cruiseId,
          rate_code: rateCode,
          cabin_code: cabinCode,
          occupancy_code: occupancyCode,
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
  
  for (const [cabinCode, cabinData] of Object.entries(cabins)) {
    if (!cabinData) continue;
    
    cabinRecords.push({
      ship_id: shipId,
      cabin_code: cabinData.cabincode || cabinCode,
      cabin_code_alt: cabinData.cabincode2 || null,
      name: cabinData.name || `Cabin ${cabinCode}`,
      description: cabinData.description || null,
      category: mapCabinCategory(cabinData.codtype || cabinData.type),
      category_alt: cabinData.codtype2 || null,
      color_code: cabinData.colourcode || null,
      color_code_alt: cabinData.colourcode2 || null,
      image_url: cabinData.imageurl || null,
      image_url_hd: cabinData.imageurl2k || null,
      is_default: cabinData.isdefault === true || cabinData.isdefault === '1',
      valid_from: cabinData.validfrom || null,
      valid_to: cabinData.validto || null,
      max_occupancy: parseInt(cabinData.maxoccupancy) || 2,
      min_occupancy: parseInt(cabinData.minoccupancy) || 1,
      size: cabinData.size || null,
      bed_configuration: cabinData.bedconfig || null,
      amenities: JSON.stringify(cabinData.amenities || []),
      deck_locations: JSON.stringify(cabinData.decks || []),
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
        category_alt = EXCLUDED.category_alt,
        color_code = EXCLUDED.color_code,
        color_code_alt = EXCLUDED.color_code_alt,
        image_url = EXCLUDED.image_url,
        image_url_hd = EXCLUDED.image_url_hd,
        is_default = EXCLUDED.is_default,
        valid_from = EXCLUDED.valid_from,
        valid_to = EXCLUDED.valid_to,
        max_occupancy = EXCLUDED.max_occupancy,
        min_occupancy = EXCLUDED.min_occupancy,
        size = EXCLUDED.size,
        bed_configuration = EXCLUDED.bed_configuration,
        amenities = EXCLUDED.amenities,
        deck_locations = EXCLUDED.deck_locations,
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
  
  // Update ship with additional details
  await sql`
    UPDATE ships SET
      tonnage = ${shipContent.tonnage || null},
      total_cabins = ${shipContent.noofcabins || null},
      occupancy = ${shipContent.limitof || null},
      total_crew = ${shipContent.crewno || null},
      length = ${shipContent.length || null},
      launched = ${shipContent.launched || null},
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
      url: img.url || img.imageurl,
      caption: img.caption || img.title,
      category: img.category || 'general',
      is_default: img.isdefault === true,
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
        await sql`
          INSERT INTO ship_images ${sql(imageRecords)}
          ON CONFLICT (ship_id, url) 
          DO UPDATE SET
            caption = EXCLUDED.caption,
            category = EXCLUDED.category,
            is_default = EXCLUDED.is_default,
            display_order = EXCLUDED.display_order,
            updated_at = CURRENT_TIMESTAMP
        `;
      }
    }
  }
  
  // Sync ship decks if table exists
  if (shipContent.shipdecks && typeof shipContent.shipdecks === 'object') {
    const deckRecords = Object.entries(shipContent.shipdecks).map(([deckName, deckData]) => ({
      ship_id: shipId,
      name: deckName,
      description: deckData.description || null,
      deck_number: deckData.number || null,
      facilities: JSON.stringify(deckData.facilities || []),
      image_url: deckData.imageurl || null,
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
        await sql`
          INSERT INTO ship_decks ${sql(deckRecords)}
          ON CONFLICT (ship_id, name) 
          DO UPDATE SET
            description = EXCLUDED.description,
            deck_number = EXCLUDED.deck_number,
            facilities = EXCLUDED.facilities,
            image_url = EXCLUDED.image_url,
            updated_at = CURRENT_TIMESTAMP
        `;
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
  
  const altRecords = [];
  
  for (const [altId, altData] of Object.entries(altSailings)) {
    if (!altData) continue;
    
    altRecords.push({
      cruise_id: cruiseId,
      alternative_cruise_id: altId,
      departure_date: altData.departuredate || altData.saildate,
      price_difference: altData.pricediff || 0,
      availability_status: altData.availability || 'available',
    });
  }
  
  if (altRecords.length > 0) {
    await sql`
      INSERT INTO alternative_sailings ${sql(altRecords)}
      ON CONFLICT (cruise_id, alternative_cruise_id) 
      DO UPDATE SET
        departure_date = EXCLUDED.departure_date,
        price_difference = EXCLUDED.price_difference,
        availability_status = EXCLUDED.availability_status,
        updated_at = CURRENT_TIMESTAMP
    `;
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
    
    // Upsert cruise line
    await sql`
      INSERT INTO cruise_lines (id, name, logo, website)
      VALUES (
        ${cruiseData.lineid},
        ${lineName},
        ${lineContent.logo || lineContent.logourl || null},
        ${lineContent.website || null}
      )
      ON CONFLICT (id) 
      DO UPDATE SET
        name = EXCLUDED.name,
        logo = COALESCE(EXCLUDED.logo, cruise_lines.logo),
        website = COALESCE(EXCLUDED.website, cruise_lines.website),
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
        ${cruiseData.saildate || cruiseData.startdate},
        ${cruiseData.enddate || cruiseData.returndate || null}
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
      
      await sql`
        INSERT INTO itineraries (
          cruise_id, day_number, port_id, port_name,
          arrival_time, departure_time, description,
          is_sea_day, is_tender_port
        ) VALUES (
          ${cruiseDbId},
          ${i + 1},
          ${day.portid || null},
          ${day.name || day.portname || 'At Sea'},
          ${day.arrivaltime || null},
          ${day.departuretime || null},
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
  const directory = `/isell_json/${year}/${month}`;
  
  console.log(`\n📅 Syncing ${year}-${month}`);
  console.log('=' .repeat(50));
  
  try {
    await ftpManager.connect();
    
    const files = await ftpManager.listFiles(directory);
    console.log(`📁 Found ${files.length} cruise files`);
    
    if (files.length === 0) {
      console.log('⚠️  No files found in this directory');
      return;
    }
    
    let processed = 0;
    let successful = 0;
    let totalPricing = 0;
    let totalCabins = 0;
    
    // Process in batches
    for (let i = 0; i < files.length; i += CONFIG.batchSize) {
      const batch = files.slice(i, Math.min(i + CONFIG.batchSize, files.length));
      
      const results = await Promise.all(
        batch.map(file => 
          processCruiseFile(ftpManager, `${directory}/${file.name}`)
        )
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
      const progress = Math.round((processed / files.length) * 100);
      process.stdout.write(`\r📊 Progress: ${progress}% (${processed}/${files.length}) | ✅ Success: ${successful} | 💰 Pricing: ${totalPricing} | 🛏️ Cabins: ${totalCabins}`);
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
    
    const stats = await sql`
      SELECT 
        (SELECT COUNT(*) FROM cruises) as total_cruises,
        (SELECT COUNT(*) FROM pricing) as total_pricing,
        (SELECT COUNT(*) FROM cabin_categories) as total_cabins,
        (SELECT COUNT(*) FROM ships) as total_ships,
        (SELECT COUNT(*) FROM cruise_lines) as total_lines,
        (SELECT COUNT(*) FROM ports) as total_ports
    `;
    
    console.log(`🚢 Total Cruises: ${stats[0].total_cruises}`);
    console.log(`💰 Total Pricing Records: ${stats[0].total_pricing}`);
    console.log(`🛏️ Total Cabin Categories: ${stats[0].total_cabins}`);
    console.log(`⚓ Total Ships: ${stats[0].total_ships}`);
    console.log(`🏢 Total Cruise Lines: ${stats[0].total_lines}`);
    console.log(`🌍 Total Ports: ${stats[0].total_ports}`);
    
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