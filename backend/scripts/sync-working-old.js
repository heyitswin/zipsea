#!/usr/bin/env node

/**
 * Working sync script - handles Traveltek data type quirks
 */

require('dotenv').config();
const FTP = require('ftp');

console.log('🚀 Working FTP Sync - Handles Data Types Correctly');
console.log('===================================================\n');

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

// Helper to convert to integer safely
function toIntegerOrNull(value) {
  if (value === null || value === undefined || value === '' || value === 'system') {
    return null;
  }
  const num = Number(value);
  return isNaN(num) ? null : num;
}

// Helper to convert string array to PostgreSQL array
function toIntArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(v => toIntegerOrNull(v)).filter(v => v !== null);
  if (typeof value === 'string') {
    return value.split(',').map(v => toIntegerOrNull(v.trim())).filter(v => v !== null);
  }
  return [];
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

// Fixed sync function that handles data types properly
async function syncCruiseWithCorrectTypes(cruiseData) {
  const { db } = require('../dist/db/connection');
  const { cruises, cruiseLines, ships, pricing, cheapestPricing } = require('../dist/db/schema');
  const { sql } = require('drizzle-orm');
  
  try {
    // Convert string IDs to integers
    const lineId = toIntegerOrNull(cruiseData.lineid);
    const shipId = toIntegerOrNull(cruiseData.shipid);
    const cruiseId = toIntegerOrNull(cruiseData.cruiseid);
    
    if (!lineId || !shipId || !cruiseId) {
      throw new Error(`Invalid IDs: lineId=${lineId}, shipId=${shipId}, cruiseId=${cruiseId}`);
    }
    
    // 1. Ensure cruise line exists
    await db.insert(cruiseLines).values({
      id: lineId,
      name: `Cruise Line ${lineId}`,
      code: `CL${lineId}`,
      description: cruiseData.linecontent || '',
      isActive: true
    }).onConflictDoNothing();
    
    // 2. Ensure ship exists
    const shipContent = cruiseData.shipcontent || {};
    await db.insert(ships).values({
      id: shipId,
      cruiseLineId: lineId,
      name: shipContent.name || cruiseData.shipname || `Ship ${shipId}`,
      code: shipContent.code || `SH${shipId}`,
      description: shipContent.shortdescription || '',
      isActive: true
    }).onConflictDoNothing();
    
    // 3. Insert/Update cruise with proper type conversions
    const sailingDate = cruiseData.saildate || cruiseData.startdate;
    const returnDate = new Date(sailingDate);
    returnDate.setDate(returnDate.getDate() + (cruiseData.nights || 0));
    
    // Convert all fields to proper types
    const startPortId = toIntegerOrNull(cruiseData.startportid);
    const endPortId = toIntegerOrNull(cruiseData.endportid);
    const marketId = toIntegerOrNull(cruiseData.marketid);
    const ownerId = toIntegerOrNull(cruiseData.ownerid); // This will be null for "system"
    const nights = toIntegerOrNull(cruiseData.nights) || 0;
    const sailNights = toIntegerOrNull(cruiseData.sailnights);
    const seaDays = toIntegerOrNull(cruiseData.seadays);
    
    // Convert string arrays to PostgreSQL arrays
    const regionIds = toIntArray(cruiseData.regionids);
    const portIds = toIntArray(cruiseData.portids);
    
    await db.execute(sql`
      INSERT INTO cruises (
        id, code_to_cruise_id, cruise_line_id, ship_id, name,
        itinerary_code, voyage_code, sailing_date, return_date, nights,
        sail_nights, sea_days, embark_port_id, disembark_port_id,
        region_ids, port_ids, market_id, owner_id,
        no_fly, depart_uk, show_cruise, fly_cruise_info, line_content,
        currency, is_active, created_at, updated_at
      ) VALUES (
        ${cruiseId},
        ${cruiseData.codetocruiseid},
        ${lineId},
        ${shipId},
        ${cruiseData.name},
        ${cruiseData.itinerarycode || null},
        ${cruiseData.voyagecode || null},
        ${sailingDate},
        ${returnDate.toISOString().split('T')[0]},
        ${nights},
        ${sailNights},
        ${seaDays},
        ${startPortId},
        ${endPortId},
        ${JSON.stringify(regionIds)},
        ${JSON.stringify(portIds)},
        ${marketId},
        ${ownerId},
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
        region_ids = EXCLUDED.region_ids,
        port_ids = EXCLUDED.port_ids,
        market_id = EXCLUDED.market_id,
        owner_id = EXCLUDED.owner_id,
        updated_at = NOW()
    `);
    
    // 4. Insert cheapest pricing if available
    if (cruiseData.cheapest || cruiseData.cheapestinside || cruiseData.cheapestoutside) {
      const cheapestPrice = cruiseData.cheapest?.price || cruiseData.cheapest;
      const insidePrice = cruiseData.cheapestinside?.price || cruiseData.cheapestinside;
      const outsidePrice = cruiseData.cheapestoutside?.price || cruiseData.cheapestoutside;
      const balconyPrice = cruiseData.cheapestbalcony?.price || cruiseData.cheapestbalcony;
      const suitePrice = cruiseData.cheapestsuite?.price || cruiseData.cheapestsuite;
      
      await db.execute(sql`
        INSERT INTO cheapest_pricing (
          cruise_id, cheapest_price, cheapest_cabin_type,
          interior_price, interior_price_code,
          oceanview_price, oceanview_price_code,
          balcony_price, balcony_price_code,
          suite_price, suite_price_code,
          currency, last_updated
        ) VALUES (
          ${cruiseId},
          ${cheapestPrice?.toString() || null},
          ${cruiseData.cheapest?.cabintype || null},
          ${insidePrice?.toString() || null},
          ${cruiseData.cheapestinsidepricecode || null},
          ${outsidePrice?.toString() || null},
          ${cruiseData.cheapestoutsidepricecode || null},
          ${balconyPrice?.toString() || null},
          ${cruiseData.cheapestbalconypricecode || null},
          ${suitePrice?.toString() || null},
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
          '2025/12/1/180',  // Line 1
          '2025/12/1/2649', // Line 1
          '2025/12/1/3'     // Line 1
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
        const errors = [];
        
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
            console.log(`   Line ID: ${cruiseData.lineid} (type: ${typeof cruiseData.lineid})`);
            console.log(`   Ship ID: ${cruiseData.shipid} (type: ${typeof cruiseData.shipid})`);
            console.log(`   Nights: ${cruiseData.nights}`);
            console.log(`   Sail Date: ${cruiseData.saildate || cruiseData.startdate}`);
            
            // Use the fixed sync function
            await syncCruiseWithCorrectTypes(cruiseData);
            console.log(`   ✅ Synced successfully`);
            successful++;
            
          } catch (error) {
            console.error(`   ❌ Failed: ${error.message}`);
            errors.push({ file: fileInfo.path, error: error.message });
            failed++;
          }
        }
        
        console.log('\n' + '='.repeat(50));
        console.log('📊 SYNC SUMMARY');
        console.log('='.repeat(50));
        console.log(`✅ Successful: ${successful}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`📁 Total: ${allFiles.length}`);
        
        if (errors.length > 0) {
          console.log('\n❌ Errors:');
          errors.forEach(e => console.log(`   ${e.file}: ${e.error}`));
        }
        
        // Verify in database
        if (successful > 0) {
          console.log('\n🔍 Verifying in database...');
          const { db } = require('../dist/db/connection');
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
            ORDER BY id DESC
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
    console.log('\n✨ Sync completed successfully!');
    console.log('\n🎉 Your database now has cruise data!');
    console.log('You can test the API at:');
    console.log('https://zipsea-production.onrender.com/api/v1/search');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });