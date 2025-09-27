# Production to Staging Cruise Data Sync

## Overview

This documentation describes the system for syncing cruise-related data from the production database to the staging database. This allows staging to use real, up-to-date cruise data for testing while keeping user data (users, quotes, saved searches) separate.

## Why This Sync?

- **Single Source of Truth**: Production is the only environment processing webhooks and syncing with Traveltek FTP
- **Avoid Duplicate Processing**: No need to run separate sync processes for staging
- **Testing with Real Data**: Staging can test with actual cruise inventory and pricing
- **User Data Isolation**: Staging keeps its own user accounts and quote requests for testing

## Architecture

```
Production Database                    Staging Database
┌─────────────────┐                   ┌─────────────────┐
│                 │                   │                 │
│  Cruise Tables  │  ──── SYNC ────> │  Cruise Tables  │
│  (from FTP)     │                   │  (from prod)    │
│                 │                   │                 │
│  User Tables    │                   │  User Tables    │
│  (production)   │                   │  (staging only) │
└─────────────────┘                   └─────────────────┘
```

## Tables Synced

### Cruise-Related Tables (Synced from Production)
- `cruise_lines` - Cruise line definitions
- `ships` - Ship information
- `ports` - Port definitions
- `regions` - Region definitions
- `cruises` - Main cruise data with pricing
- `itineraries` - Cruise itinerary details
- `cabin_categories` - Cabin category information
- `pricing` - Additional pricing data
- `cruise_definitions` - If exists
- `price_snapshots` - Webhook-related pricing snapshots
- `webhook_events` - For debugging webhook processing

### Staging-Only Tables (Never Overwritten)
- `users` - User accounts for testing
- `quote_requests` - Test quote requests
- `saved_searches` - User saved searches

## Setup Instructions

### 1. Environment Variables

You need to set up the following environment variables:

#### For Local Testing
Create or update `.env` file in the backend directory:
```bash
# Production database (read-only access)
DATABASE_URL_PRODUCTION=postgresql://user:pass@host/database

# Staging database (write access)
DATABASE_URL_STAGING=postgresql://user:pass@host/database

# Optional: Slack notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

#### For Render Deployment

1. Go to your Render dashboard
2. Create a new **Cron Job** service
3. Set the following environment variables:
   - `DATABASE_URL_PRODUCTION` - Production database connection string
   - `DATABASE_URL_STAGING` - Staging database connection string
   - `SLACK_WEBHOOK_URL` - (Optional) For notifications

### 2. Manual Testing

Before setting up the cron job, test the sync manually:

```bash
# Dry run - shows what would be synced without making changes
cd backend
npm run sync:production-to-staging:dry

# Or directly:
DRY_RUN=true ./scripts/sync-cruise-data.sh

# Actual sync (BE CAREFUL - this modifies staging database)
npm run sync:production-to-staging
```

### 3. Render Cron Job Setup

1. **Create New Cron Job Service** in Render:
   - Name: `cruise-data-sync-production-to-staging`
   - Environment: Node
   - Build Command: `npm ci`
   - Start Command: `./scripts/sync-cruise-data.sh`
   - Schedule: `0 */6 * * *` (Every 6 hours)
   - Branch: `production`
   - Root Directory: `backend`

2. **Environment Variables** (Set in Render):
   ```
   DATABASE_URL_PRODUCTION = [Production DB URL from Render]
   DATABASE_URL_STAGING = [Staging DB URL from Render]
   SLACK_WEBHOOK_URL = [Optional - Slack webhook for notifications]
   ```

3. **Resource Allocation**:
   - Plan: Starter (minimum)
   - The sync is memory-efficient with chunked processing

## How It Works

### Sync Process

1. **Connection Phase**:
   - Connects to both production and staging databases
   - Validates connections before proceeding

2. **Backup Phase**:
   - Creates backup of staging `quote_requests` table
   - Preserves user-specific test data

3. **Sync Phase**:
   - For each cruise-related table:
     - Disables foreign key constraints temporarily
     - Truncates staging table
     - Copies data from production in chunks (10,000 rows at a time)
     - Re-enables constraints
     - Updates sequences for auto-increment fields

4. **Cleanup Phase**:
   - Removes any `quote_requests` that reference non-existent cruises
   - Validates foreign key integrity

5. **Validation Phase**:
   - Compares row counts between production and staging
   - Reports any discrepancies

6. **Notification Phase**:
   - Sends Slack notification with results (if configured)

### Safety Features

- **Transaction Support**: Each table sync is wrapped in a transaction
- **Chunked Processing**: Handles large tables efficiently
- **Foreign Key Management**: Temporarily disables constraints during sync
- **Backup System**: Backs up staging quotes before sync
- **Dry Run Mode**: Test what would happen without making changes
- **Timeout Protection**: 30-minute maximum runtime
- **Error Recovery**: Rollback on failure

## Monitoring

### Slack Notifications

If configured, you'll receive notifications for:
- ✅ Successful syncs with statistics
- ❌ Failed syncs with error details
- ⏱️ Sync duration
- 📊 Number of rows synced

### Manual Verification

Check sync status:
```sql
-- Compare row counts
SELECT 'production' as env, COUNT(*) as cruise_count 
FROM cruises;

-- Check last update times
SELECT MAX(updated_at) as last_update 
FROM cruises;

-- Verify quotes are valid
SELECT COUNT(*) as invalid_quotes
FROM quote_requests qr
LEFT JOIN cruises c ON qr.cruise_id = c.id
WHERE c.id IS NULL;
```

## Troubleshooting

### Common Issues

#### 1. Connection Timeout
**Error**: "Connection timeout"
**Solution**: Check database URLs and network connectivity

#### 2. Foreign Key Violations
**Error**: "violates foreign key constraint"
**Solution**: The script handles this automatically by removing invalid references

#### 3. Out of Memory
**Error**: "JavaScript heap out of memory"
**Solution**: Reduce chunk size in script (default is 10,000 rows)

#### 4. Permission Denied
**Error**: "permission denied for table"
**Solution**: Ensure staging database user has full permissions

### Debug Mode

For verbose output during sync:
```bash
VERBOSE=true DRY_RUN=true ./scripts/sync-cruise-data.sh
```

## Best Practices

1. **Test First**: Always run dry-run mode before actual sync
2. **Off-Peak Hours**: Schedule syncs during low-traffic periods
3. **Monitor First Runs**: Watch the first few automated runs closely
4. **Regular Validation**: Periodically check data integrity
5. **Keep Backups**: The script backs up quotes, but consider full staging backups

## Rollback Procedure

If something goes wrong:

1. **Restore Quotes**:
   ```sql
   -- Quotes are backed up in quote_requests_backup
   INSERT INTO quote_requests 
   SELECT * FROM quote_requests_backup
   ON CONFLICT (id) DO NOTHING;
   ```

2. **Stop Cron Job**:
   - Disable the cron job in Render dashboard
   - Investigate and fix the issue

3. **Manual Recovery**:
   - If needed, restore staging from a backup
   - Or re-run sync after fixing issues

## Future Enhancements

Potential improvements for the future:

1. **Incremental Sync**: Only sync changed records
2. **Real-time Sync**: Use PostgreSQL logical replication
3. **Selective Table Sync**: Configure which tables to sync
4. **Bi-directional Sync**: Sync test quotes back to production (carefully)
5. **Performance Metrics**: Track sync performance over time

## Security Considerations

- **Read-Only Production Access**: Consider using a read-only user for production
- **Network Security**: Ensure connections are SSL-encrypted
- **Credential Management**: Store credentials securely in Render
- **Audit Logging**: Log all sync operations for compliance

## Support

For issues or questions:
1. Check the Slack notifications for error details
2. Review logs in Render dashboard
3. Check this documentation for troubleshooting steps
4. Contact the development team if issues persist

---

*Last Updated: September 2025*
*Version: 1.0*