# Traveltek Webhook Payload Examples

## Overview
Traveltek sends webhook notifications when cruise pricing data is updated. Your webhook endpoint must:
- Accept POST requests
- Return HTTP 200 OK status
- Process payloads asynchronously (webhooks don't retry on failure)

## Webhook Types

### 1. Static Pricing Update Webhook

**Event Type:** `cruiseline_pricing_updated`

**When Triggered:** Daily when static pricing data is updated for a cruise line

**Action Required:** Pull all JSON files for the specified cruise line (`lineid`)

#### Example Payload:
```json
{
  "currency": "GBP",
  "description": "Cruiseline pricing data updated for marketid 0 in currency GBP",
  "event": "cruiseline_pricing_updated",
  "lineid": 7,
  "marketid": 0,
  "source": "json_cruise_export",
  "timestamp": 1747822246
}
```

#### Field Descriptions:
- `currency`: The currency code for this market (e.g., "GBP", "USD", "EUR")
- `description`: Human-readable description of the update event
- `event`: Always "cruiseline_pricing_updated" for static pricing updates
- `lineid`: The cruise line ID that was updated (e.g., 7 for Norwegian)
- `marketid`: The market identifier (0 for default market)
- `source`: Always "json_cruise_export"
- `timestamp`: Unix timestamp of when the update occurred

#### Processing Logic:
```javascript
async function handleStaticPricingUpdate(payload) {
  const { lineid, currency, marketid, timestamp } = payload;
  
  // 1. Queue job to download all files for this cruise line
  await queueJob('download_cruise_line', {
    lineId: lineid,
    currency: currency,
    marketId: marketid,
    updateTime: new Date(timestamp * 1000)
  });
  
  // 2. Return immediately with 200 OK
  return { status: 200, message: 'Webhook received' };
}
```

### 2. Live Pricing Update Webhook

**Event Type:** `cruises_live_pricing_updated`

**When Triggered:** When cached live pricing is updated for specific cruises (within 1-day TTL)

**Action Required:** Pull only the specific JSON files listed in the `paths` array

#### Example Payload:
```json
{
  "currency": "GBP",
  "description": "Cruises with updated cached live pricing for marketid 0 in currency GBP",
  "event": "cruises_live_pricing_updated",
  "marketid": 0,
  "source": "json_cruise_export",
  "timestamp": 1747822246,
  "paths": [
    "2025/05/7/231/8734921.json",
    "2025/05/17/103/1999046.json",
    "2025/06/2/45/2194550.json",
    "2025/07/7/231/8734922.json",
    "2025/08/15/55/2234567.json"
  ]
}
```

#### Field Descriptions:
- `currency`: The currency code for this market
- `description`: Human-readable description of the update
- `event`: Always "cruises_live_pricing_updated" for live pricing updates
- `marketid`: The market identifier
- `source`: Always "json_cruise_export"
- `timestamp`: Unix timestamp of when the update occurred
- `paths`: Array of FTP file paths that have updated live pricing

#### Path Format:
Each path follows the pattern: `[year]/[month]/[lineid]/[shipid]/[codetocruiseid].json`

Example breakdown of `"2025/05/7/231/8734921.json"`:
- Year: 2025
- Month: 05 (May)
- Line ID: 7 (Norwegian Cruise Line)
- Ship ID: 231 (Norwegian Gem)
- Cruise ID: 8734921

#### Processing Logic:
```javascript
async function handleLivePricingUpdate(payload) {
  const { paths, currency, marketid, timestamp } = payload;
  
  // 1. Queue individual download jobs for each file
  for (const path of paths) {
    await queueJob('download_cruise_file', {
      filePath: path,
      currency: currency,
      marketId: marketid,
      updateTime: new Date(timestamp * 1000),
      priceType: 'live'
    });
  }
  
  // 2. Return immediately with 200 OK
  return { status: 200, message: 'Webhook received' };
}
```

## Complete Webhook Handler Example

```javascript
const express = require('express');
const router = express.Router();

// Main webhook endpoint
router.post('/api/webhooks/traveltek', async (req, res) => {
  try {
    const payload = req.body;
    
    // Log webhook receipt
    console.log('Traveltek webhook received:', {
      event: payload.event,
      timestamp: new Date(payload.timestamp * 1000),
      currency: payload.currency,
      marketid: payload.marketid
    });
    
    // Process based on event type
    switch (payload.event) {
      case 'cruiseline_pricing_updated':
        await handleStaticPricingUpdate(payload);
        break;
        
      case 'cruises_live_pricing_updated':
        await handleLivePricingUpdate(payload);
        break;
        
      default:
        console.warn('Unknown webhook event:', payload.event);
    }
    
    // Always return 200 OK immediately
    res.status(200).json({ status: 'received' });
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    // Still return 200 to prevent retries
    res.status(200).json({ status: 'error logged' });
  }
});

async function handleStaticPricingUpdate(payload) {
  // Queue background job to download all files for cruise line
  await jobQueue.add('sync-cruise-line', {
    type: 'static_pricing_update',
    lineId: payload.lineid,
    currency: payload.currency,
    marketId: payload.marketid,
    timestamp: payload.timestamp
  });
}

async function handleLivePricingUpdate(payload) {
  // Queue background jobs for specific file downloads
  const jobs = payload.paths.map(path => ({
    type: 'live_pricing_update',
    filePath: path,
    currency: payload.currency,
    marketId: payload.marketid,
    timestamp: payload.timestamp
  }));
  
  await jobQueue.addBulk('sync-cruise-file', jobs);
}
```

## Testing Webhooks

### Test Static Pricing Update:
```bash
curl -X POST https://your-domain.com/api/webhooks/traveltek \
  -H "Content-Type: application/json" \
  -d '{
    "currency": "USD",
    "description": "Cruiseline pricing data updated for marketid 1 in currency USD",
    "event": "cruiseline_pricing_updated",
    "lineid": 7,
    "marketid": 1,
    "source": "json_cruise_export",
    "timestamp": 1747822246
  }'
```

### Test Live Pricing Update:
```bash
curl -X POST https://your-domain.com/api/webhooks/traveltek \
  -H "Content-Type: application/json" \
  -d '{
    "currency": "USD",
    "description": "Cruises with updated cached live pricing for marketid 1 in currency USD",
    "event": "cruises_live_pricing_updated",
    "marketid": 1,
    "source": "json_cruise_export",
    "timestamp": 1747822246,
    "paths": [
      "2025/05/7/231/8734921.json",
      "2025/05/17/103/1999046.json"
    ]
  }'
```

## Important Notes

1. **No Retry Mechanism:** Traveltek does not retry failed webhook deliveries. Ensure your endpoint is highly available.

2. **Asynchronous Processing:** Always queue webhook payloads for background processing and return 200 immediately.

3. **Idempotency:** Your processing should be idempotent as you may receive duplicate webhooks.

4. **Validation:** Consider implementing webhook signature validation if Traveltek provides this feature.

5. **Monitoring:** Set up alerting for:
   - Webhook endpoint downtime
   - Processing queue backlogs
   - FTP download failures
   - Data sync discrepancies

6. **Fallback Strategy:** Implement a daily full sync as a fallback in case webhooks are missed.

## File Download Strategy After Webhook

### For Static Pricing Updates:
```javascript
async function downloadCruiseLineFiles(lineId, marketId) {
  const ftpClient = await connectToFTP();
  
  // Get current year/month for scanning
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  // Scan directories for this cruise line
  for (let year = currentYear; year <= currentYear + 1; year++) {
    for (let month = 1; month <= 12; month++) {
      const path = `${year}/${month}/${lineId}`;
      
      try {
        const shipDirs = await ftpClient.list(path);
        
        for (const shipDir of shipDirs) {
          const shipPath = `${path}/${shipDir.name}`;
          const cruiseFiles = await ftpClient.list(shipPath);
          
          for (const file of cruiseFiles) {
            if (file.name.endsWith('.json')) {
              await downloadAndProcessFile(`${shipPath}/${file.name}`);
            }
          }
        }
      } catch (error) {
        // Directory might not exist for future months
        console.log(`No data for ${path}`);
      }
    }
  }
}
```

### For Live Pricing Updates:
```javascript
async function downloadSpecificFiles(paths) {
  const ftpClient = await connectToFTP();
  
  for (const path of paths) {
    try {
      const fileContent = await ftpClient.get(path);
      await processLivePricingUpdate(path, fileContent);
    } catch (error) {
      console.error(`Failed to download ${path}:`, error);
      // Queue for retry
      await queueRetry(path);
    }
  }
}
```