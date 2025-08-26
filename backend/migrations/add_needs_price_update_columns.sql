-- Add columns to track cruises that need price updates from webhooks
ALTER TABLE cruises 
ADD COLUMN IF NOT EXISTS needs_price_update BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS price_update_requested_at TIMESTAMP;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_cruises_needs_price_update 
ON cruises(needs_price_update) 
WHERE needs_price_update = true;

-- Add comment to explain usage
COMMENT ON COLUMN cruises.needs_price_update IS 'Flag indicating this cruise needs pricing data updated from FTP';
COMMENT ON COLUMN cruises.price_update_requested_at IS 'Timestamp when price update was requested via webhook';