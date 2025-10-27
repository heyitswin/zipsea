-- Migration: Add Price Alert Support
-- Date: 2025-10-27
-- Description: Extend saved_searches table with price alert fields and create alert_matches table

-- Add price alert fields to saved_searches table
ALTER TABLE saved_searches
ADD COLUMN IF NOT EXISTS max_budget DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS cabin_types TEXT[];

-- Update default alert frequency to daily (more relevant for price alerts)
ALTER TABLE saved_searches
ALTER COLUMN alert_frequency SET DEFAULT 'daily';

-- Create alert_matches table to track notifications
CREATE TABLE IF NOT EXISTS alert_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES saved_searches(id) ON DELETE CASCADE,
  cruise_id VARCHAR(50) NOT NULL REFERENCES cruises(id) ON DELETE CASCADE,
  cabin_type VARCHAR(20) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  notified_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Prevent duplicate notifications for same alert/cruise/cabin combination
  UNIQUE(alert_id, cruise_id, cabin_type)
);

-- Create indexes for efficient alert matching queries
CREATE INDEX IF NOT EXISTS idx_alert_matches_alert_id ON alert_matches(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_matches_cruise_id ON alert_matches(cruise_id);
CREATE INDEX IF NOT EXISTS idx_alert_matches_notified_at ON alert_matches(notified_at);

-- Create index for active alerts that need checking
CREATE INDEX IF NOT EXISTS idx_saved_searches_active_alerts
ON saved_searches(alert_enabled, is_active, last_checked)
WHERE alert_enabled = true AND is_active = true;

-- Comments for documentation
COMMENT ON COLUMN saved_searches.max_budget IS 'Maximum price threshold for price alerts (per person)';
COMMENT ON COLUMN saved_searches.cabin_types IS 'Array of cabin types to monitor: interior, oceanview, balcony, suite';
COMMENT ON TABLE alert_matches IS 'Tracks which cruises have been notified for each alert to prevent duplicate notifications';
COMMENT ON COLUMN alert_matches.cabin_type IS 'Cabin type that triggered the alert: interior, oceanview, balcony, suite';
COMMENT ON COLUMN alert_matches.price IS 'Price at the time of notification';
