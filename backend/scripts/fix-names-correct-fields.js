#!/usr/bin/env node

/**
 * Fix cruise line and ship names using the CORRECT fields from Traveltek data
 * According to documentation:
 * - Cruise Line names: linecontent.enginename (preferred) or linecontent.name
 * - Ship names: shipcontent.name (preferred) or shipcontent.nicename
 */

const { Pool } = require('pg');
const FtpClient = require('ftp');
const path = require('path');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;
const FTP_HOST = process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net';
const FTP_USER = process.env.TRAVELTEK_FTP_USER;
const FTP_PASS = process.env.TRAVELTEK_FTP_PASSWORD;

console.log('🔍 Configuration Check:');
console.log('   DATABASE_URL:', DATABASE_URL ? '✅ Set' : '❌ Not set');
console.log('   TRAVELTEK_FTP_HOST:', FTP_HOST);
console.log('   TRAVELTEK_FTP_USER:', FTP_USER ? '✅ Set' : '❌ Not set');
console.log('   TRAVELTEK_FTP_PASSWORD:', FTP_PASS ? '✅ Set' : '❌ Not set');
console.log('');

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// If we have FTP credentials, we'll use them. Otherwise, we'll try to fix from existing data
const USE_FTP = FTP_USER && FTP_PASS;

// Cache for names
const nameCache = {
  cruiseLines: new Map(),
  ships: new Map()
};

function connectToFTP() {
  return new Promise((resolve, reject) => {
    if (!USE_FTP) {
      reject(new Error('FTP credentials not available'));
      return;
    }
    
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
  
  // CORRECT extraction according to Traveltek documentation
  // Priority order:
  // 1. linecontent.enginename (preferred - actual cruise line name)
  // 2. linecontent.name
  // 3. linecontent.shortname
  if (data.linecontent && typeof data.linecontent === 'object') {
    const name = data.linecontent.enginename || 
                 data.linecontent.name || 
                 data.linecontent.shortname;
    
    if (name && typeof name === 'string' && name !== '[object Object]' && name.trim()) {
      return name.trim();
    }
  }
  
  // Fallback to linename if available
  if (data.linename) {
    if (typeof data.linename === 'string' && data.linename !== '[object Object]') {
      return data.linename.trim();
    }
    if (typeof data.linename === 'object' && data.linename.name) {
      return data.linename.name.trim();
    }
  }
  
  return null;
}

function extractShipName(data) {
  if (!data) return null;
  
  // CORRECT extraction according to Traveltek documentation
  // Priority order:
  // 1. shipcontent.name (preferred)
  // 2. shipcontent.nicename
  // 3. shipcontent.shortname
  if (data.shipcontent && typeof data.shipcontent === 'object') {
    const name = data.shipcontent.name || 
                 data.shipcontent.nicename ||
                 data.shipcontent.shortname;
    
    if (name && typeof name === 'string' && name !== '[object Object]' && name.trim()) {
      return name.trim();
    }
  }
  
  // Fallback to shipname if available
  if (data.shipname) {
    if (typeof data.shipname === 'string' && data.shipname !== '[object Object]') {
      return data.shipname.trim();
    }
    if (typeof data.shipname === 'object' && data.shipname.name) {
      return data.shipname.name.trim();
    }
  }
  
  return null;
}

async function fixNamesWithFTP() {
  const client = await pool.connect();
  let ftpClient = null;
  
  try {
    console.log('🔧 Fixing Names with FTP Data (Using CORRECT Fields)\n');
    console.log('========================================\n');
    
    // Connect to FTP
    ftpClient = await connectToFTP();
    
    // Get all records that need fixing
    const badRecords = await client.query(`
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
        AND c.traveltek_file_path != ''
      ORDER BY c.cruise_line_id, c.ship_id
      LIMIT 500
    `);
    
    console.log(`📊 Processing ${badRecords.rows.length} cruise/ship combinations\n`);
    
    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;
    
    for (const row of badRecords.rows) {
      processedCount++;
      
      if (processedCount % 20 === 0) {
        console.log(`   Progress: ${processedCount}/${badRecords.rows.length} (${Math.round(processedCount * 100 / badRecords.rows.length)}%)`);
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
      
      // Extract names using CORRECT fields
      const lineName = extractCruiseLineName(cruiseData);
      const shipName = extractShipName(cruiseData);
      
      // Log what we found
      if (lineName && !nameCache.cruiseLines.has(row.cruise_line_id)) {
        nameCache.cruiseLines.set(row.cruise_line_id, lineName);
        console.log(`   ✅ Line ${row.cruise_line_id}: "${row.current_line_name}" → "${lineName}"`);
        successCount++;
      }
      
      if (shipName && !nameCache.ships.has(row.ship_id)) {
        nameCache.ships.set(row.ship_id, shipName);
        console.log(`   ✅ Ship ${row.ship_id}: "${row.current_ship_name}" → "${shipName}"`);
        successCount++;
      }
    }
    
    console.log(`\n📊 Extraction Results:`);
    console.log(`   ✅ Successfully extracted: ${successCount} names`);
    console.log(`   ⚠️  Failed to fetch: ${failedCount} files`);
    console.log(`   📦 Cruise lines found: ${nameCache.cruiseLines.size}`);
    console.log(`   📦 Ships found: ${nameCache.ships.size}\n`);
    
  } catch (error) {
    console.error('❌ Error during FTP processing:', error.message);
  } finally {
    if (ftpClient) {
      ftpClient.end();
    }
    client.release();
  }
}

async function fixNamesWithoutFTP() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Fixing Names Without FTP (Using Existing Data)\n');
    console.log('========================================\n');
    
    // For now, just improve the defaults
    console.log('Improving default names...\n');
    
    // This is a fallback - the real fix requires FTP data
    const improvedLines = await client.query(`
      UPDATE cruise_lines
      SET name = CASE
        WHEN code = 'CL1' THEN 'Royal Caribbean'
        WHEN code = 'CL3' THEN 'Carnival Cruise Line'
        WHEN code = 'CL5' THEN 'Norwegian Cruise Line'
        WHEN code = 'CL8' THEN 'Celebrity Cruises'
        WHEN code = 'CL9' THEN 'Princess Cruises'
        WHEN code = 'CL10' THEN 'Holland America Line'
        WHEN code = 'CL15' THEN 'MSC Cruises'
        WHEN code = 'CL16' THEN 'Costa Cruises'
        WHEN code = 'CL17' THEN 'Disney Cruise Line'
        ELSE name
      END
      WHERE name LIKE 'CL%' OR name LIKE 'Line %' OR name LIKE 'Cruise Line %'
      RETURNING id, name, code
    `);
    
    console.log(`Updated ${improvedLines.rowCount} cruise lines with known names\n`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
  }
}

async function applyUpdates() {
  if (nameCache.cruiseLines.size === 0 && nameCache.ships.size === 0) {
    console.log('⚠️  No names to update\n');
    return;
  }
  
  const client = await pool.connect();
  
  try {
    console.log('📝 Applying Updates to Database\n');
    console.log('========================================\n');
    
    // Update cruise lines
    let updatedLines = 0;
    for (const [lineId, name] of nameCache.cruiseLines) {
      const result = await client.query(
        'UPDATE cruise_lines SET name = $1 WHERE id = $2',
        [name, lineId]
      );
      if (result.rowCount > 0) {
        updatedLines++;
      }
    }
    
    console.log(`✅ Updated ${updatedLines} cruise lines`);
    
    // Update ships
    let updatedShips = 0;
    for (const [shipId, name] of nameCache.ships) {
      const result = await client.query(
        'UPDATE ships SET name = $1 WHERE id = $2',
        [name, shipId]
      );
      if (result.rowCount > 0) {
        updatedShips++;
      }
    }
    
    console.log(`✅ Updated ${updatedShips} ships\n`);
    
    // Show samples
    if (updatedLines > 0) {
      console.log('Sample cruise lines:');
      const sampleLines = await client.query(
        'SELECT id, name FROM cruise_lines WHERE id = ANY($1::int[]) ORDER BY id LIMIT 5',
        [Array.from(nameCache.cruiseLines.keys()).slice(0, 5)]
      );
      sampleLines.rows.forEach(line => {
        console.log(`   ${line.id}: ${line.name}`);
      });
      console.log('');
    }
    
    if (updatedShips > 0) {
      console.log('Sample ships:');
      const sampleShips = await client.query(
        'SELECT id, name FROM ships WHERE id = ANY($1::int[]) ORDER BY id LIMIT 5',
        [Array.from(nameCache.ships.keys()).slice(0, 5)]
      );
      sampleShips.rows.forEach(ship => {
        console.log(`   ${ship.id}: ${ship.name}`);
      });
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error applying updates:', error.message);
  } finally {
    client.release();
  }
}

async function showFinalStats() {
  const client = await pool.connect();
  
  try {
    console.log('📊 Final Statistics\n');
    console.log('========================================\n');
    
    const stats = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM cruise_lines WHERE name LIKE 'CL%' OR name LIKE 'Line %' OR name LIKE 'Cruise Line %') as bad_lines,
        (SELECT COUNT(*) FROM ships WHERE name LIKE 'Ship %' OR name LIKE 'MS %' OR name LIKE 'Cruise Ship %') as bad_ships,
        (SELECT COUNT(*) FROM cruise_lines) as total_lines,
        (SELECT COUNT(*) FROM ships) as total_ships
    `);
    
    const s = stats.rows[0];
    console.log(`Cruise Lines: ${s.total_lines - s.bad_lines}/${s.total_lines} have proper names`);
    console.log(`Ships: ${s.total_ships - s.bad_ships}/${s.total_ships} have proper names`);
    console.log(`\nRemaining issues:`);
    console.log(`   ${s.bad_lines} cruise lines still need fixing`);
    console.log(`   ${s.bad_ships} ships still need fixing`);
    
    if (s.bad_lines > 0 || s.bad_ships > 0) {
      console.log('\n⚠️  To fix remaining names, ensure FTP credentials are set and run again');
    }
    
  } catch (error) {
    console.error('❌ Error getting stats:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting Name Fix Process\n');
  
  if (USE_FTP) {
    await fixNamesWithFTP();
  } else {
    console.log('⚠️  FTP credentials not available, using fallback method\n');
    await fixNamesWithoutFTP();
  }
  
  await applyUpdates();
  await showFinalStats();
  
  console.log('\n✅ Process complete!');
  console.log('\n🎯 Next steps:');
  console.log('1. Clear the cache');
  console.log('2. Run the updated sync script for new data');
  console.log('3. Test the API to verify names are correct');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });