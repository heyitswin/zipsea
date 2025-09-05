#!/usr/bin/env node

/**
 * Complete Enhanced Database Schema Creation Script
 * Implements the full Traveltek JSON structure with zero data loss
 * Based on deep analysis of actual Traveltek cruise files (271KB each)
 *
 * Features:
 * - Complete JSON preservation in raw_data columns
 * - Structured fields for fast queries
 * - All nested objects stored in JSONB for flexibility
 * - Comprehensive pricing from all sources
 * - Full itinerary, cabin, and ship data
 * - Performance indexes on key fields
 *
 * Date: 2025-01-14
 */

const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const COMPLETE_TRAVELTEK_SCHEMA = `
-- ==============================================================================
-- DROP EXISTING TABLES (in dependency order)
-- ==============================================================================
DROP TABLE IF EXISTS detailed_pricing CASCADE;
DROP TABLE IF EXISTS alternative_sailings CASCADE;
DROP TABLE IF EXISTS cabin_deck_locations CASCADE;
DROP TABLE IF EXISTS cabin_categories CASCADE;
DROP TABLE IF EXISTS cruise_itinerary CASCADE;
DROP TABLE IF EXISTS cruises CASCADE;
DROP TABLE IF EXISTS regions CASCADE;
DROP TABLE IF EXISTS ports CASCADE;
DROP TABLE IF EXISTS ships CASCADE;
DROP TABLE IF EXISTS cruise_lines CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS quote_requests CASCADE;
DROP TABLE IF EXISTS system_flags CASCADE;

-- ==============================================================================
-- USERS TABLE
-- ==============================================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  preferences JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- ==============================================================================
-- CRUISE LINES TABLE - Enhanced with all Traveltek linecontent fields
-- ==============================================================================
CREATE TABLE cruise_lines (
  id INTEGER PRIMARY KEY,                    -- Traveltek lineid
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50),                         -- linecontent.code
  engine_name VARCHAR(100),                 -- linecontent.enginename
  short_name VARCHAR(100),                  -- linecontent.shortname
  nice_url VARCHAR(255),                    -- linecontent.niceurl
  title VARCHAR(255),                       -- linecontent.title
  logo VARCHAR(500),                        -- linecontent.logo
  description TEXT,                         -- linecontent.description
  raw_line_content JSONB,                   -- Complete linecontent object
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ==============================================================================
-- SHIPS TABLE - Enhanced with all Traveltek shipcontent fields
-- ==============================================================================
CREATE TABLE ships (
  id INTEGER PRIMARY KEY,                   -- Traveltek shipid
  cruise_line_id INTEGER REFERENCES cruise_lines(id) NOT NULL,
  name VARCHAR(255) NOT NULL,              -- shipcontent.name
  nice_name VARCHAR(255),                  -- shipcontent.nicename
  short_name VARCHAR(255),                 -- shipcontent.shortname
  code VARCHAR(50),                        -- shipcontent.code
  tonnage INTEGER,                         -- shipcontent.tonnage
  total_cabins INTEGER,                    -- shipcontent.totalcabins
  max_passengers INTEGER,                  -- shipcontent.maxpassengers / occupancy
  crew INTEGER,                            -- shipcontent.totalcrew
  length NUMERIC(10,2),                    -- shipcontent.length
  beam NUMERIC(10,2),                      -- shipcontent.beam
  draft NUMERIC(10,2),                     -- shipcontent.draft
  speed NUMERIC(5,2),                      -- shipcontent.speed
  registry VARCHAR(100),                   -- shipcontent.registry
  built_year INTEGER,                      -- shipcontent.launched (year)
  refurbished_year INTEGER,               -- shipcontent.refurbishedyear
  description TEXT,                        -- shipcontent.shortdescription
  star_rating INTEGER,                     -- shipcontent.starrating
  adults_only BOOLEAN DEFAULT false,       -- shipcontent.adultsonly
  ship_class VARCHAR(100),                 -- shipcontent.shipclass
  default_ship_image VARCHAR(500),         -- shipcontent.defaultshipimage
  default_ship_image_hd VARCHAR(500),      -- shipcontent.defaultshipimagehd
  default_ship_image_2k VARCHAR(500),      -- shipcontent.defaultshipimage2k
  nice_url VARCHAR(255),                   -- shipcontent.niceurl
  highlights TEXT,                         -- shipcontent.highlights
  raw_ship_content JSONB,                  -- Complete shipcontent object
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ==============================================================================
-- PORTS TABLE - Enhanced with all port information
-- ==============================================================================
CREATE TABLE ports (
  id INTEGER PRIMARY KEY,                  -- Traveltek portid
  name VARCHAR(255) NOT NULL,
  code VARCHAR(10),
  country VARCHAR(100),
  region VARCHAR(100),
  latitude NUMERIC(10,6),
  longitude NUMERIC(10,6),
  description TEXT,
  raw_port_data JSONB,                    -- Complete port object
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ==============================================================================
-- REGIONS TABLE - For cruise regions
-- ==============================================================================
CREATE TABLE regions (
  id INTEGER PRIMARY KEY,                  -- Traveltek region id
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50),
  description TEXT,
  raw_region_data JSONB,                  -- Complete region object
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ==============================================================================
-- CRUISES TABLE - Complete Traveltek structure with ALL fields
-- ==============================================================================
CREATE TABLE cruises (
  -- Primary identifiers
  id VARCHAR(50) PRIMARY KEY,              -- codetocruiseid (unique sailing ID)
  cruise_id VARCHAR(50),                   -- cruiseid (base cruise ID)
  traveltek_cruise_id VARCHAR(50),         -- Alternative ID field
  cruise_line_id INTEGER REFERENCES cruise_lines(id) NOT NULL,
  ship_id INTEGER REFERENCES ships(id) NOT NULL,

  -- Basic cruise information
  name VARCHAR(500),                       -- name
  voyage_code VARCHAR(50),                 -- voyagecode
  itinerary_code VARCHAR(50),              -- itinerarycode

  -- Dates and duration
  sailing_date DATE NOT NULL,              -- saildate
  start_date DATE,                         -- startdate (usually same as saildate)
  return_date DATE,                        -- calculated from saildate + nights
  nights INTEGER,                          -- nights
  sail_nights INTEGER,                     -- sailnights
  sea_days INTEGER,                        -- seadays

  -- Ports and geography
  embarkation_port_id INTEGER REFERENCES ports(id), -- startportid
  disembarkation_port_id INTEGER REFERENCES ports(id), -- endportid
  port_ids TEXT,                          -- portids (comma-separated string)
  region_ids TEXT,                        -- regionids (comma-separated string)

  -- Market and ownership
  market_id INTEGER,                      -- marketid (converted to integer)
  owner_id INTEGER,                       -- ownerid (converted to integer)

  -- Flight and logistics
  no_fly BOOLEAN DEFAULT false,           -- nofly "Y"/"N"
  depart_uk BOOLEAN DEFAULT false,        -- departuk "Y"/"N"
  show_cruise BOOLEAN DEFAULT true,       -- showcruise "Y"/"N"

  -- Pricing - Direct cheapest fields
  cheapest_price DECIMAL(10,2),           -- cheapestprice
  cheapest_price_raw VARCHAR(50),         -- Raw value before conversion
  cheapest_inside DECIMAL(10,2),          -- cheapestinside (as number)
  cheapest_inside_price_code VARCHAR(50), -- cheapestinsidepricecode
  cheapest_outside DECIMAL(10,2),         -- cheapestoutside (as number)
  cheapest_outside_price_code VARCHAR(50), -- cheapestoutsidepricecode
  cheapest_balcony DECIMAL(10,2),         -- cheapestbalcony (as number)
  cheapest_balcony_price_code VARCHAR(50), -- cheapestbalconypricecode
  cheapest_suite DECIMAL(10,2),           -- cheapestsuite (as number)
  cheapest_suite_price_code VARCHAR(50),  -- cheapestsuitepricecode

  -- Pricing - Processed for quick access (from cheapest.combined)
  interior_price DECIMAL(10,2),           -- From cheapest.combined.inside
  oceanview_price DECIMAL(10,2),          -- From cheapest.combined.outside
  balcony_price DECIMAL(10,2),            -- From cheapest.combined.balcony
  suite_price DECIMAL(10,2),              -- From cheapest.combined.suite
  currency VARCHAR(3) DEFAULT 'USD',      -- Pricing currency

  -- Caching information
  last_cached BIGINT,                     -- lastcached (unix timestamp)
  cached_date VARCHAR(50),                -- cacheddate

  -- JSON storage for complex nested data - THE KEY FEATURE
  raw_data JSONB,                         -- Complete original JSON (ZERO DATA LOSS)
  cheapest_pricing JSONB,                 -- cheapest object with all pricing tiers
  cached_prices JSONB,                    -- cachedprices object
  prices_data JSONB,                      -- prices object
  itinerary_data JSONB,                   -- itinerary array
  cabins_data JSONB,                      -- cabins object with all cabin details
  ports_data JSONB,                       -- ports array
  regions_data JSONB,                     -- regions array
  alt_sailings JSONB,                     -- altsailings object
  fly_cruise_info JSONB,                  -- flycruiseinfo object

  -- System fields
  needs_price_update BOOLEAN DEFAULT false,
  processing_started_at TIMESTAMP,
  processing_completed_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ==============================================================================
-- CRUISE ITINERARY TABLE - Detailed daily itinerary
-- ==============================================================================
CREATE TABLE cruise_itinerary (
  id SERIAL PRIMARY KEY,
  cruise_id VARCHAR(50) REFERENCES cruises(id) ON DELETE CASCADE,
  traveltek_id BIGINT,                     -- id from itinerary JSON
  day_number INTEGER NOT NULL,            -- day
  order_id INTEGER,                       -- orderid
  port_id INTEGER REFERENCES ports(id),   -- portid
  port_name VARCHAR(255),                 -- name
  itinerary_name VARCHAR(255),            -- itineraryname
  arrive_date DATE,                       -- arrivedate
  depart_date DATE,                       -- departdate
  arrive_time VARCHAR(10),                -- arrivetime
  depart_time VARCHAR(10),                -- departtime
  latitude NUMERIC(10,6),                 -- latitude
  longitude NUMERIC(10,6),                -- longitude
  description TEXT,                       -- description
  itinerary_description TEXT,             -- itinerarydescription
  short_description TEXT,                 -- shortdescription
  owner_id VARCHAR(50),                   -- ownerid
  supercedes INTEGER,                     -- supercedes
  idl_crossed BOOLEAN,                    -- idlcrossed
  overnight BOOLEAN DEFAULT false,        -- overnight
  raw_itinerary_data JSONB,               -- Complete itinerary day object
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ==============================================================================
-- CABIN CATEGORIES TABLE - Ship cabin types and details
-- ==============================================================================
CREATE TABLE cabin_categories (
  id VARCHAR(50) PRIMARY KEY,             -- id from cabins JSON
  ship_id INTEGER REFERENCES ships(id) NOT NULL,
  cabin_code VARCHAR(10) NOT NULL,        -- cabincode
  cabin_code2 VARCHAR(10),                -- cabincode2
  name VARCHAR(255) NOT NULL,             -- name
  description TEXT,                       -- description
  cabin_type VARCHAR(50),                 -- cabintype (interior, balcony, suite, etc.)
  colour_code VARCHAR(10),                -- colourcode
  deck_id INTEGER,                        -- deckid
  image_url VARCHAR(500),                 -- imageurl
  image_url_hd VARCHAR(500),              -- imageurlhd
  image_url_2k VARCHAR(500),              -- imageurl2k
  valid_from DATE,                        -- validfrom
  valid_to DATE,                          -- validto
  is_default BOOLEAN DEFAULT false,       -- isdefault "Y"/"N"
  all_cabin_decks JSONB,                  -- allcabindecks array
  all_cabin_images JSONB,                 -- allcabinimages array
  raw_cabin_data JSONB,                   -- Complete cabin category object
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ==============================================================================
-- CABIN DECK LOCATIONS TABLE - Individual cabin positions
-- ==============================================================================
CREATE TABLE cabin_deck_locations (
  id SERIAL PRIMARY KEY,
  ship_id INTEGER REFERENCES ships(id) NOT NULL,
  cabin_number VARCHAR(20) NOT NULL,     -- cabinno
  x1 INTEGER,                            -- x1 coordinate
  y1 INTEGER,                            -- y1 coordinate
  x2 INTEGER,                            -- x2 coordinate
  y2 INTEGER,                            -- y2 coordinate
  deck_level INTEGER,                    -- deck level
  raw_location_data JSONB,               -- Complete location object
  created_at TIMESTAMP DEFAULT NOW()
);

-- ==============================================================================
-- ALTERNATIVE SAILINGS TABLE - Related cruise options
-- ==============================================================================
CREATE TABLE alternative_sailings (
  id VARCHAR(50) PRIMARY KEY,            -- id from altsailings
  base_cruise_id VARCHAR(50) REFERENCES cruises(id),
  ship_id INTEGER REFERENCES ships(id),
  voyage_code VARCHAR(50),               -- voyagecode
  sail_date DATE,                        -- saildate
  start_date DATE,                       -- startdate
  lead_price DECIMAL(10,2),              -- leadprice
  raw_sailing_data JSONB,                -- Complete altsailing object
  created_at TIMESTAMP DEFAULT NOW()
);

-- ==============================================================================
-- DETAILED PRICING TABLE - All pricing tiers and codes
-- ==============================================================================
CREATE TABLE detailed_pricing (
  id SERIAL PRIMARY KEY,
  cruise_id VARCHAR(50) REFERENCES cruises(id) ON DELETE CASCADE,
  pricing_source VARCHAR(20) NOT NULL,   -- 'prices', 'cachedprices', 'combined'
  cabin_type VARCHAR(20) NOT NULL,       -- 'inside', 'outside', 'balcony', 'suite'
  price DECIMAL(10,2),                   -- price value
  price_code VARCHAR(50),                -- price code (e.g., 'GM241312')
  source_attribution VARCHAR(20),        -- source ('prices', 'cached', etc.)
  raw_pricing_data JSONB,                -- Complete pricing object
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(cruise_id, pricing_source, cabin_type)
);

-- ==============================================================================
-- QUOTE REQUESTS TABLE
-- ==============================================================================
CREATE TABLE quote_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cruise_id VARCHAR(50) REFERENCES cruises(id) NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(20),
  customer_details JSONB,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- ==============================================================================
-- SYSTEM FLAGS TABLE
-- ==============================================================================
CREATE TABLE system_flags (
  flag_name VARCHAR(100) PRIMARY KEY,
  flag_value BOOLEAN DEFAULT false,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ==============================================================================
-- PERFORMANCE INDEXES
-- ==============================================================================

-- Primary search and filter indexes
CREATE INDEX idx_cruises_cruise_line_id ON cruises(cruise_line_id);
CREATE INDEX idx_cruises_ship_id ON cruises(ship_id);
CREATE INDEX idx_cruises_sailing_date ON cruises(sailing_date);
CREATE INDEX idx_cruises_embarkation_port ON cruises(embarkation_port_id);
CREATE INDEX idx_cruises_active_future ON cruises(is_active, sailing_date)
  WHERE is_active = true;
CREATE INDEX idx_cruises_needs_update ON cruises(needs_price_update)
  WHERE needs_price_update = true;
CREATE INDEX idx_cruises_cheapest_price ON cruises(cheapest_price)
  WHERE cheapest_price IS NOT NULL;
CREATE INDEX idx_cruises_nights ON cruises(nights);

-- JSON/JSONB indexes for complex queries (GIN indexes for fast containment queries)
CREATE INDEX idx_cruises_raw_data_gin ON cruises USING GIN(raw_data);
CREATE INDEX idx_cruises_cabins_gin ON cruises USING GIN(cabins_data);
CREATE INDEX idx_cruises_pricing_gin ON cruises USING GIN(cheapest_pricing);
CREATE INDEX idx_cruises_itinerary_gin ON cruises USING GIN(itinerary_data);
CREATE INDEX idx_cruises_ports_gin ON cruises USING GIN(ports_data);
CREATE INDEX idx_cruises_regions_gin ON cruises USING GIN(regions_data);

-- Itinerary indexes
CREATE INDEX idx_itinerary_cruise_day ON cruise_itinerary(cruise_id, day_number);
CREATE INDEX idx_itinerary_port ON cruise_itinerary(port_id);

-- Ship and cabin indexes
CREATE INDEX idx_ships_cruise_line ON ships(cruise_line_id);
CREATE INDEX idx_cabins_ship_type ON cabin_categories(ship_id, cabin_type);
CREATE INDEX idx_cabin_locations_ship ON cabin_deck_locations(ship_id);

-- Pricing indexes
CREATE INDEX idx_pricing_cruise_source ON detailed_pricing(cruise_id, pricing_source);

-- Reference table indexes
CREATE INDEX idx_ports_name ON ports(name);
CREATE INDEX idx_regions_name ON regions(name);

-- ==============================================================================
-- INSERT INITIAL SYSTEM FLAGS
-- ==============================================================================
INSERT INTO system_flags (flag_name, flag_value, description) VALUES
('batch_sync_paused', false, 'Pauses batch sync operations during manual syncing'),
('webhook_processing_paused', false, 'Pauses webhook processing during maintenance'),
('initial_sync_completed', false, 'Marks if initial FTP sync has been completed'),
('schema_version', true, 'Schema version - complete enhanced structure v1.0');

-- ==============================================================================
-- VERIFICATION AND SUCCESS MESSAGE
-- ==============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ COMPLETE ENHANCED TRAVELTEK SCHEMA CREATED SUCCESSFULLY';
    RAISE NOTICE '================================================================';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Tables Created with Complete Data Preservation:';
    RAISE NOTICE '   • cruise_lines (with raw_line_content JSONB)';
    RAISE NOTICE '   • ships (with raw_ship_content JSONB)';
    RAISE NOTICE '   • ports (with raw_port_data JSONB)';
    RAISE NOTICE '   • regions (with raw_region_data JSONB)';
    RAISE NOTICE '   • cruises (with raw_data + all nested JSONB columns)';
    RAISE NOTICE '   • cruise_itinerary (with raw_itinerary_data JSONB)';
    RAISE NOTICE '   • cabin_categories (with raw_cabin_data JSONB)';
    RAISE NOTICE '   • cabin_deck_locations (with raw_location_data JSONB)';
    RAISE NOTICE '   • alternative_sailings (with raw_sailing_data JSONB)';
    RAISE NOTICE '   • detailed_pricing (with raw_pricing_data JSONB)';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Key Features Implemented:';
    RAISE NOTICE '   • ZERO DATA LOSS - Complete JSON preservation in raw_data columns';
    RAISE NOTICE '   • Structured fields for lightning-fast queries';
    RAISE NOTICE '   • JSONB columns for all nested objects (itinerary, cabins, etc.)';
    RAISE NOTICE '   • Comprehensive pricing from all sources (static, cached, combined)';
    RAISE NOTICE '   • Complete ship specifications with images';
    RAISE NOTICE '   • Full daily itinerary with port coordinates';
    RAISE NOTICE '   • Detailed cabin categories with deck locations';
    RAISE NOTICE '   • Alternative sailing options';
    RAISE NOTICE '   • System flags for operational control';
    RAISE NOTICE '';
    RAISE NOTICE '⚡ Performance Features:';
    RAISE NOTICE '   • GIN indexes on all JSONB columns for complex queries';
    RAISE NOTICE '   • Composite indexes for common search patterns';
    RAISE NOTICE '   • Partial indexes for active/future cruises';
    RAISE NOTICE '   • Optimized indexes for pricing queries';
    RAISE NOTICE '';
    RAISE NOTICE '💾 Data Storage Philosophy:';
    RAISE NOTICE '   • Raw JSON in JSONB columns (complete preservation)';
    RAISE NOTICE '   • Extracted fields in regular columns (fast queries)';
    RAISE NOTICE '   • Best of both worlds: speed + flexibility';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Ready for Complete FTP Sync!';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Run: node scripts/sync-complete-enhanced.js';
    RAISE NOTICE '2. Monitor: node scripts/check-database-data.js';
    RAISE NOTICE '3. Test API with rich data: curl /api/v1/cruises?limit=1';
END $$;
`;

/**
 * Execute the schema creation
 */
async function createCompleteEnhancedSchema() {
  console.log('🚀 Creating Complete Enhanced Traveltek Schema');
  console.log('===============================================');
  console.log('');
  console.log('This will create a comprehensive schema that captures:');
  console.log('• 100% of Traveltek JSON data (zero data loss)');
  console.log('• Fast structured queries + flexible JSON queries');
  console.log('• Complete ship, cabin, itinerary, and pricing data');
  console.log('• Performance indexes for production workloads');
  console.log('');

  const databaseUrl = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ Error: DATABASE_URL not found in environment variables');
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('render.com') ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('📡 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully');
    console.log('');

    console.log('🔨 Executing complete schema creation...');
    console.log('⚠️  This will drop existing tables and recreate them');
    console.log('');

    // Execute the complete schema
    await client.query(COMPLETE_TRAVELTEK_SCHEMA);

    console.log('');
    console.log('✅ COMPLETE ENHANCED SCHEMA CREATED SUCCESSFULLY!');
    console.log('================================================');
    console.log('');
    console.log('📊 Schema Features:');
    console.log('   • All Traveltek fields mapped to structured columns');
    console.log('   • Complete JSON preservation in JSONB columns');
    console.log('   • Performance indexes for fast queries');
    console.log('   • Zero data loss architecture');
    console.log('');
    console.log('🔄 Next Steps:');
    console.log('   1. Run: node scripts/sync-complete-enhanced.js');
    console.log('   2. Verify: node scripts/check-database-data.js');
    console.log('   3. Test: curl $API_URL/v1/cruises?limit=1');
    console.log('');
  } catch (error) {
    console.error('❌ Error creating schema:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the schema creation
if (require.main === module) {
  createCompleteEnhancedSchema().catch(console.error);
}

module.exports = { createCompleteEnhancedSchema };
