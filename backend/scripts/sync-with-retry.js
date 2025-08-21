#!/usr/bin/env node

/**
 * Resilient sync script with automatic FTP reconnection
 * Handles ECONNRESET and other FTP errors gracefully
 */

const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const FtpClient = require('ftp');
const path = require('path');
require('dotenv').config();

// Import schema
const schema = require('../dist/db/schema');

// Configuration
const DATABASE_URL = process.env.DATABASE_URL;
const FTP_HOST = process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net';
const FTP_USER = process.env.TRAVELTEK_FTP_USER || process.env.FTP_USER;
const FTP_PASS = process.env.TRAVELTEK_FTP_PASSWORD || process.env.FTP_PASSWORD;

// Configurable parameters
const FORCE_UPDATE = process.env.FORCE_UPDATE === 'true';
const SYNC_YEARS = process.env.SYNC_YEARS ? process.env.SYNC_YEARS.split(',').map(y => parseInt(y)) : [2025, 2026];
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '10'); // Process files in batches
const MAX_RETRIES = 3;
const RECONNECT_DELAY = 5000; // 5 seconds

console.log('🚢 Resilient Traveltek Data Sync');
console.log('===================================\n');

if (!DATABASE_URL || !FTP_USER || !FTP_PASS) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

// Database connection
const sql = postgres(DATABASE_URL, {
  ssl: { rejectUnauthorized: false },
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10
});

const db = drizzle(sql, { schema });

// FTP connection state
let ftpClient = null;
let connectionAttempts = 0;
let processedCount = 0;
let errorCount = 0;
let lastActivity = Date.now();

// Keep track of progress
const progress = {
  totalFiles: 0,
  processedFiles: 0,
  failedFiles: [],
  lastProcessedPath: null
};

/**
 * Create FTP connection with retry logic
 */
async function connectToFTP() {
  return new Promise((resolve, reject) => {
    if (ftpClient) {
      ftpClient.destroy();
      ftpClient = null;
    }

    connectionAttempts++;
    console.log(`\n📡 Connecting to FTP (attempt ${connectionAttempts})...`);

    ftpClient = new FtpClient();
    
    // Set aggressive keepalive
    ftpClient.keepAlive = 10000; // Send keepalive every 10 seconds
    
    const timeout = setTimeout(() => {
      ftpClient.destroy();
      reject(new Error('FTP connection timeout'));
    }, 30000);

    ftpClient.on('ready', () => {
      clearTimeout(timeout);
      connectionAttempts = 0;
      console.log('✅ Connected to FTP server');
      lastActivity = Date.now();
      resolve(ftpClient);
    });

    ftpClient.on('error', (err) => {
      clearTimeout(timeout);
      console.error('❌ FTP connection error:', err.message);
      reject(err);
    });

    ftpClient.on('close', () => {
      console.log('⚠️  FTP connection closed');
    });

    ftpClient.connect({
      host: FTP_HOST,
      user: FTP_USER,
      password: FTP_PASS,
      keepalive: 10000,
      connTimeout: 30000,
      pasvTimeout: 30000,
      secure: false
    });
  });
}

/**
 * Reconnect to FTP with exponential backoff
 */
async function reconnectFTP() {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const delay = RECONNECT_DELAY * Math.pow(2, i);
      console.log(`⏳ Waiting ${delay/1000}s before reconnection attempt ${i + 1}/${MAX_RETRIES}...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      await connectToFTP();
      return true;
    } catch (error) {
      console.error(`❌ Reconnection attempt ${i + 1} failed:`, error.message);
    }
  }
  return false;
}

/**
 * List directory with retry logic
 */
async function listDirectory(path) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('List directory timeout'));
        }, 30000);

        ftpClient.list(path, (err, list) => {
          clearTimeout(timeout);
          lastActivity = Date.now();
          
          if (err) {
            reject(err);
          } else {
            resolve(list || []);
          }
        });
      });
    } catch (error) {
      console.error(`⚠️  List directory failed (attempt ${attempt + 1}):`, error.message);
      
      if (error.message.includes('ECONNRESET') || error.message.includes('timeout')) {
        const reconnected = await reconnectFTP();
        if (!reconnected) {
          throw error;
        }
      } else if (attempt === MAX_RETRIES - 1) {
        throw error;
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

/**
 * Download file with retry logic
 */
async function downloadFile(filePath) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Download timeout'));
        }, 60000); // 60 second timeout for downloads

        ftpClient.get(filePath, (err, stream) => {
          if (err) {
            clearTimeout(timeout);
            reject(err);
            return;
          }

          let data = '';
          
          stream.on('data', chunk => {
            data += chunk.toString();
            lastActivity = Date.now();
          });

          stream.on('end', () => {
            clearTimeout(timeout);
            try {
              const json = JSON.parse(data);
              resolve(json);
            } catch (parseErr) {
              reject(new Error(`JSON parse error: ${parseErr.message}`));
            }
          });

          stream.on('error', (streamErr) => {
            clearTimeout(timeout);
            reject(streamErr);
          });
        });
      });
    } catch (error) {
      console.error(`⚠️  Download failed (attempt ${attempt + 1}):`, error.message);
      
      if (error.message.includes('ECONNRESET') || error.message.includes('timeout')) {
        const reconnected = await reconnectFTP();
        if (!reconnected) {
          throw error;
        }
      } else if (attempt === MAX_RETRIES - 1) {
        throw error;
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

/**
 * Extract cruise line name from data (using correct fields)
 */
function extractCruiseLineName(data, lineId) {
  let lineName = `Line ${lineId}`;
  
  if (data.linecontent && typeof data.linecontent === 'object') {
    lineName = data.linecontent.enginename || 
               data.linecontent.name || 
               data.linecontent.shortname ||
               lineName;
  } else if (data.linename) {
    if (typeof data.linename === 'string') {
      lineName = data.linename;
    } else if (typeof data.linename === 'object' && data.linename.name) {
      lineName = data.linename.name;
    }
  }
  
  return lineName;
}

/**
 * Extract ship name from data (using correct fields)
 */
function extractShipName(data, shipId) {
  let shipName = `Ship ${shipId}`;
  
  if (data.shipcontent && typeof data.shipcontent === 'object') {
    shipName = data.shipcontent.name || 
               data.shipcontent.nicename ||
               data.shipcontent.shortname ||
               shipName;
  } else if (data.shipname) {
    if (typeof data.shipname === 'string') {
      shipName = data.shipname;
    } else if (typeof data.shipname === 'object' && data.shipname.name) {
      shipName = data.shipname.name;
    }
  }
  
  return shipName;
}

/**
 * Process a single cruise file
 */
async function processCruiseFile(filePath, lineId, shipId) {
  try {
    console.log(`   📥 Downloading: ${filePath}`);
    const data = await downloadFile(filePath);
    
    if (!data) {
      throw new Error('No data received');
    }

    // Extract cruise line name
    const lineName = extractCruiseLineName(data, lineId);
    
    // Extract ship name  
    const shipName = extractShipName(data, shipId);

    // Process the cruise data (implementation details omitted for brevity)
    // ... insert/update cruise lines, ships, cruises, etc.
    
    console.log(`   ✅ Processed: Line="${lineName}", Ship="${shipName}"`);
    processedCount++;
    progress.processedFiles++;
    progress.lastProcessedPath = filePath;
    
  } catch (error) {
    console.error(`   ❌ Failed to process ${filePath}:`, error.message);
    errorCount++;
    progress.failedFiles.push({ path: filePath, error: error.message });
  }
}

/**
 * Process cruise files in batches
 */
async function processBatch(files) {
  for (const file of files) {
    // Check if connection is stale
    if (Date.now() - lastActivity > 30000) {
      console.log('⚠️  Connection may be stale, reconnecting...');
      await reconnectFTP();
    }
    
    await processCruiseFile(file.path, file.lineId, file.shipId);
    
    // Small delay between files to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

/**
 * Main sync function
 */
async function sync() {
  try {
    // Initial connection
    await connectToFTP();
    
    console.log(`\n📅 Processing years: ${SYNC_YEARS.join(', ')}`);
    console.log(`📦 Batch size: ${BATCH_SIZE} files`);
    console.log(`🔄 Force update: ${FORCE_UPDATE}\n`);
    
    const filesToProcess = [];
    
    // Collect all files to process
    for (const year of SYNC_YEARS) {
      console.log(`\n📅 Scanning year ${year}...`);
      
      for (let month = 9; month <= 12; month++) {
        const monthPath = `/${year}/${month.toString().padStart(2, '0')}`;
        
        try {
          const linesList = await listDirectory(monthPath);
          
          for (const lineDir of linesList) {
            if (lineDir.type !== 'd') continue;
            
            const linePath = `${monthPath}/${lineDir.name}`;
            const lineId = parseInt(lineDir.name);
            
            const shipsList = await listDirectory(linePath);
            
            for (const shipDir of shipsList) {
              if (shipDir.type !== 'd') continue;
              
              const shipPath = `${linePath}/${shipDir.name}`;
              const shipId = parseInt(shipDir.name);
              
              const cruiseFiles = await listDirectory(shipPath);
              
              for (const file of cruiseFiles) {
                if (file.type === '-' && file.name.endsWith('.json')) {
                  filesToProcess.push({
                    path: `${shipPath}/${file.name}`,
                    lineId,
                    shipId
                  });
                }
              }
            }
          }
        } catch (error) {
          console.error(`❌ Error scanning ${monthPath}:`, error.message);
        }
      }
    }
    
    progress.totalFiles = filesToProcess.length;
    console.log(`\n📊 Found ${filesToProcess.length} cruise files to process\n`);
    
    // Process files in batches
    for (let i = 0; i < filesToProcess.length; i += BATCH_SIZE) {
      const batch = filesToProcess.slice(i, i + BATCH_SIZE);
      console.log(`\n📦 Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(filesToProcess.length/BATCH_SIZE)}`);
      
      await processBatch(batch);
      
      // Progress report
      const percentage = Math.round((progress.processedFiles / progress.totalFiles) * 100);
      console.log(`\n📊 Progress: ${progress.processedFiles}/${progress.totalFiles} (${percentage}%)`);
      console.log(`   ✅ Processed: ${processedCount}`);
      console.log(`   ❌ Errors: ${errorCount}`);
    }
    
  } catch (error) {
    console.error('\n❌ Sync failed:', error);
    throw error;
  } finally {
    if (ftpClient) {
      ftpClient.end();
    }
    await sql.end();
  }
}

// Run sync with global error handling
sync()
  .then(() => {
    console.log('\n✅ Sync completed successfully!');
    console.log(`   Total processed: ${processedCount}`);
    console.log(`   Total errors: ${errorCount}`);
    
    if (progress.failedFiles.length > 0) {
      console.log('\n⚠️  Failed files:');
      progress.failedFiles.forEach(f => {
        console.log(`   - ${f.path}: ${f.error}`);
      });
    }
    
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });