-- PRODUCTION-SAFE MIGRATION: Fix cruise table primary key issue
-- Problem: cruiseid is NOT unique across sailings, code_to_cruise_id IS unique
-- Solution: Restructure to use code_to_cruise_id as primary key
-- 
-- CRITICAL: This migration is designed to run on LIVE PRODUCTION DATA
-- 
-- =====================================================================
-- EXECUTION PLAN:
-- 1. Create new table with correct schema
-- 2. Migrate all existing data with proper mapping
-- 3. Update all foreign key references atomically
-- 4. Swap tables atomically
-- 5. Create verification queries
-- =====================================================================

BEGIN;

-- =====================================================================
-- STEP 1: BACKUP AND VALIDATION
-- =====================================================================

-- Validate current data integrity before migration
DO $$
DECLARE
    duplicate_count integer;
    total_count integer;
    null_count integer;
BEGIN
    -- Check for duplicate code_to_cruise_id values (should be 0)
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT code_to_cruise_id, COUNT(*) 
        FROM cruises 
        WHERE code_to_cruise_id IS NOT NULL
        GROUP BY code_to_cruise_id 
        HAVING COUNT(*) > 1
    ) duplicates;
    
    -- Check for NULL code_to_cruise_id values
    SELECT COUNT(*) INTO null_count
    FROM cruises 
    WHERE code_to_cruise_id IS NULL OR code_to_cruise_id = '';
    
    -- Get total count
    SELECT COUNT(*) INTO total_count FROM cruises;
    
    RAISE NOTICE 'MIGRATION VALIDATION:';
    RAISE NOTICE '  Total cruises: %', total_count;
    RAISE NOTICE '  Duplicate code_to_cruise_id: %', duplicate_count;
    RAISE NOTICE '  NULL code_to_cruise_id: %', null_count;
    
    -- Abort if we have critical data issues
    IF duplicate_count > 0 THEN
        RAISE EXCEPTION 'MIGRATION ABORTED: Found % duplicate code_to_cruise_id values. Clean data first!', duplicate_count;
    END IF;
    
    IF null_count > 0 THEN
        RAISE EXCEPTION 'MIGRATION ABORTED: Found % NULL code_to_cruise_id values. Clean data first!', null_count;
    END IF;
    
    RAISE NOTICE 'Data validation passed. Proceeding with migration...';
END $$;

-- =====================================================================
-- STEP 2: CREATE NEW TABLE WITH CORRECT SCHEMA
-- =====================================================================

CREATE TABLE IF NOT EXISTS cruises_new (
    id INTEGER PRIMARY KEY,                    -- This will store code_to_cruise_id (UNIQUE per sailing)
    cruise_id INTEGER NOT NULL,               -- This will store the original cruiseid (can be duplicated)
    cruise_line_id INTEGER NOT NULL,
    ship_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    itinerary_code VARCHAR(50),
    voyage_code VARCHAR(50),
    sailing_date DATE NOT NULL,
    return_date DATE,
    nights INTEGER NOT NULL,
    sail_nights INTEGER,
    sea_days INTEGER,
    embark_port_id INTEGER,
    disembark_port_id INTEGER,
    region_ids JSONB DEFAULT '[]',
    port_ids JSONB DEFAULT '[]',
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
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Add foreign key constraints
ALTER TABLE cruises_new ADD CONSTRAINT cruises_new_cruise_line_id_fk 
    FOREIGN KEY (cruise_line_id) REFERENCES cruise_lines(id);
ALTER TABLE cruises_new ADD CONSTRAINT cruises_new_ship_id_fk 
    FOREIGN KEY (ship_id) REFERENCES ships(id);
ALTER TABLE cruises_new ADD CONSTRAINT cruises_new_embark_port_id_fk 
    FOREIGN KEY (embark_port_id) REFERENCES ports(id);
ALTER TABLE cruises_new ADD CONSTRAINT cruises_new_disembark_port_id_fk 
    FOREIGN KEY (disembark_port_id) REFERENCES ports(id);

-- =====================================================================
-- STEP 3: MIGRATE DATA WITH PROPER MAPPING
-- =====================================================================

-- Migrate all cruise data with corrected primary key mapping
INSERT INTO cruises_new (
    id,                    -- code_to_cruise_id becomes the primary key
    cruise_id,             -- original cruiseid stored as regular field
    cruise_line_id, ship_id, name, itinerary_code, voyage_code,
    sailing_date, return_date, nights, sail_nights, sea_days,
    embark_port_id, disembark_port_id, region_ids, port_ids,
    market_id, owner_id, no_fly, depart_uk, show_cruise,
    fly_cruise_info, line_content, traveltek_file_path,
    last_cached, cached_date, currency, is_active, created_at, updated_at
)
SELECT 
    CAST(code_to_cruise_id AS INTEGER) as id,  -- Use code_to_cruise_id as primary key
    id as cruise_id,                           -- Store original cruiseid as cruise_id
    cruise_line_id, ship_id, name, itinerary_code, voyage_code,
    sailing_date, return_date, nights, sail_nights, sea_days,
    embark_port_id, disembark_port_id, region_ids, port_ids,
    market_id, owner_id, no_fly, depart_uk, show_cruise,
    fly_cruise_info, line_content, traveltek_file_path,
    last_cached, cached_date, currency, is_active, created_at, updated_at
FROM cruises
WHERE code_to_cruise_id IS NOT NULL 
  AND code_to_cruise_id != ''
  AND code_to_cruise_id ~ '^\d+$'  -- Ensure it's numeric
ORDER BY created_at;

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_cruises_new_cruise_id ON cruises_new(cruise_id);
CREATE INDEX IF NOT EXISTS idx_cruises_new_sailing_date ON cruises_new(sailing_date);
CREATE INDEX IF NOT EXISTS idx_cruises_new_cruise_line_id ON cruises_new(cruise_line_id);
CREATE INDEX IF NOT EXISTS idx_cruises_new_ship_id ON cruises_new(ship_id);
CREATE INDEX IF NOT EXISTS idx_cruises_new_voyage_code ON cruises_new(voyage_code);
CREATE INDEX IF NOT EXISTS idx_cruises_new_active ON cruises_new(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_cruises_new_file_path ON cruises_new(traveltek_file_path);

-- =====================================================================
-- STEP 4: CREATE MAPPING TABLE FOR FK UPDATES
-- =====================================================================

-- Create temporary mapping table for updating foreign keys
CREATE TEMPORARY TABLE cruise_id_mapping AS
SELECT 
    old_cruises.id as old_id,
    cruises_new.id as new_id,
    old_cruises.code_to_cruise_id
FROM cruises old_cruises
JOIN cruises_new ON cruises_new.id = CAST(old_cruises.code_to_cruise_id AS INTEGER);

-- =====================================================================
-- STEP 5: UPDATE ALL FOREIGN KEY REFERENCES
-- =====================================================================

-- Update itineraries table
UPDATE itineraries 
SET cruise_id = mapping.new_id
FROM cruise_id_mapping mapping
WHERE itineraries.cruise_id = mapping.old_id;

-- Update pricing table (if exists)
UPDATE pricing 
SET cruise_id = mapping.new_id
FROM cruise_id_mapping mapping
WHERE pricing.cruise_id = mapping.old_id;

-- Update cheapest_pricing table (if exists)
UPDATE cheapest_pricing 
SET cruise_id = mapping.new_id
FROM cruise_id_mapping mapping
WHERE cheapest_pricing.cruise_id = mapping.old_id;

-- Update static_prices table (if exists - from sync script)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'static_prices') THEN
        UPDATE static_prices 
        SET cruise_id = mapping.new_id
        FROM cruise_id_mapping mapping
        WHERE static_prices.cruise_id = mapping.old_id;
    END IF;
END $$;

-- Update cached_prices table (if exists - from sync script)  
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cached_prices') THEN
        UPDATE cached_prices 
        SET cruise_id = mapping.new_id
        FROM cruise_id_mapping mapping
        WHERE cached_prices.cruise_id = mapping.old_id;
    END IF;
END $$;

-- Update price_snapshots table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'price_snapshots') THEN
        UPDATE price_snapshots 
        SET cruise_id = mapping.new_id
        FROM cruise_id_mapping mapping
        WHERE price_snapshots.cruise_id = mapping.old_id;
    END IF;
END $$;

-- Update quote_requests table
UPDATE quote_requests 
SET cruise_id = mapping.new_id
FROM cruise_id_mapping mapping
WHERE quote_requests.cruise_id = mapping.old_id;

-- Update alternative_sailings table
UPDATE alternative_sailings 
SET base_cruise_id = mapping.new_id
FROM cruise_id_mapping mapping
WHERE alternative_sailings.base_cruise_id = mapping.old_id;

UPDATE alternative_sailings 
SET alternative_cruise_id = mapping.new_id
FROM cruise_id_mapping mapping
WHERE alternative_sailings.alternative_cruise_id = mapping.old_id;

-- =====================================================================
-- STEP 6: ATOMIC TABLE SWAP
-- =====================================================================

-- Drop old foreign key constraints
ALTER TABLE itineraries DROP CONSTRAINT IF EXISTS itineraries_cruise_id_cruises_id_fk;
ALTER TABLE pricing DROP CONSTRAINT IF EXISTS pricing_cruise_id_cruises_id_fk;
ALTER TABLE cheapest_pricing DROP CONSTRAINT IF EXISTS cheapest_pricing_cruise_id_cruises_id_fk;
ALTER TABLE quote_requests DROP CONSTRAINT IF EXISTS quote_requests_cruise_id_cruises_id_fk;
ALTER TABLE alternative_sailings DROP CONSTRAINT IF EXISTS alternative_sailings_base_cruise_id_cruises_id_fk;
ALTER TABLE alternative_sailings DROP CONSTRAINT IF EXISTS alternative_sailings_alternative_cruise_id_cruises_id_fk;

-- Rename tables atomically
ALTER TABLE cruises RENAME TO cruises_old_backup;
ALTER TABLE cruises_new RENAME TO cruises;

-- Add new foreign key constraints
ALTER TABLE itineraries ADD CONSTRAINT itineraries_cruise_id_cruises_id_fk 
    FOREIGN KEY (cruise_id) REFERENCES cruises(id);
    
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pricing') THEN
        ALTER TABLE pricing ADD CONSTRAINT pricing_cruise_id_cruises_id_fk 
            FOREIGN KEY (cruise_id) REFERENCES cruises(id);
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cheapest_pricing') THEN
        ALTER TABLE cheapest_pricing ADD CONSTRAINT cheapest_pricing_cruise_id_cruises_id_fk 
            FOREIGN KEY (cruise_id) REFERENCES cruises(id);
    END IF;
END $$;

ALTER TABLE quote_requests ADD CONSTRAINT quote_requests_cruise_id_cruises_id_fk 
    FOREIGN KEY (cruise_id) REFERENCES cruises(id);
ALTER TABLE alternative_sailings ADD CONSTRAINT alternative_sailings_base_cruise_id_cruises_id_fk 
    FOREIGN KEY (base_cruise_id) REFERENCES cruises(id);
ALTER TABLE alternative_sailings ADD CONSTRAINT alternative_sailings_alternative_cruise_id_cruises_id_fk 
    FOREIGN KEY (alternative_cruise_id) REFERENCES cruises(id);

-- =====================================================================
-- STEP 7: CREATE UTILITY VIEWS AND FUNCTIONS
-- =====================================================================

-- View to group sailings by original cruise_id for backward compatibility
CREATE OR REPLACE VIEW cruise_sailings_grouped AS
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
    voyage_code,
    region_ids,
    port_ids
FROM cruises
WHERE is_active = true
GROUP BY cruise_id, name, cruise_line_id, ship_id, nights, voyage_code, region_ids, port_ids;

-- Function to find alternative sailings for the same cruise
CREATE OR REPLACE FUNCTION get_alternative_sailings(input_sailing_id INTEGER)
RETURNS TABLE (
    sailing_id INTEGER,
    sailing_date DATE,
    return_date DATE,
    traveltek_file_path VARCHAR(500),
    is_same_sailing BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id as sailing_id,
        c.sailing_date,
        c.return_date,
        c.traveltek_file_path,
        (c.id = input_sailing_id) as is_same_sailing
    FROM cruises c
    WHERE c.cruise_id = (
        SELECT cruise_id FROM cruises WHERE id = input_sailing_id
    )
    AND c.is_active = true
    ORDER BY c.sailing_date;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- =====================================================================
-- VERIFICATION QUERIES (Run after migration)
-- =====================================================================

-- Check data migration success
SELECT 
    'Data Migration Verification' as check_type,
    (SELECT COUNT(*) FROM cruises_old_backup) as old_count,
    (SELECT COUNT(*) FROM cruises) as new_count,
    (SELECT COUNT(*) FROM cruises_old_backup) = (SELECT COUNT(*) FROM cruises) as counts_match;

-- Check primary key uniqueness
SELECT 
    'Primary Key Uniqueness' as check_type,
    COUNT(*) as total_records,
    COUNT(DISTINCT id) as unique_ids,
    COUNT(*) = COUNT(DISTINCT id) as all_unique;

-- Check foreign key integrity
SELECT 
    'Foreign Key Integrity' as check_type,
    (SELECT COUNT(*) FROM itineraries i LEFT JOIN cruises c ON i.cruise_id = c.id WHERE c.id IS NULL) as orphaned_itineraries,
    (SELECT COUNT(*) FROM pricing p LEFT JOIN cruises c ON p.cruise_id = c.id WHERE c.id IS NULL AND EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'pricing')) as orphaned_pricing,
    (SELECT COUNT(*) FROM quote_requests q LEFT JOIN cruises c ON q.cruise_id = c.id WHERE c.id IS NULL) as orphaned_quotes;

-- Check cruise_id groupings
SELECT 
    'Cruise ID Groupings' as check_type,
    COUNT(DISTINCT cruise_id) as unique_cruise_ids,
    COUNT(*) as total_sailings,
    ROUND(AVG(sailing_count), 2) as avg_sailings_per_cruise
FROM (
    SELECT cruise_id, COUNT(*) as sailing_count
    FROM cruises 
    GROUP BY cruise_id
) grouped;

-- Show sample data
SELECT 
    'Sample Data' as info,
    id as new_primary_key,
    cruise_id as original_cruise_id,
    name,
    sailing_date,
    nights
FROM cruises 
WHERE is_active = true
ORDER BY cruise_id, sailing_date
LIMIT 10;