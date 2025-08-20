# Running the Complete Data Sync on Render

## Quick Command
To run the fixed UPSERT sync that properly updates existing data:

```bash
# On Render Shell:
FORCE_UPDATE=true SYNC_YEARS=2025 node scripts/sync-simple-upsert.js
```

## What This Fixed Script Does
✅ **UPDATES existing cruise entries** (not skipping them)  
✅ **Stores ALL data from JSON files**:
   - Complete cruise details
   - Full itineraries (day-by-day)
   - Cabin definitions
   - Complete pricing matrix
   - Ship content and metadata
✅ **Takes price snapshots** before updating (for history tracking)  
✅ **Handles duplicates properly** with UPSERT logic

## Fixed Issues
- ✅ SQL syntax errors ("syntax error at or near ','") - FIXED
- ✅ Duplicate keys causing skips instead of updates - FIXED
- ✅ Complex COALESCE statements causing template literal issues - FIXED

## Script Options

### sync-simple-upsert.js (RECOMMENDED)
The new simplified UPSERT script that:
- Uses simple SQL without complex template literals
- Properly checks for existence then INSERTs or UPDATEs
- Avoids all Drizzle ORM syntax issues
- Maintains complete data processing

### Other Available Scripts
- `sync-complete-data.js` - Original complete sync (has duplicate key issues)
- `sync-upsert-fixed.js` - Attempted fix (still has SQL syntax errors)
- `init-database.js` - Initialize all database tables

## Monitoring Progress
The script will show:
- 📥 Downloading progress
- ✨ New cruises being inserted
- 🔄 Existing cruises being updated
- 📊 Statistics every 10 cruises

## Verifying Results
After sync completes:
```bash
node scripts/check-database-data.js
```

This will show:
- Total cruises in database
- Sample cruise data
- Data completeness metrics

## Environment Variables
Required on Render:
- `TRAVELTEK_FTP_USER` - Your FTP username
- `TRAVELTEK_FTP_PASSWORD` - Your FTP password
- `DATABASE_URL` - Auto-set by Render

## Progress Tracking
The sync creates `.sync-simple-progress.json` to track progress.
If interrupted, just run again - it will resume where it left off.

## Expected Results
For 2025 data, you should see:
- ~900+ cruises processed
- Mix of new inserts and updates
- Complete itineraries for each cruise
- Cabin definitions populated
- Full pricing matrix stored
- Price history snapshots taken