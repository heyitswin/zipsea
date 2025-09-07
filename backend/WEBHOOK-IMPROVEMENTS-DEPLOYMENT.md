# Webhook System Improvements - Deployment Guide

## Overview
This deployment guide covers all the webhook system improvements that fix critical issues and add long-term solutions for robust webhook processing.

## Critical Fixes Implemented

### ✅ 1. Pricing Snapshots Before Updates
- **File**: `bulk-ftp-downloader.service.ts`
- **Fix**: Captures price history before ANY pricing update
- **Impact**: Preserves historical pricing data for analysis

### ✅ 2. Flag Clearing Bug Fix
- **File**: `price-sync-batch.service.ts`
- **Fix**: Only clears flags for SPECIFIC cruise IDs that were processed
- **Impact**: Prevents clearing all flags after processing one batch

### ✅ 3. Webhook Pause During Sync
- **File**: `webhook-enhanced.service.ts`
- **Fix**: Checks `system_flags.webhooks_paused` before processing
- **Impact**: Prevents webhook conflicts during large sync operations

### ✅ 4. ALL Future Sailings (No 2-Year Limit)
- **File**: `bulk-ftp-downloader.service.ts`
- **Fix**: Removed `sailing_date <= CURRENT_DATE + INTERVAL '2 years'` restriction
- **Impact**: Processes all future cruises (3+ years out)

### ✅ 5. Cruise Creation for Non-Existent Cruises
- **File**: `webhook-enhanced.service.ts`
- **Fix**: Creates new cruises if they don't exist instead of skipping
- **Impact**: No data loss for new cruises added after initial sync

### ✅ 6. Line-Level Locking for Concurrent Webhooks
- **File**: `webhook-enhanced.service.ts`
- **Fix**: Redis-based distributed locking per cruise line
- **Impact**: Prevents multiple webhooks processing same line simultaneously

### ✅ 7. Comprehensive Data Updates
- **File**: `webhook-enhanced.service.ts`
- **Fix**: Updates ALL cruise fields (itinerary, ports, descriptions), not just pricing
- **Impact**: Complete data synchronization, not partial updates

## Deployment Steps

### Step 1: Run Database Migrations (Production)
```bash
# SSH into Render shell or run locally with production DB
node scripts/add-system-flags-table.js
node scripts/apply-webhook-improvements.js
```

### Step 2: Deploy Enhanced Services
```bash
# Commit and push to main branch
git add .
git commit -m "Deploy webhook system improvements with all critical fixes"
git push origin main

# Render will auto-deploy to staging
```

### Step 3: Update Route Configuration
In your main app routes file, replace the old webhook routes:

```typescript
// OLD
import webhookRoutes from './routes/webhook.routes';

// NEW
import webhookRoutes from './routes/webhook-enhanced.routes';
```

### Step 4: Test on Staging
```bash
# Test webhook pause functionality
curl -X POST https://zipsea-backend.onrender.com/api/webhooks/traveltek/test \
  -H "Content-Type: application/json" \
  -d '{"lineId": 22}'

# Check health status
curl https://zipsea-backend.onrender.com/api/webhooks/traveltek/health

# View processing stats
curl https://zipsea-backend.onrender.com/api/webhooks/traveltek/stats
```

### Step 5: Pause Webhooks Before Large Sync
```sql
-- Before starting a large sync operation
UPDATE system_flags SET value = 'true' WHERE key = 'webhooks_paused';

-- After sync completes
UPDATE system_flags SET value = 'false' WHERE key = 'webhooks_paused';
```

### Step 6: Deploy to Production
```bash
# Merge to production branch
git checkout production
git merge main
git push origin production

# Manual deploy on Render dashboard or auto-deploy if configured
```

## Monitoring & Verification

### Check System Flags
```sql
SELECT * FROM system_flags ORDER BY key;
```

### Monitor Webhook Processing
```sql
-- Recent webhook activity
SELECT * FROM webhook_processing_log 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Success rates by line
SELECT 
  line_id,
  COUNT(*) as total_webhooks,
  COUNT(*) FILTER (WHERE status = 'completed') as successful,
  AVG(processing_time_ms) as avg_time_ms
FROM webhook_processing_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY line_id;
```

### Verify Pricing Snapshots
```sql
-- Check if price history is being captured
SELECT 
  cruise_id,
  COUNT(*) as snapshot_count,
  MAX(created_at) as last_snapshot
FROM price_history
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY cruise_id
ORDER BY last_snapshot DESC
LIMIT 10;
```

### Check Cruise Creation
```sql
-- New cruises created by webhooks
SELECT 
  id, 
  name, 
  sailing_date,
  created_at
FROM cruises
WHERE created_at > NOW() - INTERVAL '1 hour'
  AND webhook_source IS NOT NULL
ORDER BY created_at DESC;
```

## Configuration Options

### System Flags
| Flag | Default | Description |
|------|---------|-------------|
| webhooks_paused | false | Set to true during large syncs |
| batch_sync_paused | false | Pause cron job batch processing |
| webhook_deduplication_window | 300 | Seconds to prevent duplicate processing |
| max_cruises_per_webhook | 500 | Limit cruises per webhook batch |

### Performance Tuning
```javascript
// In webhook-enhanced.service.ts
private lineLockTTL = 600; // 10 minutes lock timeout

// In bulk-ftp-downloader.service.ts
private readonly MAX_CONNECTIONS = 5; // FTP connection pool size
private readonly CHUNK_SIZE = 100; // Files per chunk
```

## Rollback Plan

If issues occur, rollback to previous webhook service:

1. **Quick Rollback** (Route Level):
```typescript
// Revert in routes file
import webhookRoutes from './routes/webhook.routes'; // Back to old routes
```

2. **Pause All Webhooks**:
```sql
UPDATE system_flags SET value = 'true' WHERE key = 'webhooks_paused';
```

3. **Full Rollback**:
```bash
git checkout production
git reset --hard <previous-commit-hash>
git push --force origin production
```

## Success Metrics

After deployment, verify:

1. **✅ Pricing Snapshots**: 100% of updates have price history
2. **✅ Flag Clearing**: Only processed cruise flags cleared
3. **✅ Webhook Pausing**: Works during sync operations
4. **✅ Future Sailings**: Processing cruises 3+ years out
5. **✅ Cruise Creation**: New cruises created from webhooks
6. **✅ No Concurrent Conflicts**: Line-level locking working
7. **✅ Complete Updates**: All cruise fields updated

## Troubleshooting

### Webhooks Not Processing
```bash
# Check if paused
psql $DATABASE_URL -c "SELECT * FROM system_flags WHERE key = 'webhooks_paused';"

# Check Redis locks
redis-cli KEYS "webhook:line:*:lock"
```

### Missing Price History
```sql
-- Verify price history service is working
SELECT COUNT(*) FROM price_history 
WHERE created_at > NOW() - INTERVAL '10 minutes';
```

### Cruise Creation Failures
```sql
-- Check webhook processing log for errors
SELECT webhook_id, error_message 
FROM webhook_processing_log 
WHERE status = 'failed' 
  AND error_message LIKE '%create%'
ORDER BY created_at DESC;
```

## Contact for Issues

If any issues arise during deployment:
1. Check webhook_processing_log table for errors
2. Review Render logs for stack traces
3. Verify all system_flags are correctly set
4. Ensure Redis is accessible for locking

---

**Important**: Always test on staging first. The enhanced webhook system is designed for long-term reliability with no compromises on data integrity or performance.