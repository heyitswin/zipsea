# Traveltek Webhook Implementation

## Overview
We only use the **static pricing webhook** (`cruiseline_pricing_updated`) from Traveltek. The live pricing webhook is not used.

## Webhook Configuration in iSell

Configure your webhook URL in the iSell platform:
```
https://zipsea-backend.onrender.com/api/webhook/traveltek
```

## Static Pricing Webhook

### Event Type: `cruiseline_pricing_updated`

This webhook is sent when static pricing data is updated for a cruise line. You should pull all files for that cruise line when this webhook is received.

### Expected Payload:
```json
{
  "event": "cruiseline_pricing_updated",
  "lineid": 123,
  "marketid": 0,
  "currency": "GBP",
  "description": "Cruiseline pricing data updated for marketid 0 in currency GBP",
  "source": "json_cruise_export",
  "timestamp": 1747822246
}
```

### Processing Flow:

1. **Webhook Received**: Endpoint immediately returns HTTP 200 to acknowledge
2. **Background Processing**: 
   - Creates price snapshots for all cruises in the line (before update)
   - Downloads updated JSON files from FTP for the cruise line
   - Updates static pricing data in database
   - Creates price snapshots (after update)
   - Marks webhook as processed

3. **Price Snapshots**: Every update creates before/after snapshots for:
   - Cheapest prices by cabin type
   - Full static pricing data
   - Audit trail of changes

## Database Tables

### webhook_events
Tracks all received webhooks:
- `event_type`: 'cruiseline_pricing_updated'
- `line_id`: Cruise line that was updated
- `processed`: Boolean flag
- `timestamp`: Unix timestamp from webhook

### price_snapshots
Stores price history:
- `snapshot_type`: 'before_update' or 'after_update'
- `webhook_event_id`: Links to webhook event
- Full pricing data in JSONB format

## API Endpoints

### Receive Webhook
```
POST /api/webhook/traveltek
```
Returns immediately with HTTP 200 to prevent timeouts.

### Check Status
```
GET /api/webhook/traveltek/status
```
Returns webhook processing statistics and recent events.

### Test Webhook
```
POST /api/webhook/traveltek/test
```
Sends a test webhook for debugging.

## Important Notes

1. **We only process static pricing webhooks** - Live pricing webhooks are acknowledged but not processed
2. **Always return HTTP 200** - Even on errors, to prevent Traveltek retry attempts
3. **Processing is asynchronous** - Webhook returns immediately, processing happens in background
4. **No retry mechanism from Traveltek** - If we fail to process, we need to manually resync
5. **Price snapshots are automatic** - Every update creates before/after snapshots

## Testing

Test the webhook locally:
```bash
curl -X POST http://localhost:3000/api/webhook/traveltek \
  -H "Content-Type: application/json" \
  -d '{
    "event": "cruiseline_pricing_updated",
    "lineid": 7,
    "marketid": 0,
    "currency": "USD",
    "description": "Test webhook",
    "source": "json_cruise_export",
    "timestamp": 1747822246
  }'
```

Check webhook status:
```bash
curl http://localhost:3000/api/webhook/traveltek/status
```

## Monitoring

Monitor webhook processing:
```sql
-- Recent webhooks
SELECT * FROM webhook_events 
ORDER BY created_at DESC 
LIMIT 10;

-- Processing stats
SELECT 
  COUNT(*) FILTER (WHERE processed = true) as processed,
  COUNT(*) FILTER (WHERE processed = false) as pending,
  COUNT(*) as total
FROM webhook_events
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';

-- Price changes
SELECT 
  ps1.cruise_id,
  ps1.created_at,
  ps1.cheapest_price as before,
  ps2.cheapest_price as after,
  ps2.cheapest_price - ps1.cheapest_price as change
FROM price_snapshots ps1
JOIN price_snapshots ps2 ON ps1.webhook_event_id = ps2.webhook_event_id
WHERE ps1.snapshot_type = 'before_update'
  AND ps2.snapshot_type = 'after_update'
ORDER BY ps1.created_at DESC
LIMIT 20;
```