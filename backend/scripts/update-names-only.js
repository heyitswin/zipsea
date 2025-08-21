#!/usr/bin/env node

/**
 * Quick script to update only cruise line and ship names from FTP data
 * This is faster than a full sync and focuses only on fixing names
 */

const { Pool } = require('pg');
const FtpClient = require('ftp');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;
const FTP_HOST = process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net';
const FTP_USER = process.env.TRAVELTEK_FTP_USER;
const FTP_PASS = process.env.TRAVELTEK_FTP_PASSWORD;

console.log('🚀 Quick Name Update Script');
console.log('============================\n');

if (!DATABASE_URL || !FTP_USER || !FTP_PASS) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Track what we've already updated to avoid duplicates
const updated = {
  lines: new Set(),
  ships: new Set()
};

function connectToFTP() {
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
      password: FTP_PASS
    });
  });
}

function getFile(ftpClient, path) {
  return new Promise((resolve) => {
    ftpClient.get(path, (err, stream) => {
      if (err) {
        resolve(null);
        return;
      }
      
      let data = '';
      stream.on('data', chunk => data += chunk.toString());
      stream.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
      stream.on('error', () => resolve(null));
    });
  });
}

function extractLineName(data) {
  if (!data) return null;
  
  // Correct extraction according to Traveltek docs
  if (data.linecontent && typeof data.linecontent === 'object') {
    return data.linecontent.enginename || 
           data.linecontent.name || 
           data.linecontent.shortname || 
           null;
  }
  return null;
}

function extractShipName(data) {
  if (!data) return null;
  
  // Correct extraction according to Traveltek docs
  if (data.shipcontent && typeof data.shipcontent === 'object') {
    return data.shipcontent.name || 
           data.shipcontent.nicename || 
           data.shipcontent.shortname || 
           null;
  }
  return null;
}

async function updateNames() {
  const client = await pool.connect();
  let ftpClient;
  
  try {
    ftpClient = await connectToFTP();
    
    // Get all cruises that have bad names
    const cruisesToFix = await client.query(`
      SELECT DISTINCT 
        c.cruise_line_id,
        c.ship_id,
        c.traveltek_file_path,
        cl.name as line_name,
        s.name as ship_name
      FROM cruises c
      JOIN cruise_lines cl ON cl.id = c.cruise_line_id
      JOIN ships s ON s.id = c.ship_id
      WHERE c.traveltek_file_path IS NOT NULL
        AND (
          cl.name LIKE 'CL%' OR 
          cl.name LIKE 'Line %' OR 
          cl.name LIKE 'Cruise Line %' OR
          s.name LIKE 'Ship %' OR 
          s.name LIKE 'MS S%' OR
          s.name LIKE 'MS Sh%' OR
          s.name ~ '^[A-Z][a-z]+' -- Single word names that are likely wrong
        )
      ORDER BY c.cruise_line_id, c.ship_id
      LIMIT 1000
    `);
    
    console.log(`📊 Found ${cruisesToFix.rows.length} cruise/ship combinations to check\n`);
    
    let processed = 0;
    let updatedCount = 0;
    
    for (const row of cruisesToFix.rows) {
      processed++;
      
      // Skip if already updated
      if (updated.lines.has(row.cruise_line_id) && updated.ships.has(row.ship_id)) {
        continue;
      }
      
      // Show progress
      if (processed % 50 === 0) {
        console.log(`Progress: ${processed}/${cruisesToFix.rows.length} (${Math.round(processed * 100 / cruisesToFix.rows.length)}%) - Updated: ${updatedCount}`);
      }
      
      // Get the cruise data
      const data = await getFile(ftpClient, row.traveltek_file_path);
      if (!data) continue;
      
      // Extract names
      const lineName = extractLineName(data);
      const shipName = extractShipName(data);
      
      // Update cruise line if needed
      if (lineName && !updated.lines.has(row.cruise_line_id)) {
        const result = await client.query(
          'UPDATE cruise_lines SET name = $1 WHERE id = $2 AND name != $1',
          [lineName, row.cruise_line_id]
        );
        if (result.rowCount > 0) {
          console.log(`✅ Line ${row.cruise_line_id}: "${row.line_name}" → "${lineName}"`);
          updated.lines.add(row.cruise_line_id);
          updatedCount++;
        }
      }
      
      // Update ship if needed
      if (shipName && !updated.ships.has(row.ship_id)) {
        const result = await client.query(
          'UPDATE ships SET name = $1 WHERE id = $2 AND name != $1',
          [shipName, row.ship_id]
        );
        if (result.rowCount > 0) {
          console.log(`✅ Ship ${row.ship_id}: "${row.ship_name}" → "${shipName}"`);
          updated.ships.add(row.ship_id);
          updatedCount++;
        }
      }
    }
    
    console.log(`\n✅ Updated ${updated.lines.size} cruise lines and ${updated.ships.size} ships`);
    
    // Show final statistics
    const stats = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM cruise_lines WHERE name LIKE 'CL%' OR name LIKE 'Line %' OR name LIKE 'Cruise Line %') as bad_lines,
        (SELECT COUNT(*) FROM ships WHERE name LIKE 'Ship %' OR name LIKE 'MS S%' OR name LIKE 'MS Sh%') as bad_ships,
        (SELECT COUNT(*) FROM cruise_lines) as total_lines,
        (SELECT COUNT(*) FROM ships) as total_ships
    `);
    
    const s = stats.rows[0];
    console.log(`\n📊 Final Status:`);
    console.log(`   Cruise Lines: ${s.total_lines - s.bad_lines}/${s.total_lines} have proper names`);
    console.log(`   Ships: ${s.total_ships - s.bad_ships}/${s.total_ships} have proper names`);
    
    if (s.bad_lines > 0 || s.bad_ships > 0) {
      console.log(`\n⚠️  Still ${s.bad_lines} cruise lines and ${s.bad_ships} ships need fixing`);
      console.log('   Run the script again to process more records');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (ftpClient) ftpClient.end();
    client.release();
    await pool.end();
  }
}

updateNames()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });