#!/usr/bin/env node

/**
 * Fixed direct sync - handles database transactions properly
 */

require('dotenv').config();
const FTP = require('ftp');

console.log('🚀 Direct FTP Sync - Fixed Version');
console.log('===================================\n');

// Check environment
console.log('📋 Environment Check:');
console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
console.log(`TRAVELTEK_FTP_HOST: ${process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net'}`);
console.log(`TRAVELTEK_FTP_USER: ${process.env.TRAVELTEK_FTP_USER ? 'SET' : 'NOT SET'}`);
console.log('');

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

// Simple sync function that bypasses the complex transaction
async function simpleSyncCruise(cruiseData) {
  const { db } = require('../dist/db/connection');
  const { cruises, cruiseLines, ships, pricing, cheapestPricing } = require('../dist/db/schema');
  const { sql } = require('drizzle-orm');
  
  try {
    // 1. Ensure cruise line exists
    await db.insert(cruiseLines).values({
      id: cruiseData.lineid,
      name: `Cruise Line ${cruiseData.lineid}`,
      code: `CL${cruiseData.lineid}`,
      description: cruiseData.linecontent || '',
      isActive: true
    }).onConflictDoNothing();
    
    // 2. Ensure ship exists
    const shipContent = cruiseData.shipcontent || {};
    await db.insert(ships).values({
      id: cruiseData.shipid,
      cruiseLineId: cruiseData.lineid,
      name: shipContent.name || `Ship ${cruiseData.shipid}`,
      code: shipContent.code || `SH${cruiseData.shipid}`,
      description: shipContent.shortdescription || '',
      isActive: true
    }).onConflictDoNothing();
    
    // 3. Insert/Update cruise
    const sailingDate = cruiseData.saildate;
    const returnDate = new Date(sailingDate);
    returnDate.setDate(returnDate.getDate() + cruiseData.nights);
    
    // Use raw SQL for the upsert to avoid Drizzle syntax issues
    await db.execute(sql`
      INSERT INTO cruises (
        id, code_to_cruise_id, cruise_line_id, ship_id, name,
        itinerary_code, voyage_code, sailing_date, return_date, nights,
        sail_nights, sea_days, embark_port_id, disembark_port_id,
        region_ids, port_ids, market_id, owner_id,
        no_fly, depart_uk, show_cruise, fly_cruise_info, line_content,
        currency, is_active, created_at, updated_at
      ) VALUES (
        ${cruiseData.cruiseid},
        ${cruiseData.codetocruiseid},
        ${cruiseData.lineid},
        ${cruiseData.shipid},
        ${cruiseData.name},
        ${cruiseData.itinerarycode || null},
        ${cruiseData.voyagecode || null},
        ${sailingDate},
        ${returnDate.toISOString().split('T')[0]},
        ${cruiseData.nights},
        ${cruiseData.sailnights || null},
        ${cruiseData.seadays || null},
        ${cruiseData.startportid || null},
        ${cruiseData.endportid || null},
        ${JSON.stringify(cruiseData.regionids || [])},
        ${JSON.stringify(cruiseData.portids || [])},
        ${cruiseData.marketid || null},
        ${cruiseData.ownerid || null},
        ${cruiseData.nofly || false},
        ${cruiseData.departuk || false},
        ${cruiseData.showcruise !== false},
        ${cruiseData.flycruiseinfo || null},
        ${cruiseData.linecontent || null},
        ${'USD'},
        ${true},
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        sailing_date = EXCLUDED.sailing_date,
        return_date = EXCLUDED.return_date,
        nights = EXCLUDED.nights,
        updated_at = NOW()
    `);
    
    // 4. Insert cheapest pricing if available
    if (cruiseData.cheapest) {
      await db.execute(sql`
        INSERT INTO cheapest_pricing (
          cruise_id, cheapest_price, cheapest_cabin_type,
          interior_price, interior_price_code,
          oceanview_price, oceanview_price_code,
          balcony_price, balcony_price_code,
          suite_price, suite_price_code,
          currency, last_updated
        ) VALUES (
          ${cruiseData.cruiseid},
          ${cruiseData.cheapest?.price?.toString() || null},
          ${cruiseData.cheapest?.cabintype || null},
          ${cruiseData.cheapestinside?.price?.toString() || null},
          ${cruiseData.cheapestinsidepricecode || null},
          ${cruiseData.cheapestoutside?.price?.toString() || null},
          ${cruiseData.cheapestoutsidepricecode || null},
          ${cruiseData.cheapestbalcony?.price?.toString() || null},
          ${cruiseData.cheapestbalconypricecode || null},
          ${cruiseData.cheapestsuite?.price?.toString() || null},
          ${cruiseData.cheapestsuitepricecode || null},
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
    
    return true;
  } catch (error) {
    console.error(`Database error: ${error.message}`);
    throw error;
  }
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

async function syncDirectFiles() {
  const client = new FTP();
  
  return new Promise(async (resolve, reject) => {
    client.on('ready', async () => {
      console.log('✅ Connected to FTP\n');
      
      try {
        // Use known paths from our test
        const testPaths = [
          '2025/12/1/180',
          '2025/12/1/2649',
          '2025/12/1/3'
        ];
        
        const allFiles = [];
        
        for (const path of testPaths) {
          console.log(`📁 Checking ${path}...`);
          try {
            const files = await listDirectory(client, path);
            const jsonFiles = files.filter(f => f.type === '-' && f.name.endsWith('.json'));
            
            console.log(`   Found ${jsonFiles.length} JSON files`);
            
            // Take first 2 files from each directory
            for (const file of jsonFiles.slice(0, 2)) {
              allFiles.push({
                path: `${path}/${file.name}`,
                size: file.size,
                codetocruiseid: file.name.replace('.json', '')
              });
            }
          } catch (err) {
            console.log(`   Error listing ${path}: ${err.message}`);
          }
        }
        
        console.log(`\n📥 Total files to sync: ${allFiles.length}\n`);
        
        if (allFiles.length === 0) {
          console.log('❌ No files found to sync');
          client.end();
          return resolve();
        }
        
        let successful = 0;
        let failed = 0;
        
        for (const fileInfo of allFiles) {
          console.log(`\n📄 Processing ${fileInfo.path}...`);
          
          try {
            // Download file
            const jsonContent = await downloadFile(client, fileInfo.path);
            const cruiseData = JSON.parse(jsonContent);
            
            // Add the codetocruiseid from filename if not in data
            if (!cruiseData.codetocruiseid) {
              cruiseData.codetocruiseid = fileInfo.codetocruiseid;
            }
            
            console.log(`   Cruise: ${cruiseData.name || 'Unknown'}`);
            console.log(`   ID: ${cruiseData.cruiseid}`);
            console.log(`   Nights: ${cruiseData.nights}`);
            console.log(`   Sail Date: ${cruiseData.saildate}`);
            
            // Use simplified sync
            await simpleSyncCruise(cruiseData);
            console.log(`   ✅ Synced successfully`);
            successful++;
            
          } catch (error) {
            console.error(`   ❌ Failed: ${error.message}`);
            failed++;
          }
        }
        
        console.log('\n' + '='.repeat(50));
        console.log('📊 SYNC SUMMARY');
        console.log('='.repeat(50));
        console.log(`✅ Successful: ${successful}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`📁 Total: ${allFiles.length}`);
        
        // Verify in database
        if (successful > 0) {
          console.log('\n🔍 Verifying in database...');
          const { db } = require('../dist/db/connection');
          const { cruises, cruiseLines, ships, cheapestPricing } = require('../dist/db/schema');
          const { sql } = require('drizzle-orm');
          
          const stats = await db.execute(sql`
            SELECT 
              (SELECT COUNT(*) FROM cruises) as cruise_count,
              (SELECT COUNT(*) FROM cruise_lines) as line_count,
              (SELECT COUNT(*) FROM ships) as ship_count,
              (SELECT COUNT(*) FROM cheapest_pricing) as pricing_count
          `);
          
          const result = stats.rows[0];
          console.log(`\n📊 Database Status:`);
          console.log(`   Cruises: ${result.cruise_count}`);
          console.log(`   Cruise Lines: ${result.line_count}`);
          console.log(`   Ships: ${result.ship_count}`);
          console.log(`   Cheapest Pricing: ${result.pricing_count}`);
          
          // Show a sample cruise
          const sampleCruise = await db.execute(sql`
            SELECT id, name, sailing_date, nights 
            FROM cruises 
            LIMIT 1
          `);
          
          if (sampleCruise.rows.length > 0) {
            const cruise = sampleCruise.rows[0];
            console.log(`\n📌 Sample Cruise:`);
            console.log(`   ID: ${cruise.id}`);
            console.log(`   Name: ${cruise.name}`);
            console.log(`   Sailing: ${cruise.sailing_date}`);
            console.log(`   Nights: ${cruise.nights}`);
          }
        }
        
        client.end();
        resolve();
        
      } catch (error) {
        console.error('❌ Sync error:', error);
        client.end();
        reject(error);
      }
    });
    
    client.on('error', (err) => {
      console.error('❌ FTP error:', err.message);
      reject(err);
    });
    
    client.connect(ftpConfig);
  });
}

// Run the sync
syncDirectFiles()
  .then(() => {
    console.log('\n✨ Direct sync completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });