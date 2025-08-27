#!/bin/bash

echo "Checking if cruise IDs match between database and FTP files..."
echo ""

psql "$DATABASE_URL" << 'EOF'
-- Check if we have cruises for lines 1, 10, 13
SELECT 
  cruise_line_id,
  COUNT(*) as total_cruises,
  MIN(id) as min_id,
  MAX(id) as max_id
FROM cruises
WHERE cruise_line_id IN (1, 10, 13)
AND sailing_date >= CURRENT_DATE
GROUP BY cruise_line_id
ORDER BY cruise_line_id;

-- Check specific IDs that should exist based on FTP files
-- These are example IDs from typical FTP files
SELECT 
  COUNT(*) as count,
  'ID > 1000000' as id_range
FROM cruises
WHERE id > 1000000
UNION ALL
SELECT 
  COUNT(*) as count,
  'ID > 2000000' as id_range  
FROM cruises
WHERE id > 2000000
UNION ALL
SELECT 
  COUNT(*) as count,
  'ID > 8000000' as id_range
FROM cruises
WHERE id > 8000000;

-- Sample some actual cruise IDs for line 1
SELECT 
  id,
  cruise_id,
  name,
  sailing_date,
  interior_price,
  needs_price_update
FROM cruises
WHERE cruise_line_id = 1
AND sailing_date >= '2025-08-01'
ORDER BY id
LIMIT 5;

-- Check if needs_price_update column exists
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'cruises'
AND column_name = 'needs_price_update';
EOF