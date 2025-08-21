#!/usr/bin/env node

/**
 * Check Cruise Primary Key Status
 * Run this to see if the migration is needed
 */

require('dotenv').config();
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkStatus() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 CRUISE TABLE PRIMARY KEY STATUS CHECK');
    console.log('=========================================\n');
    
    // Check table structure
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'cruises'
      AND column_name IN ('id', 'cruise_id', 'code_to_cruise_id')
      ORDER BY ordinal_position
    `);
    
    console.log('📊 Current Schema:');
    columns.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Check if cruise_id column exists (indicates migration completed)
    const hasCruiseIdColumn = columns.rows.some(col => col.column_name === 'cruise_id');
    
    // Get statistics
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT id) as unique_ids,
        COUNT(DISTINCT code_to_cruise_id) as unique_code_to_cruise_ids,
        COUNT(*) FILTER (WHERE code_to_cruise_id IS NULL) as null_code_to_cruise_ids
      FROM cruises
    `);
    
    const data = stats.rows[0];
    console.log('\n📈 Data Statistics:');
    console.log(`   Total records: ${data.total_records}`);
    console.log(`   Unique IDs: ${data.unique_ids}`);
    console.log(`   Unique code_to_cruise_ids: ${data.unique_code_to_cruise_ids}`);
    console.log(`   NULL code_to_cruise_ids: ${data.null_code_to_cruise_ids}`);
    
    // Check for duplicate IDs
    const duplicateIds = await client.query(`
      SELECT id, COUNT(*) as count
      FROM cruises
      GROUP BY id
      HAVING COUNT(*) > 1
      LIMIT 5
    `);
    
    if (duplicateIds.rows.length > 0) {
      console.log('\n⚠️  Duplicate IDs found:');
      duplicateIds.rows.forEach(row => {
        console.log(`   ID ${row.id}: ${row.count} occurrences`);
      });
    }
    
    // Check for duplicate code_to_cruise_ids
    const duplicateCodes = await client.query(`
      SELECT code_to_cruise_id, COUNT(*) as count
      FROM cruises
      WHERE code_to_cruise_id IS NOT NULL
      GROUP BY code_to_cruise_id
      HAVING COUNT(*) > 1
      LIMIT 5
    `);
    
    if (duplicateCodes.rows.length > 0) {
      console.log('\n⚠️  Duplicate code_to_cruise_ids found:');
      duplicateCodes.rows.forEach(row => {
        console.log(`   code_to_cruise_id ${row.code_to_cruise_id}: ${row.count} occurrences`);
      });
    }
    
    // Check recent sync errors
    console.log('\n🔍 Checking for recent sync issues...');
    
    // Sample some data to understand the structure
    const sample = await client.query(`
      SELECT id, code_to_cruise_id, name, sailing_date
      FROM cruises
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 3
    `);
    
    console.log('\n📝 Sample Recent Records:');
    sample.rows.forEach(row => {
      console.log(`   ID: ${row.id}, Code: ${row.code_to_cruise_id}, Date: ${row.sailing_date}`);
    });
    
    // Diagnosis
    console.log('\n🔬 DIAGNOSIS:');
    console.log('==============');
    
    if (hasCruiseIdColumn) {
      console.log('✅ Migration appears to be COMPLETED');
      console.log('   - cruise_id column exists');
      console.log('   - Primary key should be using code_to_cruise_id');
      console.log('\n   Ready to use: node scripts/sync-production-corrected-pk.js');
    } else {
      console.log('❌ Migration is NEEDED');
      console.log('   - No cruise_id column found');
      console.log('   - Primary key is still using cruiseid (causes duplicates)');
      
      if (duplicateIds.rows.length > 0) {
        console.log('   - Duplicate IDs exist (this is the problem!)');
      }
      
      console.log('\n   👉 Run: node scripts/run-cruise-pk-migration.js');
    }
    
    // Check related tables
    console.log('\n📋 Related Tables Check:');
    const relatedTables = ['itineraries', 'static_prices', 'cached_prices', 'cheapest_prices'];
    
    for (const table of relatedTables) {
      const count = await client.query(`
        SELECT COUNT(*) as count
        FROM ${table}
      `);
      console.log(`   ${table}: ${count.rows[0].count} records`);
    }
    
  } catch (error) {
    console.error('❌ Error checking status:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the check
checkStatus()
  .then(() => {
    console.log('\n✅ Status check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Check failed:', error);
    process.exit(1);
  });