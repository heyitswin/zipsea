#!/bin/bash

echo "========================================="
echo "Testing Zipsea Staging Deployment"
echo "========================================="
echo ""

STAGING_URL="https://zipsea-backend-staging.onrender.com"

# Test health endpoint
echo "1. Testing Health Endpoint..."
echo "   GET $STAGING_URL/health"
curl -s "$STAGING_URL/health" | python3 -m json.tool
echo ""

# Test API info endpoint
echo "2. Testing API Info Endpoint..."
echo "   GET $STAGING_URL/api/v1"
curl -s "$STAGING_URL/api/v1" | python3 -m json.tool
echo ""

# Test webhook health
echo "3. Testing Webhook Health..."
echo "   GET $STAGING_URL/api/webhooks/traveltek/health"
curl -s "$STAGING_URL/api/webhooks/traveltek/health" | python3 -m json.tool
echo ""

# Test cruiseline pricing webhook
echo "4. Testing Cruiseline Pricing Webhook..."
echo "   POST $STAGING_URL/api/webhooks/traveltek/cruiseline-pricing-updated"
curl -s -X POST "$STAGING_URL/api/webhooks/traveltek/cruiseline-pricing-updated" \
  -H "Content-Type: application/json" \
  -d '{"event": "test", "data": {"test": true}}' | python3 -m json.tool
echo ""

# Test live pricing webhook
echo "5. Testing Live Pricing Webhook..."
echo "   POST $STAGING_URL/api/webhooks/traveltek/cruises-live-pricing-updated"
curl -s -X POST "$STAGING_URL/api/webhooks/traveltek/cruises-live-pricing-updated" \
  -H "Content-Type: application/json" \
  -d '{"event": "test", "data": {"test": true}}' | python3 -m json.tool
echo ""

# Test search endpoint
echo "6. Testing Search Endpoint..."
echo "   GET $STAGING_URL/api/v1/search/filters"
curl -s "$STAGING_URL/api/v1/search/filters" | python3 -m json.tool
echo ""

echo "========================================="
echo "Webhook URLs for Traveltek Registration:"
echo "========================================="
echo ""
echo "Cruiseline Pricing Updates:"
echo "$STAGING_URL/api/webhooks/traveltek/cruiseline-pricing-updated"
echo ""
echo "Live Pricing Updates:"
echo "$STAGING_URL/api/webhooks/traveltek/cruises-live-pricing-updated"
echo ""
echo "========================================="