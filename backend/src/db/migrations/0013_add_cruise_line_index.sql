-- Migration: Add index on cruise_line_id for performance
-- Date: 2025-10-17
-- Purpose: Optimize searches filtered by cruise line (especially for live booking)

-- Add index on cruise_line_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_cruises_cruise_line_id ON cruises(cruise_line_id);

-- Add composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_cruises_cruise_line_sailing_date
  ON cruises(cruise_line_id, sailing_date)
  WHERE is_active = true;

-- Add comment
COMMENT ON INDEX idx_cruises_cruise_line_id IS
  'Index on cruise_line_id for filtering searches by cruise line';
COMMENT ON INDEX idx_cruises_cruise_line_sailing_date IS
  'Composite index for cruise line and sailing date queries with active filter';
