# Cruise Deduplication Plan

## Problem Summary

**Issue 1: Duplicate Cruise Records**
- Same sailing appearing multiple times with different IDs and prices
- Example: Star Princess 7-day Western Caribbean (March 21, 2026)
  - ID 2129837: $594
  - ID 2260067: $833.54
- Both have identical voyage code "4613", same ship, same dates
- Updated 39 seconds apart

**Root Cause**: 
- Traveltek sends same sailing with multiple `codetocruiseid` values (different price codes)
- Current upsert uses `cruises.id` (VARCHAR) as conflict target
- Each new `codetocruiseid` creates a new record instead of updating existing

**Issue 2: FTP Connection Failures**
- OPTIMIZED-V2 processor has 0 FTP connections
- All connections fail with "530 Login incorrect"
- Processor continues running in degraded mode using cached data only
- Independent issue - requires fixing Traveltek FTP credentials

## Solution (Can Be Done Without FTP Fix)

### Phase 1: Deduplication Script ✅
**File**: `backend/scripts/deduplicate-cruises.js`

**What it does**:
1. Finds all duplicate groups (same line + ship + sailing date + voyage code)
2. Keeps the most recently updated record in each group
3. Migrates foreign key references from duplicates to keeper
4. Deletes duplicate records

**Usage**:
```bash
# Dry run to see what would happen (RECOMMENDED FIRST)
node scripts/deduplicate-cruises.js --dry-run

# Actually run deduplication
node scripts/deduplicate-cruises.js
```

**Safety**:
- Dry run mode shows exactly what will be changed
- Migrates all foreign key references (cheapest_pricing, price_snapshots, itinerary)
- Only deletes after successful migration

### Phase 2: Database Migration ✅
**File**: `backend/src/db/migrations/0007_add_cruise_unique_constraint.sql`

**What it does**:
1. Creates unique index on (cruise_line_id, ship_id, sailing_date, voyage_code)
2. Prevents future duplicates at database level
3. Adds performance indexes for common queries

**IMPORTANT**: Must run deduplication script BEFORE applying this migration, or migration will fail due to existing duplicates.

**Usage**:
```bash
# After running deduplication script successfully
npm run db:migrate
```

### Phase 3: Code Fix ✅
**File**: `backend/src/services/webhook-processor-optimized-v2.service.ts`

**What changed**:
- Before inserting, checks if cruise already exists for this sailing
- If found, uses existing cruise ID instead of creating new one
- Logs when duplicate prevention occurs

**Example log**:
```
[OPTIMIZED-V2] Found existing cruise 2129837 for sailing, updating instead of creating duplicate 2260067
```

## Deployment Steps

### Step 1: Deploy Code to Staging
```bash
git add .
git commit -m "Fix: Prevent duplicate cruise records with composite key checks"
git push origin main
```

### Step 2: Run Deduplication Script (Staging)
```bash
# SSH into staging or use Render shell
node scripts/deduplicate-cruises.js --dry-run   # Review what will happen
node scripts/deduplicate-cruises.js             # Run actual deduplication
```

### Step 3: Apply Migration (Staging)
```bash
npm run db:migrate
```

### Step 4: Verify Staging
- Check that duplicate cruises are gone
- Verify search still works
- Confirm no 500 errors

### Step 5: Repeat for Production
```bash
# Merge main to production branch
git checkout production
git merge main
git push origin production

# Wait for deployment, then run scripts on production:
node scripts/deduplicate-cruises.js --dry-run
node scripts/deduplicate-cruises.js
npm run db:migrate
```

## Expected Results

**Before**:
- ~50-100+ duplicate cruise groups
- Multiple records for same sailing with different prices
- Confusing user experience

**After**:
- Zero duplicates
- Single record per unique sailing
- Price updates modify existing record
- Database constraint prevents future duplicates

## Monitoring

After deployment, check:
1. No duplicate cruises in /cruises search
2. Webhook processor logs show "Found existing cruise" messages
3. Price updates work correctly
4. No foreign key constraint errors

## Rollback Plan

If issues occur:
1. Revert code changes (git revert)
2. Drop unique constraint: `DROP INDEX IF EXISTS idx_cruises_unique_sailing;`
3. Investigate and fix issues
4. Re-apply after fixes

## Notes

- FTP connection issue is SEPARATE and doesn't block this fix
- Deduplication is SAFE - uses dry-run mode first
- Migration will FAIL if duplicates still exist (by design)
- All changes are backwards compatible with existing queries
- No downtime required for this change

## Files Changed

1. ✅ `backend/scripts/deduplicate-cruises.js` - New file
2. ✅ `backend/src/db/migrations/0007_add_cruise_unique_constraint.sql` - New file
3. ✅ `backend/src/services/webhook-processor-optimized-v2.service.ts` - Modified (lines 1398-1424)
