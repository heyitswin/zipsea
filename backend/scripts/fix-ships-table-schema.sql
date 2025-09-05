-- Fix Ships Table Schema Migration
-- This script fixes missing columns and schema mismatches in the ships table
-- Date: 2025-01-14

DO $$
BEGIN
    -- Check if occupancy column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ships' AND column_name = 'occupancy'
    ) THEN
        ALTER TABLE ships ADD COLUMN occupancy INTEGER;
        RAISE NOTICE 'Added occupancy column to ships table';
    END IF;

    -- Check if nice_name column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ships' AND column_name = 'nice_name'
    ) THEN
        ALTER TABLE ships ADD COLUMN nice_name VARCHAR(255);
        RAISE NOTICE 'Added nice_name column to ships table';
    END IF;

    -- Check if short_name column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ships' AND column_name = 'short_name'
    ) THEN
        ALTER TABLE ships ADD COLUMN short_name VARCHAR(255);
        RAISE NOTICE 'Added short_name column to ships table';
    END IF;

    -- Check if max_passengers column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ships' AND column_name = 'max_passengers'
    ) THEN
        ALTER TABLE ships ADD COLUMN max_passengers INTEGER;
        RAISE NOTICE 'Added max_passengers column to ships table';
    END IF;

    -- Check if crew column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ships' AND column_name = 'crew'
    ) THEN
        ALTER TABLE ships ADD COLUMN crew INTEGER;
        RAISE NOTICE 'Added crew column to ships table';
    END IF;

    -- Check if beam column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ships' AND column_name = 'beam'
    ) THEN
        ALTER TABLE ships ADD COLUMN beam INTEGER;
        RAISE NOTICE 'Added beam column to ships table';
    END IF;

    -- Check if draft column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ships' AND column_name = 'draft'
    ) THEN
        ALTER TABLE ships ADD COLUMN draft INTEGER;
        RAISE NOTICE 'Added draft column to ships table';
    END IF;

    -- Check if speed column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ships' AND column_name = 'speed'
    ) THEN
        ALTER TABLE ships ADD COLUMN speed INTEGER;
        RAISE NOTICE 'Added speed column to ships table';
    END IF;

    -- Check if registry column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ships' AND column_name = 'registry'
    ) THEN
        ALTER TABLE ships ADD COLUMN registry VARCHAR(100);
        RAISE NOTICE 'Added registry column to ships table';
    END IF;

    -- Check if built_year column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ships' AND column_name = 'built_year'
    ) THEN
        ALTER TABLE ships ADD COLUMN built_year INTEGER;
        RAISE NOTICE 'Added built_year column to ships table';
    END IF;

    -- Check if refurbished_year column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ships' AND column_name = 'refurbished_year'
    ) THEN
        ALTER TABLE ships ADD COLUMN refurbished_year INTEGER;
        RAISE NOTICE 'Added refurbished_year column to ships table';
    END IF;

    -- Check if description column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ships' AND column_name = 'description'
    ) THEN
        ALTER TABLE ships ADD COLUMN description TEXT;
        RAISE NOTICE 'Added description column to ships table';
    END IF;

    RAISE NOTICE 'Ships table schema fix completed successfully';

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error during ships table migration: %', SQLERRM;
END$$;

-- Show current ships table structure for verification
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'ships'
ORDER BY ordinal_position;
