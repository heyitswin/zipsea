#!/bin/bash

# Test webhook as if from Traveltek
# Usage: ./test-webhook-manual.sh [staging|production] [lineId]

ENV=${1:-staging}
LINE_ID=${2:-22}  # Default to Line 22 (Royal Caribbean)

if [ "$ENV" = "production" ]; then
  URL="https://zipsea-production.onrender.com/api/webhooks/traveltek/cruiseline-pricing-updated"
else
  URL="https://zipsea-backend.onrender.com/api/webhooks/traveltek/cruiseline-pricing-updated"
fi

echo "🚀 Sending webhook to $ENV environment"
echo "📍 URL: $URL"
echo "🚢 Line ID: $LINE_ID"
echo ""

# Send the webhook
curl -X POST "$URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"event\": \"cruiseline_pricing_updated\",
    \"lineId\": $LINE_ID,
    \"lineid\": $LINE_ID,
    \"marketid\": 0,
    \"currency\": \"USD\",
    \"description\": \"Manual test - Line $LINE_ID pricing update\",
    \"source\": \"manual_test\",
    \"timestamp\": $(date +%s)
  }" \
  -w "\n\n📊 Response Status: %{http_code}\n⏱️  Response Time: %{time_total}s\n" \
  | jq '.'

echo ""
echo "✅ Webhook sent! Check:"
echo "  1. Slack for notifications"
echo "  2. Logs for processing"
echo "  3. Database for needs_price_update flags"
