#!/usr/bin/env node

/**
 * Check what's actually in the database
 * Verify if cruises have complete data or just IDs
 */

require('dotenv').config();
const { db } = require('../dist/db/connection');
const { sql } = require('drizzle-orm');

console.log('🔍 Database Data Verification');
console.log('==============================\n');

async function checkDatabase() {
  try {
    // 1. Check total cruise count
    console.log('📊 CRUISE COUNTS:');
    console.log('─'.repeat(40));
    
    const totalResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM cruises
    `);
    const totalCount = totalResult.rows?.[0]?.count || 0;
    console.log(`Total cruises: ${totalCount}`);
    
    // 2. Check cruises with missing critical data
    console.log('\n🔍 DATA COMPLETENESS CHECK:');
    console.log('─'.repeat(40));
    
    // Check for cruises with NULL or empty names
    const noNameResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM cruises 
      WHERE name IS NULL OR name = '' OR name = 'Cruise'
    `);
    console.log(`Cruises without proper names: ${noNameResult.rows?.[0]?.count || 0}`);
    
    // Check for cruises with NULL sailing dates
    const noDateResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM cruises 
      WHERE sailing_date IS NULL
    `);
    console.log(`Cruises without sailing dates: ${noDateResult.rows?.[0]?.count || 0}`);
    
    // Check for cruises with 0 nights
    const noNightsResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM cruises 
      WHERE nights = 0 OR nights IS NULL
    `);
    console.log(`Cruises with 0 or NULL nights: ${noNightsResult.rows?.[0]?.count || 0}`);
    
    // Check for cruises without ship assignment
    const noShipResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM cruises 
      WHERE ship_id IS NULL
    `);
    console.log(`Cruises without ship assignment: ${noShipResult.rows?.[0]?.count || 0}`);
    
    // 3. Sample some actual cruise data
    console.log('\n📋 SAMPLE CRUISE DATA (First 5):');
    console.log('─'.repeat(40));
    
    const sampleResult = await db.execute(sql`
      SELECT 
        id,
        name,
        cruise_line_id,
        ship_id,
        sailing_date,
        nights,
        embark_port_id,
        traveltek_file_path
      FROM cruises 
      ORDER BY id 
      LIMIT 5
    `);
    
    if (sampleResult.rows && sampleResult.rows.length > 0) {
      sampleResult.rows.forEach((cruise, index) => {
        console.log(`\n${index + 1}. Cruise ID: ${cruise.id}`);
        console.log(`   Name: ${cruise.name || 'NULL'}`);
        console.log(`   Line ID: ${cruise.cruise_line_id || 'NULL'}`);
        console.log(`   Ship ID: ${cruise.ship_id || 'NULL'}`);
        console.log(`   Sailing Date: ${cruise.sailing_date || 'NULL'}`);
        console.log(`   Nights: ${cruise.nights || 'NULL'}`);
        console.log(`   Embark Port: ${cruise.embark_port_id || 'NULL'}`);
        console.log(`   File Path: ${cruise.traveltek_file_path || 'NULL'}`);
      });
    } else {
      console.log('No cruises found in database!');
    }
    
    // 4. Check related tables
    console.log('\n📊 RELATED TABLES:');
    console.log('─'.repeat(40));
    
    const linesResult = await db.execute(sql`SELECT COUNT(*) as count FROM cruise_lines`);
    console.log(`Cruise lines: ${linesResult.rows?.[0]?.count || 0}`);
    
    const shipsResult = await db.execute(sql`SELECT COUNT(*) as count FROM ships`);
    console.log(`Ships: ${shipsResult.rows?.[0]?.count || 0}`);
    
    const portsResult = await db.execute(sql`SELECT COUNT(*) as count FROM ports`);
    console.log(`Ports: ${portsResult.rows?.[0]?.count || 0}`);
    
    const regionsResult = await db.execute(sql`SELECT COUNT(*) as count FROM regions`);
    console.log(`Regions: ${regionsResult.rows?.[0]?.count || 0}`);
    
    // 5. Check pricing data
    console.log('\n💰 PRICING DATA:');
    console.log('─'.repeat(40));
    
    const pricingResult = await db.execute(sql`SELECT COUNT(*) as count FROM cheapest_pricing`);
    console.log(`Cheapest pricing records: ${pricingResult.rows?.[0]?.count || 0}`);
    
    // Check if any cruises have pricing
    const cruisesWithPricingResult = await db.execute(sql`
      SELECT COUNT(DISTINCT cruise_id) as count 
      FROM cheapest_pricing 
      WHERE cheapest_price IS NOT NULL AND cheapest_price > 0
    `);
    console.log(`Cruises with valid pricing: ${cruisesWithPricingResult.rows?.[0]?.count || 0}`);
    
    // 6. Check for potential issues
    console.log('\n⚠️  POTENTIAL ISSUES:');
    console.log('─'.repeat(40));
    
    // Check for cruises with future file paths (should have been downloaded)
    const filePathResult = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM cruises 
      WHERE traveltek_file_path IS NOT NULL 
      AND traveltek_file_path != ''
    `);
    console.log(`Cruises with file paths: ${filePathResult.rows?.[0]?.count || 0}`);
    
    // Check date ranges
    const dateRangeResult = await db.execute(sql`
      SELECT 
        MIN(sailing_date) as earliest,
        MAX(sailing_date) as latest
      FROM cruises
      WHERE sailing_date IS NOT NULL
    `);
    
    if (dateRangeResult.rows?.[0]) {
      console.log(`Date range: ${dateRangeResult.rows[0].earliest} to ${dateRangeResult.rows[0].latest}`);
    }
    
    // 7. Diagnosis
    console.log('\n🔬 DIAGNOSIS:');
    console.log('─'.repeat(40));
    
    if (totalCount === 0) {
      console.log('❌ Database is EMPTY - no cruises found!');
    } else if (noNameResult.rows?.[0]?.count > totalCount * 0.5) {
      console.log('⚠️  Most cruises have missing names - data may be incomplete');
    } else if (pricingResult.rows?.[0]?.count === 0) {
      console.log('⚠️  No pricing data found - sync may not be processing pricing');
    } else {
      console.log('✅ Database appears to have valid cruise data');
    }
    
    // Check if we need to clear and resync
    if (totalCount > 0 && filePathResult.rows?.[0]?.count === 0) {
      console.log('\n💡 RECOMMENDATION:');
      console.log('Cruises exist but have no file paths - they may be stub records.');
      console.log('Consider clearing the database and resyncing:');
      console.log('  DELETE FROM cruises;');
      console.log('  DELETE FROM cheapest_pricing;');
      console.log('Then run the sync again.');
    }
    
  } catch (error) {
    console.error('Error checking database:', error);
  }
}

// Run check
checkDatabase()
  .then(() => {
    console.log('\n✨ Check complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal:', error.message);
    process.exit(1);
  });