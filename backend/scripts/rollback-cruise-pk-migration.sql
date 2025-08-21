-- EMERGENCY ROLLBACK SCRIPT FOR CRUISE PRIMARY KEY MIGRATION
-- 
-- ONLY USE THIS IF THE MIGRATION FAILED OR CAUSED ISSUES
-- This script will restore the original schema and data
-- 
-- =====================================================================
-- WARNING: This will undo ALL changes made by the migration
-- Make sure you have verified the backup data exists first!
-- =====================================================================

BEGIN;

-- Check if backup table exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'cruises_old_backup'
    ) THEN
        RAISE EXCEPTION 'ROLLBACK ABORTED: Backup table cruises_old_backup not found!';
    END IF;
    
    RAISE NOTICE 'Backup table found. Proceeding with rollback...';
END $$;

-- =====================================================================
-- STEP 1: DROP NEW FOREIGN KEY CONSTRAINTS
-- =====================================================================

ALTER TABLE itineraries DROP CONSTRAINT IF EXISTS itineraries_cruise_id_cruises_id_fk;
ALTER TABLE pricing DROP CONSTRAINT IF EXISTS pricing_cruise_id_cruises_id_fk;
ALTER TABLE cheapest_pricing DROP CONSTRAINT IF EXISTS cheapest_pricing_cruise_id_cruises_id_fk;
ALTER TABLE quote_requests DROP CONSTRAINT IF EXISTS quote_requests_cruise_id_cruises_id_fk;
ALTER TABLE alternative_sailings DROP CONSTRAINT IF EXISTS alternative_sailings_base_cruise_id_cruises_id_fk;
ALTER TABLE alternative_sailings DROP CONSTRAINT IF EXISTS alternative_sailings_alternative_cruise_id_cruises_id_fk;

-- =====================================================================
-- STEP 2: RESTORE ORIGINAL FOREIGN KEY REFERENCES
-- =====================================================================

-- Create reverse mapping table (new_id -> old_id)
CREATE TEMPORARY TABLE cruise_id_reverse_mapping AS
SELECT 
    cruises.id as new_id,
    cruises.cruise_id as old_id,
    cruises_old_backup.code_to_cruise_id
FROM cruises
JOIN cruises_old_backup ON cruises.cruise_id = cruises_old_backup.id;

-- Update itineraries back to original cruise IDs
UPDATE itineraries 
SET cruise_id = mapping.old_id
FROM cruise_id_reverse_mapping mapping
WHERE itineraries.cruise_id = mapping.new_id;

-- Update pricing back to original cruise IDs
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pricing') THEN
        UPDATE pricing 
        SET cruise_id = mapping.old_id
        FROM cruise_id_reverse_mapping mapping
        WHERE pricing.cruise_id = mapping.new_id;
    END IF;
END $$;

-- Update cheapest_pricing back to original cruise IDs
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cheapest_pricing') THEN
        UPDATE cheapest_pricing 
        SET cruise_id = mapping.old_id
        FROM cruise_id_reverse_mapping mapping
        WHERE cheapest_pricing.cruise_id = mapping.new_id;
    END IF;
END $$;

-- Update quote_requests back to original cruise IDs
UPDATE quote_requests 
SET cruise_id = mapping.old_id
FROM cruise_id_reverse_mapping mapping
WHERE quote_requests.cruise_id = mapping.new_id;

-- Update alternative_sailings back to original cruise IDs
UPDATE alternative_sailings 
SET base_cruise_id = mapping.old_id
FROM cruise_id_reverse_mapping mapping
WHERE alternative_sailings.base_cruise_id = mapping.new_id;

UPDATE alternative_sailings 
SET alternative_cruise_id = mapping.old_id
FROM cruise_id_reverse_mapping mapping
WHERE alternative_sailings.alternative_cruise_id = mapping.new_id;

-- =====================================================================
-- STEP 3: RESTORE ORIGINAL CRUISES TABLE
-- =====================================================================

-- Rename current table to temp
ALTER TABLE cruises RENAME TO cruises_migration_temp;

-- Restore original table
ALTER TABLE cruises_old_backup RENAME TO cruises;

-- =====================================================================
-- STEP 4: RESTORE ORIGINAL FOREIGN KEY CONSTRAINTS
-- =====================================================================

ALTER TABLE itineraries ADD CONSTRAINT itineraries_cruise_id_cruises_id_fk 
    FOREIGN KEY (cruise_id) REFERENCES cruises(id);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pricing') THEN
        ALTER TABLE pricing ADD CONSTRAINT pricing_cruise_id_cruises_id_fk 
            FOREIGN KEY (cruise_id) REFERENCES cruises(id);
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cheapest_pricing') THEN
        ALTER TABLE cheapest_pricing ADD CONSTRAINT cheapest_pricing_cruise_id_cruises_id_fk 
            FOREIGN KEY (cruise_id) REFERENCES cruises(id);
    END IF;
END $$;

ALTER TABLE quote_requests ADD CONSTRAINT quote_requests_cruise_id_cruises_id_fk 
    FOREIGN KEY (cruise_id) REFERENCES cruises(id);
ALTER TABLE alternative_sailings ADD CONSTRAINT alternative_sailings_base_cruise_id_cruises_id_fk 
    FOREIGN KEY (base_cruise_id) REFERENCES cruises(id);
ALTER TABLE alternative_sailings ADD CONSTRAINT alternative_sailings_alternative_cruise_id_cruises_id_fk 
    FOREIGN KEY (alternative_cruise_id) REFERENCES cruises(id);

-- =====================================================================
-- STEP 5: DROP MIGRATION-SPECIFIC VIEWS AND FUNCTIONS
-- =====================================================================

DROP VIEW IF EXISTS cruise_sailings_grouped;
DROP FUNCTION IF EXISTS get_alternative_sailings(INTEGER);

-- =====================================================================
-- STEP 6: CLEANUP MIGRATION ARTIFACTS
-- =====================================================================

-- Keep the migration temp table for manual verification
-- You can drop it manually after confirming rollback worked:
-- DROP TABLE cruises_migration_temp;

COMMIT;

-- =====================================================================
-- ROLLBACK VERIFICATION QUERIES
-- =====================================================================

-- Check data counts match original
SELECT 
    'Rollback Verification' as check_type,
    COUNT(*) as current_count,
    (SELECT COUNT(*) FROM cruises_migration_temp) as migrated_count,
    'Original schema restored' as status;

-- Check primary key structure
SELECT 
    'Primary Key Check' as check_type,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'cruises' 
AND column_name = 'id';

-- Check foreign key integrity
SELECT 
    'Foreign Key Integrity' as check_type,
    (SELECT COUNT(*) FROM itineraries i LEFT JOIN cruises c ON i.cruise_id = c.id WHERE c.id IS NULL) as orphaned_itineraries,
    (SELECT COUNT(*) FROM quote_requests q LEFT JOIN cruises c ON q.cruise_id = c.id WHERE c.id IS NULL) as orphaned_quotes;

RAISE NOTICE '';
RAISE NOTICE '==============================================';
RAISE NOTICE 'ROLLBACK COMPLETED';
RAISE NOTICE '==============================================';
RAISE NOTICE 'Original schema has been restored.';
RAISE NOTICE 'The migrated table is preserved as cruises_migration_temp';
RAISE NOTICE 'You can drop it manually after verification:';
RAISE NOTICE '  DROP TABLE cruises_migration_temp;';
RAISE NOTICE '==============================================';