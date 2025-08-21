-- Migration to separate cruise definitions from individual sailings
-- This solves the duplicate cruiseid problem by properly modeling the relationship

-- ===================================================================
-- STEP 1: Create new tables for proper cruise/sailing separation
-- ===================================================================

-- Table for cruise definitions (ship + itinerary combination)
CREATE TABLE IF NOT EXISTS "cruise_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"traveltek_cruise_id" integer NOT NULL,
	"cruise_line_id" integer NOT NULL,
	"ship_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"itinerary_code" varchar(50),
	"voyage_code" varchar(50),
	"nights" integer NOT NULL,
	"sail_nights" integer,
	"sea_days" integer,
	"embark_port_id" integer,
	"disembark_port_id" integer,
	"region_ids" jsonb DEFAULT '[]',
	"port_ids" jsonb DEFAULT '[]',
	"market_id" integer,
	"owner_id" integer,
	"no_fly" boolean DEFAULT false,
	"depart_uk" boolean DEFAULT false,
	"show_cruise" boolean DEFAULT true,
	"fly_cruise_info" text,
	"line_content" text,
	"currency" varchar(3) DEFAULT 'USD',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Table for individual sailings (specific sailing dates)
CREATE TABLE IF NOT EXISTS "cruise_sailings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cruise_definition_id" uuid NOT NULL,
	"code_to_cruise_id" integer NOT NULL UNIQUE,
	"sailing_date" date NOT NULL,
	"return_date" date,
	"traveltek_file_path" varchar(500),
	"last_cached" timestamp,
	"cached_date" date,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- ===================================================================
-- STEP 2: Add foreign key constraints
-- ===================================================================

DO $$ BEGIN
 ALTER TABLE "cruise_definitions" ADD CONSTRAINT "cruise_definitions_cruise_line_id_cruise_lines_id_fk" FOREIGN KEY ("cruise_line_id") REFERENCES "cruise_lines"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "cruise_definitions" ADD CONSTRAINT "cruise_definitions_ship_id_ships_id_fk" FOREIGN KEY ("ship_id") REFERENCES "ships"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "cruise_definitions" ADD CONSTRAINT "cruise_definitions_embark_port_id_ports_id_fk" FOREIGN KEY ("embark_port_id") REFERENCES "ports"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "cruise_definitions" ADD CONSTRAINT "cruise_definitions_disembark_port_id_ports_id_fk" FOREIGN KEY ("disembark_port_id") REFERENCES "ports"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "cruise_sailings" ADD CONSTRAINT "cruise_sailings_cruise_definition_id_cruise_definitions_id_fk" FOREIGN KEY ("cruise_definition_id") REFERENCES "cruise_definitions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- ===================================================================
-- STEP 3: Create performance indexes
-- ===================================================================

-- Indexes for cruise_definitions
CREATE INDEX IF NOT EXISTS "idx_cruise_definitions_traveltek_cruise_id" ON "cruise_definitions"("traveltek_cruise_id");
CREATE INDEX IF NOT EXISTS "idx_cruise_definitions_cruise_line_ship" ON "cruise_definitions"("cruise_line_id", "ship_id");
CREATE INDEX IF NOT EXISTS "idx_cruise_definitions_voyage_code" ON "cruise_definitions"("voyage_code");
CREATE INDEX IF NOT EXISTS "idx_cruise_definitions_embark_port" ON "cruise_definitions"("embark_port_id");
CREATE INDEX IF NOT EXISTS "idx_cruise_definitions_nights" ON "cruise_definitions"("nights");
CREATE INDEX IF NOT EXISTS "idx_cruise_definitions_region_ids" ON "cruise_definitions" USING GIN("region_ids");
CREATE INDEX IF NOT EXISTS "idx_cruise_definitions_is_active" ON "cruise_definitions"("is_active") WHERE "is_active" = true;

-- Indexes for cruise_sailings
CREATE INDEX IF NOT EXISTS "idx_cruise_sailings_cruise_definition_id" ON "cruise_sailings"("cruise_definition_id");
CREATE INDEX IF NOT EXISTS "idx_cruise_sailings_code_to_cruise_id" ON "cruise_sailings"("code_to_cruise_id");
CREATE INDEX IF NOT EXISTS "idx_cruise_sailings_sailing_date" ON "cruise_sailings"("sailing_date");
CREATE INDEX IF NOT EXISTS "idx_cruise_sailings_sailing_date_range" ON "cruise_sailings"("sailing_date") WHERE "sailing_date" >= CURRENT_DATE;
CREATE INDEX IF NOT EXISTS "idx_cruise_sailings_traveltek_file_path" ON "cruise_sailings"("traveltek_file_path");
CREATE INDEX IF NOT EXISTS "idx_cruise_sailings_is_active" ON "cruise_sailings"("is_active") WHERE "is_active" = true;

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS "idx_cruise_sailings_definition_date" ON "cruise_sailings"("cruise_definition_id", "sailing_date");
CREATE INDEX IF NOT EXISTS "idx_cruise_definitions_line_ship_nights" ON "cruise_definitions"("cruise_line_id", "ship_id", "nights");

-- ===================================================================
-- STEP 4: Migrate existing data from cruises table
-- ===================================================================

-- Insert unique cruise definitions (group by common attributes)
INSERT INTO cruise_definitions (
    traveltek_cruise_id,
    cruise_line_id, 
    ship_id, 
    name, 
    itinerary_code, 
    voyage_code, 
    nights, 
    sail_nights, 
    sea_days, 
    embark_port_id, 
    disembark_port_id, 
    region_ids, 
    port_ids, 
    market_id, 
    owner_id, 
    no_fly, 
    depart_uk, 
    show_cruise, 
    fly_cruise_info, 
    line_content, 
    currency, 
    is_active,
    created_at,
    updated_at
)
SELECT DISTINCT ON (
    id, cruise_line_id, ship_id, name, COALESCE(voyage_code, ''), nights, 
    COALESCE(embark_port_id, 0), COALESCE(disembark_port_id, 0)
)
    id as traveltek_cruise_id,
    cruise_line_id,
    ship_id,
    name,
    itinerary_code,
    voyage_code,
    nights,
    sail_nights,
    sea_days,
    embark_port_id,
    disembark_port_id,
    region_ids,
    port_ids,
    market_id,
    owner_id,
    no_fly,
    depart_uk,
    show_cruise,
    fly_cruise_info,
    line_content,
    currency,
    is_active,
    MIN(created_at) as created_at,
    MAX(updated_at) as updated_at
FROM cruises
WHERE is_active = true
GROUP BY 
    id, cruise_line_id, ship_id, name, itinerary_code, voyage_code, nights, 
    sail_nights, sea_days, embark_port_id, disembark_port_id, region_ids, 
    port_ids, market_id, owner_id, no_fly, depart_uk, show_cruise, 
    fly_cruise_info, line_content, currency, is_active
ORDER BY 
    id, cruise_line_id, ship_id, name, COALESCE(voyage_code, ''), nights, 
    COALESCE(embark_port_id, 0), COALESCE(disembark_port_id, 0),
    MIN(created_at);

-- Insert all individual sailings
INSERT INTO cruise_sailings (
    cruise_definition_id,
    code_to_cruise_id,
    sailing_date,
    return_date,
    traveltek_file_path,
    last_cached,
    cached_date,
    is_active,
    created_at,
    updated_at
)
SELECT 
    cd.id as cruise_definition_id,
    CAST(c.code_to_cruise_id AS INTEGER) as code_to_cruise_id,
    c.sailing_date,
    c.return_date,
    c.traveltek_file_path,
    c.last_cached,
    c.cached_date,
    c.is_active,
    c.created_at,
    c.updated_at
FROM cruises c
JOIN cruise_definitions cd ON (
    cd.traveltek_cruise_id = c.id AND
    cd.cruise_line_id = c.cruise_line_id AND
    cd.ship_id = c.ship_id AND
    cd.name = c.name AND
    COALESCE(cd.voyage_code, '') = COALESCE(c.voyage_code, '') AND
    cd.nights = c.nights AND
    COALESCE(cd.embark_port_id, 0) = COALESCE(c.embark_port_id, 0) AND
    COALESCE(cd.disembark_port_id, 0) = COALESCE(c.disembark_port_id, 0)
)
WHERE c.is_active = true
ON CONFLICT (code_to_cruise_id) DO NOTHING;

-- ===================================================================
-- STEP 5: Add new columns to existing related tables
-- ===================================================================

-- Add cruise_sailing_id to pricing table
ALTER TABLE pricing ADD COLUMN IF NOT EXISTS cruise_sailing_id uuid;

-- Add cruise_sailing_id to cheapest_pricing table  
ALTER TABLE cheapest_pricing ADD COLUMN IF NOT EXISTS cruise_sailing_id uuid;

-- Add new references to itineraries table
ALTER TABLE itineraries ADD COLUMN IF NOT EXISTS cruise_definition_id uuid;
ALTER TABLE itineraries ADD COLUMN IF NOT EXISTS cruise_sailing_id uuid;

-- ===================================================================
-- STEP 6: Create foreign key constraints for new columns
-- ===================================================================

DO $$ BEGIN
 ALTER TABLE "pricing" ADD CONSTRAINT "pricing_cruise_sailing_id_cruise_sailings_id_fk" FOREIGN KEY ("cruise_sailing_id") REFERENCES "cruise_sailings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "cheapest_pricing" ADD CONSTRAINT "cheapest_pricing_cruise_sailing_id_cruise_sailings_id_fk" FOREIGN KEY ("cruise_sailing_id") REFERENCES "cruise_sailings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "itineraries" ADD CONSTRAINT "itineraries_cruise_definition_id_cruise_definitions_id_fk" FOREIGN KEY ("cruise_definition_id") REFERENCES "cruise_definitions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "itineraries" ADD CONSTRAINT "itineraries_cruise_sailing_id_cruise_sailings_id_fk" FOREIGN KEY ("cruise_sailing_id") REFERENCES "cruise_sailings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- ===================================================================
-- STEP 7: Update existing pricing and itinerary references
-- ===================================================================

-- Update pricing table to reference cruise_sailings
UPDATE pricing p
SET cruise_sailing_id = cs.id
FROM cruise_sailings cs
JOIN cruises c ON c.code_to_cruise_id = CAST(cs.code_to_cruise_id AS VARCHAR)
WHERE p.cruise_id = c.id;

-- Update cheapest_pricing table to reference cruise_sailings
UPDATE cheapest_pricing cp
SET cruise_sailing_id = cs.id
FROM cruise_sailings cs
JOIN cruises c ON c.code_to_cruise_id = CAST(cs.code_to_cruise_id AS VARCHAR)
WHERE cp.cruise_id = c.id;

-- Update itineraries table to reference new tables
UPDATE itineraries i
SET 
    cruise_definition_id = cd.id,
    cruise_sailing_id = cs.id
FROM cruise_sailings cs
JOIN cruise_definitions cd ON cd.id = cs.cruise_definition_id
JOIN cruises c ON c.code_to_cruise_id = CAST(cs.code_to_cruise_id AS VARCHAR)
WHERE i.cruise_id = c.id;

-- ===================================================================
-- STEP 8: Create views for backward compatibility
-- ===================================================================

-- View that provides the old cruises table interface for existing queries
CREATE OR REPLACE VIEW cruise_sailings_legacy AS
SELECT 
    c.id,
    cs.code_to_cruise_id,
    cd.cruise_line_id,
    cd.ship_id,
    cd.name,
    cd.itinerary_code,
    cd.voyage_code,
    cs.sailing_date,
    cs.return_date,
    cd.nights,
    cd.sail_nights,
    cd.sea_days,
    cd.embark_port_id,
    cd.disembark_port_id,
    cd.region_ids,
    cd.port_ids,
    cd.market_id,
    cd.owner_id,
    cd.no_fly,
    cd.depart_uk,
    cd.show_cruise,
    cd.fly_cruise_info,
    cd.line_content,
    cs.traveltek_file_path,
    cs.last_cached,
    cs.cached_date,
    cd.currency,
    cs.is_active,
    cs.created_at,
    cs.updated_at,
    cd.id as cruise_definition_id,
    cs.id as cruise_sailing_id
FROM cruises c
JOIN cruise_sailings cs ON c.code_to_cruise_id = CAST(cs.code_to_cruise_id AS VARCHAR)
JOIN cruise_definitions cd ON cd.id = cs.cruise_definition_id;

-- View for finding all sailings of the same cruise
CREATE OR REPLACE VIEW cruise_alternative_sailings AS
SELECT 
    cd.id as cruise_definition_id,
    cd.traveltek_cruise_id,
    cd.name as cruise_name,
    cd.cruise_line_id,
    cd.ship_id,
    cd.nights,
    cd.voyage_code,
    array_agg(
        json_build_object(
            'sailing_id', cs.id,
            'code_to_cruise_id', cs.code_to_cruise_id,
            'sailing_date', cs.sailing_date,
            'return_date', cs.return_date,
            'traveltek_file_path', cs.traveltek_file_path
        ) ORDER BY cs.sailing_date
    ) as sailings,
    count(cs.id) as sailing_count,
    min(cs.sailing_date) as first_sailing,
    max(cs.sailing_date) as last_sailing
FROM cruise_definitions cd
LEFT JOIN cruise_sailings cs ON cs.cruise_definition_id = cd.id AND cs.is_active = true
WHERE cd.is_active = true
GROUP BY cd.id, cd.traveltek_cruise_id, cd.name, cd.cruise_line_id, cd.ship_id, cd.nights, cd.voyage_code;

-- ===================================================================
-- STEP 9: Create indexes for new columns
-- ===================================================================

CREATE INDEX IF NOT EXISTS "idx_pricing_cruise_sailing_id" ON "pricing"("cruise_sailing_id");
CREATE INDEX IF NOT EXISTS "idx_cheapest_pricing_cruise_sailing_id" ON "cheapest_pricing"("cruise_sailing_id");
CREATE INDEX IF NOT EXISTS "idx_itineraries_cruise_definition_id" ON "itineraries"("cruise_definition_id");
CREATE INDEX IF NOT EXISTS "idx_itineraries_cruise_sailing_id" ON "itineraries"("cruise_sailing_id");

-- Add unique constraint on cheapest_pricing cruise_sailing_id
DO $$ BEGIN
    ALTER TABLE cheapest_pricing ADD CONSTRAINT cheapest_pricing_cruise_sailing_id_unique UNIQUE (cruise_sailing_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ===================================================================
-- STEP 10: Add helpful comments
-- ===================================================================

COMMENT ON TABLE cruise_definitions IS 'Defines unique cruise products (ship + itinerary combination). Multiple sailings can reference the same definition.';
COMMENT ON TABLE cruise_sailings IS 'Individual sailing instances with specific dates. Each has a unique code_to_cruise_id from Traveltek.';
COMMENT ON VIEW cruise_sailings_legacy IS 'Legacy view providing backward compatibility with the old cruises table structure.';
COMMENT ON VIEW cruise_alternative_sailings IS 'Groups all sailings by cruise definition, useful for showing alternative sailing dates.';

COMMENT ON COLUMN cruise_definitions.traveltek_cruise_id IS 'Original cruiseid from Traveltek (not unique across sailings)';
COMMENT ON COLUMN cruise_sailings.code_to_cruise_id IS 'Unique identifier for each sailing from Traveltek (codetocruiseid)';
COMMENT ON COLUMN cruise_sailings.cruise_definition_id IS 'References the cruise definition this sailing belongs to';