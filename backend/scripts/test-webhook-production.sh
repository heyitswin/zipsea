#!/bin/bash

# Test webhook processing on production
echo "====================================="
echo "Testing Webhook Processing - Production"
echo "====================================="

# Test with Line 10 (Royal Caribbean)
echo -e "\nTriggering webhook for Line 10 (Royal Caribbean)..."

curl -X POST https://zipsea-production.onrender.com/webhooks/realtime/line-updated \
  -H "Content-Type: application/json" \
  -d '{
    "lineId": 10,
    "updateType": "cruises",
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
    "source": "manual_test"
  }' \
  -w "\nHTTP Status: %{http_code}\nResponse Time: %{time_total}s\n" \
  -s | jq '.' 2>/dev/null || echo "Response received"

echo -e "\n====================================="
echo "Webhook test complete!"
echo ""
echo "Next steps:"
echo "1. Check the database for new pricing records"
echo "2. Monitor Slack notifications (if configured)"
echo "3. Check Render logs for processing details"
echo "====================================="
