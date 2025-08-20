#!/bin/bash

# Run the simplified UPSERT sync script on Render
# This script properly handles UPSERTs without SQL syntax errors

echo "🚢 Running Simplified UPSERT Sync on Render"
echo "==========================================="
echo ""
echo "This script will:"
echo "- Connect to Traveltek FTP"
echo "- Download cruise data JSON files"
echo "- UPDATE existing entries (not skip them)"
echo "- Store ALL data including itineraries, cabins, pricing"
echo "- Take price snapshots before updates"
echo ""

# Set environment variables
export FORCE_UPDATE=true
export SYNC_YEARS=2025

echo "Configuration:"
echo "- FORCE_UPDATE: true"
echo "- SYNC_YEARS: 2025"
echo ""

# Run the sync
node scripts/sync-simple-upsert.js

echo ""
echo "✅ Sync completed!"
echo ""
echo "To verify results:"
echo "  node scripts/check-database-data.js"