#!/bin/bash

# Check FTP status and trigger sync on production

echo "🔍 Checking Traveltek FTP Status on Production"
echo "=============================================="
echo ""

# Check system health
echo "1. System Health Check:"
curl -s https://zipsea-production.onrender.com/health/detailed | jq '.services'

echo ""
echo "2. Testing FTP Connection:"
# We need to create a test endpoint or use existing cron job to test

echo ""
echo "3. Triggering Manual Sync:"
curl -X POST https://zipsea-production.onrender.com/api/v1/admin/sync/trigger \
  -H "Content-Type: application/json" \
  -d '{"type": "recent"}' \
  -s | jq '.'

echo ""
echo "4. Checking Cron Job Status:"
curl -s https://zipsea-production.onrender.com/api/v1/admin/cron/status | jq '.data.jobs'

echo ""
echo "=============================================="
echo "✅ Check complete. Monitor Render logs for sync progress."
echo ""
echo "To view logs:"
echo "1. Go to https://dashboard.render.com"
echo "2. Click on zipsea-backend-production"
echo "3. Go to Logs tab"
echo "4. Search for '[FTP]' or '[SYNC]'"