-- Remove live pricing related columns from pricing table
ALTER TABLE pricing DROP COLUMN IF EXISTS price_type;
ALTER TABLE pricing DROP COLUMN IF EXISTS price_timestamp;