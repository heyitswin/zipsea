#!/bin/bash

echo "========================================="
echo "Testing Search APIs"
echo "========================================="
echo ""

# Check if we're testing staging or production
if [ "$1" = "production" ]; then
  API_URL="https://zipsea-production.onrender.com"
  ENV="PRODUCTION"
else
  API_URL="https://zipsea-backend.onrender.com"
  ENV="STAGING"
fi

echo "Testing on $ENV: $API_URL"
echo ""

# Function to test an endpoint
test_endpoint() {
  local method=$1
  local endpoint=$2
  local data=$3
  local description=$4
  
  echo "----------------------------------------"
  echo "$description"
  echo "$method $API_URL$endpoint"
  
  if [ "$method" = "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" "$API_URL$endpoint")
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$API_URL$endpoint" \
      -H "Content-Type: application/json" \
      -d "$data")
  fi
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  echo "Status: $http_code"
  
  if [ "$http_code" = "200" ]; then
    echo "$body" | jq -r '.success' 2>/dev/null && echo "✅ Success"
    echo "$body" | jq '.data | if type == "array" then length else . end' 2>/dev/null | head -5
  else
    echo "$body" | jq '.error.message' 2>/dev/null || echo "$body" | head -3
  fi
  echo ""
}

# 1. Test basic search
test_endpoint "GET" "/api/v1/search?limit=5" "" "1. Basic Search (GET)"

# 2. Test search with filters
test_endpoint "POST" "/api/v1/search" '{
  "limit": 5,
  "filters": {
    "minPrice": 500,
    "maxPrice": 2000
  }
}' "2. Search with Price Filter (POST)"

# 3. Test search filters
test_endpoint "GET" "/api/v1/search/filters" "" "3. Get Available Filters"

# 4. Test popular cruises
test_endpoint "GET" "/api/v1/search/popular?limit=5" "" "4. Popular Cruises"

# 5. Test recommendations
test_endpoint "GET" "/api/v1/search/recommendations" "" "5. Cruise Recommendations"

# 6. Test search suggestions
test_endpoint "GET" "/api/v1/search/suggestions?q=caribbean" "" "6. Search Suggestions"

# 7. Test complex search
test_endpoint "POST" "/api/v1/search" '{
  "query": "caribbean",
  "filters": {
    "minPrice": 1000,
    "maxPrice": 3000,
    "duration": [7, 14],
    "departureMonths": ["2025-09", "2025-10"]
  },
  "sort": "price_asc",
  "limit": 10
}' "7. Complex Search with Multiple Filters"

# 8. Test region search
test_endpoint "POST" "/api/v1/search" '{
  "filters": {
    "regions": ["Caribbean", "Mediterranean"]
  },
  "limit": 5
}' "8. Search by Region"

echo "========================================="
echo "Search API Test Summary"
echo "========================================="
echo ""
echo "If all tests return 200 status codes:"
echo "✅ Search APIs are working correctly"
echo ""
echo "If you see 500 errors with 'column does not exist':"
echo "❌ Database schema needs fixing"
echo "Run: DATABASE_URL=your_url node scripts/fix-all-staging-columns.js"
echo ""
echo "Check Redis caching by running tests twice:"
echo "Second run should be faster if caching works"
echo ""