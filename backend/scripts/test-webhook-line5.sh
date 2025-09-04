#!/bin/bash

# Test webhook for Line 5 (Cunard) specifically
# This simulates a Traveltek webhook for Cunard cruises

ENV=${1:-staging}

if [ "$ENV" = "production" ]; then
  URL="https://zipsea-production.onrender.com/api/webhooks/traveltek/cruiseline-pricing-updated"
  echo "🚀 Sending to PRODUCTION"
else
  URL="https://zipsea-backend.onrender.com/api/webhooks/traveltek/cruiseline-pricing-updated"
  echo "🚀 Sending to STAGING"
fi

echo "📍 Testing Line 5 (Cunard) webhook"
echo "🔗 URL: $URL"
echo ""

curl -X POST "$URL" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "cruiseline_pricing_updated",
    "lineId": 5,
    "lineid": 5,
    "marketid": 0,
    "currency": "USD",
    "description": "Cunard Line pricing update",
    "source": "traveltek_webhook",
    "timestamp": '$(date +%s)'
  }' \
  -w "\n\n✅ Status: %{http_code}\n⏱️  Time: %{time_total}s\n"

echo ""
echo "📋 Next steps:"
echo "  1. Check Slack for 'Webhook Received - Cruises Flagged' message"
echo "  2. Wait up to 5 minutes for batch sync to run"
echo "  3. Check for 'Batch Sync Complete' message in Slack"
