-- Quick SQL script to update staging prices from production
-- This updates only the pricing columns for existing cruise IDs

-- Temporary table to hold production pricing data
CREATE TEMP TABLE prod_pricing AS
SELECT id, interior_price, oceanview_price, balcony_price, suite_price, cheapest_price
FROM cruises;

-- Update staging cruises with production pricing
UPDATE cruises c
SET
  interior_price = p.interior_price,
  oceanview_price = p.oceanview_price,
  balcony_price = p.balcony_price,
  suite_price = p.suite_price,
  cheapest_price = p.cheapest_price
FROM prod_pricing p
WHERE c.id = p.id;

-- Show results
SELECT COUNT(*) as updated_count FROM cruises WHERE cheapest_price IS NOT NULL;
