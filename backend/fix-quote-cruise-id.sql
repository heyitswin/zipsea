-- Fix the cruise_id column type in quote_requests table
-- The cruises.id is VARCHAR, so quote_requests.cruise_id should also be VARCHAR

-- First, check if the column exists and its current type
DO $$
BEGIN
    -- Check if cruise_id is INTEGER and needs to be converted
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'quote_requests' 
        AND column_name = 'cruise_id'
        AND data_type = 'integer'
    ) THEN
        -- Add temporary column as VARCHAR
        ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS cruise_id_temp VARCHAR;
        
        -- Copy data, converting integer to string
        UPDATE quote_requests 
        SET cruise_id_temp = CAST(cruise_id AS VARCHAR)
        WHERE cruise_id IS NOT NULL;
        
        -- Drop the old column
        ALTER TABLE quote_requests DROP COLUMN cruise_id;
        
        -- Rename the temp column
        ALTER TABLE quote_requests RENAME COLUMN cruise_id_temp TO cruise_id;
        
        RAISE NOTICE 'Successfully converted cruise_id from INTEGER to VARCHAR';
    ELSE
        -- If it's already VARCHAR or doesn't exist, just ensure it exists
        ALTER TABLE quote_requests 
        ADD COLUMN IF NOT EXISTS cruise_id VARCHAR;
        
        RAISE NOTICE 'cruise_id column is already VARCHAR or has been added';
    END IF;
END $$;

-- Add missing columns that are referenced in the code
ALTER TABLE quote_requests
ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS preferred_cabin_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS special_requests TEXT;

-- Migrate data from contact_info JSONB to individual columns if needed
UPDATE quote_requests
SET 
    email = COALESCE(email, contact_info->>'email'),
    first_name = COALESCE(first_name, contact_info->>'firstName'),
    last_name = COALESCE(last_name, contact_info->>'lastName'),
    phone = COALESCE(phone, contact_info->>'phone')
WHERE contact_info IS NOT NULL;

-- Migrate cabin_type to preferred_cabin_type if needed
UPDATE quote_requests
SET preferred_cabin_type = COALESCE(preferred_cabin_type, cabin_type)
WHERE cabin_type IS NOT NULL;

-- Ensure passenger_count has a value
UPDATE quote_requests
SET passenger_count = COALESCE(
    passenger_count, 
    CAST(passenger_details->>'totalPassengers' AS INTEGER),
    2
)
WHERE passenger_count IS NULL;

-- Create a test quote to verify everything works
INSERT INTO quote_requests (
    reference_number,
    cruise_id,
    first_name,
    last_name,
    email,
    phone,
    preferred_cabin_type,
    passenger_count,
    status,
    created_at
) VALUES (
    'ZQ-TEST-' || LPAD(CAST(EXTRACT(EPOCH FROM NOW()) * 1000 % 100000000 AS TEXT), 8, '0'),
    '123456', -- Example cruise ID as VARCHAR
    'Test',
    'User',
    'test@example.com',
    '555-1234',
    'Balcony',
    2,
    'waiting',
    NOW()
) ON CONFLICT (reference_number) DO NOTHING;

-- Verify the structure
SELECT 
    column_name, 
    data_type, 
    character_maximum_length
FROM information_schema.columns
WHERE table_name = 'quote_requests'
AND column_name IN ('cruise_id', 'first_name', 'last_name', 'email', 'phone')
ORDER BY ordinal_position;