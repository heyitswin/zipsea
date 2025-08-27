-- Add missing price columns to price_history table
ALTER TABLE price_history
ADD COLUMN IF NOT EXISTS interior_price NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS oceanview_price NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS balcony_price NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS suite_price NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS cheapest_price NUMERIC(10,2);

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'price_history' 
AND column_name LIKE '%price%'
ORDER BY ordinal_position;