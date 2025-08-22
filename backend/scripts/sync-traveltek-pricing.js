#!/usr/bin/env node

/**
 * SYNC TRAVELTEK PRICING DATA
 * 
 * This script extracts pricing data from Traveltek JSON files that was missed
 * by the initial sync. NO COMPROMISES - we extract ALL pricing data.
 * 
 * Based on TRAVELTEK-DATA-STRUCTURE.md:
 * - prices object: STATIC pricing data from Traveltek
 * - cabins object: cabin categories and details
 * - altsailings: alternative sailing dates
 * 
 * NOT syncing cachedprices (live data we don't have access to)
 */

require('dotenv').config();
const ftp = require('basic-ftp');
const postgres = require('postgres');

// Configuration
const CONFIG = {
  ftp: {
    host: process.env.TRAVELTEK_FTP_HOST,
    user: process.env.TRAVELTEK_FTP_USER,
    password: process.env.TRAVELTEK_FTP_PASSWORD,
    secure: false,
    timeout: 30000,
  },
  database: {
    url: process.env.DATABASE_URL,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  },
  sync: {
    year: process.env.SYNC_YEAR || '2025',
    month: process.env.SYNC_MONTH || '09',
    maxRetries: 3,
    batchSize: 10,
  },
  testMode: process.env.TEST_MODE === 'true',
};

// Database connection
const sql = postgres(CONFIG.database.url, {
  max: CONFIG.database.max,
  idle_timeout: CONFIG.database.idle_timeout,
  connect_timeout: CONFIG.database.connect_timeout,
  ssl: { rejectUnauthorized: false },
});

// Logger
class Logger {
  static info(message, data = null) {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`);
    if (data) console.log(JSON.stringify(data, null, 2));
  }
  
  static error(message, error = null) {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`);
    if (error) console.error(error);
  }
  
  static warn(message, data = null) {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`);
    if (data) console.log(JSON.stringify(data, null, 2));
  }
  
  static success(message) {
    console.log(`✅ ${message}`);
  }
}

// FTP Client
class FTPClient {
  constructor() {
    this.client = new ftp.Client();
    this.connected = false;
  }
  
  async connect() {
    try {
      await this.client.access(CONFIG.ftp);
      this.connected = true;
      Logger.info('Connected to Traveltek FTP server');
    } catch (error) {
      Logger.error('Failed to connect to FTP:', error);
      throw error;
    }
  }
  
  async listFiles(path) {
    if (!this.connected) await this.connect();
    
    try {
      const files = await this.client.list(path);
      return files.filter(f => f.name.endsWith('.json')).map(f => ({
        name: f.name,
        size: f.size,
        path: `${path}/${f.name}`,
      }));
    } catch (error) {
      Logger.error(`Failed to list files at ${path}:`, error);
      return [];
    }
  }
  
  async getFile(filePath) {
    if (!this.connected) await this.connect();
    
    return new Promise((resolve, reject) => {
      const chunks = [];
      
      this.client.downloadTo(
        (chunk) => chunks.push(chunk),
        filePath
      ).then(() => {
        const content = Buffer.concat(chunks).toString('utf8');
        const data = JSON.parse(content);
        resolve(data);
      }).catch(reject);
    });
  }
  
  async disconnect() {
    if (this.connected) {
      this.client.close();
      this.connected = false;
      Logger.info('Disconnected from FTP');
    }
  }
}

// Pricing Sync
class PricingSync {
  constructor() {
    this.ftpClient = new FTPClient();
    this.stats = {
      cruisesProcessed: 0,
      pricesExtracted: 0,
      cabinsExtracted: 0,
      errors: 0,
      skipped: 0,
    };
  }
  
  async run() {
    Logger.info('Starting Traveltek Pricing Sync');
    Logger.info('Configuration:', {
      year: CONFIG.sync.year,
      month: CONFIG.sync.month,
      testMode: CONFIG.testMode,
    });
    
    try {
      await this.ftpClient.connect();
      
      // Get all cruise files for the specified month
      const basePath = `/${CONFIG.sync.year}/${CONFIG.sync.month}`;
      const cruiseFiles = await this.getCruiseFiles(basePath);
      
      Logger.info(`Found ${cruiseFiles.length} cruise files to process`);
      
      if (CONFIG.testMode) {
        Logger.warn('TEST MODE - Processing first 5 files only');
        cruiseFiles.splice(5);
      }
      
      // Process files in batches
      for (let i = 0; i < cruiseFiles.length; i += CONFIG.sync.batchSize) {
        const batch = cruiseFiles.slice(i, i + CONFIG.sync.batchSize);
        await this.processBatch(batch);
        
        Logger.info(`Progress: ${Math.min(i + CONFIG.sync.batchSize, cruiseFiles.length)}/${cruiseFiles.length}`);
      }
      
      Logger.success('Pricing sync completed!');
      Logger.info('Statistics:', this.stats);
      
    } catch (error) {
      Logger.error('Sync failed:', error);
    } finally {
      await this.ftpClient.disconnect();
      await sql.end();
    }
  }
  
  async getCruiseFiles(basePath) {
    const allFiles = [];
    
    // List all subdirectories (cruise lines)
    const linesDirs = await this.ftpClient.listFiles(basePath);
    
    for (const lineDir of linesDirs) {
      if (!lineDir.name || lineDir.name.startsWith('.')) continue;
      
      const linePath = `${basePath}/${lineDir.name}`;
      const shipDirs = await this.ftpClient.listFiles(linePath);
      
      for (const shipDir of shipDirs) {
        if (!shipDir.name || shipDir.name.startsWith('.')) continue;
        
        const shipPath = `${linePath}/${shipDir.name}`;
        const cruiseFiles = await this.ftpClient.listFiles(shipPath);
        
        allFiles.push(...cruiseFiles.map(f => ({
          ...f,
          path: `${shipPath}/${f.name}`,
          lineId: lineDir.name,
          shipId: shipDir.name,
        })));
      }
    }
    
    return allFiles;
  }
  
  async processBatch(files) {
    for (const file of files) {
      try {
        await this.processFile(file);
      } catch (error) {
        Logger.error(`Failed to process ${file.path}:`, error.message);
        this.stats.errors++;
      }
    }
  }
  
  async processFile(fileInfo) {
    try {
      // Get cruise data
      const cruiseData = await this.ftpClient.getFile(fileInfo.path);
      
      // Extract code_to_cruise_id from filename
      const codeToCruiseId = parseInt(fileInfo.name.replace('.json', ''));
      
      // Check if cruise exists in database
      const cruiseExists = await sql`
        SELECT id FROM cruises WHERE id = ${codeToCruiseId}
      `;
      
      if (cruiseExists.length === 0) {
        Logger.warn(`Cruise ${codeToCruiseId} not in database, skipping pricing`);
        this.stats.skipped++;
        return;
      }
      
      this.stats.cruisesProcessed++;
      
      // Extract and save pricing data
      if (cruiseData.prices && typeof cruiseData.prices === 'object') {
        await this.extractPricing(codeToCruiseId, cruiseData.prices);
      }
      
      // Skip cachedprices - this is live data we don't have access to
      // Only sync static pricing from 'prices' field
      
      // Extract and save cabin categories
      if (cruiseData.cabins && typeof cruiseData.cabins === 'object') {
        await this.extractCabins(cruiseData.shipid, cruiseData.cabins);
      }
      
      // Extract alternative sailings
      if (cruiseData.altsailings) {
        await this.extractAltSailings(codeToCruiseId, cruiseData.altsailings);
      }
      
    } catch (error) {
      Logger.error(`Error processing file ${fileInfo.path}:`, error);
      throw error;
    }
  }
  
  async extractPricing(cruiseId, pricesData) {
    const priceRecords = [];
    
    // Structure: prices[rateCode][cabinCode][occupancyCode]
    for (const [rateCode, ratePrices] of Object.entries(pricesData)) {
      if (!ratePrices || typeof ratePrices !== 'object') continue;
      
      for (const [cabinCode, cabinPrices] of Object.entries(ratePrices)) {
        if (!cabinPrices || typeof cabinPrices !== 'object') continue;
        
        for (const [occupancyCode, priceData] of Object.entries(cabinPrices)) {
          if (!priceData || typeof priceData !== 'object') continue;
          
          priceRecords.push({
            cruiseId,
            rateCode,
            cabinCode,
            occupancyCode,
            price: priceData.price || null,
            adultPrice: priceData.adult || null,
            childPrice: priceData.child || null,
            infantPrice: priceData.infant || null,
            thirdAdultPrice: priceData.thirdadult || null,
            fourthAdultPrice: priceData.fourthadult || null,
            fifthAdultPrice: priceData.fifthadult || null,
            singlePrice: priceData.single || null,
            taxes: priceData.taxes || null,
            ncf: priceData.ncf || null,
            gratuity: priceData.gratuity || null,
            fuel: priceData.fuel || null,
            noncomm: priceData.noncomm || null,
          });
        }
      }
    }
    
    if (priceRecords.length === 0) return;
    
    // Insert pricing data
    for (const record of priceRecords) {
      await sql`
        INSERT INTO static_prices (
          cruise_id,
          rate_code,
          cabin_id,
          cabin_type,
          price,
          adult_price,
          child_price,
          infant_price,
          third_adult_price,
          fourth_adult_price,
          fifth_adult_price,
          single_price,
          taxes,
          ncf,
          gratuity,
          fuel,
          noncomm
        ) VALUES (
          ${record.cruiseId},
          ${record.rateCode},
          ${record.cabinCode},
          ${record.occupancyCode},
          ${record.price},
          ${record.adultPrice},
          ${record.childPrice},
          ${record.infantPrice},
          ${record.thirdAdultPrice},
          ${record.fourthAdultPrice},
          ${record.fifthAdultPrice},
          ${record.singlePrice},
          ${record.taxes},
          ${record.ncf},
          ${record.gratuity},
          ${record.fuel},
          ${record.noncomm}
        )
        ON CONFLICT (cruise_id, rate_code, cabin_id) 
        DO UPDATE SET
          price = EXCLUDED.price,
          adult_price = EXCLUDED.adult_price,
          child_price = EXCLUDED.child_price,
          infant_price = EXCLUDED.infant_price,
          taxes = EXCLUDED.taxes,
          ncf = EXCLUDED.ncf,
          gratuity = EXCLUDED.gratuity,
          fuel = EXCLUDED.fuel,
          noncomm = EXCLUDED.noncomm,
          updated_at = NOW()
      `;
    }
    
    this.stats.pricesExtracted += priceRecords.length;
    Logger.info(`Extracted ${priceRecords.length} prices for cruise ${cruiseId}`);
  }
  
  // Removed extractCachedPricing - we don't have access to live pricing data
  
  async extractCabins(shipId, cabinsData) {
    if (!shipId) return;
    
    for (const [cabinCode, cabinInfo] of Object.entries(cabinsData)) {
      if (!cabinInfo || typeof cabinInfo !== 'object') continue;
      
      await sql`
        INSERT INTO cabin_types (
          ship_id,
          cabin_code,
          cabin_name,
          category,
          max_occupancy,
          min_occupancy,
          is_active
        ) VALUES (
          ${parseInt(shipId)},
          ${cabinCode},
          ${cabinInfo.name || cabinCode},
          ${cabinInfo.category || 'Standard'},
          ${cabinInfo.maxoccupancy || 2},
          ${cabinInfo.minoccupancy || 1},
          true
        )
        ON CONFLICT (ship_id, cabin_code)
        DO UPDATE SET
          cabin_name = EXCLUDED.cabin_name,
          category = EXCLUDED.category,
          max_occupancy = EXCLUDED.max_occupancy,
          min_occupancy = EXCLUDED.min_occupancy,
          updated_at = NOW()
      `;
      
      this.stats.cabinsExtracted++;
    }
  }
  
  async extractAltSailings(baseCruiseId, altSailingsData) {
    // Store alternative sailing dates if provided
    if (!altSailingsData || typeof altSailingsData !== 'object') return;
    
    // Implementation depends on structure of altsailings data
    // This would populate an alternative_sailings table
  }
}

// Run the sync
const sync = new PricingSync();
sync.run().catch(error => {
  Logger.error('Fatal error:', error);
  process.exit(1);
});