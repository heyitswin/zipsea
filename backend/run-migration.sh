#!/bin/bash

# Script to run database migrations on Render
# This script should be run from the Render shell or as a job

echo "Starting database migration..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL environment variable is not set"
    exit 1
fi

# Run the migration to add reference_number and quote_response fields
echo "Running migration: add_quote_reference_and_response.sql"

psql "$DATABASE_URL" << 'EOF'
-- Add reference number and quote response to quote_requests table
ALTER TABLE quote_requests 
ADD COLUMN IF NOT EXISTS reference_number VARCHAR(20) UNIQUE,
ADD COLUMN IF NOT EXISTS quote_response JSONB;

-- Update existing status values to use new terminology
UPDATE quote_requests 
SET status = 'waiting' 
WHERE status = 'submitted' OR status = 'in_review';

UPDATE quote_requests 
SET status = 'responded' 
WHERE status = 'quoted';

-- Generate reference numbers for existing quotes
UPDATE quote_requests 
SET reference_number = 'ZQ-' || LPAD(CAST(EXTRACT(EPOCH FROM created_at) * 1000 % 100000000 AS TEXT), 8, '0')
WHERE reference_number IS NULL;

-- Ensure uniqueness by adding row number for any duplicates
WITH numbered_quotes AS (
  SELECT id, 
         reference_number,
         ROW_NUMBER() OVER (PARTITION BY reference_number ORDER BY created_at) as rn
  FROM quote_requests
  WHERE reference_number IS NOT NULL
)
UPDATE quote_requests q
SET reference_number = q.reference_number || '-' || n.rn
FROM numbered_quotes n
WHERE q.id = n.id AND n.rn > 1;

EOF

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully!"
else
    echo "❌ Migration failed!"
    exit 1
fi

echo "Database migration finished."