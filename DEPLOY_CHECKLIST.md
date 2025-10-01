# Price History Fix - Deployment Checklist

Use this checklist to deploy the price history fix to staging and production.

---

## 📋 Pre-Deployment

- [ ] Review investigation findings in `PRICE_SNAPSHOTS_FIX_SUMMARY.md`
- [ ] Review technical details in `backend/PRICE_SNAPSHOTS_INVESTIGATION_AND_FIX.md`
- [ ] Read deployment guide in `backend/scripts/DEPLOY_PRICE_HISTORY_FIX.md`
- [ ] Confirm you understand what's being changed (cruise_id INTEGER → VARCHAR)

---

## 🚀 Staging Deployment

### Step 1: Deploy Code
- [ ] Code is already committed locally
- [ ] Push to GitHub: `git push origin main`
- [ ] Verify Render auto-deploy started
- [ ] Wait for deployment to complete (check Render dashboard)
- [ ] Verify deployment succeeded (check for green status)

### Step 2: Run Migration
- [ ] Open Render Dashboard → zipsea-backend service
- [ ] Click "Shell" tab
- [ ] Run: `cd backend && node scripts/run-price-history-fix-migration.js`
- [ ] Verify output shows `✅ SUCCESS!`
- [ ] Confirm both tables show VARCHAR type
- [ ] Confirm foreign key constraints recreated

### Step 3: Test Webhook Processing
- [ ] Trigger test webhook:
  ```bash
  curl -X POST https://zipsea-backend.onrender.com/api/webhooks/traveltek/test \
    -H 'Content-Type: application/json' \
    -d '{"lineId": 22}'
  ```
- [ ] Check Render logs for:
  - `[OPTIMIZED-V2] Captured price snapshot for cruise...`
  - `[OPTIMIZED-V2] Calculated price changes for cruise...`
- [ ] Verify no errors in logs

### Step 4: Verify Database
- [ ] Connect to staging database
- [ ] Run: `SELECT COUNT(*) FROM price_history WHERE created_at > NOW() - INTERVAL '1 hour';`
- [ ] Verify count > 0 (snapshots are being created)
- [ ] Run: `SELECT * FROM price_history ORDER BY created_at DESC LIMIT 5;`
- [ ] Verify cruise_id values are strings (VARCHAR)

### Step 5: Test API Endpoints
- [ ] Test historical prices:
  ```bash
  curl "https://zipsea-backend.onrender.com/api/v1/price-history?limit=10"
  ```
- [ ] Verify response returns data (not empty)
- [ ] Test price changes (replace CRUISE_ID):
  ```bash
  curl "https://zipsea-backend.onrender.com/api/v1/price-history/changes/CRUISE_ID?days=7"
  ```
- [ ] Test price summary:
  ```bash
  curl "https://zipsea-backend.onrender.com/api/v1/price-history/summary/CRUISE_ID"
  ```
- [ ] Verify all endpoints return 200 OK

### Step 6: Monitor for 24 Hours
- [ ] Check Render logs every few hours
- [ ] Verify no foreign key constraint errors
- [ ] Verify price snapshots continue being created
- [ ] Check database growth (should be minimal)
- [ ] Verify webhook processing times haven't increased significantly

---

## 🎯 Production Deployment

**Only proceed after 24-48 hours of successful staging operation**

### Pre-Production Checks
- [ ] Staging has been stable for 24+ hours
- [ ] No errors in staging logs
- [ ] API endpoints working correctly
- [ ] Database foreign keys intact
- [ ] No performance degradation

### Step 1: Deploy Code
- [ ] Checkout production branch: `git checkout production`
- [ ] Merge main: `git merge main`
- [ ] Push to origin: `git push origin production`
- [ ] Verify Render auto-deploy started for production service
- [ ] Wait for deployment to complete
- [ ] Verify deployment succeeded

### Step 2: Run Migration on Production
- [ ] Open Render Dashboard → zipsea-production service
- [ ] Click "Shell" tab
- [ ] Run: `cd backend && node scripts/run-price-history-fix-migration.js`
- [ ] Verify output shows `✅ SUCCESS!`
- [ ] Confirm both tables show VARCHAR type
- [ ] Confirm foreign key constraints recreated

### Step 3: Verify Production
- [ ] Check Slack notifications for webhook processing
- [ ] Monitor Render logs for any errors
- [ ] Verify price snapshots being created
- [ ] Test API endpoints on production:
  ```bash
  curl "https://zipsea-production.onrender.com/api/v1/price-history?limit=10"
  ```

### Step 4: Post-Deployment Monitoring
- [ ] Monitor for 24 hours continuously
- [ ] Check database size growth
- [ ] Verify webhook processing success rates
- [ ] Monitor API response times
- [ ] Check for any user-reported issues

---

## ✅ Success Criteria

Mark deployment successful when ALL of these are true:

- [ ] Migration completed without errors
- [ ] cruise_id columns are VARCHAR(255)
- [ ] Foreign key constraints working
- [ ] Webhook logs show snapshot captures
- [ ] Price history table receiving data
- [ ] All API endpoints return valid responses
- [ ] No performance degradation
- [ ] No errors in Slack notifications
- [ ] System stable for 24+ hours

---

## 🚨 Rollback Triggers

Rollback if ANY of these occur:

- [ ] Migration fails with errors
- [ ] Foreign key constraint errors appear
- [ ] Webhook processing starts failing
- [ ] Database errors spike
- [ ] API endpoints return 500 errors
- [ ] Significant performance degradation
- [ ] User complaints increase

---

## 🔄 Rollback Procedure

If rollback is needed:

### Option 1: Code Only (Safest)
```bash
# Revert the webhook processor changes
git revert HEAD
git push origin main  # (or production)
```
This removes webhook integration but keeps migration (which is actually correct).

### Option 2: Full Rollback (If Necessary)
Contact database admin to:
1. Restore from backup
2. Or manually revert migration (risky - may lose data)

**Recommendation:** Option 1 is sufficient in most cases. The migration itself is correct and should stay.

---

## 📊 Post-Deployment Tasks

After successful deployment:

- [ ] Update team on successful deployment
- [ ] Document any issues encountered
- [ ] Update monitoring dashboards
- [ ] Plan "Save Cruise" feature development
- [ ] Schedule review meeting to discuss price drop alerts

---

## 📝 Notes & Issues

Use this space to track any issues during deployment:

**Staging Issues:**
- 

**Production Issues:**
- 

**Resolution Notes:**
- 

---

## ✍️ Sign-Off

**Staging Deployment:**
- Deployed by: ________________
- Date: ________________
- Status: ☐ Success  ☐ Failed  ☐ Rollback
- Notes: 

**Production Deployment:**
- Deployed by: ________________
- Date: ________________
- Status: ☐ Success  ☐ Failed  ☐ Rollback
- Notes: 

---

**Last Updated:** October 1, 2025  
**Next Review:** After production deployment
