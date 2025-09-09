-- Migration script to create webhook-related tables
-- Run this in Render shell: psql $DATABASE_URL < scripts/create-webhook-tables.sql

-- 1. Create webhook_events table for tracking webhook processing
CREATE TABLE IF NOT EXISTS webhook_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    line_id INTEGER,
    payload JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    metadata JSONB,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0
);

-- 2. Create system_flags table for tracking processing states
CREATE TABLE IF NOT EXISTS system_flags (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) UNIQUE NOT NULL,
    value TEXT,
    flag_type VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create price_snapshots table for price history
CREATE TABLE IF NOT EXISTS price_snapshots (
    id SERIAL PRIMARY KEY,
    cruise_id VARCHAR(255) NOT NULL,
    interior_price DECIMAL(10,2),
    oceanview_price DECIMAL(10,2),
    balcony_price DECIMAL(10,2),
    suite_price DECIMAL(10,2),
    snapshot_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    webhook_event_id INTEGER REFERENCES webhook_events(id),
    price_change_detected BOOLEAN DEFAULT false,
    metadata JSONB
);

-- 4. Create sync_locks table for preventing concurrent processing
CREATE TABLE IF NOT EXISTS sync_locks (
    id SERIAL PRIMARY KEY,
    cruise_line_id INTEGER NOT NULL,
    lock_key VARCHAR(255) UNIQUE NOT NULL,
    locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    locked_by VARCHAR(255),
    status VARCHAR(50) DEFAULT 'processing',
    completed_at TIMESTAMP,
    metadata JSONB
);

-- 5. Create webhook_processing_log for detailed tracking
CREATE TABLE IF NOT EXISTS webhook_processing_log (
    id SERIAL PRIMARY KEY,
    webhook_event_id INTEGER REFERENCES webhook_events(id),
    cruise_id VARCHAR(255),
    action VARCHAR(50),
    status VARCHAR(50),
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for webhook_events table
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_line_id ON webhook_events(line_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at DESC);

-- Create indexes for system_flags table
CREATE INDEX IF NOT EXISTS idx_system_flags_type ON system_flags(flag_type);
CREATE INDEX IF NOT EXISTS idx_system_flags_key ON system_flags(key);

-- Create indexes for price_snapshots table
CREATE INDEX IF NOT EXISTS idx_price_snapshots_cruise_id ON price_snapshots(cruise_id);
CREATE INDEX IF NOT EXISTS idx_price_snapshots_date ON price_snapshots(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_price_snapshots_webhook ON price_snapshots(webhook_event_id);

-- Create indexes for sync_locks table
CREATE INDEX IF NOT EXISTS idx_sync_locks_line_id ON sync_locks(cruise_line_id);
CREATE INDEX IF NOT EXISTS idx_sync_locks_status ON sync_locks(status);

-- Create indexes for webhook_processing_log table
CREATE INDEX IF NOT EXISTS idx_webhook_log_event ON webhook_processing_log(webhook_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_log_cruise ON webhook_processing_log(cruise_id);

-- Add comments for documentation
COMMENT ON TABLE webhook_events IS 'Stores all incoming webhook events from Traveltek';
COMMENT ON TABLE system_flags IS 'System-wide flags for feature toggles and processing states';
COMMENT ON TABLE price_snapshots IS 'Historical price snapshots taken before updates';
COMMENT ON TABLE sync_locks IS 'Prevents concurrent processing of the same cruise line';
COMMENT ON TABLE webhook_processing_log IS 'Detailed log of webhook processing actions';

-- Insert some default system flags
INSERT INTO system_flags (key, value, flag_type, description)
VALUES
    ('webhook_processing_enabled', 'true', 'feature', 'Enable/disable webhook processing'),
    ('max_concurrent_webhooks', '5', 'config', 'Maximum concurrent webhook processors'),
    ('ftp_pool_size', '3', 'config', 'FTP connection pool size')
ON CONFLICT (key) DO NOTHING;

-- Grant permissions (adjust if needed)
GRANT ALL ON webhook_events TO CURRENT_USER;
GRANT ALL ON system_flags TO CURRENT_USER;
GRANT ALL ON price_snapshots TO CURRENT_USER;
GRANT ALL ON sync_locks TO CURRENT_USER;
GRANT ALL ON webhook_processing_log TO CURRENT_USER;

-- Grant sequence permissions
GRANT ALL ON SEQUENCE webhook_events_id_seq TO CURRENT_USER;
GRANT ALL ON SEQUENCE system_flags_id_seq TO CURRENT_USER;
GRANT ALL ON SEQUENCE price_snapshots_id_seq TO CURRENT_USER;
GRANT ALL ON SEQUENCE sync_locks_id_seq TO CURRENT_USER;
GRANT ALL ON SEQUENCE webhook_processing_log_id_seq TO CURRENT_USER;
