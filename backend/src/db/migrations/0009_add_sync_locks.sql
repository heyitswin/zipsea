-- Create sync_locks table for managing concurrent price syncs
CREATE TABLE IF NOT EXISTS sync_locks (
  id SERIAL PRIMARY KEY,
  cruise_line_id INTEGER NOT NULL,
  lock_type VARCHAR(50) NOT NULL, -- 'price_sync', 'webhook_processing'
  locked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  locked_by VARCHAR(255), -- process/worker ID
  status VARCHAR(50) DEFAULT 'processing', -- 'processing', 'completed', 'failed'
  total_cruises INTEGER,
  processed_cruises INTEGER DEFAULT 0,
  successful_updates INTEGER DEFAULT 0,
  failed_updates INTEGER DEFAULT 0,
  error_message TEXT,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure only one active lock per cruise line and type
  CONSTRAINT unique_active_lock UNIQUE (cruise_line_id, lock_type, status)
);

-- Index for quick lookup of active locks
CREATE INDEX idx_sync_locks_active ON sync_locks(cruise_line_id, status) 
WHERE status = 'processing';

-- Add processing_started_at to cruises table for tracking
ALTER TABLE cruises 
ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMP;

-- Create index for finding unprocessed cruises efficiently
CREATE INDEX idx_cruises_needs_update_line 
ON cruises(cruise_line_id, needs_price_update) 
WHERE needs_price_update = true;

-- Add comment
COMMENT ON TABLE sync_locks IS 'Manages concurrent sync operations to prevent overlapping updates';