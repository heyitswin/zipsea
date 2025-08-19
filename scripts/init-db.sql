-- Initialize Zipsea database with required extensions and settings

-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Set timezone
SET timezone = 'UTC';

-- Create additional indexes for full-text search if needed
-- (These will be created by migrations, but having extensions ready helps)

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'Zipsea database initialized successfully with extensions: uuid-ossp, pg_trgm, btree_gin';
END $$;