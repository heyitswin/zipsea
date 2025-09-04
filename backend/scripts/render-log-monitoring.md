# Render Production Log Monitoring Commands

## 1. Real-Time Log Tailing Commands

### Primary Backend Service Logs
```bash
# Install Render CLI if not already installed
npm install -g @render-com/cli

# Login to Render (one-time setup)
render auth login

# Get service information
render services list

# Tail production backend logs in real-time
render logs --service-id YOUR_BACKEND_SERVICE_ID --tail

# Tail logs with filtering for webhook activity
render logs --service-id YOUR_BACKEND_SERVICE_ID --tail | grep -E "(webhook|ftp|bulk|processing)"

# Tail logs with timestamp and filter for errors
render logs --service-id YOUR_BACKEND_SERVICE_ID --tail | grep -E "(ERROR|WARN|❌|⚠️)"

# Tail logs for specific line processing
render logs --service-id YOUR_BACKEND_SERVICE_ID --tail | grep -E "Line (643|24|21)"
```

### Multi-Terminal Monitoring Setup
```bash
# Terminal 1: All webhook activity
render logs --service-id YOUR_BACKEND_SERVICE_ID --tail | grep -E "🚀|📡|webhook"

# Terminal 2: FTP and processing activity  
render logs --service-id YOUR_BACKEND_SERVICE_ID --tail | grep -E "FTP|bulk|processing|🔄|📥"

# Terminal 3: Errors and warnings only
render logs --service-id YOUR_BACKEND_SERVICE_ID --tail | grep -E "ERROR|WARN|❌|⚠️|FAILED"

# Terminal 4: Database updates
render logs --service-id YOUR_BACKEND_SERVICE_ID --tail | grep -E "cruise.*updated|pricing.*updated|💰"
```

## 2. Webhook-Specific Log Monitoring

### Webhook Reception Monitoring
```bash
# Monitor webhook reception
render logs --service-id YOUR_BACKEND_SERVICE_ID --tail | grep -E "Cruiseline pricing updated webhook received"

# Track webhook processing status
render logs --service-id YOUR_BACKEND_SERVICE_ID --tail | grep -E "(queued for real-time|processing in real-time|Webhook.*processing)"

# Monitor specific webhook IDs
render logs --service-id YOUR_BACKEND_SERVICE_ID --tail | grep -E "webhook_[0-9]+_[a-z0-9]+"
```

### Bulk Processing Monitoring
```bash
# Monitor bulk FTP job starts
render logs --service-id YOUR_BACKEND_SERVICE_ID --tail | grep -E "Starting bulk cruise processing for line"

# Track FTP connections and downloads
render logs --service-id YOUR_BACKEND_SERVICE_ID --tail | grep -E "(Connected to FTP|Downloading.*files|FTP.*complete)"

# Monitor processing progress
render logs --service-id YOUR_BACKEND_SERVICE_ID --tail | grep -E "(Processing cruise|Updated cruise|Completed processing)"
```

## 3. Advanced Log Filtering

### Color-coded Log Monitoring
```bash
# Install ccze for colored logs (if available)
render logs --service-id YOUR_BACKEND_SERVICE_ID --tail | ccze -A

# Custom color coding with awk
render logs --service-id YOUR_BACKEND_SERVICE_ID --tail | awk '
/ERROR|❌/ {print "\033[31m" $0 "\033[0m"; next}
/SUCCESS|✅/ {print "\033[32m" $0 "\033[0m"; next}  
/WARN|⚠️/ {print "\033[33m" $0 "\033[0m"; next}
/webhook|🚀/ {print "\033[36m" $0 "\033[0m"; next}
{print $0}
'
```

### Time-based Log Filtering
```bash
# Get logs from last hour
render logs --service-id YOUR_BACKEND_SERVICE_ID --since="1h"

# Get logs from specific time range
render logs --service-id YOUR_BACKEND_SERVICE_ID --since="2023-12-01T10:00:00Z" --until="2023-12-01T11:00:00Z"

# Get recent logs and continue tailing
render logs --service-id YOUR_BACKEND_SERVICE_ID --since="10m" --tail
```

## 4. Performance and Metrics Monitoring

### Processing Time Monitoring
```bash
# Monitor webhook processing times
render logs --service-id YOUR_BACKEND_SERVICE_ID --tail | grep -E "processing.*time|took.*ms|duration"

# Track FTP download performance
render logs --service-id YOUR_BACKEND_SERVICE_ID --tail | grep -E "Downloaded.*in|FTP.*took|transfer.*completed"

# Monitor database query performance
render logs --service-id YOUR_BACKEND_SERVICE_ID --tail | grep -E "query.*took|SQL.*duration"
```

### Memory and Resource Monitoring
```bash
# Monitor memory usage logs
render logs --service-id YOUR_BACKEND_SERVICE_ID --tail | grep -E "memory|heap|GC|garbage"

# Track connection pool status
render logs --service-id YOUR_BACKEND_SERVICE_ID --tail | grep -E "pool.*active|connection.*count|redis.*connected"
```

## 5. Automated Log Analysis Scripts

### Webhook Success Rate Tracker
```bash
#!/bin/bash
# Save as: webhook-success-tracker.sh

echo "Monitoring webhook success rates..."
render logs --service-id YOUR_BACKEND_SERVICE_ID --since="1h" | \
awk '
/webhook.*received/ { total++ }
/successfully.*processed|processing.*complete/ { success++ }
/failed.*processing|error.*webhook/ { failed++ }
END { 
    print "Last hour webhook stats:"
    print "Total: " (total ? total : 0)
    print "Success: " (success ? success : 0) 
    print "Failed: " (failed ? failed : 0)
    if(total > 0) print "Success Rate: " (success/total*100) "%"
}'
```

### FTP Processing Monitor
```bash
#!/bin/bash
# Save as: ftp-monitor.sh

echo "Monitoring FTP bulk processing..."
render logs --service-id YOUR_BACKEND_SERVICE_ID --tail | while read line; do
    if echo "$line" | grep -q "Starting bulk cruise processing"; then
        echo "[$(date)] 🚀 BULK JOB STARTED: $line"
    elif echo "$line" | grep -q "Bulk processing completed"; then
        echo "[$(date)] ✅ BULK JOB COMPLETED: $line"
    elif echo "$line" | grep -q "Connected to FTP"; then
        echo "[$(date)] 🔌 FTP CONNECTED: $line"
    elif echo "$line" | grep -q "Downloaded.*files"; then
        echo "[$(date)] 📥 FTP DOWNLOAD: $line"
    elif echo "$line" | grep -qE "ERROR|FAILED"; then
        echo "[$(date)] ❌ ERROR: $line"
    fi
done
```

## 6. Log Archiving and Analysis

### Export Logs for Analysis
```bash
# Export last 24 hours of logs
render logs --service-id YOUR_BACKEND_SERVICE_ID --since="24h" > webhook_logs_$(date +%Y%m%d).log

# Export webhook-only logs
render logs --service-id YOUR_BACKEND_SERVICE_ID --since="24h" | grep webhook > webhook_only_$(date +%Y%m%d).log

# Export error logs only
render logs --service-id YOUR_BACKEND_SERVICE_ID --since="24h" | grep -E "ERROR|FAILED|❌" > errors_$(date +%Y%m%d).log
```

### Log Pattern Analysis
```bash
# Count webhook events by line ID
render logs --service-id YOUR_BACKEND_SERVICE_ID --since="24h" | \
grep "Line [0-9]" | \
sed -n 's/.*Line \([0-9]\+\).*/\1/p' | \
sort | uniq -c | sort -nr

# Find processing time patterns
render logs --service-id YOUR_BACKEND_SERVICE_ID --since="6h" | \
grep -o "took [0-9]\+ms" | \
sed 's/took //; s/ms//' | \
sort -n | \
awk '{sum+=$1; count++} END {print "Avg processing time: " sum/count "ms"}'
```

## 7. Alert Setup

### Webhook Failure Alerts
```bash
#!/bin/bash
# Save as: webhook-alerts.sh
# Run this in a cron job every 5 minutes

WEBHOOK_ERRORS=$(render logs --service-id YOUR_BACKEND_SERVICE_ID --since="5m" | grep -c "webhook.*failed\|webhook.*error")

if [ "$WEBHOOK_ERRORS" -gt 0 ]; then
    echo "🚨 ALERT: $WEBHOOK_ERRORS webhook errors in last 5 minutes"
    # Add your alerting mechanism here (email, Slack, etc.)
fi
```

### High Processing Time Alerts
```bash
#!/bin/bash
# Save as: performance-alerts.sh

render logs --service-id YOUR_BACKEND_SERVICE_ID --since="10m" | \
grep "took.*ms" | \
sed 's/.*took \([0-9]\+\)ms.*/\1/' | \
while read time; do
    if [ "$time" -gt 60000 ]; then  # Alert if > 60 seconds
        echo "🐌 PERFORMANCE ALERT: Processing took ${time}ms"
    fi
done
```

## 8. Integration with Monitoring Scripts

### Combine with Database Monitoring
```bash
# Run database monitoring alongside log tailing
{
    # Terminal process 1: Logs
    render logs --service-id YOUR_BACKEND_SERVICE_ID --tail &
    
    # Terminal process 2: Database monitoring
    npm run tsx scripts/monitor-bulk-ftp-progress.ts -- --live --interval 30 &
    
    wait
}
```

### Service Health Dashboard
```bash
#!/bin/bash
# Save as: service-dashboard.sh

clear
echo "🚀 Zipsea Service Monitor Dashboard"
echo "=================================="

# Service status
echo "📊 Service Status:"
render services list | grep -E "(zipsea|backend)"

echo -e "\n🔄 Recent Activity (last 5 minutes):"
render logs --service-id YOUR_BACKEND_SERVICE_ID --since="5m" | tail -10

echo -e "\n⚠️  Recent Errors (last 30 minutes):"
render logs --service-id YOUR_BACKEND_SERVICE_ID --since="30m" | grep -E "ERROR|FAILED" | tail -5

echo -e "\n📡 Recent Webhooks (last 10 minutes):"
render logs --service-id YOUR_BACKEND_SERVICE_ID --since="10m" | grep webhook | tail -5
```

## 9. Pro Tips

### Persistent Log Monitoring Session
```bash
# Use tmux/screen for persistent sessions
tmux new-session -d -s webhook-monitor 'render logs --service-id YOUR_BACKEND_SERVICE_ID --tail | grep webhook'
tmux new-session -d -s error-monitor 'render logs --service-id YOUR_BACKEND_SERVICE_ID --tail | grep ERROR'

# Attach to sessions
tmux attach-session -t webhook-monitor
tmux attach-session -t error-monitor
```

### Quick Status Checks
```bash
# One-liner to check recent webhook activity
render logs --service-id YOUR_BACKEND_SERVICE_ID --since="1h" | grep -c "webhook.*received" && echo "webhooks received in last hour"

# Check if bulk processing is active
render logs --service-id YOUR_BACKEND_SERVICE_ID --since="30m" | grep -q "bulk.*processing" && echo "✅ Bulk processing active" || echo "❌ No bulk processing detected"
```

Remember to replace `YOUR_BACKEND_SERVICE_ID` with your actual Render service ID, which you can find by running `render services list`.