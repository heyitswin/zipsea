-- Add missing columns to webhook_events table
ALTER TABLE webhook_events 
ADD COLUMN IF NOT EXISTS currency VARCHAR(10),
ADD COLUMN IF NOT EXISTS source VARCHAR(100),
ADD COLUMN IF NOT EXISTS timestamp VARCHAR(100);

-- The batch_id column already exists
-- The market_id column was just added
-- Update description to be nullable if needed