#!/usr/bin/env node

/**
 * Sync ALL available data from FTP
 * Scans all years, months, cruise lines, and ships
 */

require('dotenv').config();
const FTP = require('ftp');

console.log('📊 FULL FTP Sync - Get ALL Available Data');
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

if (!ftpConfig.user || !ftpConfig.password) {
  console.error('❌ FTP credentials not found');
  process.exit(1);
}

// Helper to download file
async function downloadFile(client, filePath) {
  return new Promise((resolve, reject) => {
    client.get(filePath, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }
      
      let data = '';
      stream.on('data', (chunk) => {
        data += chunk.toString();
      });
      
      stream.on('end', () => {
        resolve(data);
      });
      
      stream.on('error', (error) => {
        reject(error);
      });
    });
  });
}

// Helper to list directory
async function listDirectory(client, dirPath) {
  return new Promise((resolve, reject) => {
    client.list(dirPath, (err, list) => {
      if (err) {
        reject(err);
      } else {
        resolve(list || []);
      }
    });
  });
}

// Simple sync function
async function syncCruise(cruiseData) {
  const { db } = require('../dist/db/connection');
  const { sql } = require('drizzle-orm');
  
  try {
    // Parse IDs
    const cruiseId = Number(cruiseData.cruiseid);
    const lineId = Number(cruiseData.lineid) || 1;
    const shipId = Number(cruiseData.shipid);
    const startPortId = cruiseData.startportid ? Number(cruiseData.startportid) : null;
    const endPortId = cruiseData.endportid ? Number(cruiseData.endportid) : null;
    
    // Create cruise line
    await db.execute(sql`
      INSERT INTO cruise_lines (id, name, code, is_active)
      VALUES (${lineId}, ${cruiseData.linename || 'Cruise Line ' + lineId}, ${'CL' + lineId}, true)
      ON CONFLICT (id) DO NOTHING
    `);
    
    // Create ship
    const shipName = cruiseData.shipcontent?.name || cruiseData.shipname || 'Ship ' + shipId;
    await db.execute(sql`
      INSERT INTO ships (id, cruise_line_id, name, code, is_active)
      VALUES (${shipId}, ${lineId}, ${shipName}, ${'SH' + shipId}, true)
      ON CONFLICT (id) DO NOTHING
    `);
    
    // Create ports
    if (startPortId) {
      await db.execute(sql`
        INSERT INTO ports (id, name, code, is_active)
        VALUES (${startPortId}, ${'Port ' + startPortId}, ${'P' + startPortId}, true)
        ON CONFLICT (id) DO NOTHING
      `);
    }
    
    if (endPortId && endPortId !== startPortId) {
      await db.execute(sql`
        INSERT INTO ports (id, name, code, is_active)
        VALUES (${endPortId}, ${'Port ' + endPortId}, ${'P' + endPortId}, true)
        ON CONFLICT (id) DO NOTHING
      `);
    }
    
    // Parse arrays
    const portIdsStr = cruiseData.portids || '';
    const portIdsArray = portIdsStr ? portIdsStr.split(',').map(p => Number(p.trim())).filter(p => !isNaN(p)) : [];
    
    for (const portId of portIdsArray) {
      if (portId) {
        await db.execute(sql`
          INSERT INTO ports (id, name, code, is_active)
          VALUES (${portId}, ${'Port ' + portId}, ${'P' + portId}, true)
          ON CONFLICT (id) DO NOTHING
        `);
      }
    }
    
    const regionIdsStr = cruiseData.regionids || '';
    const regionIdsArray = regionIdsStr ? regionIdsStr.split(',').map(r => Number(r.trim())).filter(r => !isNaN(r)) : [];
    
    for (const regionId of regionIdsArray) {
      if (regionId) {
        await db.execute(sql`
          INSERT INTO regions (id, name, code, is_active)
          VALUES (${regionId}, ${'Region ' + regionId}, ${'R' + regionId}, true)
          ON CONFLICT (id) DO NOTHING
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
        ${lineId},
        ${shipId},
        ${cruiseData.name || 'Cruise ' + cruiseId},
        ${sailDate},
        ${returnDate.toISOString().split('T')[0]},
        ${cruiseData.nights || 0},
        ${startPortId},
        ${endPortId},
        ${JSON.stringify(regionIdsArray)},
        ${JSON.stringify(portIdsArray)},
        true,
        true
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        sailing_date = EXCLUDED.sailing_date,
        return_date = EXCLUDED.return_date,
        updated_at = NOW()
    `);
    
    // Try simple pricing
    try {
      let cheapestPrice = null;
      let interiorPrice = null;
      let oceanviewPrice = null;
      let balconyPrice = null;
      let suitePrice = null;
      
      if (cruiseData.cheapest) {
        cheapestPrice = typeof cruiseData.cheapest === 'number' ? 
          cruiseData.cheapest : cruiseData.cheapest.price ? Number(cruiseData.cheapest.price) : null;
      }
      
      if (cruiseData.cheapestinside) {
        interiorPrice = typeof cruiseData.cheapestinside === 'number' ? 
          cruiseData.cheapestinside : cruiseData.cheapestinside.price ? Number(cruiseData.cheapestinside.price) : null;
      }
      
      if (cruiseData.cheapestoutside) {
        oceanviewPrice = typeof cruiseData.cheapestoutside === 'number' ? 
          cruiseData.cheapestoutside : cruiseData.cheapestoutside.price ? Number(cruiseData.cheapestoutside.price) : null;
      }
      
      if (cruiseData.cheapestbalcony) {
        balconyPrice = typeof cruiseData.cheapestbalcony === 'number' ? 
          cruiseData.cheapestbalcony : cruiseData.cheapestbalcony.price ? Number(cruiseData.cheapestbalcony.price) : null;
      }
      
      if (cruiseData.cheapestsuite) {
        suitePrice = typeof cruiseData.cheapestsuite === 'number' ? 
          cruiseData.cheapestsuite : cruiseData.cheapestsuite.price ? Number(cruiseData.cheapestsuite.price) : null;
      }
      
      if (cheapestPrice || interiorPrice || oceanviewPrice || balconyPrice || suitePrice) {
        await db.execute(sql`
          INSERT INTO cheapest_pricing (
            cruise_id, cheapest_price, interior_price,
            oceanview_price, balcony_price, suite_price,
            currency, last_updated
          ) VALUES (
            ${cruiseId}, ${cheapestPrice}, ${interiorPrice},
            ${oceanviewPrice}, ${balconyPrice}, ${suitePrice},
            ${'USD'}, NOW()
          )
          ON CONFLICT (cruise_id) DO UPDATE SET
            cheapest_price = EXCLUDED.cheapest_price,
            interior_price = EXCLUDED.interior_price,
            oceanview_price = EXCLUDED.oceanview_price,
            balcony_price = EXCLUDED.balcony_price,
            suite_price = EXCLUDED.suite_price,
            last_updated = NOW()
        `);
      }
    } catch (priceError) {
      // Skip pricing errors silently
    }
    
    return true;
  } catch (error) {
    throw error;
  }
}

// Discover and sync ALL files
async function discoverAllFiles(client) {
  console.log('🔍 Discovering all available cruise files...\n');
  
  const allFiles = [];
  
  try {
    // Get all years
    const years = await listDirectory(client, '/');
    const yearDirs = years
      .filter(item => item.type === 'd' && /^\d{4}$/.test(item.name))
      .map(item => item.name)
      .sort();
    
    console.log(`📅 Found ${yearDirs.length} years: ${yearDirs.join(', ')}\n`);
    
    // Focus on current and next year for initial sync
    const currentYear = new Date().getFullYear();
    const relevantYears = yearDirs.filter(year => {
      const y = Number(year);
      return y >= currentYear && y <= currentYear + 1;
    });
    
    console.log(`📌 Focusing on years: ${relevantYears.join(', ')}\n`);
    
    for (const year of relevantYears) {
      console.log(`\n📅 Processing year ${year}...`);
      
      const months = await listDirectory(client, year);
      const monthDirs = months
        .filter(item => item.type === 'd' && /^\d{2}$/.test(item.name))
        .map(item => item.name)
        .sort();
      
      console.log(`   Found ${monthDirs.length} months`);
      
      // Process each month
      for (const month of monthDirs) {
        const monthPath = `${year}/${month}`;
        console.log(`   📆 Month ${month}:`);
        
        const cruiseLines = await listDirectory(client, monthPath);
        const lineDirs = cruiseLines
          .filter(item => item.type === 'd')
          .map(item => item.name);
        
        console.log(`      ${lineDirs.length} cruise lines`);
        
        let monthFileCount = 0;
        
        // Process each cruise line
        for (const lineId of lineDirs) {
          const linePath = `${monthPath}/${lineId}`;
          
          try {
            const ships = await listDirectory(client, linePath);
            const shipDirs = ships
              .filter(item => item.type === 'd')
              .map(item => item.name);
            
            // Process each ship
            for (const shipId of shipDirs) {
              const shipPath = `${linePath}/${shipId}`;
              
              try {
                const files = await listDirectory(client, shipPath);
                const jsonFiles = files
                  .filter(item => item.type === '-' && item.name.endsWith('.json'))
                  .map(item => item.name);
                
                // Add all JSON files
                for (const fileName of jsonFiles) {
                  allFiles.push({
                    path: `${shipPath}/${fileName}`,
                    year,
                    month,
                    lineId,
                    shipId,
                    fileName,
                    codetocruiseid: fileName.replace('.json', '')
                  });
                  monthFileCount++;
                }
              } catch (shipError) {
                // Skip inaccessible ships
              }
            }
          } catch (lineError) {
            // Skip inaccessible cruise lines
          }
        }
        
        console.log(`      Total files: ${monthFileCount}`);
      }
    }
    
    console.log(`\n📊 Total cruise files discovered: ${allFiles.length}\n`);
    
  } catch (error) {
    console.error('Discovery error:', error.message);
  }
  
  return allFiles;
}

async function syncAllData() {
  const client = new FTP();
  
  return new Promise((resolve, reject) => {
    client.on('ready', async () => {
      console.log('✅ Connected to FTP\n');
      
      try {
        // Discover all files
        const allFiles = await discoverAllFiles(client);
        
        if (allFiles.length === 0) {
          console.log('❌ No files found');
          client.end();
          return resolve();
        }
        
        // Limit for initial sync (can be increased)
        const SYNC_LIMIT = 100; // Start with first 100 files
        const filesToSync = allFiles.slice(0, SYNC_LIMIT);
        
        console.log(`\n📥 Syncing first ${filesToSync.length} files...\n`);
        
        let successful = 0;
        let failed = 0;
        let progress = 0;
        
        for (const fileInfo of filesToSync) {
          progress++;
          
          // Show progress every 10 files
          if (progress % 10 === 0) {
            console.log(`\n📊 Progress: ${progress}/${filesToSync.length} (${successful} successful, ${failed} failed)\n`);
          }
          
          try {
            const jsonContent = await downloadFile(client, fileInfo.path);
            const cruiseData = JSON.parse(jsonContent);
            
            if (!cruiseData.codetocruiseid) {
              cruiseData.codetocruiseid = fileInfo.codetocruiseid;
            }
            
            await syncCruise(cruiseData);
            successful++;
            
            // Show details for first few
            if (successful <= 5) {
              console.log(`✅ ${fileInfo.path}`);
              console.log(`   ${cruiseData.name} (${cruiseData.nights} nights)`);
            }
            
          } catch (error) {
            failed++;
            if (failed <= 5) {
              console.error(`❌ ${fileInfo.path}: ${error.message}`);
            }
          }
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('📊 FINAL SYNC SUMMARY');
        console.log('='.repeat(60));
        console.log(`✅ Successful: ${successful}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`📁 Total processed: ${filesToSync.length}`);
        console.log(`📂 Total available: ${allFiles.length}`);
        
        // Verify database
        const { db } = require('../dist/db/connection');
        const { sql } = require('drizzle-orm');
        
        try {
          const stats = await db.execute(sql`
            SELECT 
              (SELECT COUNT(*) FROM cruises) as cruises,
              (SELECT COUNT(*) FROM cruise_lines) as lines,
              (SELECT COUNT(*) FROM ships) as ships,
              (SELECT COUNT(*) FROM ports) as ports,
              (SELECT COUNT(*) FROM cheapest_pricing) as pricing
          `);
          
          const result = stats.rows[0];
          console.log(`\n📊 DATABASE STATUS:`);
          console.log(`   Cruises: ${result.cruises}`);
          console.log(`   Cruise Lines: ${result.lines}`);
          console.log(`   Ships: ${result.ships}`);
          console.log(`   Ports: ${result.ports}`);
          console.log(`   Pricing Records: ${result.pricing}`);
          
          if (result.cruises > 0) {
            console.log('\n🎉 SUCCESS! Your database is populated!');
            console.log('\n📡 Test your API:');
            console.log('curl -X POST https://zipsea-production.onrender.com/api/v1/search \\');
            console.log('  -H "Content-Type: application/json" \\');
            console.log('  -d \'{"limit": 10}\'');
            
            if (allFiles.length > filesToSync.length) {
              console.log(`\n📝 Note: ${allFiles.length - filesToSync.length} more files available.`);
              console.log('To sync more data, increase SYNC_LIMIT in the script.');
            }
          }
        } catch (dbError) {
          console.log('Could not verify database:', dbError.message);
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

// Run it!
syncAllData()
  .then(() => {
    console.log('\n✨ Sync completed!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal:', error.message);
    process.exit(1);
  });