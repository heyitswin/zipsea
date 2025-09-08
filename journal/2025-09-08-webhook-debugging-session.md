# Webhook Debugging Session - September 8, 2025

## Session Overview
Comprehensive debugging and fixing of Traveltek webhook processing issues on staging environment.

## Initial Problem
- Webhook test script returning 404 errors
- No cruise updates being processed despite webhook triggers
- Unclear why webhooks weren't working

## Issues Found and Fixed

### 1. Missing Test Endpoint (FIXED ✅)
**Problem**: `/api/webhooks/traveltek/test` endpoint was returning 404
**Solution**: Added the test endpoint to `webhook.routes.ts`
**Commits**: 
- `e554f2b` - Add /traveltek/test endpoint for webhook testing
**Result**: Test webhooks now trigger successfully

### 2. FTP Configuration Status (VERIFIED ✅)
**Problem**: Couldn't verify if FTP credentials were configured on Render
**Solution**: Added `/api/webhooks/traveltek/ftp-status` diagnostic endpoint
**Findings**: 
- FTP properly configured on staging
- Host: ftpeu1prod.traveltek.net
- User: CEP*** (credentials stored in Render)
- Connection: successful
**Commits**:
- `6f9fe7d` - Add FTP status diagnostic endpoint

### 3. Stuck Webhook Locks (FIXED ✅)
**Problem**: Redis locks were getting stuck, blocking all webhook processing
**Solution**: 
- Added `/api/webhooks/traveltek/diagnostics` endpoint for monitoring
- Added `/api/webhooks/traveltek/clear-locks` endpoint to clear stuck locks
**Findings**:
- Webhooks acquire locks but don't release them when processing fails
- Found stuck lock for line 3 (Royal Caribbean) from earlier test
**Commits**:
- `a64d8e5` - Add webhook diagnostics endpoint
- `b56fc7a` - Add endpoint to clear stuck webhook locks
**Result**: Can now monitor and clear stuck locks remotely

### 4. Webhook Processing Timeout (IDENTIFIED ⚠️)
**Problem**: Webhooks acquire lock but never complete processing
**Root Cause**: 
- Bulk FTP downloader tries to download up to 500 cruise files (MEGA_BATCH_SIZE)
- For large cruise lines (e.g., Royal Caribbean with 3,102 cruises), this takes too long
- Process appears to timeout during FTP downloads
- Lock remains stuck, preventing future webhooks
**Status**: Issue identified but not yet fixed

## Current Architecture Understanding

### Webhook Processing Flow:
1. Webhook received at `/api/webhooks/traveltek` or `/api/webhooks/traveltek/test`
2. Line ID mapping applied (webhook line ID → database line ID)
3. Redis lock acquired for the cruise line
4. All future cruises for the line fetched from database
5. Bulk FTP downloader attempts to download JSON files (max 500 at once)
6. Files processed and database updated
7. Lock released and Slack notification sent

### Key Services:
- `webhook-enhanced.service.ts` - Main webhook processing logic
- `bulk-ftp-downloader-fixed.service.ts` - Handles FTP file downloads
- `slack-enhanced.service.ts` - Sends notifications
- Redis - Used for distributed locks to prevent concurrent processing

## Database Statistics
Found active cruise lines with significant data:
- Line 16 (MSC Cruises): 5,956 cruises
- Line 62 (Viking): 5,622 cruises  
- Line 22 (Royal Caribbean): 3,102 cruises
- Line 8 (Carnival): 3,093 cruises
- Line 63 (AmaWaterways): 2,017 cruises

## New Diagnostic Endpoints Created

1. **GET /api/webhooks/traveltek/ftp-status**
   - Checks FTP configuration and connection
   - Shows masked credentials and connection status

2. **GET /api/webhooks/traveltek/diagnostics**
   - Shows Redis status and active locks
   - Lists recent webhook processing
   - Checks service health
   - Provides recommendations

3. **POST /api/webhooks/traveltek/clear-locks**
   - Clears stuck webhook locks from Redis
   - Returns list of cleared locks

4. **POST /api/webhooks/traveltek/test**
   - Triggers test webhook for specified line ID
   - Default: line 22 (Royal Caribbean)

## Scripts Created
- `monitor-webhook-processing.js` - Monitors webhook processing in real-time
- `test-ftp-via-api.js` - Tests FTP via API endpoints
- `clear-webhook-locks.js` - Clears stuck locks (local use)

## Recommendations for Full Fix

### Immediate Actions:
1. **Check Render Logs**: Access Render dashboard to see actual timeout errors
2. **Reduce Batch Size**: Change MEGA_BATCH_SIZE from 500 to 50-100 cruises
3. **Add Timeout Recovery**: Implement proper timeout handling in bulk FTP downloader
4. **Auto-clear Stuck Locks**: Add automatic lock expiry (e.g., 10 minutes)

### Long-term Improvements:
1. **Background Processing**: Move FTP downloads to BullMQ job queue
2. **Progressive Processing**: Process cruises in smaller chunks with progress updates
3. **Circuit Breaker**: Implement circuit breaker pattern for FTP failures
4. **Monitoring Dashboard**: Create admin dashboard for webhook monitoring

## Testing Commands

```bash
# Check FTP status
curl https://zipsea-backend.onrender.com/api/webhooks/traveltek/ftp-status

# View diagnostics
curl https://zipsea-backend.onrender.com/api/webhooks/traveltek/diagnostics

# Clear stuck locks
curl -X POST https://zipsea-backend.onrender.com/api/webhooks/traveltek/clear-locks

# Trigger test webhook
curl -X POST https://zipsea-backend.onrender.com/api/webhooks/traveltek/test \
  -H "Content-Type: application/json" \
  -d '{"lineId": 22}'
```

## Next Steps
1. Monitor Render logs during webhook processing to capture specific error
2. Implement smaller batch sizes for FTP downloads
3. Add proper timeout handling and recovery
4. Consider implementing async job queue for webhook processing
5. Test with smaller cruise lines first (e.g., line 14 with only 1 cruise)

## Environment Notes
- All testing done on staging environment
- Production not yet updated with fixes
- FTP credentials stored in Render environment variables
- Redis properly connected on staging

## Session Result
Webhook infrastructure is now properly instrumented with diagnostic tools. Main blocking issue identified as FTP download timeout for large batches. With the new endpoints, the system can be monitored and locks can be cleared when needed, but the core timeout issue still needs to be resolved by reducing batch sizes or implementing async processing.