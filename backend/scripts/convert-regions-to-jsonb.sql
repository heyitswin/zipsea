-- Convert region_ids and port_ids from VARCHAR to JSONB
-- This migration converts existing comma-separated strings to JSON arrays

BEGIN;

-- Step 1: Add temporary JSONB columns
ALTER TABLE cruises 
ADD COLUMN IF NOT EXISTS region_ids_jsonb JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS port_ids_jsonb JSONB DEFAULT '[]';

-- Step 2: Convert existing data to JSON arrays
UPDATE cruises
SET region_ids_jsonb = 
  CASE 
    WHEN region_ids IS NULL OR region_ids = '' THEN '[]'::jsonb
    WHEN region_ids LIKE '[%' THEN region_ids::jsonb  -- Already looks like JSON
    ELSE (
      '["' || REPLACE(region_ids, ',', '","') || '"]'
    )::jsonb
  END;

UPDATE cruises
SET port_ids_jsonb = 
  CASE 
    WHEN port_ids IS NULL OR port_ids = '' THEN '[]'::jsonb
    WHEN port_ids LIKE '[%' THEN port_ids::jsonb  -- Already looks like JSON
    ELSE (
      '["' || REPLACE(port_ids, ',', '","') || '"]'
    )::jsonb
  END;

-- Step 3: Drop old columns and rename new ones
ALTER TABLE cruises DROP COLUMN region_ids;
ALTER TABLE cruises DROP COLUMN port_ids;
ALTER TABLE cruises RENAME COLUMN region_ids_jsonb TO region_ids;
ALTER TABLE cruises RENAME COLUMN port_ids_jsonb TO port_ids;

-- Step 4: Verify the conversion
SELECT 
  COUNT(*) as total_rows,
  COUNT(region_ids) as has_region_ids,
  COUNT(port_ids) as has_port_ids,
  pg_typeof(region_ids) as region_type,
  pg_typeof(port_ids) as port_type
FROM cruises
GROUP BY pg_typeof(region_ids), pg_typeof(port_ids);

COMMIT;

-- Verify data looks good
SELECT id, region_ids, port_ids 
FROM cruises 
WHERE region_ids != '[]'::jsonb
LIMIT 5;

-- Test the query that was failing
SELECT regions.id, regions.name, 'region' as type, COUNT(cruises.id) as cruise_count
FROM regions
LEFT JOIN cruises ON (
  cruises.region_ids ? regions.id::text 
  AND cruises.is_active = true 
  AND cruises.sailing_date >= CURRENT_DATE
)
WHERE regions.is_active = true
GROUP BY regions.id, regions.name
HAVING COUNT(cruises.id) > 0
ORDER BY COUNT(cruises.id) DESC, regions.name
LIMIT 10;