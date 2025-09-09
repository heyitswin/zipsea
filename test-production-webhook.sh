#!/bin/bash

echo "🏭 TESTING PRODUCTION-READY WEBHOOK"
echo "===================================="
echo ""
echo "This test will:"
echo "1. Clear any stuck locks"
echo "2. Test with Crystal Cruises (5 cruises)"
echo "3. Monitor for FTP errors"
echo "4. Check if pricing is updated"
echo ""

BASE_URL=${1:-"https://zipsea-backend.onrender.com"}
echo "Testing on: $BASE_URL"
echo ""

# Step 1: Clear locks
echo "1️⃣ Clearing any stuck locks..."
curl -s -X POST "$BASE_URL/api/webhooks/traveltek/clear-locks" \
    -H 'Content-Type: application/json' | python3 -c "
import sys, json
data = json.load(sys.stdin)
if data.get('success'):
    print(f\"✅ Cleared {len(data.get('cleared', []))} lock(s)\")
else:
    print('❌ Failed to clear locks')
"

echo ""
echo "2️⃣ Triggering production webhook for Crystal (line 21)..."
RESPONSE=$(curl -s -X POST "$BASE_URL/api/webhooks/traveltek/production" \
    -H 'Content-Type: application/json' \
    -d '{"lineId": 21}')

if echo "$RESPONSE" | grep -q "success.*true"; then
    WEBHOOK_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('webhookId', 'unknown'))")
    echo "✅ Webhook accepted: $WEBHOOK_ID"
    echo "   Processor: WebhookProductionFixService"
    echo "   Mode: Sequential with proper FTP management"
else
    echo "❌ Webhook failed to start"
    echo "$RESPONSE" | python3 -m json.tool
    exit 1
fi

echo ""
echo "3️⃣ Monitoring processing (45 seconds)..."
echo "   Checking every 5 seconds for updates..."
echo ""

for i in {1..9}; do
    sleep 5

    # Check diagnostics
    DIAG=$(curl -s "$BASE_URL/api/webhooks/traveltek/diagnostics")
    LOCKS=$(echo "$DIAG" | python3 -c "import sys, json; print(json.load(sys.stdin)['diagnostics']['activeLocks'])" 2>/dev/null || echo "0")

    # Check for recent updates
    SEARCH=$(curl -s "$BASE_URL/api/v1/search?query=crystal&limit=5")
    UPDATED=$(echo "$SEARCH" | python3 -c "
import sys, json
from datetime import datetime, timedelta
try:
    data = json.load(sys.stdin)
    cruises = data.get('cruises', [])
    now = datetime.now()
    two_min_ago = now - timedelta(minutes=2)
    updated = []
    for c in cruises:
        updated_str = c.get('updated_at', c.get('updatedAt', '2020-01-01'))
        updated_str = updated_str.replace('Z', '+00:00').replace('+00:00', '')
        try:
            updated_time = datetime.fromisoformat(updated_str)
            if updated_time > two_min_ago:
                updated.append(c)
        except:
            pass
    if updated:
        print(f'✅ {len(updated)} cruise(s) updated!')
        for c in updated[:2]:
            price = c.get('price_from', c.get('priceFrom', 'N/A'))
            print(f\"   - {c.get('name', 'Unknown')[:50]}: \${price}\")
    else:
        print(f'⏳ No updates yet (Lock: {sys.argv[1]})')
except Exception as e:
    print(f'⏳ Checking... (Lock: {sys.argv[1]})')
" "$LOCKS" 2>/dev/null || echo "⏳ Checking... (Lock: $LOCKS)")

    echo "$UPDATED"

    # If we found updates, break early
    if echo "$UPDATED" | grep -q "✅"; then
        echo ""
        echo "🎉 SUCCESS! Cruises are being updated!"
        break
    fi
done

echo ""
echo "4️⃣ Final Status Check..."
echo ""

# Final diagnostics
FINAL_DIAG=$(curl -s "$BASE_URL/api/webhooks/traveltek/diagnostics")
echo "$FINAL_DIAG" | python3 -c "
import sys, json
data = json.load(sys.stdin)
diag = data['diagnostics']
print('System Status:')
print(f'  FTP: {diag[\"ftpConnection\"]}')
print(f'  Redis: {diag[\"redisStatus\"]}')
print(f'  Active Locks: {diag[\"activeLocks\"]}')
"

# Check final cruise updates
echo ""
echo "Cruise Updates:"
FINAL_SEARCH=$(curl -s "$BASE_URL/api/v1/search?query=crystal&limit=10")
echo "$FINAL_SEARCH" | python3 -c "
import sys, json
from datetime import datetime, timedelta
data = json.load(sys.stdin)
cruises = data.get('cruises', [])
now = datetime.now()
five_min_ago = now - timedelta(minutes=5)
updated = []
for c in cruises:
    updated_str = c.get('updated_at', c.get('updatedAt', '2020-01-01'))
    updated_str = updated_str.replace('Z', '+00:00').replace('+00:00', '')
    try:
        updated_time = datetime.fromisoformat(updated_str)
        if updated_time > five_min_ago:
            updated.append(c)
    except:
        pass

if updated:
    print(f'  ✅ {len(updated)} cruise(s) updated in last 5 minutes')
    for c in updated[:3]:
        price = c.get('price_from', c.get('priceFrom', 'N/A'))
        updated_str = c.get('updated_at', c.get('updatedAt', 'unknown'))
        print(f'     - {c.get(\"name\", \"Unknown\")[:40]}')
        print(f'       Price: \${price}')
        print(f'       Updated: {updated_str[:19]}')
else:
    print('  ⚠️ No cruises updated in last 5 minutes')
"

echo ""
echo "===================================="
echo "📊 TEST SUMMARY"
echo "===================================="

# Final check for success
FINAL_COUNT=$(echo "$FINAL_SEARCH" | python3 -c "
import sys, json
from datetime import datetime, timedelta
data = json.load(sys.stdin)
cruises = data.get('cruises', [])
now = datetime.now()
five_min_ago = now - timedelta(minutes=5)
count = 0
for c in cruises:
    updated_str = c.get('updated_at', c.get('updatedAt', '2020-01-01'))
    updated_str = updated_str.replace('Z', '+00:00').replace('+00:00', '')
    try:
        updated_time = datetime.fromisoformat(updated_str)
        if updated_time > five_min_ago:
            count += 1
    except:
        pass
print(count)
" 2>/dev/null || echo "0")

if [ "$FINAL_COUNT" -gt 0 ]; then
    echo "✅ WEBHOOK PROCESSING IS WORKING!"
    echo "   $FINAL_COUNT cruise(s) were successfully updated"
    echo ""
    echo "Next steps:"
    echo "1. Test with a larger cruise line (MSC - line 16)"
    echo "   curl -X POST $BASE_URL/api/webhooks/traveltek/production \\"
    echo "     -H 'Content-Type: application/json' \\"
    echo "     -d '{\"lineId\": 16}'"
else
    echo "⚠️ WEBHOOK PROCESSING NEEDS ATTENTION"
    echo "   No cruises were updated"
    echo ""
    echo "Check Render logs for:"
    echo "- FTP connection errors"
    echo "- Database connection issues"
    echo "- Processing exceptions"
fi

echo "===================================="
