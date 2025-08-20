# Slack Integration for Traveltek Webhooks

## Overview
Get human-readable notifications in Slack whenever Traveltek sends webhook updates about cruise pricing, availability, or other changes.

## Setup Instructions

### 1. Create Slack Webhook

1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Name it "Traveltek Updates" and select your workspace
4. Go to "Incoming Webhooks" in the left sidebar
5. Toggle "Activate Incoming Webhooks" to ON
6. Click "Add New Webhook to Workspace"
7. Select the channel where you want notifications (e.g., #cruise-updates)
8. Copy the Webhook URL (looks like: https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX)

### 2. Configure in Render

Add the webhook URL to your environment variables:

**Staging:**
1. Go to Render Dashboard → zipsea-backend-staging → Environment
2. Add: `SLACK_WEBHOOK_URL` = [your webhook URL]

**Production:**
1. Go to Render Dashboard → zipsea-backend-production → Environment
2. Add: `SLACK_WEBHOOK_URL` = [your webhook URL]

### 3. Test the Integration

After deployment, test with:

```bash
curl -X POST https://zipsea-production.onrender.com/api/v1/admin/slack/test \
  -H "Content-Type: application/json"
```

## What Gets Notified

### 📊 Cruise Line Pricing Updates
When an entire cruise line's prices are updated:
- Shows cruise line name and number of cruises
- Update status (successful/failed counts)
- Timestamp

### 💰 Live Pricing Updates
When specific cruises get price updates:
- Lists affected cruises with details
- Shows cruise name, line, ship, nights, and departure date
- Update status

### 🛏️ Availability Changes
When cabin availability changes:
- Shows cruise details
- Indicates availability status

### 📈 Daily Summary (Optional)
Can be configured to send daily summaries:
- Total updates received
- New cruises added
- Most active cruise lines
- Error summary

## Notification Examples

### Cruise Line Update
```
📊 Cruise Line Pricing Update
─────────────────────────────
Cruise Line: Royal Caribbean (142 cruises)
Update Status:
✅ 138 successful
❌ 4 failed

🕒 12:34 PM ET | Event: cruiseline_pricing_updated
```

### Live Pricing Update
```
💰 Live Pricing Update
──────────────────────
3 cruises updated

Northern Europe And Scandinavia
Royal Caribbean - Symphony of the Seas
14 nights departing 2025-12-03

Caribbean Paradise
Royal Caribbean - Wonder of the Seas
7 nights departing 2025-12-15

Mediterranean Journey
Royal Caribbean - Harmony of the Seas
10 nights departing 2025-12-20

Update Status:
✅ 3 successful
❌ 0 failed

🕒 2:45 PM ET | Event: cruises_live_pricing_updated
```

## Customization

You can customize notifications by modifying `src/services/slack.service.ts`:

- Change message formatting
- Add/remove fields
- Adjust which events trigger notifications
- Set thresholds (e.g., only notify if >10 cruises updated)

## Troubleshooting

### Not Receiving Notifications?

1. Check environment variable is set:
```bash
# In Render shell
echo $SLACK_WEBHOOK_URL
```

2. Check logs for errors:
```bash
# Look for "Failed to send Slack notification" in Render logs
```

3. Test webhook directly:
```bash
curl -X POST $SLACK_WEBHOOK_URL \
  -H 'Content-Type: application/json' \
  -d '{"text":"Test message from Zipsea"}'
```

### Rate Limits

Slack incoming webhooks have a rate limit of 1 message per second. The service handles this automatically by:
- Batching updates when possible
- Summarizing multiple cruise updates
- Using daily summaries for high-volume periods

## Advanced Features

### Filtering Notifications

Add these environment variables to control what gets sent:

- `SLACK_MIN_CRUISES_FOR_NOTIFICATION=5` - Only notify if 5+ cruises updated
- `SLACK_NOTIFY_ERRORS_ONLY=true` - Only send notifications for errors
- `SLACK_QUIET_HOURS=22:00-08:00` - No notifications during these hours (EST)

### Multiple Channels

To send different types of updates to different channels:

1. Create multiple webhooks for different channels
2. Add multiple environment variables:
   - `SLACK_PRICING_WEBHOOK_URL` - For pricing updates
   - `SLACK_AVAILABILITY_WEBHOOK_URL` - For availability
   - `SLACK_ERRORS_WEBHOOK_URL` - For errors only

## Security Notes

- Never commit Slack webhook URLs to git
- Webhook URLs are sensitive - treat them like passwords
- Rotate webhooks periodically
- Use private channels for sensitive business data

## Support

For issues or questions:
- Check Render logs for error messages
- Verify webhook URL is correct and active
- Ensure Slack app has permissions for the channel
- Test with the `/api/v1/admin/slack/test` endpoint