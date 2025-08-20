#!/bin/bash

# Run complete data sync on Render
# This script connects to the production database and runs the complete sync

echo "🚢 Starting Complete Traveltek Data Sync on Production"
echo "======================================================="
echo ""
echo "This will:"
echo "- Connect to Traveltek FTP"
echo "- Download ALL cruise data JSON files"
echo "- Store ALL data fields (itineraries, cabins, pricing matrix, etc.)"
echo "- Update existing entries with new data"
echo "- Take price snapshots for history tracking"
echo ""
echo "Environment variables required:"
echo "- TRAVELTEK_FTP_USER"
echo "- TRAVELTEK_FTP_PASSWORD"
echo "- DATABASE_URL"
echo ""

# Check if we're in the backend directory
if [ ! -f "package.json" ]; then
  echo "❌ Error: Must run from backend directory"
  exit 1
fi

# Set options for the sync
export FORCE_UPDATE=true  # Force update existing entries
export SYNC_YEARS=2025,2026  # Years to sync

echo "Settings:"
echo "- FORCE_UPDATE: true (will update existing entries)"
echo "- SYNC_YEARS: 2025,2026"
echo ""
echo "Starting sync..."
echo ""

# Run the sync
node scripts/sync-complete-data.js

echo ""
echo "✅ Sync script completed!"
echo ""
echo "To verify results, run:"
echo "  node scripts/check-database-data.js"