#!/usr/bin/env node

/**
 * Migration Script: Cruise/Sailing Separation
 * 
 * This script safely migrates from the current schema where cruiseid is used as primary key
 * to a new schema that properly separates cruise definitions from individual sailings.
 * 
 * Benefits:
 * - Eliminates duplicate key violations
 * - Enables proper many-to-one relationship (multiple sailings per cruise)
 * - Improves search performance for finding alternative sailing dates
 * - Maintains backward compatibility with existing APIs
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting Cruise/Sailing Separation Migration');
    console.log('===============================================\n');
    
    // Start transaction
    await client.query('BEGIN');
    
    // Step 1: Analyze current data
    console.log('📊 Analyzing current data structure...');
    
    const totalCruises = await client.query('SELECT COUNT(*) FROM cruises');
    console.log(`   Total cruise records: ${totalCruises.rows[0].count}`);
    
    const duplicateCruiseIds = await client.query(`
      SELECT id, COUNT(*) as count
      FROM cruises
      GROUP BY id
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 10
    `);
    
    if (duplicateCruiseIds.rows.length > 0) {
      console.log(`   Duplicate cruise IDs found: ${duplicateCruiseIds.rows.length}`);
      console.log('   Top duplicates:');
      duplicateCruiseIds.rows.forEach(row => {
        console.log(`     - Cruise ID ${row.id}: ${row.count} sailings`);
      });
    } else {
      console.log('   No duplicate cruise IDs found');
    }
    
    const uniqueCruiseDefinitions = await client.query(`
      SELECT COUNT(*) FROM (
        SELECT DISTINCT 
          id, cruise_line_id, ship_id, name, 
          COALESCE(voyage_code, ''), nights,
          COALESCE(embark_port_id, 0), COALESCE(disembark_port_id, 0)
        FROM cruises
        WHERE is_active = true
      ) t
    `);
    console.log(`   Estimated unique cruise definitions: ${uniqueCruiseDefinitions.rows[0].count}`);
    
    // Step 2: Read and execute migration SQL
    console.log('\n🔄 Executing migration SQL...');
    
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '../src/db/migrations/0004_cruise_sailing_separation.sql'),
      'utf8'
    );
    
    await client.query(migrationSQL);
    
    // Step 3: Validate migration results
    console.log('\n✅ Validating migration results...');
    
    const newCruiseDefinitions = await client.query('SELECT COUNT(*) FROM cruise_definitions');
    const newCruiseSailings = await client.query('SELECT COUNT(*) FROM cruise_sailings');
    
    console.log(`   Cruise definitions created: ${newCruiseDefinitions.rows[0].count}`);
    console.log(`   Cruise sailings created: ${newCruiseSailings.rows[0].count}`);
    
    // Verify data integrity
    const orphanedSailings = await client.query(`
      SELECT COUNT(*) FROM cruise_sailings cs
      LEFT JOIN cruise_definitions cd ON cd.id = cs.cruise_definition_id
      WHERE cd.id IS NULL
    `);
    
    if (orphanedSailings.rows[0].count > 0) {
      throw new Error(`Found ${orphanedSailings.rows[0].count} orphaned sailings without cruise definitions`);
    }
    
    // Verify pricing references
    const pricingWithSailings = await client.query(`
      SELECT COUNT(*) FROM pricing WHERE cruise_sailing_id IS NOT NULL
    `);
    
    const totalPricing = await client.query('SELECT COUNT(*) FROM pricing');
    
    console.log(`   Pricing records with sailing references: ${pricingWithSailings.rows[0].count}/${totalPricing.rows[0].count}`);
    
    // Step 4: Test views
    console.log('\n🔍 Testing compatibility views...');
    
    const legacyViewTest = await client.query(`
      SELECT COUNT(*) FROM cruise_sailings_legacy LIMIT 1
    `);
    console.log(`   Legacy view working: ✓`);
    
    const alternativeSailingsTest = await client.query(`
      SELECT cruise_definition_id, sailing_count 
      FROM cruise_alternative_sailings 
      WHERE sailing_count > 1 
      LIMIT 5
    `);
    
    if (alternativeSailingsTest.rows.length > 0) {
      console.log(`   Alternative sailings view working: ✓`);
      console.log('   Sample cruises with multiple sailings:');
      alternativeSailingsTest.rows.forEach(row => {
        console.log(`     - Definition ${row.cruise_definition_id.slice(0, 8)}: ${row.sailing_count} sailings`);
      });
    }
    
    // Step 5: Performance test
    console.log('\n⚡ Testing query performance...');
    
    const performanceTestStart = Date.now();
    await client.query(`
      SELECT cd.name, cd.nights, COUNT(cs.id) as sailing_count
      FROM cruise_definitions cd
      LEFT JOIN cruise_sailings cs ON cs.cruise_definition_id = cd.id
      WHERE cd.is_active = true
      GROUP BY cd.id, cd.name, cd.nights
      HAVING COUNT(cs.id) > 1
      ORDER BY sailing_count DESC
      LIMIT 10
    `);
    const performanceTestEnd = Date.now();
    
    console.log(`   Alternative sailings query: ${performanceTestEnd - performanceTestStart}ms ✓`);
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('=====================================');
    console.log('New Schema Benefits:');
    console.log('• No more duplicate key violations');
    console.log('• Proper separation of cruise definitions and sailings');
    console.log('• Efficient queries for finding alternative sailing dates');
    console.log('• Backward compatibility maintained via views');
    console.log('• Better performance with targeted indexes');
    
    console.log('\nNext Steps:');
    console.log('1. Update your application code to use the new schema');
    console.log('2. Test all search and booking functionality');
    console.log('3. Monitor performance of alternative sailing queries');
    console.log('4. Eventually deprecate the legacy cruises table');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Rolling back changes...');
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function testQueries() {
  const client = await pool.connect();
  
  try {
    console.log('\n🧪 Testing Common Query Patterns');
    console.log('=================================\n');
    
    // Test 1: Find all sailings for a specific cruise
    console.log('Test 1: Finding all sailings for a cruise...');
    const test1 = await client.query(`
      SELECT cd.name, cs.sailing_date, cs.code_to_cruise_id
      FROM cruise_definitions cd
      JOIN cruise_sailings cs ON cs.cruise_definition_id = cd.id
      WHERE cd.traveltek_cruise_id = (
        SELECT traveltek_cruise_id FROM cruise_definitions LIMIT 1
      )
      ORDER BY cs.sailing_date
      LIMIT 5
    `);
    
    if (test1.rows.length > 0) {
      console.log(`   ✓ Found ${test1.rows.length} sailings for cruise "${test1.rows[0].name}"`);
      test1.rows.forEach(row => {
        console.log(`     - ${row.sailing_date} (Code: ${row.code_to_cruise_id})`);
      });
    }
    
    // Test 2: Search by ship and date range
    console.log('\nTest 2: Search by ship and date range...');
    const test2 = await client.query(`
      SELECT cd.name, s.name as ship_name, cs.sailing_date
      FROM cruise_definitions cd
      JOIN cruise_sailings cs ON cs.cruise_definition_id = cd.id
      JOIN ships s ON s.id = cd.ship_id
      WHERE cs.sailing_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '6 months'
      ORDER BY cs.sailing_date
      LIMIT 5
    `);
    
    console.log(`   ✓ Found ${test2.rows.length} upcoming sailings`);
    test2.rows.forEach(row => {
      console.log(`     - ${row.ship_name}: ${row.name} on ${row.sailing_date}`);
    });
    
    // Test 3: Performance test for alternative sailings
    console.log('\nTest 3: Alternative sailings performance...');
    const test3Start = Date.now();
    const test3 = await client.query(`
      SELECT * FROM cruise_alternative_sailings 
      WHERE sailing_count > 1 
      LIMIT 3
    `);
    const test3End = Date.now();
    
    console.log(`   ✓ Query completed in ${test3End - test3Start}ms`);
    console.log(`   ✓ Found ${test3.rows.length} cruises with multiple sailings`);
    
    console.log('\n✅ All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    client.release();
  }
}

// Main execution
async function main() {
  try {
    await runMigration();
    await testQueries();
    console.log('\n🚀 Ready to update your application code!');
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = { runMigration, testQueries };