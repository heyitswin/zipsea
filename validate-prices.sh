#!/bin/bash

# Price Validation Test Script
# Compares database prices with FTP file prices for recently updated cruises

echo "===================="
echo "PRICE VALIDATION TEST"
echo "===================="
echo ""

# Set default values
DEFAULT_SAMPLE_SIZE=50
DEFAULT_HOURS_BACK=24

# Parse command line arguments
SAMPLE_SIZE=${1:-$DEFAULT_SAMPLE_SIZE}
HOURS_BACK=${2:-$DEFAULT_HOURS_BACK}

# Display configuration
echo "Configuration:"
echo "  Sample Size: $SAMPLE_SIZE cruises"
echo "  Time Range: Last $HOURS_BACK hours"
echo ""

# Detect environment
if [[ -n "$DATABASE_URL_PRODUCTION" ]]; then
    echo "Using PRODUCTION database"
    DATABASE_URL=$DATABASE_URL_PRODUCTION
elif [[ -n "$DATABASE_URL" ]]; then
    echo "Using configured DATABASE_URL"
else
    echo "Using STAGING database"
fi
echo ""

# Run the validation script
cd backend
SAMPLE_SIZE=$SAMPLE_SIZE HOURS_BACK=$HOURS_BACK node scripts/validate-cruise-prices-vs-ftp.js

echo ""
echo "===================="
echo "TEST COMPLETE"
echo "===================="
