-- COMPREHENSIVE VERIFICATION SCRIPT FOR CRUISE PRIMARY KEY MIGRATION
-- Run this script AFTER the migration to ensure everything is working correctly
-- 
-- =====================================================================

\echo '======================================================'
\echo 'CRUISE PRIMARY KEY MIGRATION VERIFICATION'
\echo '======================================================'

-- =====================================================================
-- 1. SCHEMA VERIFICATION
-- =====================================================================

\echo ''
\echo '1. SCHEMA VERIFICATION'
\echo '====================='

-- Check table structure
SELECT 
    '1.1 Primary Key Structure' as test,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'cruises' 
AND column_name IN ('id', 'cruise_id', 'code_to_cruise_id')
ORDER BY ordinal_position;

-- Check constraints
SELECT 
    '1.2 Table Constraints' as test,
    constraint_name,
    constraint_type
FROM information_schema.table_constraints 
WHERE table_name = 'cruises'
ORDER BY constraint_type, constraint_name;

-- =====================================================================
-- 2. DATA INTEGRITY VERIFICATION
-- =====================================================================

\echo ''
\echo '2. DATA INTEGRITY VERIFICATION'
\echo '==============================='

-- Check record counts
SELECT 
    '2.1 Record Count Comparison' as test,
    (SELECT COUNT(*) FROM cruises_old_backup) as original_count,
    (SELECT COUNT(*) FROM cruises) as migrated_count,
    CASE 
        WHEN (SELECT COUNT(*) FROM cruises_old_backup) = (SELECT COUNT(*) FROM cruises)
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as result;

-- Check primary key uniqueness
WITH uniqueness_check AS (
    SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT id) as unique_ids
    FROM cruises
)
SELECT 
    '2.2 Primary Key Uniqueness' as test,
    total_records,
    unique_ids,
    CASE 
        WHEN total_records = unique_ids THEN 'PASS'
        ELSE 'FAIL'
    END as result
FROM uniqueness_check;

-- Check for NULL primary keys
SELECT 
    '2.3 NULL Primary Key Check' as test,
    COUNT(*) as null_count,
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS'
        ELSE 'FAIL'
    END as result
FROM cruises 
WHERE id IS NULL;

-- =====================================================================
-- 3. FOREIGN KEY INTEGRITY VERIFICATION
-- =====================================================================

\echo ''
\echo '3. FOREIGN KEY INTEGRITY VERIFICATION'
\echo '====================================='

-- Check itineraries references
WITH orphaned_itineraries AS (
    SELECT COUNT(*) as orphan_count
    FROM itineraries i 
    LEFT JOIN cruises c ON i.cruise_id = c.id 
    WHERE c.id IS NULL
)
SELECT 
    '3.1 Itineraries Foreign Key' as test,
    orphan_count,
    CASE 
        WHEN orphan_count = 0 THEN 'PASS'
        ELSE 'FAIL'
    END as result
FROM orphaned_itineraries;

-- Check pricing references (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pricing') THEN
        PERFORM 1;
        -- This will be handled in the main query
    END IF;
END $$;

WITH orphaned_pricing AS (
    SELECT 
        CASE 
            WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pricing')
            THEN (SELECT COUNT(*) FROM pricing p LEFT JOIN cruises c ON p.cruise_id = c.id WHERE c.id IS NULL)
            ELSE 0
        END as orphan_count
)
SELECT 
    '3.2 Pricing Foreign Key' as test,
    orphan_count,
    CASE 
        WHEN orphan_count = 0 THEN 'PASS'
        ELSE 'FAIL'
    END as result
FROM orphaned_pricing;

-- Check quote_requests references
WITH orphaned_quotes AS (
    SELECT COUNT(*) as orphan_count
    FROM quote_requests q 
    LEFT JOIN cruises c ON q.cruise_id = c.id 
    WHERE c.id IS NULL
)
SELECT 
    '3.3 Quote Requests Foreign Key' as test,
    orphan_count,
    CASE 
        WHEN orphan_count = 0 THEN 'PASS'
        ELSE 'FAIL'
    END as result
FROM orphaned_quotes;

-- =====================================================================
-- 4. BUSINESS LOGIC VERIFICATION
-- =====================================================================

\echo ''
\echo '4. BUSINESS LOGIC VERIFICATION'
\echo '=============================='

-- Check cruise_id groupings (multiple sailings per cruise)
WITH cruise_groupings AS (
    SELECT 
        cruise_id,
        COUNT(*) as sailing_count,
        array_agg(id ORDER BY sailing_date) as sailing_ids,
        array_agg(sailing_date ORDER BY sailing_date) as sailing_dates
    FROM cruises 
    WHERE is_active = true
    GROUP BY cruise_id
    HAVING COUNT(*) > 1
)
SELECT 
    '4.1 Multiple Sailings per Cruise' as test,
    COUNT(*) as cruises_with_multiple_sailings,
    AVG(sailing_count)::numeric(10,2) as avg_sailings_per_cruise,
    MAX(sailing_count) as max_sailings_for_one_cruise
FROM cruise_groupings;

-- Check date ranges and data distribution
SELECT 
    '4.2 Sailing Date Distribution' as test,
    MIN(sailing_date) as earliest_sailing,
    MAX(sailing_date) as latest_sailing,
    COUNT(DISTINCT DATE_TRUNC('month', sailing_date)) as months_covered,
    COUNT(*) as total_sailings
FROM cruises 
WHERE is_active = true;

-- Check code_to_cruise_id uniqueness (business critical)
WITH code_uniqueness AS (
    SELECT 
        COUNT(*) as total_count,
        COUNT(DISTINCT id) as unique_code_to_cruise_ids
    FROM cruises
)
SELECT 
    '4.3 Code to Cruise ID Uniqueness' as test,
    total_count,
    unique_code_to_cruise_ids,
    CASE 
        WHEN total_count = unique_code_to_cruise_ids THEN 'PASS'
        ELSE 'FAIL'
    END as result
FROM code_uniqueness;

-- =====================================================================
-- 5. PERFORMANCE VERIFICATION
-- =====================================================================

\echo ''
\echo '5. PERFORMANCE VERIFICATION'
\echo '==========================='

-- Check indexes exist
SELECT 
    '5.1 Index Coverage' as test,
    indexname,
    tablename,
    indexdef
FROM pg_indexes 
WHERE tablename = 'cruises'
ORDER BY indexname;

-- Test query performance on common patterns
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, cruise_id, name, sailing_date, nights
FROM cruises 
WHERE is_active = true 
AND sailing_date >= CURRENT_DATE
ORDER BY sailing_date
LIMIT 10;

-- =====================================================================
-- 6. SAMPLE DATA VERIFICATION
-- =====================================================================

\echo ''
\echo '6. SAMPLE DATA VERIFICATION'
\echo '==========================='

-- Show sample migrated data
SELECT 
    '6.1 Sample Migrated Data' as info,
    id as sailing_id,
    cruise_id as original_cruise_id,
    name,
    sailing_date,
    nights,
    cruise_line_id,
    ship_id
FROM cruises 
WHERE is_active = true
ORDER BY cruise_id, sailing_date
LIMIT 10;

-- Show example of multiple sailings for same cruise
WITH multi_sailing_example AS (
    SELECT cruise_id
    FROM cruises 
    GROUP BY cruise_id 
    HAVING COUNT(*) > 1
    LIMIT 1
)
SELECT 
    '6.2 Multi-Sailing Example' as info,
    c.id as sailing_id,
    c.cruise_id,
    c.name,
    c.sailing_date,
    c.return_date,
    c.nights
FROM cruises c
JOIN multi_sailing_example mse ON c.cruise_id = mse.cruise_id
ORDER BY c.sailing_date;

-- =====================================================================
-- 7. VIEW AND FUNCTION VERIFICATION
-- =====================================================================

\echo ''
\echo '7. VIEW AND FUNCTION VERIFICATION'
\echo '================================='

-- Test the cruise sailings grouped view
SELECT 
    '7.1 Cruise Sailings Grouped View' as test,
    cruise_id,
    total_sailings,
    first_sailing,
    last_sailing,
    name
FROM cruise_sailings_grouped
ORDER BY total_sailings DESC, cruise_id
LIMIT 5;

-- Test the alternative sailings function
SELECT 
    '7.2 Alternative Sailings Function' as test,
    sailing_id,
    sailing_date,
    is_same_sailing
FROM get_alternative_sailings(
    (SELECT id FROM cruises LIMIT 1)
)
LIMIT 5;

-- =====================================================================
-- 8. BACKUP VERIFICATION
-- =====================================================================

\echo ''
\echo '8. BACKUP VERIFICATION'
\echo '======================'

-- Check backup table exists and has data
SELECT 
    '8.1 Backup Table Status' as test,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cruises_old_backup')
        THEN 'EXISTS'
        ELSE 'MISSING'
    END as backup_table_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cruises_old_backup')
        THEN (SELECT COUNT(*) FROM cruises_old_backup)
        ELSE 0
    END as backup_record_count;

-- =====================================================================
-- FINAL SUMMARY
-- =====================================================================

\echo ''
\echo '======================================================'
\echo 'MIGRATION VERIFICATION SUMMARY'
\echo '======================================================'

WITH verification_summary AS (
    SELECT 
        'Schema Migration' as component,
        CASE 
            WHEN EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'cruises' AND column_name = 'id' 
                AND data_type = 'integer'
            ) AND EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'cruises' AND column_name = 'cruise_id' 
                AND data_type = 'integer'
            )
            THEN 'PASS'
            ELSE 'FAIL'
        END as status
    UNION ALL
    SELECT 
        'Data Integrity' as component,
        CASE 
            WHEN (SELECT COUNT(*) FROM cruises) = (SELECT COUNT(DISTINCT id) FROM cruises)
            AND (SELECT COUNT(*) FROM cruises WHERE id IS NULL) = 0
            THEN 'PASS'
            ELSE 'FAIL'
        END as status
    UNION ALL
    SELECT 
        'Foreign Key Integrity' as component,
        CASE 
            WHEN (SELECT COUNT(*) FROM itineraries i LEFT JOIN cruises c ON i.cruise_id = c.id WHERE c.id IS NULL) = 0
            AND (SELECT COUNT(*) FROM quote_requests q LEFT JOIN cruises c ON q.cruise_id = c.id WHERE c.id IS NULL) = 0
            THEN 'PASS'
            ELSE 'FAIL'
        END as status
    UNION ALL
    SELECT 
        'Backup Creation' as component,
        CASE 
            WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cruises_old_backup')
            THEN 'PASS'
            ELSE 'FAIL'
        END as status
)
SELECT 
    component,
    status,
    CASE status 
        WHEN 'PASS' THEN '✅' 
        ELSE '❌' 
    END as icon
FROM verification_summary;

\echo ''
\echo 'If all components show PASS (✅), the migration was successful!'
\echo 'If any component shows FAIL (❌), review the detailed output above.'
\echo '======================================================'