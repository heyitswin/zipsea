#!/usr/bin/env node

/**
 * Resilient sync script with resume capability
 * Saves progress to a file so it can resume from where it left off
 */

const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const FtpClient = require('ftp');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import schema
const schema = require('../db/schema');

// Configuration
const DATABASE_URL = process.env.DATABASE_URL;
const FTP_HOST = process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net';
const FTP_USER = process.env.TRAVELTEK_FTP_USER || process.env.FTP_USER;
const FTP_PASS = process.env.TRAVELTEK_FTP_PASSWORD || process.env.FTP_PASSWORD;

// Progress file to track where we left off
const PROGRESS_FILE = process.env.PROGRESS_FILE || '.sync-progress.json';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '5');
const SYNC_YEARS = process.env.SYNC_YEARS ? process.env.SYNC_YEARS.split(',').map(y => parseInt(y)) : [2025, 2026];

console.log('🚢 Resumable Traveltek Data Sync');
console.log('==================================\n');

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

// Progress tracking
let progress = {
  startedAt: null,
  lastUpdatedAt: null,
  totalFiles: 0,
  processedFiles: [],
  failedFiles: [],
  currentBatch: 0,
  status: 'idle'
};

/**
 * Load progress from file
 */
function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = fs.readFileSync(PROGRESS_FILE, 'utf8');
      progress = JSON.parse(data);
      console.log('📂 Loaded previous progress:');
      console.log(`   - Processed: ${progress.processedFiles.length} files`);
      console.log(`   - Failed: ${progress.failedFiles.length} files`);
      console.log(`   - Last batch: ${progress.currentBatch}`);
      
      const resume = process.env.RESUME !== 'false';
      if (!resume) {
        console.log('⚠️  Starting fresh (RESUME=false)');
        resetProgress();
      } else {
        console.log('✅ Resuming from previous run\n');
      }
    } else {
      console.log('📝 Starting new sync session\n');
      resetProgress();
    }
  } catch (error) {
    console.error('⚠️  Error loading progress file, starting fresh');
    resetProgress();
  }
}

/**
 * Save progress to file
 */
function saveProgress() {
  try {
    progress.lastUpdatedAt = new Date().toISOString();
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
  } catch (error) {
    console.error('⚠️  Failed to save progress:', error.message);
  }
}

/**
 * Reset progress
 */
function resetProgress() {
  progress = {
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    totalFiles: 0,
    processedFiles: [],
    failedFiles: [],
    currentBatch: 0,
    status: 'idle'
  };
  saveProgress();
}

/**
 * Check if a file has already been processed
 */
function isFileProcessed(filePath) {
  return progress.processedFiles.includes(filePath) || 
         progress.failedFiles.some(f => f.path === filePath);
}

/**
 * Mark file as processed
 */
function markFileProcessed(filePath, success = true, error = null) {
  if (success) {
    if (!progress.processedFiles.includes(filePath)) {
      progress.processedFiles.push(filePath);
    }
  } else {
    // Remove from processed if it was there
    progress.processedFiles = progress.processedFiles.filter(f => f !== filePath);
    
    // Add to failed
    const existing = progress.failedFiles.findIndex(f => f.path === filePath);
    if (existing >= 0) {
      progress.failedFiles[existing] = { path: filePath, error: error?.message || 'Unknown error', attempts: (progress.failedFiles[existing].attempts || 0) + 1 };
    } else {
      progress.failedFiles.push({ path: filePath, error: error?.message || 'Unknown error', attempts: 1 });
    }
  }
  
  // Save progress every 10 files
  if ((progress.processedFiles.length + progress.failedFiles.length) % 10 === 0) {
    saveProgress();
  }
}

/**
 * Connect to FTP
 */
async function connectToFTP() {
  return new Promise((resolve, reject) => {
    const ftpClient = new FtpClient();
    
    ftpClient.on('ready', () => {
      console.log('✅ Connected to FTP server');
      resolve(ftpClient);
    });
    
    ftpClient.on('error', reject);
    
    ftpClient.connect({
      host: FTP_HOST,
      user: FTP_USER,
      password: FTP_PASS,
      keepalive: 10000,
      connTimeout: 30000,
      pasvTimeout: 30000
    });
  });
}

/**
 * List directory with retry
 */
async function listDirectory(ftpClient, path) {
  return new Promise((resolve) => {
    ftpClient.list(path, (err, list) => {
      if (err) {
        console.error(`   ⚠️  Failed to list ${path}:`, err.message);
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
  if (isFileProcessed(filePath)) {
    console.log(`   ⏭️  Skipping (already processed): ${filePath}`);
    return true;
  }
  
  console.log(`   📥 Processing: ${filePath}`);
  
  try {
    // Download with timeout
    const data = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Download timeout'));
      }, 30000);
      
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
            reject(new Error('Invalid JSON'));
          }
        });
        stream.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    });
    
    // Process the data (extract names, update database, etc.)
    // ... your processing logic here ...
    
    // Extract cruise line name
    let lineName = `Line ${lineId}`;
    if (data.linecontent && typeof data.linecontent === 'object') {
      lineName = data.linecontent.enginename || 
                 data.linecontent.name || 
                 data.linecontent.shortname ||
                 lineName;
    }
    
    // Extract ship name
    let shipName = `Ship ${shipId}`;
    if (data.shipcontent && typeof data.shipcontent === 'object') {
      shipName = data.shipcontent.name || 
                 data.shipcontent.nicename ||
                 data.shipcontent.shortname ||
                 shipName;
    }
    
    console.log(`      ✅ Processed: Line="${lineName}", Ship="${shipName}"`);
    
    // Mark as processed
    markFileProcessed(filePath, true);
    return true;
    
  } catch (error) {
    console.error(`      ❌ Failed: ${error.message}`);
    markFileProcessed(filePath, false, error);
    return false;
  }
}

/**
 * Collect all files to process
 */
async function collectFiles(ftpClient) {
  const files = [];
  
  for (const year of SYNC_YEARS) {
    console.log(`📅 Scanning year ${year}...`);
    
    for (let month = 9; month <= 12; month++) {
      const monthPath = `/${year}/${month.toString().padStart(2, '0')}`;
      
      const linesList = await listDirectory(ftpClient, monthPath);
      
      for (const lineDir of linesList) {
        if (lineDir.type !== 'd') continue;
        
        const linePath = `${monthPath}/${lineDir.name}`;
        const lineId = parseInt(lineDir.name);
        
        const shipsList = await listDirectory(ftpClient, linePath);
        
        for (const shipDir of shipsList) {
          if (shipDir.type !== 'd') continue;
          
          const shipPath = `${linePath}/${shipDir.name}`;
          const shipId = parseInt(shipDir.name);
          
          const cruiseFiles = await listDirectory(ftpClient, shipPath);
          
          for (const file of cruiseFiles) {
            if (file.type === '-' && file.name.endsWith('.json')) {
              const fullPath = `${shipPath}/${file.name}`;
              
              // Skip if already processed
              if (!isFileProcessed(fullPath)) {
                files.push({
                  path: fullPath,
                  lineId,
                  shipId
                });
              }
            }
          }
        }
      }
    }
  }
  
  return files;
}

/**
 * Main sync function
 */
async function sync() {
  let ftpClient;
  
  try {
    // Load previous progress
    loadProgress();
    
    // Connect to FTP
    ftpClient = await connectToFTP();
    
    console.log('\n📊 Collecting files to process...\n');
    
    // Collect files (excluding already processed ones)
    const filesToProcess = await collectFiles(ftpClient);
    
    progress.totalFiles = filesToProcess.length + progress.processedFiles.length;
    console.log(`\n📁 Files to process: ${filesToProcess.length}`);
    console.log(`✅ Already processed: ${progress.processedFiles.length}`);
    console.log(`❌ Previously failed: ${progress.failedFiles.length}`);
    console.log(`📊 Total files: ${progress.totalFiles}\n`);
    
    if (filesToProcess.length === 0) {
      console.log('✨ All files have been processed!');
      
      if (progress.failedFiles.length > 0) {
        console.log('\n⚠️  Failed files that may need retry:');
        progress.failedFiles.forEach(f => {
          console.log(`   - ${f.path} (${f.attempts} attempts): ${f.error}`);
        });
      }
      
      return;
    }
    
    // Process in batches
    for (let i = 0; i < filesToProcess.length; i += BATCH_SIZE) {
      const batch = filesToProcess.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(filesToProcess.length / BATCH_SIZE);
      
      console.log(`\n📦 Batch ${batchNum}/${totalBatches}`);
      progress.currentBatch = batchNum;
      progress.status = 'processing';
      saveProgress();
      
      // Process each file in the batch
      for (const file of batch) {
        const success = await processFile(ftpClient, file.path, file.lineId, file.shipId);
        
        // Reconnect if needed (every 50 files)
        if ((progress.processedFiles.length % 50) === 0 && progress.processedFiles.length > 0) {
          console.log('\n🔄 Reconnecting to FTP...');
          ftpClient.end();
          ftpClient = await connectToFTP();
        }
      }
      
      // Progress update
      const totalProcessed = progress.processedFiles.length;
      const percentage = Math.round((totalProcessed / progress.totalFiles) * 100);
      console.log(`\n   📊 Overall progress: ${totalProcessed}/${progress.totalFiles} (${percentage}%)`);
      
      // Save progress after each batch
      saveProgress();
    }
    
    progress.status = 'completed';
    saveProgress();
    
  } catch (error) {
    console.error('\n❌ Sync error:', error);
    progress.status = 'error';
    saveProgress();
    throw error;
  } finally {
    if (ftpClient) {
      ftpClient.end();
    }
    await sql.end();
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Interrupted! Saving progress...');
  progress.status = 'interrupted';
  saveProgress();
  console.log('✅ Progress saved. Run again to resume.');
  process.exit(0);
});

// Run the sync
sync()
  .then(() => {
    console.log('\n✅ Sync completed!');
    console.log(`   Processed: ${progress.processedFiles.length} files`);
    console.log(`   Failed: ${progress.failedFiles.length} files`);
    
    // Option to clean up progress file
    if (process.env.CLEAN_PROGRESS === 'true') {
      fs.unlinkSync(PROGRESS_FILE);
      console.log('🗑️  Progress file cleaned up');
    } else {
      console.log(`\n💡 Progress saved in ${PROGRESS_FILE}`);
      console.log('   To start fresh next time, delete this file or set RESUME=false');
    }
    
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });