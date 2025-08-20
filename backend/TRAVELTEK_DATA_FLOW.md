# Traveltek Data Flow Verification

## 1. ✅ Webhook Tells Us Which Cruise Lines Have New Data

**CONFIRMED**: The webhook service correctly handles this:

### Webhook Event Types:
1. **`cruiseline_pricing_updated`** - Entire cruise line has updates
   - Payload includes `lineid` 
   - System fetches ALL cruises for that line
   - Updates each cruise's pricing from FTP

2. **`cruises_pricing_updated`** - Specific cruises updated
   - Payload includes `paths` array (e.g., `["2025/05/7/231/8734921.json"]`)
   - System fetches ONLY those specific files
   - Updates only affected cruises

### Current Implementation:
```javascript
// When cruiseline_pricing_updated webhook arrives:
1. Get all active cruises for lineId
2. For each cruise, fetch its file from FTP
3. Update pricing in database

// When cruises_pricing_updated webhook arrives:
1. Parse the paths array
2. Fetch only those specific files
3. Update only those cruises
```

## 2. ✅ We Only Pull Files From FTP That Changed

**CONFIRMED**: The system is designed for selective sync:

- Webhook service (`webhook.service.ts`) calls `updateCruisePricing()` only for affected cruises
- Uses `traveltekFTPService.getCruiseDataFile(filePath)` to fetch specific files
- Does NOT do full directory scans when webhook fires
- Only pulls files mentioned in webhook payload

### Efficiency:
- Batch processing (10 cruises at a time)
- Small delays between batches to prevent overload
- Caching cleared only for affected cruises

## 3. ❌ Historical Price Snapshots - NOT IMPLEMENTED

**MISSING**: No price history table exists currently

### Current State:
- Pricing table has `updatedAt` timestamp
- But prices are OVERWRITTEN on each update
- No historical tracking

### What's Needed:
```sql
-- New table for price history
CREATE TABLE price_history (
  id UUID PRIMARY KEY,
  cruise_id INTEGER REFERENCES cruises(id),
  cabin_code VARCHAR(10),
  rate_code VARCHAR(50),
  occupancy_code VARCHAR(10),
  base_price DECIMAL(10,2),
  taxes DECIMAL(10,2),
  total_price DECIMAL(10,2),
  snapshot_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for efficient queries
CREATE INDEX idx_price_history_cruise_date 
  ON price_history(cruise_id, snapshot_date DESC);
```

### Implementation Needed:
1. Create `price_history` table
2. Before updating prices, INSERT current prices into history
3. Add API endpoint to query historical trends
4. Consider retention policy (e.g., keep 90 days of history)

## 4. ✅ New Data is Logged and Servable

**CONFIRMED**: Complete logging and serving pipeline:

### Logging:
- Every webhook event logged with payload
- FTP operations logged
- Price updates logged with cruise ID
- Errors logged with full stack traces

### Data Serving:
- **Search API**: `/api/v1/search` - Returns cruises with current prices
- **Cruise Details**: `/api/v1/cruises/:id` - Full cruise information
- **Pricing API**: `/api/v1/cruises/:id/pricing` - Detailed cabin pricing
- **Filters API**: `/api/v1/search/filters` - Dynamic filters based on data

### Cache Management:
- Search results cached for 30 minutes
- Cruise details cached for 1 hour  
- Pricing cached for 15 minutes
- Cache cleared when webhook updates arrive

## Current Data Flow

```
1. WEBHOOK RECEIVED
   ↓
2. IDENTIFY AFFECTED CRUISES
   - cruiseline_pricing_updated → All cruises in line
   - cruises_pricing_updated → Specific file paths
   ↓
3. SELECTIVE FTP FETCH
   - Only download affected files
   - Parse JSON data
   ↓
4. DATABASE UPDATE
   - Update cruise metadata
   - Update pricing (OVERWRITES current)
   - Update cheapest_pricing for search
   ↓
5. CACHE INVALIDATION
   - Clear affected cruise caches
   - Clear search cache if needed
   ↓
6. DATA AVAILABLE
   - Search API returns updated prices
   - Detail endpoints show new data
```

## Recommendations

### 1. Implement Price History (Priority: HIGH)
```typescript
// Add to data-sync.service.ts
async savePriceSnapshot(cruiseId: number, pricingData: any) {
  // Save current prices to history before updating
  await db.insert(priceHistory).values({
    cruiseId,
    cabinCode: pricingData.cabinCode,
    basePrice: pricingData.basePrice,
    snapshotDate: new Date()
  });
}
```

### 2. Add Historical Price API
```typescript
// New endpoint: GET /api/v1/cruises/:id/price-history
{
  "cruiseId": 123,
  "history": [
    {
      "date": "2024-12-20",
      "interior": 599,
      "balcony": 899
    },
    {
      "date": "2024-12-19", 
      "interior": 649,
      "balcony": 949
    }
  ],
  "trend": "decreasing"
}
```

### 3. Monitor Webhook Patterns
- Log frequency of updates per cruise line
- Identify peak update times
- Optimize batch sizes based on patterns

## Summary

✅ **Working Well:**
- Webhook-driven selective sync
- Only fetching changed files
- Data properly logged and served
- Efficient cache management

❌ **Needs Implementation:**
- Historical price tracking
- Price trend analysis
- Long-term data retention

The system is well-architected for selective updates. The main missing piece is historical price tracking, which would be valuable for:
- Showing price trends to users
- Identifying booking patterns
- Optimizing pricing strategies
- Providing "price drop" alerts