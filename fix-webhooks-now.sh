#!/bin/bash

echo "🚀 Fixing Webhook Processing Issues"
echo "===================================="
echo ""

# Navigate to backend directory
cd backend

# 1. Run the fix script to clear stuck jobs
echo "1️⃣ Clearing stuck jobs and resetting webhooks..."
node scripts/fix-webhook-hang.js

echo ""
echo "2️⃣ Checking current webhook health..."
node scripts/monitor-webhook-health.js

echo ""
echo "3️⃣ Restarting the backend service..."
# Trigger a deployment to restart the service
curl -X POST https://api.render.com/v1/services/srv-d2idrj3ipnbc73abnee0/deploys \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"clearCache": "do_not_clear"}'

echo ""
echo "✅ Fix process initiated!"
echo ""
echo "📝 Next Steps:"
echo "  1. Monitor the Render dashboard for the service restart"
echo "  2. Check Slack for webhook completion notifications"
echo "  3. Run './backend/scripts/monitor-webhook-health.js --watch' to continuously monitor"
echo ""
echo "🔧 To prevent future issues:"
echo "  1. Apply the timeout patch to webhook-processor-optimized-v2.service.ts"
echo "  2. Import and initialize the memory manager in your main app"
echo "  3. Set up a cron job to run the health monitor every 5 minutes"
