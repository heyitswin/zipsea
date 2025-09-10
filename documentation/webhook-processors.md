# Webhook Processor Documentation

## Current Status (as of 2025-09-10)

### Active Processor
**Production uses: `WebhookProcessorOptimizedV2`** (webhook-processor-optimized-v2.service.ts)
- Shows `[OPTIMIZED-V2]` and `[WORKER-V2]` in logs
- Processes files via BullMQ queue system
- Supports concurrent webhook processing

### All Webhook Processors (12 total)
1. webhook-processor-correct-ftp.service.ts - UNUSED
2. webhook-processor-correct.service.ts - UNUSED
3. webhook-processor-discovery.service.ts - UNUSED
4. webhook-processor-fast.service.ts - UNUSED
5. webhook-processor-fixed.service.ts - UNUSED
6. webhook-processor-minimal.service.ts - UNUSED
7. **webhook-processor-optimized-v2.service.ts** - ACTIVE IN PRODUCTION (FIXED)
8. webhook-processor-optimized.service.ts - UNUSED (main branch version)
9. webhook-processor-production.service.ts - UNUSED (was briefly active)
10. webhook-processor-robust.service.ts - UNUSED
11. webhook-processor-simple-ftp.service.ts - UNUSED
12. webhook-processor-simple.service.ts - UNUSED

## Environment Variables

### Webhook Processing Optimization
- **`WEBHOOK_MAX_MONTHS_AHEAD`** (default: 6)
  - Limits FTP scanning to X months from current date
  - Reduces processing time by skipping far-future data
  - Example: `WEBHOOK_MAX_MONTHS_AHEAD=3` scans only 3 months ahead
  
- **`WEBHOOK_FORCE_FULL_SYNC`** (default: false)
  - Set to `true` to scan all available data (2025-2027)
  - Useful for initial sync or data recovery
  - Example: `WEBHOOK_FORCE_FULL_SYNC=true`

## Fixed Issues (2025-09-10)

### 1. ✅ Month Scanning - FIXED
- **Previous**: Scanned only 2-3 months
- **Now**: Scans all available months from current month onwards
- **Implementation**: Discovers available years on FTP, scans all months

### 2. ✅ Cruise Data Storage - FIXED
- **Previous**: Only updated cruises table
- **Now**: Updates both `cruises` and `cheapest_pricing` tables
- **Implementation**: Extracts full pricing details including taxes, NCF, gratuities

### 3. ✅ Cruise Creation - FIXED
- **Previous**: Only updated existing cruises
- **Now**: Uses upsert - creates new cruises or updates existing ones
- **Implementation**: `onConflictDoUpdate` with all Traveltek fields

### 4. ✅ Batching & Queuing - FIXED
- **Previous**: No proper queue system
- **Now**: BullMQ integration with Redis
- **Implementation**: 
  - Processes up to 50 files per job
  - 3 concurrent workers
  - Job priority and staggered starts
  - Automatic retries with exponential backoff

### 5. ✅ Pricing Extraction - FIXED
- **Previous**: Missing cheapest pricing data
- **Now**: Properly extracts from Traveltek structure
- **Priority order**:
  1. `cheapest.combined` field (most reliable)
  2. `cheapest.prices` object
  3. Individual `cheapestinside`, `cheapestoutside`, etc.
  4. Fallback to `prices`/`cachedprices` nested structure

### 6. ✅ Performance Optimization - ADDED
- **Date Range Filtering**: Limits scanning to configurable months ahead
- **Progress Logging**: Shows processing rate (files/minute) and batch progress
- **File Distribution**: Logs file counts by year/month for visibility
- **Configurable Sync**: Can limit to 6 months or force full sync as needed

## Database Schema Issues

### price_snapshots table
Actual columns:
- cruise_id (integer) - NOT varchar
- snapshot_type
- static_price
- cached_price  
- cheapest_cabin_price
- metadata (JSONB)
- snapshot_date
- NO line_id column
- NO created_at column

## Recommended Actions

1. **Clean up unused processors** - Delete all 11 unused processor files
2. **Fix the V2 processor** - Address all 5 issues above
3. **Merge to main branch** - Stop having different code in production vs main
4. **Add tests** - Ensure webhook processing works correctly