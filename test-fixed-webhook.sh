#!/bin/bash

echo "🔧 TESTING FIXED WEBHOOK SERVICE"
echo "================================"
echo ""

# Function to test an environment
test_environment() {
    local ENV_NAME=$1
    local BASE_URL=$2

    echo "📍 Testing $ENV_NAME"
    echo "URL: $BASE_URL"
    echo ""

    # Clear any stuck locks first
    echo "1️⃣ Clearing stuck locks..."
    curl -s -X POST "$BASE_URL/api/webhooks/traveltek/clear-locks" \
        -H 'Content-Type: application/json' | python3 -c "import sys, json; data = json.load(sys.stdin); print(f\"  Cleared {len(data.get('cleared', []))} lock(s)\")"

    # Test the fixed webhook endpoint
    echo ""
    echo "2️⃣ Testing fixed webhook with Crystal Cruises (5 cruises)..."
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/webhooks/traveltek/fixed" \
        -H 'Content-Type: application/json' \
        -d '{"lineId": 21}')

    if echo "$RESPONSE" | grep -q "success.*true"; then
        echo "✅ Fixed webhook accepted"
        WEBHOOK_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('webhookId', 'unknown'))")
        echo "  Webhook ID: $WEBHOOK_ID"

        # Wait for processing
        echo ""
        echo "⏳ Waiting 15 seconds for processing..."
        sleep 15

        # Check status
        echo ""
        echo "3️⃣ Checking processing status..."
        DIAG=$(curl -s "$BASE_URL/api/webhooks/traveltek/diagnostics")

        ACTIVE_LOCKS=$(echo "$DIAG" | python3 -c "import sys, json; print(json.load(sys.stdin)['diagnostics']['activeLocks'])" 2>/dev/null || echo "0")
        echo "  Active Locks: $ACTIVE_LOCKS"

        # Check for recent processing
        echo "$DIAG" | python3 -c "
import sys, json
data = json.load(sys.stdin)
recent = data['diagnostics'].get('recentProcessing', [])
if recent:
    print('  ✅ Processing detected!')
    for p in recent:
        print(f\"    - Line {p.get('lineId', '?')}: {p.get('status', 'unknown')}\")
else:
    print('  ⚠️  No recent processing detected')
"

        # Check for updated cruises
        echo ""
        echo "4️⃣ Checking for updated cruises..."
        SEARCH=$(curl -s "$BASE_URL/api/v1/search?query=crystal&limit=5")

        if [ $? -eq 0 ] && echo "$SEARCH" | grep -q "cruises"; then
            UPDATED_COUNT=$(echo "$SEARCH" | python3 -c "
import sys, json
from datetime import datetime, timedelta
data = json.load(sys.stdin)
cruises = data.get('cruises', [])
now = datetime.now()
hour_ago = now - timedelta(hours=1)
updated = [c for c in cruises if datetime.fromisoformat(c.get('updated_at', '2020-01-01').replace('Z', '+00:00').replace('+00:00', '')) > hour_ago]
print(len(updated))
" 2>/dev/null || echo "0")

            if [ "$UPDATED_COUNT" -gt 0 ]; then
                echo "  ✅ $UPDATED_COUNT cruise(s) updated in the last hour!"
            else
                echo "  ⚠️  No cruises updated recently"
            fi
        fi

    else
        echo "❌ Fixed webhook failed"
        echo "$RESPONSE" | python3 -m json.tool
    fi

    echo ""
    echo "---"
    echo ""
}

# Test staging
test_environment "STAGING" "https://zipsea-backend.onrender.com"

# Test production
test_environment "PRODUCTION" "https://zipsea-production.onrender.com"

echo "================================"
echo "📊 TEST COMPLETE"
echo ""
echo "💡 Next Steps:"
echo "1. If both environments fail, check Render logs for errors"
echo "2. If processing works, test with larger cruise line:"
echo "   curl -X POST https://zipsea-production.onrender.com/api/webhooks/traveltek/fixed \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"lineId\": 16}'  # MSC with 6000 cruises"
echo ""
echo "3. Monitor with:"
echo "   ./webhook-monitor.sh"
echo "================================"
