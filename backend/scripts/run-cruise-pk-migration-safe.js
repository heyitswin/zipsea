#!/usr/bin/env node

/**
 * Safe Production Migration Script: Fix Cruise Primary Key
 * 
 * This version handles orphaned records in related tables
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
  ssl: { rejectUnauthorized: false },
  max: 1,
  connectionTimeoutMillis: 30000,
  query_timeout: 600000 // 10 minutes for large operations
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 SAFE CRUISE PRIMARY KEY MIGRATION');
    console.log('====================================\n');
    
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
    
    // Check for orphaned records
    console.log('\n🔍 Checking for orphaned records in related tables...');
    
    const orphanedItineraries = await client.query(`
      SELECT COUNT(DISTINCT i.cruise_id) as count
      FROM itineraries i
      LEFT JOIN cruises c ON c.id = i.cruise_id
      WHERE c.id IS NULL
    `);
    
    if (orphanedItineraries.rows[0].count > 0) {
      console.log(`   ⚠️ Found ${orphanedItineraries.rows[0].count} orphaned cruise IDs in itineraries`);
    }
    
    const orphanedStaticPrices = await client.query(`
      SELECT COUNT(DISTINCT sp.cruise_id) as count
      FROM static_prices sp
      LEFT JOIN cruises c ON c.id = sp.cruise_id
      WHERE c.id IS NULL
    `);
    
    if (orphanedStaticPrices.rows[0].count > 0) {
      console.log(`   ⚠️ Found ${orphanedStaticPrices.rows[0].count} orphaned cruise IDs in static_prices`);
    }
    
    // Step 2: Begin migration
    console.log('\n🔄 Step 2: Starting SAFE migration...');
    console.log('   This handles orphaned records automatically.\n');
    
    await client.query('BEGIN');
    
    try {
      // Create backup table
      console.log('   Creating backup tables...');
      await client.query('DROP TABLE IF EXISTS cruises_backup_before_pk_fix');
      await client.query('CREATE TABLE cruises_backup_before_pk_fix AS SELECT * FROM cruises');
      
      await client.query('DROP TABLE IF EXISTS itineraries_backup_before_pk_fix');
      await client.query('CREATE TABLE itineraries_backup_before_pk_fix AS SELECT * FROM itineraries');
      
      const backupCount = await client.query('SELECT COUNT(*) FROM cruises_backup_before_pk_fix');
      console.log(`   ✅ Backed up ${backupCount.rows[0].count} cruise records`);
      
      // Clean up orphaned records FIRST
      console.log('\n   Cleaning orphaned records...');
      
      const deletedItineraries = await client.query(`
        DELETE FROM itineraries
        WHERE cruise_id NOT IN (SELECT id FROM cruises)
      `);
      console.log(`     Removed ${deletedItineraries.rowCount} orphaned itinerary records`);
      
      const deletedStaticPrices = await client.query(`
        DELETE FROM static_prices
        WHERE cruise_id NOT IN (SELECT id FROM cruises)
      `);
      console.log(`     Removed ${deletedStaticPrices.rowCount} orphaned static_prices records`);
      
      const deletedCachedPrices = await client.query(`
        DELETE FROM cached_prices
        WHERE cruise_id NOT IN (SELECT id FROM cruises)
      `);
      console.log(`     Removed ${deletedCachedPrices.rowCount} orphaned cached_prices records`);
      
      const deletedCheapestPrices = await client.query(`
        DELETE FROM cheapest_prices
        WHERE cruise_id NOT IN (SELECT id FROM cruises)
      `);
      console.log(`     Removed ${deletedCheapestPrices.rowCount} orphaned cheapest_prices records`);
      
      const deletedPriceSnapshots = await client.query(`
        DELETE FROM price_snapshots
        WHERE cruise_id NOT IN (SELECT id FROM cruises)
      `);
      console.log(`     Removed ${deletedPriceSnapshots.rowCount} orphaned price_snapshots records`);
      
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
          code_to_cruise_id as id,  -- code_to_cruise_id becomes primary key
          id as cruise_id,           -- original id becomes cruise_id
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
      
      // Create mapping table for updates
      console.log('\n   Creating ID mapping...');
      await client.query(`
        CREATE TEMP TABLE cruise_id_mapping AS
        SELECT 
          o.id as old_id,
          o.code_to_cruise_id as code_to_cruise_id,
          n.id as new_id,
          n.cruise_id
        FROM cruises o
        JOIN cruises_new n ON n.id = o.code_to_cruise_id
      `);
      
      const mappingCount = await client.query('SELECT COUNT(*) FROM cruise_id_mapping');
      console.log(`   Created mapping for ${mappingCount.rows[0].count} cruises`);
      
      // Update foreign keys in related tables
      console.log('\n   Updating foreign key references...');
      
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
      
      // Drop foreign key constraints before swap
      console.log('\n   Preparing for table swap...');
      await client.query(`
        ALTER TABLE itineraries DROP CONSTRAINT IF EXISTS itineraries_cruise_id_fkey;
        ALTER TABLE static_prices DROP CONSTRAINT IF EXISTS static_prices_cruise_id_fkey;
        ALTER TABLE cached_prices DROP CONSTRAINT IF EXISTS cached_prices_cruise_id_fkey;
        ALTER TABLE cheapest_prices DROP CONSTRAINT IF EXISTS cheapest_prices_cruise_id_fkey;
        ALTER TABLE price_snapshots DROP CONSTRAINT IF EXISTS price_snapshots_cruise_id_fkey;
      `);
      
      // Swap tables
      console.log('   Swapping tables...');
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
      
      // Re-add foreign key constraints
      console.log('   Re-adding foreign key constraints...');
      await client.query(`
        ALTER TABLE itineraries 
        ADD CONSTRAINT itineraries_cruise_id_fkey 
        FOREIGN KEY (cruise_id) REFERENCES cruises(id);
        
        ALTER TABLE static_prices 
        ADD CONSTRAINT static_prices_cruise_id_fkey 
        FOREIGN KEY (cruise_id) REFERENCES cruises(id);
        
        ALTER TABLE cached_prices 
        ADD CONSTRAINT cached_prices_cruise_id_fkey 
        FOREIGN KEY (cruise_id) REFERENCES cruises(id);
        
        ALTER TABLE cheapest_prices 
        ADD CONSTRAINT cheapest_prices_cruise_id_fkey 
        FOREIGN KEY (cruise_id) REFERENCES cruises(id);
        
        ALTER TABLE price_snapshots 
        ADD CONSTRAINT price_snapshots_cruise_id_fkey 
        FOREIGN KEY (cruise_id) REFERENCES cruises(id);
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
      
      // Check for any remaining orphans
      const finalOrphans = await client.query(`
        SELECT 
          (SELECT COUNT(*) FROM itineraries i WHERE NOT EXISTS (SELECT 1 FROM cruises c WHERE c.id = i.cruise_id)) as orphan_itineraries,
          (SELECT COUNT(*) FROM static_prices sp WHERE NOT EXISTS (SELECT 1 FROM cruises c WHERE c.id = sp.cruise_id)) as orphan_prices
      `);
      
      const orphans = finalOrphans.rows[0];
      console.log(`\n   Orphaned records check:`);
      console.log(`     Itineraries: ${orphans.orphan_itineraries}`);
      console.log(`     Static prices: ${orphans.orphan_prices}`);
      
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
        });
      }
      
      console.log('\n🎉 SUCCESS! The cruise table now uses the correct primary key.');
      console.log('   - Primary key (id) = code_to_cruise_id (unique per sailing)');
      console.log('   - cruise_id field = original cruiseid (for grouping similar cruises)');
      console.log('\n   You can now run sync operations without duplicate key errors!');
      console.log('   Use: node scripts/sync-production-corrected-pk.js');
      
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
console.log('Starting SAFE cruise primary key migration...\n');
runMigration()
  .then(() => {
    console.log('\n✨ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed:', error.message);
    process.exit(1);
  });