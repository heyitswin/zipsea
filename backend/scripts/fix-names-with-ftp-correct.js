#!/usr/bin/env node

/**
 * Fix cruise line and ship names using correct Traveltek FTP credentials
 * Uses the TRAVELTEK_ prefixed environment variables
 */

const { Pool } = require('pg');
const FtpClient = require('ftp');
const path = require('path');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;
const FTP_HOST = process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net';
const FTP_USER = process.env.TRAVELTEK_FTP_USER;
const FTP_PASS = process.env.TRAVELTEK_FTP_PASSWORD;

console.log('🔍 Using environment variables:');
console.log('   DATABASE_URL:', DATABASE_URL ? '✅ Set' : '❌ Not set');
console.log('   TRAVELTEK_FTP_HOST:', process.env.TRAVELTEK_FTP_HOST ? `✅ ${process.env.TRAVELTEK_FTP_HOST}` : '❌ Not set (using default)');
console.log('   TRAVELTEK_FTP_USER:', FTP_USER ? '✅ Set' : '❌ Not set');
console.log('   TRAVELTEK_FTP_PASSWORD:', FTP_PASS ? '✅ Set' : '❌ Not set');
console.log('');

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable not set');
  process.exit(1);
}

if (!FTP_USER || !FTP_PASS) {
  console.error('❌ FTP credentials not found in environment variables');
  console.error('   Required: TRAVELTEK_FTP_USER and TRAVELTEK_FTP_PASSWORD');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Cache for FTP data to avoid multiple downloads
const nameCache = {
  cruiseLines: new Map(),
  ships: new Map()
};

function connectToFTP() {
  return new Promise((resolve, reject) => {
    const ftpClient = new FtpClient();
    
    ftpClient.on('ready', () => {
      console.log('✅ Connected to FTP server');
      resolve(ftpClient);
    });
    
    ftpClient.on('error', (err) => {
      console.error('❌ FTP connection error:', err.message);
      reject(err);
    });
    
    console.log(`📡 Connecting to FTP: ${FTP_HOST}`);
    ftpClient.connect({
      host: FTP_HOST,
      user: FTP_USER,
      password: FTP_PASS
    });
  });
}

function getCruiseDataFromFTP(ftpClient, filePath) {
  return new Promise((resolve, reject) => {
    ftpClient.get(filePath, (err, stream) => {
      if (err) {
        console.error(`   ⚠️  Error fetching ${filePath}:`, err.message);
        resolve(null);
        return;
      }
      
      let data = '';
      stream.on('data', chunk => {
        data += chunk.toString();
      });
      
      stream.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (parseErr) {
          console.error(`   ⚠️  Error parsing JSON from ${filePath}:`, parseErr.message);
          resolve(null);
        }
      });
      
      stream.on('error', (streamErr) => {
        console.error(`   ⚠️  Stream error for ${filePath}:`, streamErr.message);
        resolve(null);
      });
    });
  });
}

function extractCruiseLineName(data) {
  if (!data) return null;
  
  // Priority order for cruise line names
  const nameExtractors = [
    () => data.linecontent?.enginename,
    () => data.linecontent?.name,
    () => data.linecontent?.shortname,
    () => typeof data.linename === 'string' ? data.linename : null,
    () => data.linename?.name,
    () => data.linecontent?.description
  ];
  
  for (const extractor of nameExtractors) {
    try {
      const name = extractor();
      if (name && typeof name === 'string' && name !== '[object Object]' && name.trim()) {
        return name.trim();
      }
    } catch (e) {
      // Continue to next extractor
    }
  }
  
  return null;
}

function extractShipName(data) {
  if (!data) return null;
  
  // Priority order for ship names
  const nameExtractors = [
    () => data.shipcontent?.name,
    () => data.shipcontent?.nicename,
    () => data.shipcontent?.shortname,
    () => typeof data.shipname === 'string' ? data.shipname : null,
    () => data.shipname?.name,
    () => data.shipcontent?.description
  ];
  
  for (const extractor of nameExtractors) {
    try {
      const name = extractor();
      if (name && typeof name === 'string' && name !== '[object Object]' && name.trim()) {
        return name.trim();
      }
    } catch (e) {
      // Continue to next extractor
    }
  }
  
  return null;
}

async function fixAllNames() {
  const client = await pool.connect();
  let ftpClient;
  
  try {
    console.log('🔧 Comprehensive Name Fix from FTP Data\n');
    console.log('========================================\n');
    
    // Connect to FTP
    ftpClient = await connectToFTP();
    
    // Step 1: Get all cruise lines and ships that need fixing
    console.log('1. Analyzing database for names that need fixing:\n');
    
    const badCruiseLines = await client.query(`
      SELECT COUNT(*) as count
      FROM cruise_lines
      WHERE name LIKE 'CL%' 
         OR name LIKE 'Line %' 
         OR name LIKE 'Cruise Line %'
         OR name = '[object Object]'
         OR name IS NULL
         OR name = ''
    `);
    
    const badShips = await client.query(`
      SELECT COUNT(*) as count
      FROM ships
      WHERE name LIKE 'Ship %'
         OR name LIKE 'MS %'
         OR name LIKE 'Cruise Ship %'
         OR name = '[object Object]'
         OR name IS NULL
         OR name = ''
    `);
    
    console.log(`   📊 Cruise lines needing fix: ${badCruiseLines.rows[0].count}`);
    console.log(`   📊 Ships needing fix: ${badShips.rows[0].count}\n`);
    
    // Step 2: Get sample cruise files for each cruise line/ship combo
    console.log('2. Fetching names from FTP data:\n');
    
    const cruiseFilePaths = await client.query(`
      SELECT DISTINCT 
        c.cruise_line_id,
        c.ship_id,
        c.traveltek_file_path,
        cl.name as current_line_name,
        s.name as current_ship_name
      FROM cruises c
      JOIN cruise_lines cl ON cl.id = c.cruise_line_id
      JOIN ships s ON s.id = c.ship_id
      WHERE c.traveltek_file_path IS NOT NULL
        AND (
          cl.name LIKE 'CL%' 
          OR cl.name LIKE 'Line %' 
          OR cl.name LIKE 'Cruise Line %'
          OR cl.name = '[object Object]'
          OR s.name LIKE 'Ship %'
          OR s.name LIKE 'MS %'
          OR s.name LIKE 'Cruise Ship %'
          OR s.name = '[object Object]'
        )
      ORDER BY c.cruise_line_id, c.ship_id
      LIMIT 200
    `);
    
    console.log(`   Found ${cruiseFilePaths.rows.length} unique line/ship combinations to process\n`);
    
    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;
    
    for (const row of cruiseFilePaths.rows) {
      processedCount++;
      
      // Show progress every 10 items
      if (processedCount % 10 === 0) {
        console.log(`   Progress: ${processedCount}/${cruiseFilePaths.rows.length} (${Math.round(processedCount * 100 / cruiseFilePaths.rows.length)}%) - Success: ${successCount}, Failed: ${failedCount}`);
      }
      
      // Skip if we already have good names in cache
      if (nameCache.cruiseLines.has(row.cruise_line_id) && 
          nameCache.ships.has(row.ship_id)) {
        continue;
      }
      
      // Fetch cruise data from FTP
      const cruiseData = await getCruiseDataFromFTP(ftpClient, row.traveltek_file_path);
      if (!cruiseData) {
        failedCount++;
        continue;
      }
      
      // Extract names
      const lineName = extractCruiseLineName(cruiseData);
      const shipName = extractShipName(cruiseData);
      
      // Cache the names
      if (lineName && !nameCache.cruiseLines.has(row.cruise_line_id)) {
        nameCache.cruiseLines.set(row.cruise_line_id, lineName);
        console.log(`   ✓ Found cruise line name: ${row.cruise_line_id} -> "${lineName}"`);
        successCount++;
      }
      
      if (shipName && !nameCache.ships.has(row.ship_id)) {
        nameCache.ships.set(row.ship_id, shipName);
        console.log(`   ✓ Found ship name: ${row.ship_id} -> "${shipName}"`);
        successCount++;
      }
    }
    
    console.log(`\n   ✅ Successfully extracted ${successCount} names`);
    console.log(`   ⚠️  Failed to fetch ${failedCount} files`);
    console.log(`   📦 Cached ${nameCache.cruiseLines.size} cruise line names`);
    console.log(`   📦 Cached ${nameCache.ships.size} ship names\n`);
    
    // Step 3: Update the database with real names
    console.log('3. Updating database with real names:\n');
    
    // Update cruise lines
    let updatedLines = 0;
    for (const [lineId, name] of nameCache.cruiseLines) {
      const result = await client.query(
        `UPDATE cruise_lines 
         SET name = $1 
         WHERE id = $2 
         AND (name LIKE 'CL%' OR name LIKE 'Line %' OR name LIKE 'Cruise Line %' OR name = '[object Object]')`,
        [name, lineId]
      );
      if (result.rowCount > 0) {
        updatedLines++;
      }
    }
    
    console.log(`   ✅ Updated ${updatedLines} cruise lines`);
    
    // Update ships
    let updatedShips = 0;
    for (const [shipId, name] of nameCache.ships) {
      const result = await client.query(
        `UPDATE ships 
         SET name = $1 
         WHERE id = $2 
         AND (name LIKE 'Ship %' OR name LIKE 'MS %' OR name LIKE 'Cruise Ship %' OR name = '[object Object]')`,
        [name, shipId]
      );
      if (result.rowCount > 0) {
        updatedShips++;
      }
    }
    
    console.log(`   ✅ Updated ${updatedShips} ships\n`);
    
    // Step 4: Show sample results
    console.log('4. Sample of updated names:\n');
    
    console.log('   Cruise Lines:');
    const lineIds = Array.from(nameCache.cruiseLines.keys()).slice(0, 5);
    if (lineIds.length > 0) {
      const sampleLines = await client.query(`
        SELECT id, name, code
        FROM cruise_lines
        WHERE id IN (${lineIds.join(',')})
        ORDER BY id
      `);
      
      for (const line of sampleLines.rows) {
        console.log(`     • ${line.name} (ID: ${line.id})`);
      }
    }
    
    console.log('\n   Ships:');
    const shipIds = Array.from(nameCache.ships.keys()).slice(0, 5);
    if (shipIds.length > 0) {
      const sampleShips = await client.query(`
        SELECT id, name, code
        FROM ships
        WHERE id IN (${shipIds.join(',')})
        ORDER BY id
      `);
      
      for (const ship of sampleShips.rows) {
        console.log(`     • ${ship.name} (ID: ${ship.id})`);
      }
    }
    
    // Step 5: Final statistics
    console.log('\n========================================');
    console.log('Final Results:');
    console.log('========================================\n');
    
    const finalBadCruiseLines = await client.query(`
      SELECT COUNT(*) as count
      FROM cruise_lines
      WHERE name LIKE 'CL%' 
         OR name LIKE 'Line %' 
         OR name LIKE 'Cruise Line %'
         OR name = '[object Object]'
    `);
    
    const finalBadShips = await client.query(`
      SELECT COUNT(*) as count
      FROM ships
      WHERE name LIKE 'Ship %'
         OR name LIKE 'MS %'
         OR name LIKE 'Cruise Ship %'
         OR name = '[object Object]'
    `);
    
    console.log(`✅ Successfully updated ${updatedLines} cruise lines`);
    console.log(`✅ Successfully updated ${updatedShips} ships`);
    console.log(`\n📊 Remaining issues:`);
    console.log(`   Cruise lines still needing fix: ${finalBadCruiseLines.rows[0].count}`);
    console.log(`   Ships still needing fix: ${finalBadShips.rows[0].count}`);
    
    if (finalBadCruiseLines.rows[0].count > 0 || finalBadShips.rows[0].count > 0) {
      console.log('\n⚠️  Some names could not be fixed. These may need manual review.');
      console.log('   Run the script again with a higher LIMIT to process more records.');
    }
    
    console.log('\n🎯 Next steps:');
    console.log('1. Clear the cache:');
    console.log('   curl -X POST https://zipsea-staging.onrender.com/health/cache/clear');
    console.log('\n2. Test the API:');
    console.log('   curl https://zipsea-staging.onrender.com/api/v1/cruises?limit=5');
    
  } catch (error) {
    console.error('❌ Error fixing names:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
    if (ftpClient) {
      ftpClient.end();
    }
  }
}

// Run the fix
fixAllNames()
  .then(() => {
    console.log('\n✅ Name fix complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Fix failed:', error);
    process.exit(1);
  });