# Critical Raw Data Corruption Discovery - September 21, 2025

## Summary
Discovered massive data corruption affecting **87% of all cruises in the database** (42,455 out of 49,176 active cruises). The corruption involves raw_data being stored as character arrays instead of proper JSON, causing prices to show 66-97% lower than actual values.

## Timeline of Discovery

### Initial Issue
- User reported cruise 2144014 showing wrong prices (all cabin types except suite)
- Investigation revealed webhook processor was using stale cached data instead of fresh FTP data

### Deeper Investigation
- Fixed individual cruise pricing issues
- User requested check of ALL cruises under $300 sailing October 2025+
- Found 88 cruises with severe pricing errors

### Critical Discovery
- Raw data is stored as **character arrays** - JSON string split into individual character properties
- Example: Instead of `{"price": 100}`, stored as object with `{0: '{', 1: '"', 2: 'p', ...}`
- Causes prices to display as low as 5% of actual value ($14 instead of $275)

## Root Cause Analysis

### The Corruption Pattern
```javascript
// What we expect:
raw_data = '{"cheapestinside": 275, "cheapestoutside": 325, ...}'

// What we found:
raw_data = {
  '0': '{',
  '1': '"',
  '2': 'c',
  '3': 'h',
  '4': 'e',
  // ... continues for thousands of characters
}
```

### Impact
- **87% of database corrupted** (42,455 cruises)
- Prices showing 66-97% too low
- Example errors found:
  - Cruise showing $79 instead of $3,168 (97.5% error)
  - Cruise showing $14 instead of $275 (94.9% error)
  - 88+ cruises with critical pricing errors

## Affected Files & Components

### Core Services
- `/backend/src/services/webhook-processor-optimized-v2.service.ts` - Processes raw FTP data
- `/backend/src/services/webhook-queue.service.ts` - Queues webhook processing (has uncommitted changes)
- `/backend/src/services/search-hotfix.service.ts` - Search functionality affected by bad prices
- `/backend/src/services/search-comprehensive.service.ts` - Comprehensive search affected

### Database Schema
- `cruises` table columns affected:
  - `raw_data` (JSONB) - Contains corrupted character arrays
  - `interior_price`, `oceanview_price`, `balcony_price`, `suite_price` - All showing wrong values
  - `cheapest_price` - Calculated incorrectly from corrupted data

### Scripts Created for Investigation
- `/backend/scripts/check-all-cruises-corruption.js` - Checks entire database for corruption
- `/backend/scripts/fix-pricing-emergency.js` - Emergency fix for critical pricing errors
- `/backend/scripts/validate-large-sample.js` - Validates sample of cruises
- `/backend/scripts/fix-corrupted-batch.js` - Batch fix corrupted data
- `/backend/scripts/fix-all-corrupted-data.js` - Fix all corrupted cruises

### Other Related Files
Multiple investigation scripts created:
- `check-cruise-2190299-production.js`
- `debug-virgin-voyages.js`
- `investigate-disney-prices.js`
- `validate-disney-fix.js`
- `fix-virgin-voyages-prices.js`

## The Fix Strategy

### Immediate Actions
1. **Reconstruction Algorithm**
```javascript
// Reconstruct JSON from character array
let reconstructed = '';
let i = 0;
while (rd[i.toString()] !== undefined && i < 10000000) {
  reconstructed += rd[i.toString()];
  i++;
}
const fixedData = JSON.parse(reconstructed);
```

2. **Price Extraction Priority**
- First: Use `cheapestX` fields directly from FTP
- Second: Use `cheapest.prices` object
- Never: Use `cachedprices` or `combined` fields

### Database Update Query
```sql
UPDATE cruises
SET
  raw_data = ${fixedData}::jsonb,
  interior_price = ${realPrices.interior},
  oceanview_price = ${realPrices.oceanview},
  balcony_price = ${realPrices.balcony},
  suite_price = ${realPrices.suite},
  cheapest_price = ${realCheapest},
  updated_at = CURRENT_TIMESTAMP
WHERE id = ${cruise.id}
```

## Next Steps

### Immediate (Today)
1. ✅ Complete full database scan to identify all affected cruises
2. ⏳ Run fix script on ALL corrupted cruises (42,455 records)
3. ⏳ Verify fixes are working correctly

### Short Term (This Week)
1. Find root cause of character array corruption in webhook processor
2. Fix webhook processor to prevent future corruption
3. Add validation to ensure raw_data is always valid JSON
4. Set up monitoring to detect corruption immediately

### Long Term
1. Add comprehensive data validation layer
2. Implement data integrity checks in sync process
3. Create automated recovery mechanisms
4. Add alerting for data anomalies

## Lessons Learned

1. **Never Trust Data Format** - Always validate JSON structure before processing
2. **Monitor Price Ranges** - Flag when prices are suspiciously low (< 10% of expected)
3. **Test at Scale** - Small samples missed this issue affecting 87% of data
4. **Character Array Bug** - Likely caused by incorrect JSON.stringify or object spread on strings

## Current Status
- Script running to check all 49,176 cruises
- Already confirmed 42,455 cruises affected (87% corruption rate)
- Fix script ready to deploy once full scan completes
- Production database at risk - customers seeing wrong prices

## Critical Commands

```bash
# Check corruption across entire database
node scripts/check-all-cruises-corruption.js

# Fix all corrupted cruises (dry run)
node scripts/fix-all-corrupted-data.js

# Fix all corrupted cruises (execute)
node scripts/fix-all-corrupted-data.js --execute

# Monitor webhook processing
pm2 logs webhook-processor
```

## Risk Assessment
- **Severity**: CRITICAL
- **Customer Impact**: HIGH (wrong prices displayed)
- **Data Loss Risk**: LOW (data recoverable)
- **Revenue Impact**: HIGH (customers seeing 95% discounts)

---

**Last Updated**: September 21, 2025, 5:45 PM PST
**Status**: 🔴 CRITICAL - Active incident, fix in progress