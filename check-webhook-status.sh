#!/bin/bash

# Quick check of webhook processing status

echo "🔍 WEBHOOK STATUS CHECK"
echo "======================="
echo ""

# Check webhook health
echo "1️⃣ Webhook Health:"
curl -s https://zipsea-production.onrender.com/api/webhooks/traveltek/health | jq '.status' 2>/dev/null || echo "Failed"
echo ""

# Check FTP connection
echo "2️⃣ FTP Connection:"
curl -s https://zipsea-production.onrender.com/api/webhooks/traveltek/diagnostics | jq '.diagnostics.ftpConnection' 2>/dev/null || echo "Failed"
echo ""

# Check Redis status
echo "3️⃣ Redis Status:"
curl -s https://zipsea-production.onrender.com/api/webhooks/traveltek/diagnostics | jq '.diagnostics.redisStatus' 2>/dev/null || echo "Failed"
echo ""

# Check active locks
echo "4️⃣ Active Locks:"
curl -s https://zipsea-production.onrender.com/api/webhooks/traveltek/diagnostics | jq '.diagnostics.activeLocks' 2>/dev/null || echo "Failed"
echo ""

# Check recent processing
echo "5️⃣ Recent Processing:"
curl -s https://zipsea-production.onrender.com/api/webhooks/traveltek/diagnostics | jq '.diagnostics.recentProcessing' 2>/dev/null || echo "None"
echo ""

echo "======================="
echo "✅ Status check complete"
echo ""
echo "To test a webhook, run:"
echo "./test-and-monitor-webhook.sh 21  # Test with Crystal Cruises (5 cruises)"
echo "./test-and-monitor-webhook.sh 16  # Test with MSC Cruises (6000 cruises)"
