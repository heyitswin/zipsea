#!/bin/bash

# Copy production cruises to staging database
# Run this locally - it has network access to both databases

echo "🚀 Copying production cruises to staging..."
echo ""

PROD_URL="postgresql://zipsea_user:aOLItWeqKie3hDgFOd2k8wjJNU2KtLVd@dpg-d2idqjjipnbc73abma3g-a.oregon-postgres.render.com/zipsea_db"
STAGING_URL="postgresql://zipsea_staging_user:sonvsEqFRsdpGW3GzmSzKZAydoEHwX8v@dpg-d2ii4d1r0fns738hchag-a.oregon-postgres.render.com/zipsea_staging_db"

echo "📊 Checking counts..."
PROD_COUNT=$(PGPASSWORD='aOLItWeqKie3hDgFOd2k8wjJNU2KtLVd' psql -h dpg-d2idqjjipnbc73abma3g-a.oregon-postgres.render.com -U zipsea_user -d zipsea_db -t -c "SELECT COUNT(*) FROM cruises;")
STAGING_COUNT=$(PGPASSWORD='sonvsEqFRsdpGW3GzmSzKZAydoEHwX8v' psql -h dpg-d2ii4d1r0fns738hchag-a.oregon-postgres.render.com -U zipsea_staging_user -d zipsea_staging_db -t -c "SELECT COUNT(*) FROM cruises;")

echo "Production: $PROD_COUNT cruises"
echo "Staging: $STAGING_COUNT cruises"
echo ""

echo "🗑️  Truncating staging cruises..."
PGPASSWORD='sonvsEqFRsdpGW3GzmSzKZAydoEHwX8v' psql -h dpg-d2ii4d1r0fns738hchag-a.oregon-postgres.render.com -U zipsea_staging_user -d zipsea_staging_db -c "TRUNCATE TABLE cruises CASCADE;" > /dev/null
echo "✅ Truncated"
echo ""

echo "📦 Dumping production cruises..."
PGPASSWORD='aOLItWeqKie3hDgFOd2k8wjJNU2KtLVd' pg_dump -h dpg-d2idqjjipnbc73abma3g-a.oregon-postgres.render.com -U zipsea_user -d zipsea_db -t cruises --data-only -f /tmp/cruises.sql
echo "✅ Dumped to /tmp/cruises.sql"
echo ""

echo "📥 Importing to staging..."
PGPASSWORD='sonvsEqFRsdpGW3GzmSzKZAydoEHwX8v' psql -h dpg-d2ii4d1r0fns738hchag-a.oregon-postgres.render.com -U zipsea_staging_user -d zipsea_staging_db -f /tmp/cruises.sql > /dev/null 2>&1
echo "✅ Imported"
echo ""

echo "📊 Verifying..."
NEW_COUNT=$(PGPASSWORD='sonvsEqFRsdpGW3GzmSzKZAydoEHwX8v' psql -h dpg-d2ii4d1r0fns738hchag-a.oregon-postgres.render.com -U zipsea_staging_user -d zipsea_staging_db -t -c "SELECT COUNT(*) FROM cruises;")
WITH_PRICES=$(PGPASSWORD='sonvsEqFRsdpGW3GzmSzKZAydoEHwX8v' psql -h dpg-d2ii4d1r0fns738hchag-a.oregon-postgres.render.com -U zipsea_staging_user -d zipsea_staging_db -t -c "SELECT COUNT(*) FROM cruises WHERE cheapest_price IS NOT NULL AND cheapest_price > 99;")

echo "Staging now has: $NEW_COUNT cruises"
echo "With valid prices: $WITH_PRICES cruises"
echo ""
echo "✅ Done!"
