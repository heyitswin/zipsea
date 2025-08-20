#!/usr/bin/env node

/**
 * Verification script to check that all data from Traveltek JSON is being stored
 */

require('dotenv').config();
const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { eq, sql: sqlHelper } = require('drizzle-orm');

// Import schema
const schema = require('../dist/db/schema');

console.log('🔍 Traveltek Data Sync Verification');
console.log('=====================================\n');

// Create database connection
const dbSql = postgres(process.env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const db = drizzle(dbSql, { schema });

async function verifyData() {
  try {
    // Check a specific cruise ID that we know was just processed
    const cruiseId = 345235; // First cruise from the sync output
    
    console.log(`📋 Checking data for Cruise ID: ${cruiseId}\n`);
    
    // 1. Check cruise record
    console.log('1️⃣ CRUISE RECORD:');
    const cruise = await db.select().from(schema.cruises).where(eq(schema.cruises.id, cruiseId)).limit(1);
    
    if (cruise.length > 0) {
      const c = cruise[0];
      console.log(`   ✅ Found cruise: ${c.name}`);
      console.log(`   • Sailing Date: ${c.sailingDate}`);
      console.log(`   • Nights: ${c.nights}`);
      console.log(`   • Ship ID: ${c.shipId}`);
      console.log(`   • Line ID: ${c.cruiseLineId}`);
      console.log(`   • Market ID: ${c.marketId}`);
      console.log(`   • Owner ID: ${c.ownerId}`);
      console.log(`   • Sail Nights: ${c.sailNights}`);
      console.log(`   • Sea Days: ${c.seaDays}`);
      console.log(`   • No Fly: ${c.noFly}`);
      console.log(`   • Depart UK: ${c.departUk}`);
      console.log(`   • Currency: ${c.currency}`);
      console.log(`   • Port IDs: ${JSON.stringify(c.portIds)}`);
      console.log(`   • Region IDs: ${JSON.stringify(c.regionIds)}`);
      console.log(`   • File Path: ${c.traveltekFilePath}`);
    } else {
      console.log('   ❌ Cruise not found');
    }
    
    // 2. Check itinerary
    console.log('\n2️⃣ ITINERARY:');
    const itinerary = await db.select().from(schema.itineraries).where(eq(schema.itineraries.cruiseId, cruiseId));
    console.log(`   • Found ${itinerary.length} days`);
    if (itinerary.length > 0) {
      itinerary.forEach(day => {
        console.log(`   Day ${day.dayNumber}: ${day.portName} (Port ID: ${day.portId})`);
      });
    }
    
    // 3. Check pricing
    console.log('\n3️⃣ DETAILED PRICING:');
    const pricing = await db.select().from(schema.pricing).where(eq(schema.pricing.cruiseId, cruiseId)).limit(5);
    console.log(`   • Found ${pricing.length} pricing records (showing first 5)`);
    if (pricing.length > 0) {
      pricing.forEach(p => {
        console.log(`   ${p.rateCode}/${p.cabinCode}/${p.occupancyCode}: $${p.basePrice}`);
        if (p.taxes) console.log(`     - Taxes: $${p.taxes}`);
        if (p.ncf) console.log(`     - NCF: $${p.ncf}`);
        if (p.gratuity) console.log(`     - Gratuity: $${p.gratuity}`);
        if (p.fuel) console.log(`     - Fuel: $${p.fuel}`);
        if (p.totalPrice) console.log(`     - Total: $${p.totalPrice}`);
      });
    }
    
    // Count total pricing records
    const pricingCount = await db.select({ count: sqlHelper`count(*)::int` })
      .from(schema.pricing)
      .where(eq(schema.pricing.cruiseId, cruiseId));
    console.log(`   • Total pricing records: ${pricingCount[0].count}`);
    
    // 4. Check cheapest pricing
    console.log('\n4️⃣ CHEAPEST PRICING:');
    const cheapest = await db.select().from(schema.cheapestPricing).where(eq(schema.cheapestPricing.cruiseId, cruiseId)).limit(1);
    if (cheapest.length > 0) {
      const cp = cheapest[0];
      console.log(`   • Interior: ${cp.interiorPrice ? '$' + cp.interiorPrice : 'N/A'}`);
      console.log(`   • Oceanview: ${cp.oceanviewPrice ? '$' + cp.oceanviewPrice : 'N/A'}`);
      console.log(`   • Balcony: ${cp.balconyPrice ? '$' + cp.balconyPrice : 'N/A'}`);
      console.log(`   • Suite: ${cp.suitePrice ? '$' + cp.suitePrice : 'N/A'}`);
    }
    
    // 5. Check ship details
    console.log('\n5️⃣ SHIP DETAILS:');
    let ship = [];
    if (cruise.length > 0) {
      ship = await db.select().from(schema.ships).where(eq(schema.ships.id, cruise[0].shipId)).limit(1);
      if (ship.length > 0) {
        const s = ship[0];
        console.log(`   ✅ Ship: ${s.name}`);
        console.log(`   • Class: ${s.shipClass || 'N/A'}`);
        console.log(`   • Tonnage: ${s.tonnage || 'N/A'}`);
        console.log(`   • Capacity: ${s.capacity || 'N/A'}`);
        console.log(`   • Total Cabins: ${s.totalCabins || 'N/A'}`);
        console.log(`   • Rating: ${s.rating || 'N/A'}`);
        console.log(`   • Has Description: ${s.description ? 'Yes' : 'No'}`);
        console.log(`   • Has Images: ${s.images && s.images.length > 0 ? `Yes (${s.images.length})` : 'No'}`);
      }
    }
    
    // 6. Check price history
    console.log('\n6️⃣ PRICE HISTORY SNAPSHOTS:');
    const priceHistory = await db.select().from(schema.priceHistory).where(eq(schema.priceHistory.cruiseId, cruiseId));
    console.log(`   • Found ${priceHistory.length} snapshots`);
    
    // 7. Overall statistics
    console.log('\n📊 OVERALL DATABASE STATISTICS:');
    const stats = await Promise.all([
      db.select({ count: sqlHelper`count(*)::int` }).from(schema.cruises),
      db.select({ count: sqlHelper`count(*)::int` }).from(schema.cruiseLines),
      db.select({ count: sqlHelper`count(*)::int` }).from(schema.ships),
      db.select({ count: sqlHelper`count(*)::int` }).from(schema.ports),
      db.select({ count: sqlHelper`count(*)::int` }).from(schema.regions),
      db.select({ count: sqlHelper`count(*)::int` }).from(schema.itineraries),
      db.select({ count: sqlHelper`count(*)::int` }).from(schema.pricing),
      db.select({ count: sqlHelper`count(*)::int` }).from(schema.cheapestPricing),
      db.select({ count: sqlHelper`count(*)::int` }).from(schema.priceHistory),
    ]);
    
    console.log(`   • Total Cruises: ${stats[0][0].count}`);
    console.log(`   • Total Cruise Lines: ${stats[1][0].count}`);
    console.log(`   • Total Ships: ${stats[2][0].count}`);
    console.log(`   • Total Ports: ${stats[3][0].count}`);
    console.log(`   • Total Regions: ${stats[4][0].count}`);
    console.log(`   • Total Itinerary Days: ${stats[5][0].count}`);
    console.log(`   • Total Pricing Records: ${stats[6][0].count}`);
    console.log(`   • Total Cheapest Pricing: ${stats[7][0].count}`);
    console.log(`   • Total Price History: ${stats[8][0].count}`);
    
    // Check if data is complete
    console.log('\n✅ DATA COMPLETENESS CHECK:');
    const checks = {
      'Cruise has all fields': cruise.length > 0 && cruise[0].traveltekFilePath && cruise[0].currency,
      'Itinerary exists': itinerary.length > 0,
      'Pricing exists': pricing.length > 0,
      'Pricing has fee details': pricing.some(p => p.taxes || p.ncf || p.gratuity),
      'Cheapest pricing exists': cheapest.length > 0,
      'Ship details exist': cruise.length > 0 && ship.length > 0,
    };
    
    Object.entries(checks).forEach(([check, passed]) => {
      console.log(`   ${passed ? '✅' : '❌'} ${check}`);
    });
    
    const allPassed = Object.values(checks).every(v => v);
    console.log(`\n${allPassed ? '🎉 ALL CHECKS PASSED!' : '⚠️ Some checks failed - review data'}`);
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
  } finally {
    await dbSql.end();
  }
}

// Run verification
verifyData();