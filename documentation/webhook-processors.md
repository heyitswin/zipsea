# Webhook Processor Documentation

## Current Status (as of 2025-09-10)

### Active Processor
**Production uses: `WebhookProcessorOptimizedV2`** 
- File: `backend/src/services/webhook-processor-optimized-v2.service.ts`
- Shows `[OPTIMIZED-V2]` and `[WORKER-V2]` in logs
- Processes files via BullMQ queue system with Redis
- Supports concurrent webhook processing with 10 workers

## Architecture Overview

### Key Components

1. **FTP Connection Pool**
   - Pool size: 10 connections (increased from 3)
   - Keep-alive interval: 30 seconds
   - Reuses connections for efficiency

2. **Queue System (BullMQ)**
   - Queue name: `webhook-v2-processing`
   - Concurrency: 10 workers (increased from 3)
   - Job retention: 100 completed, 50 failed
   - Retry policy: 3 attempts with exponential backoff
   - Batch size: 20 files processed in parallel
   - Files per job: 200 (increased from 50)

3. **Database Connection Pool**
   - Pool size: 50 connections (increased from 20)
   - Idle timeout: 30 seconds
   - Connection timeout: 5 seconds

## Important Files & Routes

### Core Files
- **Main Processor**: `/backend/src/services/webhook-processor-optimized-v2.service.ts`
- **Webhook Routes**: `/backend/src/routes/webhook.routes.ts`
- **Slack Service**: `/backend/src/services/slack.service.ts`
- **Database Connection**: `/backend/src/db/connection.ts`
- **Environment Config**: `/backend/src/config/environment.ts`

### Database Schema Files
- **Cruises**: `/backend/src/db/schema/cruises.ts`
- **Pricing**: `/backend/src/db/schema/cheapest-pricing.ts`
- **Snapshots**: `/backend/src/db/schema/webhook-events.ts`

### API Endpoints
- **POST** `/api/webhooks/traveltek/test` - Test webhook with specific line ID
- **POST** `/api/webhooks/traveltek` - Production webhook endpoint

## Processing Flow

### 1. Webhook Receipt
```javascript
// Route: /api/webhooks/traveltek
// Extracts lineId from payload (supports multiple field names)
// Calls WebhookProcessorOptimizedV2.processFileStatic()
```

### 2. File Discovery
- Scans FTP server: `/traveltek/cruises/v5/{lineId}/`
- Discovers ALL available years (2025-2029 currently)
- Scans ALL months from current month onwards
- No date limiting - processes all future data

### 3. Queue Processing
- Creates batches of 200 files
- Adds to BullMQ with priority and staggered delays
- 10 concurrent workers process batches
- Each worker processes 20 files in parallel

### 4. Data Extraction & Storage

#### Cruise Data (upsert to `cruises` table)
- Safely parses integers (handles "system" values)
- Safely parses dates (handles "0000-00-00")
- Stores complete raw JSON in `raw_data` column
- Updates all Traveltek fields

#### Pricing Data (upsert to `cheapest_pricing` table)
Priority extraction order:
1. `combined` field with cabins array
2. Direct pricing fields
3. Categorizes by cabin type (interior, oceanview, balcony, suite)

#### Price Snapshots
- Creates snapshots before processing
- Stores granular cabin pricing
- Tracks price changes over time

## Slack Notifications

### Notification Types
1. **Processing Started** - When webhook begins
2. **Processing Completed** - With full statistics:
   - Total cruises processed
   - Success/failure counts
   - Processing time
   - Price snapshots created
   - Error details (first 5)

### Slack Service Methods
- `notifyWebhookProcessingStarted()`
- `notifyWebhookProcessingCompleted()`
- `notifySyncError()`
- `notifyWebhookHealth()`

## Performance Optimizations (2025-09-10)

### Database Upgrade
- PostgreSQL upgraded from `basic_256mb` to `basic_1gb` or `basic_4gb`
- Provides 2.5x to 10x more CPU power

### Configuration Changes
| Setting | Old Value | New Value | Impact |
|---------|-----------|-----------|--------|
| FTP Pool Size | 3 | 10 | 3.3x more parallel downloads |
| Batch Size | 5 | 20 | 4x faster file processing |
| Files per Job | 50 | 200 | 4x fewer jobs needed |
| Worker Concurrency | 3 | 10 | 3.3x more parallel workers |
| DB Connection Pool | 20 | 50 | 2.5x more DB connections |

## Monitoring & Debugging

### Log Patterns
- `[OPTIMIZED-V2]` - Main processor logs
- `[WORKER-V2]` - Queue worker logs
- Shows processing rate (files/minute)
- Shows file distribution by year/month
- Queue status after adding jobs

### Key Metrics
- Files discovered vs processed
- Cruises updated count
- Price snapshots created
- Processing time per batch
- Success/failure rates

## Error Handling

### Common Issues & Solutions

1. **"system" Integer Parsing**
   - Issue: Traveltek sends "system" as value for integer fields
   - Solution: `safeParseInt()` function returns null for invalid values

2. **FTP Connection Pool**
   - Issue: Multiple connections being created
   - Solution: Singleton pattern with proper initialization checks

3. **Queue Pausing**
   - Issue: Queue gets paused and stops processing
   - Solution: Auto-resume on initialization and after adding jobs

4. **Database Errors**
   - Issue: Connection pool exhaustion
   - Solution: Increased pool size to 50, proper connection release

## Testing Commands

### Test Webhook
```bash
curl -X POST https://zipsea-production.onrender.com/api/webhooks/traveltek/test \
  -H 'Content-Type: application/json' \
  -d '{"lineId": 22}'
```

### Check Queue Status
```bash
ssh render@srv-... "cd backend && node scripts/check-queue-status.js"
```

### Verify Database Updates
```bash
cd backend && node scripts/verify-db-updates.js
```

## Environment Variables

### Required for Production
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection for queue
- `FTP_HOST` - Traveltek FTP server (ftp.traveltek.net)
- `FTP_USER` - FTP username
- `FTP_PASSWORD` - FTP password
- `SLACK_WEBHOOK_URL` - Slack webhook for notifications

## Deployment Notes

### Workflow
1. Work on `main` branch
2. Push to origin/main
3. Merge main to production: `git checkout production && git merge main`
4. Push to origin/production
5. Render auto-deploys from production branch

### Build Commands
- Backend: `npm install && npm run build`
- Start: `npm start`
- Health check: `/health`

## Future Improvements

### Potential Optimizations
1. Add database indexes on frequently queried columns
2. Implement connection pooling for FTP
3. Add caching layer for frequently accessed data
4. Implement partial file processing for large files
5. Add detailed performance metrics dashboard

### Monitoring Enhancements
1. Add Datadog or New Relic APM
2. Implement custom metrics for webhook processing
3. Add alerting for processing failures
4. Create dashboard for real-time monitoring

## Maintenance

### Regular Tasks
1. Monitor Redis memory usage
2. Check PostgreSQL connection pool utilization
3. Review failed jobs in queue
4. Clean up old price snapshots
5. Monitor FTP connection stability

### Troubleshooting Steps
1. Check logs for `[OPTIMIZED-V2]` entries
2. Verify queue is not paused: `webhookQueue.isPaused()`
3. Check active/waiting job counts
4. Verify FTP connectivity
5. Check database connection pool status
6. Review Slack notifications for error patterns

## Contact

For issues or questions about the webhook processor:
- Check logs in Render dashboard
- Review Slack notifications in configured channel
- Check this documentation for updates
- File issues at: https://github.com/heyitswin/zipsea/issues