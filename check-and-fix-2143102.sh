#!/bin/bash

echo "=== Checking cruise 2143102 status ==="

# First check if cruise exists in search
echo "1. Searching for cruise 2143102:"
curl -s "https://zipsea-production.onrender.com/api/v1/search/optimized?limit=1000" | jq '.cruises[] | select(.id == "2143102")'

# Check the FTP file
echo -e "\n2. Downloading FTP file for verification:"
YEAR=2025
MONTH=10
DAY=05
SHIP_ID=22  # Symphony of the Seas
CRUISE_ID=2143102

FTP_PATH="/2025/10/05/22/2143102.json"
echo "FTP Path: $FTP_PATH"

# Trigger webhook for Royal Caribbean to update this cruise
echo -e "\n3. Triggering webhook to update Royal Caribbean cruises:"
curl -X POST "https://zipsea-production.onrender.com/api/webhooks/traveltek/test" \
  -H "Content-Type: application/json" \
  -d '{"lineId": 22}'

echo -e "\n=== Update triggered. Please wait a few minutes for processing ==="
