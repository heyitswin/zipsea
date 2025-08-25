#!/bin/bash

# Test webhook on production with sample data
# This simulates what Traveltek would send

echo "🚀 Testing webhook on production..."
echo "======================================"

# Test webhook URL (change to staging if needed)
URL="https://zipsea-production.onrender.com/api/webhooks/traveltek"
# URL="https://zipsea-backend.onrender.com/api/webhooks/traveltek"  # Uncomment for staging

# Sample webhook payload (simulating Traveltek data)
PAYLOAD=$(cat <<'EOF'
{
  "event_type": "cruiseline_pricing_updated",
  "lineid": "RCCL",
  "lineId": "RCCL",
  "line_name": "Royal Caribbean",
  "marketid": 1,
  "currency": "USD",
  "description": "Test webhook for Royal Caribbean pricing update",
  "source": "traveltek",
  "timestamp": 1756150401,
  "files": [
    "2025/09/RCCL/354335.json",
    "2025/09/RCCL/358122.json"
  ],
  "cruises_affected": 2,
  "test": true
}
EOF
)

echo "Sending test webhook to: $URL"
echo "Payload:"
echo "$PAYLOAD" | python3 -m json.tool

echo ""
echo "Response:"
curl -X POST "$URL" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  --write-out "\nHTTP Status: %{http_code}\n" \
  2>/dev/null | python3 -m json.tool

echo ""
echo "======================================"
echo "✅ Test webhook sent!"
echo ""
echo "Check the following:"
echo "1. Slack channel for notifications"
echo "2. Webhook status: https://zipsea-production.onrender.com/api/webhooks/traveltek/status"
echo "3. Application logs in Render dashboard"