#!/bin/bash

echo "🔄 Resuming Enhanced Sync on Production"
echo "========================================"
echo ""
echo "This script will:"
echo "1. Check current progress"
echo "2. Resume from checkpoint if available"
echo "3. Run in a persistent screen session"
echo ""

# SSH and run commands
ssh -t srv-d2idrj3ipnbc73abnee0@ssh.oregon.render.com << 'ENDSSH'
cd ~/project/src/backend

# Check current status
echo "📊 Current Status:"
echo "=================="

# Check checkpoint
if [ -f sync-checkpoint.json ]; then
    echo "✅ Checkpoint found!"
    LAST_MONTH=$(cat sync-checkpoint.json | grep lastProcessedMonth | cut -d'"' -f4)
    TOTAL_FILES=$(cat sync-checkpoint.json | grep totalFilesProcessed | grep -o '[0-9]*')
    echo "   Last processed month: $LAST_MONTH"
    echo "   Total files processed: $TOTAL_FILES"
else
    echo "📝 No checkpoint - will start fresh"
fi

# Check database
echo ""
echo "📈 Database Status:"
COUNTS=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM cruises" 2>/dev/null)
echo "   Current cruises in DB: $COUNTS"

echo ""
echo "🚀 Starting sync in screen session..."
echo "===================================="
echo ""

# Kill any existing sync screen session
screen -S sync -X quit 2>/dev/null

# Start new screen session with the sync
screen -dmS sync bash -c 'node scripts/sync-complete-enhanced.js 2>&1 | tee sync-log-$(date +%Y%m%d-%H%M%S).log'

echo "✅ Sync started in background!"
echo ""
echo "📝 Commands:"
echo "   • View progress:     screen -r sync"
echo "   • Detach (keep running): Ctrl+A then D"
echo "   • Check logs:        tail -f sync-log-*.log"
echo "   • Stop sync:         screen -S sync -X quit"
echo ""
echo "The sync will automatically resume from where it left off!"
echo "It saves progress after each batch, so it's safe to stop/restart."

# Show initial output
echo ""
echo "🔍 Initial output (attaching to screen for 5 seconds):"
echo "======================================================="
timeout 5 screen -r sync || true

echo ""
echo "✅ Sync is running in background. Use 'screen -r sync' to monitor."
ENDSSH
