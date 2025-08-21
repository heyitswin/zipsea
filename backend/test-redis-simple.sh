#!/bin/bash

echo "========================================="
echo "Testing Redis on Staging (Simple Tests)"
echo "========================================="
echo ""

STAGING_URL="https://zipsea-backend.onrender.com"

# Test endpoints that work without full database
echo "1. Testing Admin Health (shows Redis status)..."
curl -s "$STAGING_URL/api/v1/admin/health" | jq '.data | {status, uptime, timestamp}'
echo ""

echo "2. Testing Basic Cruise List (should use caching)..."
response=$(curl -s -w "\nHTTP_CODE:%{http_code}\nTIME:%{time_total}" "$STAGING_URL/api/v1/cruises?limit=5")
http_code=$(echo "$response" | grep "HTTP_CODE" | cut -d: -f2)
time=$(echo "$response" | grep "TIME" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTP_CODE/d' | sed '/TIME/d')

echo "   HTTP Status: $http_code"
echo "   Response Time: ${time}s"
if [ "$http_code" = "200" ]; then
  echo "$body" | jq '.data | length' 2>/dev/null && echo "   cruises returned"
else
  echo "$body" | jq '.error' 2>/dev/null || echo "$body"
fi
echo ""

echo "3. Making same request again (should be cached)..."
response=$(curl -s -w "\nHTTP_CODE:%{http_code}\nTIME:%{time_total}" "$STAGING_URL/api/v1/cruises?limit=5")
http_code=$(echo "$response" | grep "HTTP_CODE" | cut -d: -f2)
time=$(echo "$response" | grep "TIME" | cut -d: -f2)

echo "   HTTP Status: $http_code"
echo "   Response Time: ${time}s (should be faster if cached)"
echo ""

echo "4. Testing Webhook Health..."
curl -s "$STAGING_URL/api/webhooks/traveltek/health" | jq
echo ""

echo "========================================="
echo "Redis Indicators:"
echo "========================================="
echo ""
echo "✅ Redis is working if:"
echo "- Admin health shows 'healthy' status"
echo "- Second request is faster than first"
echo "- No connection errors in responses"
echo ""
echo "Check Render logs for:"
echo "- 'Redis client connected' messages"
echo "- 'Cache hit' or 'Cache miss' logs"
echo "- No Redis connection errors"
echo ""