#!/bin/bash

echo "========================================="
echo "Testing Webhook Pricing Sync on Staging"
echo "========================================="
echo ""

STAGING_URL="https://zipsea-backend.onrender.com"

# Test webhook health first
echo "1. Checking Webhook Health..."
curl -s "$STAGING_URL/api/webhooks/traveltek/health" | jq
echo ""

# Test cruise pricing update with correct 2-level structure
echo "2. Testing Cruise Pricing Update (2-level structure)..."
echo "   POST $STAGING_URL/api/webhooks/traveltek/cruises-pricing-updated"
echo ""

# Sample pricing data with correct 2-level structure
curl -X POST "$STAGING_URL/api/webhooks/traveltek/cruises-pricing-updated" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "cruises_pricing_updated",
    "data": {
      "cruiseIds": [1],
      "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
    }
  }' | jq

echo ""
echo "3. Testing Cruiseline Pricing Update..."
echo "   POST $STAGING_URL/api/webhooks/traveltek/cruiseline-pricing-updated"
echo ""

curl -X POST "$STAGING_URL/api/webhooks/traveltek/cruiseline-pricing-updated" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "cruiseline_pricing_updated",
    "data": {
      "lineId": 1,
      "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
    }
  }' | jq

echo ""
echo "4. Testing Generic Webhook with Sample Pricing Data..."
echo "   POST $STAGING_URL/api/webhooks/traveltek"
echo ""

# Test with actual 2-level pricing structure
curl -X POST "$STAGING_URL/api/webhooks/traveltek" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "pricing_updated",
    "data": {
      "cruiseId": 1,
      "priceData": {
        "RATE001": {
          "INT101": {
            "price": "1299",
            "cabintype": "Interior",
            "adultprice": "1299",
            "childprice": "899",
            "taxes": "150",
            "ncf": "100"
          },
          "BAL201": {
            "price": "1799",
            "cabintype": "Balcony",
            "adultprice": "1799",
            "childprice": "1299",
            "taxes": "150",
            "ncf": "100"
          }
        }
      },
      "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
    }
  }' | jq

echo ""
echo "========================================="
echo "Summary:"
echo "========================================="
echo ""
echo "If the 2-level pricing fix is working:"
echo "- Webhook should accept the data without errors"
echo "- You should see success responses"
echo "- Check Slack for webhook notifications"
echo "- Check logs for 'Synced X static pricing records' messages"
echo ""
echo "Previous issue was using 3-level structure:"
echo "  rateCode -> cabinCode -> occupancyCode -> priceData"
echo ""
echo "Fixed to use 2-level structure:"
echo "  rateCode -> cabinId -> priceData"
echo ""