#!/usr/bin/env node

/**
 * Cleanup old database tables and prepare for new schema
 * Run this before recreate-schema-complete.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function cleanupOldTables() {
  const client = await pool.connect();
  
  try {
    console.log('🧹 Cleaning up old tables and structures');
    console.log('=========================================\n');
    
    // List of old tables to drop
    const oldTables = [
      // Old pricing tables
      'pricing',
      'cheapest_pricing',
      'price_history',
      'price_trends',
      
      // Old structure tables
      'cabin_categories',
      'alternative_sailings',
      
      // Old webhook tables (if they exist)
      'webhooks',
      'sync_logs',
      
      // Old quote tables
      'quotes',
      'quote_items',
      'quote_requests',
      
      // Old user tables
      'users',
      'saved_searches'
    ];
    
    console.log('Dropping old tables...');
    for (const table of oldTables) {
      try {
        await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
        console.log(`  ✓ Dropped ${table}`);
      } catch (error) {
        console.log(`  ⚠️ Could not drop ${table}: ${error.message}`);
      }
    }
    
    // Clean up old indexes that might conflict
    const oldIndexes = [
      'idx_cruises_region',
      'idx_cruises_duration_nights',
      'idx_cruises_nights',
      'idx_cruises_region_ids',
      'idx_cruises_port_ids'
    ];
    
    console.log('\nDropping old indexes...');
    for (const index of oldIndexes) {
      try {
        await client.query(`DROP INDEX IF EXISTS ${index}`);
        console.log(`  ✓ Dropped index ${index}`);
      } catch (error) {
        console.log(`  ⚠️ Could not drop index ${index}: ${error.message}`);
      }
    }
    
    // Show remaining tables
    const remainingTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log('\n📊 Remaining tables:');
    if (remainingTables.rows.length === 0) {
      console.log('  (none - database is clean)');
    } else {
      for (const table of remainingTables.rows) {
        console.log(`  - ${table.table_name}`);
      }
    }
    
    console.log('\n✅ Cleanup complete!');
    console.log('\nNext steps:');
    console.log('1. Run: node scripts/recreate-schema-complete.js');
    console.log('2. Run: YEAR=2025 MONTH=09 node scripts/sync-complete-traveltek.js');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the cleanup
cleanupOldTables()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  });