# Sync Script Fixes for New Schema

## Problem
After recreating the database with the correct schema, the sync script `sync-production-corrected-pk.js` was failing with:
```
❌ Error processing /2025/09/1/180/2048139.json: column "code_to_cruise_id" does not exist
```

## Root Cause
The database schema was updated where:
- **OLD**: `cruises.id` = cruiseid, `cruises.code_to_cruise_id` = unique sailing identifier  
- **NEW**: `cruises.id` = code_to_cruise_id value (unique), `cruises.cruise_id` = original cruiseid, **NO** `code_to_cruise_id` column

## Fixes Applied

### 1. Fixed sync-production-corrected-pk.js
**File**: `/Users/winlin/Desktop/sites/zipsea/backend/scripts/sync-production-corrected-pk.js`

**Changes**:
- **Line 173**: Removed `code_to_cruise_id` from SELECT query in existence check
- **Line 440**: Removed `code_to_cruise_id` from schema validation query

**Before**:
```sql
SELECT id, sailing_date, code_to_cruise_id FROM cruises WHERE cruise_id = $1 AND id != $2
```

**After**:
```sql
SELECT id, sailing_date FROM cruises WHERE cruise_id = $1 AND id != $2
```

### 2. Fixed traveltek-webhook.service.ts  
**File**: `/Users/winlin/Desktop/sites/zipsea/backend/src/services/traveltek-webhook.service.ts`

**Changes**:
- **Line 45**: Removed `code_to_cruise_id` from cruise selection query
- **Line 64**: Use `cruise.id` instead of `cruise.code_to_cruise_id` for file path
- **Line 144**: Query by `id` instead of `code_to_cruise_id` when finding cruises

**Before**:
```sql
SELECT id, code_to_cruise_id, ship_id FROM cruises WHERE...
```

**After**:
```sql
SELECT id, ship_id FROM cruises WHERE...
```

## Schema Mapping
The sync script correctly maps data as follows:

| Traveltek Data | Database Column | Description |
|----------------|-----------------|-------------|
| `codetocruiseid` | `cruises.id` | Primary key (unique per sailing) |
| `cruiseid` | `cruises.cruise_id` | Original cruise ID (can duplicate) |

## Verification
All fixes have been tested with mock data and the logic is sound. The sync script should now work correctly with the new schema.

## Usage
```bash
# Set environment variables first
export DATABASE_URL="your_database_url"
export TRAVELTEK_FTP_USER="your_ftp_user"  
export TRAVELTEK_FTP_PASSWORD="your_ftp_password"

# Run sync script
YEAR=2025 MONTH=09 BATCH_SIZE=5 node scripts/sync-production-corrected-pk.js
```

## Files Modified
1. `/Users/winlin/Desktop/sites/zipsea/backend/scripts/sync-production-corrected-pk.js`
2. `/Users/winlin/Desktop/sites/zipsea/backend/src/services/traveltek-webhook.service.ts`

## Status
✅ **COMPLETED** - All references to the non-existent `code_to_cruise_id` column have been fixed.