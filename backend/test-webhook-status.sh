#!/bin/bash

# Test webhook processing status on production
# This script makes API calls to check the system status

echo "=== WEBHOOK PROCESSING STATUS CHECK ==="
echo "Time: $(date)"
echo ""

# Check if API is responding
echo "1. Checking API Health..."
curl -s -X GET "https://zipsea-production.onrender.com/api/health" \
  -H "User-Agent: Mozilla/5.0" \
  -H "Accept: application/json" | jq '.' || echo "API might be down or blocked"

echo ""
echo "2. Testing webhook endpoint directly..."
# Try to get webhook status (if endpoint exists)
curl -s -X GET "https://zipsea-production.onrender.com/api/v1/admin/webhook-status" \
  -H "User-Agent: Mozilla/5.0" \
  -H "Accept: application/json" | jq '.' || echo "No webhook status endpoint"

echo ""
echo "3. Checking recent cruise updates via search API..."
# Search for cruises to see if they have recent pricing
curl -s "https://zipsea-production.onrender.com/api/v1/search?query=caribbean&limit=5" \
  -H "User-Agent: Mozilla/5.0" \
  -H "Accept: application/json" | jq '.cruises[] | {id: .id, name: .cruiseName, line: .cruiseLineName, updated: .pricingUpdatedAt}' 2>/dev/null || echo "Search API not responding"

echo ""
echo "4. Checking Line 3 (Celebrity) cruises..."
curl -s "https://zipsea-production.onrender.com/api/v1/search?query=celebrity&limit=5" \
  -H "User-Agent: Mozilla/5.0" \
  -H "Accept: application/json" | jq '.cruises[] | {id: .id, name: .cruiseName, updated: .pricingUpdatedAt}' 2>/dev/null || echo "No Celebrity cruises found"

echo ""
echo "=== END STATUS CHECK ==="