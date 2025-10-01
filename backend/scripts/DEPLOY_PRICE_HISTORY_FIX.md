# Price History Fix - Deployment Guide

## Quick Deployment Steps

### 1. Deploy Code to Staging

```bash
# From your local machine
git add .
git commit -m "Fix price history tracking: VARCHAR type + webhook integration"
git push origin main
```

Render will auto-deploy to staging (`zipsea-backend.onrender.com`)

### 2. Run Migration on Staging

Since we can't run migrations locally (DATABASE_URL is on Render), we have two options:

#### Option A: Via Render Shell (Recommended)
1. Go to Render Dashboard → zipsea-backend service
2. Click "Shell" tab
3. Run:
```bash
cd backend
node scripts/run-price-history-fix-migration.js
```

#### Option B: Via SSH (if available)
```bash
# Connect to Render instance
ssh render@[your-instance-url]
cd backend
node scripts/run-price-history-fix-migration.js
```

#### Option C: Create a One-Time Job in Render
1. Create a new "Job" service in Render
2. Set command: `node backend/scripts/run-price-history-fix-migration.js`
3. Run once
4. Delete the job after successful completion

### 3. Verify Migration Success

You should see output like:
```
✅ SUCCESS! Both foreign key constraints recreated correctly.

📊 AFTER migration:
┌─────────────────┬─────────────┬───────────┬──────────────────────────┐
│ table_name      │ column_name │ data_type │ character_maximum_length │
├─────────────────┼─────────────┼───────────┼──────────────────────────┤
│ price_history   │ cruise_id   │ varchar   │ 255                      │
│ price_trends    │ cruise_id   │ varchar   │ 255                      │
└─────────────────┴─────────────┴───────────┴──────────────────────────┘
```

### 4. Test Webhook Processing

Trigger a test webhook:
```bash
curl -X POST https://zipsea-backend.onrender.com/api/webhooks/traveltek/test \
  -H 'Content-Type: application/json' \
  -d '{"lineId": 22}'
```

Check Render logs for:
```
[OPTIMIZED-V2] Captured price snapshot for cruise...
[OPTIMIZED-V2] Calculated price changes for cruise...
```

### 5. Verify API Endpoints

Test the price history API:
```bash
# Get all recent price history (should return data after webhook runs)
curl "https://zipsea-backend.onrender.com/api/v1/price-history?limit=10"

# Get price changes for a specific cruise
curl "https://zipsea-backend.onrender.com/api/v1/price-history/changes/YOUR_CRUISE_ID?days=7"

# Get price summary
curl "https://zipsea-backend.onrender.com/api/v1/price-history/summary/YOUR_CRUISE_ID?days=30"
```

### 6. Monitor for 24 Hours

Watch for:
- ✅ No foreign key constraint errors
- ✅ Price snapshots being created during webhook processing
- ✅ Price history table receiving data
- ✅ No performance degradation

### 7. Deploy to Production

Once staging is stable:

```bash
git checkout production
git merge main
git push origin production
```

Then run migration on production:
```bash
# Via Render shell on zipsea-production service
cd backend
DATABASE_URL="$DATABASE_URL" node scripts/run-price-history-fix-migration.js
```

---

## Troubleshooting

### Migration Fails with "relation does not exist"

**Cause:** Tables might not exist yet.

**Solution:** Check if tables exist:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('price_history', 'price_trends');
```

If not, the original migration might not have run. Run it first:
```bash
node scripts/run-migrations.js
```

### Foreign Key Constraint Still Fails

**Cause:** There might be existing INTEGER data in the table.

**Solution:** Check if table has data:
```sql
SELECT COUNT(*) FROM price_history;
```

If it has data with INTEGER cruise_ids, you may need to truncate:
```sql
TRUNCATE TABLE price_history CASCADE;
TRUNCATE TABLE price_trends CASCADE;
```

Then rerun the migration.

### Webhook Processing Shows Errors

**Cause:** Service might need restart after deployment.

**Solution:** 
1. Go to Render Dashboard
2. Click "Manual Deploy" → "Clear build cache & deploy"
3. Or just restart the service

### No Price Snapshots Being Created

**Cause:** Webhook processor might not be calling the new code.

**Check:**
1. Verify deployment completed successfully
2. Check Render logs for the new log messages
3. Ensure the service restarted after deployment
4. Trigger another test webhook

---

## Success Criteria

After deployment, you should see:

1. ✅ Migration completed without errors
2. ✅ `cruise_id` columns are VARCHAR(255)
3. ✅ Foreign key constraints recreated
4. ✅ Webhook processing logs show snapshot capture
5. ✅ Price history API returns data
6. ✅ No errors in Render logs related to price history
7. ✅ Slack notifications show successful webhook processing

---

## Rollback Plan

If something goes wrong:

### Option 1: Revert Code Only
```bash
git revert [commit-hash]
git push origin main
```

This will remove the webhook integration but leave migration in place.

### Option 2: Revert Migration (if needed)
```sql
-- Change back to INTEGER (only if absolutely necessary)
ALTER TABLE price_history DROP CONSTRAINT price_history_cruise_id_cruises_id_fk;
ALTER TABLE price_trends DROP CONSTRAINT price_trends_cruise_id_cruises_id_fk;

ALTER TABLE price_history ALTER COLUMN cruise_id TYPE integer USING cruise_id::integer;
ALTER TABLE price_trends ALTER COLUMN cruise_id TYPE integer USING cruise_id::integer;

-- Note: This will fail if VARCHAR cruise_ids exist!
```

**Better approach:** Just disable the feature without reverting migration:
```typescript
// Comment out price history calls in webhook processor
// The migration can stay - it's more correct anyway
```

---

## Contact

If you encounter issues:
1. Check Render logs first
2. Review Slack notifications
3. Query database directly to check data
4. Contact development team with error logs
