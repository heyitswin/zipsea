#!/bin/bash

# Test script to verify adults=2 fix is working on production backend
# This directly calls the production API to test session creation and cabin pricing

BACKEND_URL="https://zipsea-production.onrender.com"
CRUISE_ID="2106593"

echo "🧪 Testing Adults=2 Fix on Production Backend"
echo "================================================"
echo ""

echo "📋 Test 1: Create session with 2 adults"
echo "--------------------------------------"
SESSION_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/booking/session" \
  -H "Content-Type: application/json" \
  -d '{
    "cruiseId": "'$CRUISE_ID'",
    "passengerCount": {
      "adults": 2,
      "children": 0,
      "childAges": []
    }
  }')

echo "Response: $SESSION_RESPONSE"
SESSION_ID=$(echo $SESSION_RESPONSE | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)

if [ -z "$SESSION_ID" ]; then
  echo "❌ Failed to create session"
  exit 1
fi

echo "✅ Session created: $SESSION_ID"
echo ""

echo "📋 Test 2: Get cabin pricing with adults=2"
echo "--------------------------------------"
PRICING_RESPONSE=$(curl -s "$BACKEND_URL/api/booking/$SESSION_ID/pricing")

echo "Response (first 500 chars):"
echo "$PRICING_RESPONSE" | head -c 500
echo ""
echo ""

# Check if we got cabin grades
CABIN_COUNT=$(echo "$PRICING_RESPONSE" | grep -o '"interior":\[' | wc -l)
echo "Cabin categories found: $CABIN_COUNT"

if [ "$CABIN_COUNT" -gt 0 ]; then
  echo "✅ SUCCESS: Cabins returned for adults=2"
else
  echo "❌ FAILED: No cabins returned for adults=2"
fi

echo ""
echo "================================================"
echo "Test completed at $(date)"
