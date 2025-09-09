-- Add columns for tracking extraction if they don't exist
ALTER TABLE cruises
ADD COLUMN IF NOT EXISTS is_extracted BOOLEAN DEFAULT FALSE;

ALTER TABLE cruises
ADD COLUMN IF NOT EXISTS extraction_date TIMESTAMP;

ALTER TABLE cruises
ADD COLUMN IF NOT EXISTS sail_nights INTEGER;

ALTER TABLE cruises
ADD COLUMN IF NOT EXISTS fly_cruise BOOLEAN DEFAULT FALSE;

ALTER TABLE cruises
ADD COLUMN IF NOT EXISTS fly_cruise_info TEXT;

ALTER TABLE cruises
ADD COLUMN IF NOT EXISTS departure_time TEXT;

ALTER TABLE cruises
ADD COLUMN IF NOT EXISTS arrival_time TEXT;

ALTER TABLE cruises
ADD COLUMN IF NOT EXISTS departure_port_code TEXT;

ALTER TABLE cruises
ADD COLUMN IF NOT EXISTS arrival_port_code TEXT;

ALTER TABLE cruises
ADD COLUMN IF NOT EXISTS map_image_url TEXT;

ALTER TABLE cruises
ADD COLUMN IF NOT EXISTS roundtrip BOOLEAN DEFAULT FALSE;

ALTER TABLE cruises
ADD COLUMN IF NOT EXISTS one_way BOOLEAN DEFAULT FALSE;

ALTER TABLE cruises
ADD COLUMN IF NOT EXISTS cruise_line_content JSONB;

ALTER TABLE cruises
ADD COLUMN IF NOT EXISTS ship_content JSONB;

ALTER TABLE cruises
ADD COLUMN IF NOT EXISTS content JSONB;

ALTER TABLE cruises
ADD COLUMN IF NOT EXISTS market_price NUMERIC(10,2);

ALTER TABLE cruises
ADD COLUMN IF NOT EXISTS special_offer TEXT;

-- Create index on extraction status for performance
CREATE INDEX IF NOT EXISTS idx_cruises_extraction_status
ON cruises(is_extracted, extraction_date)
WHERE raw_data IS NOT NULL;

-- Create index on raw_data for JSONB operations
CREATE INDEX IF NOT EXISTS idx_cruises_raw_data_gin
ON cruises USING gin(raw_data);

-- Show current status
SELECT
  COUNT(*) as total_cruises,
  COUNT(raw_data) as has_raw_data,
  COUNT(CASE WHEN raw_data IS NOT NULL AND name IS NULL THEN 1 END) as needs_extraction,
  COUNT(CASE WHEN is_extracted = true THEN 1 END) as already_extracted
FROM cruises;
