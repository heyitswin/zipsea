#!/bin/bash

echo "🔍 Checking Sync Progress on Production"
echo "========================================"
echo ""

# SSH into production and check progress
ssh srv-d2idrj3ipnbc73abnee0@ssh.oregon.render.com << 'ENDSSH'
cd ~/project/src/backend

echo "📋 Checking for checkpoint file..."
if [ -f sync-checkpoint.json ]; then
    echo "✅ Checkpoint found! Here's the progress:"
    echo ""
    cat sync-checkpoint.json | python3 -m json.tool 2>/dev/null || cat sync-checkpoint.json
    echo ""
else
    echo "❌ No checkpoint file found"
fi

echo ""
echo "📊 Checking database progress..."
psql $DATABASE_URL -c "
SELECT
    (SELECT COUNT(*) FROM cruises) as total_cruises,
    (SELECT COUNT(DISTINCT cruise_line_id) FROM cruises) as unique_lines,
    (SELECT COUNT(DISTINCT ship_id) FROM cruises) as unique_ships,
    (SELECT MIN(sailing_date) FROM cruises) as earliest_sailing,
    (SELECT MAX(sailing_date) FROM cruises) as latest_sailing
" 2>/dev/null

echo ""
echo "📅 Checking last processed month..."
psql $DATABASE_URL -c "
SELECT
    DATE_TRUNC('month', sailing_date) as month,
    COUNT(*) as cruises_count
FROM cruises
GROUP BY DATE_TRUNC('month', sailing_date)
ORDER BY month DESC
LIMIT 5
" 2>/dev/null

ENDSSH

echo ""
echo "💡 To RESUME the sync, run:"
echo "   ssh srv-d2idrj3ipnbc73abnee0@ssh.oregon.render.com"
echo "   cd ~/project/src/backend"
echo "   screen -S sync"
echo "   node scripts/sync-complete-enhanced.js"
echo ""
echo "   (Press Ctrl+A then D to detach and keep it running)"
echo "   (Use 'screen -r sync' to reattach later)"
echo ""
echo "The sync will automatically resume from the checkpoint!"
