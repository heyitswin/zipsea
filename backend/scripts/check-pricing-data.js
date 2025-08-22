#!/usr/bin/env node

/**
 * CHECK PRICING DATA
 * 
 * This script checks if pricing data has been synced from Traveltek
 */

require('dotenv').config();
const postgres = require('postgres');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL not configured');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkPricingData() {
  console.log('📊 CHECKING PRICING DATA');
  console.log('========================\n');
  
  try {
    // Check static_prices table
    const staticPrices = await sql`
      SELECT COUNT(*) as count
      FROM static_prices
    `;
    
    console.log('📌 Static Prices Table:');
    console.log(`   Total records: ${staticPrices[0].count}`);
    
    if (staticPrices[0].count > 0) {
      const sample = await sql`
        SELECT 
          sp.*, 
          c.name as cruise_name,
          c.sailing_date
        FROM static_prices sp
        JOIN cruises c ON c.id = sp.cruise_id
        LIMIT 5
      `;
      
      console.log('\n   Sample prices:');
      sample.forEach(p => {
        console.log(`     Cruise: ${p.cruise_name} (${p.sailing_date})`);
        console.log(`     Cabin: ${p.cabin_id}, Rate: ${p.rate_code}`);
        console.log(`     Price: $${p.price || p.adult_price || 'N/A'}`);
        console.log('');
      });
    }
    
    // Check cached_prices table
    const cachedPrices = await sql`
      SELECT COUNT(*) as count
      FROM cached_prices
    `;
    
    console.log('\n📌 Cached Prices Table:');
    console.log(`   Total records: ${cachedPrices[0].count}`);
    
    // Check price_snapshots table
    const priceSnapshots = await sql`
      SELECT COUNT(*) as count
      FROM price_snapshots
    `;
    
    console.log('\n📌 Price Snapshots Table:');
    console.log(`   Total records: ${priceSnapshots[0].count}`);
    
    // Check September 2025 cruises with prices
    const sept2025WithPrices = await sql`
      SELECT COUNT(DISTINCT c.id) as count
      FROM cruises c
      LEFT JOIN static_prices sp ON sp.cruise_id = c.id
      WHERE c.sailing_date >= '2025-09-01' 
        AND c.sailing_date < '2025-10-01'
        AND sp.id IS NOT NULL
    `;
    
    console.log('\n📌 September 2025 Cruises with Prices:');
    console.log(`   ${sept2025WithPrices[0].count} out of 2429 cruises have pricing`);
    
    // Check Traveltek JSON files for pricing data
    console.log('\n💡 ANALYSIS:');
    if (staticPrices[0].count === 0) {
      console.log('   ❌ No static pricing data found');
      console.log('   → Static pricing needs to be extracted from Traveltek JSON files');
      console.log('   → Each JSON file contains pricing arrays in the "prices" field');
      console.log('   → Need to run a sync script to extract and store this data');
    } else {
      console.log('   ✅ Static pricing data exists');
      console.log(`   → ${staticPrices[0].count} price records available`);
    }
    
    console.log('\n📋 NEXT STEPS:');
    if (staticPrices[0].count === 0) {
      console.log('   1. Create a script to extract pricing from Traveltek JSON files');
      console.log('   2. Parse the "prices" array from each cruise JSON');
      console.log('   3. Insert pricing data into static_prices table');
      console.log('   4. Configure webhook URL in Traveltek iSell for real-time updates');
    } else {
      console.log('   1. Configure webhook URL in Traveltek iSell platform');
      console.log('   2. Monitor webhook_events table for incoming price updates');
      console.log('   3. Verify price_snapshots are being created for changes');
    }
    
  } catch (error) {
    console.error('Error checking pricing data:', error);
  } finally {
    await sql.end();
  }
}

checkPricingData().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});