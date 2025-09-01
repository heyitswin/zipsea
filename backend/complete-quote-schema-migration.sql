-- Complete migration to fix quote_requests table and ensure all columns exist
-- This migration handles the existing table structure and adds missing columns

-- 1. First, add all missing columns that we need
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

-- 2. Ensure cruise_id is INTEGER type (convert from VARCHAR if needed)
DO $$
BEGIN
    -- Check if cruise_id exists and is not integer
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'quote_requests' 
        AND column_name = 'cruise_id'
        AND data_type != 'integer'
    ) THEN
        -- Add temporary column
        ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS cruise_id_temp INTEGER;
        
        -- Copy and convert data (handle non-numeric values)
        UPDATE quote_requests 
        SET cruise_id_temp = CASE 
            WHEN cruise_id ~ '^\d+$' THEN cruise_id::INTEGER 
            ELSE NULL 
        END;
        
        -- Drop old column and rename new one
        ALTER TABLE quote_requests DROP COLUMN cruise_id;
        ALTER TABLE quote_requests RENAME COLUMN cruise_id_temp TO cruise_id;
    END IF;
END $$;

-- 3. Update status values to new terminology
UPDATE quote_requests 
SET status = 'waiting' 
WHERE status IN ('pending', 'submitted', 'in_review');

UPDATE quote_requests 
SET status = 'responded' 
WHERE status = 'quoted';

-- 4. Generate reference numbers for existing records
UPDATE quote_requests 
SET reference_number = 'ZQ-' || 
    LPAD(CAST(EXTRACT(EPOCH FROM COALESCE(created_at, NOW())) * 1000 % 100000000 AS TEXT), 8, '0') || 
    '-' || LPAD(CAST(id::TEXT), 4, '0')
WHERE reference_number IS NULL;

-- 5. Migrate existing data to new JSON columns
UPDATE quote_requests
SET cabin_type = COALESCE(cabin_type, preferred_cabin_type)
WHERE cabin_type IS NULL AND preferred_cabin_type IS NOT NULL;

UPDATE quote_requests
SET contact_info = jsonb_build_object(
    'email', COALESCE(email, ''),
    'phone', COALESCE(phone, ''),
    'firstName', COALESCE(first_name, ''),
    'lastName', COALESCE(last_name, '')
)
WHERE contact_info IS NULL OR contact_info = '{}'::jsonb;

UPDATE quote_requests
SET passenger_details = CASE 
    WHEN passenger_count IS NOT NULL AND passenger_count > 0 THEN
        jsonb_build_object(
            'adults', passenger_count,
            'children', 0,
            'totalPassengers', passenger_count
        )
    ELSE 
        jsonb_build_object(
            'adults', 2,
            'children', 0,
            'totalPassengers', 2
        )
    END
WHERE passenger_details = '[]'::jsonb OR passenger_details IS NULL;

UPDATE quote_requests
SET special_requirements = COALESCE(special_requirements, special_requests)
WHERE special_requirements IS NULL AND special_requests IS NOT NULL;

-- 6. Set default OBC amounts based on cabin type
UPDATE quote_requests
SET obc_amount = CASE 
    WHEN LOWER(COALESCE(cabin_type, preferred_cabin_type, '')) LIKE '%suite%' THEN 150
    WHEN LOWER(COALESCE(cabin_type, preferred_cabin_type, '')) LIKE '%balcony%' THEN 100
    WHEN LOWER(COALESCE(cabin_type, preferred_cabin_type, '')) LIKE '%ocean%' THEN 75
    ELSE 50
END
WHERE obc_amount IS NULL;

-- 7. Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_quote_requests_status ON quote_requests(status);
CREATE INDEX IF NOT EXISTS idx_quote_requests_created_at ON quote_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quote_requests_reference_number ON quote_requests(reference_number);
CREATE INDEX IF NOT EXISTS idx_quote_requests_cruise_id ON quote_requests(cruise_id);
CREATE INDEX IF NOT EXISTS idx_quote_requests_user_id ON quote_requests(user_id);

-- 8. Verify the migration
DO $$
DECLARE
    missing_columns TEXT[];
    col TEXT;
BEGIN
    -- Check for required columns
    missing_columns := ARRAY[]::TEXT[];
    
    FOR col IN SELECT unnest(ARRAY[
        'reference_number', 'quote_response', 'cabin_type', 
        'passenger_details', 'contact_info', 'preferences',
        'total_price', 'obc_amount', 'created_at', 'updated_at'
    ])
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'quote_requests' AND column_name = col
        ) THEN
            missing_columns := array_append(missing_columns, col);
        END IF;
    END LOOP;
    
    IF array_length(missing_columns, 1) > 0 THEN
        RAISE NOTICE 'Warning: Missing columns: %', array_to_string(missing_columns, ', ');
    ELSE
        RAISE NOTICE 'Success: All required columns are present';
    END IF;
END $$;