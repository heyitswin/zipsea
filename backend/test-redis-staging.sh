#!/bin/bash

echo "========================================="
echo "Testing Redis on Staging"
echo "========================================="
echo ""

STAGING_URL="https://zipsea-backend.onrender.com"

# Test basic health
echo "1. Testing Basic Health Endpoint..."
echo "   GET $STAGING_URL/health"
response=$(curl -s -w "\n%{http_code}" "$STAGING_URL/health")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')
echo "   HTTP Status: $http_code"
if [ "$http_code" = "200" ]; then
  echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
else
  echo "   Response: $body"
fi
echo ""

# Test API info
echo "2. Testing API Info..."
echo "   GET $STAGING_URL/api/v1"
response=$(curl -s -w "\n%{http_code}" "$STAGING_URL/api/v1")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')
echo "   HTTP Status: $http_code"
if [ "$http_code" = "200" ]; then
  echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
else
  echo "   Response: $body"
fi
echo ""

# Test search to see if Redis caching is working
echo "3. Testing Search Endpoint (uses Redis caching)..."
echo "   GET $STAGING_URL/api/v1/search/popular"
response=$(curl -s -w "\n%{http_code}" "$STAGING_URL/api/v1/search/popular")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')
echo "   HTTP Status: $http_code"
if [ "$http_code" = "200" ]; then
  echo "$body" | python3 -m json.tool | head -20
  echo "   ... (truncated)"
else
  echo "   Response: $body"
fi
echo ""

# Test search filters (cached)
echo "4. Testing Search Filters (cached in Redis)..."
echo "   GET $STAGING_URL/api/v1/search/filters"
response=$(curl -s -w "\n%{http_code}" "$STAGING_URL/api/v1/search/filters")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')
echo "   HTTP Status: $http_code"
if [ "$http_code" = "200" ]; then
  echo "$body" | python3 -m json.tool | head -20
  echo "   ... (truncated)"
else
  echo "   Response: $body"
fi
echo ""

# Test cache performance by making same request twice
echo "5. Testing Cache Performance..."
echo "   Making same request twice to test caching:"

# First request
echo "   First request to /api/v1/search/popular:"
start_time=$(date +%s%N)
curl -s "$STAGING_URL/api/v1/search/popular" > /dev/null
end_time=$(date +%s%N)
elapsed_time=$((($end_time - $start_time) / 1000000))
echo "   Time: ${elapsed_time}ms"

# Second request (should be faster if cached)
echo "   Second request (should be cached):"
start_time=$(date +%s%N)
curl -s "$STAGING_URL/api/v1/search/popular" > /dev/null
end_time=$(date +%s%N)
elapsed_time=$((($end_time - $start_time) / 1000000))
echo "   Time: ${elapsed_time}ms (should be faster if Redis is working)"
echo ""

echo "========================================="
echo "Summary:"
echo "========================================="
echo ""
echo "If Redis is working correctly:"
echo "- Search endpoints should return data"
echo "- Second request should be faster than first"
echo "- No errors should appear in responses"
echo ""
echo "Check Render logs for Redis connection status:"
echo "- 'Redis client connected' message"
echo "- 'Redis client ready' message"
echo "- Cache hit/miss logs"
echo ""