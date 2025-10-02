#!/bin/bash

# Quick check if MSC has cruises in Nov 2026

echo "=== Checking MSC Cruises in November 2026 ==="
echo ""

# This assumes DATABASE_URL_PRODUCTION is set for production database
# Or DATABASE_URL for staging

DB_URL="${DATABASE_URL_PRODUCTION:-$DATABASE_URL}"

if [ -z "$DB_URL" ]; then
  echo "Error: DATABASE_URL not set"
  exit 1
fi

echo "1. Total MSC cruises:"
psql "$DB_URL" -c "SELECT COUNT(*) FROM cruises WHERE cruise_line_id = 16;"
echo ""

echo "2. MSC cruises in November 2026:"
psql "$DB_URL" -c "SELECT COUNT(*) FROM cruises WHERE cruise_line_id = 16 AND sailing_date >= '2026-11-01' AND sailing_date <= '2026-11-30';"
echo ""

echo "3. MSC cruises by month in 2026:"
psql "$DB_URL" -c "SELECT EXTRACT(MONTH FROM sailing_date) as month, COUNT(*) FROM cruises WHERE cruise_line_id = 16 AND EXTRACT(YEAR FROM sailing_date) = 2026 GROUP BY month ORDER BY month;"
echo ""

echo "4. All cruises in November 2026 (first 5 lines by cruise_line_id):"
psql "$DB_URL" -c "SELECT cruise_line_id, COUNT(*) FROM cruises WHERE sailing_date >= '2026-11-01' AND sailing_date <= '2026-11-30' GROUP BY cruise_line_id ORDER BY cruise_line_id LIMIT 10;"
