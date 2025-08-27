# Render Performance Upgrade Recommendations for Zipsea

## Current Situation
- V5 sync is working successfully but database CPU/memory hitting 100% during sync operations
- Processing ~137 cruises takes ~2.5 minutes
- 36,891 pending cruise updates across 51 cruise lines
- At current rate (3 lines every 5 minutes), full sync will take ~4.25 hours

## Bottlenecks Identified

### 1. Database Performance (PRIMARY BOTTLENECK)
- **Issue**: CPU and memory hitting 100% during sync operations
- **Impact**: Slows down INSERT/UPDATE operations, causes connection timeouts
- **Current tier**: Unknown (likely Starter or Standard)

### 2. Backend Service
- **Issue**: Limited concurrent processing capability
- **Impact**: Can only process 3 cruise lines per sync run
- **Current limits**: 3-month data, 500 files per line, 10-second timeout per file

### 3. Cron Job Frequency
- **Current**: Every 5 minutes
- **Could be more frequent with better infrastructure**

## Recommended Upgrades (Priority Order)

### 1. 🚨 DATABASE UPGRADE (Highest Priority)
**Upgrade to**: PostgreSQL Pro or higher tier
- **Why**: Database is the primary bottleneck hitting 100% CPU/memory
- **Benefits**:
  - More CPU cores for parallel query processing
  - Increased memory for better caching
  - Higher connection limits
  - Better I/O performance for bulk inserts/updates
- **Expected improvement**: 3-5x faster sync operations
- **Cost estimate**: $85-225/month depending on tier

### 2. BACKEND SERVICE UPGRADE (Medium Priority)
**Upgrade to**: Standard or Pro instance
- **Why**: More memory for in-memory file processing
- **Benefits**:
  - Process more cruise lines per sync (increase from 3 to 10+)
  - Handle larger file batches
  - Reduce timeout risks
- **Expected improvement**: 2-3x more throughput
- **Cost estimate**: $25-85/month

### 3. ADD REDIS INSTANCE (Optional - Future Enhancement)
**Add**: Redis Starter instance
- **Why**: Queue management for better async processing
- **Benefits**:
  - Decouple webhook receipt from processing
  - Better retry mechanisms
  - Progress tracking
- **Expected improvement**: More reliable processing
- **Cost estimate**: $19/month

## Immediate Actions Without Upgrades

### 1. Optimize V5 Service Parameters
```typescript
// Increase these if database upgraded:
private readonly MAX_LINES_PER_RUN = 5; // From 3
private readonly MAX_FILES_PER_LINE = 1000; // From 500
```

### 2. Increase Cron Frequency
- Change from 5 minutes to 2-3 minutes if database can handle it
- Monitor for overlapping runs

### 3. Add Database Indexes
```sql
-- Add indexes for frequently queried fields
CREATE INDEX idx_cruises_needs_update ON cruises(needs_price_update) WHERE needs_price_update = true;
CREATE INDEX idx_cruises_line_updated ON cruises(cruise_line_id, updated_at);
CREATE INDEX idx_cruises_sailing_date ON cruises(sailing_date);
```

## Performance Monitoring Queries

```sql
-- Check database performance
SELECT 
    pid,
    usename,
    application_name,
    client_addr,
    state,
    query_start,
    state_change,
    wait_event_type,
    wait_event,
    substring(query, 1, 100) as query_preview
FROM pg_stat_activity 
WHERE state != 'idle'
ORDER BY query_start;

-- Check table statistics
SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows,
    last_vacuum,
    last_autovacuum
FROM pg_stat_user_tables
WHERE tablename IN ('cruises', 'cruise_lines', 'ships', 'ports')
ORDER BY n_tup_upd DESC;
```

## Cost-Benefit Analysis

### Minimal Investment ($85/month)
- Upgrade database to Pro tier
- **Result**: 3-5x faster syncs, handle webhooks in near real-time

### Moderate Investment ($110-170/month)
- Upgrade database to Pro tier
- Upgrade backend to Standard
- **Result**: 5-10x faster syncs, process all pending updates in <1 hour

### Full Investment ($200-300/month)
- Upgrade database to Pro Plus
- Upgrade backend to Pro
- Add Redis for queue management
- **Result**: Enterprise-grade performance, instant webhook processing

## Recommendation
Start with database upgrade to Pro tier ($85/month) as it will provide the most immediate impact. Monitor performance and add backend upgrade if needed.