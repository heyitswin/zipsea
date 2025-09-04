# Slack Notification Monitoring Guide

## Overview
ZipSea uses Slack for real-time notifications about webhook processing, bulk FTP operations, and system alerts. This guide shows you how to monitor and track these notifications.

## 1. Slack Channels Setup

### Primary Monitoring Channels
```
#zipsea-webhooks     - Webhook reception and processing notifications
#zipsea-alerts       - System alerts and errors
#zipsea-processing   - Bulk FTP processing status updates
#zipsea-admin        - Admin dashboard notifications
```

### Notification Types You'll See

#### 🚀 Webhook Notifications
```
🚀 Webhook Processing Started
Line ID: 643 | Event: cruiseline_pricing_updated
Job ID: webhook_1701234567890_abc123
Processing Mode: realtime_parallel

📊 Webhook Processing Complete
Line ID: 643 | Success: 245 cruises | Failed: 3 cruises
Processing Time: 15.2s | FTP Files: 12 downloaded
Job ID: webhook_1701234567890_abc123
```

#### 📥 Bulk Processing Notifications
```
📥 Bulk FTP Processing Started
Line ID: 643 | Ships: 3 | Expected Files: ~50
Triggered by: webhook_1701234567890_abc123
Processing with parallel workers

✅ Bulk Processing Completed
Line ID: 643 | Processed: 247/250 cruises (98.8%)
Success: 245 | Failed: 2 | Duration: 18.3s
Files Downloaded: 48/50 | FTP Errors: 2
```

#### ⚠️ Alert Notifications
```
⚠️ System Alert - High Processing Time
Webhook processing took 45.6s (threshold: 30s)
Line ID: 21 | Job ID: webhook_1701234567890_def456
Check FTP connection and server load

🚨 Critical Alert - Queue Backlog
Redis bulk queue has 25 jobs waiting (threshold: 10)
Consider scaling workers or investigating bottlenecks
```

## 2. Monitoring Slack Notifications

### Desktop/Mobile App
- **Enable push notifications** for monitoring channels
- **Set custom notification sounds** for alert channels
- **Use thread replies** to track resolution of issues
- **Pin important status messages** for quick reference

### Slack Search Commands

#### Find Recent Webhook Activity
```
in:#zipsea-webhooks after:today "Line 643"
in:#zipsea-webhooks after:2023-12-01 "webhook processing"
in:#zipsea-webhooks "failed" after:today
```

#### Track Processing Results
```
in:#zipsea-processing "Bulk Processing Completed" after:today
in:#zipsea-processing "Line 643" after:2023-12-01
in:#zipsea-processing "Duration:" after:today
```

#### Monitor Alerts and Errors
```
in:#zipsea-alerts after:today
in:#zipsea-alerts "Critical Alert" after:2023-12-01
in:#zipsea-alerts "High Processing Time" after:today
```

### Advanced Search Patterns
```
# Find all webhook failures today
in:#zipsea-webhooks "Failed:" -"Failed: 0" after:today

# Track specific job processing
"webhook_1701234567890_abc123" in:#zipsea-webhooks OR in:#zipsea-processing

# Monitor FTP connection issues
"FTP" "error" OR "connection" "failed" after:today

# Find high-volume processing days
in:#zipsea-processing "Success:" from:@slackbot after:2023-12-01
```

## 3. Setting Up Slack Alerts

### Custom Slack Bot Setup
If you want additional monitoring, create a Slack app with these webhooks:

```javascript
// Webhook monitoring bot
const webhookUrl = 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK';

// Custom alert for failed webhooks
fetch(webhookUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: '🚨 Webhook Failure Alert',
    attachments: [{
      color: 'danger',
      fields: [
        { title: 'Line ID', value: '643', short: true },
        { title: 'Failed Count', value: '15', short: true },
        { title: 'Error Rate', value: '25%', short: true },
        { title: 'Action', value: 'Investigation required', short: false }
      ]
    }]
  })
});
```

### Slack Workflow Builder Automation
Create automated workflows for common scenarios:

1. **High Error Rate Alert**
   - Trigger: When message contains "Failed:" with number > 10
   - Action: Create incident in project management tool
   - Notify: @channel in #zipsea-alerts

2. **Processing Time Alert**
   - Trigger: When message contains "Duration:" with time > 30s
   - Action: Add ⚠️ reaction to message
   - Notify: Send DM to on-call engineer

3. **Success Summary**
   - Trigger: Daily at 6 PM
   - Action: Post summary of day's webhook activity
   - Format: Total processed, success rate, average time

## 4. Slack Integration Commands

### Using Slack API to Query Notifications
```bash
# Get recent messages from webhook channel
curl -X GET "https://slack.com/api/conversations.history" \
  -H "Authorization: Bearer YOUR_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "channel=C1234567890&limit=50"

# Search for specific patterns
curl -X GET "https://slack.com/api/search.messages" \
  -H "Authorization: Bearer YOUR_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "query=in:#zipsea-webhooks Line 643 after:today"
```

### Slack CLI for Monitoring
```bash
# Install Slack CLI
npm install -g @slack/cli

# Get recent webhook notifications
slack api conversations.history --channel C1234567890 --limit 20 | jq '.messages[] | select(.text | contains("webhook")) | .text'

# Count today's successful processing
slack api search.messages --query "in:#zipsea-processing Success after:today" | jq '.messages.matches | length'
```

## 5. Custom Notification Monitoring

### Browser Extension for Slack
Create a simple browser extension to monitor specific patterns:

```javascript
// Monitor for critical alerts
const observer = new MutationObserver(() => {
  const messages = document.querySelectorAll('[data-qa="message_content"]');
  messages.forEach(msg => {
    if (msg.textContent.includes('🚨 Critical Alert')) {
      // Play custom sound or show desktop notification
      new Notification('Critical ZipSea Alert', {
        body: msg.textContent,
        icon: '/favicon.ico'
      });
    }
  });
});

observer.observe(document.body, { 
  childList: true, 
  subtree: true 
});
```

### Desktop Notification Script
```bash
#!/bin/bash
# slack-monitor.sh - Monitor Slack for critical alerts

WEBHOOK_URL="YOUR_SLACK_WEBHOOK_URL"
LAST_CHECK_FILE="/tmp/slack_last_check"

# Get timestamp of last check
if [ -f "$LAST_CHECK_FILE" ]; then
    LAST_CHECK=$(cat "$LAST_CHECK_FILE")
else
    LAST_CHECK=$(date -d "1 hour ago" "+%s")
fi

# Search for critical alerts since last check
ALERTS=$(curl -s -X GET "https://slack.com/api/search.messages" \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -d "query=in:#zipsea-alerts 🚨 after:$(date -d @$LAST_CHECK '+%Y-%m-%d')" | \
  jq -r '.messages.matches | length')

if [ "$ALERTS" -gt 0 ]; then
    echo "🚨 $ALERTS new critical alerts found!"
    # Send system notification
    osascript -e "display notification \"$ALERTS critical alerts\" with title \"ZipSea Monitor\""
fi

# Update last check time
echo $(date "+%s") > "$LAST_CHECK_FILE"
```

## 6. Notification Patterns to Watch

### ✅ Good Patterns (Normal Operation)
```
✅ Bulk Processing Completed - Line 643 | Success: 245 | Failed: 0 | Duration: 12.3s
📊 Webhook Processing Complete - Line 21 | Success: 156 | Failed: 1 | Duration: 8.7s
💰 Price Updates Applied - 1,247 cruises updated with new pricing
```

### ⚠️ Warning Patterns (Needs Attention)
```
⚠️ High Processing Time - Duration: 35.6s (threshold: 30s)
⚠️ Partial Processing - Line 643 | Success: 180 | Failed: 65 | Error Rate: 26.5%
⚠️ FTP Connection Slow - Download speed: 45KB/s (expected: >100KB/s)
```

### 🚨 Critical Patterns (Immediate Action)
```
🚨 Critical Alert - Queue Backlog: 25 jobs waiting
🚨 Processing Failed - Line 643 | All 247 cruises failed | FTP timeout
🚨 System Health Alert - Redis connection lost
🚨 Database Connection Error - Cannot update cruise pricing
```

## 7. Response Workflows

### For Webhook Failures
1. **Check the notification thread** for error details
2. **Search logs** using the provided Job ID
3. **Run database query** to check cruise update status
4. **Reply in thread** with findings and actions taken

### For Processing Delays
1. **Check Redis queue status** in monitoring dashboard
2. **Verify FTP server connectivity** 
3. **Monitor resource usage** on Render
4. **Scale workers** if needed

### For Critical Alerts
1. **Acknowledge in Slack** with 👀 emoji
2. **Start incident response** process
3. **Gather system metrics** from monitoring tools
4. **Post regular updates** in thread until resolved

## 8. Slack Integration with Monitoring Scripts

### Auto-respond to Notifications
```javascript
// slack-auto-responder.js
const { WebClient } = require('@slack/web-api');

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

// Monitor for specific patterns and auto-respond
setInterval(async () => {
  const messages = await slack.conversations.history({
    channel: 'C1234567890', // #zipsea-alerts
    oldest: (Date.now() - 300000) / 1000 // Last 5 minutes
  });

  for (const message of messages.messages) {
    if (message.text.includes('🚨 Critical Alert') && !message.reactions) {
      await slack.reactions.add({
        channel: 'C1234567890',
        timestamp: message.ts,
        name: 'eyes'
      });
      
      await slack.chat.postMessage({
        channel: 'C1234567890',
        thread_ts: message.ts,
        text: '🤖 Alert acknowledged. Investigating...'
      });
    }
  }
}, 60000); // Check every minute
```

### Slack Status Dashboard
```bash
#!/bin/bash
# slack-status.sh - Post daily status summary

TODAY_WEBHOOKS=$(slack api search.messages --query "in:#zipsea-webhooks after:today" | jq '.messages.matches | length')
TODAY_SUCCESSES=$(slack api search.messages --query "in:#zipsea-processing Success after:today" | jq '.messages.matches | length')
TODAY_ALERTS=$(slack api search.messages --query "in:#zipsea-alerts after:today" | jq '.messages.matches | length')

slack chat post-message --channel "#zipsea-admin" --text "
📊 Daily Status Summary - $(date)
🚀 Webhooks Processed: $TODAY_WEBHOOKS
✅ Successful Operations: $TODAY_SUCCESSES  
⚠️ Alerts Generated: $TODAY_ALERTS
"
```

## 9. Mobile Monitoring

### Slack Mobile App Settings
- **Enable notifications** for monitoring channels
- **Set VIP keywords**: "Critical Alert", "Failed", "Error"
- **Create custom notification sounds** for different alert types
- **Use Slack workflows** to send SMS for critical alerts

### IFTTT Integration
Create IFTTT applets for mobile alerts:

1. **Trigger**: New message in #zipsea-alerts containing "🚨"
2. **Action**: Send SMS notification
3. **Message**: "ZipSea Critical Alert: {{MessageText}}"

## 10. Best Practices

### Channel Management
- **Keep channels focused** - separate channels for different types of notifications
- **Archive old threads** to reduce noise
- **Pin important messages** like system status and runbooks
- **Use thread replies** for follow-up discussions

### Notification Hygiene
- **Don't spam channels** - batch similar notifications
- **Use appropriate urgency levels** - reserve @channel for true emergencies
- **Provide context** in notifications (job IDs, timestamps, affected systems)
- **Follow up** on alerts with resolution updates

### Monitoring Workflow
1. **Set up dedicated monitoring time** - check channels every 15-30 minutes during business hours
2. **Create alert escalation paths** - define who to notify for different types of issues
3. **Document common issues** - build a knowledge base of solutions
4. **Track metrics** - monitor notification volume and response times

Remember to regularly review and update your Slack monitoring setup as the system evolves and new notification patterns emerge.