#!/bin/bash

echo "💰 MONITORING PRICING UPDATES"
echo "============================="
echo ""

BASE_URL=${1:-"https://zipsea-backend.onrender.com"}
LINE_ID=${2:-21}  # Default to Crystal Cruises

echo "Environment: $BASE_URL"
echo "Testing Line: $LINE_ID"
echo ""

# Step 1: Search for cruises from this line before webhook
echo "1️⃣ Checking current cruise data..."
BEFORE=$(curl -s "$BASE_URL/api/v1/search?query=crystal&limit=5")

if echo "$BEFORE" | grep -q "cruises"; then
    CRUISE_COUNT=$(echo "$BEFORE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
cruises = data.get('cruises', [])
print(len(cruises))
" 2>/dev/null || echo "0")

    echo "  Found $CRUISE_COUNT Crystal cruises"

    # Get the first cruise ID and its last update time
    FIRST_CRUISE=$(echo "$BEFORE" | python3 -c "
import sys, json
from datetime import datetime
data = json.load(sys.stdin)
cruises = data.get('cruises', [])
if cruises:
    c = cruises[0]
    updated = c.get('updated_at', c.get('updatedAt', 'unknown'))
    price = c.get('price_from', c.get('priceFrom', 'N/A'))
    print(f\"ID: {c.get('id', 'unknown')}\")
    print(f\"Updated: {updated}\")
    print(f\"Price: {price}\")
" 2>/dev/null)

    echo "$FIRST_CRUISE"
fi

echo ""
echo "2️⃣ Triggering webhook..."
WEBHOOK_RESPONSE=$(curl -s -X POST "$BASE_URL/api/webhooks/traveltek/fixed" \
    -H 'Content-Type: application/json' \
    -d "{\"lineId\": $LINE_ID}")

if echo "$WEBHOOK_RESPONSE" | grep -q "success.*true"; then
    WEBHOOK_ID=$(echo "$WEBHOOK_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('webhookId', 'unknown'))")
    echo "✅ Webhook accepted: $WEBHOOK_ID"
else
    echo "❌ Webhook failed"
    echo "$WEBHOOK_RESPONSE" | python3 -m json.tool
    exit 1
fi

echo ""
echo "3️⃣ Waiting for processing (30 seconds)..."
for i in {1..6}; do
    sleep 5
    echo -n "."
done
echo ""

echo ""
echo "4️⃣ Checking for updates..."

# Check diagnostics
DIAG=$(curl -s "$BASE_URL/api/webhooks/traveltek/diagnostics")
LOCKS=$(echo "$DIAG" | python3 -c "import sys, json; print(json.load(sys.stdin)['diagnostics']['activeLocks'])" 2>/dev/null || echo "0")
echo "  Active locks: $LOCKS"

# Check if cruises were updated
AFTER=$(curl -s "$BASE_URL/api/v1/search?query=crystal&limit=5")

if echo "$AFTER" | grep -q "cruises"; then
    UPDATED_COUNT=$(echo "$AFTER" | python3 -c "
import sys, json
from datetime import datetime, timedelta
data = json.load(sys.stdin)
cruises = data.get('cruises', [])
now = datetime.now()
minute_ago = now - timedelta(minutes=1)
updated = []
for c in cruises:
    updated_str = c.get('updated_at', c.get('updatedAt', '2020-01-01'))
    # Handle timezone
    updated_str = updated_str.replace('Z', '+00:00').replace('+00:00', '')
    try:
        updated_time = datetime.fromisoformat(updated_str)
        if updated_time > minute_ago:
            updated.append(c)
    except:
        pass
print(len(updated))
" 2>/dev/null || echo "0")

    if [ "$UPDATED_COUNT" -gt 0 ]; then
        echo "  ✅ $UPDATED_COUNT cruise(s) updated in the last minute!"

        # Show the updated cruise details
        echo "$AFTER" | python3 -c "
import sys, json
from datetime import datetime, timedelta
data = json.load(sys.stdin)
cruises = data.get('cruises', [])
now = datetime.now()
minute_ago = now - timedelta(minutes=1)
for c in cruises[:1]:  # Just show first cruise
    updated_str = c.get('updated_at', c.get('updatedAt', '2020-01-01'))
    updated_str = updated_str.replace('Z', '+00:00').replace('+00:00', '')
    try:
        updated_time = datetime.fromisoformat(updated_str)
        if updated_time > minute_ago:
            print(f\"    - {c.get('name', 'Unknown')}\")
            print(f\"      Updated: {updated_str}\")
            print(f\"      Price: {c.get('price_from', c.get('priceFrom', 'N/A'))}\")
    except:
        pass
"
    else
        echo "  ⚠️ No cruises updated recently"
    fi
fi

echo ""
echo "5️⃣ Checking pricing table directly..."
# Use the cruise endpoint to get more details
CRUISE_DETAILS=$(curl -s "$BASE_URL/api/v1/cruises?lineId=$LINE_ID&limit=1")
if echo "$CRUISE_DETAILS" | grep -q "id"; then
    echo "$CRUISE_DETAILS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if isinstance(data, list) and len(data) > 0:
    c = data[0]
    print(f\"  Cruise: {c.get('name', 'Unknown')}\")
    print(f\"  Last Update: {c.get('last_traveltek_update', 'Never')}\")
    pricing = c.get('pricing', {})
    if pricing:
        print(f\"  Pricing Available: Yes\")
        print(f\"    Interior: \${pricing.get('interior_price', 'N/A')}\")
        print(f\"    Oceanview: \${pricing.get('oceanview_price', 'N/A')}\")
    else:
        print(f\"  Pricing Available: No\")
"
fi

echo ""
echo "============================="
echo "📊 SUMMARY"
echo "============================="

if [ "$UPDATED_COUNT" -gt 0 ]; then
    echo "✅ Webhook processing is WORKING!"
    echo "   $UPDATED_COUNT cruise(s) were updated with new data"
else
    echo "⚠️ Webhook was accepted but no updates detected"
    echo "   Possible issues:"
    echo "   - Processing failed silently"
    echo "   - FTP files not available"
    echo "   - Database update errors"
    echo ""
    echo "   Check Render logs for details"
fi

echo "============================="
