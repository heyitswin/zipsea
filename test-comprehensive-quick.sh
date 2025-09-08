#!/bin/bash

# Quick test for comprehensive webhook processor
API_URL="https://zipsea-backend.onrender.com"

echo "🚀 Testing Comprehensive Webhook Processor"
echo "==========================================="
echo ""

# Test with a small cruise line first (Line 41 - American Cruise Lines, 1 cruise)
echo "Testing with Line 41 (American Cruise Lines - 1 cruise)..."
curl -X POST "$API_URL/api/webhooks/traveltek/test-comprehensive" \
  -H "Content-Type: application/json" \
  -d '{"lineId": 41}' \
  -m 10

echo ""
echo ""

# Check status
echo "Checking webhook diagnostics..."
curl -s "$API_URL/api/webhooks/traveltek/diagnostics" | jq '.diagnostics.recentProcessing' 2>/dev/null || echo "Could not fetch diagnostics"

echo ""
echo "==========================================="
echo "✅ Test initiated. Monitor logs for results."
echo "Check: https://dashboard.render.com/web/srv-cqcph4lds78s739sl9og/logs"
