-- Add missing columns that are in schema but not in production database

-- Add parent_region_id to regions table
ALTER TABLE regions
ADD COLUMN IF NOT EXISTS parent_region_id integer REFERENCES regions(id);

-- Add cabin_code_alt to cabin_categories table
ALTER TABLE cabin_categories
ADD COLUMN IF NOT EXISTS cabin_code_alt varchar(10);
