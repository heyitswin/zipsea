#!/usr/bin/env node

/**
 * Final fixed sync script with proper database result handling
 * Based on actual FTP structure: /[year]/[month-with-leading-zero]/[lineid]/[shipid]/[cruiseid].json
 */

require('dotenv').config();
const FTP = require('ftp');
const fs = require('fs');
const path = require('path');

console.log('🚢 Traveltek Cruise Data Sync - FINAL FIX');
console.log('==========================================\n');

const ftpConfig = {
  host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
  user: process.env.TRAVELTEK_FTP_USER,
  password: process.env.TRAVELTEK_FTP_PASSWORD,
  port: 21,
  secure: false,
  connTimeout: 30000,
  pasvTimeout: 30000
};

// Progress tracking
const PROGRESS_FILE = '.sync-progress-final.json';
let progress = {};
if (fs.existsSync(PROGRESS_FILE)) {
  progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
}

// Statistics
let stats = {
  newCruises: 0,
  existingCruises: 0,
  failedCruises: 0,
  errors: {}
};

// Database connection
const { db } = require('../dist/db/connection');
const { sql } = require('drizzle-orm');

// Data type converters
function toIntegerOrNull(value) {
  if (value === null || value === undefined || value === '' || value === 'system') {
    return null;
  }
  const num = Number(value);
  return isNaN(num) ? null : num;
}

function toDecimalOrNull(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'object') {
    return null;
  }
  const num = Number(value);
  return isNaN(num) ? null : num;
}

function parseArrayField(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(v => toIntegerOrNull(v)).filter(v => v !== null);
  if (typeof value === 'string') {
    return value.split(',').map(v => toIntegerOrNull(v.trim())).filter(v => v !== null);
  }
  return [];
}

function parseDateField(value) {
  if (!value) return new Date().toISOString();
  try {
    return new Date(value).toISOString();
  } catch (e) {
    return new Date().toISOString();
  }
}

// Helper to list directory
async function listDirectory(client, dirPath) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('List timeout')), 15000);
    
    client.list(dirPath, (err, list) => {
      clearTimeout(timeout);
      if (err) reject(err);
      else resolve(list || []);
    });
  });
}

// Helper to download file
async function downloadFile(client, filePath) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Download timeout')), 20000);
    
    client.get(filePath, (err, stream) => {
      if (err) {
        clearTimeout(timeout);
        reject(err);
        return;
      }
      
      let data = '';
      stream.on('data', chunk => data += chunk.toString());
      stream.on('end', () => {
        clearTimeout(timeout);
        resolve(data);
      });
      stream.on('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  });
}

// Save progress
function saveProgress() {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// Process single cruise file
async function processCruiseFile(client, filePath) {
  try {
    // Download and parse JSON
    const jsonContent = await downloadFile(client, filePath);
    const cruiseData = JSON.parse(jsonContent);
    
    // Parse cruise ID
    const cruiseId = toIntegerOrNull(cruiseData.cruiseid);
    if (!cruiseId) {
      throw new Error(`Invalid cruiseid: ${cruiseData.cruiseid}`);
    }
    
    // Check if already exists - fix the query result handling
    try {
      const existingResult = await db.execute(sql`
        SELECT id FROM cruises WHERE id = ${cruiseId} LIMIT 1
      `);
      
      // Handle different possible result structures
      const rows = existingResult.rows || existingResult || [];
      const exists = Array.isArray(rows) ? rows.length > 0 : false;
      
      if (exists) {
        stats.existingCruises++;
        return { success: true, exists: true };
      }
    } catch (checkError) {
      // If checking fails, try to insert anyway
      console.log(`   ⚠️ Could not check existing cruise ${cruiseId}, attempting insert`);
    }
    
    // Parse IDs
    const lineId = toIntegerOrNull(cruiseData.lineid) || 1;
    const shipId = toIntegerOrNull(cruiseData.shipid) || 1;
    const startPortId = toIntegerOrNull(cruiseData.startportid);
    const endPortId = toIntegerOrNull(cruiseData.endportid);
    const marketId = toIntegerOrNull(cruiseData.marketid);
    const ownerId = toIntegerOrNull(cruiseData.ownerid);
    
    // Parse arrays
    const portIds = parseArrayField(cruiseData.portids);
    const regionIds = parseArrayField(cruiseData.regionids);
    
    // Create dependencies first - use try/catch for each
    // Cruise line
    try {
      await db.execute(sql`
        INSERT INTO cruise_lines (id, name, code, is_active)
        VALUES (${lineId}, ${cruiseData.linename || 'Line ' + lineId}, ${'L' + lineId}, true)
        ON CONFLICT (id) DO NOTHING
      `);
    } catch (e) {
      // Ignore duplicate key errors
    }
    
    // Ship
    try {
      const shipName = cruiseData.shipname || 
                      (cruiseData.shipcontent && cruiseData.shipcontent.name) || 
                      'Ship ' + shipId;
      const shipCode = (cruiseData.shipcontent && cruiseData.shipcontent.code) || 
                      'S' + shipId;
      
      await db.execute(sql`
        INSERT INTO ships (id, cruise_line_id, name, code, is_active)
        VALUES (${shipId}, ${lineId}, ${shipName}, ${shipCode}, true)
        ON CONFLICT (id) DO NOTHING
      `);
    } catch (e) {
      // Ignore duplicate key errors
    }
    
    // Ports
    const allPortIds = new Set([startPortId, endPortId, ...portIds].filter(id => id !== null));
    for (const portId of allPortIds) {
      try {
        // Try to get port name from the ports array if available
        let portName = 'Port ' + portId;
        if (cruiseData.ports && Array.isArray(cruiseData.ports)) {
          const portIndex = portIds.indexOf(portId);
          if (portIndex >= 0 && cruiseData.ports[portIndex]) {
            portName = cruiseData.ports[portIndex];
          }
        }
        
        await db.execute(sql`
          INSERT INTO ports (id, name, code, is_active)
          VALUES (${portId}, ${portName}, ${'P' + portId}, true)
          ON CONFLICT (id) DO NOTHING
        `);
      } catch (e) {
        // Ignore duplicate key errors
      }
    }
    
    // Regions
    for (let i = 0; i < regionIds.length; i++) {
      const regionId = regionIds[i];
      try {
        // Try to get region name from the regions array if available
        let regionName = 'Region ' + regionId;
        if (cruiseData.regions && Array.isArray(cruiseData.regions) && cruiseData.regions[i]) {
          regionName = cruiseData.regions[i];
        }
        
        await db.execute(sql`
          INSERT INTO regions (id, name, code, is_active)
          VALUES (${regionId}, ${regionName}, ${'R' + regionId}, true)
          ON CONFLICT (id) DO NOTHING
        `);
      } catch (e) {
        // Ignore duplicate key errors
      }
    }
    
    // Parse dates
    const sailDate = parseDateField(cruiseData.saildate || cruiseData.startdate);
    const nights = toIntegerOrNull(cruiseData.nights) || 0;
    const returnDate = new Date(sailDate);
    returnDate.setDate(returnDate.getDate() + nights);
    
    // Insert cruise with better error handling
    try {
      await db.execute(sql`
        INSERT INTO cruises (
          id, 
          code_to_cruise_id, 
          cruise_line_id, 
          ship_id, 
          name,
          sailing_date, 
          return_date, 
          nights,
          embark_port_id, 
          disembark_port_id,
          market_id, 
          owner_id,
          region_ids, 
          port_ids,
          show_cruise, 
          is_active, 
          currency,
          traveltek_file_path
        ) VALUES (
          ${cruiseId},
          ${cruiseData.codetocruiseid || String(cruiseId)},
          ${lineId},
          ${shipId},
          ${cruiseData.name || 'Cruise ' + cruiseId},
          ${sailDate},
          ${returnDate.toISOString()},
          ${nights},
          ${startPortId},
          ${endPortId},
          ${marketId},
          ${ownerId},
          ${JSON.stringify(regionIds)},
          ${JSON.stringify(Array.from(allPortIds))},
          ${cruiseData.showcruise !== false},
          true,
          ${'USD'},
          ${filePath}
        )
      `);
      
      stats.newCruises++;
    } catch (insertError) {
      // Check if it's a duplicate key error
      if (insertError.message && insertError.message.includes('duplicate key')) {
        stats.existingCruises++;
        return { success: true, exists: true };
      }
      throw insertError;
    }
    
    // Process pricing if available - with error handling
    if (cruiseData.cheapest && cruiseData.cheapest.price) {
      try {
        await db.execute(sql`
          INSERT INTO cheapest_pricing (
            cruise_id,
            cheapest_price,
            cheapest_cabin_type,
            interior_price,
            oceanview_price,
            balcony_price,
            suite_price,
            currency
          ) VALUES (
            ${cruiseId},
            ${toDecimalOrNull(cruiseData.cheapest.price)},
            ${cruiseData.cheapest.cabintype || null},
            ${toDecimalOrNull(cruiseData.cheapestinside && cruiseData.cheapestinside.price)},
            ${toDecimalOrNull(cruiseData.cheapestoutside && cruiseData.cheapestoutside.price)},
            ${toDecimalOrNull(cruiseData.cheapestbalcony && cruiseData.cheapestbalcony.price)},
            ${toDecimalOrNull(cruiseData.cheapestsuite && cruiseData.cheapestsuite.price)},
            ${'USD'}
          )
          ON CONFLICT (cruise_id) DO NOTHING
        `);
      } catch (priceError) {
        // Ignore pricing errors - not critical
        console.log(`   ⚠️ Could not save pricing for cruise ${cruiseId}`);
      }
    }
    
    return { success: true, exists: false };
    
  } catch (error) {
    stats.failedCruises++;
    const errorKey = error.message ? error.message.substring(0, 50) : 'Unknown error';
    stats.errors[errorKey] = (stats.errors[errorKey] || 0) + 1;
    throw error;
  }
}

// Process directory
async function processDirectory(client, year, month, lineId, shipId) {
  const dirPath = `/${year}/${month.toString().padStart(2, '0')}/${lineId}/${shipId}`;
  
  try {
    const files = await listDirectory(client, dirPath);
    const jsonFiles = files.filter(f => f.type === '-' && f.name.endsWith('.json'));
    
    console.log(`      📂 ${dirPath}: ${jsonFiles.length} files`);
    
    for (const file of jsonFiles) {
      const filePath = `${dirPath}/${file.name}`;
      
      // Check if already processed
      if (progress[filePath]) {
        continue;
      }
      
      try {
        await processCruiseFile(client, filePath);
        progress[filePath] = true;
        
        // Show progress every 10 files
        const total = stats.newCruises + stats.existingCruises + stats.failedCruises;
        if (total % 10 === 0) {
          console.log(`         📊 Progress: ${stats.newCruises} new, ${stats.existingCruises} existing, ${stats.failedCruises} failed`);
          saveProgress();
        }
      } catch (error) {
        console.log(`         ❌ Failed ${file.name}: ${error.message || error}`);
      }
    }
  } catch (error) {
    // Directory doesn't exist, skip silently
  }
}

// Main sync function
async function sync() {
  const client = new FTP();
  
  return new Promise((resolve, reject) => {
    client.on('ready', async () => {
      console.log('✅ Connected to FTP\n');
      
      try {
        // Test database connection first
        console.log('🔍 Testing database connection...');
        try {
          const testResult = await db.execute(sql`SELECT COUNT(*) as count FROM cruises`);
          const count = testResult.rows ? testResult.rows[0]?.count : 0;
          console.log(`   ✅ Database connected. Current cruises: ${count}\n`);
        } catch (dbError) {
          console.log(`   ⚠️ Database test failed: ${dbError.message}\n`);
        }
        
        // Focus on 2025 and 2026
        const years = ['2025', '2026'];
        const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
        
        for (const year of years) {
          console.log(`\n📅 YEAR ${year}`);
          console.log('────────────────────────────────────────\n');
          
          for (const month of months) {
            console.log(`📆 Processing ${year}/${month}...`);
            
            try {
              // Get cruise lines for this month
              const monthPath = `/${year}/${month}`;
              const lineDirs = await listDirectory(client, monthPath);
              
              for (const lineDir of lineDirs.filter(d => d.type === 'd')) {
                const lineId = lineDir.name;
                
                // Get ships for this line
                const linePath = `${monthPath}/${lineId}`;
                try {
                  const shipDirs = await listDirectory(client, linePath);
                  
                  for (const shipDir of shipDirs.filter(d => d.type === 'd')) {
                    const shipId = shipDir.name;
                    await processDirectory(client, year, month, lineId, shipId);
                  }
                } catch (e) {
                  // Line directory doesn't exist
                }
              }
              
              console.log(`   ✅ ${year}/${month} complete: ${stats.newCruises} new, ${stats.existingCruises} existing, ${stats.failedCruises} failed`);
              saveProgress();
              
            } catch (error) {
              console.log(`   ⚠️ Skipping ${year}/${month}: ${error.message}`);
            }
          }
        }
        
        // Print final summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 SYNC COMPLETE');
        console.log('='.repeat(60));
        console.log(`✅ New cruises added: ${stats.newCruises}`);
        console.log(`⚠️  Existing cruises skipped: ${stats.existingCruises}`);
        console.log(`❌ Failed cruises: ${stats.failedCruises}`);
        
        if (Object.keys(stats.errors).length > 0) {
          console.log('\n🔍 ERROR SUMMARY:');
          console.log('─'.repeat(40));
          Object.entries(stats.errors)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .forEach(([error, count]) => {
              console.log(`   ${count}x: ${error}`);
            });
        }
        
        // Test final count
        try {
          const finalResult = await db.execute(sql`SELECT COUNT(*) as count FROM cruises`);
          const finalCount = finalResult.rows ? finalResult.rows[0]?.count : 0;
          console.log(`\n📊 Total cruises in database: ${finalCount}`);
        } catch (e) {
          // Ignore
        }
        
        client.end();
        resolve();
        
      } catch (error) {
        console.error('Sync error:', error);
        client.end();
        reject(error);
      }
    });
    
    client.on('error', (err) => {
      console.error('FTP error:', err.message);
      reject(err);
    });
    
    client.connect(ftpConfig);
  });
}

// Run sync
sync()
  .then(() => {
    console.log('\n✨ Sync complete!');
    console.log('Run "SELECT COUNT(*) FROM cruises;" to verify data');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal:', error.message);
    process.exit(1);
  });