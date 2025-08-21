#!/usr/bin/env node

/**
 * Comprehensive fix for cruise line and ship names
 * This script efficiently updates all names from FTP data
 */

const { Pool } = require('pg');
const ftp = require('basic-ftp');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL || process.env.PRODUCTION_DATABASE_URL;
const FTP_HOST = process.env.FTP_HOST || 'ftpeu1prod.traveltek.net';
const FTP_USER = process.env.FTP_USER;
const FTP_PASS = process.env.FTP_PASS;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable not set');
  process.exit(1);
}

if (!FTP_USER || !FTP_PASS) {
  console.error('❌ FTP credentials not found in environment variables');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const ftpClient = new ftp.Client();
ftpClient.ftp.verbose = false;

// Cache for FTP data to avoid multiple downloads
const nameCache = {
  cruiseLines: new Map(),
  ships: new Map()
};

async function connectToFTP() {
  try {
    await ftpClient.access({
      host: FTP_HOST,
      user: FTP_USER,
      password: FTP_PASS,
      secure: false,
      secureOptions: { rejectUnauthorized: false }
    });
    console.log('✅ Connected to FTP server');
    return true;
  } catch (error) {
    console.error('❌ Failed to connect to FTP:', error.message);
    return false;
  }
}

async function getCruiseDataFromFTP(filePath) {
  try {
    const chunks = [];
    await ftpClient.downloadTo(chunks, filePath);
    const content = Buffer.concat(chunks).toString('utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error fetching ${filePath}:`, error.message);
    return null;
  }
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
  
  try {
    console.log('🔧 Comprehensive Name Fix from FTP Data\n');
    console.log('========================================\n');
    
    // Connect to FTP
    if (!await connectToFTP()) {
      throw new Error('Failed to connect to FTP');
    }
    
    // Step 1: Get all cruise lines and ships that need fixing
    console.log('1. Analyzing database for names that need fixing:\n');
    
    const badCruiseLines = await client.query(`
      SELECT COUNT(*) as count
      FROM cruise_lines
      WHERE name LIKE 'CL%' 
         OR name LIKE 'Line %' 
         OR name = '[object Object]'
         OR name IS NULL
         OR name = ''
    `);
    
    const badShips = await client.query(`
      SELECT COUNT(*) as count
      FROM ships
      WHERE name LIKE 'Ship %'
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
          OR cl.name = '[object Object]'
          OR s.name LIKE 'Ship %'
          OR s.name = '[object Object]'
        )
      ORDER BY c.cruise_line_id, c.ship_id
    `);
    
    console.log(`   Found ${cruiseFilePaths.rows.length} unique line/ship combinations to process\n`);
    
    let processedCount = 0;
    let successCount = 0;
    
    for (const row of cruiseFilePaths.rows) {
      processedCount++;
      
      // Show progress every 10 items
      if (processedCount % 10 === 0) {
        console.log(`   Progress: ${processedCount}/${cruiseFilePaths.rows.length} (${Math.round(processedCount * 100 / cruiseFilePaths.rows.length)}%)`);
      }
      
      // Skip if we already have good names in cache
      if (nameCache.cruiseLines.has(row.cruise_line_id) && 
          nameCache.ships.has(row.ship_id)) {
        continue;
      }
      
      // Fetch cruise data from FTP
      const cruiseData = await getCruiseDataFromFTP(row.traveltek_file_path);
      if (!cruiseData) {
        continue;
      }
      
      // Extract names
      const lineName = extractCruiseLineName(cruiseData);
      const shipName = extractShipName(cruiseData);
      
      // Cache the names
      if (lineName && !nameCache.cruiseLines.has(row.cruise_line_id)) {
        nameCache.cruiseLines.set(row.cruise_line_id, lineName);
        successCount++;
      }
      
      if (shipName && !nameCache.ships.has(row.ship_id)) {
        nameCache.ships.set(row.ship_id, shipName);
        successCount++;
      }
    }
    
    console.log(`\n   ✅ Successfully extracted ${successCount} names`);
    console.log(`   📦 Cached ${nameCache.cruiseLines.size} cruise line names`);
    console.log(`   📦 Cached ${nameCache.ships.size} ship names\n`);
    
    // Step 3: Update the database with real names
    console.log('3. Updating database with real names:\n');
    
    // Update cruise lines
    let updatedLines = 0;
    for (const [lineId, name] of nameCache.cruiseLines) {
      const result = await client.query(
        'UPDATE cruise_lines SET name = $1 WHERE id = $2 AND (name LIKE \'CL%\' OR name LIKE \'Line %\' OR name = \'[object Object]\')',
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
        'UPDATE ships SET name = $1 WHERE id = $2 AND (name LIKE \'Ship %\' OR name = \'[object Object]\')',
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
    const sampleLines = await client.query(`
      SELECT id, name, code
      FROM cruise_lines
      WHERE id IN (${Array.from(nameCache.cruiseLines.keys()).slice(0, 5).join(',') || '0'})
      ORDER BY id
    `);
    
    for (const line of sampleLines.rows) {
      console.log(`     • ${line.name} (ID: ${line.id})`);
    }
    
    console.log('\n   Ships:');
    const sampleShips = await client.query(`
      SELECT id, name, code
      FROM ships
      WHERE id IN (${Array.from(nameCache.ships.keys()).slice(0, 5).join(',') || '0'})
      ORDER BY id
    `);
    
    for (const ship of sampleShips.rows) {
      console.log(`     • ${ship.name} (ID: ${ship.id})`);
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
         OR name = '[object Object]'
    `);
    
    const finalBadShips = await client.query(`
      SELECT COUNT(*) as count
      FROM ships
      WHERE name LIKE 'Ship %'
         OR name = '[object Object]'
    `);
    
    console.log(`✅ Successfully updated ${updatedLines} cruise lines`);
    console.log(`✅ Successfully updated ${updatedShips} ships`);
    console.log(`\n📊 Remaining issues:`);
    console.log(`   Cruise lines still needing fix: ${finalBadCruiseLines.rows[0].count}`);
    console.log(`   Ships still needing fix: ${finalBadShips.rows[0].count}`);
    
    if (finalBadCruiseLines.rows[0].count > 0 || finalBadShips.rows[0].count > 0) {
      console.log('\n⚠️  Some names could not be fixed. These may need manual review.');
    }
    
    console.log('\n🎯 Next steps:');
    console.log('1. Clear the cache on staging:');
    console.log('   curl -X POST https://zipsea-staging.onrender.com/health/cache/clear');
    console.log('\n2. Test the API:');
    console.log('   curl https://zipsea-staging.onrender.com/api/v1/cruises?limit=5');
    console.log('\n3. If results look good, merge to production and run there too.');
    
  } catch (error) {
    console.error('❌ Error fixing names:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
    ftpClient.close();
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