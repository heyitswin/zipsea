# Webhook System Improvements Plan

## Critical Issues to Address

### 1. Implement Pricing Snapshots
**Current Gap**: Price history service exists but isn't being used
**Solution**: Modify `bulk-ftp-downloader.service.ts` to capture snapshots before updates

```typescript
// In processCruiseUpdates method, before updating pricing:
await priceHistoryService.captureSnapshot(
  cruiseId, 
  'webhook_update',
  batchId
);
```

### 2. Fix Date Range Logic
**Current Gap**: Only fetches 2 years of future data, missing sailings beyond that
**Solution**: Update query to fetch ALL future sailings for the line

```typescript
// In getCruiseInfoForLine method:
.where(
  sql`${cruises.cruiseLineId} = ${lineId}
      AND ${cruises.sailingDate} >= CURRENT_DATE
      AND ${cruises.isActive} = true`
)
// Remove the 2-year limit to get all future sailings
```

### 3. Add Webhook Pause Check
**Current Gap**: Webhooks process during initial syncs causing conflicts
**Solution**: Check system_flags before processing

```typescript
// In webhook.service.ts processWebhookJob method:
const pauseFlag = await db
  .select()
  .from(systemFlags)
  .where(eq(systemFlags.key, 'webhooks_paused'))
  .limit(1);

if (pauseFlag?.[0]?.value === 'true') {
  logger.info('Webhooks paused, skipping processing');
  return { skipped: true, reason: 'webhooks_paused' };
}
```

### 4. Implement Comprehensive Update Logic
**Current Gap**: Only pricing is updated, other data ignored
**Solution**: Update ALL cruise data that may have changed

```typescript
// Add to processCruiseUpdates:
- Update itinerary if changed
- Update cabin details if changed  
- Update sail nights, ports, descriptions
- Track what fields actually changed for logging
```

### 5. Add Concurrent Webhook Management
**Current Gap**: Multiple webhooks can process same line simultaneously
**Solution**: Implement line-level locking

```typescript
// Use Redis for distributed locking:
const lockKey = `webhook:line:${lineId}:lock`;
const lockAcquired = await redis.set(
  lockKey, 
  webhookId,
  'NX', // Only set if not exists
  'EX', 600 // Expire after 10 minutes
);

if (!lockAcquired) {
  // Another webhook is processing this line
  await this.webhookQueue.add(data, { delay: 30000 });
  return { deferred: true };
}
```

### 6. Enhance Flagging System
**Current Gap**: Basic needs_price_update flag doesn't handle priority
**Solution**: Add priority and timestamp tracking

```sql
ALTER TABLE cruises ADD COLUMN webhook_priority INTEGER DEFAULT 0;
ALTER TABLE cruises ADD COLUMN last_webhook_at TIMESTAMP;
ALTER TABLE cruises ADD COLUMN webhook_source VARCHAR(50);
```

### 7. Reuse Cron Job Infrastructure
**Current Gap**: Cron job runs every 5 minutes but could be smarter
**Solution**: Make cron job check for pending webhooks first

```javascript
// In trigger-batch-sync.js:
1. Check if any webhooks are queued
2. If yes, process webhook queue first
3. If no, process needs_price_update flags
4. Track processing state to avoid overlap
```

## Implementation Priority

1. **URGENT**: Add pricing snapshots (data loss prevention)
2. **HIGH**: Fix date range to get all future sailings
3. **HIGH**: Add webhook pause check for sync operations
4. **MEDIUM**: Implement line-level locking for concurrent webhooks
5. **MEDIUM**: Update all cruise data, not just pricing
6. **LOW**: Enhanced flagging system with priority

## Testing Requirements

1. Test webhook processing during active sync (should pause)
2. Test multiple webhooks for same line (should queue)
3. Verify price history is captured before updates
4. Confirm all future sailings are fetched (3+ years)
5. Test comprehensive data updates (not just pricing)

## Monitoring Additions

- Add metric for price snapshot capture rate
- Track webhook queue depth per line
- Monitor concurrent webhook conflicts
- Log what data fields actually changed
- Track sailings beyond 2 years being processed