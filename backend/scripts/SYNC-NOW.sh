#!/bin/bash

# Quick command to run the working sync
echo "🚢 Running Complete Data Sync"
echo "============================="
echo ""

# Use the original sync-complete-data.js which worked before
FORCE_UPDATE=true SYNC_YEARS=2025 node scripts/sync-complete-data.js