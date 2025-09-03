# Pricing Data Discrepancy - Root Cause & Solution

## 🔍 Investigation Summary

I have identified the root cause of the pricing discrepancy between FTP files and the database for cruise 2111828. The issue is multi-faceted:

### Primary Issues Discovered:

1. **Critical Database Bug**: The webhook service attempts to INSERT into `cheapest_prices` table, but the actual table is `cheapest_pricing`
2. **Inconsistent Field Extraction**: Different sync services use different methods to extract pricing from FTP JSON files
3. **Missing Fallback Logic**: Services don't fall back to alternative pricing sources when primary fields are null
4. **Outdated Field Mappings**: The FTP JSON structure has evolved, but sync services haven't been updated

## 🧩 Technical Analysis

### Current Pricing Extraction Methods:

| Service | Method | Fields Used | Status |
|---------|--------|-------------|---------|
| `data-sync.service.ts` | Direct cheapest | `cheapestinside`, `cheapestoutside`, etc. | ❌ Often null |
| `price-sync-batch-v5.service.ts` | Direct cheapest | `cheapestinside`, `cheapestoutside`, etc. | ❌ Often null |
| `ftp-comprehensive-sync.service.ts` | Direct cheapest | `cheapestinside`, `cheapestoutside`, etc. | ❌ Often null |
| `traveltek-webhook.service.ts` | Combined approach | `cheapest.combined`, `cheapest.prices`, etc. | ❌ Wrong table name |

### Sample Data Analysis:
From `sample-traveltek-cruise.json`:
- `cheapestinside`: `null` ❌
- `cheapestoutside`: `null` ❌  
- `cheapestbalcony`: `null` ❌
- `cheapestsuite`: `null` ❌
- `cheapest.combined.balcony`: `null` ❌
- `cheapest.prices.outside`: `null` ❌

**This explains why the batch sync produces null prices!**

## 🎯 Solution Implementation

### 1. URGENT: Fix Webhook Service Table Bug

**File:** `/Users/winlin/Desktop/sites/zipsea/backend/src/services/traveltek-webhook.service.ts`
**Line:** 921

**Change:**
```diff
- INSERT INTO cheapest_prices (
+ INSERT INTO cheapest_pricing (
```

**Column Mapping Fix:**
The webhook service uses completely wrong column names. The correct mapping is:

| Wrong Column | Correct Column |
|--------------|----------------|
| `static_inside` | `interior_price` |
| `static_outside` | `oceanview_price` |
| `static_balcony` | `balcony_price` |
| `static_suite` | `suite_price` |
| `combined_inside` | Should map to `interior_price` as fallback |
| `combined_outside` | Should map to `oceanview_price` as fallback |

### 2. HIGH: Add Fallback Logic to Batch Sync Services

**Services to Update:**
- `price-sync-batch-v5.service.ts` (lines 328-331)
- `ftp-comprehensive-sync.service.ts` (lines 308-311)  
- `data-sync.service.ts` (lines 553-586)

**Enhanced Extraction Logic:**
```typescript
const extractPricing = (data: any) => {
  // Method 1: Direct fields (current approach)
  let prices = {
    interior: parseFloat(data.cheapestinside) || null,
    oceanview: parseFloat(data.cheapestoutside) || null,
    balcony: parseFloat(data.cheapestbalcony) || null,
    suite: parseFloat(data.cheapestsuite) || null
  };
  
  // Method 2: Fallback to cheapest.combined
  if (!hasValidPrices(prices) && data.cheapest?.combined) {
    const combined = data.cheapest.combined;
    prices = {
      interior: parseFloat(combined.inside) || prices.interior,
      oceanview: parseFloat(combined.outside) || prices.oceanview,
      balcony: parseFloat(combined.balcony) || prices.balcony,
      suite: parseFloat(combined.suite) || prices.suite
    };
  }
  
  // Method 3: Fallback to cheapest.prices
  if (!hasValidPrices(prices) && data.cheapest?.prices) {
    const staticPrices = data.cheapest.prices;
    prices = {
      interior: parseFloat(staticPrices.inside) || prices.interior,
      oceanview: parseFloat(staticPrices.outside) || prices.oceanview,
      balcony: parseFloat(staticPrices.balcony) || prices.balcony,
      suite: parseFloat(staticPrices.suite) || prices.suite
    };
  }
  
  // Method 4: Calculate from prices object (ultimate fallback)
  if (!hasValidPrices(prices) && data.prices) {
    prices = calculateFromPricesObject(data.prices);
  }
  
  return prices;
};

const hasValidPrices = (prices: any) => {
  return prices.interior || prices.oceanview || prices.balcony || prices.suite;
};
```

### 3. MEDIUM: Implement prices Object Calculation

For the ultimate fallback, implement calculation from the detailed `prices` object:

```typescript
const calculateFromPricesObject = (pricesObj: any) => {
  const categories = { interior: [], oceanview: [], balcony: [], suite: [] };
  
  for (const [rateCode, rateCabins] of Object.entries(pricesObj)) {
    for (const [cabinCode, priceData] of Object.entries(rateCabins as any)) {
      const info = priceData as any;
      if (info.price && info.cabintype) {
        const price = parseFloat(info.price);
        const cabinType = info.cabintype.toLowerCase();
        
        if (cabinType.includes('interior') || cabinType.includes('inside')) {
          categories.interior.push(price);
        } else if (cabinType.includes('ocean') || cabinType.includes('outside')) {
          categories.oceanview.push(price);
        } else if (cabinType.includes('balcony')) {
          categories.balcony.push(price);
        } else if (cabinType.includes('suite')) {
          categories.suite.push(price);
        }
      }
    }
  }
  
  return {
    interior: categories.interior.length > 0 ? Math.min(...categories.interior) : null,
    oceanview: categories.oceanview.length > 0 ? Math.min(...categories.oceanview) : null,
    balcony: categories.balcony.length > 0 ? Math.min(...categories.balcony) : null,
    suite: categories.suite.length > 0 ? Math.min(...categories.suite) : null
  };
};
```

## 🚀 Immediate Actions Required

### Step 1: Fix Webhook Service (CRITICAL)
This prevents ALL webhook pricing updates from working:

```typescript
// In src/services/traveltek-webhook.service.ts, replace the entire updateCheapestPrices method
private async updateCheapestPrices(cruiseId: number, data: any): Promise<void> {
  const cheapestData = {
    cruise_id: cruiseId.toString(),
    cheapest_price: this.parseDecimal(data.cheapestprice || data.cheapest?.price),
    cheapest_cabin_type: data.cheapest?.cabintype || this.determineCabinType(data),
    interior_price: this.parseDecimal(data.cheapestinside?.price || data.cheapestinside || data.cheapest?.combined?.inside),
    interior_price_code: data.cheapestinsidepricecode || data.cheapest?.combined?.insidepricecode || null,
    oceanview_price: this.parseDecimal(data.cheapestoceanview || data.cheapestoutside?.price || data.cheapestoutside || data.cheapest?.combined?.outside),
    oceanview_price_code: data.cheapestoutsidepricecode || data.cheapestoceanviewpricecode || data.cheapest?.combined?.outsidepricecode || null,
    balcony_price: this.parseDecimal(data.cheapestbalcony?.price || data.cheapestbalcony || data.cheapest?.combined?.balcony),
    balcony_price_code: data.cheapestbalconypricecode || data.cheapest?.combined?.balconypricecode || null,
    suite_price: this.parseDecimal(data.cheapestsuite?.price || data.cheapestsuite || data.cheapest?.combined?.suite),
    suite_price_code: data.cheapestsuitepricecode || data.cheapest?.combined?.suitepricecode || null,
    currency: data.currency || 'USD',
  };

  // Only insert if we have at least one price
  if (cheapestData.cheapest_price || cheapestData.interior_price || 
      cheapestData.oceanview_price || cheapestData.balcony_price || cheapestData.suite_price) {
    
    await db.execute(sql`
      INSERT INTO cheapest_pricing (
        cruise_id, cheapest_price, cheapest_cabin_type,
        interior_price, interior_price_code,
        oceanview_price, oceanview_price_code,
        balcony_price, balcony_price_code,
        suite_price, suite_price_code,
        currency, last_updated
      ) VALUES (
        ${cheapestData.cruise_id},
        ${cheapestData.cheapest_price},
        ${cheapestData.cheapest_cabin_type},
        ${cheapestData.interior_price},
        ${cheapestData.interior_price_code},
        ${cheapestData.oceanview_price},
        ${cheapestData.oceanview_price_code},
        ${cheapestData.balcony_price},
        ${cheapestData.balcony_price_code},
        ${cheapestData.suite_price},
        ${cheapestData.suite_price_code},
        ${cheapestData.currency},
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (cruise_id) DO UPDATE SET
        cheapest_price = EXCLUDED.cheapest_price,
        cheapest_cabin_type = EXCLUDED.cheapest_cabin_type,
        interior_price = EXCLUDED.interior_price,
        interior_price_code = EXCLUDED.interior_price_code,
        oceanview_price = EXCLUDED.oceanview_price,
        oceanview_price_code = EXCLUDED.oceanview_price_code,
        balcony_price = EXCLUDED.balcony_price,
        balcony_price_code = EXCLUDED.balcony_price_code,
        suite_price = EXCLUDED.suite_price,
        suite_price_code = EXCLUDED.suite_price_code,
        currency = EXCLUDED.currency,
        last_updated = CURRENT_TIMESTAMP
    `);
  }
}
```

### Step 2: Update Batch Sync Services
Apply the enhanced extraction logic to:
- `price-sync-batch-v5.service.ts`
- `ftp-comprehensive-sync.service.ts`
- `data-sync.service.ts`

## 📊 Expected Impact

1. **Webhook updates will start working** (currently all fail due to wrong table name)
2. **Batch sync will find pricing data** using fallback methods
3. **Database pricing will be accurate** and match website pricing
4. **Future FTP structure changes** will be handled by fallback logic

## 🧪 Testing Plan

1. Fix webhook service and trigger a test webhook
2. Run batch sync on a few cruises to test fallback logic  
3. Compare results with website pricing
4. Monitor error logs for any remaining issues

## 📈 Long-term Recommendations

1. **Standardize pricing extraction** across all services
2. **Add comprehensive logging** to track which extraction method succeeds
3. **Create pricing validation** to catch null/empty results early
4. **Implement automated price comparison** with external sources
5. **Set up alerting** for significant price discrepancies

This fix should resolve the pricing discrepancy issue and make the sync process much more robust against future FTP structure changes.