#!/usr/bin/env node

/**
 * SIMPLE sync script - minimal approach, just get data in!
 */

require('dotenv').config();
const FTP = require('ftp');

console.log('🎯 SIMPLE FTP Sync - Just Get It Working!');
console.log('=========================================\n');

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

// Simple sync - skip pricing for now, just get cruises in
async function simpleSyncCruise(cruiseData) {
  const { db } = require('../dist/db/connection');
  const { sql } = require('drizzle-orm');
  
  try {
    // Parse IDs - handle strings and numbers
    const cruiseId = Number(cruiseData.cruiseid);
    const lineId = Number(cruiseData.lineid) || 1;
    const shipId = Number(cruiseData.shipid);
    const startPortId = cruiseData.startportid ? Number(cruiseData.startportid) : null;
    const endPortId = cruiseData.endportid ? Number(cruiseData.endportid) : null;
    
    // 1. Create cruise line if needed
    await db.execute(sql`
      INSERT INTO cruise_lines (id, name, code, is_active)
      VALUES (${lineId}, ${'Cruise Line ' + lineId}, ${'CL' + lineId}, true)
      ON CONFLICT (id) DO NOTHING
    `);
    
    // 2. Create ship if needed
    await db.execute(sql`
      INSERT INTO ships (id, cruise_line_id, name, code, is_active)
      VALUES (${shipId}, ${lineId}, ${'Ship ' + shipId}, ${'SH' + shipId}, true)
      ON CONFLICT (id) DO NOTHING
    `);
    
    // 3. Create ports if needed
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
    
    // Parse port IDs array
    const portIdsStr = cruiseData.portids || '';
    const portIdsArray = portIdsStr ? portIdsStr.split(',').map(p => Number(p.trim())).filter(p => !isNaN(p)) : [];
    
    // Create all ports referenced
    for (const portId of portIdsArray) {
      if (portId) {
        await db.execute(sql`
          INSERT INTO ports (id, name, code, is_active)
          VALUES (${portId}, ${'Port ' + portId}, ${'P' + portId}, true)
          ON CONFLICT (id) DO NOTHING
        `);
      }
    }
    
    // Parse region IDs
    const regionIdsStr = cruiseData.regionids || '';
    const regionIdsArray = regionIdsStr ? regionIdsStr.split(',').map(r => Number(r.trim())).filter(r => !isNaN(r)) : [];
    
    // Create regions
    for (const regionId of regionIdsArray) {
      if (regionId) {
        await db.execute(sql`
          INSERT INTO regions (id, name, code, is_active)
          VALUES (${regionId}, ${'Region ' + regionId}, ${'R' + regionId}, true)
          ON CONFLICT (id) DO NOTHING
        `);
      }
    }
    
    // 4. Insert cruise - SIMPLIFIED, no pricing
    const sailDate = cruiseData.saildate || cruiseData.startdate;
    const returnDate = new Date(sailDate);
    returnDate.setDate(returnDate.getDate() + (cruiseData.nights || 0));
    
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
        region_ids, 
        port_ids,
        show_cruise, 
        is_active
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
    
    // 5. Try to add simple cheapest pricing (skip complex objects)
    try {
      // Extract simple price values
      let cheapestPrice = null;
      let interiorPrice = null;
      let oceanviewPrice = null;
      let balconyPrice = null;
      let suitePrice = null;
      
      // Handle different price formats
      if (cruiseData.cheapest) {
        if (typeof cruiseData.cheapest === 'number') {
          cheapestPrice = cruiseData.cheapest;
        } else if (cruiseData.cheapest.price) {
          cheapestPrice = Number(cruiseData.cheapest.price);
        }
      }
      
      if (cruiseData.cheapestinside) {
        if (typeof cruiseData.cheapestinside === 'number') {
          interiorPrice = cruiseData.cheapestinside;
        } else if (cruiseData.cheapestinside.price) {
          interiorPrice = Number(cruiseData.cheapestinside.price);
        }
      }
      
      if (cruiseData.cheapestoutside) {
        if (typeof cruiseData.cheapestoutside === 'number') {
          oceanviewPrice = cruiseData.cheapestoutside;
        } else if (cruiseData.cheapestoutside.price) {
          oceanviewPrice = Number(cruiseData.cheapestoutside.price);
        }
      }
      
      if (cruiseData.cheapestbalcony) {
        if (typeof cruiseData.cheapestbalcony === 'number') {
          balconyPrice = cruiseData.cheapestbalcony;
        } else if (cruiseData.cheapestbalcony.price) {
          balconyPrice = Number(cruiseData.cheapestbalcony.price);
        }
      }
      
      if (cruiseData.cheapestsuite) {
        if (typeof cruiseData.cheapestsuite === 'number') {
          suitePrice = cruiseData.cheapestsuite;
        } else if (cruiseData.cheapestsuite.price) {
          suitePrice = Number(cruiseData.cheapestsuite.price);
        }
      }
      
      // Only insert if we have at least one price
      if (cheapestPrice || interiorPrice || oceanviewPrice || balconyPrice || suitePrice) {
        await db.execute(sql`
          INSERT INTO cheapest_pricing (
            cruise_id,
            cheapest_price,
            interior_price,
            oceanview_price,
            balcony_price,
            suite_price,
            currency,
            last_updated
          ) VALUES (
            ${cruiseId},
            ${cheapestPrice},
            ${interiorPrice},
            ${oceanviewPrice},
            ${balconyPrice},
            ${suitePrice},
            ${'USD'},
            NOW()
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
      console.log(`   Note: Pricing insert skipped (${priceError.message})`);
    }
    
    return true;
  } catch (error) {
    throw error;
  }
}

async function syncFiles() {
  const client = new FTP();
  
  return new Promise((resolve, reject) => {
    client.on('ready', async () => {
      console.log('✅ Connected to FTP\n');
      
      try {
        const testPaths = [
          '2025/12/1/180',
          '2025/12/1/2649',
          '2025/12/1/3'
        ];
        
        const allFiles = [];
        
        for (const path of testPaths) {
          console.log(`📁 Checking ${path}...`);
          const files = await listDirectory(client, path);
          const jsonFiles = files.filter(f => f.type === '-' && f.name.endsWith('.json'));
          console.log(`   Found ${jsonFiles.length} JSON files`);
          
          for (const file of jsonFiles.slice(0, 2)) {
            allFiles.push({
              path: `${path}/${file.name}`,
              codetocruiseid: file.name.replace('.json', '')
            });
          }
        }
        
        console.log(`\n📥 Total files to sync: ${allFiles.length}\n`);
        
        let successful = 0;
        let failed = 0;
        
        for (const fileInfo of allFiles) {
          console.log(`\n📄 Processing ${fileInfo.path}...`);
          
          try {
            const jsonContent = await downloadFile(client, fileInfo.path);
            const cruiseData = JSON.parse(jsonContent);
            
            if (!cruiseData.codetocruiseid) {
              cruiseData.codetocruiseid = fileInfo.codetocruiseid;
            }
            
            console.log(`   Cruise: ${cruiseData.name}`);
            console.log(`   ID: ${cruiseData.cruiseid}`);
            
            await simpleSyncCruise(cruiseData);
            console.log(`   ✅ SUCCESS!`);
            successful++;
            
          } catch (error) {
            console.error(`   ❌ Failed: ${error.message}`);
            failed++;
          }
        }
        
        console.log('\n' + '='.repeat(50));
        console.log(`✅ Successful: ${successful}`);
        console.log(`❌ Failed: ${failed}`);
        
        // Check what we got
        const { db } = require('../dist/db/connection');
        const { sql } = require('drizzle-orm');
        
        try {
          const result = await db.execute(sql`
            SELECT COUNT(*) as count FROM cruises
          `);
          console.log(`\n📊 Total cruises in database: ${result.rows[0].count}`);
          
          if (result.rows[0].count > 0) {
            const sample = await db.execute(sql`
              SELECT id, name, sailing_date 
              FROM cruises 
              LIMIT 1
            `);
            
            if (sample.rows.length > 0) {
              console.log('\n🎉 SUCCESS! Sample cruise:');
              console.log(`   ${sample.rows[0].name}`);
              console.log(`   Sailing: ${sample.rows[0].sailing_date}`);
              
              console.log('\n✅ Your database is populated!');
              console.log('Test the API:');
              console.log('curl https://zipsea-production.onrender.com/api/v1/search');
            }
          }
        } catch (dbError) {
          console.log('Could not verify database:', dbError.message);
        }
        
        client.end();
        resolve();
        
      } catch (error) {
        console.error('Error:', error.message);
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
syncFiles()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal:', error.message);
    process.exit(1);
  });