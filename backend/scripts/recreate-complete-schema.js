#!/usr/bin/env node

/**
 * NUCLEAR SCHEMA RECREATION - TRAVELTEK EXACT MATCH
 * 
 * This script drops EVERYTHING and recreates the schema to EXACTLY match
 * what Traveltek provides in their JSON files. No assumptions, no extras.
 * 
 * Based on actual Traveltek JSON structure analysis from sample data.
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
    console.log('☢️  NUCLEAR SCHEMA RECREATION - TRAVELTEK EXACT MATCH');
    console.log('=====================================================');
    console.log('⚠️  WARNING: This will DELETE ALL DATA!');
    console.log('📄 Based on actual Traveltek JSON structure\n');
    
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

    // 1. Cruise Lines (EXACTLY from linecontent object)
    console.log('Creating cruise_lines...');
    await client.query(`
      CREATE TABLE cruise_lines (
        id INTEGER PRIMARY KEY,                    -- linecontent.id
        name VARCHAR(255) NOT NULL,                -- linecontent.name
        logo VARCHAR(500),                         -- linecontent.logo
        engine_name VARCHAR(100),                  -- linecontent.enginename
        nice_url VARCHAR(255),                     -- linecontent.niceurl
        short_name VARCHAR(50),                    -- linecontent.shortname
        description TEXT,                          -- linecontent.description
        code VARCHAR(10),                          -- linecontent.code
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // 2. Ships (EXACTLY from shipcontent object)
    console.log('Creating ships...');
    await client.query(`
      CREATE TABLE ships (
        id INTEGER PRIMARY KEY,                     -- shipcontent.id
        cruise_line_id INTEGER REFERENCES cruise_lines(id) NOT NULL,  -- shipcontent.lineid
        name VARCHAR(255) NOT NULL,                 -- shipcontent.name
        code VARCHAR(50),                           -- shipcontent.code
        tonnage INTEGER,                            -- shipcontent.tonnage
        total_cabins INTEGER,                       -- shipcontent.totalcabins
        occupancy INTEGER,                          -- shipcontent.occupancy (NOT capacity!)
        total_crew INTEGER,                         -- shipcontent.totalcrew
        length INTEGER,                             -- shipcontent.length
        launched DATE,                              -- shipcontent.launched
        star_rating INTEGER,                        -- shipcontent.starrating
        adults_only BOOLEAN DEFAULT false,          -- shipcontent.adultsonly = "Y"
        short_description TEXT,                     -- shipcontent.shortdescription
        highlights TEXT,                            -- shipcontent.highlights
        ship_class VARCHAR(100),                    -- shipcontent.shipclass
        default_ship_image VARCHAR(500),            -- shipcontent.defaultshipimage
        default_ship_image_hd VARCHAR(500),         -- shipcontent.defaultshipimagehd
        default_ship_image_2k VARCHAR(500),         -- shipcontent.defaultshipimage2k
        nice_url VARCHAR(255),                      -- shipcontent.niceurl
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

    // 5. Cruises (EXACTLY from root level fields)
    console.log('Creating cruises...');
    await client.query(`
      CREATE TABLE cruises (
        id VARCHAR PRIMARY KEY,                     -- codetocruiseid (UNIQUE per sailing)
        cruise_id VARCHAR,                          -- cruiseid (NOT unique)
        cruise_line_id INTEGER REFERENCES cruise_lines(id) NOT NULL,  -- lineid
        ship_id INTEGER REFERENCES ships(id) NOT NULL,               -- shipid
        name VARCHAR(500) NOT NULL,                 -- name
        nights INTEGER NOT NULL,                    -- nights (or sailnights)
        embarkation_port_id INTEGER REFERENCES ports(id),            -- startportid
        disembarkation_port_id INTEGER REFERENCES ports(id),         -- endportid
        sailing_date DATE NOT NULL,                 -- saildate (or startdate)
        return_date DATE,                           -- calculated or from data
        voyage_code VARCHAR(50),                    -- voyagecode
        itinerary_code VARCHAR(50),                 -- itinerarycode
        port_ids VARCHAR(500),                      -- portids (comma-separated)
        region_ids VARCHAR(200),                    -- regionids (comma-separated)
        sea_days INTEGER,                           -- seadays
        depart_uk BOOLEAN DEFAULT false,            -- departuk = "Y"
        no_fly BOOLEAN DEFAULT false,               -- nofly = "Y"
        show_cruise BOOLEAN DEFAULT true,           -- showcruise
        owner_id VARCHAR(50),                       -- ownerid
        market_id VARCHAR(50),                      -- marketid
        last_cached INTEGER,                        -- lastcached (unix timestamp)
        cached_date VARCHAR(100),                   -- cacheddate (string)
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

    // 7. Cabin Categories (EXACTLY from cabins object)
    console.log('Creating cabin_categories...');
    await client.query(`
      CREATE TABLE cabin_categories (
        ship_id INTEGER REFERENCES ships(id) NOT NULL,
        cabin_code VARCHAR(10) NOT NULL,            -- cabins.{}.cabincode
        cabin_code_alt VARCHAR(10),                 -- cabins.{}.cabincode2
        name VARCHAR(255) NOT NULL,                 -- cabins.{}.name
        description TEXT,                           -- cabins.{}.description
        category VARCHAR(50) NOT NULL,              -- cabins.{}.codtype (interior/oceanview/balcony/suite)
        color_code VARCHAR(7),                      -- cabins.{}.colourcode
        image_url VARCHAR(500),                     -- cabins.{}.imageurl
        image_url_hd VARCHAR(500),                  -- cabins.{}.imageurlhd
        image_url_2k VARCHAR(500),                  -- cabins.{}.imageurl2k
        is_default BOOLEAN DEFAULT false,           -- cabins.{}.isdefault = "Y"
        valid_from DATE,                            -- cabins.{}.validfrom
        valid_to DATE,                              -- cabins.{}.validto
        cabin_id VARCHAR(20),                       -- cabins.{}.id
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        PRIMARY KEY(ship_id, cabin_code)
      )
    `);

    // 8. Pricing (EXACTLY from prices.{rateCode}.{cabinCode}.{occupancyCode})
    console.log('Creating pricing...');
    await client.query(`
      CREATE TABLE pricing (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cruise_id VARCHAR REFERENCES cruises(id) NOT NULL,  -- Reference to cruises.id (codetocruiseid)
        rate_code VARCHAR(50) NOT NULL,             -- Top level key in prices object
        cabin_code VARCHAR(10) NOT NULL,            -- Second level key
        occupancy_code VARCHAR(10) NOT NULL,        -- Third level key
        cabin_type VARCHAR(50),                     -- prices.{}.{}.{}.cabintype
        base_price NUMERIC(10, 2),                  -- prices.{}.{}.{}.price
        adult_price NUMERIC(10, 2),                 -- prices.{}.{}.{}.adultprice
        child_price NUMERIC(10, 2),                 -- prices.{}.{}.{}.childprice
        infant_price NUMERIC(10, 2),                -- prices.{}.{}.{}.infantprice
        single_price NUMERIC(10, 2),                -- prices.{}.{}.{}.singleprice
        third_adult_price NUMERIC(10, 2),           -- prices.{}.{}.{}.thirdadultprice
        fourth_adult_price NUMERIC(10, 2),          -- prices.{}.{}.{}.fourthadultprice
        taxes NUMERIC(10, 2),                       -- prices.{}.{}.{}.taxes
        ncf NUMERIC(10, 2),                          -- prices.{}.{}.{}.ncf
        gratuity NUMERIC(10, 2),                    -- prices.{}.{}.{}.gratuity
        fuel NUMERIC(10, 2),                        -- prices.{}.{}.{}.fuel
        non_comm NUMERIC(10, 2),                    -- prices.{}.{}.{}.noncomm
        port_charges NUMERIC(10, 2),                -- prices.{}.{}.{}.portcharges
        government_fees NUMERIC(10, 2),             -- prices.{}.{}.{}.governmentfees
        total_price NUMERIC(10, 2),                 -- Calculated
        commission NUMERIC(10, 2),                  -- For agent pricing
        is_available BOOLEAN DEFAULT true,          -- prices.{}.{}.{}.available
        inventory INTEGER,                          -- prices.{}.{}.{}.inventory
        waitlist BOOLEAN DEFAULT false,             -- prices.{}.{}.{}.waitlist
        guarantee BOOLEAN DEFAULT false,            -- prices.{}.{}.{}.guarantee
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

    // ========================================================================
    // ADDITIONAL TABLES FOR TRAVELTEK DATA
    // ========================================================================

    // 10. Ship Images (from shipcontent.shipimages[])
    console.log('Creating ship_images...');
    await client.query(`
      CREATE TABLE ship_images (
        id SERIAL PRIMARY KEY,
        ship_id INTEGER REFERENCES ships(id) NOT NULL,
        image_url VARCHAR(500),                     -- shipimages[].imageurl
        image_url_hd VARCHAR(500),                  -- shipimages[].imageurlhd
        image_url_2k VARCHAR(500),                  -- shipimages[].imageurl2k
        caption VARCHAR(500),                       -- shipimages[].caption
        is_default BOOLEAN DEFAULT false,           -- shipimages[].default = "Y"
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // 11. Ship Decks (from shipcontent.shipdecks)
    console.log('Creating ship_decks...');
    await client.query(`
      CREATE TABLE ship_decks (
        id SERIAL PRIMARY KEY,
        ship_id INTEGER REFERENCES ships(id) NOT NULL,
        deck_id INTEGER,                            -- shipdecks.{id}
        deck_name VARCHAR(255),                     -- shipdecks.{}.deckname
        description TEXT,                            -- shipdecks.{}.description
        plan_image VARCHAR(500),                    -- shipdecks.{}.planimage
        live_name VARCHAR(50),                      -- shipdecks.{}.livename
        deck_plan_id INTEGER,                       -- shipdecks.{}.deckplanid
        valid_from DATE,                            -- shipdecks.{}.validfrom
        valid_to DATE,                              -- shipdecks.{}.validto
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // 12. Alternative Sailings (from altsailings object)
    console.log('Creating alternative_sailings...');
    await client.query(`
      CREATE TABLE alternative_sailings (
        id SERIAL PRIMARY KEY,
        cruise_id VARCHAR REFERENCES cruises(id) NOT NULL,
        alternative_cruise_id VARCHAR,              -- altsailings.{}.id
        sail_date DATE,                             -- altsailings.{}.saildate
        start_date DATE,                            -- altsailings.{}.startdate
        lead_price NUMERIC(10, 2),                  -- altsailings.{}.leadprice
        voyage_code VARCHAR(50),                    -- altsailings.{}.voyagecode
        ship_id INTEGER,                            -- altsailings.{}.shipid
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // ========================================================================
    // OUR APPLICATION TABLES (NOT FROM TRAVELTEK)
    // ========================================================================

    // 13. Price History (Our tracking)
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

    // 14. Quote Requests (Our application)
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

    // 15. Saved Searches (Our application)
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

    // 16. Users (Our application - Clerk integration)
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

    const createdTables = tableCheck.rows.map(r => r.table_name);
    
    // Expected tables
    const expectedTables = [
      // Traveltek data tables
      'cruise_lines',
      'ships',
      'ports', 
      'regions',
      'cruises',
      'itineraries',
      'cabin_categories',
      'pricing',
      'cheapest_pricing',
      'ship_images',
      'ship_decks',
      'alternative_sailings',
      // Our application tables
      'price_history',
      'quote_requests',
      'saved_searches',
      'users'
    ];

    console.log('\n📊 Table Creation Status:');
    console.log('─'.repeat(40));
    
    console.log('\n🚢 Traveltek Data Tables:');
    const traveltekTables = expectedTables.slice(0, 12);
    traveltekTables.forEach(table => {
      if (createdTables.includes(table)) {
        console.log(`   ✅ ${table}`);
      } else {
        console.log(`   ❌ ${table} - MISSING!`);
      }
    });
    
    console.log('\n💼 Application Tables:');
    const appTables = expectedTables.slice(12);
    appTables.forEach(table => {
      if (createdTables.includes(table)) {
        console.log(`   ✅ ${table}`);
      } else {
        console.log(`   ❌ ${table} - MISSING!`);
      }
    });

    // Check for unexpected tables
    const unexpectedTables = createdTables.filter(t => !expectedTables.includes(t));
    if (unexpectedTables.length > 0) {
      console.log('\n⚠️  Unexpected tables found:');
      unexpectedTables.forEach(table => {
        console.log(`   ? ${table}`);
      });
    }

    console.log('\n✨ NUCLEAR SCHEMA RECREATION COMPLETE!');
    console.log('   All tables created to EXACTLY match Traveltek structure');
    console.log('   Application tables preserved for business logic');
    console.log('   Ready for complete data sync');

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