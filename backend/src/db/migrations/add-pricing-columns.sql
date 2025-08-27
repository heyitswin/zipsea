-- Add pricing columns to cruises table for storing cheapest prices from Traveltek
-- These are the static pricing values we receive from the FTP files

ALTER TABLE cruises 
ADD COLUMN IF NOT EXISTS interior_cheapest_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS oceanview_cheapest_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS balcony_cheapest_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS suite_cheapest_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS needs_price_update BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMP;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_cruises_needs_price_update ON cruises(needs_price_update) WHERE needs_price_update = true;
CREATE INDEX IF NOT EXISTS idx_cruises_pricing ON cruises(interior_cheapest_price, oceanview_cheapest_price, balcony_cheapest_price, suite_cheapest_price);

-- Add comments for documentation
COMMENT ON COLUMN cruises.interior_cheapest_price IS 'Cheapest interior cabin price from Traveltek (cheapestinside)';
COMMENT ON COLUMN cruises.oceanview_cheapest_price IS 'Cheapest oceanview cabin price from Traveltek (cheapestoutside)';
COMMENT ON COLUMN cruises.balcony_cheapest_price IS 'Cheapest balcony cabin price from Traveltek (cheapestbalcony)';
COMMENT ON COLUMN cruises.suite_cheapest_price IS 'Cheapest suite cabin price from Traveltek (cheapestsuite)';
COMMENT ON COLUMN cruises.needs_price_update IS 'Flag indicating this cruise needs pricing data updated';
COMMENT ON COLUMN cruises.processing_started_at IS 'Timestamp when price update processing started';
COMMENT ON COLUMN cruises.processing_completed_at IS 'Timestamp when price update processing completed';