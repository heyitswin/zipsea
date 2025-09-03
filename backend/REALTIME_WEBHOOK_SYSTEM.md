# Real-Time Webhook Processing System

## Overview

This document describes the new real-time webhook processing system that replaces the old batch sync approach. The new system processes webhooks immediately using parallel workers, providing accurate feedback and eliminating the issues with deferred batch processing.

## Problems Solved

### 1. **Zero Updates Issue**
- **Problem**: Lines 5, 21, 22, 46, 118, 123, 643 were showing 0 updates
- **Root Cause**: Old system only set `needs_price_update = true` flags but didn't actually process cruises
- **Solution**: New system processes cruises immediately via FTP when webhooks arrive

### 2. **Misleading Slack Messages**
- **Problem**: Messages showed "100% success" when only database flags were set
- **Root Cause**: Success was measured by flag updates, not actual FTP processing
- **Solution**: Accurate messages showing actual FTP connections and cruise updates

### 3. **FTP Connection Failures Hidden**
- **Problem**: FTP timeouts and connection issues were not properly reported
- **Root Cause**: Batch processing hid individual failure details
- **Solution**: Real-time processing reports each FTP connection attempt and failure

### 4. **Batch Processing Delays**
- **Problem**: Webhooks were deferred to separate batch sync runs
- **Root Cause**: Large webhook updates (>100 cruises) were marked for later processing
- **Solution**: Parallel processing handles any number of cruises immediately

## New Architecture

### Real-Time Processing Flow

```
Webhook Received → Validate → Queue for Processing → Parallel Workers → FTP Download → Database Update → Slack Notification
```

1. **Webhook Routes** (`src/routes/webhook.routes.ts`)
   - Immediately validate and queue webhooks
   - No more deferred processing or flag setting
   - Real-time response to Traveltek

2. **Realtime Webhook Service** (`src/services/realtime-webhook.service.ts`)
   - Orchestrates parallel processing
   - Manages BullMQ queues and workers
   - Handles both webhook-level and cruise-level jobs

3. **Parallel Processing**
   - **Webhook Queue**: Orchestrates cruise line updates (5 concurrent)
   - **Cruise Queue**: Processes individual cruises (10 concurrent)
   - **FTP Timeout**: 15 seconds per cruise
   - **Retry Logic**: 3 attempts per cruise with exponential backoff

### Queue Architecture

```
Redis (BullMQ)
├── realtime-webhooks queue (Webhook orchestration)
│   └── Workers: 5 concurrent
└── cruise-processing queue (Individual cruise updates)
    └── Workers: 10 concurrent
```

## Key Features

### 1. **Parallel Processing**
- Multiple cruises processed simultaneously
- No single point of failure
- Scales with webhook volume

### 2. **Accurate Reporting**
- FTP connection success/failure rates
- Actual cruises updated vs attempted
- Clear error categorization

### 3. **Security Enhancements**
- Blocks malicious IP: `54.252.154.143`
- Prevents .env file access attempts
- Rate limiting and suspicious request detection

### 4. **Real-Time Feedback**
- Immediate webhook acknowledgment
- Slack notifications with actual results
- No more "Price Snapshots: 0" confusion

## Usage

### Testing the System

1. **Simulate a webhook**:
```bash
curl -X POST http://localhost:3000/api/webhooks/test-simulate \
  -H "Content-Type: application/json" \
  -d '{"lineId": 5}'
```

2. **Check processing status**:
```bash
# Monitor logs
tail -f logs/app.log | grep -E "(REALTIME|webhook|FTP)"

# Check Slack notifications for accurate results
```

### Monitoring

1. **Redis Queue Status**:
```bash
# Connect to Redis and check queue stats
redis-cli
> KEYS *webhook*
> LLEN bull:realtime-webhooks:waiting
```

2. **Security Monitoring**:
```bash
# Check for blocked requests
tail -f logs/app.log | grep "BLOCKED"
```

### Cleanup Old System

1. **Check current batch flags**:
```bash
npm run ts-node src/scripts/cleanup-batch-flags.ts status
```

2. **Clean up batch flags**:
```bash
npm run ts-node src/scripts/cleanup-batch-flags.ts cleanup
```

## Configuration

### Environment Variables
```env
# Required for BullMQ
REDIS_URL=redis://localhost:6379
# or
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password

# Slack notifications
SLACK_WEBHOOK_URL=your_slack_webhook_url
```

### Queue Configuration
- **Webhook Queue Concurrency**: 5 (can handle 5 cruise lines simultaneously)
- **Cruise Queue Concurrency**: 10 (can process 10 cruises simultaneously)
- **FTP Timeout**: 15 seconds per cruise
- **Retry Attempts**: 3 with exponential backoff
- **Rate Limiting**: 50 cruise updates per second

## Accurate Slack Messages

### Before (Misleading)
```
✅ Price Sync Completed (100% Success)
- Processed: 1,247 cruises
- Successful: 1,247
- Failed: 0
- Price Snapshots: 0 (always 0)
```

### After (Accurate)
```
⚠️ Real-time Webhook Processing Completed with Issues
Line 643: 247 cruises actually updated out of 1,247 (19% success)
- Total Cruises: 1,247
- Actual Updates: 247
- FTP Connection Failures: 1,000
- FTP Failure Rate: 81%
- Processing Time: 45 seconds

Note: 1,000 cruises failed due to FTP connection issues
```

## Troubleshooting

### Common Issues

1. **Redis Connection Error**
   - Check Redis server is running
   - Verify REDIS_URL or connection parameters
   - Check network connectivity

2. **High FTP Failure Rate**
   - Check FTP server connectivity
   - Verify FTP credentials and permissions
   - Monitor network latency

3. **No Webhook Processing**
   - Check BullMQ workers are started
   - Verify queue names match
   - Check Redis connection

### Debugging Commands

```bash
# Check Redis connection
redis-cli ping

# Monitor queue activity
redis-cli monitor | grep bull

# Check webhook logs
tail -f logs/app.log | grep "🚀.*webhook"

# Check FTP connection logs  
tail -f logs/app.log | grep "FTP"
```

## Migration Guide

### From Old Batch System

1. **Stop old batch sync crons** (if any)
2. **Clean up existing flags**:
   ```bash
   npm run ts-node src/scripts/cleanup-batch-flags.ts cleanup
   ```
3. **Deploy new webhook routes**
4. **Monitor Slack for accurate results**

### Key Changes for Developers

1. **No more `needs_price_update` flags**
2. **Direct FTP processing in webhooks**  
3. **BullMQ queue-based architecture**
4. **Enhanced security middleware**
5. **Accurate Slack notifications**

## Performance Metrics

### Expected Performance
- **Webhook Response**: < 200ms (immediate acknowledgment)
- **Cruise Processing**: ~1-15 seconds per cruise (FTP dependent)
- **Parallel Capacity**: 10 cruises simultaneously
- **Throughput**: ~50 cruises per second (rate limited)

### Monitoring Metrics
- FTP connection success rate
- Processing time per cruise
- Queue depth and processing rate
- Error categorization and trends

## Security Features

### Malicious Request Blocking
- **Blocked IP**: `54.252.154.143` (known .env accessor)
- **Blocked Paths**: `.env`, `.git`, `wp-admin`, etc.
- **Blocked User Agents**: `curl`, `wget`, scanners, etc.
- **Suspicious Parameters**: Path traversal, config access attempts

### Rate Limiting
- **API Endpoints**: 100 requests per minute per IP
- **Cruise Processing**: 50 updates per second globally
- **Security Events**: Logged and monitored

## Future Enhancements

1. **Dynamic Scaling**: Auto-scale workers based on queue depth
2. **FTP Connection Pooling**: Reuse connections for better performance  
3. **Advanced Retry Logic**: Exponential backoff with jitter
4. **Metrics Dashboard**: Real-time processing metrics
5. **Intelligent Routing**: Priority processing for critical cruise lines

## Support

For issues or questions:
1. Check logs: `logs/app.log`
2. Monitor Slack notifications
3. Use debugging commands above
4. Check Redis and FTP server status