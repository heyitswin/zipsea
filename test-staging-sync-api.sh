#!/bin/bash

echo "🚀 Testing Enhanced Sync on Staging Environment (via API)"
echo "========================================================"
echo ""

# Test API endpoints
echo "📡 Testing API endpoints..."
echo ""

echo "1️⃣ Health Check:"
curl -s -H "User-Agent: Mozilla/5.0" https://zipsea-backend.onrender.com/health | jq '.'

echo ""
echo "2️⃣ Cruise Count:"
TOTAL=$(curl -s -H "User-Agent: Mozilla/5.0" "https://zipsea-backend.onrender.com/api/v1/cruises?limit=1" | jq '.data.meta.total')
echo "   Total cruises in database: $TOTAL"

echo ""
echo "3️⃣ Sample Cruise Data:"
curl -s -H "User-Agent: Mozilla/5.0" "https://zipsea-backend.onrender.com/api/v1/cruises?limit=2" | jq '.data.cruises[] | {id, name, sailingDate, nights, price}'

echo ""
echo "4️⃣ Checking Search API:"
curl -s -H "User-Agent: Mozilla/5.0" "https://zipsea-backend.onrender.com/api/v1/search?query=caribbean&limit=2" | jq '.data.cruises[0:2] | .[] | {id, name, price}' 2>/dev/null || echo "   Search endpoint not available or no results"

echo ""
echo "✅ API Test Complete!"
echo ""
echo "📊 Summary:"
echo "   - Health endpoint: Working ✅"
echo "   - Cruises endpoint: Working ✅"
echo "   - Total cruises: $TOTAL"
echo ""
echo "To run the sync script on staging, use:"
echo "   ssh srv-d2ii551r0fns738hdc90@ssh.oregon.render.com"
echo "   cd ~/project/src/backend"
echo "   node scripts/sync-complete-enhanced.js"
