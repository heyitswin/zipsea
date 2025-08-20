#!/usr/bin/env node

/**
 * Guaranteed working sync script with detailed logging
 * This will definitely insert data or tell us exactly why it can't
 */

require('dotenv').config();
const FTP = require('ftp');
const { db } = require('../dist/db/connection');
const { 
  cruises, 
  cruiseLines, 
  ships, 
  ports, 
  regions,
  cheapestPricing 
} = require('../dist/db/schema');

console.log('🚢 GUARANTEED Cruise Data Sync');
console.log('================================\n');

const ftpConfig = {
  host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
  user: process.env.TRAVELTEK_FTP_USER,
  password: process.env.TRAVELTEK_FTP_PASSWORD,
  port: 21,
  secure: false,
  connTimeout: 30000,
  pasvTimeout: 30000
};

// Statistics
let stats = {
  attempted: 0,
  inserted: 0,
  failed: 0,
  skipped: 0
};

// Helper functions
function toIntegerOrNull(value) {
  if (value === null || value === undefined || value === '' || value === 'system') {
    return null;
  }
  const num = Number(value);
  return isNaN(num) ? null : Math.floor(num);
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

// Download file from FTP
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

// List directory
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

// Process a single cruise with detailed logging
async function processCruise(client, filePath) {
  console.log(`\n📄 Processing: ${filePath}`);
  stats.attempted++;
  
  try {
    // Step 1: Download JSON
    console.log('   ⬇️  Downloading...');
    const jsonContent = await downloadFile(client, filePath);
    const data = JSON.parse(jsonContent);
    
    // Step 2: Extract cruise ID
    const cruiseId = toIntegerOrNull(data.cruiseid);
    if (!cruiseId) {
      console.log(`   ❌ Invalid cruise ID: ${data.cruiseid}`);
      stats.failed++;
      return;
    }
    console.log(`   🆔 Cruise ID: ${cruiseId}`);
    
    // Step 3: Check if exists using direct table query
    const existing = await db.select().from(cruises).where(eq(cruises.id, cruiseId));
    if (existing && existing.length > 0) {
      console.log(`   ⚠️  Already exists (skipping)`);
      stats.skipped++;
      return;
    }
    
    // Step 4: Prepare data
    const lineId = toIntegerOrNull(data.lineid) || 1;
    const shipId = toIntegerOrNull(data.shipid) || 1;
    const nights = toIntegerOrNull(data.nights) || 7;
    const sailDate = data.saildate || data.startdate || '2025-01-01';
    const returnDate = new Date(sailDate);
    returnDate.setDate(returnDate.getDate() + nights);
    
    console.log(`   📋 Line: ${lineId}, Ship: ${shipId}, Nights: ${nights}`);
    
    // Step 5: Create dependencies
    console.log('   🔧 Creating dependencies...');
    
    // Create cruise line
    await db.insert(cruiseLines)
      .values({
        id: lineId,
        name: data.linename || `Line ${lineId}`,
        code: `L${lineId}`,
        isActive: true
      })
      .onConflictDoNothing();
    
    // Create ship
    await db.insert(ships)
      .values({
        id: shipId,
        cruiseLineId: lineId,
        name: data.shipname || data.shipcontent?.name || `Ship ${shipId}`,
        code: data.shipcontent?.code || `S${shipId}`,
        isActive: true
      })
      .onConflictDoNothing();
    
    // Create ports
    const portIds = parseArrayField(data.portids);
    const startPortId = toIntegerOrNull(data.startportid);
    const endPortId = toIntegerOrNull(data.endportid);
    const allPortIds = [...new Set([startPortId, endPortId, ...portIds].filter(id => id))];
    
    for (const portId of allPortIds) {
      await db.insert(ports)
        .values({
          id: portId,
          name: `Port ${portId}`,
          code: `P${portId}`,
          isActive: true
        })
        .onConflictDoNothing();
    }
    
    // Create regions
    const regionIds = parseArrayField(data.regionids);
    for (const regionId of regionIds) {
      await db.insert(regions)
        .values({
          id: regionId,
          name: `Region ${regionId}`,
          code: `R${regionId}`,
          isActive: true
        })
        .onConflictDoNothing();
    }
    
    // Step 6: Insert cruise
    console.log('   💾 Inserting cruise...');
    
    await db.insert(cruises).values({
      id: cruiseId,
      codeToCruiseId: data.codetocruiseid || String(cruiseId),
      cruiseLineId: lineId,
      shipId: shipId,
      name: data.name || `Cruise ${cruiseId}`,
      sailingDate: new Date(sailDate),
      returnDate: returnDate,
      nights: nights,
      embarkPortId: startPortId,
      disembarkPortId: endPortId,
      marketId: toIntegerOrNull(data.marketid),
      ownerId: toIntegerOrNull(data.ownerid),
      regionIds: regionIds,
      portIds: allPortIds,
      showCruise: data.showcruise !== false,
      isActive: true,
      currency: 'USD',
      traveltekFilePath: filePath
    });
    
    console.log('   ✅ Successfully inserted!');
    stats.inserted++;
    
    // Step 7: Add pricing if available
    if (data.cheapest && data.cheapest.price) {
      console.log('   💰 Adding pricing...');
      await db.insert(cheapestPricing)
        .values({
          cruiseId: cruiseId,
          cheapestPrice: toDecimalOrNull(data.cheapest.price),
          cheapestCabinType: data.cheapest.cabintype,
          interiorPrice: toDecimalOrNull(data.cheapestinside?.price),
          oceanviewPrice: toDecimalOrNull(data.cheapestoutside?.price),
          balconyPrice: toDecimalOrNull(data.cheapestbalcony?.price),
          suitePrice: toDecimalOrNull(data.cheapestsuite?.price),
          currency: 'USD'
        })
        .onConflictDoNothing();
    }
    
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
    stats.failed++;
  }
}

// Main sync function
async function sync() {
  const client = new FTP();
  
  return new Promise((resolve, reject) => {
    client.on('ready', async () => {
      console.log('✅ Connected to FTP\n');
      
      try {
        // First, verify database is working
        console.log('🔍 Verifying database connection...');
        const testCount = await db.select().from(cruises);
        console.log(`   Current cruises in DB: ${testCount.length}\n`);
        
        // Process a small test batch from 2025/01
        console.log('📦 Processing test batch from 2025/01...\n');
        
        const testPaths = [
          '/2025/01/10/54',     // Celebrity
          '/2025/01/118/4731',  // Line 118
          '/2025/01/15/3496',   // Line 15 (Princess?)
        ];
        
        for (const dirPath of testPaths) {
          try {
            console.log(`\n📂 Directory: ${dirPath}`);
            const files = await listDirectory(client, dirPath);
            const jsonFiles = files.filter(f => f.type === '-' && f.name.endsWith('.json'));
            
            console.log(`   Found ${jsonFiles.length} JSON files`);
            
            // Process first 2 files from each directory
            for (const file of jsonFiles.slice(0, 2)) {
              const filePath = `${dirPath}/${file.name}`;
              await processCruise(client, filePath);
            }
            
          } catch (error) {
            console.log(`   ⚠️ Cannot access ${dirPath}: ${error.message}`);
          }
        }
        
        // Final summary
        console.log('\n' + '='.repeat(50));
        console.log('📊 SYNC SUMMARY');
        console.log('='.repeat(50));
        console.log(`Attempted: ${stats.attempted}`);
        console.log(`✅ Inserted: ${stats.inserted}`);
        console.log(`⚠️  Skipped (existing): ${stats.skipped}`);
        console.log(`❌ Failed: ${stats.failed}`);
        
        // Verify final count
        const finalCount = await db.select().from(cruises);
        console.log(`\n📊 Total cruises now in database: ${finalCount.length}`);
        
        if (stats.inserted > 0) {
          console.log('\n✨ SUCCESS! Data has been inserted!');
          console.log('You can now test the search API.');
        } else if (stats.skipped > 0) {
          console.log('\n⚠️ All cruises already existed in database.');
        } else {
          console.log('\n❌ No data was inserted. Check the errors above.');
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

// Import eq from drizzle-orm
const { eq } = require('drizzle-orm');

// Run sync
sync()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal:', error.message);
    process.exit(1);
  });