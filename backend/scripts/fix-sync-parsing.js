#!/usr/bin/env node

/**
 * Fix sync script to properly parse cruise line IDs from file paths
 * Handles the null cruise_line_id issue
 */

const { drizzle } = require('drizzle-orm/postgres-js');
const { sql: sqlTemplate } = require('drizzle-orm');
const postgres = require('postgres');
const FtpClient = require('ftp');
const fs = require('fs');
require('dotenv').config();

const schema = require('../dist/db/schema');
const { cruiseLines, ships, cruises } = schema;

const DATABASE_URL = process.env.DATABASE_URL;
const FTP_HOST = process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net';
const FTP_USER = process.env.TRAVELTEK_FTP_USER || process.env.FTP_USER;
const FTP_PASS = process.env.TRAVELTEK_FTP_PASSWORD || process.env.FTP_PASSWORD;

console.log('🔧 Fixed Sync with Proper ID Parsing');
console.log('=====================================\n');

if (!DATABASE_URL || !FTP_USER || !FTP_PASS) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, {
  ssl: { rejectUnauthorized: false }
});

const db = drizzle(sql, { schema });

/**
 * Parse IDs from file path
 * Example: /2025/09/62/2961/2073554.json
 * Returns: { year: 2025, month: 9, lineId: 62, shipId: 2961, cruiseId: 2073554 }
 */
function parseFilePath(filePath) {
  const parts = filePath.split('/').filter(p => p);
  
  if (parts.length < 5) {
    throw new Error(`Invalid file path structure: ${filePath}`);
  }
  
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  const lineId = parseInt(parts[2]);
  const shipId = parseInt(parts[3]);
  const cruiseId = parseInt(parts[4].replace('.json', ''));
  
  // Validate all IDs are valid numbers
  if (isNaN(lineId) || lineId <= 0) {
    throw new Error(`Invalid cruise line ID in path: ${filePath}`);
  }
  if (isNaN(shipId) || shipId <= 0) {
    throw new Error(`Invalid ship ID in path: ${filePath}`);
  }
  if (isNaN(cruiseId) || cruiseId <= 0) {
    throw new Error(`Invalid cruise ID in path: ${filePath}`);
  }
  
  return { year, month, lineId, shipId, cruiseId };
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
      keepalive: 10000
    });
  });
}

/**
 * Process a single file with proper ID extraction
 */
async function processFile(ftpClient, filePath) {
  try {
    // Parse IDs from file path FIRST
    const { lineId, shipId, cruiseId } = parseFilePath(filePath);
    
    console.log(`📥 Processing: ${filePath}`);
    console.log(`   IDs: Line=${lineId}, Ship=${shipId}, Cruise=${cruiseId}`);
    
    // Download file
    const data = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Download timeout')), 20000);
      
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
        stream.on('error', reject);
      });
    });
    
    // Extract names from data
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
    
    // Insert/update cruise line with ID from path
    await db.insert(cruiseLines)
      .values({ 
        id: lineId,  // Use ID from path
        name: lineName, 
        code: `CL${lineId}` 
      })
      .onConflictDoUpdate({
        target: cruiseLines.id,
        set: { name: lineName }
      });
    
    // Insert/update ship with both IDs from path
    await db.insert(ships)
      .values({ 
        id: shipId,  // Use ship ID from path
        cruise_line_id: lineId,  // Use cruise line ID from path - THIS IS THE FIX
        name: shipName,
        code: `S${shipId}`
      })
      .onConflictDoUpdate({
        target: ships.id,
        set: { 
          name: shipName,
          cruise_line_id: lineId  // Ensure cruise_line_id is always set
        }
      });
    
    // Insert/update cruise
    const cruiseName = data?.name || data?.cruisename || `Cruise ${cruiseId}`;
    
    await db.insert(cruises)
      .values({
        id: cruiseId,
        cruise_line_id: lineId,  // From path
        ship_id: shipId,  // From path
        name: cruiseName,
        traveltek_file_path: filePath,
        sailing_date: data?.startdate ? new Date(data.startdate) : data?.saildate ? new Date(data.saildate) : new Date(),
        duration_nights: data?.nights || data?.duration || 7,
        code_to_cruise_id: data?.codetocruiseid || `${cruiseId}`,
        is_active: true
      })
      .onConflictDoUpdate({
        target: cruises.id,
        set: {
          name: cruiseName,
          cruise_line_id: lineId,
          ship_id: shipId,
          traveltek_file_path: filePath
        }
      });
    
    console.log(`   ✅ Success: ${lineName} - ${shipName} - ${cruiseName}\n`);
    return true;
    
  } catch (error) {
    console.error(`   ❌ Failed: ${error.message}\n`);
    return false;
  }
}

/**
 * Process problematic files
 */
async function fixProblematicFiles() {
  let ftpClient;
  
  try {
    ftpClient = await connectToFTP();
    
    // List of files that failed with null cruise_line_id
    const problematicFiles = [
      '/2025/09/62/2961/2073554.json',
      '/2025/09/62/2961/2167631.json',
      '/2025/09/62/2962/2073494.json',
      '/2025/09/62/2962/2073495.json',
      '/2025/09/62/2962/2073555.json',
      '/2025/09/62/2963/2166123.json',
      '/2025/09/62/2963/2166124.json'
    ];
    
    console.log(`📋 Processing ${problematicFiles.length} problematic files...\n`);
    
    let successful = 0;
    let failed = 0;
    
    for (const file of problematicFiles) {
      const result = await processFile(ftpClient, file);
      if (result) {
        successful++;
      } else {
        failed++;
      }
    }
    
    console.log('\n========================================');
    console.log(`✅ Successfully processed: ${successful}`);
    console.log(`❌ Failed: ${failed}`);
    
    // Also ensure cruise line 62 exists
    console.log('\n📊 Verifying cruise line 62...');
    const line62 = await db.select().from(cruiseLines).where(sqlTemplate`${cruiseLines.id} = 62`);
    
    if (line62.length > 0) {
      console.log(`✅ Cruise line 62 exists: ${line62[0].name}`);
    } else {
      console.log('⚠️  Cruise line 62 not found, creating...');
      await db.insert(cruiseLines)
        .values({ id: 62, name: 'Cruise Line 62', code: 'CL62' });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (ftpClient) ftpClient.end();
    await sql.end();
  }
}

// Run the fix
fixProblematicFiles();