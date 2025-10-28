-- Add pricing_breakdown column to booking_sessions table
-- This stores the itemized breakdown from Traveltek's cruisecabingradebreakdown.pl API
-- Format: JSONB array of breakdown items with description, totalcost, category, etc.

ALTER TABLE booking_sessions ADD COLUMN pricing_breakdown JSONB;
