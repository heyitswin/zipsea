-- Fix staging database schema to match production
-- Run this on staging database to add missing columns

-- Add missing columns to ports table if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='ports' AND column_name='raw_port_data') THEN
        ALTER TABLE ports ADD COLUMN raw_port_data JSONB;
    END IF;
END $$;

-- Add missing columns to regions table if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='regions' AND column_name='code') THEN
        ALTER TABLE regions ADD COLUMN code VARCHAR(10);
    END IF;
END $$;

-- Verify the changes
SELECT 'ports columns:' as info;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'ports'
ORDER BY ordinal_position;

SELECT 'regions columns:' as info;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'regions'
ORDER BY ordinal_position;
