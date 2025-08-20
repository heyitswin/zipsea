-- Migration: Search Performance Indexes
-- Description: Add specialized indexes for search API performance optimization
-- Date: 2025-01-20

-- Full-text search indexes using PostgreSQL's built-in text search
-- These enable fast text search across cruise names, ports, cruise lines, etc.

-- Cruise name search index
CREATE INDEX IF NOT EXISTS cruises_name_search_idx 
ON cruises USING GIN (to_tsvector('english', name));

-- Port name and location search index
CREATE INDEX IF NOT EXISTS ports_name_search_idx 
ON ports USING GIN (to_tsvector('english', name || ' ' || COALESCE(city, '') || ' ' || COALESCE(country, '')));

-- Ship name search index
CREATE INDEX IF NOT EXISTS ships_name_search_idx 
ON ships USING GIN (to_tsvector('english', name));

-- Cruise line name search index
CREATE INDEX IF NOT EXISTS cruise_lines_name_search_idx 
ON cruise_lines USING GIN (to_tsvector('english', name));

-- Region name search index
CREATE INDEX IF NOT EXISTS regions_name_search_idx 
ON regions USING GIN (to_tsvector('english', name));

-- GIN indexes for JSONB fields (for array searches)
-- These enable fast searches within JSON arrays for regions and ports

-- Region IDs array search
CREATE INDEX IF NOT EXISTS cruises_region_ids_gin_idx 
ON cruises USING GIN (region_ids);

-- Port IDs array search
CREATE INDEX IF NOT EXISTS cruises_port_ids_gin_idx 
ON cruises USING GIN (port_ids);

-- Ship images search (for future features)
CREATE INDEX IF NOT EXISTS ships_images_gin_idx 
ON ships USING GIN (images);

-- Port amenities search (for future features)
CREATE INDEX IF NOT EXISTS ports_amenities_gin_idx 
ON ports USING GIN (amenities);

-- Cabin amenities search (for future features)
CREATE INDEX IF NOT EXISTS cabin_categories_amenities_gin_idx 
ON cabin_categories USING GIN (amenities);

-- User preferences search (for future personalization)
CREATE INDEX IF NOT EXISTS users_preferences_gin_idx 
ON users USING GIN (preferences);

-- Quote request passenger details
CREATE INDEX IF NOT EXISTS quote_requests_passenger_details_gin_idx 
ON quote_requests USING GIN (passenger_details);

-- Saved search criteria
CREATE INDEX IF NOT EXISTS saved_searches_criteria_gin_idx 
ON saved_searches USING GIN (search_criteria);

-- Performance-optimized composite indexes for common search patterns

-- Price range with date filtering (most common search pattern)
CREATE INDEX IF NOT EXISTS cruises_price_date_active_idx 
ON cruises (sailing_date, is_active, show_cruise) 
INCLUDE (nights, cruise_line_id, ship_id, embark_port_id);

-- Cruise line and ship filtering with date
CREATE INDEX IF NOT EXISTS cruises_line_ship_date_idx 
ON cruises (cruise_line_id, ship_id, sailing_date) 
WHERE is_active = true AND show_cruise = true;

-- Duration filtering with price
CREATE INDEX IF NOT EXISTS cruises_nights_price_idx 
ON cruises (nights, sailing_date) 
WHERE is_active = true AND show_cruise = true;

-- Port-based searches (embark/disembark)
CREATE INDEX IF NOT EXISTS cruises_ports_date_idx 
ON cruises (embark_port_id, disembark_port_id, sailing_date) 
WHERE is_active = true AND show_cruise = true;

-- Cheapest pricing indexes for fast price filtering and sorting
CREATE INDEX IF NOT EXISTS cheapest_pricing_price_numeric_idx 
ON cheapest_pricing ((cheapest_price::numeric)) 
WHERE cheapest_price IS NOT NULL;

-- Cabin type availability indexes
CREATE INDEX IF NOT EXISTS cheapest_pricing_interior_available_idx 
ON cheapest_pricing (cruise_id) 
WHERE interior_price IS NOT NULL AND interior_price != '0';

CREATE INDEX IF NOT EXISTS cheapest_pricing_oceanview_available_idx 
ON cheapest_pricing (cruise_id) 
WHERE oceanview_price IS NOT NULL AND oceanview_price != '0';

CREATE INDEX IF NOT EXISTS cheapest_pricing_balcony_available_idx 
ON cheapest_pricing (cruise_id) 
WHERE balcony_price IS NOT NULL AND balcony_price != '0';

CREATE INDEX IF NOT EXISTS cheapest_pricing_suite_available_idx 
ON cheapest_pricing (cruise_id) 
WHERE suite_price IS NOT NULL AND suite_price != '0';

-- Ship rating index for quality-based filtering
CREATE INDEX IF NOT EXISTS ships_rating_idx 
ON ships (rating) 
WHERE rating IS NOT NULL;

-- Currency-based filtering
CREATE INDEX IF NOT EXISTS cruises_currency_date_idx 
ON cruises (currency, sailing_date) 
WHERE is_active = true AND show_cruise = true;

-- Faceted search optimization indexes
-- These help with counting results for faceted search

-- Cruise line facet counts
CREATE INDEX IF NOT EXISTS cruises_line_count_idx 
ON cruises (cruise_line_id, is_active, show_cruise);

-- Ship facet counts
CREATE INDEX IF NOT EXISTS cruises_ship_count_idx 
ON cruises (ship_id, is_active, show_cruise);

-- Duration facet counts
CREATE INDEX IF NOT EXISTS cruises_nights_facet_idx 
ON cruises (nights, is_active, show_cruise);

-- Date range facet counts
CREATE INDEX IF NOT EXISTS cruises_date_facet_idx 
ON cruises (sailing_date, is_active, show_cruise);

-- Covering indexes for common queries (include frequently accessed columns)

-- Main search result covering index
CREATE INDEX IF NOT EXISTS cruises_search_covering_idx 
ON cruises (sailing_date, is_active, show_cruise) 
INCLUDE (id, name, cruise_line_id, ship_id, nights, embark_port_id, disembark_port_id, currency, updated_at)
WHERE is_active = true AND show_cruise = true;

-- Price sorting covering index
CREATE INDEX IF NOT EXISTS cheapest_pricing_sort_covering_idx 
ON cheapest_pricing ((cheapest_price::numeric)) 
INCLUDE (cruise_id, interior_price, oceanview_price, balcony_price, suite_price)
WHERE cheapest_price IS NOT NULL;

-- Search suggestions optimization

-- Popular cruise lines for suggestions
CREATE INDEX IF NOT EXISTS cruise_lines_popular_idx 
ON cruise_lines (name, is_active) 
WHERE is_active = true;

-- Popular ports for suggestions
CREATE INDEX IF NOT EXISTS ports_popular_idx 
ON ports (name, city, country, is_active) 
WHERE is_active = true;

-- Popular regions for suggestions
CREATE INDEX IF NOT EXISTS regions_popular_idx 
ON regions (name, is_active) 
WHERE is_active = true;

-- Statistics and maintenance

-- Update table statistics for better query planning
ANALYZE cruises;
ANALYZE cheapest_pricing;
ANALYZE cruise_lines;
ANALYZE ships;
ANALYZE ports;
ANALYZE regions;

-- Enable auto-vacuum for better performance
ALTER TABLE cruises SET (autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE cheapest_pricing SET (autovacuum_vacuum_scale_factor = 0.1);

-- Add comments for documentation
COMMENT ON INDEX cruises_name_search_idx IS 'Full-text search index for cruise names';
COMMENT ON INDEX cruises_price_date_active_idx IS 'Composite index for price and date filtering';
COMMENT ON INDEX cheapest_pricing_price_numeric_idx IS 'Numeric price index for fast sorting and filtering';

-- Performance monitoring views (optional)

-- Create a view for slow query monitoring
CREATE OR REPLACE VIEW search_performance_stats AS
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation,
    most_common_vals,
    most_common_freqs
FROM pg_stats 
WHERE schemaname = 'public' 
AND tablename IN ('cruises', 'cheapest_pricing', 'cruise_lines', 'ships', 'ports', 'regions')
ORDER BY tablename, attname;

-- Grant permissions
GRANT SELECT ON search_performance_stats TO PUBLIC;