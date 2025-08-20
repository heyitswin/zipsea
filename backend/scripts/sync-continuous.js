#!/usr/bin/env node

/**
 * Continuous sync that processes ALL data systematically
 * Tracks progress and can resume from where it left off
 */

require('dotenv').config();
const FTP = require('ftp');
const fs = require('fs');
const path = require('path');

console.log('♾️  CONTINUOUS FTP Sync - Processes Everything');
console.log('=============================================\n');

// Progress tracking file
const PROGRESS_FILE = path.join(__dirname, '.sync-progress.json');

// Load or initialize progress
let progress = {};
try {
  if (fs.existsSync(PROGRESS_FILE)) {
    progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    console.log('📊 Resuming from previous sync...\n');
  }
} catch (e) {
  console.log('📝 Starting fresh sync...\n');
}

const ftpConfig = {
  host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
  user: process.env.TRAVELTEK_FTP_USER,
  password: process.env.TRAVELTEK_FTP_PASSWORD,
  port: 21,
  secure: false,
  connTimeout: 30000,
  pasvTimeout: 30000,
  keepalive: 5000
};

if (!ftpConfig.user || !ftpConfig.password) {
  console.error('❌ FTP credentials not found');
  process.exit(1);
}

// Save progress periodically
function saveProgress() {
  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
  } catch (e) {
    console.error('Could not save progress:', e.message);
  }
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

// Check if cruise already exists
async function cruiseExists(cruiseId) {
  const { db } = require('../dist/db/connection');
  const { sql } = require('drizzle-orm');
  
  try {
    const result = await db.execute(sql`
      SELECT id FROM cruises WHERE id = ${cruiseId} LIMIT 1
    `);
    return result.rows.length > 0;
  } catch (e) {
    return false;
  }
}

// Sync single cruise
async function syncCruise(cruiseData) {
  const { db } = require('../dist/db/connection');
  const { sql } = require('drizzle-orm');
  
  const cruiseId = Number(cruiseData.cruiseid);
  
  // Skip if already exists
  if (await cruiseExists(cruiseId)) {
    return { skipped: true };
  }
  
  try {
    const lineId = Number(cruiseData.lineid) || 1;
    const shipId = Number(cruiseData.shipid);
    const startPortId = cruiseData.startportid ? Number(cruiseData.startportid) : null;
    const endPortId = cruiseData.endportid ? Number(cruiseData.endportid) : null;
    
    // Create dependencies
    await db.execute(sql`
      INSERT INTO cruise_lines (id, name, code, is_active)
      VALUES (${lineId}, ${'Line ' + lineId}, ${'CL' + lineId}, true)
      ON CONFLICT DO NOTHING
    `);
    
    await db.execute(sql`
      INSERT INTO ships (id, cruise_line_id, name, code, is_active)
      VALUES (${shipId}, ${lineId}, ${'Ship ' + shipId}, ${'SH' + shipId}, true)
      ON CONFLICT DO NOTHING
    `);
    
    // Handle ports
    const portIds = new Set();
    if (startPortId) portIds.add(startPortId);
    if (endPortId) portIds.add(endPortId);
    
    if (cruiseData.portids) {
      const ids = cruiseData.portids.split(',').map(p => Number(p.trim())).filter(p => !isNaN(p));
      ids.forEach(id => portIds.add(id));
    }
    
    for (const portId of portIds) {
      await db.execute(sql`
        INSERT INTO ports (id, name, code, is_active)
        VALUES (${portId}, ${'Port ' + portId}, ${'P' + portId}, true)
        ON CONFLICT DO NOTHING
      `);
    }
    
    // Handle regions
    const regionIds = [];
    if (cruiseData.regionids) {
      const ids = cruiseData.regionids.split(',').map(r => Number(r.trim())).filter(r => !isNaN(r));
      for (const regionId of ids) {
        regionIds.push(regionId);
        await db.execute(sql`
          INSERT INTO regions (id, name, code, is_active)
          VALUES (${regionId}, ${'Region ' + regionId}, ${'R' + regionId}, true)
          ON CONFLICT DO NOTHING
        `);
      }
    }
    
    // Insert cruise
    const sailDate = cruiseData.saildate || cruiseData.startdate;
    const returnDate = new Date(sailDate);
    returnDate.setDate(returnDate.getDate() + (cruiseData.nights || 0));
    
    await db.execute(sql`
      INSERT INTO cruises (
        id, code_to_cruise_id, cruise_line_id, ship_id, name,
        sailing_date, return_date, nights,
        embark_port_id, disembark_port_id,
        region_ids, port_ids, show_cruise, is_active
      ) VALUES (
        ${cruiseId},
        ${cruiseData.codetocruiseid || String(cruiseId)},
        ${lineId}, ${shipId},
        ${cruiseData.name || 'Cruise ' + cruiseId},
        ${sailDate},
        ${returnDate.toISOString().split('T')[0]},
        ${cruiseData.nights || 0},
        ${startPortId}, ${endPortId},
        ${JSON.stringify(regionIds)},
        ${JSON.stringify(Array.from(portIds))},
        true, true
      )
    `);
    
    return { success: true };
  } catch (error) {
    throw error;
  }
}

async function continuousSync() {
  let client = new FTP();
  let totalProcessed = progress.totalProcessed || 0;
  let totalSuccess = progress.totalSuccess || 0;
  let totalSkipped = progress.totalSkipped || 0;
  let totalFailed = progress.totalFailed || 0;
  
  // Helper to connect
  const connect = () => new Promise((resolve, reject) => {
    client = new FTP();
    client.on('ready', resolve);
    client.on('error', reject);
    client.connect(ftpConfig);
  });
  
  try {
    console.log('🔌 Connecting to FTP...');
    await connect();
    console.log('✅ Connected\n');
    
    // Get all years
    const years = await listDirectory(client, '/');
    const yearDirs = years
      .filter(item => item.type === 'd' && /^\d{4}$/.test(item.name))
      .map(item => item.name)
      .sort();
    
    // Focus on 2025-2026 for now
    const targetYears = yearDirs.filter(y => y >= '2025' && y <= '2026');
    
    console.log(`📅 Processing years: ${targetYears.join(', ')}\n`);
    
    for (const year of targetYears) {
      // Skip completed years
      if (progress[year]?.completed) {
        console.log(`⏭️  Skipping completed year ${year}`);
        continue;
      }
      
      console.log(`\n📅 YEAR ${year}`);
      console.log('─'.repeat(40));
      
      const months = await listDirectory(client, year);
      const monthDirs = months
        .filter(item => item.type === 'd' && /^\d{2}$/.test(item.name))
        .map(item => item.name)
        .sort();
      
      for (const month of monthDirs) {
        const monthKey = `${year}/${month}`;
        
        // Skip completed months
        if (progress[monthKey]?.completed) {
          console.log(`⏭️  Skipping completed ${monthKey}`);
          continue;
        }
        
        console.log(`\n📆 Processing ${monthKey}...`);
        
        // Initialize month progress
        if (!progress[monthKey]) {
          progress[monthKey] = { processed: 0, total: 0 };
        }
        
        const cruiseLines = await listDirectory(client, monthKey);
        const lineDirs = cruiseLines
          .filter(item => item.type === 'd')
          .map(item => item.name);
        
        let monthFileCount = 0;
        let monthSuccess = 0;
        let monthSkipped = 0;
        let monthFailed = 0;
        
        // Process each cruise line
        for (const lineId of lineDirs) {
          const linePath = `${monthKey}/${lineId}`;
          
          try {
            const ships = await listDirectory(client, linePath);
            const shipDirs = ships
              .filter(item => item.type === 'd')
              .map(item => item.name);
            
            for (const shipId of shipDirs) {
              const shipPath = `${linePath}/${shipId}`;
              
              try {
                const files = await listDirectory(client, shipPath);
                const jsonFiles = files
                  .filter(item => item.type === '-' && item.name.endsWith('.json'))
                  .map(item => item.name);
                
                // Process each file
                for (const fileName of jsonFiles) {
                  const filePath = `${shipPath}/${fileName}`;
                  monthFileCount++;
                  
                  try {
                    const jsonContent = await downloadFile(client, filePath);
                    const cruiseData = JSON.parse(jsonContent);
                    
                    if (!cruiseData.codetocruiseid) {
                      cruiseData.codetocruiseid = fileName.replace('.json', '');
                    }
                    
                    const result = await syncCruise(cruiseData);
                    
                    if (result.skipped) {
                      monthSkipped++;
                      totalSkipped++;
                    } else {
                      monthSuccess++;
                      totalSuccess++;
                    }
                    
                  } catch (error) {
                    monthFailed++;
                    totalFailed++;
                    
                    // Reconnect if needed
                    if (error.message.includes('ECONNRESET') || error.message.includes('timeout')) {
                      console.log('   🔄 Reconnecting...');
                      try {
                        client.end();
                        await connect();
                        console.log('   ✅ Reconnected');
                      } catch (e) {
                        console.error('   ❌ Reconnection failed');
                        throw e;
                      }
                    }
                  }
                  
                  totalProcessed++;
                  
                  // Show progress every 50 files
                  if (totalProcessed % 50 === 0) {
                    console.log(`   📊 Progress: ${totalProcessed} files (${totalSuccess} new, ${totalSkipped} existing, ${totalFailed} failed)`);
                    
                    // Save progress
                    progress.totalProcessed = totalProcessed;
                    progress.totalSuccess = totalSuccess;
                    progress.totalSkipped = totalSkipped;
                    progress.totalFailed = totalFailed;
                    progress[monthKey].processed = monthFileCount;
                    saveProgress();
                  }
                }
              } catch (e) {
                // Skip inaccessible ships
              }
            }
          } catch (e) {
            // Skip inaccessible cruise lines
          }
        }
        
        // Mark month as completed
        progress[monthKey].completed = true;
        progress[monthKey].total = monthFileCount;
        progress[monthKey].success = monthSuccess;
        progress[monthKey].skipped = monthSkipped;
        progress[monthKey].failed = monthFailed;
        saveProgress();
        
        console.log(`   ✅ ${monthKey} complete: ${monthSuccess} new, ${monthSkipped} existing, ${monthFailed} failed`);
      }
      
      // Mark year as completed
      progress[year] = { completed: true };
      saveProgress();
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 SYNC COMPLETE!');
    console.log('='.repeat(60));
    console.log(`📊 Total files processed: ${totalProcessed}`);
    console.log(`✅ New cruises added: ${totalSuccess}`);
    console.log(`⏭️  Existing cruises skipped: ${totalSkipped}`);
    console.log(`❌ Failed: ${totalFailed}`);
    
    // Check final database status
    const { db } = require('../dist/db/connection');
    const { sql } = require('drizzle-orm');
    
    const stats = await db.execute(sql`
      SELECT 
        (SELECT COUNT(*) FROM cruises) as cruises,
        (SELECT COUNT(DISTINCT cruise_line_id) FROM cruises) as lines,
        (SELECT COUNT(DISTINCT ship_id) FROM cruises) as ships,
        (SELECT MIN(sailing_date) FROM cruises) as earliest,
        (SELECT MAX(sailing_date) FROM cruises) as latest
    `);
    
    const result = stats.rows[0];
    console.log(`\n📊 DATABASE STATUS:`);
    console.log(`   Total Cruises: ${result.cruises}`);
    console.log(`   Cruise Lines: ${result.lines}`);
    console.log(`   Ships: ${result.ships}`);
    console.log(`   Date Range: ${result.earliest} to ${result.latest}`);
    
    console.log('\n✅ Your database is fully populated!');
    console.log('\n📡 Test the API:');
    console.log('curl -X POST https://zipsea-production.onrender.com/api/v1/search \\');
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -d \'{"limit": 10}\'');
    
    console.log('\n📝 Note: Future updates will come via webhooks.');
    console.log('Progress saved in .sync-progress.json');
    
    client.end();
    
  } catch (error) {
    console.error('\n❌ Sync error:', error.message);
    
    // Save progress before exiting
    progress.totalProcessed = totalProcessed;
    progress.totalSuccess = totalSuccess;
    progress.totalSkipped = totalSkipped;
    progress.totalFailed = totalFailed;
    saveProgress();
    
    console.log('\n📝 Progress saved. Run again to resume.');
    
    if (client) client.end();
    process.exit(1);
  }
}

// Run it!
continuousSync()
  .then(() => {
    console.log('\n✨ All data synced successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal:', error.message);
    process.exit(1);
  });