#!/usr/bin/env node

/**
 * Enhanced Database Schema Recreation Script
 * Updated with complete Traveltek field mappings
 * Based on official API documentation and field reference
 * Date: 2025-09-04
 */

const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const SQL_SCHEMA = `
-- Drop existing tables (in reverse dependency order)
DROP TABLE IF EXISTS saved_searches CASCADE;
DROP TABLE IF EXISTS quote_requests CASCADE;
DROP TABLE IF EXISTS price_trends CASCADE;
DROP TABLE IF EXISTS price_history CASCADE;
DROP TABLE IF EXISTS cheapest_pricing CASCADE;
DROP TABLE IF EXISTS pricing CASCADE;
DROP TABLE IF EXISTS cabin_categories CASCADE;
DROP TABLE IF EXISTS itineraries CASCADE;
DROP TABLE IF EXISTS alternative_sailings CASCADE;
DROP TABLE IF EXISTS cruise_sailings CASCADE;
DROP TABLE IF EXISTS cruise_definitions CASCADE;
DROP TABLE IF EXISTS cruises CASCADE;
DROP TABLE IF EXISTS regions CASCADE;
DROP TABLE IF EXISTS ports CASCADE;
DROP TABLE IF EXISTS ships CASCADE;
DROP TABLE IF EXISTS cruise_lines CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table
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

-- Cruise Lines table (enhanced with complete Traveltek fields)
CREATE TABLE cruise_lines (
  id INTEGER PRIMARY KEY, -- Traveltek lineid
  name VARCHAR(255) NOT NULL, -- linecontent.name
  code VARCHAR(50), -- linecontent.code or generated
  description TEXT, -- linecontent.description
  engine_name VARCHAR(255), -- linecontent.enginename
  short_name VARCHAR(50), -- linecontent.shortname
  title VARCHAR(255), -- linecontent.title
  nice_url VARCHAR(255),
  logo VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Ships table (enhanced with complete Traveltek fields)
CREATE TABLE ships (
  id INTEGER PRIMARY KEY, -- Traveltek shipid
  cruise_line_id INTEGER REFERENCES cruise_lines(id) NOT NULL,
  name VARCHAR(255) NOT NULL, -- shipcontent.name
  nice_name VARCHAR(255), -- shipcontent.nicename
  short_name VARCHAR(100), -- shipcontent.shortname
  code VARCHAR(50), -- shipcontent.code
  tonnage INTEGER, -- shipcontent.tonnage
  total_cabins INTEGER, -- shipcontent.totalcabins
  max_passengers INTEGER, -- shipcontent.maxpassengers
  crew INTEGER, -- shipcontent.crew
  length DECIMAL(10,2), -- shipcontent.length (meters)
  beam DECIMAL(10,2), -- shipcontent.beam (meters)
  draft DECIMAL(10,2), -- shipcontent.draft (meters)
  speed DECIMAL(5,2), -- shipcontent.speed (knots)
  registry VARCHAR(100), -- shipcontent.registry
  built_year INTEGER, -- shipcontent.builtyear
  refurbished_year INTEGER, -- shipcontent.refurbishedyear
  description TEXT, -- shipcontent.description
  star_rating INTEGER,
  adults_only BOOLEAN DEFAULT false,
  ship_class VARCHAR(100),
  default_ship_image VARCHAR(500),
  default_ship_image_hd VARCHAR(500),
  default_ship_image_2k VARCHAR(500),
  nice_url VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Ports table (enhanced)
CREATE TABLE ports (
  id VARCHAR(50) PRIMARY KEY, -- Port ID from Traveltek (string)
  name VARCHAR(255) NOT NULL, -- Port name
  code VARCHAR(10), -- Generated or from port details
  country VARCHAR(100), -- From port details map
  region VARCHAR(100), -- From region mapping
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Regions table (enhanced)
CREATE TABLE regions (
  id VARCHAR(50) PRIMARY KEY, -- Region ID from Traveltek (string)
  name VARCHAR(255) NOT NULL, -- Region name
  parent_region_id VARCHAR(50) REFERENCES regions(id),
  description TEXT,
  code VARCHAR(10),
  display_order INTEGER DEFAULT 0,
  is_popular BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Main Cruises table (complete Traveltek field mapping)
CREATE TABLE cruises (
  -- Primary identifiers
  id VARCHAR PRIMARY KEY, -- codetocruiseid from Traveltek (unique per sailing)
  cruise_id VARCHAR, -- cruiseid from Traveltek (can duplicate)

  -- Foreign keys
  cruise_line_id INTEGER REFERENCES cruise_lines(id) NOT NULL, -- lineid
  ship_id INTEGER REFERENCES ships(id) NOT NULL, -- shipid

  -- Basic cruise information
  name VARCHAR(500), -- name
  voyage_code VARCHAR(50), -- voyagecode
  itinerary_code VARCHAR(50), -- itinerarycode

  -- Dates and duration
  sailing_date DATE NOT NULL, -- saildate/startdate
  return_date DATE, -- calculated from sailing_date + nights
  nights INTEGER, -- nights
  sail_nights INTEGER, -- sailnights
  sea_days INTEGER, -- seadays

  -- Ports
  embarkation_port_id VARCHAR(50), -- startportid (string from Traveltek)
  disembarkation_port_id VARCHAR(50), -- endportid (string from Traveltek)

  -- Arrays stored as strings (for backward compatibility)
  port_ids VARCHAR(500), -- portids array as comma-separated
  region_ids VARCHAR(200), -- regionids array as comma-separated
  ports TEXT, -- ports array as JSON string
  regions TEXT, -- regions array as JSON string

  -- Market and owner
  market_id VARCHAR(50), -- marketid (string from Traveltek)
  owner_id VARCHAR(50), -- ownerid (string from Traveltek)

  -- Flags
  no_fly BOOLEAN DEFAULT false, -- nofly ("Y"/"N" -> boolean)
  depart_uk BOOLEAN DEFAULT false, -- departuk
  show_cruise BOOLEAN DEFAULT true, -- showcruise

  -- Additional info
  fly_cruise_info TEXT, -- flycruiseinfo
  line_content TEXT, -- linecontent as JSON string
  ship_content TEXT, -- shipcontent as JSON string

  -- Cache metadata
  last_cached INTEGER, -- lastcached (Unix timestamp)
  cached_date VARCHAR(100), -- cacheddate

  -- Pricing columns (from cheapest object)
  interior_price DECIMAL(10, 2), -- cheapest.inside or cheapestinside
  oceanview_price DECIMAL(10, 2), -- cheapest.outside or cheapestoutside
  balcony_price DECIMAL(10, 2), -- cheapest.balcony or cheapestbalcony
  suite_price DECIMAL(10, 2), -- cheapest.suite or cheapestsuite
  cheapest_price DECIMAL(10, 2), -- MIN of all prices

  -- Price codes
  interior_price_code VARCHAR(50), -- cheapestinsidepricecode
  oceanview_price_code VARCHAR(50), -- cheapestoutsidepricecode
  balcony_price_code VARCHAR(50), -- cheapestbalconypricecode
  suite_price_code VARCHAR(50), -- cheapestsuitepricecode

  -- Processing flags
  needs_price_update BOOLEAN DEFAULT false,
  processing_started_at TIMESTAMP,
  processing_completed_at TIMESTAMP,

  -- Metadata
  currency VARCHAR(3) DEFAULT 'USD', -- from file path or data
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Alternative Sailings table (from altsailings array)
CREATE TABLE alternative_sailings (
  id SERIAL PRIMARY KEY,
  base_cruise_id VARCHAR REFERENCES cruises(id) NOT NULL,
  alternative_date DATE NOT NULL, -- altsailings[].date
  alternative_cruise_id INTEGER, -- altsailings[].cruiseid
  price DECIMAL(10, 2), -- altsailings[].price
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Itineraries table (from itinerary array)
CREATE TABLE itineraries (
  id SERIAL PRIMARY KEY,
  cruise_id VARCHAR REFERENCES cruises(id) NOT NULL,
  day_number INTEGER NOT NULL, -- itinerary[].day
  date DATE, -- itinerary[].date
  port_id VARCHAR(50) REFERENCES ports(id), -- itinerary[].portid (string)
  port_name VARCHAR(255), -- itinerary[].port
  arrival_time VARCHAR(10), -- itinerary[].arrive
  departure_time VARCHAR(10), -- itinerary[].depart
  description TEXT, -- itinerary[].description
  is_sea_day BOOLEAN DEFAULT false, -- itinerary[].seaday
  is_tender_port BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Cabin Categories table (from cabins object)
CREATE TABLE cabin_categories (
  ship_id INTEGER REFERENCES ships(id) NOT NULL,
  cabin_code VARCHAR(10) NOT NULL, -- Key from cabins object
  cabin_code_alt VARCHAR(10),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL, -- inside/oceanview/balcony/suite
  color_code VARCHAR(7),
  image_url VARCHAR(500),
  image_url_hd VARCHAR(500),
  image_url_2k VARCHAR(500),
  is_default BOOLEAN DEFAULT false,
  valid_from DATE,
  valid_to DATE,
  cabin_id VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  PRIMARY KEY (ship_id, cabin_code)
);

-- Main Pricing table (from prices and cachedprices objects)
CREATE TABLE pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cruise_id VARCHAR REFERENCES cruises(id) NOT NULL,

  -- Price identifiers
  rate_code VARCHAR(50) NOT NULL, -- Key from prices[ratecode]
  cabin_code VARCHAR(10) NOT NULL, -- Key from prices[ratecode][cabincode]
  occupancy_code VARCHAR(10) NOT NULL, -- Key from prices[ratecode][cabincode][occupancy]
  cabin_type VARCHAR(50), -- Derived from cabin category

  -- Base prices
  price DECIMAL(10, 2), -- price field
  base_price DECIMAL(10, 2), -- May be same as price

  -- Occupancy-specific prices
  adult_price DECIMAL(10, 2),
  child_price DECIMAL(10, 2),
  infant_price DECIMAL(10, 2),
  single_price DECIMAL(10, 2),
  third_adult_price DECIMAL(10, 2),
  fourth_adult_price DECIMAL(10, 2),

  -- Fees and taxes
  tax DECIMAL(10, 2), -- tax field
  taxes DECIMAL(10, 2), -- Alternative field name
  ncf DECIMAL(10, 2), -- ncf field (Non-Commissionable Fees)
  gratuities DECIMAL(10, 2), -- gratuities field
  gratuity DECIMAL(10, 2), -- Alternative field name
  fuel DECIMAL(10, 2),
  non_comm DECIMAL(10, 2),
  port_charges DECIMAL(10, 2),
  government_fees DECIMAL(10, 2),

  -- Totals
  total DECIMAL(10, 2), -- total field
  total_price DECIMAL(10, 2), -- Alternative field name
  commission DECIMAL(10, 2), -- commission field
  net_price DECIMAL(10, 2), -- netprice field

  -- Availability
  is_available BOOLEAN DEFAULT true,
  inventory INTEGER,
  waitlist BOOLEAN DEFAULT false,
  guarantee BOOLEAN DEFAULT false,

  -- Metadata
  price_source VARCHAR(20) DEFAULT 'static', -- 'static' from prices, 'cached' from cachedprices
  currency VARCHAR(3) DEFAULT 'USD', -- currency field
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Cheapest Pricing table (from cheapest object - denormalized for fast search)
CREATE TABLE cheapest_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cruise_id VARCHAR REFERENCES cruises(id) UNIQUE NOT NULL,

  -- Overall cheapest pricing
  cheapest_price DECIMAL(10, 2),
  cheapest_cabin_type VARCHAR(50),
  cheapest_taxes DECIMAL(10, 2),
  cheapest_ncf DECIMAL(10, 2),
  cheapest_gratuity DECIMAL(10, 2),
  cheapest_fuel DECIMAL(10, 2),
  cheapest_non_comm DECIMAL(10, 2),

  -- Interior pricing (from cheapest.inside or cheapestinside)
  interior_price DECIMAL(10, 2),
  interior_taxes DECIMAL(10, 2),
  interior_ncf DECIMAL(10, 2),
  interior_gratuity DECIMAL(10, 2),
  interior_fuel DECIMAL(10, 2),
  interior_non_comm DECIMAL(10, 2),
  interior_price_code VARCHAR(50), -- cheapestinsidepricecode

  -- Oceanview pricing (from cheapest.outside or cheapestoutside)
  oceanview_price DECIMAL(10, 2),
  oceanview_taxes DECIMAL(10, 2),
  oceanview_ncf DECIMAL(10, 2),
  oceanview_gratuity DECIMAL(10, 2),
  oceanview_fuel DECIMAL(10, 2),
  oceanview_non_comm DECIMAL(10, 2),
  oceanview_price_code VARCHAR(50), -- cheapestoutsidepricecode

  -- Balcony pricing (from cheapest.balcony or cheapestbalcony)
  balcony_price DECIMAL(10, 2),
  balcony_taxes DECIMAL(10, 2),
  balcony_ncf DECIMAL(10, 2),
  balcony_gratuity DECIMAL(10, 2),
  balcony_fuel DECIMAL(10, 2),
  balcony_non_comm DECIMAL(10, 2),
  balcony_price_code VARCHAR(50), -- cheapestbalconypricecode

  -- Suite pricing (from cheapest.suite or cheapestsuite)
  suite_price DECIMAL(10, 2),
  suite_taxes DECIMAL(10, 2),
  suite_ncf DECIMAL(10, 2),
  suite_gratuity DECIMAL(10, 2),
  suite_fuel DECIMAL(10, 2),
  suite_non_comm DECIMAL(10, 2),
  suite_price_code VARCHAR(50), -- cheapestsuitepricecode

  currency VARCHAR(3) DEFAULT 'USD',
  last_updated TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Price History table (for tracking changes)
CREATE TABLE price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cruise_id VARCHAR REFERENCES cruises(id) NOT NULL,

  -- Price identifiers (same as pricing table)
  rate_code VARCHAR(50) NOT NULL,
  cabin_code VARCHAR(10) NOT NULL,
  occupancy_code VARCHAR(10) NOT NULL,
  cabin_type VARCHAR(50),

  -- All price fields (snapshot)
  price DECIMAL(10, 2),
  base_price DECIMAL(10, 2),
  adult_price DECIMAL(10, 2),
  child_price DECIMAL(10, 2),
  infant_price DECIMAL(10, 2),
  single_price DECIMAL(10, 2),
  third_adult_price DECIMAL(10, 2),
  fourth_adult_price DECIMAL(10, 2),

  -- Fees and taxes
  tax DECIMAL(10, 2),
  taxes DECIMAL(10, 2),
  ncf DECIMAL(10, 2),
  gratuities DECIMAL(10, 2),
  gratuity DECIMAL(10, 2),
  fuel DECIMAL(10, 2),
  non_comm DECIMAL(10, 2),
  port_charges DECIMAL(10, 2),
  government_fees DECIMAL(10, 2),

  -- Totals
  total DECIMAL(10, 2),
  total_price DECIMAL(10, 2),
  commission DECIMAL(10, 2),
  net_price DECIMAL(10, 2),

  -- Availability
  is_available BOOLEAN DEFAULT true,
  inventory INTEGER,
  waitlist BOOLEAN DEFAULT false,
  guarantee BOOLEAN DEFAULT false,

  -- History metadata
  price_type VARCHAR(10) DEFAULT 'static',
  currency VARCHAR(3) DEFAULT 'USD',
  snapshot_date TIMESTAMP DEFAULT NOW() NOT NULL,
  change_type VARCHAR(20) NOT NULL,
  change_reason VARCHAR(100),
  price_change DECIMAL(10, 2),
  price_change_percent DECIMAL(5, 2),
  original_pricing_id UUID,
  batch_id UUID,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Price Trends table
CREATE TABLE price_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cruise_id VARCHAR REFERENCES cruises(id) NOT NULL,
  cabin_code VARCHAR(10) NOT NULL,
  rate_code VARCHAR(50) NOT NULL,
  trend_period VARCHAR(10) NOT NULL,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  start_price DECIMAL(10, 2),
  end_price DECIMAL(10, 2),
  min_price DECIMAL(10, 2),
  max_price DECIMAL(10, 2),
  avg_price DECIMAL(10, 2),
  total_change DECIMAL(10, 2),
  total_change_percent DECIMAL(5, 2),
  price_volatility DECIMAL(5, 2),
  trend_direction VARCHAR(15),
  change_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Quote Requests table
CREATE TABLE quote_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number VARCHAR(20) UNIQUE,
  user_id UUID REFERENCES users(id),
  cruise_id VARCHAR REFERENCES cruises(id) NOT NULL,
  cabin_code VARCHAR(10),
  cabin_type VARCHAR(50),
  passenger_count INTEGER NOT NULL,
  passenger_details JSONB DEFAULT '[]',
  special_requirements TEXT,
  contact_info JSONB NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(50),
  preferred_cabin_type VARCHAR(50),
  special_requests TEXT,
  preferences JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'waiting',
  total_price DECIMAL(10, 2),
  obc_amount DECIMAL(10, 2),
  commission DECIMAL(10, 2),
  notes TEXT,
  quote_response JSONB,
  quote_expires_at TIMESTAMP,
  quoted_at TIMESTAMP,
  booked_at TIMESTAMP,
  is_urgent BOOLEAN DEFAULT false,
  source VARCHAR(50) DEFAULT 'website',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Saved Searches table
CREATE TABLE saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  name VARCHAR(255) NOT NULL,
  search_criteria JSONB NOT NULL,
  alert_enabled BOOLEAN DEFAULT false,
  alert_frequency VARCHAR(20) DEFAULT 'weekly',
  last_checked TIMESTAMP,
  last_notified TIMESTAMP,
  results_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create comprehensive indexes for optimal performance
CREATE INDEX idx_cruises_cruise_line_id ON cruises(cruise_line_id);
CREATE INDEX idx_cruises_ship_id ON cruises(ship_id);
CREATE INDEX idx_cruises_sailing_date ON cruises(sailing_date);
CREATE INDEX idx_cruises_nights ON cruises(nights);
CREATE INDEX idx_cruises_needs_price_update ON cruises(needs_price_update);
CREATE INDEX idx_cruises_is_active ON cruises(is_active);
CREATE INDEX idx_cruises_embark_port ON cruises(embarkation_port_id);
CREATE INDEX idx_cruises_disembark_port ON cruises(disembarkation_port_id);
CREATE INDEX idx_cruises_cruise_id ON cruises(cruise_id); -- For lookups by original ID

CREATE INDEX idx_pricing_cruise_id ON pricing(cruise_id);
CREATE INDEX idx_pricing_rate_code ON pricing(rate_code);
CREATE INDEX idx_pricing_cabin_code ON pricing(cabin_code);
CREATE INDEX idx_pricing_occupancy ON pricing(occupancy_code);
CREATE INDEX idx_pricing_source ON pricing(price_source);

CREATE INDEX idx_cheapest_pricing_cruise_id ON cheapest_pricing(cruise_id);

CREATE INDEX idx_itineraries_cruise_id ON itineraries(cruise_id);
CREATE INDEX idx_itineraries_port_id ON itineraries(port_id);
CREATE INDEX idx_itineraries_day ON itineraries(day_number);

CREATE INDEX idx_alternative_sailings_base ON alternative_sailings(base_cruise_id);
CREATE INDEX idx_alternative_sailings_date ON alternative_sailings(alternative_date);

CREATE INDEX idx_ships_cruise_line_id ON ships(cruise_line_id);
CREATE INDEX idx_ships_name ON ships(name);

CREATE INDEX idx_ports_name ON ports(name);
CREATE INDEX idx_ports_country ON ports(country);

CREATE INDEX idx_regions_name ON regions(name);

CREATE INDEX idx_cabin_categories_ship_id ON cabin_categories(ship_id);
CREATE INDEX idx_cabin_categories_category ON cabin_categories(category);

CREATE INDEX idx_price_history_cruise_id ON price_history(cruise_id);
CREATE INDEX idx_price_history_snapshot_date ON price_history(snapshot_date);
CREATE INDEX idx_price_history_cruise_snapshot ON price_history(cruise_id, snapshot_date);
CREATE INDEX idx_price_history_rate_code ON price_history(rate_code);
CREATE INDEX idx_price_history_cabin_code ON price_history(cabin_code);
CREATE INDEX idx_price_history_change_type ON price_history(change_type);
CREATE INDEX idx_price_history_batch_id ON price_history(batch_id);

CREATE INDEX idx_price_trends_cruise_id ON price_trends(cruise_id);
CREATE INDEX idx_price_trends_period ON price_trends(trend_period, period_start);
CREATE INDEX idx_price_trends_direction ON price_trends(trend_direction);

CREATE INDEX idx_quote_requests_user_id ON quote_requests(user_id);
CREATE INDEX idx_quote_requests_cruise_id ON quote_requests(cruise_id);
CREATE INDEX idx_quote_requests_status ON quote_requests(status);
CREATE INDEX idx_quote_requests_reference_number ON quote_requests(reference_number);

CREATE INDEX idx_saved_searches_user_id ON saved_searches(user_id);
CREATE INDEX idx_saved_searches_is_active ON saved_searches(is_active);

-- Create update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update timestamp trigger to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cruise_lines_updated_at BEFORE UPDATE ON cruise_lines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ships_updated_at BEFORE UPDATE ON ships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ports_updated_at BEFORE UPDATE ON ports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_regions_updated_at BEFORE UPDATE ON regions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cruises_updated_at BEFORE UPDATE ON cruises
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_itineraries_updated_at BEFORE UPDATE ON itineraries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cabin_categories_updated_at BEFORE UPDATE ON cabin_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pricing_updated_at BEFORE UPDATE ON pricing
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_price_trends_updated_at BEFORE UPDATE ON price_trends
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quote_requests_updated_at BEFORE UPDATE ON quote_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_saved_searches_updated_at BEFORE UPDATE ON saved_searches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;

async function recreateSchema() {
  const databaseUrl = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ No database URL found in environment variables');
    console.error('Please set DATABASE_URL or DATABASE_URL_PRODUCTION');
    process.exit(1);
  }

  const isRender = databaseUrl.includes('render.com');

  console.log('🔄 Enhanced Database Schema Recreation Tool');
  console.log('==========================================');
  console.log(`📍 Target: ${isRender ? 'Render Production' : 'Local'}`);
  console.log(`🔗 Database: ${databaseUrl.split('@')[1]?.split('/')[0] || 'Unknown'}`);
  console.log('');

  // Warning message
  console.log('⚠️  WARNING: This will DROP and RECREATE all tables!');
  console.log('⚠️  All existing data will be PERMANENTLY DELETED!');
  console.log('');
  console.log('✨ This enhanced schema includes:');
  console.log('  - Complete Traveltek field mappings');
  console.log('  - All pricing structures (static, cached, cheapest)');
  console.log('  - Full itinerary support');
  console.log('  - Alternative sailings');
  console.log('  - Enhanced ship and cruise line fields');
  console.log('');
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');

  // Wait 5 seconds before proceeding
  await new Promise(resolve => setTimeout(resolve, 5000));

  const client = new Client({
    connectionString: databaseUrl,
    ssl: isRender ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();

    console.log('🗑️  Dropping existing tables...');
    console.log('🏗️  Creating enhanced schema...');

    // Execute the schema
    await client.query(SQL_SCHEMA);

    console.log('✅ Enhanced schema recreated successfully!');
    console.log('');
    console.log('📊 Created tables:');
    console.log('  - users');
    console.log('  - cruise_lines (with complete Traveltek fields)');
    console.log('  - ships (with all shipcontent fields)');
    console.log('  - ports');
    console.log('  - regions');
    console.log('  - cruises (complete field mapping)');
    console.log('  - alternative_sailings (from altsailings)');
    console.log('  - itineraries (from itinerary array)');
    console.log('  - cabin_categories');
    console.log('  - pricing (static and cached prices)');
    console.log('  - cheapest_pricing (denormalized)');
    console.log('  - price_history');
    console.log('  - price_trends');
    console.log('  - quote_requests');
    console.log('  - saved_searches');
    console.log('');
    console.log('🔍 Key enhancements:');
    console.log('  ✓ Complete Traveltek field mappings');
    console.log('  ✓ Support for all pricing structures');
    console.log('  ✓ Price codes for cheapest cabins');
    console.log('  ✓ Ship details (tonnage, crew, dimensions)');
    console.log('  ✓ Alternative sailing dates');
    console.log('  ✓ Full itinerary with sea days');
    console.log('  ✓ Comprehensive indexes for performance');
    console.log('');
    console.log('📝 Next steps:');
    console.log('  1. Run initial FTP sync script');
    console.log('  2. Populate data from 2025/09/*');
    console.log('  3. Verify data integrity');
  } catch (error) {
    console.error('❌ Error recreating schema:', error.message);
    if (error.detail) {
      console.error('Details:', error.detail);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Check if running directly
if (require.main === module) {
  recreateSchema();
}

module.exports = { recreateSchema, SQL_SCHEMA };
