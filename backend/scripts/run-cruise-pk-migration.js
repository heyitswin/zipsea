#!/usr/bin/env node

/**
 * Production Migration Script: Fix Cruise Primary Key
 * 
 * This script safely migrates the cruise table to use code_to_cruise_id as primary key
 * Safe to run on Render production environment
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
  connectionTimeoutMillis: 30000,
  query_timeout: 600000 // 10 minutes for large operations
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 CRUISE PRIMARY KEY MIGRATION');
    console.log('================================\n');
    
    // Step 1: Analyze current state
    console.log('📊 Step 1: Analyzing current database state...');
    
    const currentStats = await client.query(`
      SELECT 
        COUNT(*) as total_cruises,
        COUNT(DISTINCT id) as unique_ids,
        COUNT(DISTINCT code_to_cruise_id) as unique_code_to_ids,
        COUNT(*) FILTER (WHERE code_to_cruise_id IS NULL) as null_code_to_ids
      FROM cruises
    `);
    
    const stats = currentStats.rows[0];
    console.log(`   Total cruises: ${stats.total_cruises}`);
    console.log(`   Unique IDs: ${stats.unique_ids}`);
    console.log(`   Unique code_to_cruise_ids: ${stats.unique_code_to_ids}`);
    console.log(`   NULL code_to_cruise_ids: ${stats.null_code_to_ids}`);
    
    if (stats.null_code_to_ids > 0) {
      console.error('❌ Found cruises with NULL code_to_cruise_id. Cannot proceed.');
      process.exit(1);
    }
    
    // Check for duplicates
    const duplicates = await client.query(`
      SELECT code_to_cruise_id, COUNT(*) as count
      FROM cruises
      WHERE code_to_cruise_id IS NOT NULL
      GROUP BY code_to_cruise_id
      HAVING COUNT(*) > 1
      LIMIT 5
    `);
    
    if (duplicates.rows.length > 0) {
      console.log('\n⚠️  Found duplicate code_to_cruise_ids:');
      duplicates.rows.forEach(row => {
        console.log(`   code_to_cruise_id ${row.code_to_cruise_id}: ${row.count} occurrences`);
      });
      console.log('\n   These will be deduplicated during migration (keeping latest).');
    }
    
    // Step 2: Begin migration
    console.log('\n🔄 Step 2: Starting migration...');
    console.log('   This may take 5-15 minutes depending on data size.\n');
    
    await client.query('BEGIN');
    
    try {
      // Create backup table
      console.log('   Creating backup table...');
      await client.query('DROP TABLE IF EXISTS cruises_backup_before_pk_fix');
      await client.query('CREATE TABLE cruises_backup_before_pk_fix AS SELECT * FROM cruises');
      
      const backupCount = await client.query('SELECT COUNT(*) FROM cruises_backup_before_pk_fix');
      console.log(`   ✅ Backed up ${backupCount.rows[0].count} records`);
      
      // Create new table with correct structure
      console.log('\n   Creating new table structure...');
      await client.query(`
        CREATE TABLE cruises_new (
          id INTEGER PRIMARY KEY, -- This will be code_to_cruise_id
          cruise_id INTEGER NOT NULL, -- Original cruiseid for grouping
          cruise_line_id INTEGER NOT NULL,
          ship_id INTEGER NOT NULL,
          name VARCHAR(255),
          voyage_code VARCHAR(50),
          itinerary_code VARCHAR(50),
          sailing_date DATE NOT NULL,
          start_date DATE,
          nights INTEGER,
          sail_nights INTEGER,
          sea_days INTEGER,
          embark_port_id INTEGER,
          disembark_port_id INTEGER,
          port_ids VARCHAR(500),
          region_ids VARCHAR(500),
          market_id INTEGER,
          owner_id VARCHAR(50) DEFAULT 'system',
          no_fly BOOLEAN DEFAULT false,
          depart_uk BOOLEAN DEFAULT false,
          show_cruise BOOLEAN DEFAULT true,
          fly_cruise_info VARCHAR(50),
          last_cached INTEGER,
          cached_date TIMESTAMP,
          traveltek_file_path VARCHAR(500),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Add foreign key constraints
      console.log('   Adding foreign key constraints...');
      await client.query(`
        ALTER TABLE cruises_new
        ADD CONSTRAINT cruises_new_cruise_line_id_fkey 
          FOREIGN KEY (cruise_line_id) REFERENCES cruise_lines(id),
        ADD CONSTRAINT cruises_new_ship_id_fkey 
          FOREIGN KEY (ship_id) REFERENCES ships(id),
        ADD CONSTRAINT cruises_new_embark_port_id_fkey 
          FOREIGN KEY (embark_port_id) REFERENCES ports(id),
        ADD CONSTRAINT cruises_new_disembark_port_id_fkey 
          FOREIGN KEY (disembark_port_id) REFERENCES ports(id)
      `);
      
      // Migrate data
      console.log('\n   Migrating cruise data...');
      const insertResult = await client.query(`
        INSERT INTO cruises_new (
          id, cruise_id, cruise_line_id, ship_id, name,
          voyage_code, itinerary_code, sailing_date, start_date,
          nights, sail_nights, sea_days, embark_port_id, disembark_port_id,
          port_ids, region_ids, market_id, owner_id, no_fly, depart_uk,
          show_cruise, fly_cruise_info, last_cached, cached_date,
          traveltek_file_path, is_active, created_at, updated_at
        )
        SELECT DISTINCT ON (code_to_cruise_id)
          code_to_cruise_id::INTEGER as id,  -- code_to_cruise_id becomes primary key
          id as cruise_id,                    -- original id becomes cruise_id
          cruise_line_id, ship_id, name,
          voyage_code, itinerary_code, sailing_date, start_date,
          nights, sail_nights, sea_days, embark_port_id, disembark_port_id,
          port_ids, region_ids, market_id, owner_id, no_fly, depart_uk,
          show_cruise, fly_cruise_info, last_cached, cached_date,
          traveltek_file_path, is_active, created_at, updated_at
        FROM cruises
        WHERE code_to_cruise_id IS NOT NULL
        ORDER BY code_to_cruise_id, updated_at DESC NULLS LAST
      `);
      
      console.log(`   ✅ Migrated ${insertResult.rowCount} unique cruises`);
      
      // Create indexes
      console.log('\n   Creating indexes...');
      await client.query(`
        CREATE INDEX idx_cruises_new_cruise_id ON cruises_new(cruise_id);
        CREATE INDEX idx_cruises_new_sailing_date ON cruises_new(sailing_date);
        CREATE INDEX idx_cruises_new_cruise_line_id ON cruises_new(cruise_line_id);
        CREATE INDEX idx_cruises_new_ship_id ON cruises_new(ship_id);
        CREATE INDEX idx_cruises_new_voyage_code ON cruises_new(voyage_code);
        CREATE INDEX idx_cruises_new_is_active ON cruises_new(is_active);
      `);
      
      // Update foreign keys in related tables
      console.log('\n   Updating foreign key references...');
      
      // Create mapping table
      await client.query(`
        CREATE TEMP TABLE cruise_id_mapping AS
        SELECT 
          o.id as old_id,
          n.id as new_id,
          n.cruise_id,
          o.code_to_cruise_id
        FROM cruises o
        JOIN cruises_new n ON n.id = o.code_to_cruise_id::INTEGER
      `);
      
      // Update itineraries
      console.log('     Updating itineraries...');
      const itinerariesResult = await client.query(`
        UPDATE itineraries i
        SET cruise_id = m.new_id
        FROM cruise_id_mapping m
        WHERE i.cruise_id = m.old_id
      `);
      console.log(`       Updated ${itinerariesResult.rowCount} itinerary records`);
      
      // Update static_prices
      console.log('     Updating static_prices...');
      const staticPricesResult = await client.query(`
        UPDATE static_prices sp
        SET cruise_id = m.new_id
        FROM cruise_id_mapping m
        WHERE sp.cruise_id = m.old_id
      `);
      console.log(`       Updated ${staticPricesResult.rowCount} static_prices records`);
      
      // Update cached_prices
      console.log('     Updating cached_prices...');
      const cachedPricesResult = await client.query(`
        UPDATE cached_prices cp
        SET cruise_id = m.new_id
        FROM cruise_id_mapping m
        WHERE cp.cruise_id = m.old_id
      `);
      console.log(`       Updated ${cachedPricesResult.rowCount} cached_prices records`);
      
      // Update cheapest_prices
      console.log('     Updating cheapest_prices...');
      const cheapestPricesResult = await client.query(`
        UPDATE cheapest_prices cp
        SET cruise_id = m.new_id
        FROM cruise_id_mapping m
        WHERE cp.cruise_id = m.old_id
      `);
      console.log(`       Updated ${cheapestPricesResult.rowCount} cheapest_prices records`);
      
      // Update price_snapshots
      console.log('     Updating price_snapshots...');
      const priceSnapshotsResult = await client.query(`
        UPDATE price_snapshots ps
        SET cruise_id = m.new_id
        FROM cruise_id_mapping m
        WHERE ps.cruise_id = m.old_id
      `);
      console.log(`       Updated ${priceSnapshotsResult.rowCount} price_snapshots records`);
      
      // Swap tables
      console.log('\n   Swapping tables...');
      await client.query('ALTER TABLE cruises RENAME TO cruises_old');
      await client.query('ALTER TABLE cruises_new RENAME TO cruises');
      
      // Rename constraints
      await client.query(`
        ALTER TABLE cruises 
        RENAME CONSTRAINT cruises_new_cruise_line_id_fkey TO cruises_cruise_line_id_fkey;
        ALTER TABLE cruises 
        RENAME CONSTRAINT cruises_new_ship_id_fkey TO cruises_ship_id_fkey;
        ALTER TABLE cruises 
        RENAME CONSTRAINT cruises_new_embark_port_id_fkey TO cruises_embark_port_id_fkey;
        ALTER TABLE cruises 
        RENAME CONSTRAINT cruises_new_disembark_port_id_fkey TO cruises_disembark_port_id_fkey;
      `);
      
      // Commit transaction
      await client.query('COMMIT');
      console.log('\n✅ Migration completed successfully!');
      
      // Step 3: Verify migration
      console.log('\n📊 Step 3: Verifying migration...');
      
      const newStats = await client.query(`
        SELECT 
          COUNT(*) as total_cruises,
          COUNT(DISTINCT id) as unique_ids,
          COUNT(DISTINCT cruise_id) as unique_cruise_ids
        FROM cruises
      `);
      
      const newStatsData = newStats.rows[0];
      console.log(`   Total cruises: ${newStatsData.total_cruises}`);
      console.log(`   Unique IDs (code_to_cruise_id): ${newStatsData.unique_ids}`);
      console.log(`   Unique cruise_ids (for grouping): ${newStatsData.unique_cruise_ids}`);
      
      // Sample data
      const sample = await client.query(`
        SELECT cruise_id, COUNT(*) as sailings,
               array_agg(sailing_date ORDER BY sailing_date) as dates
        FROM cruises
        GROUP BY cruise_id
        HAVING COUNT(*) > 1
        LIMIT 3
      `);
      
      if (sample.rows.length > 0) {
        console.log('\n   Sample cruises with multiple sailings:');
        sample.rows.forEach(row => {
          console.log(`     Cruise ${row.cruise_id}: ${row.sailings} sailings`);
          if (row.dates && row.dates.length > 0) {
            row.dates.slice(0, 3).forEach(date => {
              console.log(`       - ${date}`);
            });
          }
        });
      }
      
      console.log('\n🎉 SUCCESS! The cruise table now uses the correct primary key.');
      console.log('   - Primary key (id) = code_to_cruise_id (unique per sailing)');
      console.log('   - cruise_id field = original cruiseid (for grouping similar cruises)');
      console.log('\n   You can now run sync operations without duplicate key errors!');
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('\n❌ Migration failed:', error.message);
      console.log('   Transaction rolled back. No changes were made.');
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
console.log('Starting cruise primary key migration...\n');
runMigration()
  .then(() => {
    console.log('\n✨ Migration completed successfully!');
    console.log('Next step: Run the new sync script:');
    console.log('  node scripts/sync-production-corrected-pk.js');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed:', error.message);
    process.exit(1);
  });