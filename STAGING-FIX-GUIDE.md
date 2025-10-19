# Staging Database Fix Guide

**Date:** October 18, 2025  
**Issue:** Staging database missing migrations 0012 & 0013, causing sync failures  
**Solution:** Apply missing migrations, run data sync, reconnect frontend

---

## Problem Summary

Based on the October 17 journal entry and investigation:

1. **Staging DB is out of sync** - Missing live booking tables (booking_sessions, bookings, booking_passengers, booking_payments)
2. **Missing migrations** - Migrations 0012 and 0013 applied to production but not staging
3. **Cron job fails** - Daily sync job gets foreign key errors due to schema mismatch
4. **Temporary workaround** - Staging frontend currently points to production backend

### Key Migrations Missing:
- `0012_add_live_booking_tables.sql` - Adds 4 new tables for live booking
- `0013_add_cruise_line_index.sql` - Adds performance indexes for cruise line filtering

---

## Fix Steps

### Step 1: Apply Missing Migrations to Staging Database

**Run on Render staging backend shell:**

```bash
# SSH into Render staging backend service
# Service: srv-d2ii551r0fns738hdc90 (zipsea-backend)

# Run the migration script
node scripts/apply-missing-migrations-to-staging.js
```

**Expected output:**
```
🔧 Applying missing migrations to staging database...

📝 Migration 0012: Adding live booking tables...
✅ Migration 0012 applied successfully

📝 Migration 0013: Adding cruise line indexes...
✅ Migration 0013 applied successfully

🔍 Verifying tables were created...
✅ Found 4/4 booking tables:
  - booking_passengers
  - booking_payments
  - booking_sessions
  - bookings

🔍 Verifying indexes were created...
✅ Found XX indexes:
  - idx_booking_passengers_booking_id
  - idx_booking_payments_booking_id
  - idx_booking_sessions_cruise_id
  - idx_cruises_cruise_line_id
  - idx_cruises_cruise_line_sailing_date
  ... (and more)

✅ All migrations applied successfully!
```

### Step 2: Run Production → Staging Data Sync

**Option A: Trigger the cron job manually (recommended)**

Go to Render Dashboard → Cron Jobs → `zipsea-cruise-data-sync` → "Trigger Run"

**Option B: Run sync script manually on staging backend:**

```bash
node scripts/sync-production-to-staging-simple.js
```

**Expected outcome:**
- Syncs 7 tables: cruise_lines, ships, ports, regions, cruises, itineraries, cabin_categories
- Should now succeed without foreign key errors
- ~50,000 cruises should be copied from production

**Previously failing with:**
```
⚠️  Row skipped: violates foreign key constraint "cruises_ship_id_fkey"
Final: 157 cruises (99% failed)
```

**Should now succeed with:**
```
✅ Synced cruise_lines: 57 rows
✅ Synced ships: 437 rows
✅ Synced ports: 2,341 rows
✅ Synced regions: 89 rows
✅ Synced cruises: 49,967 rows ← This should work now!
✅ Synced itineraries: ~150,000 rows
✅ Synced cabin_categories: ~25,000 rows
```

### Step 3: Update Staging Frontend to Use Staging Backend

**Go to Render Dashboard:**
1. Navigate to frontend staging service: `srv-d2l0rkv5r7bs73d74dkg`
2. Go to "Environment" tab
3. Find `NEXT_PUBLIC_API_URL`
4. **Change from:** `https://zipsea-production.onrender.com/api/v1`
5. **Change to:** `https://zipsea-backend.onrender.com/api/v1`
6. Click "Save Changes"
7. Redeploy the frontend

**Alternative - if env var doesn't exist:**
Add new environment variable:
- Key: `NEXT_PUBLIC_API_URL`
- Value: `https://zipsea-backend.onrender.com/api/v1`

### Step 4: Verify Everything Works

**Test 1: Check staging backend is running**
```bash
curl https://zipsea-backend.onrender.com/api/v1/health
```

**Test 2: Check cruise line filtering**
```bash
# Should only show Royal Caribbean (22) and Celebrity (3) cruises
curl https://zipsea-backend.onrender.com/api/v1/cruises?limit=5
```

**Test 3: Open staging frontend**
```
https://zipsea-frontend-staging.onrender.com
```

**Test 4: Navigate to a Royal Caribbean or Celebrity cruise detail page**
- Should see cabin pricing tabs (Interior/Oceanview/Balcony/Suite)
- Cabin prices should load without 500 errors
- "Reserve This Cabin" or "Choose Specific Cabin" buttons should appear

**Test 5: Test booking flow**
- Click "Reserve This Cabin" or "Choose Specific Cabin"
- Should redirect to `/booking/{sessionId}/options`
- Complete all 3 steps: Options → Passengers → Payment
- Verify session data persists across page navigation

---

## Why This Happened

### Schema Drift
- Production received migrations 0012 & 0013 on October 17
- Staging database was never updated with these migrations
- Cron sync job tried to copy data but schemas were incompatible

### The Sync Process
1. Daily cron job runs: `sync-production-to-staging-simple.js`
2. Script detects common columns between prod and staging
3. Tries to copy data for each table
4. **Failed on cruises table** because:
   - Ships table in staging had old schema
   - Foreign key `cruises.ship_id → ships.id` constraint failed
   - Only 157/50,000 cruises succeeded (99% failure rate)

### Temporary Workaround Applied Oct 17
- Pointed staging frontend to production backend
- This unblocked development work
- BUT: Means staging isn't testing the full stack independently

---

## Files Created/Modified

### New Scripts:
- `backend/scripts/apply-missing-migrations-to-staging.js` - Applies migrations 0012 & 0013 to staging
- `backend/scripts/compare-prod-staging-schemas.js` - Compares schemas (for future debugging)

### Existing Files Referenced:
- `backend/src/db/migrations/0012_add_live_booking_tables.sql` - Live booking tables
- `backend/src/db/migrations/0013_add_cruise_line_index.sql` - Performance indexes
- `backend/scripts/sync-production-to-staging-simple.js` - Daily cron sync script

---

## Render Service References

### Databases:
- **Production:** `dpg-d2idqjjipnbc73abma3g-a` (50GB, pro_8gb plan)
- **Staging:** `dpg-d2ii4d1r0fns738hchag-a` (1GB, basic_256mb plan)

### Backend Services:
- **Production:** `srv-d2idrj3ipnbc73abnee0` → `zipsea-production.onrender.com`
- **Staging:** `srv-d2ii551r0fns738hdc90` → `zipsea-backend.onrender.com`

### Frontend Services:
- **Production:** `srv-d2l0rkv5r7bs73d74dk0` → `zipsea-frontend-production.onrender.com` → `www.zipsea.com`
- **Staging:** `srv-d2l0rkv5r7bs73d74dkg` → `zipsea-frontend-staging.onrender.com`

### Cron Jobs:
- **Cruise Data Sync:** `crn-d3bjcg37mgec739orqf0` (runs daily at 6 AM UTC)

---

## Post-Fix Verification Checklist

- [ ] Migrations 0012 & 0013 applied to staging database
- [ ] All 4 booking tables exist in staging (booking_sessions, bookings, booking_passengers, booking_payments)
- [ ] Cruise line indexes created (idx_cruises_cruise_line_id, etc.)
- [ ] Production → staging sync completed successfully
- [ ] Staging database has ~50,000 cruises (not 157)
- [ ] Staging frontend env var updated to use staging backend
- [ ] Staging frontend can access cruise data
- [ ] Cabin pricing loads without 500 errors
- [ ] Cruise line filtering shows only Royal Caribbean (22) and Celebrity (3)
- [ ] Booking flow works end-to-end in staging

---

## Future Prevention

### Short Term:
1. **Run migrations on both environments** - When creating new migrations, apply to staging immediately
2. **Monitor cron sync job** - Add alerts when sync produces <90% expected row counts
3. **Document migration process** - Add to deployment workflow docs

### Long Term:
1. **Automated migration deployment** - Apply migrations via CI/CD to both environments
2. **Schema validation** - Check staging matches production before running sync
3. **Synthetic test data** - Consider populating staging with generated data instead of production copy
4. **Backup/restore approach** - Use Render's database restore instead of row-by-row sync

---

## Related Documentation

- **October 17 Journal:** `journal/2025-10-17-staging-fixes-csp-schema-sync.md`
- **Deployment Workflow:** `documentation/DEPLOYMENT-WORKFLOW.md`
- **Database Sync Docs:** `documentation/CRUISE-DATA-SYNC.md`

---

## Troubleshooting

### If migration script fails:

**Error: "Cannot find module 'postgres'"**
```bash
cd backend && npm install
```

**Error: "Cannot read file 0012_add_live_booking_tables.sql"**
```bash
# Check you're running from backend directory
pwd  # Should be: /app or similar on Render
ls src/db/migrations/  # Verify files exist
```

**Error: "relation already exists"**
```bash
# Tables might already exist from previous attempt
# Safe to ignore - script uses CREATE TABLE IF NOT EXISTS
```

### If sync still fails:

**Check database credentials:**
```bash
# On staging backend shell
echo $DATABASE_URL  # Should show staging database connection string
```

**Check for remaining schema differences:**
```bash
node scripts/compare-prod-staging-schemas.js
```

**Check cron job logs:**
Go to Render Dashboard → Cron Jobs → `zipsea-cruise-data-sync` → Logs

---

## Success Criteria

✅ Staging environment is fully functional and independent  
✅ Staging frontend uses staging backend (not production)  
✅ Staging database has complete cruise data synced from production  
✅ Live booking features work in staging (cabin pricing, filtering, booking flow)  
✅ Daily cron sync job runs without errors  
✅ Staging can be used for testing new features before production deployment
