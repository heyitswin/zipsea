#!/usr/bin/env node

/**
 * Recreate database schema from scratch
 * This creates all tables with proper structure
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
    console.log('🔨 Creating Database Schema');
    console.log('============================\n');
    
    // Create cruise_lines table
    console.log('Creating cruise_lines table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS cruise_lines (
        id INTEGER PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50),
        logo_url VARCHAR(500),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create ships table
    console.log('Creating ships table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS ships (
        id INTEGER PRIMARY KEY,
        cruise_line_id INTEGER NOT NULL REFERENCES cruise_lines(id),
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50),
        capacity INTEGER,
        tonnage INTEGER,
        total_cabins INTEGER,
        ship_class VARCHAR(100),
        rating INTEGER,
        images JSONB DEFAULT '[]'::jsonb,
        amenities TEXT[],
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        region VARCHAR(100),
        latitude DECIMAL(10,8),
        longitude DECIMAL(11,8),
        timezone VARCHAR(50),
        description TEXT,
        image_url VARCHAR(500),
        images JSONB DEFAULT '[]'::jsonb,
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
        parent_region_id INTEGER REFERENCES regions(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create cruises table
    console.log('Creating cruises table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS cruises (
        id INTEGER PRIMARY KEY,
        code_to_cruise_id VARCHAR(50),
        cruise_line_id INTEGER NOT NULL REFERENCES cruise_lines(id),
        ship_id INTEGER NOT NULL REFERENCES ships(id),
        name VARCHAR(255),
        itinerary_code VARCHAR(50),
        voyage_code VARCHAR(50),
        sailing_date DATE NOT NULL,
        return_date DATE,
        nights INTEGER,
        duration_nights INTEGER,
        duration_days INTEGER,
        sail_nights INTEGER,
        sea_days INTEGER,
        embark_port_id INTEGER REFERENCES ports(id),
        disembark_port_id INTEGER REFERENCES ports(id),
        region VARCHAR(255),
        sub_region VARCHAR(255),
        region_ids JSONB DEFAULT '[]'::jsonb,
        port_ids JSONB DEFAULT '[]'::jsonb,
        market_id INTEGER,
        owner_id INTEGER,
        no_fly BOOLEAN DEFAULT false,
        depart_uk BOOLEAN DEFAULT false,
        show_cruise BOOLEAN DEFAULT true,
        fly_cruise_info TEXT,
        line_content TEXT,
        traveltek_file_path VARCHAR(500),
        last_cached TIMESTAMP,
        cached_date DATE,
        currency VARCHAR(3) DEFAULT 'USD',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create itineraries table
    console.log('Creating itineraries table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS itineraries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cruise_id INTEGER NOT NULL REFERENCES cruises(id) ON DELETE CASCADE,
        day_number INTEGER NOT NULL,
        date DATE,
        port_name VARCHAR(255),
        port_id INTEGER REFERENCES ports(id),
        arrival_time TIME,
        departure_time TIME,
        status VARCHAR(20),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create cabin_categories table
    console.log('Creating cabin_categories table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS cabin_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ship_id INTEGER NOT NULL REFERENCES ships(id),
        code VARCHAR(10) NOT NULL,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(50),
        description TEXT,
        color_code VARCHAR(7),
        image_url VARCHAR(500),
        image_url_hd VARCHAR(500),
        is_default BOOLEAN DEFAULT false,
        max_occupancy INTEGER,
        amenities JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(ship_id, code)
      )
    `);
    
    // Create pricing table
    console.log('Creating pricing table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS pricing (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cruise_id INTEGER NOT NULL REFERENCES cruises(id) ON DELETE CASCADE,
        cabin_code VARCHAR(10),
        rate_code VARCHAR(50),
        occupancy_code VARCHAR(10),
        base_price DECIMAL(10,2),
        adult_price DECIMAL(10,2),
        child_price DECIMAL(10,2),
        infant_price DECIMAL(10,2),
        single_price DECIMAL(10,2),
        taxes DECIMAL(10,2),
        ncf DECIMAL(10,2),
        gratuities DECIMAL(10,2),
        fuel_surcharge DECIMAL(10,2),
        non_comm_total DECIMAL(10,2),
        cabin_type VARCHAR(50),
        currency VARCHAR(3) DEFAULT 'USD',
        is_available BOOLEAN DEFAULT true,
        price_type VARCHAR(10) DEFAULT 'static',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create cheapest_pricing table
    console.log('Creating cheapest_pricing table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS cheapest_pricing (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cruise_id INTEGER NOT NULL REFERENCES cruises(id) ON DELETE CASCADE,
        cheapest_price DECIMAL(10,2),
        cheapest_cabin_type VARCHAR(50),
        interior_price DECIMAL(10,2),
        interior_taxes DECIMAL(10,2),
        interior_ncf DECIMAL(10,2),
        interior_gratuity DECIMAL(10,2),
        interior_price_code VARCHAR(50),
        oceanview_price DECIMAL(10,2),
        oceanview_price_code VARCHAR(50),
        balcony_price DECIMAL(10,2),
        balcony_price_code VARCHAR(50),
        suite_price DECIMAL(10,2),
        suite_price_code VARCHAR(50),
        currency VARCHAR(3) DEFAULT 'USD',
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(cruise_id)
      )
    `);
    
    // Create price_history table
    console.log('Creating price_history table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS price_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cruise_id INTEGER NOT NULL REFERENCES cruises(id) ON DELETE CASCADE,
        cabin_code VARCHAR(10),
        rate_code VARCHAR(50),
        occupancy_code VARCHAR(10),
        price DECIMAL(10,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'USD',
        price_type VARCHAR(10),
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create alternative_sailings table
    console.log('Creating alternative_sailings table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS alternative_sailings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        base_cruise_id INTEGER NOT NULL REFERENCES cruises(id) ON DELETE CASCADE,
        alternative_cruise_id INTEGER NOT NULL REFERENCES cruises(id) ON DELETE CASCADE,
        sailing_date DATE NOT NULL,
        price DECIMAL(10,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(base_cruise_id, alternative_cruise_id)
      )
    `);
    
    // Create users table
    console.log('Creating users table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        phone VARCHAR(20),
        preferences JSONB DEFAULT '{}'::jsonb,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create saved_searches table
    console.log('Creating saved_searches table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS saved_searches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        search_params JSONB NOT NULL,
        name VARCHAR(255),
        alert_enabled BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create quote_requests table
    console.log('Creating quote_requests table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS quote_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cruise_id INTEGER NOT NULL REFERENCES cruises(id),
        user_email VARCHAR(255) NOT NULL,
        user_name VARCHAR(255),
        user_phone VARCHAR(20),
        cabin_preference VARCHAR(50),
        passengers INTEGER DEFAULT 2,
        special_requirements TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create indexes
    console.log('\nCreating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_cruises_sailing_date ON cruises(sailing_date);
      CREATE INDEX IF NOT EXISTS idx_cruises_cruise_line_id ON cruises(cruise_line_id);
      CREATE INDEX IF NOT EXISTS idx_cruises_ship_id ON cruises(ship_id);
      CREATE INDEX IF NOT EXISTS idx_cruises_region ON cruises(region);
      CREATE INDEX IF NOT EXISTS idx_cruises_duration_nights ON cruises(duration_nights);
      CREATE INDEX IF NOT EXISTS idx_cruises_region_ids ON cruises USING GIN(region_ids);
      CREATE INDEX IF NOT EXISTS idx_cruises_port_ids ON cruises USING GIN(port_ids);
      CREATE INDEX IF NOT EXISTS idx_ships_cruise_line_id ON ships(cruise_line_id);
      CREATE INDEX IF NOT EXISTS idx_pricing_cruise_id ON pricing(cruise_id);
      CREATE INDEX IF NOT EXISTS idx_cheapest_pricing_cruise_id ON cheapest_pricing(cruise_id);
      CREATE INDEX IF NOT EXISTS idx_itineraries_cruise_id ON itineraries(cruise_id);
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
    console.log('\n✅ Database schema ready for data sync!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Failed to create schema:', error);
    process.exit(1);
  });