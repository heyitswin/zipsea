# 🚨 CRITICAL PRODUCTION DEPLOYMENT: Cruise Primary Key Fix

## Problem Statement

**IMMEDIATE ACTION REQUIRED** - The current cruise table schema has a critical flaw:
- Primary key `id` stores Traveltek `cruiseid` (NOT unique across sailings)
- `code_to_cruise_id` IS unique per sailing and should be the primary key
- This causes duplicate key violations during sync operations

## Solution Overview

This migration restructures the cruises table to use `code_to_cruise_id` as the primary key while preserving all existing data and relationships.

### Schema Changes
- **Before**: `id` = cruiseid (can be duplicated), `code_to_cruise_id` = unique sailing ID
- **After**: `id` = code_to_cruise_id (unique per sailing), `cruise_id` = original cruiseid (can be duplicated)

---

## 🚨 PRE-DEPLOYMENT CHECKLIST

### 1. Environment Verification
```bash
# Verify you're connected to the correct database
psql $DATABASE_URL -c "SELECT current_database(), current_user, version();"

# Check current table structure
psql $DATABASE_URL -c "\\d cruises"

# Count existing records
psql $DATABASE_URL -c "SELECT COUNT(*) FROM cruises;"
```

### 2. Backup Verification
```bash
# Ensure database backups are current
# This migration creates its own backup table, but verify external backups exist
```

### 3. Application Downtime Planning
- **Estimated downtime**: 5-15 minutes (depending on data size)
- **Recommended time**: Low-traffic hours
- **Services to pause**: Sync operations, webhook processing

---

## 📋 DEPLOYMENT STEPS

### Step 1: Stop Sync Operations
```bash
# Stop any running sync processes
pkill -f "sync.*cruise" || true
pkill -f "node.*sync" || true

# Stop webhook processing (if applicable)
# Ensure no new cruise data is being written during migration
```

### Step 2: Run the Migration
```bash
# Navigate to backend directory
cd /Users/winlin/Desktop/sites/zipsea/backend

# Run migration (this will take 5-15 minutes)
psql $DATABASE_URL -f src/db/migrations/0005_fix_cruise_pk_production.sql
```

**Expected output:**
```
NOTICE: MIGRATION VALIDATION:
NOTICE:   Total cruises: XXXX
NOTICE:   Duplicate code_to_cruise_id: 0
NOTICE:   NULL code_to_cruise_id: 0
NOTICE: Data validation passed. Proceeding with migration...
...
COMMIT
```

### Step 3: Verify Migration Success
```bash
# Run comprehensive verification
psql $DATABASE_URL -f scripts/verify-cruise-pk-migration.sql

# Look for all "PASS" results in the final summary
```

### Step 4: Update Sync Scripts
```bash
# Make the new sync script executable
chmod +x scripts/sync-production-corrected-pk.js

# Test sync with a small batch first
BATCH_SIZE=2 SKIP_ERRORS=true node scripts/sync-production-corrected-pk.js
```

### Step 5: Resume Normal Operations
```bash
# Start regular sync operations with new script
node scripts/sync-production-corrected-pk.js

# Monitor for any errors
tail -f sync.log
```

---

## 🔍 VERIFICATION QUERIES

### Quick Health Check
```sql
-- Verify schema structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'cruises' 
AND column_name IN ('id', 'cruise_id', 'code_to_cruise_id');

-- Verify data integrity
SELECT 
    COUNT(*) as total_records,
    COUNT(DISTINCT id) as unique_ids,
    COUNT(*) = COUNT(DISTINCT id) as all_unique
FROM cruises;

-- Check foreign key integrity
SELECT COUNT(*) as orphaned_itineraries
FROM itineraries i 
LEFT JOIN cruises c ON i.cruise_id = c.id 
WHERE c.id IS NULL;
```

### Business Logic Verification
```sql
-- Verify multiple sailings per cruise work correctly
SELECT 
    cruise_id,
    COUNT(*) as sailing_count,
    array_agg(sailing_date ORDER BY sailing_date) as dates
FROM cruises 
GROUP BY cruise_id 
HAVING COUNT(*) > 1 
LIMIT 5;

-- Test the new utility view
SELECT * FROM cruise_sailings_grouped LIMIT 5;
```

---

## 🚨 ROLLBACK PROCEDURE

**Only use if migration failed or caused critical issues:**

### Emergency Rollback
```bash
# Run rollback script (restores original schema)
psql $DATABASE_URL -f scripts/rollback-cruise-pk-migration.sql
```

### Post-Rollback Actions
```bash
# Restart original sync processes
# Verify original functionality is restored
# Investigate migration failure cause
```

---

## 📊 EXPECTED RESULTS

### Migration Success Indicators
- ✅ All verification checks pass
- ✅ New sync script runs without duplicate key errors
- ✅ Foreign key relationships maintained
- ✅ Multiple sailings per cruise_id work correctly
- ✅ No data loss (record counts match)

### Performance Improvements
- 🚀 Sync operations complete without key violations
- 🚀 Proper indexing on unique identifiers
- 🚀 Ability to handle multiple sailings per cruise

---

## 🔧 TROUBLESHOOTING

### Common Issues

#### 1. Migration Fails with "Duplicate code_to_cruise_id"
```sql
-- Find duplicates
SELECT code_to_cruise_id, COUNT(*) 
FROM cruises 
GROUP BY code_to_cruise_id 
HAVING COUNT(*) > 1;

-- Clean duplicates before re-running migration
```

#### 2. Foreign Key Violations After Migration
```sql
-- Check for orphaned records
SELECT table_name, COUNT(*) 
FROM itineraries i 
LEFT JOIN cruises c ON i.cruise_id = c.id 
WHERE c.id IS NULL;

-- Fix orphaned records
```

#### 3. Sync Script Errors
```bash
# Check new schema compatibility
node -e "
const { Pool } = require('pg');
const pool = new Pool({connectionString: process.env.DATABASE_URL});
pool.query('SELECT id, cruise_id FROM cruises LIMIT 1')
  .then(res => console.log('Schema OK:', res.rows))
  .catch(err => console.error('Schema Error:', err.message))
  .finally(() => process.exit());
"
```

---

## 📞 SUPPORT CONTACTS

### If Migration Fails
1. **STOP IMMEDIATELY** - Don't continue with partially failed migration
2. Run rollback script to restore original state
3. Contact technical team with error logs
4. Document the failure for analysis

### Critical Success Metrics
- [ ] Migration completes without errors
- [ ] All verification checks pass
- [ ] Sync operations work with new schema
- [ ] No data loss occurred
- [ ] Foreign key relationships intact

---

## 🔄 POST-MIGRATION TASKS

### Immediate (Within 1 hour)
- [ ] Run full sync to verify operations
- [ ] Monitor error logs for 1 hour
- [ ] Test quote request functionality
- [ ] Verify search/filter operations work

### Within 24 hours
- [ ] Compare sync performance before/after
- [ ] Clean up backup table if everything stable
- [ ] Update documentation with new schema
- [ ] Update development environments

### Within 1 week
- [ ] Monitor long-term performance
- [ ] Update any remaining scripts that reference old schema
- [ ] Consider dropping old backup tables

---

## 📝 IMPORTANT NOTES

1. **This migration is PRODUCTION-SAFE** but still requires careful execution
2. **Backup table** `cruises_old_backup` will be preserved until manual cleanup
3. **New sync script** must be used after migration - old script will fail
4. **Views and functions** are created for backward compatibility
5. **Zero data loss** - all existing records are preserved with correct relationships

**Migration file**: `/Users/winlin/Desktop/sites/zipsea/backend/src/db/migrations/0005_fix_cruise_pk_production.sql`  
**New sync script**: `/Users/winlin/Desktop/sites/zipsea/backend/scripts/sync-production-corrected-pk.js`  
**Verification script**: `/Users/winlin/Desktop/sites/zipsea/backend/scripts/verify-cruise-pk-migration.sql`  
**Rollback script**: `/Users/winlin/Desktop/sites/zipsea/backend/scripts/rollback-cruise-pk-migration.sql`