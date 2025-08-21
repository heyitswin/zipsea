#!/bin/bash

echo "========================================="
echo "Testing Production Search & Redis Performance"
echo "========================================="
echo ""

PROD_URL="https://zipsea-production.onrender.com"

# Function to measure response time
measure_time() {
  local endpoint=$1
  local description=$2
  
  echo "Testing: $description"
  echo "Endpoint: $endpoint"
  
  # First request (cold cache)
  start_time=$(date +%s%3N)
  response=$(curl -s -w "\n%{http_code}" "$PROD_URL$endpoint")
  end_time=$(date +%s%3N)
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  time1=$((end_time - start_time))
  
  # Count results
  count=$(echo "$body" | jq '.data.cruises | length' 2>/dev/null || echo "0")
  if [ "$count" = "null" ] || [ "$count" = "" ]; then
    count=$(echo "$body" | jq '.data | if type == "array" then length else 0 end' 2>/dev/null || echo "0")
  fi
  
  # Second request (should be cached)
  start_time=$(date +%s%3N)
  response2=$(curl -s -w "\n%{http_code}" "$PROD_URL$endpoint")
  end_time=$(date +%s%3N)
  
  time2=$((end_time - start_time))
  
  # Third request (definitely cached)
  start_time=$(date +%s%3N)
  response3=$(curl -s -w "\n%{http_code}" "$PROD_URL$endpoint")
  end_time=$(date +%s%3N)
  
  time3=$((end_time - start_time))
  
  echo "  Status: $http_code"
  echo "  Results: $count items"
  echo "  Request 1 (cold): ${time1}ms"
  echo "  Request 2 (warm): ${time2}ms"
  echo "  Request 3 (cached): ${time3}ms"
  
  # Calculate cache improvement
  if [ "$time1" -gt 0 ]; then
    improvement=$(( (time1 - time3) * 100 / time1 ))
    echo "  Cache improvement: ${improvement}%"
  fi
  echo ""
}

# 1. Test health to ensure Redis is connected
echo "1. Checking System Health & Redis Status"
echo "----------------------------------------"
curl -s "$PROD_URL/health/health" | jq '{status, database, redis, cache}'
echo ""

# 2. Get cache metrics
echo "2. Cache Metrics"
echo "----------------------------------------"
curl -s "$PROD_URL/health/cache/metrics" | jq
echo ""

# 3. Test various endpoints
echo "3. Performance Tests"
echo "----------------------------------------"
echo ""

measure_time "/api/v1/cruises?limit=10" "List 10 Cruises"
measure_time "/api/v1/search?limit=20" "Search 20 Cruises"
measure_time "/api/v1/search/popular?limit=10" "Popular Cruises"
measure_time "/api/v1/search/filters" "Search Filters"

# 4. Test search with actual data
echo "4. Testing Search with Caribbean Query"
echo "----------------------------------------"
caribbean_search=$(curl -s "$PROD_URL/api/v1/search?query=caribbean&limit=5")
echo "$caribbean_search" | jq '{
  success,
  count: .data.count,
  cruises: .data.cruises | length,
  first_cruise: .data.cruises[0] | {name, departure_date, ship_name}
}'
echo ""

# 5. Check actual cruise count
echo "5. Database Statistics"
echo "----------------------------------------"
total_cruises=$(curl -s "$PROD_URL/api/v1/cruises?limit=1" | jq '.data.pagination.total' 2>/dev/null)
echo "Total cruises in database: $total_cruises"

# Get a cruise ID for detailed test
cruise_id=$(curl -s "$PROD_URL/api/v1/cruises?limit=1" | jq '.data.cruises[0].id' 2>/dev/null)
if [ "$cruise_id" != "null" ] && [ "$cruise_id" != "" ]; then
  echo "Testing cruise details for ID: $cruise_id"
  measure_time "/api/v1/cruises/$cruise_id" "Cruise Details"
  measure_time "/api/v1/cruises/$cruise_id/pricing" "Cruise Pricing"
fi

echo ""
echo "========================================="
echo "Performance Summary"
echo "========================================="
echo ""
echo "✅ Redis is working if:"
echo "- Cache metrics show hits/misses"
echo "- Second/third requests are faster than first"
echo "- Cache improvement > 50%"
echo ""
echo "⚠️  Issues to check:"
echo "- If all times are similar, Redis might not be caching"
echo "- If no results returned, check database has data"
echo "- Check Render logs for Redis connection status"
echo ""