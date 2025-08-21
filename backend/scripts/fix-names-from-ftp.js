#!/usr/bin/env node

/**
 * Fix cruise line and ship names by extracting real names from FTP data
 * This script will look up the actual names from the cruise JSON files
 */

const { Pool } = require('pg');
const ftp = require('basic-ftp');
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
    // Download the file content as a string
    const chunks = [];
    const stream = await ftpClient.downloadTo(chunks, filePath);
    const content = Buffer.concat(chunks).toString('utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error fetching ${filePath}:`, error.message);
    return null;
  }
}

async function extractNameFromData(data, type) {
  if (!data) return null;
  
  if (type === 'cruise_line') {
    // Try different possible fields for cruise line name
    if (data.linecontent && typeof data.linecontent === 'object') {
      // Check for engine name (the actual cruise line name)
      if (data.linecontent.enginename) {
        return data.linecontent.enginename;
      }
      // Check for name field
      if (data.linecontent.name) {
        return data.linecontent.name;
      }
      // Check for description
      if (data.linecontent.description) {
        return data.linecontent.description;
      }
    }
    
    // Try linename directly
    if (data.linename) {
      if (typeof data.linename === 'string') {
        return data.linename;
      }
      if (typeof data.linename === 'object' && data.linename.name) {
        return data.linename.name;
      }
    }
  }
  
  if (type === 'ship') {
    // Try shipcontent first
    if (data.shipcontent && typeof data.shipcontent === 'object') {
      if (data.shipcontent.name) {
        return data.shipcontent.name;
      }
      if (data.shipcontent.nicename) {
        return data.shipcontent.nicename;
      }
    }
    
    // Try shipname
    if (data.shipname) {
      if (typeof data.shipname === 'string') {
        return data.shipname;
      }
      if (typeof data.shipname === 'object' && data.shipname.name) {
        return data.shipname.name;
      }
    }
  }
  
  return null;
}

async function fixNamesFromFTP() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Fixing Cruise Line and Ship Names from FTP Data\n');
    console.log('========================================\n');
    
    // Connect to FTP
    if (!await connectToFTP()) {
      throw new Error('Failed to connect to FTP');
    }
    
    // Get cruise lines that need fixing (those with code-like names)
    console.log('1. Getting cruise lines to fix:');
    const cruiseLines = await client.query(`
      SELECT DISTINCT cl.id, cl.code, cl.name, c.traveltek_file_path
      FROM cruise_lines cl
      JOIN cruises c ON c.cruise_line_id = cl.id
      WHERE cl.name LIKE 'CL%' OR cl.name LIKE 'Line %'
      ORDER BY cl.id
      LIMIT 20
    `);
    
    console.log(`   Found ${cruiseLines.rows.length} cruise lines to check\n`);
    
    // Process each cruise line
    const lineUpdates = new Map();
    
    for (const line of cruiseLines.rows) {
      if (!line.traveltek_file_path) continue;
      
      console.log(`   Checking cruise line ${line.id} (${line.name})...`);
      
      // Get cruise data from FTP
      const cruiseData = await getCruiseDataFromFTP(line.traveltek_file_path);
      if (!cruiseData) {
        console.log(`     ⚠️  Could not fetch data`);
        continue;
      }
      
      // Extract the real name
      const realName = await extractNameFromData(cruiseData, 'cruise_line');
      
      if (realName && realName !== '[object Object]') {
        lineUpdates.set(line.id, realName);
        console.log(`     ✅ Found name: "${realName}"`);
      } else {
        console.log(`     ⚠️  Could not extract name`);
      }
    }
    
    // Update cruise lines with real names
    console.log('\n2. Updating cruise lines with real names:');
    let updatedLines = 0;
    for (const [lineId, name] of lineUpdates) {
      await client.query(
        'UPDATE cruise_lines SET name = $1 WHERE id = $2',
        [name, lineId]
      );
      updatedLines++;
      console.log(`   Updated cruise line ${lineId} -> "${name}"`);
    }
    console.log(`   Total updated: ${updatedLines} cruise lines\n`);
    
    // Get ships that need fixing
    console.log('3. Getting ships to fix:');
    const ships = await client.query(`
      SELECT DISTINCT s.id, s.code, s.name, c.traveltek_file_path
      FROM ships s
      JOIN cruises c ON c.ship_id = s.id
      WHERE s.name LIKE 'Ship %' OR s.name = '[object Object]'
      ORDER BY s.id
      LIMIT 20
    `);
    
    console.log(`   Found ${ships.rows.length} ships to check\n`);
    
    // Process each ship
    const shipUpdates = new Map();
    
    for (const ship of ships.rows) {
      if (!ship.traveltek_file_path) continue;
      
      console.log(`   Checking ship ${ship.id} (${ship.name})...`);
      
      // Get cruise data from FTP
      const cruiseData = await getCruiseDataFromFTP(ship.traveltek_file_path);
      if (!cruiseData) {
        console.log(`     ⚠️  Could not fetch data`);
        continue;
      }
      
      // Extract the real name
      const realName = await extractNameFromData(cruiseData, 'ship');
      
      if (realName && realName !== '[object Object]') {
        shipUpdates.set(ship.id, realName);
        console.log(`     ✅ Found name: "${realName}"`);
      } else {
        console.log(`     ⚠️  Could not extract name`);
      }
    }
    
    // Update ships with real names
    console.log('\n4. Updating ships with real names:');
    let updatedShips = 0;
    for (const [shipId, name] of shipUpdates) {
      await client.query(
        'UPDATE ships SET name = $1 WHERE id = $2',
        [name, shipId]
      );
      updatedShips++;
      console.log(`   Updated ship ${shipId} -> "${name}"`);
    }
    console.log(`   Total updated: ${updatedShips} ships\n`);
    
    // Show sample results
    console.log('\n5. Sample updated cruise lines:');
    const sampleLines = await client.query(`
      SELECT id, name, code
      FROM cruise_lines
      WHERE id IN (${Array.from(lineUpdates.keys()).slice(0, 5).join(',') || '0'})
    `);
    
    sampleLines.rows.forEach(line => {
      console.log(`   ${line.code || line.id}: ${line.name}`);
    });
    
    console.log('\n6. Sample updated ships:');
    const sampleShips = await client.query(`
      SELECT id, name, code
      FROM ships
      WHERE id IN (${Array.from(shipUpdates.keys()).slice(0, 5).join(',') || '0'})
    `);
    
    sampleShips.rows.forEach(ship => {
      console.log(`   ${ship.code || ship.id}: ${ship.name}`);
    });
    
    console.log('\n========================================');
    console.log('Results:');
    console.log('========================================\n');
    
    console.log(`✅ Updated ${updatedLines} cruise lines with real names`);
    console.log(`✅ Updated ${updatedShips} ships with real names`);
    
    console.log('\nNote: This script only processes a sample of data.');
    console.log('To fix all names, remove the LIMIT clauses and run again.');
    console.log('\nClear cache and test the API:');
    console.log('curl -X POST https://zipsea-staging.onrender.com/health/cache/clear');
    console.log('curl https://zipsea-staging.onrender.com/api/v1/cruises?limit=5');
    
  } catch (error) {
    console.error('❌ Error fixing names:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
    ftpClient.close();
  }
}

// Run the fix
fixNamesFromFTP()
  .then(() => {
    console.log('\n✅ Fix complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Fix failed:', error);
    process.exit(1);
  });