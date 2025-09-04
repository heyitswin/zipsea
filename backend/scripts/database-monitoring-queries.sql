-- Real-Time Database Monitoring Queries for Bulk FTP Processing
-- 
-- These queries can be run directly in psql or through your database client
-- to monitor the progress of bulk FTP processing after webhook triggers
--
-- Usage: 
--   psql $DATABASE_URL -f database-monitoring-queries.sql
--   Or copy individual queries and run them in your database client

-- ============================================================================
-- 1. WEBHOOK PROCESSING STATUS
-- ============================================================================

-- Recent webhook events with processing status
SELECT 
  'Recent Webhooks (Last 2 Hours)' as section;

SELECT 
  id,
  event_type,
  line_id,
  CASE WHEN processed THEN '✅ Processed' ELSE '⏳ Pending' END as status,
  successful_count as success,
  failed_count as failed,
  processing_time_ms as time_ms,
  created_at,
  processed_at,
  CASE 
    WHEN processed_at IS NOT NULL THEN 
      EXTRACT(EPOCH FROM (processed_at - created_at))::int || 's'
    ELSE 'N/A'
  END as processing_duration,
  description
FROM webhook_events 
WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '2 hours'
ORDER BY created_at DESC
LIMIT 20;

-- Webhook summary by line (last 24 hours)
SELECT 
  '\nWebhook Summary by Line (Last 24h)' as section;

SELECT 
  line_id,
  COUNT(*) as total_webhooks,
  COUNT(*) FILTER (WHERE processed = true) as processed,
  COUNT(*) FILTER (WHERE processed = false) as pending,
  SUM(successful_count) as total_success,
  SUM(failed_count) as total_failed,
  ROUND(AVG(processing_time_ms), 0) as avg_time_ms,
  MAX(created_at) as latest_webhook
FROM webhook_events 
WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
GROUP BY line_id 
ORDER BY total_webhooks DESC;

-- ============================================================================
-- 2. CRUISE UPDATE PROGRESS MONITORING
-- ============================================================================

-- Cruises updated in real-time (last 30 minutes)
SELECT 
  '\nReal-time Cruise Updates (Last 30min)' as section;

SELECT 
  c.id,
  c.cruise_id,
  cl.name as cruise_line,
  c.name as cruise_name,
  c.sailing_date,
  c.updated_at,
  CASE 
    WHEN c.interior_cheapest_price IS NOT NULL OR 
         c.oceanview_cheapest_price IS NOT NULL OR 
         c.balcony_cheapest_price IS NOT NULL OR 
         c.suite_cheapest_price IS NOT NULL 
    THEN '💰 Has Pricing'
    ELSE '⚪ No Pricing'
  END as pricing_status,
  EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - c.updated_at))::int || 's ago' as updated_ago
FROM cruises c
JOIN cruise_lines cl ON c.cruise_line_id = cl.id
WHERE c.updated_at >= CURRENT_TIMESTAMP - INTERVAL '30 minutes'
ORDER BY c.updated_at DESC
LIMIT 25;

-- Cruise update progress by line
SELECT 
  '\nCruise Update Progress by Line' as section;

SELECT 
  cl.id as line_id,
  cl.name as cruise_line_name,
  COUNT(c.id) as total_cruises,
  COUNT(*) FILTER (WHERE c.sailing_date >= CURRENT_DATE) as future_cruises,
  COUNT(*) FILTER (WHERE c.needs_price_update = true) as pending_updates,
  COUNT(*) FILTER (WHERE c.updated_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour') as updated_last_hour,
  COUNT(*) FILTER (WHERE c.updated_at >= CURRENT_TIMESTAMP - INTERVAL '10 minutes') as updated_last_10min,
  CASE 
    WHEN MAX(c.updated_at) IS NOT NULL THEN 
      EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - MAX(c.updated_at)))::int || 's ago'
    ELSE 'Never'
  END as last_update
FROM cruise_lines cl
LEFT JOIN cruises c ON cl.id = c.cruise_line_id
GROUP BY cl.id, cl.name
HAVING COUNT(c.id) > 0
ORDER BY updated_last_10min DESC, updated_last_hour DESC;

-- ============================================================================
-- 3. PRICING DATA ANALYSIS
-- ============================================================================

-- Cruises with recent pricing updates
SELECT 
  '\nRecent Pricing Updates (Last Hour)' as section;

SELECT 
  c.id,
  c.cruise_id,
  c.name,
  c.sailing_date,
  c.cruise_line_id,
  COALESCE(c.interior_cheapest_price::text, 'NULL') as interior,
  COALESCE(c.oceanview_cheapest_price::text, 'NULL') as oceanview,
  COALESCE(c.balcony_cheapest_price::text, 'NULL') as balcony,
  COALESCE(c.suite_cheapest_price::text, 'NULL') as suite,
  c.updated_at,
  EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - c.updated_at))::int || 's ago' as updated_ago
FROM cruises c
WHERE c.updated_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour'
  AND (c.interior_cheapest_price IS NOT NULL OR 
       c.oceanview_cheapest_price IS NOT NULL OR 
       c.balcony_cheapest_price IS NOT NULL OR 
       c.suite_cheapest_price IS NOT NULL)
ORDER BY c.updated_at DESC
LIMIT 20;

-- Pricing update statistics by line
SELECT 
  '\nPricing Statistics by Line' as section;

SELECT 
  cl.name as cruise_line,
  COUNT(c.id) as total_cruises,
  COUNT(*) FILTER (WHERE c.sailing_date >= CURRENT_DATE) as future_cruises,
  COUNT(*) FILTER (
    WHERE c.interior_cheapest_price IS NOT NULL OR 
          c.oceanview_cheapest_price IS NOT NULL OR 
          c.balcony_cheapest_price IS NOT NULL OR 
          c.suite_cheapest_price IS NOT NULL
  ) as with_pricing,
  ROUND(
    COUNT(*) FILTER (
      WHERE c.interior_cheapest_price IS NOT NULL OR 
            c.oceanview_cheapest_price IS NOT NULL OR 
            c.balcony_cheapest_price IS NOT NULL OR 
            c.suite_cheapest_price IS NOT NULL
    ) * 100.0 / NULLIF(COUNT(*), 0), 
    1
  ) as pricing_coverage_pct
FROM cruise_lines cl
LEFT JOIN cruises c ON cl.id = c.cruise_line_id
WHERE c.sailing_date >= CURRENT_DATE
GROUP BY cl.id, cl.name
HAVING COUNT(c.id) > 0
ORDER BY pricing_coverage_pct DESC;

-- ============================================================================
-- 4. QUEUE AND PROCESSING STATUS
-- ============================================================================

-- Cruises that need price updates
SELECT 
  '\nCruises Awaiting Price Updates' as section;

SELECT 
  cl.name as cruise_line,
  COUNT(*) as pending_updates,
  MIN(c.price_update_requested_at) as oldest_request,
  MAX(c.price_update_requested_at) as newest_request,
  CASE 
    WHEN MIN(c.price_update_requested_at) IS NOT NULL THEN
      EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - MIN(c.price_update_requested_at)))::int || 's ago'
    ELSE 'N/A'
  END as oldest_request_ago
FROM cruises c
JOIN cruise_lines cl ON c.cruise_line_id = cl.id
WHERE c.needs_price_update = true
  AND c.sailing_date >= CURRENT_DATE
GROUP BY cl.id, cl.name
ORDER BY pending_updates DESC;

-- System health check
SELECT 
  '\nSystem Health Summary' as section;

SELECT 
  'Webhooks (24h)' as metric,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE processed = true) as processed,
  COUNT(*) FILTER (WHERE processed = false) as pending
FROM webhook_events 
WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'

UNION ALL

SELECT 
  'Cruise Updates (1h)' as metric,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE updated_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour') as processed,
  COUNT(*) FILTER (WHERE needs_price_update = true) as pending
FROM cruises
WHERE sailing_date >= CURRENT_DATE

UNION ALL

SELECT 
  'Price Coverage' as metric,
  COUNT(*) as total,
  COUNT(*) FILTER (
    WHERE interior_cheapest_price IS NOT NULL OR 
          oceanview_cheapest_price IS NOT NULL OR 
          balcony_cheapest_price IS NOT NULL OR 
          suite_cheapest_price IS NOT NULL
  ) as processed,
  COUNT(*) FILTER (
    WHERE interior_cheapest_price IS NULL AND 
          oceanview_cheapest_price IS NULL AND 
          balcony_cheapest_price IS NULL AND 
          suite_cheapest_price IS NULL
  ) as pending
FROM cruises
WHERE sailing_date >= CURRENT_DATE;

-- ============================================================================
-- 5. SPECIFIC LINE MONITORING (Replace 643 with your target line ID)
-- ============================================================================

-- Monitor specific line (example: line 643)
SELECT 
  '\n🎯 SPECIFIC LINE MONITORING (Line 643)' as section;

-- Recent webhooks for line 643
SELECT 
  'Recent Webhooks for Line 643' as subsection,
  id,
  event_type,
  CASE WHEN processed THEN '✅' ELSE '⏳' END as status,
  successful_count || '/' || failed_count as results,
  processing_time_ms || 'ms' as time,
  created_at,
  description
FROM webhook_events 
WHERE line_id = 643
  AND created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 5;

-- Cruise update status for line 643
SELECT 
  'Cruise Status for Line 643' as subsection,
  COUNT(*) as total_cruises,
  COUNT(*) FILTER (WHERE sailing_date >= CURRENT_DATE) as future_cruises,
  COUNT(*) FILTER (WHERE needs_price_update = true) as pending_updates,
  COUNT(*) FILTER (WHERE updated_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour') as updated_last_hour,
  COUNT(*) FILTER (
    WHERE interior_cheapest_price IS NOT NULL OR 
          oceanview_cheapest_price IS NOT NULL OR 
          balcony_cheapest_price IS NOT NULL OR 
          suite_cheapest_price IS NOT NULL
  ) as with_pricing
FROM cruises 
WHERE cruise_line_id = 643;

-- Recent updates for line 643
SELECT 
  'Recent Updates for Line 643' as subsection,
  id,
  cruise_id,
  name,
  sailing_date,
  CASE 
    WHEN interior_cheapest_price IS NOT NULL OR 
         oceanview_cheapest_price IS NOT NULL OR 
         balcony_cheapest_price IS NOT NULL OR 
         suite_cheapest_price IS NOT NULL 
    THEN '💰'
    ELSE '⚪'
  END as pricing,
  updated_at,
  EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - updated_at))::int || 's ago' as updated_ago
FROM cruises 
WHERE cruise_line_id = 643
  AND updated_at >= CURRENT_TIMESTAMP - INTERVAL '2 hours'
ORDER BY updated_at DESC
LIMIT 10;

-- ============================================================================
-- 6. PRICE HISTORY TRACKING (if table exists)
-- ============================================================================

-- Price history activity (last 24 hours)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'price_history') THEN
    PERFORM pg_notify('monitoring', 'Price History Tracking Available');
    
    -- This would run if price_history table exists
    RAISE NOTICE 'Price history table found - run price history queries manually';
  ELSE
    PERFORM pg_notify('monitoring', 'Price History Table Not Found');
  END IF;
END $$;

-- ============================================================================
-- 7. CONTINUOUS MONITORING QUERY (Run this in a loop)
-- ============================================================================

-- Simple status dashboard query (run this repeatedly)
SELECT 
  '\n🚀 LIVE STATUS DASHBOARD - ' || CURRENT_TIMESTAMP as header;

SELECT 
  'Active Processing' as section,
  (SELECT COUNT(*) FROM webhook_events WHERE processed = false) as pending_webhooks,
  (SELECT COUNT(*) FROM cruises WHERE needs_price_update = true AND sailing_date >= CURRENT_DATE) as pending_cruise_updates,
  (SELECT COUNT(*) FROM cruises WHERE updated_at >= CURRENT_TIMESTAMP - INTERVAL '10 minutes') as recent_updates,
  (SELECT COUNT(*) FROM webhook_events WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '10 minutes') as recent_webhooks;

-- Performance metrics
SELECT 
  'Performance (Last Hour)' as section,
  ROUND(AVG(processing_time_ms), 0) as avg_webhook_time_ms,
  MAX(processing_time_ms) as max_webhook_time_ms,
  COUNT(*) as total_webhooks_processed
FROM webhook_events 
WHERE processed_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour';

-- ============================================================================
-- 8. ERROR DETECTION QUERIES  
-- ============================================================================

-- Failed webhooks
SELECT 
  '\n❌ ERROR DETECTION' as section;

SELECT 
  'Failed Webhooks (Last 24h)' as subsection,
  id,
  line_id,
  event_type,
  failed_count,
  processing_time_ms,
  created_at,
  description
FROM webhook_events 
WHERE failed_count > 0
  AND created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 10;

-- Stale pending webhooks
SELECT 
  'Stale Pending Webhooks (>30min old)' as subsection,
  id,
  line_id,
  event_type,
  created_at,
  EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at))::int || 's old' as age,
  description
FROM webhook_events 
WHERE processed = false
  AND created_at < CURRENT_TIMESTAMP - INTERVAL '30 minutes'
ORDER BY created_at ASC;

-- ============================================================================
-- End of monitoring queries
-- ============================================================================

SELECT 
  '\n✅ Monitoring queries completed at ' || CURRENT_TIMESTAMP as footer;