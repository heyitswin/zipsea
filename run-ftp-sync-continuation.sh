#!/bin/bash

# Complete Enhanced Schema & Sync Script
# This script recreates the database with complete Traveltek structure preservation
# and syncs ALL data with zero data loss

echo "🚀 ZipSea Complete Enhanced Schema & Sync"
echo "========================================="
echo ""
echo "🎯 Enhanced Features:"
echo "   • Complete JSON preservation (zero data loss)"
echo "   • All Traveltek fields mapped to structured columns"
echo "   • Ship specifications with images and dimensions"
echo "   • Complete pricing data (static, cached, combined)"
echo "   • Full daily itineraries with port coordinates"
echo "   • Cabin categories with deck locations"
echo "   • Connection pooling and smart batching"
echo ""
echo "⚠️  This will recreate the database schema!"
echo ""

# Navigate to backend directory
cd backend || {
    echo "❌ Error: Could not find backend directory"
    exit 1
}

# Check if the enhanced scripts exist
if [ ! -f "scripts/run-complete-enhanced-sync.sh" ]; then
    echo "❌ Error: Enhanced sync script not found"
    echo "💡 Expected: scripts/run-complete-enhanced-sync.sh"
    exit 1
fi

# Check environment variables
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL not set"
    exit 1
fi

if [ -z "$TRAVELTEK_FTP_USER" ] || [ -z "$TRAVELTEK_FTP_PASSWORD" ]; then
    echo "❌ Error: Traveltek FTP credentials not set"
    exit 1
fi

echo "✅ Environment check passed"
echo "🚀 Running complete enhanced sync..."
echo ""

# Run the complete enhanced sync script
chmod +x scripts/run-complete-enhanced-sync.sh
./scripts/run-complete-enhanced-sync.sh

# Check exit code
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "🎉 COMPLETE ENHANCED SYNC SUCCESSFUL!"
    echo "====================================="
    echo ""
    echo "📊 Next Steps:"
    echo "   1. Verify data: node scripts/verify-enhanced-schema.js"
    echo "   2. Test API: curl \$API_URL/v1/cruises?limit=1"
    echo "   3. Check ship data: curl \$API_URL/v1/cruises/:id"
    echo ""
else
    echo ""
    echo "❌ Enhanced sync failed (exit code: $EXIT_CODE)"
    echo "💡 The sync has resume capability - you can run this again"
fi

echo ""
echo "🏁 Script execution finished"
echo ""
