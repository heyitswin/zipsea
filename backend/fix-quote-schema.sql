-- First, let's add the missing columns to match our schema
ALTER TABLE quote_requests 
ADD COLUMN IF NOT EXISTS reference_number VARCHAR(20) UNIQUE,
ADD COLUMN IF NOT EXISTS quote_response JSONB,
ADD COLUMN IF NOT EXISTS cabin_type VARCHAR(50),
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

-- Update cruise_id to be integer type (if it's currently varchar)
-- First, let's check if cruise_id needs to be converted
DO $$
BEGIN
    -- Check if cruise_id is already integer
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'quote_requests' 
        AND column_name = 'cruise_id'
        AND data_type != 'integer'
    ) THEN
        -- Add a new temporary column
        ALTER TABLE quote_requests ADD COLUMN cruise_id_int INTEGER;
        
        -- Copy and convert data
        UPDATE quote_requests 
        SET cruise_id_int = CASE 
            WHEN cruise_id ~ '^\d+$' THEN cruise_id::INTEGER 
            ELSE NULL 
        END;
        
        -- Drop the old column and rename the new one
        ALTER TABLE quote_requests DROP COLUMN cruise_id;
        ALTER TABLE quote_requests RENAME COLUMN cruise_id_int TO cruise_id;
    END IF;
END $$;

-- Update existing status values to use new terminology
UPDATE quote_requests 
SET status = 'waiting' 
WHERE status = 'pending' OR status = 'submitted' OR status = 'in_review';

UPDATE quote_requests 
SET status = 'responded' 
WHERE status = 'quoted';

-- Generate reference numbers for existing quotes
UPDATE quote_requests 
SET reference_number = 'ZQ-' || LPAD(CAST(EXTRACT(EPOCH FROM COALESCE(created_at, NOW())) * 1000 % 100000000 AS TEXT), 8, '0')
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

-- Copy existing data to new columns
UPDATE quote_requests
SET cabin_type = preferred_cabin_type
WHERE cabin_type IS NULL AND preferred_cabin_type IS NOT NULL;

UPDATE quote_requests
SET contact_info = jsonb_build_object(
    'email', email,
    'phone', phone,
    'firstName', first_name,
    'lastName', last_name
)
WHERE contact_info IS NULL;

UPDATE quote_requests
SET passenger_details = jsonb_build_array(
    jsonb_build_object(
        'firstName', first_name,
        'lastName', last_name,
        'type', 'adult'
    )
)
WHERE passenger_details = '[]';

UPDATE quote_requests
SET special_requirements = special_requests
WHERE special_requirements IS NULL AND special_requests IS NOT NULL;