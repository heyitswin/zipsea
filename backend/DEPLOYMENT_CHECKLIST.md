# Deployment Checklist - Zipsea Backend Fixes

## Pre-deployment
- [ ] Backup production database
- [ ] Verify environment variables are set
- [ ] Ensure FTP credentials are valid

## Schema Fixes
- [ ] Run `node scripts/recreate-schema.js` on production
- [ ] Verify all tables created successfully
- [ ] Check that indexes are created (especially GIN indexes on JSONB columns)

## Data Sync
- [ ] Start with small sync: `YEAR=2025 MONTH=9 BATCH_SIZE=5 node scripts/sync-sept-onwards.js`
- [ ] Verify cruise line names appear correctly (not "CL17")
- [ ] Verify ship names appear correctly (not "Ship 410")
- [ ] Check search API returns proper data

## Testing
- [ ] Test webhook endpoints: /api/webhooks/traveltek/health
- [ ] Test search API: /api/v1/search
- [ ] Monitor webhook success rates in logs
- [ ] Verify price history is being captured

## Monitoring
- [ ] Check application logs for errors
- [ ] Monitor database performance
- [ ] Verify cache invalidation is working
- [ ] Check Slack notifications for webhook updates

## Rollback Plan
- [ ] Database backup ready for restore
- [ ] Previous schema recreation script available
- [ ] Monitor for issues in first 24 hours

Generated: 2025-08-21T17:56:44.625Z
