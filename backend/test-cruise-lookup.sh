#!/bin/bash

echo "Testing if cruise ID 2218838 exists in database..."
echo ""

psql $DATABASE_URL << 'EOF'
-- Check if specific cruise exists
SELECT 
  id,
  cruise_id,
  cruise_line_id,
  ship_id,
  name,
  sailing_date,
  interior_price,
  needs_price_update
FROM cruises
WHERE id = 2218838
LIMIT 1;

-- Check data type of ID column
SELECT 
  column_name,
  data_type,
  numeric_precision,
  numeric_scale
FROM information_schema.columns
WHERE table_name = 'cruises'
AND column_name = 'id';

-- Check a few sample IDs to understand the pattern
SELECT 
  id,
  cruise_id,
  name
FROM cruises
WHERE id > 2200000
ORDER BY id
LIMIT 5;
EOF