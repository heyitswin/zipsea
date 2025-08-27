#!/bin/bash

# Script to fix missing pricing columns in production database
# Run this in Render shell

echo "🔄 Starting database fix for missing pricing columns..."
echo ""

# Run the SQL commands using psql
psql $DATABASE_URL << 'EOF'

-- Show current status
\echo '📊 Checking current columns in cruises table...'
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'cruises' 
AND column_name IN ('interior_price', 'oceanview_price', 'balcony_price', 'suite_price', 'cheapest_price', 'needs_price_update');

\echo ''
\echo '➕ Adding missing pricing columns...'

-- Add the pricing columns that the code expects
ALTER TABLE cruises 
ADD COLUMN IF NOT EXISTS interior_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS oceanview_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS balcony_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS suite_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS cheapest_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS needs_price_update BOOLEAN DEFAULT false;

\echo '✅ Columns added'
\echo ''

-- Add comments for documentation
\echo '📝 Adding column comments...'
COMMENT ON COLUMN cruises.interior_price IS 'Interior cabin cheapest price from Traveltek';
COMMENT ON COLUMN cruises.oceanview_price IS 'Oceanview cabin cheapest price from Traveltek';
COMMENT ON COLUMN cruises.balcony_price IS 'Balcony cabin cheapest price from Traveltek';
COMMENT ON COLUMN cruises.suite_price IS 'Suite cabin cheapest price from Traveltek';
COMMENT ON COLUMN cruises.cheapest_price IS 'Overall cheapest price (minimum of all cabin types)';
COMMENT ON COLUMN cruises.needs_price_update IS 'Flag indicating this cruise needs pricing data updated';

-- Create index for better performance
\echo '📊 Creating performance index...'
CREATE INDEX IF NOT EXISTS idx_cruises_needs_price_update 
ON cruises(needs_price_update) 
WHERE needs_price_update = true;

\echo '✅ Index created'
\echo ''

-- Mark future cruises as needing price updates
\echo '🔄 Marking cruises for price updates...'
UPDATE cruises 
SET needs_price_update = true
WHERE sailing_date >= CURRENT_DATE
AND (interior_price IS NULL OR oceanview_price IS NULL OR balcony_price IS NULL OR suite_price IS NULL);

-- Show how many were updated
\echo ''
\echo '📊 Statistics after update:'
SELECT 
    COUNT(*) as total_future_cruises,
    COUNT(CASE WHEN needs_price_update = true THEN 1 END) as needs_update,
    COUNT(CASE WHEN interior_price IS NOT NULL THEN 1 END) as has_interior_price,
    COUNT(CASE WHEN oceanview_price IS NOT NULL THEN 1 END) as has_oceanview_price,
    COUNT(CASE WHEN balcony_price IS NOT NULL THEN 1 END) as has_balcony_price,
    COUNT(CASE WHEN suite_price IS NOT NULL THEN 1 END) as has_suite_price
FROM cruises
WHERE sailing_date >= CURRENT_DATE;

-- Verify the columns were added
\echo ''
\echo '✅ Final verification - All pricing columns:'
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'cruises'
AND column_name IN ('interior_price', 'oceanview_price', 'balcony_price', 'suite_price', 'cheapest_price', 'needs_price_update')
ORDER BY column_name;

\echo ''
\echo '🎉 Database fix complete! The batch sync should now work correctly.'
EOF

echo ""
echo "✅ Script execution complete!"
echo ""
echo "The V3 batch sync service should now be able to update cruise prices."
echo "Next cron run will process the pending price updates."