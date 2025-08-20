#!/usr/bin/env node

/**
 * Diagnose why the search API is failing
 * Test the search service queries directly
 */

require('dotenv').config();
const { db } = require('../dist/db/connection');
const { 
  cruises, 
  cruiseLines, 
  ships, 
  ports, 
  regions,
  cheapestPricing 
} = require('../dist/db/schema');
const { eq, and, gte, lte, sql: sqlOperator } = require('drizzle-orm');

console.log('🔍 Diagnosing Search API Issues');
console.log('================================\n');

async function diagnose() {
  try {
    // 1. Test basic cruise query
    console.log('1️⃣ Testing basic cruise query:');
    console.log('─'.repeat(40));
    
    try {
      const basicCruises = await db
        .select({
          id: cruises.id,
          name: cruises.name,
          nights: cruises.nights,
          sailingDate: cruises.sailingDate
        })
        .from(cruises)
        .limit(5);
      
      console.log(`✅ Found ${basicCruises.length} cruises`);
      if (basicCruises.length > 0) {
        console.log('Sample:', basicCruises[0]);
      }
    } catch (error) {
      console.log(`❌ Basic query failed: ${error.message}`);
    }
    
    // 2. Test join with cruise lines
    console.log('\n2️⃣ Testing join with cruise lines:');
    console.log('─'.repeat(40));
    
    try {
      const cruisesWithLines = await db
        .select({
          cruiseId: cruises.id,
          cruiseName: cruises.name,
          lineId: cruiseLines.id,
          lineName: cruiseLines.name
        })
        .from(cruises)
        .leftJoin(cruiseLines, eq(cruises.cruiseLineId, cruiseLines.id))
        .limit(5);
      
      console.log(`✅ Found ${cruisesWithLines.length} cruises with lines`);
      if (cruisesWithLines.length > 0) {
        console.log('Sample:', cruisesWithLines[0]);
      }
    } catch (error) {
      console.log(`❌ Join with lines failed: ${error.message}`);
    }
    
    // 3. Test join with ships
    console.log('\n3️⃣ Testing join with ships:');
    console.log('─'.repeat(40));
    
    try {
      const cruisesWithShips = await db
        .select({
          cruiseId: cruises.id,
          shipId: ships.id,
          shipName: ships.name
        })
        .from(cruises)
        .leftJoin(ships, eq(cruises.shipId, ships.id))
        .limit(5);
      
      console.log(`✅ Found ${cruisesWithShips.length} cruises with ships`);
      if (cruisesWithShips.length > 0) {
        console.log('Sample:', cruisesWithShips[0]);
      }
    } catch (error) {
      console.log(`❌ Join with ships failed: ${error.message}`);
    }
    
    // 4. Test join with pricing
    console.log('\n4️⃣ Testing join with pricing:');
    console.log('─'.repeat(40));
    
    try {
      const cruisesWithPricing = await db
        .select({
          cruiseId: cruises.id,
          cruiseName: cruises.name,
          cheapestPrice: cheapestPricing.cheapestPrice
        })
        .from(cruises)
        .leftJoin(cheapestPricing, eq(cruises.id, cheapestPricing.cruiseId))
        .limit(5);
      
      console.log(`✅ Found ${cruisesWithPricing.length} cruises`);
      if (cruisesWithPricing.length > 0) {
        console.log('Sample:', cruisesWithPricing[0]);
      }
    } catch (error) {
      console.log(`❌ Join with pricing failed: ${error.message}`);
    }
    
    // 5. Test the full search query (simplified version)
    console.log('\n5️⃣ Testing simplified search query:');
    console.log('─'.repeat(40));
    
    try {
      const searchResults = await db
        .select({
          id: cruises.id,
          codeToCruiseId: cruises.codeToCruiseId,
          name: cruises.name,
          sailingDate: cruises.sailingDate,
          returnDate: cruises.returnDate,
          nights: cruises.nights,
          cruiseLineId: cruises.cruiseLineId,
          cruiseLineName: cruiseLines.name,
          shipId: cruises.shipId,
          shipName: ships.name,
          embarkPortId: cruises.embarkPortId,
          disembarkPortId: cruises.disembarkPortId,
          cheapestPrice: cheapestPricing.cheapestPrice,
          interiorPrice: cheapestPricing.interiorPrice,
          oceanviewPrice: cheapestPricing.oceanviewPrice,
          balconyPrice: cheapestPricing.balconyPrice,
          suitePrice: cheapestPricing.suitePrice
        })
        .from(cruises)
        .leftJoin(cruiseLines, eq(cruises.cruiseLineId, cruiseLines.id))
        .leftJoin(ships, eq(cruises.shipId, ships.id))
        .leftJoin(cheapestPricing, eq(cruises.id, cheapestPricing.cruiseId))
        .where(eq(cruises.isActive, true))
        .limit(5);
      
      console.log(`✅ Search query returned ${searchResults.length} results`);
      if (searchResults.length > 0) {
        console.log('\nFirst result:');
        console.log(JSON.stringify(searchResults[0], null, 2));
      }
    } catch (error) {
      console.log(`❌ Search query failed: ${error.message}`);
      console.log('Error details:', error);
    }
    
    // 6. Check for port names issue
    console.log('\n6️⃣ Testing port names:');
    console.log('─'.repeat(40));
    
    try {
      // First check if we have ports
      const portCount = await db.select().from(ports);
      console.log(`Ports in database: ${portCount.length}`);
      
      // Try to get port names for a cruise
      const cruiseWithPorts = await db
        .select({
          id: cruises.id,
          name: cruises.name,
          embarkPortId: cruises.embarkPortId,
          disembarkPortId: cruises.disembarkPortId,
          portIds: cruises.portIds
        })
        .from(cruises)
        .limit(1);
      
      if (cruiseWithPorts.length > 0) {
        console.log('Cruise port data:', cruiseWithPorts[0]);
        
        // Try to get port names
        if (cruiseWithPorts[0].embarkPortId) {
          const embarkPort = await db
            .select()
            .from(ports)
            .where(eq(ports.id, cruiseWithPorts[0].embarkPortId));
          
          console.log('Embark port:', embarkPort[0] || 'Not found');
        }
      }
    } catch (error) {
      console.log(`❌ Port query failed: ${error.message}`);
    }
    
    // 7. Check data types
    console.log('\n7️⃣ Checking data types:');
    console.log('─'.repeat(40));
    
    try {
      const sampleCruise = await db
        .select()
        .from(cruises)
        .limit(1);
      
      if (sampleCruise.length > 0) {
        const cruise = sampleCruise[0];
        console.log('Data types:');
        console.log(`  id: ${typeof cruise.id} (${cruise.id})`);
        console.log(`  name: ${typeof cruise.name} (${cruise.name})`);
        console.log(`  sailingDate: ${typeof cruise.sailingDate} (${cruise.sailingDate})`);
        console.log(`  nights: ${typeof cruise.nights} (${cruise.nights})`);
        console.log(`  regionIds: ${typeof cruise.regionIds} (${JSON.stringify(cruise.regionIds)})`);
        console.log(`  portIds: ${typeof cruise.portIds} (${JSON.stringify(cruise.portIds)})`);
      }
    } catch (error) {
      console.log(`❌ Type check failed: ${error.message}`);
    }
    
    // 8. Test if the issue is with JSON parsing
    console.log('\n8️⃣ Testing JSON field handling:');
    console.log('─'.repeat(40));
    
    try {
      // Test if we can query cruises with JSON fields
      const cruisesWithJson = await db
        .select({
          id: cruises.id,
          name: cruises.name,
          regionIds: cruises.regionIds,
          portIds: cruises.portIds
        })
        .from(cruises)
        .limit(3);
      
      console.log(`✅ Found ${cruisesWithJson.length} cruises with JSON fields`);
      cruisesWithJson.forEach((c, i) => {
        console.log(`\n${i + 1}. Cruise ${c.id}:`);
        console.log(`   Region IDs: ${JSON.stringify(c.regionIds)}`);
        console.log(`   Port IDs: ${JSON.stringify(c.portIds)}`);
      });
    } catch (error) {
      console.log(`❌ JSON field query failed: ${error.message}`);
    }
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }
}

// Run diagnosis
diagnose()
  .then(() => {
    console.log('\n✨ Diagnosis complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal:', error.message);
    process.exit(1);
  });