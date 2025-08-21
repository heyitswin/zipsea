-- Fix the itineraries table port constraint
-- Make port_id nullable since not all ports may exist in our database

ALTER TABLE itineraries 
DROP CONSTRAINT IF EXISTS itineraries_port_id_fkey;

-- Make port_id nullable if it isn't already
ALTER TABLE itineraries 
ALTER COLUMN port_id DROP NOT NULL;

-- Add the foreign key back but with ON DELETE SET NULL
ALTER TABLE itineraries 
ADD CONSTRAINT itineraries_port_id_fkey 
FOREIGN KEY (port_id) 
REFERENCES ports(id) 
ON DELETE SET NULL;

-- Show the updated constraint
SELECT 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.table_name = 'itineraries' 
    AND tc.constraint_type = 'FOREIGN KEY';