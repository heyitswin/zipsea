#!/bin/bash

# TRAVELTEK CLEAN SYNC RUNNER
# Usage: ./scripts/run-clean-sync.sh [YEAR] [MONTH] [test]
# Example: ./scripts/run-clean-sync.sh 2025 09 test

set -e

YEAR=${1:-$(date +%Y)}
MONTH=${2:-$(date +%m)}
TEST_MODE=${3:-""}

# Ensure month is 2 digits
MONTH=$(printf "%02d" $MONTH)

echo "🚀 RUNNING TRAVELTEK CLEAN SYNC"
echo "==============================="
echo "Year: $YEAR"
echo "Month: $MONTH"
echo "Test Mode: ${TEST_MODE:+"YES"}"
echo ""

# Check if we're in test mode
if [ "$TEST_MODE" = "test" ]; then
    echo "⚠️  RUNNING IN TEST MODE - No data will be written to database"
    echo ""
    export TEST_MODE=true
else
    echo "🔥 RUNNING IN PRODUCTION MODE - Data will be written to database"
    echo ""
    export TEST_MODE=false
fi

# Set environment variables
export SYNC_YEAR=$YEAR
export SYNC_MONTH=$MONTH

# Run the sync
echo "Starting sync process..."
echo ""

node scripts/sync-traveltek-clean.js

echo ""
echo "✅ Sync process completed!"