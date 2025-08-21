#!/usr/bin/env node

/**
 * Check what data actually exists in production database
 */

const { Pool } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL || process.env.PRODUCTION_DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL or PRODUCTION_DATABASE_URL environment variable not set');
  console.error('Usage: DATABASE_URL=your_production_url node scripts/check-production-data.js');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkProductionData() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking Production Database\n');
    console.log('========================================\n');
    
    // 1. Check basic counts
    console.log('1. Basic Table Counts:');
    console.log('----------------------');
    
    const tables = [
      'cruise_lines',
      'ships', 
      'ports',
      'cruises',
      'pricing',
      'cheapest_pricing',
      'itinerary',
      'cabin_categories'
    ];
    
    for (const table of tables) {
      try {
        const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`  ${table}: ${result.rows[0].count} records`);
      } catch (error) {
        console.log(`  ${table}: ERROR - ${error.message}`);
      }
    }
    
    console.log('\n2. Cruise Data Analysis:');
    console.log('------------------------');
    
    // Check cruise details
    const cruiseCheck = await client.query(`
      SELECT 
        COUNT(*) as total_cruises,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_cruises,
        COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_cruises,
        MIN(sailing_date) as earliest_departure,
        MAX(sailing_date) as latest_departure,
        COUNT(DISTINCT cruise_line_id) as unique_lines,
        COUNT(DISTINCT ship_id) as unique_ships
      FROM cruises
    `);
    
    const stats = cruiseCheck.rows[0];
    console.log(`  Total cruises: ${stats.total_cruises}`);
    console.log(`  Active: ${stats.active_cruises}`);
    console.log(`  Inactive: ${stats.inactive_cruises}`);
    console.log(`  Date range: ${stats.earliest_departure} to ${stats.latest_departure}`);
    console.log(`  Unique cruise lines: ${stats.unique_lines}`);
    console.log(`  Unique ships: ${stats.unique_ships}`);
    
    // If there are cruises, show a sample
    if (stats.total_cruises > 0) {
      console.log('\n3. Sample Cruises:');
      console.log('------------------');
      
      const samples = await client.query(`
        SELECT 
          c.id,
          c.name,
          c.sailing_date,
          cl.name as cruise_line,
          s.name as ship,
          c.is_active,
          c.created_at,
          c.updated_at
        FROM cruises c
        LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
        LEFT JOIN ships s ON c.ship_id = s.id
        ORDER BY c.created_at DESC
        LIMIT 5
      `);
      
      samples.rows.forEach(cruise => {
        console.log(`  ID: ${cruise.id}`);
        console.log(`  Name: ${cruise.name}`);
        console.log(`  Line/Ship: ${cruise.cruise_line} / ${cruise.ship}`);
        console.log(`  Departure: ${cruise.sailing_date}`);
        console.log(`  Active: ${cruise.is_active}`);
        console.log(`  Created: ${cruise.created_at}`);
        console.log(`  ---`);
      });
    }
    
    // Check if there's a sync issue
    console.log('\n4. Sync Status Check:');
    console.log('---------------------');
    
    // Check recent updates
    const recentActivity = await client.query(`
      SELECT 
        'cruises' as table_name,
        MAX(created_at) as last_created,
        MAX(updated_at) as last_updated
      FROM cruises
      UNION ALL
      SELECT 
        'pricing' as table_name,
        MAX(created_at) as last_created,
        MAX(updated_at) as last_updated
      FROM pricing
      UNION ALL
      SELECT 
        'cruise_lines' as table_name,
        MAX(created_at) as last_created,
        MAX(updated_at) as last_updated
      FROM cruise_lines
    `);
    
    console.log('  Recent activity:');
    recentActivity.rows.forEach(row => {
      console.log(`    ${row.table_name}:`);
      console.log(`      Last created: ${row.last_created || 'Never'}`);
      console.log(`      Last updated: ${row.last_updated || 'Never'}`);
    });
    
    // Check for any error patterns
    console.log('\n5. Potential Issues:');
    console.log('--------------------');
    
    // Check for cruises with missing relationships
    const orphanCheck = await client.query(`
      SELECT 
        COUNT(CASE WHEN cruise_line_id IS NULL THEN 1 END) as missing_line,
        COUNT(CASE WHEN ship_id IS NULL THEN 1 END) as missing_ship,
        COUNT(CASE WHEN departure_port_id IS NULL THEN 1 END) as missing_port
      FROM cruises
    `);
    
    const orphans = orphanCheck.rows[0];
    if (orphans.missing_line > 0) console.log(`  ⚠️  ${orphans.missing_line} cruises missing cruise_line_id`);
    if (orphans.missing_ship > 0) console.log(`  ⚠️  ${orphans.missing_ship} cruises missing ship_id`);
    if (orphans.missing_port > 0) console.log(`  ⚠️  ${orphans.missing_port} cruises missing departure_port_id`);
    
    // Check Traveltek file paths
    const filePathCheck = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(traveltek_file_path) as with_file_path,
        COUNT(DISTINCT traveltek_file_path) as unique_paths
      FROM cruises
    `);
    
    const paths = filePathCheck.rows[0];
    console.log(`  File paths: ${paths.with_file_path}/${paths.total} cruises have Traveltek paths`);
    console.log(`  Unique paths: ${paths.unique_paths}`);
    
    console.log('\n========================================');
    console.log('Diagnosis:');
    console.log('========================================\n');
    
    if (stats.total_cruises === 0) {
      console.log('❌ No cruises in database!');
      console.log('\nPossible causes:');
      console.log('1. Sync never ran or failed immediately');
      console.log('2. Database was cleared/reset');
      console.log('3. Sync is using wrong database URL');
      console.log('\nSolution: Run sync with FORCE_UPDATE=true');
    } else if (stats.active_cruises === 0) {
      console.log('⚠️  Cruises exist but all are inactive!');
      console.log('This might be intentional or a sync issue.');
    } else {
      console.log('✅ Database has active cruise data');
      console.log(`Found ${stats.active_cruises} active cruises`);
    }
    
  } catch (error) {
    console.error('❌ Error checking data:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the check
checkProductionData()
  .then(() => {
    console.log('\n✅ Check complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Check failed:', error);
    process.exit(1);
  });