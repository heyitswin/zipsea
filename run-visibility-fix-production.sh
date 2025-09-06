#!/bin/bash

echo "🔧 Running Visibility Fix on Production"
echo "========================================"
echo ""

# SSH and run the fix
ssh srv-d2idrj3ipnbc73abnee0@ssh.oregon.render.com << 'ENDSSH'
cd ~/project/src/backend

echo "📊 Before fix:"
psql $DATABASE_URL -c "
  SELECT
    COUNT(*) as total,
    COUNT(CASE WHEN is_active = true AND show_cruise = true THEN 1 END) as searchable
  FROM cruises
" 2>/dev/null

echo ""
echo "🔧 Running visibility fix..."
node scripts/fix-cruise-visibility.js

echo ""
echo "📊 After fix:"
psql $DATABASE_URL -c "
  SELECT
    COUNT(*) as total,
    COUNT(CASE WHEN is_active = true AND show_cruise = true THEN 1 END) as searchable
  FROM cruises
" 2>/dev/null

echo ""
echo "✅ Complete!"
ENDSSH
