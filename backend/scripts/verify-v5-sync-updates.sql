-- Zipsea V5 Sync Database Verification Queries
-- Run these queries to verify that cruise data is being updated correctly

-- 1. Check most recent cruise insertions/updates (last 24 hours)
SELECT 
    id, 
    cruise_id,
    cruise_line_id, 
    ship_id, 
    name,
    sailing_date,
    interior_price,
    oceanview_price,
    balcony_price,
    suite_price,
    cheapest_price,
    needs_price_update,
    created_at, 
    updated_at
FROM cruises 
WHERE updated_at > NOW() - INTERVAL '24 HOURS'
ORDER BY updated_at DESC 
LIMIT 20;

-- 2. Verify pricing columns are populated correctly
SELECT 
    COUNT(*) as total_updated,
    COUNT(interior_price) as has_interior,
    COUNT(oceanview_price) as has_oceanview,
    COUNT(balcony_price) as has_balcony,
    COUNT(suite_price) as has_suite,
    COUNT(cheapest_price) as has_cheapest,
    MIN(cheapest_price) as min_price,
    MAX(cheapest_price) as max_price,
    AVG(cheapest_price)::NUMERIC(10,2) as avg_price
FROM cruises 
WHERE updated_at > NOW() - INTERVAL '24 HOURS';

-- 3. Check cruise line relationships are correct
SELECT 
    c.id,
    c.cruise_line_id,
    cl.id as cl_table_id,
    cl.name as cruise_line_name,
    cl.code as cruise_line_code,
    c.name as cruise_name,
    c.sailing_date,
    c.updated_at
FROM cruises c
LEFT JOIN cruise_lines cl ON cl.id = c.cruise_line_id
WHERE c.updated_at > NOW() - INTERVAL '24 HOURS'
ORDER BY c.updated_at DESC
LIMIT 10;

-- 4. Check ship relationships are correct
SELECT 
    c.id,
    c.ship_id,
    s.id as ship_table_id,
    s.name as ship_name,
    s.cruise_line_id as ship_line_id,
    cl.name as cruise_line_name,
    c.name as cruise_name,
    c.updated_at
FROM cruises c
LEFT JOIN ships s ON s.id = c.ship_id
LEFT JOIN cruise_lines cl ON cl.id = c.cruise_line_id
WHERE c.updated_at > NOW() - INTERVAL '24 HOURS'
ORDER BY c.updated_at DESC
LIMIT 10;

-- 5. Verify port relationships (if populated)
SELECT 
    c.id,
    c.embarkation_port_id,
    p1.name as embark_port,
    c.disembarkation_port_id,
    p2.name as disembark_port,
    c.updated_at
FROM cruises c
LEFT JOIN ports p1 ON p1.id = c.embarkation_port_id
LEFT JOIN ports p2 ON p2.id = c.disembarkation_port_id
WHERE c.updated_at > NOW() - INTERVAL '24 HOURS'
  AND (c.embarkation_port_id IS NOT NULL OR c.disembarkation_port_id IS NOT NULL)
ORDER BY c.updated_at DESC
LIMIT 10;

-- 6. Check for data consistency issues
SELECT 
    'Missing cruise_line_id' as issue,
    COUNT(*) as count
FROM cruises 
WHERE updated_at > NOW() - INTERVAL '24 HOURS'
  AND cruise_line_id IS NULL
UNION ALL
SELECT 
    'Missing ship_id' as issue,
    COUNT(*) as count
FROM cruises 
WHERE updated_at > NOW() - INTERVAL '24 HOURS'
  AND ship_id IS NULL
UNION ALL
SELECT 
    'Missing sailing_date' as issue,
    COUNT(*) as count
FROM cruises 
WHERE updated_at > NOW() - INTERVAL '24 HOURS'
  AND sailing_date IS NULL
UNION ALL
SELECT 
    'Missing all prices' as issue,
    COUNT(*) as count
FROM cruises 
WHERE updated_at > NOW() - INTERVAL '24 HOURS'
  AND interior_price IS NULL 
  AND oceanview_price IS NULL 
  AND balcony_price IS NULL 
  AND suite_price IS NULL
UNION ALL
SELECT 
    'Cheapest price mismatch' as issue,
    COUNT(*) as count
FROM cruises 
WHERE updated_at > NOW() - INTERVAL '24 HOURS'
  AND cheapest_price IS NOT NULL
  AND cheapest_price NOT IN (interior_price, oceanview_price, balcony_price, suite_price);

-- 7. Sync activity summary by cruise line
SELECT 
    cl.id as line_id,
    cl.name as cruise_line,
    COUNT(c.id) as cruises_updated_24h,
    COUNT(CASE WHEN c.created_at > NOW() - INTERVAL '24 HOURS' THEN 1 END) as new_cruises,
    COUNT(CASE WHEN c.updated_at > NOW() - INTERVAL '24 HOURS' 
               AND c.created_at < NOW() - INTERVAL '24 HOURS' THEN 1 END) as updated_cruises,
    MIN(c.sailing_date) as earliest_departure,
    MAX(c.sailing_date) as latest_departure,
    MAX(c.updated_at) as last_update
FROM cruise_lines cl
LEFT JOIN cruises c ON c.cruise_line_id = cl.id AND c.updated_at > NOW() - INTERVAL '24 HOURS'
WHERE c.id IS NOT NULL
GROUP BY cl.id, cl.name
ORDER BY cruises_updated_24h DESC;

-- 8. Check specific cruises mentioned in logs (2188223, 2085580)
SELECT 
    id,
    cruise_id,
    cruise_line_id,
    ship_id,
    name,
    sailing_date,
    nights,
    interior_price,
    oceanview_price,
    balcony_price,
    suite_price,
    cheapest_price,
    created_at,
    updated_at
FROM cruises 
WHERE id IN ('2188223', '2085580')
   OR cruise_id IN ('2188223', '2085580');

-- 9. Check pending updates status
SELECT 
    COUNT(*) as total_pending,
    COUNT(DISTINCT cruise_line_id) as unique_lines_pending,
    MIN(price_update_requested_at) as oldest_request,
    MAX(price_update_requested_at) as newest_request,
    EXTRACT(EPOCH FROM (NOW() - MIN(price_update_requested_at)))/3600 as oldest_hours_ago
FROM cruises 
WHERE needs_price_update = true;

-- 10. Check V5 sync progress (cruises marked as no longer needing updates)
SELECT 
    DATE_TRUNC('hour', updated_at) as update_hour,
    COUNT(*) as cruises_processed,
    COUNT(CASE WHEN needs_price_update = false THEN 1 END) as marked_complete,
    COUNT(DISTINCT cruise_line_id) as unique_lines
FROM cruises 
WHERE updated_at > NOW() - INTERVAL '6 HOURS'
GROUP BY DATE_TRUNC('hour', updated_at)
ORDER BY update_hour DESC;