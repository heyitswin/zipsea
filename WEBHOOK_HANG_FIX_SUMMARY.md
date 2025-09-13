# Webhook Processing Hang - Issue Analysis & Solutions

## Problem Identified
The webhook syncs stopped working overnight with the following symptoms:
1. **Webhooks start but never complete** - Processing messages appear but no completion notifications
2. **Memory leak** - Memory usage climbed from 678MB to 986MB over 2 hours
3. **Queue processing broken** - BullMQ jobs accumulate but aren't processed

## Root Cause Analysis
- The webhook processor uses BullMQ with Redis for queue management
- Worker appears to not be processing jobs, causing:
  - Jobs to accumulate in Redis queue
  - Memory to continuously increase (promises/connections pile up)
  - Processing to start but never complete
- No timeout mechanisms in place, allowing jobs to hang indefinitely
- FTP connections not being properly cleaned up

## Solutions Implemented

### 1. Immediate Fix Script (`backend/scripts/fix-webhook-hang.js`)
- Clears all stuck jobs from Redis queue
- Resets webhook events stuck in 'processing' state
- Flushes Redis cache to free memory
- Provides list of webhooks to retry

### 2. Timeout Handling (`webhook-processor-timeout.patch`)
- Added 5-minute timeout per job
- Added 30-second timeout per file
- Reduced worker concurrency to prevent overload
- Added stalled job detection

### 3. Health Monitoring (`backend/scripts/monitor-webhook-health.js`)
- Monitors queue size and active jobs
- Tracks success rates
- Checks memory usage
- Sends Slack alerts on issues
- Can run in watch mode for continuous monitoring

### 4. Memory Management (`src/services/webhook-memory-manager.ts`)
- Monitors memory usage every 30 seconds
- Performs cleanup at warning thresholds
- Aggressive cleanup at critical levels
- Auto-restarts service if memory exceeds limits
- Manages FTP connection pool

## How to Apply the Fix

### Immediate Actions
```bash
# Run the fix script
./fix-webhooks-now.sh

# Or manually:
cd backend
node scripts/fix-webhook-hang.js
node scripts/monitor-webhook-health.js
```

### Permanent Fix - Code Changes Needed

1. **Apply timeout patch to webhook processor:**
   - Open `backend/src/services/webhook-processor-optimized-v2.service.ts`
   - Apply changes from `webhook-processor-timeout.patch`

2. **Initialize memory manager in main app:**
   ```typescript
   // In backend/src/index.ts or app.ts
   import { memoryManager } from './services/webhook-memory-manager';
   
   // Initialize on startup
   memoryManager; // This triggers the singleton initialization
   ```

3. **Add cleanup methods to webhook processor:**
   ```typescript
   // Add these methods to WebhookProcessorOptimizedV2 class
   
   public static async closeAllConnections() {
     for (const conn of this.ftpPool) {
       try {
         conn.client.close();
       } catch (error) {
         console.error('Error closing connection:', error);
       }
     }
     this.ftpPool = [];
   }
   
   public static async pauseQueue() {
     if (this.webhookQueue) {
       await this.webhookQueue.pause();
     }
   }
   
   public static async resumeQueue() {
     if (this.webhookQueue) {
       await this.webhookQueue.resume();
     }
   }
   
   public static async getActiveJobCount(): Promise<number> {
     if (!this.webhookQueue) return 0;
     return await this.webhookQueue.getActiveCount();
   }
   ```

## Prevention Measures

### 1. Set up Monitoring Cron Job
Add to your backend service:
```javascript
// Run health check every 5 minutes
setInterval(async () => {
  const { exec } = require('child_process');
  exec('node scripts/monitor-webhook-health.js', (error, stdout) => {
    if (error) console.error('Health check failed:', error);
  });
}, 5 * 60 * 1000);
```

### 2. Configure Render Service
- Consider upgrading to a plan with more memory if issues persist
- Current: Standard plan with 2GB RAM
- Recommended: Pro plan with 4GB RAM for heavy webhook processing

### 3. Database Connection Pooling
Ensure your database connection pool is properly configured:
```javascript
// In db/connection.ts
const pool = new Pool({
  max: 20, // Maximum connections
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 10000, // Timeout new connections after 10s
});
```

## Monitoring Commands

```bash
# Check webhook health
node backend/scripts/monitor-webhook-health.js

# Continuous monitoring
node backend/scripts/monitor-webhook-health.js --watch

# Check Redis queue directly
redis-cli
> INFO memory
> LLEN bull:webhook-v2-processing:wait
> LLEN bull:webhook-v2-processing:active

# Check service metrics on Render
curl https://api.render.com/v1/services/srv-d2idrj3ipnbc73abnee0/metrics
```

## Expected Behavior After Fix
1. Memory usage should stabilize around 700-900MB
2. Webhooks should complete within 5 minutes
3. Success rate should be above 80%
4. No jobs should remain in 'processing' state for >10 minutes

## If Issues Persist
1. Check FTP server connectivity
2. Verify database isn't hitting connection limits
3. Check if specific cruise lines are causing issues
4. Consider implementing batch size limits
5. Review Render service logs for any new errors

## Emergency Contacts
- Render Status: https://status.render.com
- Traveltek Support: (check their documentation)
- Database Admin: Check pgAdmin or Render dashboard