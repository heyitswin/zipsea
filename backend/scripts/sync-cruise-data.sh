#!/bin/bash

# Sync Cruise Data from Production to Staging
#
# This script syncs cruise-related tables from production to staging database.
# Designed to run as a cron job on Render or manually for testing.
#
# Usage:
#   ./scripts/sync-cruise-data.sh
#
# For dry run:
#   DRY_RUN=true ./scripts/sync-cruise-data.sh
#
# Environment variables (set in Render):
#   DATABASE_URL_PRODUCTION - Production database connection string
#   DATABASE_URL_STAGING - Staging database connection string
#   SLACK_WEBHOOK_URL - Optional, for notifications
#   DRY_RUN - Set to 'true' for dry run mode

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Cruise Data Sync: Production → Staging${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if running in Render environment
if [ -n "$RENDER" ]; then
    echo "🔧 Running in Render environment"

    # In Render, these should be set via environment variables
    if [ -z "$DATABASE_URL_PRODUCTION" ]; then
        echo -e "${RED}❌ DATABASE_URL_PRODUCTION is not set${NC}"
        echo "Please add this environment variable in Render dashboard"
        exit 1
    fi

    if [ -z "$DATABASE_URL_STAGING" ]; then
        echo -e "${RED}❌ DATABASE_URL_STAGING is not set${NC}"
        echo "Please add this environment variable in Render dashboard"
        exit 1
    fi
else
    echo "🔧 Running locally"

    # Load .env file if it exists (for local testing)
    if [ -f .env ]; then
        echo "📄 Loading environment from .env file"
        export $(cat .env | grep -v '^#' | xargs)
    fi

    # Check for required environment variables
    if [ -z "$DATABASE_URL_PRODUCTION" ] && [ -z "$DATABASE_URL" ]; then
        echo -e "${RED}❌ DATABASE_URL_PRODUCTION is not set${NC}"
        echo "Set DATABASE_URL_PRODUCTION or DATABASE_URL environment variable"
        exit 1
    fi

    if [ -z "$DATABASE_URL_STAGING" ]; then
        echo -e "${YELLOW}⚠️  DATABASE_URL_STAGING is not set${NC}"
        echo "Using example staging URL for demonstration"
        # You would set this to your actual staging URL
        # export DATABASE_URL_STAGING="postgresql://..."
    fi
fi

# Log configuration (without exposing credentials)
echo "📊 Configuration:"
echo "  - Production DB: ${DATABASE_URL_PRODUCTION:0:30}..."
echo "  - Staging DB: ${DATABASE_URL_STAGING:0:30}..."
echo "  - Dry Run: ${DRY_RUN:-false}"
echo "  - Slack Notifications: $([ -n "$SLACK_WEBHOOK_URL" ] && echo "Enabled" || echo "Disabled")"
echo ""

# Change to backend directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm ci --silent
fi

# Run the sync script
echo "🚀 Starting sync process..."
echo ""

# Run with timeout (30 minutes max) - use gtimeout on macOS if available
if command -v gtimeout &> /dev/null; then
    # macOS with coreutils installed
    gtimeout 1800 node scripts/sync-production-to-staging.js
elif command -v timeout &> /dev/null; then
    # Linux
    timeout 1800 node scripts/sync-production-to-staging.js
else
    # No timeout command available, run without timeout
    echo "⚠️  Running without timeout (timeout command not available)"
    node scripts/sync-production-to-staging.js
fi

SYNC_EXIT_CODE=$?

if [ $SYNC_EXIT_CODE -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Sync completed successfully${NC}"

    # Optional: Run validation queries
    if [ "$RUN_VALIDATION" = "true" ]; then
        echo ""
        echo "🔍 Running post-sync validation..."
        node scripts/validate-staging-data.js 2>/dev/null || true
    fi

    # Optional: Analyze sync results
    if [ "$ANALYZE_RESULTS" = "true" ]; then
        echo ""
        echo "📊 Analyzing sync results..."
        node scripts/analyze-sync-results.js 2>/dev/null || true
    fi

    exit 0
elif [ $SYNC_EXIT_CODE -eq 124 ]; then
    echo ""
    echo -e "${RED}❌ Sync timed out after 30 minutes${NC}"

    # Send alert if Slack webhook is configured
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data '{"text":"⚠️ Cruise data sync timed out after 30 minutes"}' \
            "$SLACK_WEBHOOK_URL" 2>/dev/null || true
    fi

    exit 1
else
    echo ""
    echo -e "${RED}❌ Sync failed with exit code $SYNC_EXIT_CODE${NC}"
    exit $SYNC_EXIT_CODE
fi
