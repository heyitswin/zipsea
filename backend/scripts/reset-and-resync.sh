#!/bin/bash

# Reset database and resync with correct field mappings
# WARNING: This will DELETE ALL DATA and start fresh

echo "⚠️  DATABASE RESET AND RESYNC"
echo "=============================="
echo ""
echo "This will:"
echo "  1. DROP all cruise-related tables"
echo "  2. Recreate schema from migrations"
echo "  3. Sync fresh data with correct field mappings"
echo ""
echo "Environment: $NODE_ENV"
echo "Database: $DATABASE_URL"
echo ""

read -p "Are you SURE you want to reset the database? (type 'yes' to confirm): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "❌ Cancelled"
  exit 1
fi

echo ""
echo "🗑️  Step 1: Dropping tables..."
echo "================================"

# Drop all tables in correct order (to avoid FK constraints)
psql $DATABASE_URL << EOF
-- Drop dependent tables first
DROP TABLE IF EXISTS pricing CASCADE;
DROP TABLE IF EXISTS cheapest_pricing CASCADE;
DROP TABLE IF EXISTS itineraries CASCADE;
DROP TABLE IF EXISTS cabin_categories CASCADE;
DROP TABLE IF EXISTS price_history CASCADE;
DROP TABLE IF EXISTS alternative_sailings CASCADE;
DROP TABLE IF EXISTS quotes CASCADE;
DROP TABLE IF EXISTS quote_items CASCADE;

-- Drop main tables
DROP TABLE IF EXISTS cruises CASCADE;
DROP TABLE IF EXISTS ships CASCADE;
DROP TABLE IF EXISTS cruise_lines CASCADE;
DROP TABLE IF EXISTS ports CASCADE;
DROP TABLE IF EXISTS regions CASCADE;

-- Drop any other tables
DROP TABLE IF EXISTS webhooks CASCADE;
DROP TABLE IF EXISTS sync_logs CASCADE;

-- Show remaining tables
\dt
EOF

echo ""
echo "✅ Tables dropped"
echo ""

echo "🔨 Step 2: Running migrations..."
echo "================================"

# Run migrations to recreate schema
npm run migrate

echo ""
echo "✅ Schema recreated"
echo ""

echo "🚢 Step 3: Syncing fresh data..."
echo "================================"
echo ""

# Use the month-by-month sync for better control
echo "Syncing September 2025..."
YEAR=2025 MONTH=9 BATCH_SIZE=5 node scripts/sync-by-month.js

echo ""
echo "Syncing October 2025..."
YEAR=2025 MONTH=10 BATCH_SIZE=5 node scripts/sync-by-month.js

echo ""
echo "✅ Initial sync complete"
echo ""

echo "📊 Step 4: Verifying data..."
echo "============================="
echo ""

psql $DATABASE_URL << EOF
SELECT 'Cruise Lines' as table_name, COUNT(*) as count FROM cruise_lines
UNION ALL
SELECT 'Ships', COUNT(*) FROM ships
UNION ALL
SELECT 'Cruises', COUNT(*) FROM cruises
UNION ALL
SELECT 'Ports', COUNT(*) FROM ports
UNION ALL
SELECT 'Pricing', COUNT(*) FROM pricing;

-- Check for bad names
SELECT 'Bad Cruise Line Names' as issue, COUNT(*) as count 
FROM cruise_lines 
WHERE name LIKE 'CL%' OR name LIKE 'Line %'
UNION ALL
SELECT 'Bad Ship Names', COUNT(*) 
FROM ships 
WHERE name LIKE 'Ship %' OR name LIKE 'MS S%';

-- Sample data
\echo ''
\echo 'Sample Cruise Lines:'
SELECT id, name FROM cruise_lines LIMIT 5;

\echo ''
\echo 'Sample Ships:'
SELECT id, name, cruise_line_id FROM ships LIMIT 5;

\echo ''
\echo 'Sample Cruises:'
SELECT id, name, sailing_date FROM cruises ORDER BY sailing_date LIMIT 5;
EOF

echo ""
echo "✅ Database reset and resync complete!"
echo ""
echo "Next steps:"
echo "1. Test the API: curl https://\$DOMAIN/api/v1/cruises?limit=5"
echo "2. Test search: curl https://\$DOMAIN/api/v1/search?q=Caribbean&limit=5"
echo "3. Continue syncing other months as needed"