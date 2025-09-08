#!/bin/bash

# Ultra-simple webhook status checker
# One command shows everything you need to know

API_URL="https://zipsea-production.onrender.com"

echo "🔄 WEBHOOK STATUS"
echo "================="
echo ""

# 1. Check if webhooks are working
echo "✅ System Health:"
FTP=$(curl -s $API_URL/api/webhooks/traveltek/diagnostics | jq -r '.diagnostics.ftpConnection' 2>/dev/null)
REDIS=$(curl -s $API_URL/api/webhooks/traveltek/diagnostics | jq -r '.diagnostics.redisStatus' 2>/dev/null)
echo "  FTP: ${FTP:-unknown}"
echo "  Redis: ${REDIS:-unknown}"
echo ""

# 2. Check active processing
echo "📊 Active Processing:"
LOCKS=$(curl -s $API_URL/api/webhooks/traveltek/diagnostics | jq -r '.diagnostics.activeLocks' 2>/dev/null)
if [ "$LOCKS" = "0" ] || [ -z "$LOCKS" ]; then
    echo "  No webhooks currently processing"
else
    echo "  $LOCKS webhook(s) currently processing"
fi
echo ""

# 3. Check recent updates (what actually happened)
echo "📈 Recent Updates (last hour):"
curl -s $API_URL/api/webhooks/traveltek/diagnostics | jq -r '
    .diagnostics.recentProcessing[] |
    "  • Line \(.lineId): \(.cruisesUpdated) cruises at \(.lastUpdate | split("T")[1] | split(".")[0])"
' 2>/dev/null || echo "  No recent updates"

echo ""
echo "=================="
echo ""

# Quick test option
if [ "$1" = "test" ]; then
    echo "🧪 Testing webhook with Line 21 (5 cruises)..."
    RESPONSE=$(curl -s -X POST $API_URL/api/webhooks/traveltek/cruiseline-pricing-updated \
        -H "Content-Type: application/json" \
        -d '{"event": "cruiseline_pricing_updated", "lineid": 21}')

    if echo "$RESPONSE" | grep -q "comprehensive_all_cruises"; then
        echo "✅ Webhook accepted! Processing ALL cruises."
        echo ""
        echo "Check status again in 30 seconds to see updates."
    else
        echo "❌ Webhook failed"
        echo "$RESPONSE" | jq '.' 2>/dev/null
    fi
    echo ""
fi

# Usage help
if [ -z "$1" ]; then
    echo "💡 Usage:"
    echo "  ./webhook-status.sh        # Check current status"
    echo "  ./webhook-status.sh test   # Test with small cruise line"
    echo ""
    echo "📝 To trigger a specific cruise line:"
    echo "  curl -X POST $API_URL/api/webhooks/traveltek/cruiseline-pricing-updated \\"
    echo "    -H 'Content-Type: application/json' \\"
    echo "    -d '{\"event\": \"cruiseline_pricing_updated\", \"lineid\": 16}'"
    echo ""
    echo "📊 Common Line IDs:"
    echo "  21 = Crystal (5 cruises)"
    echo "  14 = Holland America (1,228 cruises)"
    echo "  22 = Royal Caribbean (3,102 cruises)"
    echo "  16 = MSC (5,956 cruises)"
fi
