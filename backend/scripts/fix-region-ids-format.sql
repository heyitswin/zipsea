-- Fix region_ids and port_ids format from comma-separated strings to JSON arrays
-- This script converts existing data from "1,2,3" format to ["1","2","3"] format

BEGIN;

-- Fix region_ids: convert comma-separated strings to JSON arrays
UPDATE cruises
SET region_ids = 
  CASE 
    WHEN region_ids IS NULL OR region_ids::text = '[]' THEN '[]'::jsonb
    WHEN region_ids::text ~ '^\[.*\]$' THEN region_ids  -- Already JSON array
    ELSE (
      '["' || REPLACE(region_ids::text, ',', '","') || '"]'
    )::jsonb
  END
WHERE region_ids IS NOT NULL 
  AND region_ids::text NOT LIKE '[%'
  AND region_ids::text != '';

-- Fix port_ids: convert comma-separated strings to JSON arrays  
UPDATE cruises
SET port_ids = 
  CASE 
    WHEN port_ids IS NULL OR port_ids::text = '[]' THEN '[]'::jsonb
    WHEN port_ids::text ~ '^\[.*\]$' THEN port_ids  -- Already JSON array
    ELSE (
      '["' || REPLACE(port_ids::text, ',', '","') || '"]'
    )::jsonb
  END
WHERE port_ids IS NOT NULL 
  AND port_ids::text NOT LIKE '[%'
  AND port_ids::text != '';

-- Verify the fix
SELECT 
  COUNT(*) as total_fixed,
  COUNT(CASE WHEN region_ids::text LIKE '[%' THEN 1 END) as regions_json_format,
  COUNT(CASE WHEN port_ids::text LIKE '[%' THEN 1 END) as ports_json_format
FROM cruises
WHERE region_ids IS NOT NULL OR port_ids IS NOT NULL;

COMMIT;

-- Sample queries to verify the data format
SELECT id, region_ids, port_ids 
FROM cruises 
WHERE region_ids IS NOT NULL 
  AND region_ids::text != '[]'
LIMIT 5;

-- Test the search query that was failing
SELECT regions.id, regions.name, 'region' as type, COUNT(cruises.id) as cruise_count
FROM regions
LEFT JOIN cruises ON (
  cruises.region_ids::jsonb ? regions.id::text 
  AND cruises.is_active = true 
  AND cruises.sailing_date >= CURRENT_DATE
)
WHERE regions.is_active = true
GROUP BY regions.id, regions.name
HAVING COUNT(cruises.id) > 0
ORDER BY COUNT(cruises.id) DESC, regions.name
LIMIT 10;