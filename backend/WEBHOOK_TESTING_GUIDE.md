# Webhook System Testing Guide

## Overview

This guide provides comprehensive testing methods for the new real-time webhook processing system. The system has been completely redesigned to process webhooks immediately with parallel workers instead of the old batch sync approach.

## 🆚 Key Differences: New vs Old System

### Old System (Batch/Flags)
- ❌ Set `needs_price_update` flags on cruises
- ❌ Deferred processing via batch jobs
- ❌ Slack messages showed "X cruises marked for update" 
- ❌ No visibility into actual FTP success/failure rates
- ❌ Sequential processing (slow)

### New System (Real-time)
- ✅ Immediate FTP downloads and database updates
- ✅ Real-time parallel processing (10 workers)
- ✅ Slack messages show "X cruises actually updated"
- ✅ Accurate FTP connection success/failure rates
- ✅ BullMQ queue system for reliability

## 🔧 Available Testing Tools

### 1. Interactive Test Script (Recommended)
```bash
# Make script executable (first time only)
chmod +x scripts/webhook-test-production.sh

# Run comprehensive test for Royal Caribbean (line 5)
./scripts/webhook-test-production.sh comprehensive 5

# Test specific functions
./scripts/webhook-test-production.sh simulate 21     # Norwegian
./scripts/webhook-test-production.sh webhook 22      # Celebrity
./scripts/webhook-test-production.sh performance 46 5 # Carnival with 5 concurrent
./scripts/webhook-test-production.sh status          # System health
```

### 2. TypeScript Test Suite
```bash
# Full system test
tsx scripts/test-webhook-system.ts full 5

# Individual tests
tsx scripts/test-webhook-system.ts simulate 21
tsx scripts/test-webhook-system.ts webhook 22
tsx scripts/test-webhook-system.ts status
tsx scripts/test-webhook-system.ts performance 46 --concurrency 5

# Generate curl command for manual testing
tsx scripts/test-webhook-system.ts curl 5
```

### 3. Real-time System Monitor
```bash
# Continuous monitoring (press Ctrl+C to stop)
tsx scripts/webhook-monitor.ts monitor

# Single health check
tsx scripts/webhook-monitor.ts check

# Sensitive monitoring (more frequent checks)
tsx scripts/webhook-monitor.ts monitor sensitive

# Monitor for specific duration (300 seconds)
tsx scripts/webhook-monitor.ts monitor default 300
```

### 4. Load Testing
```bash
# Light load test (15 requests across 3 lines)
tsx scripts/webhook-load-test.ts light progressive

# Heavy load test (50 requests, burst mode)
tsx scripts/webhook-load-test.ts heavy burst

# Moderate load test (30 requests, progressive)
tsx scripts/webhook-load-test.ts moderate progressive
```

## 📋 Manual Testing with Curl

### Test Real Webhook Endpoint
```bash
curl -X POST "https://zipsea-production.onrender.com/api/webhooks/traveltek/cruiseline-pricing-updated" \
  -H "Content-Type: application/json" \
  -H "User-Agent: ManualTest/1.0" \
  -d '{
    "event": "cruiseline_pricing_updated",
    "lineid": 5,
    "marketid": 0,
    "currency": "USD",
    "description": "Manual test for Royal Caribbean",
    "source": "manual_test",
    "timestamp": '$(date +%s)'
  }'
```

### Check System Status
```bash
# Health check
curl "https://zipsea-production.onrender.com/api/webhooks/traveltek/health" | jq '.'

# Detailed status
curl "https://zipsea-production.onrender.com/api/webhooks/traveltek/status" | jq '.'
```

### Test Line Mapping
```bash
# Quick mapping test
curl "https://zipsea-production.onrender.com/api/webhooks/traveltek/mapping-test?lineId=5" | jq '.'

# Detailed debug info
curl "https://zipsea-production.onrender.com/api/webhooks/traveltek/debug?lineId=5" | jq '.'
```

## 🎯 What to Look For in Tests

### 1. Immediate Response
- Webhook endpoints should respond within 2-5 seconds
- Response includes `processingJobId` for tracking
- Status should be `success: true`

### 2. Slack Notifications
Watch Slack for these message patterns:

**Old System Messages (should NOT see these anymore):**
```
❌ "X cruises marked for price update"
❌ "Batch processing queued"
```

**New System Messages (should see these):**
```
✅ "🔄 Real-time Webhook Processing Started"
✅ "Processing X cruises for line Y in parallel"
✅ "✅ Real-time Webhook Processing Completed"
✅ "Line X: Y cruises actually updated out of Z (N% success)"
✅ "FTP connection failures: N cruises failed due to FTP issues"
```

### 3. Performance Indicators
- **Processing Speed**: Should complete within 1-3 minutes for most cruise lines
- **Success Rate**: Should be 85%+ for FTP connections
- **Parallel Processing**: Multiple cruises processed simultaneously
- **Queue Health**: Pending webhooks should stay low (<10)

### 4. System Health Metrics
- Average processing time: <30 seconds
- Queue depth: <10 pending webhooks
- Success rate: >85% actual cruise updates
- No consecutive monitoring failures

## 🚀 Common Test Scenarios

### Scenario 1: Single Cruise Line Update
```bash
# Test Royal Caribbean (high-volume line)
./scripts/webhook-test-production.sh webhook 5

# Expected: 50-200 cruises processed in 1-2 minutes
# Slack should show actual FTP download results
```

### Scenario 2: Multiple Concurrent Webhooks
```bash
# Test 5 concurrent requests
./scripts/webhook-test-production.sh performance 5 5

# Expected: All 5 requests accepted immediately
# System should handle parallel processing gracefully
```

### Scenario 3: System Under Load
```bash
# Heavy load test
tsx scripts/webhook-load-test.ts heavy progressive

# Expected: >85% success rate even under load
# Response times should remain reasonable
```

### Scenario 4: Line Mapping Verification
```bash
# Test line that requires mapping (e.g., webhook 643 -> database 643)
./scripts/webhook-test-production.sh mapping 643

# Expected: Correct mapping applied, cruises found in database
```

## ⚠️ Troubleshooting

### Common Issues and Solutions

**Issue: High FTP Connection Failures**
- Check: FTP server status and connection limits
- Expected: Some failures are normal (5-15%), but >50% indicates FTP issues

**Issue: Slow Processing Times**
- Check: Redis connection, worker concurrency settings
- Expected: Most processing should complete within 2-3 minutes

**Issue: Webhooks Not Being Processed**
- Check: Redis connection, BullMQ queue status
- Run: `tsx scripts/webhook-monitor.ts check` for diagnostics

**Issue: No Slack Notifications**
- Check: Slack service configuration
- Verify: Webhook processing still works (check database directly)

### Debug Commands
```bash
# Check specific line mapping
curl "https://zipsea-production.onrender.com/api/webhooks/traveltek/debug?lineId=5" | jq '.'

# Monitor queue status
tsx scripts/webhook-monitor.ts monitor sensitive 60

# Test with verbose logging
tsx scripts/test-webhook-system.ts full 5 | tee webhook-test-results.log
```

## 📊 Success Criteria

A successful test should demonstrate:

1. **Immediate Processing**: Webhooks accepted and queued within seconds
2. **Parallel Execution**: Multiple cruises updated simultaneously  
3. **Accurate Results**: Slack shows actual FTP download results, not just flags
4. **High Success Rate**: >85% of cruises successfully updated
5. **System Stability**: No queue buildup or consecutive failures
6. **Performance**: Processing completes within reasonable time (1-3 minutes for typical cruise lines)

## 🎉 Production Readiness Checklist

- [ ] All test scripts execute without errors
- [ ] Webhook endpoints respond within 5 seconds
- [ ] Slack notifications show real FTP results
- [ ] System monitor shows healthy status
- [ ] Load tests achieve >85% success rate
- [ ] No "needs_price_update" flag messages in Slack
- [ ] Redis queues remain stable under load
- [ ] FTP connection errors are within acceptable range (5-15%)

---

**Need Help?**
- Run `./scripts/webhook-test-production.sh help` for quick reference
- Use `tsx scripts/webhook-monitor.ts monitor` for real-time system status
- Check Slack #cruise-updates channel for processing notifications