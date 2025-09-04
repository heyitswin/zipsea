# Complete Bulk FTP Processing Monitoring Guide

## 🚀 Quick Start - Monitor Your Test Webhook

After sending a test webhook, use these commands immediately to track progress:

### Instant Status Check
```bash
# 1. Start the live dashboard (most comprehensive)
cd backend
npm run tsx scripts/live-monitoring-dashboard.ts -- --line 643 --interval 5

# 2. Check database updates in real-time
psql $DATABASE_URL -f scripts/database-monitoring-queries.sql

# 3. Monitor Redis queues
npm run tsx scripts/redis-queue-monitor.ts -- --live

# 4. Tail Render logs for webhook processing
render logs --service-id YOUR_SERVICE_ID --tail | grep -E "webhook|Line 643|bulk"
```

## 📋 Complete Monitoring Toolkit

I've created a comprehensive monitoring system for tracking bulk FTP processing. Here's what you now have:

### 1. 🎯 Live Monitoring Dashboard
**File:** `/backend/scripts/live-monitoring-dashboard.ts`

This is your **primary monitoring tool** - a real-time dashboard showing:
- Webhook processing status
- Database update progress  
- Redis queue status
- Performance metrics
- Recent activity
- System health alerts

```bash
# Monitor everything
npm run tsx scripts/live-monitoring-dashboard.ts

# Monitor specific cruise line
npm run tsx scripts/live-monitoring-dashboard.ts -- --line 643

# Custom refresh interval
npm run tsx scripts/live-monitoring-dashboard.ts -- --interval 5
```

### 2. 📊 Comprehensive Progress Monitor
**File:** `/backend/scripts/monitor-bulk-ftp-progress.ts`

Detailed FTP processing monitoring with:
- Webhook reception tracking
- Redis queue analysis
- Cruise update progress
- Recent activity logs

```bash
# Monitor specific line with live updates
npm run tsx scripts/monitor-bulk-ftp-progress.ts -- --line 643 --live --interval 10

# Single status check
npm run tsx scripts/monitor-bulk-ftp-progress.ts -- --line 643
```

### 3. 🗄️ Database Monitoring Queries
**File:** `/backend/scripts/database-monitoring-queries.sql`

Real-time SQL queries for:
- Webhook processing status
- Cruise update progress
- Pricing data analysis
- Error detection
- Performance metrics

```bash
# Run all monitoring queries
psql $DATABASE_URL -f scripts/database-monitoring-queries.sql

# Watch database in real-time
watch -n 30 'psql $DATABASE_URL -f scripts/database-monitoring-queries.sql'
```

### 4. 🔄 Redis Queue Monitor
**File:** `/backend/scripts/redis-queue-monitor.ts`

Monitor Redis Bull queues:
- Queue statistics (waiting, active, completed, failed)
- Active job details
- Failed job analysis
- Server health

```bash
# Live queue monitoring
npm run tsx scripts/redis-queue-monitor.ts -- --live

# Monitor specific queue
npm run tsx scripts/redis-queue-monitor.ts -- --queue BulkCruiseProcessingQueue
```

### 5. 📝 Render Production Logs
**File:** `/backend/scripts/render-log-monitoring.md`

Complete guide for Render log monitoring:
- Real-time log tailing commands
- Filtered monitoring by webhook, FTP, errors
- Multi-terminal setup
- Automated log analysis scripts

### 6. 💬 Slack Notification Monitoring
**File:** `/backend/scripts/slack-monitoring-guide.md`

Complete Slack integration monitoring:
- Notification patterns to watch
- Search commands for tracking
- Alert response workflows
- Mobile monitoring setup

## 🎯 Monitoring Your Test Webhook - Step by Step

### Step 1: Send Your Test Webhook
```bash
curl -X POST https://zipsea-production.onrender.com/api/webhooks/traveltek/cruiseline-pricing-updated \
  -H "Content-Type: application/json" \
  -d '{
    "lineid": 643,
    "marketid": 0,
    "currency": "USD",
    "description": "Test bulk processing for line 643",
    "timestamp": '$(date +%s)'
  }'
```

### Step 2: Start Monitoring (Multiple Terminals)

**Terminal 1 - Live Dashboard:**
```bash
cd backend
npm run tsx scripts/live-monitoring-dashboard.ts -- --line 643 --interval 5
```

**Terminal 2 - Render Logs:**
```bash
render logs --service-id YOUR_SERVICE_ID --tail | grep -E "Line 643|webhook|bulk|FTP"
```

**Terminal 3 - Database Monitoring:**
```bash
# Watch database changes every 30 seconds
watch -n 30 'psql $DATABASE_URL -c "
SELECT COUNT(*) as pending_updates, MAX(updated_at) as last_update 
FROM cruises WHERE cruise_line_id = 643 AND needs_price_update = true;

SELECT COUNT(*) as updated_last_hour 
FROM cruises WHERE cruise_line_id = 643 AND updated_at >= CURRENT_TIMESTAMP - INTERVAL '"'"'1 hour'"'"';
"'
```

**Terminal 4 - Redis Queues:**
```bash
npm run tsx scripts/redis-queue-monitor.ts -- --live --interval 10
```

### Step 3: What to Look For

#### ✅ Successful Processing Indicators:
- **Dashboard:** Pending webhooks decrease, recent updates increase
- **Logs:** "Bulk processing completed", "FTP files downloaded"
- **Database:** `needs_price_update` flags cleared, `updated_at` timestamps recent
- **Redis:** Jobs move from "waiting" → "active" → "completed"
- **Slack:** Success notifications with cruise counts

#### ⚠️ Issues to Watch:
- **Stalled Processing:** Webhooks stuck in "pending" status
- **FTP Errors:** Connection timeouts, file not found errors
- **Queue Backlog:** Too many jobs waiting in Redis
- **Database Locks:** Long-running queries blocking updates
- **High Error Rates:** Many failed cruise updates

#### 🚨 Critical Problems:
- **Redis Connection Lost:** Queue monitoring shows disconnected
- **Database Errors:** SQL constraint violations, connection failures  
- **FTP Server Down:** All downloads failing
- **Memory Issues:** High memory usage in Redis/app

## 📈 Understanding the Processing Flow

### 1. Webhook Reception
```
🚀 Webhook received → Validated → Queued for processing
Logs: "Cruiseline pricing updated webhook received"
Database: New row in webhook_events table
```

### 2. Queue Processing
```
📋 Job picked up by worker → FTP connection → File discovery
Redis: Job moves to "active" status  
Logs: "Starting bulk cruise processing for line X"
```

### 3. FTP Download & Processing
```
📥 Download JSON files → Parse cruise data → Update database
Logs: "Downloaded X files", "Processing cruise Y"
Database: cruise records updated, needs_price_update = false
```

### 4. Completion & Notification
```
✅ Processing complete → Update webhook_events → Send Slack notification
Logs: "Bulk processing completed"  
Slack: Success summary with counts and timing
```

## 🛠️ Troubleshooting Common Issues

### Webhook Not Processing
```bash
# Check if webhook was received
psql $DATABASE_URL -c "SELECT * FROM webhook_events WHERE line_id = 643 ORDER BY created_at DESC LIMIT 5;"

# Check Redis queue status
npm run tsx scripts/redis-queue-monitor.ts

# Check for processing errors
render logs --service-id YOUR_SERVICE_ID --since="30m" | grep -E "ERROR|FAILED"
```

### Slow Processing
```bash
# Check FTP connection performance
render logs --service-id YOUR_SERVICE_ID --tail | grep -E "FTP.*took|download.*speed"

# Monitor processing times
psql $DATABASE_URL -c "SELECT processing_time_ms FROM webhook_events WHERE line_id = 643 ORDER BY created_at DESC LIMIT 10;"
```

### Partial Updates
```bash
# Check which cruises failed to update
psql $DATABASE_URL -c "SELECT COUNT(*) FROM cruises WHERE cruise_line_id = 643 AND needs_price_update = true;"

# Look for specific error patterns
render logs --service-id YOUR_SERVICE_ID --since="1h" | grep -E "failed.*cruise|error.*parsing"
```

## 📊 Performance Benchmarks

### Normal Processing Times:
- **Webhook Processing:** 5-20 seconds
- **Database Updates:** 1-5 seconds per cruise
- **FTP Downloads:** 50-200 files/minute
- **Queue Processing:** <10 jobs waiting during normal operation

### Warning Thresholds:
- **Processing Time:** >30 seconds per webhook
- **Queue Backlog:** >20 jobs waiting
- **Error Rate:** >10% failed cruises  
- **Memory Usage:** >80% Redis memory

### Critical Thresholds:
- **Processing Time:** >60 seconds
- **Queue Backlog:** >50 jobs waiting
- **Error Rate:** >25% failures
- **System Downtime:** Any component offline >5 minutes

## 🎯 Monitoring Best Practices

### During Active Testing:
1. **Use multiple monitoring tools simultaneously**
2. **Keep terminals open in organized layout**
3. **Take screenshots of successful runs**
4. **Document error patterns and solutions**
5. **Monitor for at least 2-3 complete processing cycles**

### For Production Monitoring:
1. **Set up automated alerts** for critical thresholds
2. **Schedule regular health checks** (every 15-30 minutes)
3. **Maintain monitoring dashboards** on dedicated screens
4. **Create incident response playbooks** for common issues
5. **Review processing metrics** weekly for optimization

### Performance Optimization:
1. **Track processing time trends** to identify degradation
2. **Monitor FTP server performance** during peak hours
3. **Analyze queue patterns** to optimize worker scaling
4. **Review database query performance** regularly
5. **Implement caching strategies** for frequently accessed data

## 🔧 Quick Commands Reference

```bash
# Essential monitoring commands (save these!)

# 1. Complete system dashboard
npm run tsx scripts/live-monitoring-dashboard.ts -- --line 643

# 2. Check recent webhook activity  
psql $DATABASE_URL -c "SELECT * FROM webhook_events WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '2 hours' ORDER BY created_at DESC;"

# 3. Monitor Redis queues
redis-cli llen "bull:BulkCruiseProcessingQueue:waiting"
redis-cli llen "bull:BulkCruiseProcessingQueue:active"  

# 4. Check cruise update status
psql $DATABASE_URL -c "SELECT COUNT(*) as pending FROM cruises WHERE cruise_line_id = 643 AND needs_price_update = true;"

# 5. Tail production logs
render logs --service-id YOUR_SERVICE_ID --tail | grep -E "webhook|bulk|Line 643"

# 6. System health check
curl -s https://zipsea-production.onrender.com/api/webhooks/traveltek/health | jq .

# 7. Database performance check
psql $DATABASE_URL -c "SELECT COUNT(*) as updated_last_hour FROM cruises WHERE updated_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour';"
```

## 🎉 You're All Set!

You now have a complete monitoring suite for tracking bulk FTP processing. The tools work together to give you full visibility into:

- ✅ **Webhook reception and processing**
- ✅ **Real-time database updates**  
- ✅ **Redis queue status and job tracking**
- ✅ **Production log monitoring**
- ✅ **Slack notification tracking**
- ✅ **Performance metrics and alerting**
- ✅ **Error detection and troubleshooting**

Start with the live dashboard for the best overview, then use the other tools for detailed investigation when needed.

**Next Steps:**
1. Test the webhook endpoint with your preferred cruise line ID
2. Start the monitoring tools in multiple terminals
3. Watch the complete processing flow from webhook to database updates
4. Document any issues or optimizations you discover
5. Set up automated alerts for production monitoring

Happy monitoring! 🚀