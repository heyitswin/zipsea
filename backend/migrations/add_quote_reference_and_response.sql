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