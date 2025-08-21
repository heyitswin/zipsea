#!/usr/bin/env node

/**
 * Sync specific months and years
 * Usage:
 *   YEAR=2025 MONTH=9 node scripts/sync-by-month.js
 *   YEAR=2025 MONTHS=9,10,11 node scripts/sync-by-month.js
 */

const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const FtpClient = require('ftp');
const fs = require('fs');
require('dotenv').config();

// Import schema
const schema = require('../dist/db/schema');

// Configuration
const DATABASE_URL = process.env.DATABASE_URL;
const FTP_HOST = process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net';
const FTP_USER = process.env.TRAVELTEK_FTP_USER || process.env.FTP_USER;
const FTP_PASS = process.env.TRAVELTEK_FTP_PASSWORD || process.env.FTP_PASSWORD;

// Specific year/month to sync
const YEAR = parseInt(process.env.YEAR || '2025');
const MONTHS = process.env.MONTHS 
  ? process.env.MONTHS.split(',').map(m => parseInt(m))
  : process.env.MONTH 
    ? [parseInt(process.env.MONTH)]
    : [9]; // Default to September

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '10');

console.log('🚢 Month-by-Month Traveltek Sync');
console.log('==================================\n');
console.log(`📅 Year: ${YEAR}`);
console.log(`📅 Months: ${MONTHS.join(', ')}`);
console.log(`📦 Batch size: ${BATCH_SIZE}\n`);

if (!DATABASE_URL || !FTP_USER || !FTP_PASS) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

// Database connection
const sql = postgres(DATABASE_URL, {
  ssl: { rejectUnauthorized: false },
  max: 5
});

const db = drizzle(sql, { schema });

// Progress file specific to year/month
const PROGRESS_FILE = `.sync-progress-${YEAR}-${MONTHS.join('-')}.json`;

let progress = {
  year: YEAR,
  months: MONTHS,
  processedFiles: [],
  failedFiles: [],
  stats: {
    cruiseLines: new Set(),
    ships: new Set(),
    cruises: 0
  }
};

/**
 * Load/save progress
 */
function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
      progress = data;
      // Convert arrays back to Sets
      progress.stats.cruiseLines = new Set(data.stats.cruiseLines);
      progress.stats.ships = new Set(data.stats.ships);
      console.log(`📂 Loaded progress: ${progress.processedFiles.length} files already processed\n`);
    }
  } catch (e) {
    console.log('📝 Starting fresh sync\n');
  }
}

function saveProgress() {
  const toSave = {
    ...progress,
    stats: {
      ...progress.stats,
      cruiseLines: Array.from(progress.stats.cruiseLines),
      ships: Array.from(progress.stats.ships)
    }
  };
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(toSave, null, 2));
}

/**
 * Connect to FTP
 */
async function connectToFTP() {
  return new Promise((resolve, reject) => {
    const ftpClient = new FtpClient();
    
    ftpClient.on('ready', () => {
      console.log('✅ Connected to FTP\n');
      resolve(ftpClient);
    });
    
    ftpClient.on('error', reject);
    
    ftpClient.connect({
      host: FTP_HOST,
      user: FTP_USER,
      password: FTP_PASS,
      keepalive: 10000,
      connTimeout: 30000
    });
  });
}

/**
 * List directory
 */
async function listDirectory(ftpClient, path) {
  return new Promise((resolve) => {
    ftpClient.list(path, (err, list) => {
      if (err) {
        console.error(`   ⚠️  Failed to list ${path}`);
        resolve([]);
      } else {
        resolve(list || []);
      }
    });
  });
}

/**
 * Download and process file
 */
async function processFile(ftpClient, filePath, lineId, shipId) {
  // Skip if already processed
  if (progress.processedFiles.includes(filePath)) {
    return;
  }
  
  try {
    const data = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout')), 20000);
      
      ftpClient.get(filePath, (err, stream) => {
        if (err) {
          clearTimeout(timeout);
          reject(err);
          return;
        }
        
        let content = '';
        stream.on('data', chunk => content += chunk.toString());
        stream.on('end', () => {
          clearTimeout(timeout);
          try {
            resolve(JSON.parse(content));
          } catch (e) {
            reject(e);
          }
        });
        stream.on('error', reject);
      });
    });
    
    // Extract names using correct fields
    let lineName = `Line ${lineId}`;
    if (data.linecontent && typeof data.linecontent === 'object') {
      lineName = data.linecontent.enginename || 
                 data.linecontent.name || 
                 data.linecontent.shortname ||
                 lineName;
    }
    
    let shipName = `Ship ${shipId}`;
    if (data.shipcontent && typeof data.shipcontent === 'object') {
      shipName = data.shipcontent.name || 
                 data.shipcontent.nicename ||
                 data.shipcontent.shortname ||
                 shipName;
    }
    
    // Update database (simplified - just updating names)
    const { cruiseLines, ships } = schema;
    
    // Update cruise line
    await db.insert(cruiseLines)
      .values({ id: lineId, name: lineName, code: `CL${lineId}` })
      .onConflictDoUpdate({
        target: cruiseLines.id,
        set: { name: lineName }
      });
    
    // Update ship
    await db.insert(ships)
      .values({ 
        id: shipId, 
        name: shipName, 
        cruise_line_id: lineId,
        code: `S${shipId}`
      })
      .onConflictDoUpdate({
        target: ships.id,
        set: { name: shipName }
      });
    
    progress.processedFiles.push(filePath);
    progress.stats.cruiseLines.add(lineId);
    progress.stats.ships.add(shipId);
    progress.stats.cruises++;
    
    console.log(`   ✅ ${lineName} - ${shipName}`);
    
    // Save progress every 10 files
    if (progress.processedFiles.length % 10 === 0) {
      saveProgress();
    }
    
  } catch (error) {
    progress.failedFiles.push({ path: filePath, error: error.message });
  }
}

/**
 * Process a specific month
 */
async function processMonth(ftpClient, year, month) {
  console.log(`\n📅 Processing ${year}/${String(month).padStart(2, '0')}...`);
  
  const monthPath = `/${year}/${String(month).padStart(2, '0')}`;
  const cruiseLines = await listDirectory(ftpClient, monthPath);
  
  console.log(`   Found ${cruiseLines.filter(d => d.type === 'd').length} cruise lines\n`);
  
  const files = [];
  
  // Collect all files for this month
  for (const lineDir of cruiseLines) {
    if (lineDir.type !== 'd') continue;
    
    const lineId = parseInt(lineDir.name);
    const linePath = `${monthPath}/${lineDir.name}`;
    
    const ships = await listDirectory(ftpClient, linePath);
    
    for (const shipDir of ships) {
      if (shipDir.type !== 'd') continue;
      
      const shipId = parseInt(shipDir.name);
      const shipPath = `${linePath}/${shipDir.name}`;
      
      const cruiseFiles = await listDirectory(ftpClient, shipPath);
      
      for (const file of cruiseFiles) {
        if (file.type === '-' && file.name.endsWith('.json')) {
          files.push({
            path: `${shipPath}/${file.name}`,
            lineId,
            shipId
          });
        }
      }
    }
  }
  
  console.log(`   📁 Found ${files.length} cruise files`);
  
  // Process in batches
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    console.log(`\n   📦 Batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(files.length/BATCH_SIZE)}`);
    
    for (const file of batch) {
      await processFile(ftpClient, file.path, file.lineId, file.shipId);
    }
    
    // Reconnect periodically
    if (i > 0 && i % 100 === 0) {
      console.log('\n   🔄 Reconnecting...');
      ftpClient.end();
      ftpClient = await connectToFTP();
    }
  }
  
  saveProgress();
  console.log(`\n   ✅ Completed ${year}/${String(month).padStart(2, '0')}`);
}

/**
 * Main function
 */
async function main() {
  let ftpClient;
  
  try {
    loadProgress();
    ftpClient = await connectToFTP();
    
    // Process each month
    for (const month of MONTHS) {
      await processMonth(ftpClient, YEAR, month);
    }
    
    console.log('\n========================================');
    console.log('✅ Sync Complete!\n');
    console.log(`📊 Statistics:`);
    console.log(`   Cruise lines updated: ${progress.stats.cruiseLines.size}`);
    console.log(`   Ships updated: ${progress.stats.ships.size}`);
    console.log(`   Files processed: ${progress.processedFiles.length}`);
    console.log(`   Failed files: ${progress.failedFiles.length}`);
    
    if (progress.failedFiles.length > 0) {
      console.log('\n⚠️  Failed files:');
      progress.failedFiles.forEach(f => {
        console.log(`   - ${f.path}: ${f.error}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (ftpClient) ftpClient.end();
    await sql.end();
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Interrupted! Saving progress...');
  saveProgress();
  process.exit(0);
});

main();