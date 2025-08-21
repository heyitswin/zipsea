-- Sample Queries for New Cruise/Sailing Schema
-- =============================================

-- 1. FIND ALL ALTERNATIVE SAILINGS FOR A CRUISE
-- This is the core benefit - finding all sailings of the same cruise with different dates
SELECT 
    cd.name as cruise_name,
    cl.name as cruise_line,
    s.name as ship_name,
    cd.nights,
    cs.sailing_date,
    cs.return_date,
    cp.cheapest_price,
    cs.code_to_cruise_id
FROM cruise_definitions cd
JOIN cruise_sailings cs ON cs.cruise_definition_id = cd.id
JOIN cruise_lines cl ON cl.id = cd.cruise_line_id
JOIN ships s ON s.id = cd.ship_id
LEFT JOIN cheapest_pricing cp ON cp.cruise_sailing_id = cs.id
WHERE cd.traveltek_cruise_id = 12345  -- Example Traveltek cruise ID
    AND cs.is_active = true
    AND cs.sailing_date >= CURRENT_DATE
ORDER BY cs.sailing_date;

-- 2. FIND CRUISES WITH MULTIPLE SAILING OPTIONS
-- Show cruises that have multiple upcoming sailings (good for marketing)
SELECT 
    cd.name as cruise_name,
    cl.name as cruise_line,
    s.name as ship_name,
    cd.nights,
    COUNT(cs.id) as available_sailings,
    MIN(cs.sailing_date) as first_sailing,
    MAX(cs.sailing_date) as last_sailing,
    MIN(cp.cheapest_price) as lowest_price
FROM cruise_definitions cd
JOIN cruise_sailings cs ON cs.cruise_definition_id = cd.id
JOIN cruise_lines cl ON cl.id = cd.cruise_line_id
JOIN ships s ON s.id = cd.ship_id
LEFT JOIN cheapest_pricing cp ON cp.cruise_sailing_id = cs.id
WHERE cs.is_active = true
    AND cs.sailing_date >= CURRENT_DATE
    AND cs.sailing_date <= CURRENT_DATE + INTERVAL '12 months'
GROUP BY cd.id, cd.name, cl.name, s.name, cd.nights
HAVING COUNT(cs.id) > 1
ORDER BY available_sailings DESC, lowest_price ASC;

-- 3. SEARCH BY FLEXIBLE DATE RANGE
-- Find all sailings in a date range, grouped by cruise for easy comparison
SELECT 
    cd.id as cruise_definition_id,
    cd.name as cruise_name,
    cl.name as cruise_line,
    s.name as ship_name,
    cd.nights,
    ep.name as embark_port,
    array_agg(
        json_build_object(
            'sailing_date', cs.sailing_date,
            'code_to_cruise_id', cs.code_to_cruise_id,
            'price', cp.cheapest_price
        ) ORDER BY cs.sailing_date
    ) as available_sailings
FROM cruise_definitions cd
JOIN cruise_sailings cs ON cs.cruise_definition_id = cd.id
JOIN cruise_lines cl ON cl.id = cd.cruise_line_id
JOIN ships s ON s.id = cd.ship_id
LEFT JOIN ports ep ON ep.id = cd.embark_port_id
LEFT JOIN cheapest_pricing cp ON cp.cruise_sailing_id = cs.id
WHERE cs.is_active = true
    AND cs.sailing_date BETWEEN '2024-06-01' AND '2024-09-30'
    AND cd.nights BETWEEN 7 AND 14
GROUP BY cd.id, cd.name, cl.name, s.name, cd.nights, ep.name
ORDER BY MIN(cp.cheapest_price) ASC;

-- 4. PRICE COMPARISON ACROSS SAILINGS
-- Compare prices for the same cruise across different sailing dates
WITH cruise_price_comparison AS (
    SELECT 
        cd.id as cruise_definition_id,
        cd.name as cruise_name,
        cd.nights,
        cs.sailing_date,
        cs.code_to_cruise_id,
        cp.cheapest_price,
        cp.interior_price,
        cp.balcony_price,
        ROW_NUMBER() OVER (PARTITION BY cd.id ORDER BY cp.cheapest_price ASC) as price_rank
    FROM cruise_definitions cd
    JOIN cruise_sailings cs ON cs.cruise_definition_id = cd.id
    LEFT JOIN cheapest_pricing cp ON cp.cruise_sailing_id = cs.id
    WHERE cs.is_active = true
        AND cs.sailing_date >= CURRENT_DATE
        AND cp.cheapest_price IS NOT NULL
)
SELECT 
    cruise_name,
    nights,
    COUNT(*) as total_sailings,
    MIN(cheapest_price) as best_price,
    MAX(cheapest_price) as highest_price,
    AVG(cheapest_price) as average_price,
    array_agg(
        json_build_object(
            'sailing_date', sailing_date,
            'price', cheapest_price,
            'is_cheapest', price_rank = 1
        ) ORDER BY sailing_date
    ) as sailing_prices
FROM cruise_price_comparison
GROUP BY cruise_definition_id, cruise_name, nights
HAVING COUNT(*) > 1
ORDER BY best_price ASC;

-- 5. SHIP UTILIZATION ANALYSIS
-- See how many different cruises each ship operates and their sailing frequency
SELECT 
    s.name as ship_name,
    cl.name as cruise_line,
    COUNT(DISTINCT cd.id) as unique_cruises,
    COUNT(cs.id) as total_sailings,
    MIN(cs.sailing_date) as first_sailing,
    MAX(cs.sailing_date) as last_sailing,
    array_agg(DISTINCT cd.name) as cruise_names
FROM ships s
JOIN cruise_definitions cd ON cd.ship_id = s.id
JOIN cruise_sailings cs ON cs.cruise_definition_id = cd.id
JOIN cruise_lines cl ON cl.id = cd.cruise_line_id
WHERE cs.is_active = true
    AND cs.sailing_date >= CURRENT_DATE - INTERVAL '6 months'
GROUP BY s.id, s.name, cl.name
ORDER BY total_sailings DESC;

-- 6. SEASONAL PRICING ANALYSIS
-- Analyze how prices vary by season for the same cruise
SELECT 
    cd.name as cruise_name,
    EXTRACT(MONTH FROM cs.sailing_date) as sailing_month,
    CASE 
        WHEN EXTRACT(MONTH FROM cs.sailing_date) IN (12, 1, 2) THEN 'Winter'
        WHEN EXTRACT(MONTH FROM cs.sailing_date) IN (3, 4, 5) THEN 'Spring'
        WHEN EXTRACT(MONTH FROM cs.sailing_date) IN (6, 7, 8) THEN 'Summer'
        ELSE 'Fall'
    END as season,
    COUNT(cs.id) as sailings_count,
    AVG(cp.cheapest_price) as avg_price,
    MIN(cp.cheapest_price) as min_price,
    MAX(cp.cheapest_price) as max_price
FROM cruise_definitions cd
JOIN cruise_sailings cs ON cs.cruise_definition_id = cd.id
LEFT JOIN cheapest_pricing cp ON cp.cruise_sailing_id = cs.id
WHERE cs.is_active = true
    AND cs.sailing_date >= CURRENT_DATE
    AND cp.cheapest_price IS NOT NULL
GROUP BY cd.id, cd.name, EXTRACT(MONTH FROM cs.sailing_date), season
HAVING COUNT(cs.id) >= 2
ORDER BY cd.name, sailing_month;

-- 7. FIND SIMILAR CRUISES (SAME SHIP, DIFFERENT ITINERARY)
-- Help customers find alternative itineraries on the same ship
SELECT 
    s.name as ship_name,
    cd1.name as cruise_1,
    cd2.name as cruise_2,
    cd1.nights as nights_1,
    cd2.nights as nights_2,
    ep1.name as embark_port_1,
    ep2.name as embark_port_2,
    COUNT(cs1.id) as sailings_cruise_1,
    COUNT(cs2.id) as sailings_cruise_2
FROM cruise_definitions cd1
JOIN cruise_definitions cd2 ON cd1.ship_id = cd2.ship_id AND cd1.id < cd2.id
JOIN ships s ON s.id = cd1.ship_id
LEFT JOIN ports ep1 ON ep1.id = cd1.embark_port_id
LEFT JOIN ports ep2 ON ep2.id = cd2.embark_port_id
LEFT JOIN cruise_sailings cs1 ON cs1.cruise_definition_id = cd1.id AND cs1.is_active = true
LEFT JOIN cruise_sailings cs2 ON cs2.cruise_definition_id = cd2.id AND cs2.is_active = true
WHERE cd1.is_active = true AND cd2.is_active = true
GROUP BY s.name, cd1.name, cd2.name, cd1.nights, cd2.nights, ep1.name, ep2.name
HAVING COUNT(cs1.id) > 0 AND COUNT(cs2.id) > 0
ORDER BY s.name, cd1.nights, cd2.nights;

-- 8. ITINERARY-BASED SEARCH
-- Find cruises visiting specific ports with flexible sailing dates
SELECT 
    cd.name as cruise_name,
    cl.name as cruise_line,
    s.name as ship_name,
    cd.nights,
    cs.sailing_date,
    cp.cheapest_price,
    array_agg(DISTINCT p.name ORDER BY p.name) as ports_visited
FROM cruise_definitions cd
JOIN cruise_sailings cs ON cs.cruise_definition_id = cd.id
JOIN cruise_lines cl ON cl.id = cd.cruise_line_id
JOIN ships s ON s.id = cd.ship_id
JOIN itineraries i ON i.cruise_definition_id = cd.id
JOIN ports p ON p.id = i.port_id
LEFT JOIN cheapest_pricing cp ON cp.cruise_sailing_id = cs.id
WHERE cs.is_active = true
    AND cs.sailing_date >= CURRENT_DATE
    AND p.name IN ('Barcelona', 'Rome', 'Naples')  -- Example ports
GROUP BY cd.id, cd.name, cl.name, s.name, cd.nights, cs.id, cs.sailing_date, cp.cheapest_price
HAVING COUNT(DISTINCT p.name) >= 2  -- Must visit at least 2 of the specified ports
ORDER BY cs.sailing_date, cp.cheapest_price;

-- 9. AVAILABILITY TIMELINE
-- Show sailing availability over time for a specific cruise
SELECT 
    cd.name as cruise_name,
    DATE_TRUNC('month', cs.sailing_date) as month,
    COUNT(cs.id) as sailings_available,
    AVG(cp.cheapest_price) as avg_price,
    MIN(cp.cheapest_price) as best_price_this_month
FROM cruise_definitions cd
JOIN cruise_sailings cs ON cs.cruise_definition_id = cd.id
LEFT JOIN cheapest_pricing cp ON cp.cruise_sailing_id = cs.id
WHERE cd.traveltek_cruise_id = 12345  -- Specific cruise
    AND cs.is_active = true
    AND cs.sailing_date >= CURRENT_DATE
GROUP BY cd.id, cd.name, DATE_TRUNC('month', cs.sailing_date)
ORDER BY month;

-- 10. USING THE COMPATIBILITY VIEW
-- Example of using the legacy view for backward compatibility
SELECT 
    name,
    sailing_date,
    nights,
    code_to_cruise_id,
    cruise_definition_id,
    cruise_sailing_id
FROM cruise_sailings_legacy
WHERE sailing_date >= CURRENT_DATE
    AND nights = 7
ORDER BY sailing_date
LIMIT 10;

-- Performance Notes:
-- ================
-- 1. All queries use proper indexes defined in the migration
-- 2. Composite indexes optimize common search patterns
-- 3. GIN indexes on JSONB fields enable efficient region/port searches
-- 4. The separation allows for better query planning and caching
-- 5. Views provide backward compatibility while enabling new functionality