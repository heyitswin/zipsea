#!/usr/bin/env node

/**
 * COMPLETE SCHEMA RECREATION
 * This script drops everything and recreates the ENTIRE schema from scratch
 * matching the current Drizzle schema definitions
 * 
 * WARNING: This will DELETE ALL DATA!
 */

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function recreateSchema() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🚨 COMPLETE SCHEMA RECREATION');
    console.log('==============================');
    console.log('⚠️  WARNING: This will DELETE ALL DATA!\n');
    
    // Add a 5 second delay to allow cancellation
    console.log('Starting in 5 seconds... Press Ctrl+C to cancel');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\n🔄 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database\n');

    // Drop all tables in correct order (respecting foreign keys)
    console.log('🗑️  Dropping all existing tables...');
    await client.query(`
      DROP TABLE IF EXISTS __drizzle_migrations CASCADE;
      DROP TABLE IF EXISTS alternative_sailings CASCADE;
      DROP TABLE IF EXISTS quote_requests CASCADE;
      DROP TABLE IF EXISTS saved_searches CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP TABLE IF EXISTS pricing CASCADE;
      DROP TABLE IF EXISTS cheapest_pricing CASCADE;
      DROP TABLE IF EXISTS price_history CASCADE;
      DROP TABLE IF EXISTS price_trends CASCADE;
      DROP TABLE IF EXISTS cabin_categories CASCADE;
      DROP TABLE IF EXISTS itineraries CASCADE;
      DROP TABLE IF EXISTS cruises CASCADE;
      DROP TABLE IF EXISTS ships CASCADE;
      DROP TABLE IF EXISTS ports CASCADE;
      DROP TABLE IF EXISTS regions CASCADE;
      DROP TABLE IF EXISTS cruise_lines CASCADE;
      DROP TABLE IF EXISTS cruise_definitions CASCADE;
      DROP TABLE IF EXISTS cruise_sailings CASCADE;
      DROP TABLE IF EXISTS cruise_sailings_legacy CASCADE;
    `);
    console.log('✅ All tables dropped\n');

    // Create tables in correct order
    console.log('📝 Creating schema...\n');

    // 1. Cruise Lines
    console.log('Creating cruise_lines...');
    await client.query(`
      CREATE TABLE cruise_lines (
        id INTEGER PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        logo VARCHAR(500),
        website VARCHAR(500),
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // 2. Ships
    console.log('Creating ships...');
    await client.query(`
      CREATE TABLE ships (
        id INTEGER PRIMARY KEY,
        cruise_line_id INTEGER REFERENCES cruise_lines(id) NOT NULL,
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
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // 3. Ports
    console.log('Creating ports...');
    await client.query(`
      CREATE TABLE ports (
        id INTEGER PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(10),
        country VARCHAR(100),
        region VARCHAR(100),
        latitude NUMERIC(10, 7),
        longitude NUMERIC(10, 7),
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // 4. Regions
    console.log('Creating regions...');
    await client.query(`
      CREATE TABLE regions (
        id INTEGER PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        parent_region_id INTEGER REFERENCES regions(id),
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // 5. Cruises (with varchar ID for codetocruiseid)
    console.log('Creating cruises...');
    await client.query(`
      CREATE TABLE cruises (
        id VARCHAR PRIMARY KEY,  -- This is codetocruiseid
        cruise_id VARCHAR,        -- This is the original cruiseid
        cruise_line_id INTEGER REFERENCES cruise_lines(id) NOT NULL,
        ship_id INTEGER REFERENCES ships(id) NOT NULL,
        name VARCHAR(500) NOT NULL,
        nights INTEGER NOT NULL,
        embarkation_port_id INTEGER REFERENCES ports(id),
        disembarkation_port_id INTEGER REFERENCES ports(id),
        sailing_date DATE NOT NULL,
        return_date DATE,
        voyage_code VARCHAR(50),
        itinerary_code VARCHAR(50),
        is_active BOOLEAN DEFAULT true,
        show_cruise BOOLEAN DEFAULT true,
        traveltek_file_path VARCHAR(500),
        last_synced_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // 6. Itineraries
    console.log('Creating itineraries...');
    await client.query(`
      CREATE TABLE itineraries (
        id SERIAL PRIMARY KEY,
        cruise_id VARCHAR REFERENCES cruises(id) NOT NULL,
        day_number INTEGER NOT NULL,
        port_id INTEGER REFERENCES ports(id),
        port_name VARCHAR(255),
        arrival_time VARCHAR(10),
        departure_time VARCHAR(10),
        description TEXT,
        is_sea_day BOOLEAN DEFAULT false,
        is_tender_port BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        UNIQUE(cruise_id, day_number)
      )
    `);

    // 7. Cabin Categories
    console.log('Creating cabin_categories...');
    await client.query(`
      CREATE TABLE cabin_categories (
        ship_id INTEGER REFERENCES ships(id) NOT NULL,
        cabin_code VARCHAR(10) NOT NULL,
        cabin_code_alt VARCHAR(10),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(50) NOT NULL,
        category_alt VARCHAR(50),
        color_code VARCHAR(7),
        color_code_alt VARCHAR(7),
        image_url VARCHAR(500),
        image_url_hd VARCHAR(500),
        is_default BOOLEAN DEFAULT false,
        valid_from DATE,
        valid_to DATE,
        max_occupancy INTEGER DEFAULT 2,
        min_occupancy INTEGER DEFAULT 1,
        size VARCHAR(50),
        bed_configuration VARCHAR(100),
        amenities JSONB DEFAULT '[]',
        deck_locations JSONB DEFAULT '[]',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        PRIMARY KEY(ship_id, cabin_code)
      )
    `);

    // 8. Pricing
    console.log('Creating pricing...');
    await client.query(`
      CREATE TABLE pricing (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cruise_id VARCHAR REFERENCES cruises(id) NOT NULL,
        cruise_sailing_id UUID,
        rate_code VARCHAR(50) NOT NULL,
        cabin_code VARCHAR(10) NOT NULL,
        occupancy_code VARCHAR(10) NOT NULL,
        cabin_type VARCHAR(50),
        base_price NUMERIC(10, 2),
        adult_price NUMERIC(10, 2),
        child_price NUMERIC(10, 2),
        infant_price NUMERIC(10, 2),
        single_price NUMERIC(10, 2),
        third_adult_price NUMERIC(10, 2),
        fourth_adult_price NUMERIC(10, 2),
        taxes NUMERIC(10, 2),
        ncf NUMERIC(10, 2),
        gratuity NUMERIC(10, 2),
        fuel NUMERIC(10, 2),
        non_comm NUMERIC(10, 2),
        port_charges NUMERIC(10, 2),
        government_fees NUMERIC(10, 2),
        total_price NUMERIC(10, 2),
        commission NUMERIC(10, 2),
        is_available BOOLEAN DEFAULT true,
        inventory INTEGER,
        waitlist BOOLEAN DEFAULT false,
        guarantee BOOLEAN DEFAULT false,
        currency VARCHAR(3) DEFAULT 'USD',
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // 9. Cheapest Pricing
    console.log('Creating cheapest_pricing...');
    await client.query(`
      CREATE TABLE cheapest_pricing (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cruise_id VARCHAR REFERENCES cruises(id) UNIQUE NOT NULL,
        cruise_sailing_id UUID,
        cheapest_price NUMERIC(10, 2),
        cheapest_cabin_type VARCHAR(50),
        cheapest_taxes NUMERIC(10, 2),
        cheapest_ncf NUMERIC(10, 2),
        cheapest_gratuity NUMERIC(10, 2),
        cheapest_fuel NUMERIC(10, 2),
        cheapest_non_comm NUMERIC(10, 2),
        interior_price NUMERIC(10, 2),
        interior_taxes NUMERIC(10, 2),
        interior_ncf NUMERIC(10, 2),
        interior_gratuity NUMERIC(10, 2),
        interior_fuel NUMERIC(10, 2),
        interior_non_comm NUMERIC(10, 2),
        interior_price_code VARCHAR(50),
        oceanview_price NUMERIC(10, 2),
        oceanview_taxes NUMERIC(10, 2),
        oceanview_ncf NUMERIC(10, 2),
        oceanview_gratuity NUMERIC(10, 2),
        oceanview_fuel NUMERIC(10, 2),
        oceanview_non_comm NUMERIC(10, 2),
        oceanview_price_code VARCHAR(50),
        balcony_price NUMERIC(10, 2),
        balcony_taxes NUMERIC(10, 2),
        balcony_ncf NUMERIC(10, 2),
        balcony_gratuity NUMERIC(10, 2),
        balcony_fuel NUMERIC(10, 2),
        balcony_non_comm NUMERIC(10, 2),
        balcony_price_code VARCHAR(50),
        suite_price NUMERIC(10, 2),
        suite_taxes NUMERIC(10, 2),
        suite_ncf NUMERIC(10, 2),
        suite_gratuity NUMERIC(10, 2),
        suite_fuel NUMERIC(10, 2),
        suite_non_comm NUMERIC(10, 2),
        suite_price_code VARCHAR(50),
        currency VARCHAR(3) DEFAULT 'USD',
        last_updated TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // 10. Price History
    console.log('Creating price_history...');
    await client.query(`
      CREATE TABLE price_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cruise_id VARCHAR NOT NULL,
        cabin_code VARCHAR(10),
        rate_code VARCHAR(50),
        occupancy_code VARCHAR(10),
        old_price NUMERIC(10, 2),
        new_price NUMERIC(10, 2) NOT NULL,
        price_difference NUMERIC(10, 2),
        change_percentage NUMERIC(5, 2),
        currency VARCHAR(3) DEFAULT 'USD',
        snapshot_date TIMESTAMP DEFAULT NOW() NOT NULL,
        trigger_source VARCHAR(50),
        batch_id UUID,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // 11. Quote Requests
    console.log('Creating quote_requests...');
    await client.query(`
      CREATE TABLE quote_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cruise_id VARCHAR REFERENCES cruises(id),
        user_id UUID,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        preferred_cabin_type VARCHAR(50),
        passenger_count INTEGER DEFAULT 2,
        special_requests TEXT,
        marketing_opt_in BOOLEAN DEFAULT false,
        status VARCHAR(50) DEFAULT 'pending',
        assigned_agent VARCHAR(100),
        follow_up_date DATE,
        notes TEXT,
        source VARCHAR(50),
        utm_source VARCHAR(100),
        utm_medium VARCHAR(100),
        utm_campaign VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // 12. Saved Searches
    console.log('Creating saved_searches...');
    await client.query(`
      CREATE TABLE saved_searches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID,
        email VARCHAR(255),
        search_criteria JSONB NOT NULL,
        alert_frequency VARCHAR(20) DEFAULT 'weekly',
        last_alert_sent TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // 13. Users
    console.log('Creating users...');
    await client.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        clerk_id VARCHAR(255) UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        phone VARCHAR(20),
        preferences JSONB DEFAULT '{}',
        marketing_opt_in BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        last_login_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // Create indexes
    console.log('\n📝 Creating indexes...');
    
    const indexes = [
      // Cruises indexes
      'CREATE INDEX idx_cruises_sailing_date ON cruises(sailing_date)',
      'CREATE INDEX idx_cruises_cruise_line_ship ON cruises(cruise_line_id, ship_id)',
      'CREATE INDEX idx_cruises_ports ON cruises(embarkation_port_id, disembarkation_port_id)',
      
      // Pricing indexes
      'CREATE INDEX idx_pricing_cruise_id ON pricing(cruise_id)',
      'CREATE INDEX idx_pricing_rate_cabin_occupancy ON pricing(rate_code, cabin_code, occupancy_code)',
      'CREATE UNIQUE INDEX idx_pricing_unique ON pricing(cruise_id, rate_code, cabin_code, occupancy_code)',
      
      // Cheapest pricing indexes
      'CREATE INDEX idx_cheapest_pricing_prices ON cheapest_pricing(cheapest_price, interior_price, oceanview_price, balcony_price, suite_price)',
      
      // Itineraries indexes
      'CREATE INDEX idx_itineraries_cruise_id ON itineraries(cruise_id)',
      
      // Price history indexes
      'CREATE INDEX idx_price_history_cruise_id ON price_history(cruise_id)',
      'CREATE INDEX idx_price_history_snapshot_date ON price_history(snapshot_date DESC)',
      
      // Quote requests indexes
      'CREATE INDEX idx_quote_requests_email ON quote_requests(email)',
      'CREATE INDEX idx_quote_requests_status ON quote_requests(status)',
      
      // Users indexes
      'CREATE INDEX idx_users_email ON users(email)',
      'CREATE INDEX idx_users_clerk_id ON users(clerk_id)'
    ];

    for (const indexQuery of indexes) {
      try {
        await client.query(indexQuery);
        console.log(`✅ Created index: ${indexQuery.split(' ')[2]}`);
      } catch (error) {
        console.log(`⚠️  Index error: ${error.message}`);
      }
    }

    // Verify all tables
    console.log('\n🔍 Verifying all tables...');
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('\n📊 Created tables:');
    tableCheck.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name}`);
    });

    console.log('\n✨ Complete schema recreation successful!');
    console.log('   All tables created with correct structure');
    console.log('   Ready for data sync');

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the script
recreateSchema()
  .then(() => {
    console.log('\n✅ Schema recreation completed successfully!');
    console.log('You can now run: FORCE_UPDATE=true SYNC_YEAR=2025 SYNC_MONTH=09 node scripts/sync-complete-data.js');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error.message);
    process.exit(1);
  });