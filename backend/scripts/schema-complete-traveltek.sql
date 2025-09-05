-- Complete Traveltek Schema - Stores ALL JSON Data
-- This schema captures the complete Traveltek JSON structure without data loss
-- Date: 2025-01-14

-- ==============================================================================
-- CRUISE LINES TABLE - Enhanced with all Traveltek linecontent fields
-- ==============================================================================
CREATE TABLE IF NOT EXISTS cruise_lines (
  id INTEGER PRIMARY KEY,                    -- Traveltek lineid
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50),                         -- linecontent.code
  engine_name VARCHAR(100),                 -- linecontent.enginename
  short_name VARCHAR(100),                  -- linecontent.shortname
  nice_url VARCHAR(255),                    -- linecontent.niceurl
  logo VARCHAR(500),                        -- linecontent.logo
  description TEXT,                         -- linecontent.description
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ==============================================================================
-- SHIPS TABLE - Enhanced with all Traveltek shipcontent fields
-- ==============================================================================
CREATE TABLE IF NOT EXISTS ships (
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
  length NUMERIC,                          -- shipcontent.length
  beam NUMERIC,                            -- shipcontent.beam
  draft NUMERIC,                           -- shipcontent.draft
  speed NUMERIC,                           -- shipcontent.speed
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
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ==============================================================================
-- PORTS TABLE - Enhanced with all port information
-- ==============================================================================
CREATE TABLE IF NOT EXISTS ports (
  id INTEGER PRIMARY KEY,                  -- Traveltek portid
  name VARCHAR(255) NOT NULL,
  code VARCHAR(10),
  country VARCHAR(100),
  region VARCHAR(100),
  latitude NUMERIC,
  longitude NUMERIC,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ==============================================================================
-- REGIONS TABLE - For cruise regions
-- ==============================================================================
CREATE TABLE IF NOT EXISTS regions (
  id INTEGER PRIMARY KEY,                  -- Traveltek region id
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ==============================================================================
-- CRUISES TABLE - Complete Traveltek structure with ALL fields
-- ==============================================================================
CREATE TABLE IF NOT EXISTS cruises (
  -- Primary identifiers
  id VARCHAR(50) PRIMARY KEY,              -- codetocruiseid (unique sailing ID)
  cruise_id VARCHAR(50),                   -- cruiseid (base cruise ID)
  cruise_line_id INTEGER REFERENCES cruise_lines(id) NOT NULL,
  ship_id INTEGER REFERENCES ships(id) NOT NULL,

  -- Basic cruise information
  name VARCHAR(500),                       -- name
  voyage_code VARCHAR(50),                 -- voyagecode
  itinerary_code VARCHAR(50),              -- itinerarycode (can be object in JSON)

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
  market_id VARCHAR(50),                  -- marketid (can be "system")
  owner_id VARCHAR(50),                   -- ownerid (can be "system")

  -- Flight and logistics
  no_fly BOOLEAN DEFAULT false,           -- nofly "Y"/"N"
  depart_uk BOOLEAN DEFAULT false,        -- departuk "Y"/"N"
  show_cruise BOOLEAN DEFAULT true,       -- showcruise "Y"/"N"
  fly_cruise_info JSONB,                  -- flycruiseinfo (object)

  -- Pricing - Direct cheapest fields
  cheapest_price DECIMAL(10,2),           -- cheapestprice
  cheapest_inside DECIMAL(10,2),          -- cheapestinside (as number)
  cheapest_inside_price_code VARCHAR(50), -- cheapestinsidepricecode
  cheapest_outside DECIMAL(10,2),         -- cheapestoutside (as number)
  cheapest_outside_price_code VARCHAR(50), -- cheapestoutsidepricecode
  cheapest_balcony DECIMAL(10,2),         -- cheapestbalcony (as number)
  cheapest_balcony_price_code VARCHAR(50), -- cheapestbalconypricecode
  cheapest_suite DECIMAL(10,2),           -- cheapestsuite (as number)
  cheapest_suite_price_code VARCHAR(50),  -- cheapestsuitepricecode

  -- Pricing - Processed for quick access
  interior_price DECIMAL(10,2),           -- From cheapest.combined.inside
  oceanview_price DECIMAL(10,2),          -- From cheapest.combined.outside
  balcony_price DECIMAL(10,2),            -- From cheapest.combined.balcony
  suite_price DECIMAL(10,2),              -- From cheapest.combined.suite
  currency VARCHAR(3) DEFAULT 'USD',      -- Pricing currency

  -- Caching information
  last_cached BIGINT,                     -- lastcached (unix timestamp)
  cached_date VARCHAR(50),                -- cacheddate

  -- JSON storage for complex nested data
  raw_data JSONB,                         -- Complete original JSON
  cheapest_pricing JSONB,                 -- cheapest object with all pricing tiers
  cached_prices JSONB,                    -- cachedprices object
  prices_data JSONB,                      -- prices object
  itinerary_data JSONB,                   -- itinerary array
  cabins_data JSONB,                      -- cabins object with all cabin details
  ports_data JSONB,                       -- ports object
  regions_data JSONB,                     -- regions object
  alt_sailings JSONB,                     -- altsailings object
  line_content JSONB,                     -- linecontent object
  ship_content JSONB,                     -- shipcontent object

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
CREATE TABLE IF NOT EXISTS cruise_itinerary (
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
  latitude NUMERIC,                       -- latitude
  longitude NUMERIC,                      -- longitude
  description TEXT,                       -- description
  itinerary_description TEXT,             -- itinerarydescription
  short_description TEXT,                 -- shortdescription
  owner_id VARCHAR(50),                   -- ownerid
  supercedes INTEGER,                     -- supercedes
  idl_crossed BOOLEAN,                    -- idlcrossed
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ==============================================================================
-- CABIN CATEGORIES TABLE - Ship cabin types and details
-- ==============================================================================
CREATE TABLE IF NOT EXISTS cabin_categories (
  id VARCHAR(50) PRIMARY KEY,             -- id from cabins JSON
  ship_id INTEGER REFERENCES ships(id) NOT NULL,
  cabin_code VARCHAR(10) NOT NULL,        -- cabincode
  cabin_code2 VARCHAR(10),                -- cabincode2
  name VARCHAR(255) NOT NULL,             -- name
  description TEXT,                       -- description
  cabin_type VARCHAR(50),                 -- codtype (interior, balcony, suite, etc.)
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
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ==============================================================================
-- CABIN DECK LOCATIONS TABLE - Individual cabin positions
-- ==============================================================================
CREATE TABLE IF NOT EXISTS cabin_deck_locations (
  id SERIAL PRIMARY KEY,
  ship_id INTEGER REFERENCES ships(id) NOT NULL,
  cabin_number VARCHAR(20) NOT NULL,     -- cabinno
  x1 INTEGER,                            -- x1 coordinate
  y1 INTEGER,                            -- y1 coordinate
  x2 INTEGER,                            -- x2 coordinate
  y2 INTEGER,                            -- y2 coordinate
  deck_level INTEGER,                    -- inferred from position
  created_at TIMESTAMP DEFAULT NOW()
);

-- ==============================================================================
-- ALTERNATIVE SAILINGS TABLE - Related cruise options
-- ==============================================================================
CREATE TABLE IF NOT EXISTS alternative_sailings (
  id VARCHAR(50) PRIMARY KEY,            -- id from altsailings
  base_cruise_id VARCHAR(50) REFERENCES cruises(id),
  ship_id INTEGER REFERENCES ships(id),
  voyage_code VARCHAR(50),               -- voyagecode
  sail_date DATE,                        -- saildate
  start_date DATE,                       -- startdate
  lead_price DECIMAL(10,2),              -- leadprice
  created_at TIMESTAMP DEFAULT NOW()
);

-- ==============================================================================
-- DETAILED PRICING TABLE - All pricing tiers and codes
-- ==============================================================================
CREATE TABLE IF NOT EXISTS detailed_pricing (
  id SERIAL PRIMARY KEY,
  cruise_id VARCHAR(50) REFERENCES cruises(id) ON DELETE CASCADE,
  pricing_source VARCHAR(20) NOT NULL,   -- 'prices', 'cachedprices', 'combined'
  cabin_type VARCHAR(20) NOT NULL,       -- 'inside', 'outside', 'balcony', 'suite'
  price DECIMAL(10,2),                   -- price value
  price_code VARCHAR(50),                -- price code (e.g., 'GM241312')
  source_attribution VARCHAR(20),        -- source ('prices', 'cached', etc.)
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(cruise_id, pricing_source, cabin_type)
);

-- ==============================================================================
-- INDEXES FOR PERFORMANCE
-- ==============================================================================

-- Cruise indexes
CREATE INDEX IF NOT EXISTS idx_cruises_cruise_line_id ON cruises(cruise_line_id);
CREATE INDEX IF NOT EXISTS idx_cruises_ship_id ON cruises(ship_id);
CREATE INDEX IF NOT EXISTS idx_cruises_sailing_date ON cruises(sailing_date);
CREATE INDEX IF NOT EXISTS idx_cruises_embarkation_port ON cruises(embarkation_port_id);
CREATE INDEX IF NOT EXISTS idx_cruises_active_future ON cruises(is_active, sailing_date) WHERE is_active = true AND sailing_date >= CURRENT_DATE;
CREATE INDEX IF NOT EXISTS idx_cruises_needs_update ON cruises(needs_price_update) WHERE needs_price_update = true;
CREATE INDEX IF NOT EXISTS idx_cruises_cheapest_price ON cruises(cheapest_price) WHERE cheapest_price IS NOT NULL;

-- JSON indexes for complex queries
CREATE INDEX IF NOT EXISTS idx_cruises_raw_data_gin ON cruises USING GIN(raw_data);
CREATE INDEX IF NOT EXISTS idx_cruises_cabins_gin ON cruises USING GIN(cabins_data);
CREATE INDEX IF NOT EXISTS idx_cruises_pricing_gin ON cruises USING GIN(cheapest_pricing);
CREATE INDEX IF NOT EXISTS idx_cruises_itinerary_gin ON cruises USING GIN(itinerary_data);

-- Itinerary indexes
CREATE INDEX IF NOT EXISTS idx_itinerary_cruise_day ON cruise_itinerary(cruise_id, day_number);
CREATE INDEX IF NOT EXISTS idx_itinerary_port ON cruise_itinerary(port_id);

-- Cabin indexes
CREATE INDEX IF NOT EXISTS idx_cabins_ship_type ON cabin_categories(ship_id, cabin_type);
CREATE INDEX IF NOT EXISTS idx_cabin_locations_ship ON cabin_deck_locations(ship_id);

-- Pricing indexes
CREATE INDEX IF NOT EXISTS idx_pricing_cruise_source ON detailed_pricing(cruise_id, pricing_source);

-- ==============================================================================
-- SYSTEM FLAGS TABLE (if not exists)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS system_flags (
  flag_name VARCHAR(100) PRIMARY KEY,
  flag_value BOOLEAN DEFAULT false,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ==============================================================================
-- VERIFICATION QUERIES
-- ==============================================================================

-- Show table structure summary
DO $$
BEGIN
    RAISE NOTICE '✅ Complete Traveltek Schema Created Successfully';
    RAISE NOTICE '================================================';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Tables Created:';
    RAISE NOTICE '   • cruise_lines (enhanced with linecontent fields)';
    RAISE NOTICE '   • ships (enhanced with shipcontent fields)';
    RAISE NOTICE '   • ports (with coordinates and descriptions)';
    RAISE NOTICE '   • regions (cruise regions)';
    RAISE NOTICE '   • cruises (complete with ALL Traveltek fields + JSONB storage)';
    RAISE NOTICE '   • cruise_itinerary (daily itinerary details)';
    RAISE NOTICE '   • cabin_categories (ship cabin types and images)';
    RAISE NOTICE '   • cabin_deck_locations (individual cabin positions)';
    RAISE NOTICE '   • alternative_sailings (related cruise options)';
    RAISE NOTICE '   • detailed_pricing (all pricing tiers and codes)';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Key Features:';
    RAISE NOTICE '   • Complete JSON preservation in raw_data column';
    RAISE NOTICE '   • Structured fields for fast queries';
    RAISE NOTICE '   • Nested data in JSONB columns for flexibility';
    RAISE NOTICE '   • Comprehensive pricing from all sources';
    RAISE NOTICE '   • Full itinerary with port details';
    RAISE NOTICE '   • Complete cabin information with images';
    RAISE NOTICE '   • Ship specifications and images';
    RAISE NOTICE '   • Alternative sailing options';
    RAISE NOTICE '   • Performance indexes on key fields';
    RAISE NOTICE '';
    RAISE NOTICE '⚡ Performance Features:';
    RAISE NOTICE '   • GIN indexes on JSONB columns for complex queries';
    RAISE NOTICE '   • Composite indexes for common query patterns';
    RAISE NOTICE '   • Partial indexes for active/future cruises';
    RAISE NOTICE '';
    RAISE NOTICE '💾 Data Storage:';
    RAISE NOTICE '   • NO DATA LOSS - Complete JSON preserved';
    RAISE NOTICE '   • Fast structured queries on common fields';
    RAISE NOTICE '   • Complex JSON queries when needed';
    RAISE NOTICE '   • Rich cabin and itinerary details';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Ready for comprehensive FTP sync!';
END$$;
