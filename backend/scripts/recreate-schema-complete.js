#!/usr/bin/env node

/**
 * Complete database schema recreation to match Traveltek API structure
 * Based on official API documentation
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

async function recreateSchema() {
  const client = await pool.connect();
  
  try {
    console.log('🔨 Creating Complete Database Schema for Traveltek API');
    console.log('=====================================================\n');
    
    // Drop all tables first for clean slate
    console.log('🗑️ Dropping existing tables...');
    await client.query(`
      DROP TABLE IF EXISTS price_snapshots CASCADE;
      DROP TABLE IF EXISTS webhook_events CASCADE;
      DROP TABLE IF EXISTS cached_prices CASCADE;
      DROP TABLE IF EXISTS static_prices CASCADE;
      DROP TABLE IF EXISTS cheapest_prices CASCADE;
      DROP TABLE IF EXISTS cabin_types CASCADE;
      DROP TABLE IF EXISTS ship_decks CASCADE;
      DROP TABLE IF EXISTS ship_images CASCADE;
      DROP TABLE IF EXISTS itineraries CASCADE;
      DROP TABLE IF EXISTS alternative_sailings CASCADE;
      DROP TABLE IF EXISTS cruises CASCADE;
      DROP TABLE IF EXISTS ships CASCADE;
      DROP TABLE IF EXISTS cruise_lines CASCADE;
      DROP TABLE IF EXISTS ports CASCADE;
      DROP TABLE IF EXISTS regions CASCADE;
    `);
    
    // Create cruise_lines table
    console.log('Creating cruise_lines table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS cruise_lines (
        id INTEGER PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50),
        shortname VARCHAR(100),
        description TEXT,
        enginename VARCHAR(100), -- Internal Traveltek engine name
        logo_url VARCHAR(500),
        niceurl VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create ships table with all Traveltek fields
    console.log('Creating ships table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS ships (
        id INTEGER PRIMARY KEY,
        cruise_line_id INTEGER NOT NULL REFERENCES cruise_lines(id),
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50),
        niceurl VARCHAR(255),
        occupancy INTEGER, -- Maximum occupancy from API
        length INTEGER, -- Ship length in feet
        ship_class VARCHAR(100), -- Usually null per docs
        total_cabins INTEGER,
        tonnage INTEGER,
        total_crew INTEGER,
        star_rating INTEGER,
        adults_only BOOLEAN DEFAULT false,
        short_description TEXT,
        highlights TEXT, -- Usually null per docs
        launched DATE,
        default_image VARCHAR(500),
        default_image_hd VARCHAR(500),
        default_image_2k VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create ship_images table
    console.log('Creating ship_images table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS ship_images (
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
    console.log('Creating ship_decks table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS ship_decks (
        id INTEGER PRIMARY KEY,
        ship_id INTEGER NOT NULL REFERENCES ships(id) ON DELETE CASCADE,
        deck_name VARCHAR(100),
        description TEXT,
        live_name VARCHAR(100), -- Name from cruise line API
        plan_image VARCHAR(500),
        deck_plan_id INTEGER,
        valid_from DATE,
        valid_to DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create ports table
    console.log('Creating ports table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS ports (
        id INTEGER PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50),
        city VARCHAR(255),
        state VARCHAR(100),
        country VARCHAR(100),
        country_code VARCHAR(2),
        latitude DECIMAL(10,8),
        longitude DECIMAL(11,8),
        timezone VARCHAR(50),
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create regions table
    console.log('Creating regions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS regions (
        id INTEGER PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create cruises table with all Traveltek fields
    console.log('Creating cruises table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS cruises (
        id INTEGER PRIMARY KEY, -- cruiseid from API
        code_to_cruise_id INTEGER NOT NULL, -- Used in file path
        cruise_line_id INTEGER NOT NULL REFERENCES cruise_lines(id),
        ship_id INTEGER NOT NULL REFERENCES ships(id),
        name VARCHAR(255), -- Cruise name
        voyage_code VARCHAR(50), -- Cruise line's voyage identifier
        itinerary_code VARCHAR(50), -- Alternative itinerary identifier
        sailing_date DATE NOT NULL, -- saildate
        start_date DATE, -- startdate
        nights INTEGER, -- Number of nights
        sail_nights INTEGER, -- Sailing nights
        sea_days INTEGER, -- Days at sea
        embark_port_id INTEGER REFERENCES ports(id), -- startportid
        disembark_port_id INTEGER REFERENCES ports(id), -- endportid
        port_ids VARCHAR(500), -- Comma-separated string per API
        region_ids VARCHAR(500), -- Comma-separated string per API
        market_id INTEGER,
        owner_id VARCHAR(50) DEFAULT 'system',
        no_fly BOOLEAN DEFAULT false,
        depart_uk BOOLEAN DEFAULT false,
        show_cruise BOOLEAN DEFAULT true,
        fly_cruise_info VARCHAR(50), -- type1, type2, type3, or null
        
        -- Cached data info
        last_cached INTEGER, -- Unix timestamp
        cached_date TIMESTAMP,
        
        -- Metadata
        traveltek_file_path VARCHAR(500),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(code_to_cruise_id)
      )
    `);
    
    // Create itineraries table
    console.log('Creating itineraries table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS itineraries (
        id SERIAL PRIMARY KEY,
        cruise_id INTEGER NOT NULL REFERENCES cruises(id) ON DELETE CASCADE,
        day_number INTEGER NOT NULL,
        order_id INTEGER,
        port_id INTEGER REFERENCES ports(id),
        port_name VARCHAR(255), -- name field from API
        itinerary_name VARCHAR(255), -- itineraryname field
        arrive_date DATE,
        depart_date DATE,
        arrive_time TIME,
        depart_time TIME,
        latitude DECIMAL(10,8),
        longitude DECIMAL(11,8),
        description TEXT,
        short_description TEXT,
        itinerary_description TEXT,
        idl_crossed VARCHAR(20), -- westbound/eastbound/null
        supercedes INTEGER,
        owner_id VARCHAR(50) DEFAULT 'system',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create cabin_types table (from cabins object in API)
    console.log('Creating cabin_types table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS cabin_types (
        id VARCHAR(50) PRIMARY KEY, -- cabin id from API (string)
        ship_id INTEGER NOT NULL REFERENCES ships(id),
        cabin_code VARCHAR(10) NOT NULL,
        cabin_code2 VARCHAR(250), -- Alternative code
        name VARCHAR(255),
        description TEXT,
        cod_type VARCHAR(50), -- inside/outside/balcony/suite
        colour_code VARCHAR(7), -- Hex color
        is_default BOOLEAN DEFAULT false,
        image_url VARCHAR(500),
        image_url_hd VARCHAR(500),
        image_url_2k VARCHAR(500),
        valid_from DATE,
        valid_to DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(ship_id, cabin_code)
      )
    `);
    
    // Create static_prices table (from prices object)
    console.log('Creating static_prices table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS static_prices (
        id SERIAL PRIMARY KEY,
        cruise_id INTEGER NOT NULL REFERENCES cruises(id) ON DELETE CASCADE,
        rate_code VARCHAR(50) NOT NULL,
        cabin_id VARCHAR(50) NOT NULL,
        cabin_type VARCHAR(50), -- inside/outside/balcony/suite
        
        -- Pricing fields
        price DECIMAL(10,2), -- Base price for 2 adults
        adult_price DECIMAL(10,2),
        child_price DECIMAL(10,2),
        infant_price DECIMAL(10,2),
        third_adult_price DECIMAL(10,2),
        fourth_adult_price DECIMAL(10,2),
        fifth_adult_price DECIMAL(10,2),
        single_price DECIMAL(10,2),
        
        -- Additional fees
        taxes DECIMAL(10,2),
        ncf DECIMAL(10,2), -- Non-commissionable fare
        gratuity DECIMAL(10,2),
        fuel DECIMAL(10,2),
        noncomm DECIMAL(10,2),
        
        currency VARCHAR(3) DEFAULT 'USD',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(cruise_id, rate_code, cabin_id)
      )
    `);
    
    // Create cached_prices table (from cachedprices object)
    console.log('Creating cached_prices table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS cached_prices (
        id SERIAL PRIMARY KEY,
        cruise_id INTEGER NOT NULL REFERENCES cruises(id) ON DELETE CASCADE,
        rate_code VARCHAR(50) NOT NULL,
        cabin_id VARCHAR(50) NOT NULL,
        cabin_code VARCHAR(10),
        
        -- Pricing
        price DECIMAL(10,2), -- Total price
        taxes DECIMAL(10,2),
        ncf DECIMAL(10,2),
        fees DECIMAL(10,2),
        
        -- Occupancy
        adults INTEGER,
        children INTEGER,
        infants INTEGER,
        
        -- Additional info
        currency VARCHAR(3),
        fare_type VARCHAR(20), -- gross/net
        onboard_credit DECIMAL(10,2),
        obc_currency VARCHAR(3),
        
        cached_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(cruise_id, rate_code, cabin_id, adults, children, infants)
      )
    `);
    
    // Create cheapest_prices table (aggregated cheapest prices)
    console.log('Creating cheapest_prices table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS cheapest_prices (
        id SERIAL PRIMARY KEY,
        cruise_id INTEGER NOT NULL REFERENCES cruises(id) ON DELETE CASCADE,
        
        -- Static prices cheapest
        static_inside DECIMAL(10,2),
        static_inside_code VARCHAR(50),
        static_outside DECIMAL(10,2),
        static_outside_code VARCHAR(50),
        static_balcony DECIMAL(10,2),
        static_balcony_code VARCHAR(50),
        static_suite DECIMAL(10,2),
        static_suite_code VARCHAR(50),
        
        -- Cached prices cheapest
        cached_inside DECIMAL(10,2),
        cached_inside_code VARCHAR(50),
        cached_outside DECIMAL(10,2),
        cached_outside_code VARCHAR(50),
        cached_balcony DECIMAL(10,2),
        cached_balcony_code VARCHAR(50),
        cached_suite DECIMAL(10,2),
        cached_suite_code VARCHAR(50),
        
        -- Combined cheapest (best of both)
        combined_inside DECIMAL(10,2),
        combined_inside_code VARCHAR(50),
        combined_inside_source VARCHAR(20), -- 'prices' or 'cachedprices'
        combined_outside DECIMAL(10,2),
        combined_outside_code VARCHAR(50),
        combined_outside_source VARCHAR(20),
        combined_balcony DECIMAL(10,2),
        combined_balcony_code VARCHAR(50),
        combined_balcony_source VARCHAR(20),
        combined_suite DECIMAL(10,2),
        combined_suite_code VARCHAR(50),
        combined_suite_source VARCHAR(20),
        
        -- Legacy fields for compatibility
        cheapest_price DECIMAL(10,2), -- Overall cheapest
        cheapest_cabin_type VARCHAR(50),
        
        currency VARCHAR(3) DEFAULT 'USD',
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(cruise_id)
      )
    `);
    
    // Create alternative_sailings table
    console.log('Creating alternative_sailings table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS alternative_sailings (
        id SERIAL PRIMARY KEY,
        cruise_id INTEGER NOT NULL REFERENCES cruises(id) ON DELETE CASCADE,
        alt_cruise_code_to_id INTEGER NOT NULL,
        sail_date DATE,
        start_date DATE,
        ship_id INTEGER,
        voyage_code VARCHAR(50),
        lead_price DECIMAL(10,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(cruise_id, alt_cruise_code_to_id)
      )
    `);
    
    // Create webhook_events table for tracking
    console.log('Creating webhook_events table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS webhook_events (
        id SERIAL PRIMARY KEY,
        event_type VARCHAR(50) NOT NULL, -- cruiseline_pricing_updated or cruises_live_pricing_updated
        line_id INTEGER,
        market_id INTEGER,
        currency VARCHAR(3),
        paths TEXT[], -- Array of FTP paths for live pricing updates
        description TEXT,
        source VARCHAR(50),
        timestamp INTEGER, -- Unix timestamp from webhook
        processed BOOLEAN DEFAULT false,
        processed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create price_snapshots table for history
    console.log('Creating price_snapshots table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS price_snapshots (
        id SERIAL PRIMARY KEY,
        cruise_id INTEGER NOT NULL REFERENCES cruises(id) ON DELETE CASCADE,
        snapshot_type VARCHAR(20) NOT NULL, -- 'before_update' or 'after_update'
        webhook_event_id INTEGER REFERENCES webhook_events(id),
        
        -- Snapshot of cheapest prices
        cheapest_price DECIMAL(10,2),
        inside_price DECIMAL(10,2),
        outside_price DECIMAL(10,2),
        balcony_price DECIMAL(10,2),
        suite_price DECIMAL(10,2),
        
        -- Full pricing data as JSONB
        static_prices_data JSONB,
        cached_prices_data JSONB,
        cheapest_data JSONB,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create indexes
    console.log('\nCreating indexes...');
    await client.query(`
      -- Cruise indexes
      CREATE INDEX IF NOT EXISTS idx_cruises_sailing_date ON cruises(sailing_date);
      CREATE INDEX IF NOT EXISTS idx_cruises_cruise_line_id ON cruises(cruise_line_id);
      CREATE INDEX IF NOT EXISTS idx_cruises_ship_id ON cruises(ship_id);
      CREATE INDEX IF NOT EXISTS idx_cruises_nights ON cruises(nights);
      CREATE INDEX IF NOT EXISTS idx_cruises_code_to_cruise_id ON cruises(code_to_cruise_id);
      CREATE INDEX IF NOT EXISTS idx_cruises_voyage_code ON cruises(voyage_code);
      
      -- Ship indexes
      CREATE INDEX IF NOT EXISTS idx_ships_cruise_line_id ON ships(cruise_line_id);
      
      -- Pricing indexes
      CREATE INDEX IF NOT EXISTS idx_static_prices_cruise_id ON static_prices(cruise_id);
      CREATE INDEX IF NOT EXISTS idx_cached_prices_cruise_id ON cached_prices(cruise_id);
      CREATE INDEX IF NOT EXISTS idx_cheapest_prices_cruise_id ON cheapest_prices(cruise_id);
      
      -- Itinerary indexes
      CREATE INDEX IF NOT EXISTS idx_itineraries_cruise_id ON itineraries(cruise_id);
      CREATE INDEX IF NOT EXISTS idx_itineraries_port_id ON itineraries(port_id);
      
      -- Webhook indexes
      CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed);
      CREATE INDEX IF NOT EXISTS idx_webhook_events_timestamp ON webhook_events(timestamp);
      
      -- Price snapshot indexes
      CREATE INDEX IF NOT EXISTS idx_price_snapshots_cruise_id ON price_snapshots(cruise_id);
      CREATE INDEX IF NOT EXISTS idx_price_snapshots_webhook_event_id ON price_snapshots(webhook_event_id);
    `);
    
    console.log('\n✅ Schema created successfully!\n');
    
    // Show table counts
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log('📊 Created tables:');
    for (const table of tables.rows) {
      console.log(`   ✓ ${table.table_name}`);
    }
    
  } catch (error) {
    console.error('❌ Error creating schema:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the schema creation
recreateSchema()
  .then(() => {
    console.log('\n✅ Database schema ready for Traveltek data sync!');
    console.log('\nNext steps:');
    console.log('1. Run the comprehensive sync script: node scripts/sync-complete-traveltek.js');
    console.log('2. Configure webhooks in iSell platform');
    console.log('3. Test webhook endpoint: curl -X POST http://your-domain/api/webhook/traveltek');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Failed to create schema:', error);
    process.exit(1);
  });