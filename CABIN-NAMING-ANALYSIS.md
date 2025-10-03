# Cabin Naming Analysis Across Cruise Lines

**Date:** October 3, 2025  
**Purpose:** Investigate cabin category naming variations to fix missing cabin images

---

## Executive Summary

Analyzed 25 cruise lines and **all use consistent `codtype` values** for cabin categories:
- ✅ `inside` - Interior cabins
- ✅ `outside` - Oceanview cabins  
- ✅ `balcony` - Balcony/Veranda cabins
- ✅ `suite` - Suite cabins

**No cruise line uses `"cabin"`, `"interior"`, `"oceanview"` as codtype values.**

---

## Key Findings

### 1. **Codtype Field is Standardized**
All cruise lines use the **same 4 values** in the `codtype` field:
```
inside | outside | balcony | suite
```

This is consistent across:
- Carnival, Royal Caribbean, Norwegian (mass market)
- Celebrity, Princess, Holland America (premium)
- Regent, Silversea, Seabourn (luxury)
- Viking, Hurtigruten, Lindblad (expedition/river)

### 2. **Cabin Names Vary Wildly**
While `codtype` is standardized, cabin **names** have massive variation:

**Interior Variations:**
- "Inside", "Interior", "Inside Stateroom", "Interior Stateroom"
- "Deluxe Inside", "Premium Inside", "Classic Inside"
- "Studio Interior", "Single Inside"

**Oceanview Variations:**
- "Outside", "Oceanview", "Ocean View", "Outside Stateroom"
- "Deluxe Outside Ocean View", "Premium Outside with Ocean View"
- "Ocean View Stateroom", "Classic Outside Ocean View"

**Balcony Variations:**
- "Balcony", "Veranda", "Balcony Stateroom", "Veranda Stateroom"
- "Deluxe Veranda Suite", "Premium Balcony", "Club Balcony Suite"
- "French Balcony" (AmaWaterways, Viking river cruises)

**Suite Variations:**
- "Suite", "Grand Suite", "Royal Suite", "Owner's Suite"
- "Penthouse Suite", "Junior Suite", "Mini Suite"
- Cruise-specific: "Haven Suite" (NCL), "Yacht Club Suite" (MSC)

---

## Special Cases

### Viking Cruises
**Issue:** River cruise cabins have category `"outside"` but names like:
- "French Balcony Stateroom"
- "Standard Stateroom"
- "Veranda Stateroom"

**Root Cause:** Ocean cruises use `codtype: "balcony"` for verandas, but river cruises use `codtype: "outside"` for French balconies (non-walkout balconies).

### Regent Seven Seas & Explora Journeys
**All-Suite Ships:** Only `codtype: "suite"` exists (no inside/outside/balcony)

### AmaWaterways
**River Cruises:** Uses `codtype: "outside"`, `"balcony"`, and `"suite"` but NO `"inside"` cabins

---

## Frontend Logic Review

### Current Implementation (CruiseDetailClient.tsx)

**Primary Method:** `getCabinDetailsFromPriceCode()`
- ✅ Uses `codtype` field from `rawData.prices[ratecode][cabinid].cabintype`
- ✅ Maps frontend types correctly:
  ```typescript
  interior → inside
  oceanview → outside  
  balcony → balcony
  suite → suite
  ```

**Fallback Method:** `getCabinData()`
- ⚠️ Uses cabin `category` field (from `cabinCategories` array)
- ⚠️ Viking issue: Some ships have `category: "cabin"` instead of `"inside"`

---

## Root Cause Analysis

### Why Viking Images Were Missing

Looking at frontend code (lines 474-480):
```typescript
if (targetCategory === "inside") {
  return (
    (cabinCat === "inside" || cabinCat === "interior" || cabinCat === "cabin") &&
    !cabinName.includes("balcony") &&
    ...
  );
}
```

**The Problem:**
1. Viking river cruise raw data has `category: "cabin"` in `cabinCategories`
2. Frontend fallback was checking for `"inside"` or `"interior"` only
3. Missing the `"cabin"` variation
4. **Fixed in commit 81e334b** by adding `cabinCat === "cabin"`

### Why Outside Cabin Images Were Missing (Royal Princess)

**The Problem:**
1. `cheapestoutsidepricecode` was just `"RATECODE"` not `"RATECODE|CABIN|OCC"`
2. Frontend expected pipe-delimited format
3. Couldn't extract cabin ID to look up images
4. **Fixed in commit 2836d24** by handling rate-code-only format

---

## Database Schema Notes

### `cabin_categories` Table
- **Status:** Empty in production (0 records)
- **Not used** for cabin data storage

### `cruises.cabins_data` (JSONB)
- **Structure:** Object with cabin IDs as keys
- **Fields per cabin:**
  - `codtype`: Standardized type (inside/outside/balcony/suite)
  - `name`: Variable cabin name
  - `cabincode`: Cabin code (e.g., "S1", "BA", "IC")
  - `imageurl`, `imageurlhd`, `imageurl2k`: Image URLs

---

## Recommendations

### ✅ No Further Frontend Changes Needed

The current implementation handles all cruise lines correctly:

1. **Primary lookup** uses `codtype` from prices (standardized)
2. **Fallback lookup** includes all variations:
   - `"inside"`, `"interior"`, `"cabin"` ✅
   - Excludes balcony/veranda/suite keywords ✅

### 📊 Monitoring Suggestions

Track cabin images by cruise line:
```sql
SELECT 
  cl.name,
  COUNT(*) as cruises,
  COUNT(*) FILTER (WHERE c.cabins_data IS NOT NULL) as with_cabin_data
FROM cruises c
JOIN ships s ON c.ship_id = s.id  
JOIN cruise_lines cl ON s.cruise_line_id = cl.id
GROUP BY cl.name;
```

### 🔍 Edge Cases to Watch

1. **French Balconies** - Categorized as `outside` not `balcony`
2. **All-Suite Ships** - No inside/outside/balcony categories
3. **Obstructed View** - Same `codtype` as unobstructed, differentiated in name only

---

## Conclusion

**The cabin naming investigation confirms:**
- ✅ `codtype` field is standardized across ALL cruise lines
- ✅ No further frontend changes needed
- ✅ Both fixes (2836d24 and 81e334b) address the real issues
- ✅ Future cabin image problems will likely be data quality issues, not naming variations

**No additional cruise line-specific handling is required.**
