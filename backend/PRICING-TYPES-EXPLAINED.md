# Traveltek Pricing Structure

## Static Pricing Only

### **Static Pricing** (`data.prices`)
- **What it is**: Pre-negotiated, contracted rates stored in Traveltek's system
- **Update frequency**: Updated periodically via FTP files (daily/weekly)
- **Source field**: `data.prices` in JSON files
- **Characteristics**:
  - Fixed rates that don't change frequently
  - Usually includes bulk/group rates
  - May have special promotional rates
  - Stored for longer periods
  - Good for displaying general pricing

### Note on Live Pricing
We do not have access to live pricing. The `cachedprices` field in FTP files is empty for our account. True live pricing would require direct API credentials with each cruise line, which we don't have.

### 2. **Combined Cheapest** (`data.cheapest.combined`)
- **What it is**: Traveltek's aggregation of the best available static prices
- **Source field**: `data.cheapest.combined`
- **Characteristics**:
  - Best price from static pricing
  - Includes source indicator (e.g., `insidepricecode`)
  - Most reliable for showing "starting from" prices

## Webhook Payloads

Based on our webhook routes, we receive two main types:

### 1. **Cruiseline Pricing Updated**
**Endpoint**: `/api/webhooks/traveltek/cruiseline-pricing-updated`

**When triggered**:
- Bulk price updates for an entire cruise line
- Contract rate changes
- Promotional pricing updates

**Expected payload structure**:
```json
{
  "event_type": "cruiseline_pricing_updated",
  "lineId": 15,  // Cruise line ID
  "timestamp": "2025-08-20T10:30:00Z",
  "priceData": {
    // May contain summary of changes
  }
}
```

**What happens**:
1. Webhook identifies all cruises for that line
2. Re-syncs pricing from FTP for each cruise
3. Updates both static and cached pricing
4. Clears cache for affected cruises

### 2. **Cruises Pricing Updated**
**Endpoint**: `/api/webhooks/traveltek/cruises-pricing-updated`

**When triggered**:
- Pricing updates for specific cruises
- Contract rate changes
- Promotional pricing updates
- Specific cruise price changes

**Expected payload structure**:
```json
{
  "event_type": "cruises_live_pricing_updated",
  "cruiseId": 345235,  // Single cruise
  // OR
  "cruiseIds": [345235, 345236],  // Multiple cruises
  // OR
  "paths": [  // File paths to update
    "/2025/09/15/3496/2052721.json"
  ],
  "timestamp": "2025-08-20T10:30:00Z",
  "priceData": {
    // May contain actual pricing updates
  }
}
```

**What happens**:
1. Updates specific cruise(s) pricing
2. Fetches latest data from FTP
3. Updates pricing tables
4. Takes price history snapshot
5. Clears cache for specific cruises

## Data Flow

```
1. FTP Files (Complete Data)
   ├── Static Pricing (data.prices)
   └── Combined Cheapest (data.cheapest.combined)
        ↓
2. Sync Script Processes
   ├── processDetailedPricing() → static prices
   └── processCombinedCheapest() → best prices
        ↓
3. Database Storage
   ├── pricing table (static prices only)
   └── cheapestPricing table (aggregated best prices)
        ↓
4. Webhooks Trigger Updates
   ├── cruiseline_pricing_updated → bulk refresh
   └── cruises_pricing_updated → specific updates
```

## Pricing Summary

| Aspect | Static Pricing |
|--------|---------------|
| **Source** | `data.prices` |
| **Update Method** | FTP sync, webhooks |
| **Frequency** | Daily/Weekly |
| **Accuracy** | Good for display and booking |
| **Availability** | When configured* |
| **Use Case** | Browse/Search/Book |

*Note: We've seen many cruises with empty `prices` objects, suggesting not all cruises have static pricing configured.

## Implementation in Our System

1. **Sync Script** (`sync-static-only.js`):
   - Processes static pricing only
   - Stores in `pricing` table
   - No distinction between pricing types

2. **Webhooks** (`webhook.service.ts`):
   - Handles both bulk and specific updates
   - Re-fetches from FTP on webhook trigger
   - Maintains price history

3. **Display Logic**:
   - Use `cheapestPricing` for search results
   - All pricing is static from FTP files
   - Suitable for both display and booking