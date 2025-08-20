#!/bin/bash

# Quick Search API Test Script
# Tests basic functionality using curl

BASE_URL="${API_BASE_URL:-http://localhost:3000}"
API_URL="$BASE_URL/api/v1/search"

echo "🚢 Quick Search API Test"
echo "Base URL: $BASE_URL"
echo "========================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to test endpoint
test_endpoint() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    
    echo -n "Testing $name... "
    
    start_time=$(date +%s%3N)
    response=$(curl -s -w "HTTPSTATUS:%{http_code};TIME:%{time_total}" "$url")
    end_time=$(date +%s%3N)
    
    http_status=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d':' -f2)
    time_total=$(echo "$response" | grep -o "TIME:[0-9.]*" | cut -d':' -f2)
    response_time=$((end_time - start_time))
    body=$(echo "$response" | sed -E 's/HTTPSTATUS:[0-9]*;TIME:[0-9.]*$//')
    
    if [ "$http_status" = "$expected_status" ]; then
        if echo "$body" | grep -q '"success":true'; then
            echo -e "${GREEN}PASS${NC} (${response_time}ms)"
            ((TESTS_PASSED++))
        else
            echo -e "${RED}FAIL${NC} - Response success is false"
            ((TESTS_FAILED++))
        fi
    else
        echo -e "${RED}FAIL${NC} - HTTP $http_status (expected $expected_status)"
        ((TESTS_FAILED++))
    fi
}

# Function to test with JSON validation
test_endpoint_with_validation() {
    local name="$1"
    local url="$2"
    local jq_filter="$3"
    
    echo -n "Testing $name... "
    
    start_time=$(date +%s%3N)
    response=$(curl -s -w "HTTPSTATUS:%{http_code}" "$url")
    end_time=$(date +%s%3N)
    
    http_status=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d':' -f2)
    response_time=$((end_time - start_time))
    body=$(echo "$response" | sed -E 's/HTTPSTATUS:[0-9]*$//')
    
    if [ "$http_status" = "200" ]; then
        if echo "$body" | jq -e "$jq_filter" > /dev/null 2>&1; then
            count=$(echo "$body" | jq -r "$jq_filter")
            echo -e "${GREEN}PASS${NC} (${count} results, ${response_time}ms)"
            ((TESTS_PASSED++))
        else
            echo -e "${RED}FAIL${NC} - Invalid JSON structure"
            ((TESTS_FAILED++))
        fi
    else
        echo -e "${RED}FAIL${NC} - HTTP $http_status"
        ((TESTS_FAILED++))
    fi
}

echo "🔍 Basic Functionality Tests"
echo "-----------------------------"

# Basic search
test_endpoint "Basic Search" "$API_URL?limit=5"

# Search with filters
test_endpoint "Price Filter" "$API_URL?minPrice=100&maxPrice=2000&limit=5"
test_endpoint "Duration Filter" "$API_URL?minNights=7&maxNights=14&limit=5"
test_endpoint "Cruise Line Filter" "$API_URL?cruiseLine=1&limit=5"
test_endpoint "General Search" "$API_URL?q=caribbean&limit=5"

echo ""
echo "🔄 Sorting Tests"
echo "----------------"

# Sorting tests
test_endpoint "Sort by Price" "$API_URL?sortBy=price&sortOrder=asc&limit=5"
test_endpoint "Sort by Date" "$API_URL?sortBy=date&sortOrder=asc&limit=5"
test_endpoint "Sort by Duration" "$API_URL?sortBy=nights&sortOrder=desc&limit=5"

echo ""
echo "📄 Pagination Tests"
echo "-------------------"

# Pagination tests
test_endpoint "Page 1" "$API_URL?page=1&limit=10"
test_endpoint "Page 2" "$API_URL?page=2&limit=10"
test_endpoint "Large Limit" "$API_URL?page=1&limit=50"

echo ""
echo "🎯 Advanced Features"
echo "--------------------"

# Advanced features
test_endpoint "Faceted Search" "$API_URL?facets=true&limit=10"
test_endpoint "Search Suggestions" "$API_URL/suggestions?q=royal"
test_endpoint "Search Filters" "$API_URL/filters"
test_endpoint "Popular Cruises" "$API_URL/popular?limit=10"
test_endpoint "Recommendations" "$API_URL/recommendations?limit=5"

echo ""
echo "⚡ Performance Tests"
echo "-------------------"

# Performance test - complex query
echo -n "Complex Search... "
start_time=$(date +%s%3N)
response=$(curl -s -w "HTTPSTATUS:%{http_code}" "$API_URL?q=caribbean&minPrice=500&maxPrice=2000&minNights=7&sortBy=price&facets=true&limit=20")
end_time=$(date +%s%3N)
response_time=$((end_time - start_time))

http_status=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d':' -f2)
if [ "$http_status" = "200" ]; then
    if [ "$response_time" -lt 500 ]; then
        echo -e "${GREEN}PASS${NC} (${response_time}ms)"
        ((TESTS_PASSED++))
    else
        echo -e "${YELLOW}SLOW${NC} (${response_time}ms)"
        ((TESTS_PASSED++))
    fi
else
    echo -e "${RED}FAIL${NC} - HTTP $http_status"
    ((TESTS_FAILED++))
fi

echo ""
echo "🚨 Error Handling Tests"
echo "-----------------------"

# Error handling tests
test_endpoint "Invalid Sort" "$API_URL?sortBy=invalid&limit=5" "200"
test_endpoint "Large Query" "$API_URL/suggestions?q=$(printf 'a%.0s' {1..150})" "400"

echo ""
echo "📊 Test Summary"
echo "==============="
echo -e "✅ Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "❌ Failed: ${RED}$TESTS_FAILED${NC}"

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
if [ $TOTAL_TESTS -gt 0 ]; then
    SUCCESS_RATE=$(echo "scale=1; $TESTS_PASSED * 100 / $TOTAL_TESTS" | bc -l 2>/dev/null || echo "0")
    echo "📈 Success Rate: ${SUCCESS_RATE}%"
fi

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n🎉 ${GREEN}All tests passed!${NC} Search API is working correctly."
    exit 0
else
    echo -e "\n⚠️ ${RED}Some tests failed.${NC} Please check the API implementation."
    exit 1
fi