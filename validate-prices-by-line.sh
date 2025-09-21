#!/bin/bash

# Price Validation Test Script - By Cruise Line
# Tests last 100 cruises for each cruise line

echo "========================================"
echo "CRUISE PRICE VALIDATION BY CRUISE LINE"
echo "========================================"
echo ""

# Set default values
DEFAULT_CRUISES_PER_LINE=100
CRUISES_PER_LINE=${1:-$DEFAULT_CRUISES_PER_LINE}

# Optional: specify a single cruise line ID
CRUISE_LINE_ID=$2

# Display configuration
echo "Configuration:"
echo "  Cruises per line: $CRUISES_PER_LINE"
if [[ -n "$CRUISE_LINE_ID" ]]; then
    echo "  Testing specific cruise line ID: $CRUISE_LINE_ID"
else
    echo "  Testing all cruise lines"
fi
echo ""

# Force production database
if [[ -n "$DATABASE_URL_PRODUCTION" ]]; then
    echo "✅ Using PRODUCTION database"
    export DATABASE_URL=$DATABASE_URL_PRODUCTION
else
    echo "⚠️  DATABASE_URL_PRODUCTION not set, using default DATABASE_URL"
fi
echo ""

# Run the validation script
cd backend
CRUISES_PER_LINE=$CRUISES_PER_LINE CRUISE_LINE_ID=$CRUISE_LINE_ID node scripts/validate-prices-by-cruise-line.js

echo ""
echo "========================================"
echo "TEST COMPLETE"
echo "========================================"
