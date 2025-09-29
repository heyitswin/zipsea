-- Add indexes to improve search performance
-- These indexes target the most common query patterns in comprehensive search

-- Index for date range queries (sailing_date with active status)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cruises_sailing_date_active
ON cruises(sailing_date, is_active)
WHERE is_active = true AND sailing_date >= CURRENT_DATE;

-- Index for cheapest price filtering (commonly used in WHERE and ORDER BY)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cruises_cheapest_price
ON cruises(cheapest_price)
WHERE cheapest_price IS NOT NULL AND cheapest_price > 99;

-- Composite index for cruise line and date filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cruises_line_date
ON cruises(cruise_line_id, sailing_date)
WHERE is_active = true;

-- Composite index for ship and date filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cruises_ship_date
ON cruises(ship_id, sailing_date)
WHERE is_active = true;

-- Index for departure port searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cruises_embark_port_date
ON cruises(embark_port_id, sailing_date)
WHERE is_active = true;

-- Index for nights filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cruises_nights
ON cruises(nights)
WHERE is_active = true;

-- Composite index for the most common query pattern
-- Active cruises with valid prices sorted by date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cruises_search_main
ON cruises(is_active, sailing_date, cheapest_price)
WHERE is_active = true
  AND sailing_date >= CURRENT_DATE
  AND cheapest_price IS NOT NULL
  AND cheapest_price > 99;

-- Index for region_ids array search (using GIN for array containment)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cruises_region_ids_gin
ON cruises USING gin(region_ids)
WHERE is_active = true;

-- Index for port_ids array search (using GIN for array containment)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cruises_port_ids_gin
ON cruises USING gin(port_ids)
WHERE is_active = true;

-- Analyze the table to update statistics after adding indexes
ANALYZE cruises;
