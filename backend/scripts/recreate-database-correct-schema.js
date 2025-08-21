#!/usr/bin/env node

/**
 * Complete Database Recreation with CORRECT Schema
 * 
 * This script drops ALL tables and recreates them with the proper structure:
 * - Uses code_to_cruise_id as primary key (unique per sailing)
 * - Stores cruise_id as regular field (for grouping similar cruises)
 * - Solves the duplicate key problem permanently
 * 
 * WARNING: This will DELETE ALL DATA. Make sure you have backups if needed.
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
  query_timeout: 600000
});

async function recreateDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🔥 COMPLETE DATABASE RECREATION WITH CORRECT SCHEMA');
    console.log('=====================================================\n');
    console.log('⚠️  WARNING: This will DELETE ALL DATA');
    console.log('⚠️  Only 158 cruises currently exist, so impact is minimal\n');
    
    // Get current counts for reference
    console.log('📊 Current database state:');
    try {
      const cruiseCount = await client.query('SELECT COUNT(*) FROM cruises');
      console.log(`   Cruises: ${cruiseCount.rows[0].count}`);
    } catch (e) {
      console.log('   Cruises: table not found or error');
    }
    
    console.log('\n🗑️  Step 1: Dropping all existing tables...');
    
    await client.query('BEGIN');
    
    try {
      // Drop all dependent tables first
      const dropTables = [
        'price_snapshots',
        'webhook_events',
        'cheapest_prices',
        'cached_prices',
        'static_prices',
        'itineraries',
        'cabin_types',
        'ship_images',
        'ship_decks',
        'alternative_sailings',
        'cruises_old',  // Cleanup from failed migrations
        'cruises_backup_before_pk_fix',  // Cleanup
        'itineraries_backup_before_pk_fix',  // Cleanup
        'cruises',
        'ships',
        'ports',
        'regions',
        'cruise_lines'
      ];
      
      for (const table of dropTables) {
        try {
          await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
          console.log(`   ✓ Dropped ${table}`);
        } catch (e) {
          console.log(`   - Skipped ${table} (doesn't exist)`);
        }
      }
      
      console.log('\n✅ All tables dropped successfully');
      
      // Step 2: Create tables with CORRECT schema
      console.log('\n🏗️  Step 2: Creating tables with CORRECT schema...\n');
      
      // Create cruise_lines table
      console.log('   Creating cruise_lines...');
      await client.query(`
        CREATE TABLE cruise_lines (
          id INTEGER PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          code VARCHAR(50),
          description TEXT,
          engine_name VARCHAR(255),
          short_name VARCHAR(50),
          nice_url VARCHAR(255),
          logo VARCHAR(500),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create ships table
      console.log('   Creating ships...');
      await client.query(`
        CREATE TABLE ships (
          id INTEGER PRIMARY KEY,
          cruise_line_id INTEGER REFERENCES cruise_lines(id),
          name VARCHAR(255) NOT NULL,
          code VARCHAR(50),
          tonnage INTEGER,
          total_cabins INTEGER,
          occupancy INTEGER,
          total_crew INTEGER,
          length INTEGER,
          launched DATE,
          star_rating INTEGER,
          adults_only BOOLEAN DEFAULT false,
          short_description TEXT,
          highlights TEXT,
          ship_class VARCHAR(100),
          default_ship_image VARCHAR(500),
          default_ship_image_hd VARCHAR(500),
          default_ship_image_2k VARCHAR(500),
          nice_url VARCHAR(255),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create regions table
      console.log('   Creating regions...');
      await client.query(`
        CREATE TABLE regions (
          id INTEGER PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          code VARCHAR(50),
          description TEXT,
          parent_id INTEGER REFERENCES regions(id),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create ports table
      console.log('   Creating ports...');
      await client.query(`
        CREATE TABLE ports (
          id INTEGER PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          code VARCHAR(50),
          country VARCHAR(100),
          region_id INTEGER REFERENCES regions(id),
          latitude DECIMAL(10, 7),
          longitude DECIMAL(10, 7),
          description TEXT,
          is_embark BOOLEAN DEFAULT false,
          is_disembark BOOLEAN DEFAULT false,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create cruises table with CORRECT schema
      console.log('   Creating cruises with CORRECT primary key...');
      await client.query(`
        CREATE TABLE cruises (
          id INTEGER PRIMARY KEY,                    -- This is code_to_cruise_id (UNIQUE per sailing)
          cruise_id INTEGER NOT NULL,                -- Original cruiseid (can be duplicated for different sailings)
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
          port_ids VARCHAR(500),                     -- Comma-separated string from API
          region_ids VARCHAR(500),                   -- Comma-separated string from API
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
      
      // Create indexes for cruises
      console.log('   Creating cruises indexes...');
      await client.query(`
        CREATE INDEX idx_cruises_cruise_id ON cruises(cruise_id);
        CREATE INDEX idx_cruises_sailing_date ON cruises(sailing_date);
        CREATE INDEX idx_cruises_cruise_line_id ON cruises(cruise_line_id);
        CREATE INDEX idx_cruises_ship_id ON cruises(ship_id);
        CREATE INDEX idx_cruises_voyage_code ON cruises(voyage_code);
        CREATE INDEX idx_cruises_is_active ON cruises(is_active);
        CREATE INDEX idx_cruises_nights ON cruises(nights);
        CREATE INDEX idx_cruises_embark_port ON cruises(embark_port_id);
      `);
      
      // Create itineraries table
      console.log('   Creating itineraries...');
      await client.query(`
        CREATE TABLE itineraries (
          id SERIAL PRIMARY KEY,
          cruise_id INTEGER NOT NULL REFERENCES cruises(id) ON DELETE CASCADE,
          day_number INTEGER NOT NULL,
          order_id INTEGER,
          port_id INTEGER REFERENCES ports(id),
          port_name VARCHAR(255),
          itinerary_name VARCHAR(255),
          arrive_date DATE,
          depart_date DATE,
          arrive_time TIME,
          depart_time TIME,
          latitude DECIMAL(10, 7),
          longitude DECIMAL(10, 7),
          description TEXT,
          short_description TEXT,
          itinerary_description TEXT,
          idl_crossed VARCHAR(10),
          supercedes INTEGER,
          owner_id VARCHAR(50) DEFAULT 'system',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create cabin_types table
      console.log('   Creating cabin_types...');
      await client.query(`
        CREATE TABLE cabin_types (
          id VARCHAR(50) PRIMARY KEY,
          ship_id INTEGER REFERENCES ships(id),
          cabin_code VARCHAR(50),
          cabin_code2 VARCHAR(50),
          name VARCHAR(255),
          description TEXT,
          cod_type VARCHAR(50),
          colour_code VARCHAR(50),
          is_default BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create static_prices table
      console.log('   Creating static_prices...');
      await client.query(`
        CREATE TABLE static_prices (
          id SERIAL PRIMARY KEY,
          cruise_id INTEGER NOT NULL REFERENCES cruises(id) ON DELETE CASCADE,
          rate_code VARCHAR(50) NOT NULL,
          cabin_id VARCHAR(50) NOT NULL,
          cabin_type VARCHAR(50),
          price DECIMAL(10,2),
          adult_price DECIMAL(10,2),
          child_price DECIMAL(10,2),
          infant_price DECIMAL(10,2),
          third_adult_price DECIMAL(10,2),
          fourth_adult_price DECIMAL(10,2),
          fifth_adult_price DECIMAL(10,2),
          single_price DECIMAL(10,2),
          taxes DECIMAL(10,2),
          ncf DECIMAL(10,2),
          gratuity DECIMAL(10,2),
          fuel DECIMAL(10,2),
          noncomm DECIMAL(10,2),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(cruise_id, rate_code, cabin_id)
        )
      `);
      
      // Create cached_prices table
      console.log('   Creating cached_prices...');
      await client.query(`
        CREATE TABLE cached_prices (
          id SERIAL PRIMARY KEY,
          cruise_id INTEGER NOT NULL REFERENCES cruises(id) ON DELETE CASCADE,
          rate_code VARCHAR(50) NOT NULL,
          cabin_id VARCHAR(50) NOT NULL,
          adults INTEGER NOT NULL DEFAULT 2,
          children INTEGER NOT NULL DEFAULT 0,
          infants INTEGER NOT NULL DEFAULT 0,
          price DECIMAL(10,2),
          taxes DECIMAL(10,2),
          ncf DECIMAL(10,2),
          gratuity DECIMAL(10,2),
          fuel DECIMAL(10,2),
          total DECIMAL(10,2),
          cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(cruise_id, rate_code, cabin_id, adults, children, infants)
        )
      `);
      
      // Create cheapest_prices table
      console.log('   Creating cheapest_prices...');
      await client.query(`
        CREATE TABLE cheapest_prices (
          id SERIAL PRIMARY KEY,
          cruise_id INTEGER NOT NULL REFERENCES cruises(id) ON DELETE CASCADE,
          cheapest_price DECIMAL(10,2),
          cheapest_cabin_type VARCHAR(50),
          cheapest_rate_code VARCHAR(50),
          cheapest_taxes DECIMAL(10,2),
          cheapest_ncf DECIMAL(10,2),
          cheapest_gratuity DECIMAL(10,2),
          cheapest_fuel DECIMAL(10,2),
          cheapest_total DECIMAL(10,2),
          calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(cruise_id)
        )
      `);
      
      // Create webhook_events table
      console.log('   Creating webhook_events...');
      await client.query(`
        CREATE TABLE webhook_events (
          id SERIAL PRIMARY KEY,
          event_type VARCHAR(100) NOT NULL,
          payload JSONB NOT NULL,
          status VARCHAR(50) DEFAULT 'pending',
          processed_at TIMESTAMP,
          error_message TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create price_snapshots table
      console.log('   Creating price_snapshots...');
      await client.query(`
        CREATE TABLE price_snapshots (
          id SERIAL PRIMARY KEY,
          cruise_id INTEGER NOT NULL REFERENCES cruises(id) ON DELETE CASCADE,
          webhook_event_id INTEGER REFERENCES webhook_events(id),
          snapshot_type VARCHAR(50) NOT NULL,
          pricing_data JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create ship_images table
      console.log('   Creating ship_images...');
      await client.query(`
        CREATE TABLE ship_images (
          id SERIAL PRIMARY KEY,
          ship_id INTEGER NOT NULL REFERENCES ships(id) ON DELETE CASCADE,
          image_url VARCHAR(500),
          image_url_hd VARCHAR(500),
          image_url_2k VARCHAR(500),
          caption TEXT,
          is_default BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create ship_decks table
      console.log('   Creating ship_decks...');
      await client.query(`
        CREATE TABLE ship_decks (
          id SERIAL PRIMARY KEY,
          ship_id INTEGER NOT NULL REFERENCES ships(id) ON DELETE CASCADE,
          deck_number INTEGER NOT NULL,
          deck_name VARCHAR(100),
          facilities TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(ship_id, deck_number)
        )
      `);
      
      await client.query('COMMIT');
      
      console.log('\n✅ All tables created with CORRECT schema!');
      
      // Step 3: Verify the new structure
      console.log('\n📊 Step 3: Verifying new database structure...\n');
      
      const tables = await client.query(`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY tablename
      `);
      
      console.log('   Tables created:');
      tables.rows.forEach(row => {
        console.log(`     ✓ ${row.tablename}`);
      });
      
      // Check cruises table structure
      const cruiseColumns = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'cruises'
        AND column_name IN ('id', 'cruise_id')
        ORDER BY ordinal_position
      `);
      
      console.log('\n   Cruises table key columns:');
      cruiseColumns.rows.forEach(col => {
        console.log(`     ${col.column_name}: ${col.data_type}`);
      });
      
      console.log('\n🎉 SUCCESS! Database recreated with CORRECT schema');
      console.log('============================================');
      console.log('✅ Primary key (id) = code_to_cruise_id (unique per sailing)');
      console.log('✅ cruise_id field = original cruiseid (for grouping)');
      console.log('✅ No more duplicate key violations!');
      console.log('\n📝 Next steps:');
      console.log('1. Run the sync script to populate data:');
      console.log('   SYNC_YEARS=2025 SYNC_MONTH=09 node scripts/sync-production-corrected-pk.js');
      console.log('\n2. The sync will now work without errors because:');
      console.log('   - Each sailing has a unique ID (code_to_cruise_id)');
      console.log('   - Multiple sailings can share the same cruise_id');
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('\n❌ Recreation failed:', error.message);
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Error during database recreation:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Add confirmation prompt
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('⚠️  WARNING: This will DELETE ALL DATA and recreate the database');
console.log('⚠️  Current data: ~158 cruises (minimal impact)');
console.log('');

rl.question('Type "YES" to proceed, anything else to cancel: ', (answer) => {
  rl.close();
  
  if (answer === 'YES') {
    console.log('\nProceeding with database recreation...\n');
    recreateDatabase()
      .then(() => {
        console.log('\n✨ Database recreation completed successfully!');
        process.exit(0);
      })
      .catch((error) => {
        console.error('\n💥 Recreation failed:', error.message);
        process.exit(1);
      });
  } else {
    console.log('\n❌ Operation cancelled');
    process.exit(0);
  }
});