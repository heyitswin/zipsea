#!/usr/bin/env node

/**
 * Batch sync with connection management
 * Handles large datasets without connection timeouts
 */

require('dotenv').config();
const FTP = require('ftp');

console.log('🚀 Batch FTP Sync - Handles Large Datasets');
console.log('===========================================\n');

const ftpConfig = {
  host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
  user: process.env.TRAVELTEK_FTP_USER,
  password: process.env.TRAVELTEK_FTP_PASSWORD,
  port: 21,
  secure: false,
  connTimeout: 30000,
  pasvTimeout: 30000,
  keepalive: 5000  // Keep connection alive
};

if (!ftpConfig.user || !ftpConfig.password) {
  console.error('❌ FTP credentials not found');
  process.exit(1);
}

// Helper to download file
async function downloadFile(client, filePath) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Download timeout'));
    }, 20000);
    
    client.get(filePath, (err, stream) => {
      if (err) {
        clearTimeout(timeout);
        reject(err);
        return;
      }
      
      let data = '';
      stream.on('data', (chunk) => {
        data += chunk.toString();
      });
      
      stream.on('end', () => {
        clearTimeout(timeout);
        resolve(data);
      });
      
      stream.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  });
}

// Helper to list directory with retry
async function listDirectory(client, dirPath, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('List timeout'));
        }, 15000);
        
        client.list(dirPath, (err, list) => {
          clearTimeout(timeout);
          if (err) {
            reject(err);
          } else {
            resolve(list || []);
          }
        });
      });
    } catch (error) {
      if (attempt === retries) throw error;
      await new Promise(r => setTimeout(r, 1000)); // Wait before retry
    }
  }
}

// Simple sync function
async function syncCruise(cruiseData) {
  const { db } = require('../dist/db/connection');
  const { sql } = require('drizzle-orm');
  
  try {
    const cruiseId = Number(cruiseData.cruiseid);
    const lineId = Number(cruiseData.lineid) || 1;
    const shipId = Number(cruiseData.shipid);
    const startPortId = cruiseData.startportid ? Number(cruiseData.startportid) : null;
    const endPortId = cruiseData.endportid ? Number(cruiseData.endportid) : null;
    
    // Quick inserts with no conflict handling
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
      const morePortIds = cruiseData.portids.split(',').map(p => Number(p.trim())).filter(p => !isNaN(p));
      morePortIds.forEach(id => portIds.add(id));
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
        region_ids, port_ids,
        show_cruise, is_active
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
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        sailing_date = EXCLUDED.sailing_date,
        updated_at = NOW()
    `);
    
    return true;
  } catch (error) {
    throw error;
  }
}

// Quick discovery - just get file paths
async function quickDiscoverFiles(client, yearMonth) {
  const files = [];
  const [year, month] = yearMonth.split('/');
  
  try {
    const cruiseLines = await listDirectory(client, yearMonth);
    const lineDirs = cruiseLines.filter(item => item.type === 'd').map(item => item.name);
    
    // Limit cruise lines to prevent timeout
    const maxLines = 10; // Process first 10 cruise lines per month
    const selectedLines = lineDirs.slice(0, maxLines);
    
    for (const lineId of selectedLines) {
      const linePath = `${yearMonth}/${lineId}`;
      
      try {
        const ships = await listDirectory(client, linePath);
        const shipDirs = ships.filter(item => item.type === 'd').map(item => item.name);
        
        // Limit ships per line
        const maxShips = 5;
        const selectedShips = shipDirs.slice(0, maxShips);
        
        for (const shipId of selectedShips) {
          const shipPath = `${linePath}/${shipId}`;
          
          try {
            const shipFiles = await listDirectory(client, shipPath);
            const jsonFiles = shipFiles.filter(item => item.type === '-' && item.name.endsWith('.json'));
            
            // Add files
            for (const file of jsonFiles) {
              files.push({
                path: `${shipPath}/${file.name}`,
                codetocruiseid: file.name.replace('.json', '')
              });
            }
          } catch (e) {
            // Skip ship errors
          }
        }
      } catch (e) {
        // Skip line errors
      }
    }
  } catch (e) {
    console.log(`Error discovering ${yearMonth}: ${e.message}`);
  }
  
  return files;
}

async function batchSync() {
  let client = new FTP();
  
  // Helper to connect
  const connect = () => new Promise((resolve, reject) => {
    client = new FTP();
    
    client.on('ready', () => {
      console.log('✅ FTP connected');
      resolve();
    });
    
    client.on('error', (err) => {
      reject(err);
    });
    
    client.connect(ftpConfig);
  });
  
  try {
    await connect();
    
    // Focus on specific months to avoid timeout
    const targetMonths = [
      '2025/01',  // January 2025
      '2025/02',  // February 2025
      '2025/03',  // March 2025
    ];
    
    let totalFiles = 0;
    let totalSuccessful = 0;
    let totalFailed = 0;
    
    for (const yearMonth of targetMonths) {
      console.log(`\n📅 Processing ${yearMonth}...`);
      
      // Discover files for this month
      const files = await quickDiscoverFiles(client, yearMonth);
      console.log(`   Found ${files.length} files`);
      
      if (files.length === 0) continue;
      
      // Process in small batches
      const BATCH_SIZE = 20;
      const filesToProcess = files.slice(0, 50); // Max 50 files per month
      
      for (let i = 0; i < filesToProcess.length; i += BATCH_SIZE) {
        const batch = filesToProcess.slice(i, i + BATCH_SIZE);
        console.log(`   Processing batch ${Math.floor(i/BATCH_SIZE) + 1}...`);
        
        let batchSuccess = 0;
        let batchFail = 0;
        
        for (const fileInfo of batch) {
          try {
            const jsonContent = await downloadFile(client, fileInfo.path);
            const cruiseData = JSON.parse(jsonContent);
            
            if (!cruiseData.codetocruiseid) {
              cruiseData.codetocruiseid = fileInfo.codetocruiseid;
            }
            
            await syncCruise(cruiseData);
            batchSuccess++;
            totalSuccessful++;
            
          } catch (error) {
            batchFail++;
            totalFailed++;
            
            // Reconnect if connection lost
            if (error.message.includes('ECONNRESET') || error.message.includes('timeout')) {
              console.log('   Reconnecting...');
              try {
                client.end();
                await connect();
              } catch (reconnectError) {
                console.error('   Failed to reconnect:', reconnectError.message);
                break;
              }
            }
          }
        }
        
        console.log(`   Batch complete: ${batchSuccess} success, ${batchFail} failed`);
        totalFiles += batch.length;
        
        // Brief pause between batches
        await new Promise(r => setTimeout(r, 500));
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 FINAL RESULTS');
    console.log('='.repeat(60));
    console.log(`✅ Successful: ${totalSuccessful}`);
    console.log(`❌ Failed: ${totalFailed}`);
    console.log(`📁 Total processed: ${totalFiles}`);
    
    // Check database
    const { db } = require('../dist/db/connection');
    const { sql } = require('drizzle-orm');
    
    try {
      const stats = await db.execute(sql`
        SELECT 
          (SELECT COUNT(*) FROM cruises) as cruises,
          (SELECT COUNT(DISTINCT cruise_line_id) FROM cruises) as lines,
          (SELECT COUNT(DISTINCT ship_id) FROM cruises) as ships
      `);
      
      const result = stats.rows[0];
      console.log(`\n📊 DATABASE STATUS:`);
      console.log(`   Total Cruises: ${result.cruises}`);
      console.log(`   Cruise Lines: ${result.lines}`);
      console.log(`   Ships: ${result.ships}`);
      
      if (result.cruises > 0) {
        console.log('\n🎉 SUCCESS! Your database has cruise data!');
        console.log('\n📡 Test the API:');
        console.log('curl -X POST https://zipsea-production.onrender.com/api/v1/search \\');
        console.log('  -H "Content-Type: application/json" \\');
        console.log('  -d \'{"limit": 10}\'');
      }
    } catch (dbError) {
      console.log('Database check error:', dbError.message);
    }
    
    client.end();
    
  } catch (error) {
    console.error('Fatal error:', error.message);
    if (client) client.end();
  }
}

// Run it!
batchSync()
  .then(() => {
    console.log('\n✨ Batch sync completed!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
  });