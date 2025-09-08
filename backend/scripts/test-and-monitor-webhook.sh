#!/bin/bash

# Test webhook and monitor processing in real-time
# Usage: ./test-and-monitor-webhook.sh <lineId>

LINE_ID=${1:-21}  # Default to Crystal Cruises (5 cruises) for quick test
API_URL="https://zipsea-production.onrender.com"

# Line information
declare -A LINES
LINES[21]="Crystal Cruises (5 cruises)"
LINES[14]="Holland America (1228 cruises)"
LINES[22]="Royal Caribbean (3102 cruises)"
LINES[16]="MSC Cruises (5956 cruises)"
LINES[41]="American Cruise Lines (1 cruise)"

echo "🚀 WEBHOOK TEST AND MONITOR"
echo "============================"
echo "Testing Line $LINE_ID: ${LINES[$LINE_ID]:-Unknown}"
echo ""

# Trigger webhook
echo "📤 Triggering webhook..."
RESPONSE=$(curl -s -X POST "$API_URL/api/webhooks/traveltek/cruiseline-pricing-updated" \
  -H "Content-Type: application/json" \
  -H "User-Agent: TravelTek-Webhook/2.0 (Test)" \
  -d "{
    \"event\": \"cruiseline_pricing_updated\",
    \"lineid\": $LINE_ID,
    \"marketid\": 0,
    \"currency\": \"USD\",
    \"timestamp\": $(date +%s),
    \"description\": \"Test comprehensive processor\"
  }")

echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

# Check if webhook was accepted
if echo "$RESPONSE" | grep -q "comprehensive_all_cruises"; then
    echo ""
    echo "✅ Webhook accepted with comprehensive processor!"
    echo ""
    echo "Starting real-time monitoring in 3 seconds..."
    echo "Press Ctrl+C to stop"
    sleep 3

    # Start monitoring
    node scripts/monitor-webhook-realtime.js $LINE_ID
else
    echo "❌ Webhook failed or not using comprehensive processor"
    echo "$RESPONSE"
fi
