#!/bin/bash

# Test the complete batch sync flow

echo "🧪 Testing Batch Sync Flow"
echo "=========================="
echo ""

# Step 1: Check current pending syncs
echo "Step 1: Checking current pending syncs..."
curl -s -X GET "https://zipsea-production.onrender.com/api/admin/pending-syncs" | jq '.summary'
echo ""

# Step 2: Trigger the batch sync manually
echo "Step 2: Triggering batch sync..."
RESPONSE=$(curl -s -X POST "https://zipsea-production.onrender.com/api/admin/trigger-batch-sync")
echo "$RESPONSE" | jq '.'
echo ""

# Step 3: Wait a bit and check pending syncs again
echo "Step 3: Waiting 10 seconds for processing..."
sleep 10

echo "Checking pending syncs after trigger..."
curl -s -X GET "https://zipsea-production.onrender.com/api/admin/pending-syncs" | jq '.summary'
echo ""

echo "✅ Test complete!"
echo ""
echo "Note: Since there are no pending updates marked, the sync will complete quickly."
echo "In production, webhooks from Traveltek will mark cruises as needing updates."
echo ""
echo "To monitor the live Render cron job (runs every 5 minutes):"
echo "1. Go to: https://dashboard.render.com"
echo "2. Check the backend service logs"
echo "3. Look for messages starting with '🔄 Starting scheduled price sync...'"