-- Clean migration SQL - copy and paste this directly into Render shell

ALTER TABLE quote_requests 
ADD COLUMN IF NOT EXISTS reference_number VARCHAR(20) UNIQUE,
ADD COLUMN IF NOT EXISTS quote_response JSONB,
ADD COLUMN IF NOT EXISTS cabin_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS cabin_code VARCHAR(10),
ADD COLUMN IF NOT EXISTS passenger_details JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS contact_info JSONB,
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS total_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS obc_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS commission DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS quote_expires_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS quoted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS booked_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS special_requirements TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

UPDATE quote_requests 
SET status = 'waiting' 
WHERE status IN ('pending', 'submitted', 'in_review');

UPDATE quote_requests 
SET reference_number = 'ZQ-' || 
    LPAD(CAST(EXTRACT(EPOCH FROM COALESCE(created_at, NOW())) * 1000 % 100000000 AS TEXT), 8, '0')
WHERE reference_number IS NULL;

UPDATE quote_requests
SET cabin_type = preferred_cabin_type
WHERE preferred_cabin_type IS NOT NULL;

UPDATE quote_requests
SET contact_info = jsonb_build_object(
    'email', COALESCE(email, ''),
    'phone', COALESCE(phone, ''),
    'firstName', COALESCE(first_name, ''),
    'lastName', COALESCE(last_name, '')
);

UPDATE quote_requests
SET passenger_details = jsonb_build_object(
    'adults', COALESCE(passenger_count, 2),
    'children', 0,
    'totalPassengers', COALESCE(passenger_count, 2)
);

UPDATE quote_requests
SET obc_amount = CASE 
    WHEN LOWER(COALESCE(cabin_type, preferred_cabin_type, '')) LIKE '%suite%' THEN 150
    WHEN LOWER(COALESCE(cabin_type, preferred_cabin_type, '')) LIKE '%balcony%' THEN 100
    WHEN LOWER(COALESCE(cabin_type, preferred_cabin_type, '')) LIKE '%ocean%' THEN 75
    ELSE 50
END;

CREATE INDEX IF NOT EXISTS idx_quote_requests_status ON quote_requests(status);
CREATE INDEX IF NOT EXISTS idx_quote_requests_created_at ON quote_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quote_requests_reference_number ON quote_requests(reference_number);