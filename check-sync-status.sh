#!/bin/bash

echo "📊 Checking Sync Status on Production"
echo "======================================"
echo ""

ssh srv-d2idrj3ipnbc73abnee0@ssh.oregon.render.com << 'ENDSSH'
cd ~/project/src/backend

echo "📅 Checking date range processed:"
psql $DATABASE_URL -c "
SELECT
    TO_CHAR(MIN(sailing_date), 'Mon YYYY') as earliest_month,
    TO_CHAR(MAX(sailing_date), 'Mon YYYY') as latest_month,
    COUNT(DISTINCT DATE_TRUNC('month', sailing_date)) as months_processed
FROM cruises;" 2>/dev/null

echo ""
echo "📈 Cruises by month (last 10):"
psql $DATABASE_URL -c "
SELECT
    TO_CHAR(DATE_TRUNC('month', sailing_date), 'YYYY-MM') as month,
    COUNT(*) as cruises
FROM cruises
GROUP BY DATE_TRUNC('month', sailing_date)
ORDER BY month DESC
LIMIT 10;" 2>/dev/null

echo ""
echo "📋 Checking checkpoint file:"
if [ -f sync-enhanced-checkpoint.json ]; then
    echo "Last processed month:"
    grep lastProcessedMonth sync-enhanced-checkpoint.json
    echo "Total files processed:"
    grep totalFilesProcessed sync-enhanced-checkpoint.json
else
    echo "No checkpoint file found"
fi

echo ""
echo "💾 Data completeness check:"
psql $DATABASE_URL -c "
SELECT
    COUNT(*) as total,
    COUNT(CASE WHEN raw_data->'cheapest'->'combined' IS NOT NULL THEN 1 END) as with_pricing,
    COUNT(CASE WHEN jsonb_array_length(COALESCE(raw_data->'itinerary', '[]'::jsonb)) > 0 THEN 1 END) as with_itinerary,
    COUNT(CASE WHEN raw_data->'cabins' IS NOT NULL THEN 1 END) as with_cabins,
    ROUND(AVG(jsonb_array_length(COALESCE(raw_data->'itinerary', '[]'::jsonb)))) as avg_days
FROM cruises;" 2>/dev/null

ENDSSH
