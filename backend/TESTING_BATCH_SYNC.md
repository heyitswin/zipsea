# Testing the Batch Sync Flow

## Overview
The batch sync system downloads ALL cruise price files for cruise lines that have pending updates. This handles the reality that cruise lines update ALL their prices at once (hundreds/thousands of cruises).

## How the Complete Flow Works

1. **Webhook Trigger** (from Traveltek)
   - Traveltek sends a webhook when a cruise line updates prices
   - The webhook handler marks all cruises for that line as `needs_price_update = true`
   - For large updates (>100 cruises), it defers to batch processing

2. **Batch Processing** (every 5 minutes via Render cron)
   - Render calls `/api/admin/trigger-batch-sync` every 5 minutes
   - The endpoint checks for cruise lines with pending updates
   - Downloads ALL files from FTP for those cruise lines
   - Matches files to database records by:
     - First trying `id = codetocruiseid`
     - Then falling back to `cruise_id + sailing_date + cruise_line_id`
   - Updates prices and creates price history records

3. **FTP Structure**
   - Files are organized as: `YYYY/MM/lineId/shipId/codetocruiseid.json`
   - The year/month is when the file was created, NOT the sailing date
   - Each file contains pricing for one specific sailing date

## Testing Steps

### 1. Check System Health
```bash
# Check API health
curl https://zipsea-production.onrender.com/health

# Check pending updates
curl https://zipsea-production.onrender.com/api/admin/pending-syncs | jq
```

### 2. Trigger Manual Sync
```bash
# Trigger the batch sync manually (simulates Render cron)
curl -X POST https://zipsea-production.onrender.com/api/admin/trigger-batch-sync | jq
```

### 3. Monitor in Render Dashboard
1. Go to https://dashboard.render.com
2. Select the backend service
3. Watch the logs for:
   - `🔄 Starting batch price sync V2`
   - `📁 Processing cruise line X...`
   - `✅ Price sync completed`

### 4. Check Results
```bash
# Check if pending updates were cleared
curl https://zipsea-production.onrender.com/api/admin/pending-syncs | jq

# Check a specific cruise's prices (replace with actual cruise ID)
curl https://zipsea-production.onrender.com/api/cruises/search?cruiseLineId=3&limit=5 | jq
```

## Expected Behavior

### When There Are No Pending Updates
```json
{
  "message": "No pending price updates",
  "timestamp": "2025-08-26T18:30:00.000Z",
  "pendingLines": 0
}
```

### When Updates Are Pending
```json
{
  "message": "Batch sync triggered",
  "timestamp": "2025-08-26T18:30:00.000Z",
  "pendingLines": 3
}
```

The sync then runs in the background and you'll see in the logs:
- Files being downloaded from FTP
- Cruises being matched and updated
- Price history records being created
- Slack notifications on completion

## Testing with Real Webhooks

When Traveltek sends a real webhook:
1. It will be received at `/api/webhooks/traveltek`
2. Cruises will be marked with `needs_price_update = true`
3. The next cron run (within 5 minutes) will process them
4. You can monitor via Render logs and Slack notifications

## Troubleshooting

### If No Files Are Found
- Check FTP connectivity
- Verify credentials in environment variables
- Check if files exist for recent months (last 2 months are checked)

### If Files Found but No Updates
- ID mismatch issue (database uses different IDs than FTP)
- The fallback matching by cruise_id + sailing_date should work
- Check if cruises exist in the database

### If Updates Fail
- Check FTP connection pool health
- Verify database connectivity
- Check for parsing errors in cruise JSON files

## Manual Scripts for Testing

Located in `/backend/scripts/`:
- `sync-cruise-line-prices.js` - Manually sync a specific cruise line
- `list-ftp-directory.js` - Browse FTP directories
- `check-cruise-id-mapping.js` - Debug ID mismatches
- `test-batch-sync-flow.sh` - Automated test of the full flow

## Environment Variables Required
```
DATABASE_URL=postgresql://...
TRAVELTEK_FTP_HOST=...
TRAVELTEK_FTP_USER=...
TRAVELTEK_FTP_PASSWORD=...
SLACK_WEBHOOK_URL=... (optional)
```