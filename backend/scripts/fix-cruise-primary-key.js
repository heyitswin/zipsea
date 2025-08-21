#!/usr/bin/env node

/**
 * Fix cruise table primary key issue
 * 
 * Problem: We're using cruiseid as primary key, but it's not unique across sailings
 * Solution: Use code_to_cruise_id as the unique identifier for each sailing
 * 
 * This script will:
 * 1. Create a new table structure with proper keys
 * 2. Migrate existing data
 * 3. Update foreign key references
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

async function fixCruisePrimaryKey() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Fixing Cruise Primary Key Issue');
    console.log('=====================================\n');
    
    // Start transaction
    await client.query('BEGIN');
    
    // Check current structure
    const cruiseCount = await client.query('SELECT COUNT(*) FROM cruises');
    console.log(`📊 Current cruises: ${cruiseCount.rows[0].count}`);
    
    // Check for duplicate cruise IDs
    const duplicates = await client.query(`
      SELECT id, COUNT(*) as count
      FROM cruises
      GROUP BY id
      HAVING COUNT(*) > 1
    `);
    
    if (duplicates.rows.length > 0) {
      console.log(`⚠️ Found ${duplicates.rows.length} duplicate cruise IDs`);
      duplicates.rows.forEach(row => {
        console.log(`  - Cruise ID ${row.id}: ${row.count} occurrences`);
      });
    }
    
    // Step 1: Rename old table
    console.log('\n1️⃣ Backing up existing cruises table...');
    await client.query('ALTER TABLE cruises RENAME TO cruises_old');
    
    // Step 2: Create new cruises table with correct structure
    console.log('2️⃣ Creating new cruises table with correct primary key...');
    await client.query(`
      CREATE TABLE cruises (
        id SERIAL PRIMARY KEY, -- Auto-increment ID
        cruise_id INTEGER NOT NULL, -- The cruiseid from Traveltek (not unique)
        code_to_cruise_id INTEGER NOT NULL UNIQUE, -- Unique identifier for each sailing
        cruise_line_id INTEGER NOT NULL REFERENCES cruise_lines(id),
        ship_id INTEGER NOT NULL REFERENCES ships(id),
        name VARCHAR(255),
        voyage_code VARCHAR(50),
        itinerary_code VARCHAR(50),
        sailing_date DATE NOT NULL,
        start_date DATE,
        nights INTEGER,
        sail_nights INTEGER,
        sea_days INTEGER,
        embark_port_id INTEGER REFERENCES ports(id),
        disembark_port_id INTEGER REFERENCES ports(id),
        port_ids VARCHAR(500),
        region_ids VARCHAR(500),
        market_id INTEGER,
        owner_id VARCHAR(50),
        no_fly BOOLEAN DEFAULT false,
        depart_uk BOOLEAN DEFAULT false,
        show_cruise BOOLEAN DEFAULT true,
        fly_cruise_info TEXT,
        last_cached BIGINT,
        cached_date TIMESTAMP,
        traveltek_file_path VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Step 3: Create indexes
    console.log('3️⃣ Creating indexes...');
    await client.query(`
      CREATE INDEX idx_cruises_cruise_id ON cruises(cruise_id);
      CREATE INDEX idx_cruises_code_to_cruise_id ON cruises(code_to_cruise_id);
      CREATE INDEX idx_cruises_sailing_date ON cruises(sailing_date);
      CREATE INDEX idx_cruises_cruise_line_id ON cruises(cruise_line_id);
      CREATE INDEX idx_cruises_ship_id ON cruises(ship_id);
      CREATE INDEX idx_cruises_voyage_code ON cruises(voyage_code);
    `);
    
    // Step 4: Migrate data from old table
    console.log('4️⃣ Migrating data from old table...');
    await client.query(`
      INSERT INTO cruises (
        cruise_id, code_to_cruise_id, cruise_line_id, ship_id, name,
        voyage_code, itinerary_code, sailing_date, start_date,
        nights, sail_nights, sea_days, embark_port_id, disembark_port_id,
        port_ids, region_ids, market_id, owner_id, no_fly, depart_uk,
        show_cruise, fly_cruise_info, last_cached, cached_date,
        traveltek_file_path, created_at, updated_at
      )
      SELECT 
        id as cruise_id, -- Map old id to cruise_id
        code_to_cruise_id,
        cruise_line_id,
        ship_id,
        name,
        voyage_code,
        itinerary_code,
        sailing_date,
        start_date,
        nights,
        sail_nights,
        sea_days,
        embark_port_id,
        disembark_port_id,
        port_ids,
        region_ids,
        market_id,
        owner_id,
        no_fly,
        depart_uk,
        show_cruise,
        fly_cruise_info,
        last_cached,
        cached_date,
        traveltek_file_path,
        created_at,
        updated_at
      FROM cruises_old
      ON CONFLICT (code_to_cruise_id) DO NOTHING
    `);
    
    const migrated = await client.query('SELECT COUNT(*) FROM cruises');
    console.log(`✅ Migrated ${migrated.rows[0].count} cruises`);
    
    // Step 5: Update foreign key references
    console.log('5️⃣ Updating foreign key references...');
    
    // First, we need to map old cruise IDs to new IDs
    await client.query(`
      CREATE TEMP TABLE cruise_id_mapping AS
      SELECT 
        co.id as old_id,
        c.id as new_id,
        c.code_to_cruise_id
      FROM cruises_old co
      JOIN cruises c ON c.code_to_cruise_id = co.code_to_cruise_id
    `);
    
    // Update itineraries
    console.log('   Updating itineraries...');
    await client.query(`
      UPDATE itineraries i
      SET cruise_id = m.new_id
      FROM cruise_id_mapping m
      WHERE i.cruise_id = m.old_id
    `);
    
    // Update static_prices
    console.log('   Updating static_prices...');
    await client.query(`
      UPDATE static_prices sp
      SET cruise_id = m.new_id
      FROM cruise_id_mapping m
      WHERE sp.cruise_id = m.old_id
    `);
    
    // Update cached_prices
    console.log('   Updating cached_prices...');
    await client.query(`
      UPDATE cached_prices cp
      SET cruise_id = m.new_id
      FROM cruise_id_mapping m
      WHERE cp.cruise_id = m.old_id
    `);
    
    // Update cheapest_prices
    console.log('   Updating cheapest_prices...');
    await client.query(`
      UPDATE cheapest_prices cp
      SET cruise_id = m.new_id
      FROM cruise_id_mapping m
      WHERE cp.cruise_id = m.old_id
    `);
    
    // Update price_snapshots
    console.log('   Updating price_snapshots...');
    await client.query(`
      UPDATE price_snapshots ps
      SET cruise_id = m.new_id
      FROM cruise_id_mapping m
      WHERE ps.cruise_id = m.old_id
    `);
    
    // Step 6: Drop old table
    console.log('6️⃣ Cleaning up old table...');
    await client.query('DROP TABLE cruises_old CASCADE');
    
    // Commit transaction
    await client.query('COMMIT');
    
    // Show final stats
    const finalCount = await client.query('SELECT COUNT(*) FROM cruises');
    const uniqueCruiseIds = await client.query('SELECT COUNT(DISTINCT cruise_id) FROM cruises');
    const uniqueCodeToIds = await client.query('SELECT COUNT(DISTINCT code_to_cruise_id) FROM cruises');
    
    console.log('\n✅ Migration Complete!');
    console.log('======================');
    console.log(`Total sailings: ${finalCount.rows[0].count}`);
    console.log(`Unique cruise IDs: ${uniqueCruiseIds.rows[0].count}`);
    console.log(`Unique code_to_cruise IDs: ${uniqueCodeToIds.rows[0].count}`);
    
    // Show sample of cruises with same ID but different dates
    const sampleDupes = await client.query(`
      SELECT cruise_id, COUNT(*) as sailings, 
             array_agg(DISTINCT sailing_date ORDER BY sailing_date) as dates
      FROM cruises
      GROUP BY cruise_id
      HAVING COUNT(*) > 1
      LIMIT 5
    `);
    
    if (sampleDupes.rows.length > 0) {
      console.log('\n📅 Sample cruises with multiple sailings:');
      sampleDupes.rows.forEach(row => {
        console.log(`  Cruise ${row.cruise_id}: ${row.sailings} sailings`);
        row.dates.forEach(date => {
          console.log(`    - ${date}`);
        });
      });
    }
    
  } catch (error) {
    console.error('❌ Error fixing cruise primary key:', error.message);
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the fix
fixCruisePrimaryKey()
  .then(() => {
    console.log('\n🎉 Primary key fix completed successfully!');
    console.log('Now users can search for all cruises with the same ship/itinerary but different dates.');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Failed to fix primary key:', error);
    process.exit(1);
  });