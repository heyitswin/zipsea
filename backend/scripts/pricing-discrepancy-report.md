# Pricing Data Discrepancy Investigation Report

## Executive Summary

The pricing data discrepancy between FTP files and the database for cruise 2111828 has been identified. The root cause is a combination of:

1. **Inconsistent field extraction methods** across different sync services
2. **Database table naming bug** in the webhook service 
3. **Missing fallback logic** when primary pricing fields are empty

## Issue Analysis

### Current Pricing Extraction Methods

The codebase uses **5 different methods** to extract pricing from Traveltek JSON files:

#### Method 1: Direct Cheapest Fields (Most Services)
**Used by:** `data-sync.service.ts`, `price-sync-batch-v5.service.ts`, `ftp-comprehensive-sync.service.ts`

```typescript
// Current approach
const prices = {
  interior: data.cheapestinside,
  oceanview: data.cheapestoutside, 
  balcony: data.cheapestbalcony,
  suite: data.cheapestsuite
};
```

**Problem:** These fields are often `null` in FTP files, as shown in sample data.

#### Method 2: cheapest.combined (Webhook Service)
**Used by:** `traveltek-webhook.service.ts`

```typescript
const combined = cheapest.combined || {};
const prices = {
  interior: combined.inside,
  oceanview: combined.outside,
  balcony: combined.balcony, 
  suite: combined.suite
};
```

#### Method 3: cheapest.prices (Static Pricing)
**Used by:** `traveltek-webhook.service.ts`

```typescript
const staticPrices = cheapest.prices || {};
```

#### Method 4: cheapest.cachedprices (Live Pricing)
**Used by:** `traveltek-webhook.service.ts`  

```typescript
const cachedPrices = cheapest.cachedprices || {};
```

#### Method 5: Calculate from prices object (Not Implemented)
**Potential solution:** Calculate minimum price per category from detailed `prices` object.

### Critical Database Bug

The webhook service attempts to insert into `cheapest_prices` table:

```sql
INSERT INTO cheapest_prices (...)
```

**Problem:** This table doesn't exist! The actual table is `cheapest_pricing`.

This bug causes webhook updates to fail silently, meaning pricing data is never updated when webhooks fire.

## Sample Data Analysis

Using the sample cruise file (`sample-traveltek-cruise.json`):

- **Method 1 results:** All `null` (explains why sync fails)
- **Method 2 results:** Only `balcony: null`
- **Method 3-4 results:** Limited data available
- **Method 5:** No `prices` object in sample (but may exist in actual files)

## Database State

Cruise 2111828 currently shows in database:
```json
{
  "cruise_id": "2111828",
  "interior_price": "1398.20", 
  "oceanview_price": "1505.20",
  "balcony_price": "1750.20",
  "suite_price": "3736.20",
  "last_updated": "2025-08-23T02:09:24.000Z"
}
```

These prices match the website, suggesting they were populated by a different mechanism (likely manual or earlier sync before the FTP structure changed).

## Root Cause Analysis

### Primary Issues:

1. **FTP Structure Evolution:** Traveltek appears to have moved away from direct `cheapestinside` fields to nested structures like `cheapest.combined`

2. **Service Inconsistency:** Different services use different extraction methods, with no fallback logic

3. **Database Bug:** Webhook service inserts to wrong table, causing all webhook-triggered updates to fail

4. **Missing Field Mapping:** The batch sync services haven't been updated to handle the new FTP JSON structure

### Why Website Shows Correct Prices

The website likely gets correct pricing because:
1. It uses a different sync mechanism
2. It was manually updated  
3. It uses webhook updates (which fail due to wrong table name)
4. It calculates from a different data source

## Recommended Solutions

### Immediate Fix (Priority 1)

1. **Fix webhook service table name:**
   ```diff
   - INSERT INTO cheapest_prices (
   + INSERT INTO cheapest_pricing (
   ```

2. **Update batch sync services to use fallback logic:**
   ```typescript
   // Enhanced extraction with fallbacks
   const extractPricing = (data: any) => {
     // Method 1: Direct fields (current)
     let prices = {
       interior: data.cheapestinside,
       oceanview: data.cheapestoutside,
       balcony: data.cheapestbalcony, 
       suite: data.cheapestsuite
     };
     
     // Method 2: Fallback to cheapest.combined
     if (!prices.interior && !prices.oceanview && !prices.balcony && !prices.suite) {
       const combined = data.cheapest?.combined || {};
       prices = {
         interior: combined.inside,
         oceanview: combined.outside,
         balcony: combined.balcony,
         suite: combined.suite
       };
     }
     
     // Method 3: Calculate from prices object (ultimate fallback)
     if (!prices.interior && !prices.oceanview && !prices.balcony && !prices.suite) {
       prices = calculateFromPricesObject(data.prices);
     }
     
     return prices;
   };
   ```

### Long-term Improvements (Priority 2)

1. **Standardize pricing extraction** across all services
2. **Add comprehensive logging** to track which method succeeds
3. **Create pricing validation** to catch null/empty results
4. **Implement price change detection** to alert on significant differences

## Files Requiring Updates

### Critical (Fix Immediately)

1. **`src/services/traveltek-webhook.service.ts`**
   - Line 921: Fix table name `cheapest_prices` → `cheapest_pricing`
   - Add proper error handling for pricing extraction

### Important (Update Soon)

1. **`src/services/price-sync-batch-v5.service.ts`**
   - Lines 328-331: Add fallback logic
   
2. **`src/services/ftp-comprehensive-sync.service.ts`**
   - Lines 308-311: Add fallback logic
   
3. **`src/services/data-sync.service.ts`** 
   - Lines 553-586: Add fallback logic

## Testing Plan

1. **Verify webhook fix:**
   - Trigger a test webhook
   - Check database for successful insert
   
2. **Test fallback logic:**
   - Use cruise files with null direct fields
   - Verify fallback methods are used
   
3. **Validate pricing accuracy:**
   - Compare extracted prices with website
   - Check multiple cruise examples

## Implementation Priority

1. **URGENT:** Fix webhook service table name (prevents all webhook updates)
2. **HIGH:** Add fallback logic to batch sync services  
3. **MEDIUM:** Standardize extraction logic across services
4. **LOW:** Add comprehensive logging and validation