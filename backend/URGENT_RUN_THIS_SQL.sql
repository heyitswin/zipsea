-- URGENT: Run this SQL on the production database to fix the pricing sync errors
-- These columns are required for the V3 batch sync to work

-- Add the pricing columns that the code expects
ALTER TABLE cruises 
ADD COLUMN IF NOT EXISTS interior_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS oceanview_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS balcony_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS suite_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS cheapest_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS needs_price_update BOOLEAN DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN cruises.interior_price IS 'Interior cabin cheapest price from Traveltek';
COMMENT ON COLUMN cruises.oceanview_price IS 'Oceanview cabin cheapest price from Traveltek';
COMMENT ON COLUMN cruises.balcony_price IS 'Balcony cabin cheapest price from Traveltek';
COMMENT ON COLUMN cruises.suite_price IS 'Suite cabin cheapest price from Traveltek';
COMMENT ON COLUMN cruises.cheapest_price IS 'Overall cheapest price (minimum of all cabin types)';
COMMENT ON COLUMN cruises.needs_price_update IS 'Flag indicating this cruise needs pricing data updated';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_cruises_needs_price_update 
ON cruises(needs_price_update) 
WHERE needs_price_update = true;

-- Mark future cruises as needing price updates
UPDATE cruises 
SET needs_price_update = true
WHERE sailing_date >= CURRENT_DATE
AND (interior_price IS NULL OR oceanview_price IS NULL OR balcony_price IS NULL OR suite_price IS NULL);

-- Verify the columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'cruises'
AND column_name IN ('interior_price', 'oceanview_price', 'balcony_price', 'suite_price', 'cheapest_price', 'needs_price_update')
ORDER BY column_name;