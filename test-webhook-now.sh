#!/bin/bash

# Quick webhook test script
API_URL="https://zipsea-backend.onrender.com"

echo "🚀 Testing Comprehensive Webhook Processor"
echo "=========================================="
echo ""

# Function to test a cruise line
test_line() {
    local LINE_ID=$1
    local LINE_NAME=$2
    local EXPECTED=$3

    echo "📍 Testing Line $LINE_ID: $LINE_NAME (~$EXPECTED cruises)"

    # Trigger webhook
    echo "   Sending webhook..."
    RESPONSE=$(curl -s -X POST "$API_URL/api/webhooks/traveltek/test-comprehensive" \
        -H "Content-Type: application/json" \
        -d "{\"lineId\": $LINE_ID}" \
        -m 10)

    # Check response
    if echo "$RESPONSE" | grep -q "success.*true"; then
        echo "   ✅ Webhook accepted and processing"
        WEBHOOK_ID=$(echo "$RESPONSE" | grep -o '"webhookId":"[^"]*"' | cut -d'"' -f4)
        echo "   Webhook ID: $WEBHOOK_ID"
    else
        echo "   ❌ Webhook failed"
        echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    fi
    echo ""
}

# Test different sized cruise lines
echo "1️⃣ Small Test (1 cruise):"
test_line 41 "American Cruise Lines" 1

echo "2️⃣ Medium Test (5 cruises):"
test_line 21 "Crystal Cruises" 5

echo "3️⃣ Large Test (1228 cruises):"
echo "   ⚠️  This will process ALL 1228 cruises"
read -p "   Continue? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    test_line 14 "Holland America" 1228
fi

echo ""
echo "=========================================="
echo "📊 Checking Processing Status..."
echo ""

# Check diagnostics
DIAG=$(curl -s "$API_URL/api/webhooks/traveltek/diagnostics")
echo "Diagnostics:"
echo "$DIAG" | jq '.diagnostics | {redisStatus, ftpConnection, activeLocks}' 2>/dev/null || echo "Could not fetch diagnostics"

echo ""
echo "Recent Processing:"
echo "$DIAG" | jq '.diagnostics.recentProcessing[]' 2>/dev/null || echo "No recent processing"

echo ""
echo "=========================================="
echo "✅ Tests initiated successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Monitor Render logs: https://dashboard.render.com/web/srv-cqcph4lds78s739sl9og/logs"
echo "2. Run monitoring script: node backend/scripts/monitor-webhook-live.js"
echo "3. Check database for updated cruises"
echo ""
echo "The comprehensive processor will:"
echo "• Process ALL cruises (not limited to 500)"
echo "• Handle JSON corruption with retries"
echo "• Use FTP connection pooling"
echo "• Continue even if some files fail"
echo "=========================================="
