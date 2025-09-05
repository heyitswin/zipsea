#!/bin/bash

# Run Complete Enhanced Sync on Render
# This script runs the enhanced sync that captures ALL Traveltek data
# Date: 2025-01-14

echo "🚀 Complete Enhanced Traveltek Sync"
echo "===================================="
echo ""
echo "This sync will:"
echo "• Download ALL cruise data from Traveltek FTP"
echo "• Store complete JSON in raw_data columns (zero data loss)"
echo "• Extract structured fields for fast queries"
echo "• Process all nested objects (itinerary, cabins, pricing)"
echo "• Handle all edge cases (NaN, null values, etc.)"
echo ""

# Check if we're in the backend directory
if [ ! -f "package.json" ]; then
  echo "❌ Error: Must run from backend directory"
  exit 1
fi

# Check for required environment variables on Render
if [ -z "$TRAVELTEK_FTP_USER" ] || [ -z "$TRAVELTEK_FTP_PASSWORD" ]; then
  echo "⚠️  FTP credentials not found in environment"
  echo "   These should be set in Render dashboard"
  echo ""
fi

# Configuration
export START_YEAR=2025
export START_MONTH=9
export END_YEAR=2028
export END_MONTH=12
export BATCH_SIZE=100
export MAX_CONNECTIONS=5

echo "Configuration:"
echo "• Start: ${START_YEAR}/${START_MONTH}"
echo "• End: ${END_YEAR}/${END_MONTH}"
echo "• Batch Size: ${BATCH_SIZE} files"
echo "• FTP Connections: ${MAX_CONNECTIONS}"
echo ""

# Check if schema needs creation
echo "🔍 Checking database schema..."
node scripts/verify-enhanced-schema.js
SCHEMA_STATUS=$?

if [ $SCHEMA_STATUS -ne 0 ]; then
  echo "📋 Creating enhanced schema..."
  node scripts/schema-complete-enhanced.js

  if [ $? -ne 0 ]; then
    echo "❌ Failed to create schema"
    exit 1
  fi

  echo "✅ Schema created successfully"
  echo ""
fi

# Run the enhanced sync
echo "🔄 Starting enhanced sync..."
echo "==============================="
echo ""

# Run with timeout for production safety (6 hours max)
timeout 21600 node scripts/sync-complete-enhanced.js

SYNC_STATUS=$?

if [ $SYNC_STATUS -eq 124 ]; then
  echo ""
  echo "⏱️ Sync timed out after 6 hours (this is normal for initial sync)"
  echo "   The sync will resume from checkpoint on next run"
elif [ $SYNC_STATUS -ne 0 ]; then
  echo ""
  echo "❌ Sync failed with error code: $SYNC_STATUS"
  exit $SYNC_STATUS
fi

echo ""
echo "✅ Enhanced sync completed!"
echo ""
echo "📊 To verify results:"
echo "   node scripts/check-database-data.js"
echo ""
echo "🔍 To check specific cruise:"
echo "   node scripts/verify-data-completeness.js"
