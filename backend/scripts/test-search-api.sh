#!/bin/bash

# Test Search API with September 2025 data
# Usage: ./test-search-api.sh [staging|production]

ENV=${1:-production}

if [ "$ENV" = "staging" ]; then
  BASE_URL="https://zipsea-backend.onrender.com"
else
  BASE_URL="https://zipsea-production.onrender.com"
fi

echo "🔍 Testing Search API on $ENV"
echo "================================"
echo "Base URL: $BASE_URL"
echo ""

# Function to test and time API calls
test_endpoint() {
  local endpoint=$1
  local description=$2
  
  echo "📊 $description"
  echo "   Endpoint: $endpoint"
  
  # Time the request
  start=$(date +%s%N)
  response=$(curl -s "$BASE_URL$endpoint")
  end=$(date +%s%N)
  
  # Calculate time in milliseconds
  time_ms=$(( ($end - $start) / 1000000 ))
  
  # Parse response
  if [ ! -z "$response" ]; then
    # Check if valid JSON
    if echo "$response" | python3 -m json.tool > /dev/null 2>&1; then
      # Extract key info
      total=$(echo "$response" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('meta', {}).get('total', 0))" 2>/dev/null || echo "0")
      success=$(echo "$response" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('success', False))" 2>/dev/null || echo "false")
      
      echo "   ✅ Success: $success"
      echo "   📈 Results: $total"
      echo "   ⏱️  Time: ${time_ms}ms"
      
      # Show first result if available
      first_cruise=$(echo "$response" | python3 -c "
import sys, json
data = json.load(sys.stdin)
cruises = data.get('data', {}).get('cruises', [])
if cruises:
    c = cruises[0]
    line = c.get('cruiseLine', {}).get('name', 'Unknown')
    ship = c.get('ship', {}).get('name', 'Unknown')
    name = c.get('name', 'Unknown')
    date = c.get('sailingDate', 'Unknown')[:10] if c.get('sailingDate') else 'Unknown'
    print(f'   First result: {line} - {ship}')
    print(f'                 {name}')
    print(f'                 Sailing: {date}')
" 2>/dev/null || echo "")
      
      if [ ! -z "$first_cruise" ]; then
        echo "$first_cruise"
      fi
    else
      echo "   ❌ Invalid JSON response"
      echo "   Response: $(echo $response | head -c 100)..."
    fi
  else
    echo "   ❌ No response"
  fi
  
  echo ""
}

# Test 1: Basic search for Caribbean cruises
test_endpoint "/api/v1/cruises/search?q=Caribbean&limit=5" "Search for 'Caribbean'"

# Test 2: Search with date filter for September 2025
test_endpoint "/api/v1/cruises/search?startDate=2025-09-01&endDate=2025-09-30&limit=5" "September 2025 cruises"

# Test 3: Search by cruise line (if we know one exists)
test_endpoint "/api/v1/cruises/search?q=Royal&limit=5" "Search for 'Royal' (cruise line)"

# Test 4: Search with multiple filters
test_endpoint "/api/v1/cruises/search?startDate=2025-09-01&endDate=2025-09-30&minNights=5&maxNights=10&limit=5" "Sept 2025, 5-10 nights"

# Test 5: General cruise listing (no search)
test_endpoint "/api/v1/cruises?sailing_date_min=2025-09-01&sailing_date_max=2025-09-30&limit=5" "List Sept 2025 cruises"

# Test 6: Search for cruise line names to verify they're not generic
test_endpoint "/api/v1/cruises?limit=10" "Check cruise line/ship names"

echo "================================"
echo "✅ Search API Tests Complete"
echo ""

# Performance summary
echo "📊 Performance Guidelines:"
echo "   🎯 Target: < 1000ms"
echo "   ✅ Good: < 500ms"
echo "   ⚠️  Slow: > 2000ms"
echo ""

# Check if names are correct
echo "🔍 Name Quality Check:"
echo "Look for:"
echo "   ✅ Real cruise line names (Royal Caribbean, Carnival, etc.)"
echo "   ✅ Real ship names (Symphony of the Seas, etc.)"
echo "   ❌ Generic names (CL17, Ship 410, Line 5, etc.)"