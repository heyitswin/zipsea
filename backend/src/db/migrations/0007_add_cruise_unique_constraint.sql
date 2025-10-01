-- Migration: Add unique constraint to prevent duplicate cruises
-- This ensures that cruises with the same line, ship, and sailing date are treated as duplicates
-- Created: 2025-10-01

-- Step 1: First, we need to deduplicate existing data before adding the constraint
-- This is handled by the deduplicate-cruises.js script

-- Step 2: Add a unique constraint on the combination that identifies a unique sailing
-- Note: We use a partial unique index to handle NULL voyage_codes gracefully
CREATE UNIQUE INDEX IF NOT EXISTS idx_cruises_unique_sailing
ON cruises (cruise_line_id, ship_id, sailing_date, COALESCE(voyage_code, ''));

-- Step 3: Add a comment to document this constraint
COMMENT ON INDEX idx_cruises_unique_sailing IS
'Ensures no duplicate cruise sailings. A unique sailing is defined by cruise line, ship, sailing date, and voyage code.';

-- Step 4: Create index on commonly queried fields for performance
CREATE INDEX IF NOT EXISTS idx_cruises_sailing_date_future
ON cruises (sailing_date)
WHERE sailing_date >= CURRENT_DATE;

COMMENT ON INDEX idx_cruises_sailing_date_future IS
'Optimizes queries for future sailings, which are the most frequently accessed.';

-- Step 5: Add index for duplicate detection queries during cleanup
CREATE INDEX IF NOT EXISTS idx_cruises_line_ship_date
ON cruises (cruise_line_id, ship_id, sailing_date);

COMMENT ON INDEX idx_cruises_line_ship_date IS
'Supports duplicate detection and cleanup queries.';
