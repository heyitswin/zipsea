-- Fix for cruise table primary key issue
-- The problem: Using cruiseid as PRIMARY KEY but it's not unique across sailings
-- The solution: Use code_to_cruise_id as PRIMARY KEY since it's unique per sailing

-- Step 1: Create new table with correct structure
CREATE TABLE IF NOT EXISTS cruises_new (
  id INTEGER PRIMARY KEY, -- This will be code_to_cruise_id (unique per sailing)
  cruise_id INTEGER NOT NULL, -- The cruiseid from Traveltek (can be duplicated)
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
  port_ids VARCHAR(500), -- Comma-separated string per API
  region_ids VARCHAR(500), -- Comma-separated string per API
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
);

-- Step 2: Create indexes for the new table
CREATE INDEX idx_cruises_cruise_id ON cruises_new(cruise_id); -- For grouping same cruises
CREATE INDEX idx_cruises_sailing_date ON cruises_new(sailing_date);
CREATE INDEX idx_cruises_cruise_line_id ON cruises_new(cruise_line_id);
CREATE INDEX idx_cruises_ship_id ON cruises_new(ship_id);
CREATE INDEX idx_cruises_voyage_code ON cruises_new(voyage_code);

-- Step 3: Migrate existing data (if any)
-- This maps the old structure to the new one
INSERT INTO cruises_new (
  id, -- code_to_cruise_id becomes the primary key
  cruise_id, -- original cruiseid stored as regular field
  cruise_line_id, ship_id, name, voyage_code, itinerary_code,
  sailing_date, start_date, nights, sail_nights, sea_days,
  embark_port_id, disembark_port_id, port_ids, region_ids,
  market_id, owner_id, no_fly, depart_uk, show_cruise,
  fly_cruise_info, last_cached, cached_date, traveltek_file_path,
  is_active, created_at, updated_at
)
SELECT 
  code_to_cruise_id as id, -- Use code_to_cruise_id as the new primary key
  id as cruise_id, -- Store the original cruiseid as cruise_id field
  cruise_line_id, ship_id, name, voyage_code, itinerary_code,
  sailing_date, start_date, nights, sail_nights, sea_days,
  embark_port_id, disembark_port_id, port_ids, region_ids,
  market_id, owner_id, no_fly, depart_uk, show_cruise,
  fly_cruise_info, last_cached, cached_date, traveltek_file_path,
  is_active, created_at, updated_at
FROM cruises
ON CONFLICT (id) DO NOTHING;

-- Step 4: Update foreign key references in other tables
-- They should now reference code_to_cruise_id instead of cruiseid

-- Update itineraries
ALTER TABLE itineraries DROP CONSTRAINT IF EXISTS itineraries_cruise_id_fkey;
ALTER TABLE itineraries ADD CONSTRAINT itineraries_cruise_id_fkey 
  FOREIGN KEY (cruise_id) REFERENCES cruises_new(id);

-- Update static_prices
ALTER TABLE static_prices DROP CONSTRAINT IF EXISTS static_prices_cruise_id_fkey;
ALTER TABLE static_prices ADD CONSTRAINT static_prices_cruise_id_fkey 
  FOREIGN KEY (cruise_id) REFERENCES cruises_new(id);

-- Update cached_prices
ALTER TABLE cached_prices DROP CONSTRAINT IF EXISTS cached_prices_cruise_id_fkey;
ALTER TABLE cached_prices ADD CONSTRAINT cached_prices_cruise_id_fkey 
  FOREIGN KEY (cruise_id) REFERENCES cruises_new(id);

-- Update cheapest_prices
ALTER TABLE cheapest_prices DROP CONSTRAINT IF EXISTS cheapest_prices_cruise_id_fkey;
ALTER TABLE cheapest_prices ADD CONSTRAINT cheapest_prices_cruise_id_fkey 
  FOREIGN KEY (cruise_id) REFERENCES cruises_new(id);

-- Update price_snapshots
ALTER TABLE price_snapshots DROP CONSTRAINT IF EXISTS price_snapshots_cruise_id_fkey;
ALTER TABLE price_snapshots ADD CONSTRAINT price_snapshots_cruise_id_fkey 
  FOREIGN KEY (cruise_id) REFERENCES cruises_new(id);

-- Step 5: Rename tables
ALTER TABLE cruises RENAME TO cruises_old;
ALTER TABLE cruises_new RENAME TO cruises;

-- Step 6: Create a view for backward compatibility if needed
-- This view shows all sailings grouped by cruise_id
CREATE OR REPLACE VIEW cruise_sailings_view AS
SELECT 
  cruise_id,
  array_agg(id ORDER BY sailing_date) as sailing_ids,
  array_agg(sailing_date ORDER BY sailing_date) as sailing_dates,
  MIN(sailing_date) as first_sailing,
  MAX(sailing_date) as last_sailing,
  COUNT(*) as total_sailings,
  name,
  cruise_line_id,
  ship_id,
  nights,
  port_ids,
  region_ids
FROM cruises
WHERE is_active = true
GROUP BY cruise_id, name, cruise_line_id, ship_id, nights, port_ids, region_ids;

-- Step 7: Drop old table (after verifying everything works)
-- DROP TABLE cruises_old;

-- Usage in sync scripts:
-- INSERT INTO cruises (id, cruise_id, ...) 
-- VALUES (codetocruiseid, cruiseid, ...)
-- ON CONFLICT (id) DO UPDATE SET ...