# Test Pipeline Issues Analysis
**Date**: September 21, 2025
**Test Results**: All 5 tests FAILED

## Summary of Issues Found

The test-master-pipeline.js script has multiple schema and query mismatches with the actual database structure. These need to be fixed before the pipeline can be properly tested.

## Detailed Issues

### 1. ❌ Webhook Test Failure
**Error**: `column we.created_at does not exist`

**Issue**: The test uses wrong column name
- Test uses: `we.created_at`
- Actual column: `received_at`

**Evidence**: From `/src/db/schema/webhook-events.ts`:
```typescript
receivedAt: timestamp('received_at').defaultNow(),
```

### 2. ❌ FTP Test Failure
**Error**: `450 /cruiseline/2025/09: No such file or directory`

**Issue**: Wrong FTP path structure
- Test uses: `/cruiseline/{year}/{month}`
- Actual path: `/{year}/{month}/{lineId}`

**Evidence**: From webhook processor:
```javascript
const linePath = `/${year}/${monthStr}/${lineId}`;
```

### 3. ❌ Database Storage Test Failure
**Error**: `column "interior" does not exist`

**Issue**: Wrong column names in cheapest_pricing query
- Test uses: `interior`, `oceanview`, `balcony`, `suite`
- Actual columns: `interior_price`, `oceanview_price`, `balcony_price`, `suite_price`

**Evidence**: From `/src/db/schema/pricing.ts`:
```typescript
interiorPrice: decimal('interior_price', { precision: 10, scale: 2 }),
oceanviewPrice: decimal('oceanview_price', { precision: 10, scale: 2 }),
```

### 4. ❌ Price Extraction Test Failure  
**Error**: `column cp.interior does not exist`

**Issue**: Same as #3 - wrong column names
- The cheapest_pricing table columns all have `_price` suffix

### 5. ❌ API Serving Test Failure
**Error**: `op ANY/ALL (array) requires array on right side`

**Issue**: Improper PostgreSQL array syntax
- Test uses: `WHERE id = ANY(${sampleIds})`
- Needs proper array formatting or use IN clause

## Root Cause Analysis

The test script appears to be based on an older or incorrect database schema. The actual production schema has evolved but the test script wasn't updated to match:

1. **Schema Evolution**: The database schema has been properly normalized with consistent naming conventions (e.g., `_price` suffixes)
2. **FTP Structure**: The FTP doesn't have a `/cruiseline` prefix directory
3. **Webhook Events**: Uses `received_at` for timestamp tracking, not `created_at`

## Data Pipeline Status

Despite test failures, the actual pipeline components appear to be working:

### ✅ What's Actually Working:
1. **Webhook Processing**: Events are being created and processed (we saw ID 4874 processing)
2. **FTP Sync**: The webhook processor successfully connects and downloads files
3. **Database Storage**: 47,545 active cruises with 85.64% pricing coverage
4. **Price Updates**: 37,184 cruises updated in last 24 hours
5. **API**: Returns cruise data (10 cruises returned in search)

### ⚠️ Concerns:
1. **Test Coverage**: The test suite can't validate the pipeline due to schema mismatches
2. **Riviera Travel Pricing**: The divide-by-1000 fix is in place but needs validation
3. **Webhook Completion**: Some webhooks may not be marking as completed properly

## Recommendations

### Immediate Actions Needed:
1. **DO NOT "fix" the production code** - it's working correctly
2. **Fix the test script** to match actual schema:
   - Update column names to match production
   - Fix FTP path structure
   - Use proper PostgreSQL array syntax
3. **Validate Riviera Travel prices** manually with a few sample cruises

### Schema Reference for Test Fixes:

```sql
-- Webhook Events
received_at (not created_at)

-- Cruises table pricing columns
interior_price
oceanview_price  
balcony_price
suite_price
cheapest_price

-- Cheapest Pricing table
interior_price (not interior)
oceanview_price (not oceanview)
balcony_price (not balcony)
suite_price (not suite)

-- FTP Structure
/{year}/{month}/{lineId}/{shipId}/*.json
```

## Conclusion

The pipeline itself appears functional but the test suite needs updates to match the current production schema. The test failures are false negatives due to schema mismatches, not actual pipeline failures.

**Critical**: Do not modify production code based on these test failures. The production system is working - it's the tests that need fixing.