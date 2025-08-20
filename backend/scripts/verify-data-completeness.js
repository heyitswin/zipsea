#!/usr/bin/env node

/**
 * Verify that ALL data from JSON files is being stored correctly
 * Compare database content with actual FTP JSON content
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
  cheapestPricing,
  itineraries,
  cabinCategories,
  pricing
} = require('../dist/db/schema');
const { eq } = require('drizzle-orm');

console.log('🔍 Data Completeness Verification');
console.log('==================================\n');

const ftpConfig = {
  host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
  user: process.env.TRAVELTEK_FTP_USER,
  password: process.env.TRAVELTEK_FTP_PASSWORD,
  port: 21,
  secure: false,
  connTimeout: 30000,
  pasvTimeout: 30000
};

// Download a file from FTP
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

async function verifyDataCompleteness() {
  const client = new FTP();
  
  return new Promise((resolve, reject) => {
    client.on('ready', async () => {
      console.log('✅ Connected to FTP\n');
      
      try {
        // Test with a known cruise that should be in the database
        const testCruiseId = 345235; // From earlier sync
        const testFilePath = '/2025/01/10/54/2092628.json';
        
        console.log(`📄 Checking cruise ${testCruiseId}`);
        console.log(`   File: ${testFilePath}\n`);
        
        // 1. Download the JSON from FTP
        console.log('1️⃣ Downloading JSON from FTP...');
        const jsonContent = await downloadFile(client, testFilePath);
        const jsonData = JSON.parse(jsonContent);
        
        console.log('   ✅ Downloaded JSON data\n');
        
        // 2. Get the cruise from database
        console.log('2️⃣ Fetching cruise from database...');
        const dbCruise = await db.select().from(cruises).where(eq(cruises.id, testCruiseId));
        
        if (dbCruise.length === 0) {
          console.log('   ❌ Cruise not found in database!\n');
          client.end();
          return;
        }
        
        const cruise = dbCruise[0];
        console.log('   ✅ Found cruise in database\n');
        
        // 3. Compare core fields
        console.log('3️⃣ Comparing CORE FIELDS:');
        console.log('─'.repeat(40));
        
        const coreFields = {
          'ID': { json: jsonData.cruiseid, db: cruise.id },
          'Name': { json: jsonData.name, db: cruise.name },
          'Code to Cruise ID': { json: jsonData.codetocruiseid, db: cruise.codeToCruiseId },
          'Nights': { json: jsonData.nights, db: cruise.nights },
          'Line ID': { json: jsonData.lineid, db: cruise.cruiseLineId },
          'Ship ID': { json: jsonData.shipid, db: cruise.shipId },
          'Sail Date': { json: jsonData.saildate || jsonData.startdate, db: cruise.sailingDate },
          'Market ID': { json: jsonData.marketid, db: cruise.marketId },
          'Owner ID': { json: jsonData.ownerid, db: cruise.ownerId },
          'Show Cruise': { json: jsonData.showcruise, db: cruise.showCruise },
          'No Fly': { json: jsonData.nofly, db: cruise.noFly },
          'Depart UK': { json: jsonData.departuk, db: cruise.departUk }
        };
        
        let coreMatch = true;
        for (const [field, values] of Object.entries(coreFields)) {
          const match = String(values.json) === String(values.db) || 
                        (values.json === 'system' && values.db === null);
          console.log(`   ${match ? '✅' : '❌'} ${field}:`);
          console.log(`      JSON: ${values.json}`);
          console.log(`      DB:   ${values.db}`);
          if (!match) coreMatch = false;
        }
        
        // 4. Check arrays (ports and regions)
        console.log('\n4️⃣ Comparing ARRAY FIELDS:');
        console.log('─'.repeat(40));
        
        const jsonPortIds = jsonData.portids || [];
        const dbPortIds = cruise.portIds || [];
        console.log(`   Port IDs:`);
        console.log(`      JSON: [${jsonPortIds}]`);
        console.log(`      DB:   ${JSON.stringify(dbPortIds)}`);
        console.log(`      Match: ${JSON.stringify(jsonPortIds) === JSON.stringify(dbPortIds) ? '✅' : '⚠️'}`);
        
        const jsonRegionIds = jsonData.regionids || [];
        const dbRegionIds = cruise.regionIds || [];
        console.log(`   Region IDs:`);
        console.log(`      JSON: [${jsonRegionIds}]`);
        console.log(`      DB:   ${JSON.stringify(dbRegionIds)}`);
        console.log(`      Match: ${JSON.stringify(jsonRegionIds) === JSON.stringify(dbRegionIds) ? '✅' : '⚠️'}`);
        
        // 5. Check if we stored complex objects (ship content, cabins, etc.)
        console.log('\n5️⃣ Checking COMPLEX DATA storage:');
        console.log('─'.repeat(40));
        
        // Check if ship content was processed
        if (jsonData.shipcontent) {
          const shipData = await db.select().from(ships).where(eq(ships.id, cruise.shipId));
          if (shipData.length > 0) {
            const ship = shipData[0];
            console.log(`   Ship Content:`);
            console.log(`      JSON has: ${Object.keys(jsonData.shipcontent).length} fields`);
            console.log(`      Ship name in DB: ${ship.name}`);
            console.log(`      Ship code in DB: ${ship.code}`);
            console.log(`      Stored: ${ship.name !== `Ship ${cruise.shipId}` ? '✅ Custom data' : '⚠️ Generic data'}`);
          }
        }
        
        // 6. Check pricing data
        console.log('\n6️⃣ Checking PRICING DATA:');
        console.log('─'.repeat(40));
        
        const pricingData = await db.select().from(cheapestPricing).where(eq(cheapestPricing.cruiseId, testCruiseId));
        
        if (jsonData.cheapest) {
          console.log(`   Cheapest Price:`);
          console.log(`      JSON: ${jsonData.cheapest.price}`);
          console.log(`      DB:   ${pricingData[0]?.cheapestPrice || 'Not stored'}`);
        }
        
        if (jsonData.cheapestinside) {
          console.log(`   Interior Price:`);
          console.log(`      JSON: ${jsonData.cheapestinside.price}`);
          console.log(`      DB:   ${pricingData[0]?.interiorPrice || 'Not stored'}`);
        }
        
        // 7. Check what's NOT being stored
        console.log('\n7️⃣ Data NOT currently being stored:');
        console.log('─'.repeat(40));
        
        const notStored = [];
        
        // Check itinerary
        if (jsonData.itinerary && jsonData.itinerary.length > 0) {
          const itineraryData = await db.select().from(itineraries).where(eq(itineraries.cruiseId, testCruiseId));
          if (itineraryData.length === 0) {
            notStored.push(`Itinerary (${jsonData.itinerary.length} days)`);
          }
        }
        
        // Check detailed pricing (prices object)
        if (jsonData.prices && Object.keys(jsonData.prices).length > 0) {
          const detailedPricing = await db.select().from(pricing).where(eq(pricing.cruiseId, testCruiseId));
          if (detailedPricing.length === 0) {
            notStored.push(`Detailed pricing (${Object.keys(jsonData.prices).length} rate codes)`);
          }
        }
        
        // Check cabin definitions
        if (jsonData.cabins && Object.keys(jsonData.cabins).length > 0) {
          const cabinData = await db.select().from(cabinCategories).where(eq(cabinCategories.shipId, cruise.shipId));
          if (cabinData.length === 0) {
            notStored.push(`Cabin definitions (${Object.keys(jsonData.cabins).length} cabin types)`);
          }
        }
        
        // Check other fields
        if (jsonData.altsailings && jsonData.altsailings.length > 0) {
          notStored.push(`Alternative sailings (${jsonData.altsailings.length} alternatives)`);
        }
        
        if (jsonData.flycruiseinfo) {
          notStored.push('Fly cruise info');
        }
        
        if (jsonData.linecontent) {
          notStored.push('Line content');
        }
        
        if (notStored.length > 0) {
          console.log('   ❌ NOT being stored:');
          notStored.forEach(item => console.log(`      - ${item}`));
        } else {
          console.log('   ✅ All major data is being stored!');
        }
        
        // 8. Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 SUMMARY');
        console.log('='.repeat(60));
        
        console.log('\n✅ WHAT IS BEING STORED:');
        console.log('   • Core cruise data (id, name, dates, nights)');
        console.log('   • Cruise line and ship associations');
        console.log('   • Port and region arrays');
        console.log('   • Cheapest pricing by cabin category');
        console.log('   • Basic ship information');
        
        console.log('\n⚠️  WHAT IS NOT BEING STORED:');
        console.log('   • Detailed itinerary (day-by-day)');
        console.log('   • Full pricing matrix (all rate codes/occupancies)');
        console.log('   • Cabin definitions and amenities');
        console.log('   • Alternative sailings');
        console.log('   • Ship images and detailed content');
        console.log('   • Port names (only IDs stored)');
        
        console.log('\n💡 RECOMMENDATIONS:');
        console.log('   1. Current sync stores essential data for search');
        console.log('   2. To store ALL data, need to process:');
        console.log('      - itinerary array → itineraries table');
        console.log('      - prices object → pricing table');
        console.log('      - cabins object → cabin_categories table');
        console.log('      - shipcontent → update ships table');
        console.log('   3. This would require enhancing sync script');
        
        client.end();
        resolve();
        
      } catch (error) {
        console.error('Verification error:', error);
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

// Run verification
verifyDataCompleteness()
  .then(() => {
    console.log('\n✨ Verification complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal:', error.message);
    process.exit(1);
  });