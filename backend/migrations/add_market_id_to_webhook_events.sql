-- Add missing market_id column to webhook_events table
ALTER TABLE webhook_events 
ADD COLUMN IF NOT EXISTS market_id INTEGER DEFAULT 0;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_webhook_events_market_id ON webhook_events(market_id);