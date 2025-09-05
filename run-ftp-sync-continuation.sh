#!/bin/bash

# Run FTP sync continuation from 2025/10 onwards
# This script is designed to be run on Render where environment variables are available

echo "🚀 ZipSea FTP Sync Continuation - From 2025/10 onwards"
echo "======================================================"
echo "📅 Starting from: 2025/10"
echo "📅 Ending at: 2028/12"
echo "🔧 Environment: $(echo $NODE_ENV)"
echo "💾 Database: $(echo $DATABASE_URL | cut -c1-20)..."
echo ""

# Navigate to backend directory
cd backend || {
    echo "❌ Error: Could not find backend directory"
    exit 1
}

# Check if the FTP sync script exists
if [ ! -f "scripts/simple-ftp-sync-final-fixed.js" ]; then
    echo "❌ Error: FTP sync script not found"
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
echo "🔄 Starting FTP sync..."
echo ""

# Run the FTP sync script
node scripts/simple-ftp-sync-final-fixed.js

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ FTP sync completed successfully!"
    echo "📊 Check the output above for detailed statistics"
else
    echo ""
    echo "❌ FTP sync failed with errors"
    echo "💡 The sync script has resume capability - you can run this again to continue"
fi

echo ""
echo "🏁 Script execution finished"
