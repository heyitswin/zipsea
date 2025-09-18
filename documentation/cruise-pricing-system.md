# Cruise Pricing System Documentation

## Overview
The Zipsea cruise pricing system processes and displays cruise prices from Traveltek FTP data. This document details the architecture, common issues, and fixes for the pricing system.

## Table of Contents
1. [System Architecture](#system-architecture)
2. [The Double-Encoded JSON Problem](#the-double-encoded-json-problem)
3. [Pricing Data Flow](#pricing-data-flow)
4. [Database Schema](#database-schema)
5. [Common Issues and Fixes](#common-issues-and-fixes)
6. [Monitoring and Debugging](#monitoring-and-debugging)

## System Architecture

### Data Sources
- **Traveltek FTP**: Primary source of cruise data delivered as JSON files
- **Webhooks**: Real-time updates for cruise changes
- **Batch Sync Jobs**: Periodic synchronization of cruise data

### Key Components
1. **Backend API** (`/backend`): Node.js/Express API that serves cruise data
2. **Frontend** (`/frontend`): Next.js application that displays cruises
3. **Database**: PostgreSQL with two key tables for pricing:
   - `cruises`: Main cruise data with `raw_data` JSONB column
   - `cheapest_pricing`: Denormalized pricing table for fast queries

## The Double-Encoded JSON Problem

### What Happened
During data ingestion, cruise JSON data was being double-encoded before storage:
- **Expected**: `raw_data` stored as JSONB object
- **Actual**: `raw_data` stored as JSON string (double-encoded)

### Impact
- **43,329 of 48,337 cruises (89%)** had double-encoded JSON
- Prices were inaccessible because `raw_data->>'cheapestinside'` returned null
- Website showed "Unavailable" for most cruises despite having price data

### Example of the Problem
```sql
-- Double-encoded (WRONG):
raw_data = '"{\"cruiseid\":\"123\",\"cheapestinside\":\"999.00\"}"'

-- Proper JSON (CORRECT):
raw_data = '{"cruiseid":"123","cheapestinside":"999.00"}'
```

### Root Cause
The webhook processor (`webhook-processor-optimized-v2.service.ts`) was:
1. Receiving JSON data as a string
2. Storing it directly without parsing
3. PostgreSQL was then storing the string as a JSON-encoded string

## Pricing Data Flow

### 1. Data Ingestion
```
Traveltek FTP/Webhook → Webhook Processor → Database
```

### 2. Price Fields from Traveltek
The system should use these fields for pricing (as confirmed by user):
- `cheapestinside` → Interior cabin price
- `cheapestoutside` → Oceanview cabin price  
- `cheapestbalcony` → Balcony cabin price
- `cheapestsuite` → Suite cabin price

**Important**: NCL (Norwegian Cruise Line) sends `adultprice: "0.00"` but actual prices are in the `cheapest*` fields and individual cabin categories.

### 3. Price Storage
Prices are stored in two places:
1. **`cruises.raw_data`**: Complete JSON from Traveltek
2. **`cheapest_pricing` table**: Extracted prices for fast queries

### 4. Price Display Logic
```typescript
// Frontend price resolution order (cruise/[slug]/page.tsx):
const price = 
  rawData.cheapestinside ||           // 1. Check raw_data first
  cheapestPricingData.interiorPrice   // 2. Fall back to cheapest_pricing table
```

## Database Schema

### cruises Table
```sql
CREATE TABLE cruises (
  id VARCHAR PRIMARY KEY,
  cruise_id VARCHAR,
  traveltek_cruise_id VARCHAR,  -- Traveltek's ID
  raw_data JSONB,               -- Full JSON from Traveltek
  sailing_date TIMESTAMP,
  cruise_line_id INTEGER,
  ship_id INTEGER,
  -- ... other fields
);
```

### cheapest_pricing Table
```sql
CREATE TABLE cheapest_pricing (
  cruise_id VARCHAR PRIMARY KEY REFERENCES cruises(id),
  interior_price NUMERIC,
  oceanview_price NUMERIC,
  balcony_price NUMERIC,
  suite_price NUMERIC
);
```

## Common Issues and Fixes

### Issue 1: Double-Encoded JSON
**Symptoms**: 
- Prices show as "Unavailable" on website
- `jsonb_typeof(raw_data) != 'object'` returns true

**Fix**:
```javascript
// Parse double-encoded JSON twice
const parsed = JSON.parse(JSON.parse(row.raw_data_str));

// Update to proper JSONB
await client.query(`
  UPDATE cruises 
  SET raw_data = $1::jsonb
  WHERE id = $2
`, [JSON.stringify(parsed), row.id]);
```

### Issue 2: Missing Price Extractions
**Symptoms**:
- Prices exist in `raw_data` but not in `cheapest_pricing`
- 1,152+ cruises affected

**Fix**:
```javascript
// Extract prices from raw_data
const prices = {
  interior: rawData.cheapestinside ? parseFloat(String(rawData.cheapestinside)) : null,
  oceanview: rawData.cheapestoutside ? parseFloat(String(rawData.cheapestoutside)) : null,
  balcony: rawData.cheapestbalcony ? parseFloat(String(rawData.cheapestbalcony)) : null,
  suite: rawData.cheapestsuite ? parseFloat(String(rawData.cheapestsuite)) : null
};

// Insert/update cheapest_pricing
await client.query(`
  INSERT INTO cheapest_pricing (cruise_id, interior_price, oceanview_price, balcony_price, suite_price)
  VALUES ($1, $2, $3, $4, $5)
  ON CONFLICT (cruise_id) 
  DO UPDATE SET
    interior_price = EXCLUDED.interior_price,
    oceanview_price = EXCLUDED.oceanview_price,
    balcony_price = EXCLUDED.balcony_price,
    suite_price = EXCLUDED.suite_price
`, [cruiseId, prices.interior, prices.oceanview, prices.balcony, prices.suite]);
```

### Issue 3: Webhook Processor Expecting Wrong Format
**Original Problem**: 
The webhook processor expected objects with `price` property but was receiving direct string values.

**Fix Applied** (`webhook-processor-optimized-v2.service.ts`):
```typescript
const extractPrice = (value: any): number | null => {
  if (!value) return null;
  // Handle direct string values (correct)
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = parseFloat(String(value));
    return parsed > 0 ? parsed : null;
  }
  // Handle objects with price property (legacy)
  if (typeof value === 'object' && value.price) {
    const parsed = parseFloat(String(value.price));
    return parsed > 0 ? parsed : null;
  }
  return null;
};
```

### Issue 4: Frontend Fallback Logic
**Problem**: Frontend was trying to access non-existent price properties on cruise object.

**Fix Applied** (`frontend/app/cruise/[slug]/page.tsx`):
```typescript
// WRONG - cruise object doesn't have price properties
cruiseData.cruise?.interiorPrice

// CORRECT - prices only exist in cheapestPricingData
cheapestPricingData.interiorPrice
```

## Monitoring and Debugging

### Check Database Status
```sql
-- Overall status
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN jsonb_typeof(raw_data) = 'object' THEN 1 END) as proper_json,
  COUNT(CASE WHEN jsonb_typeof(raw_data) != 'object' THEN 1 END) as double_encoded,
  COUNT(CASE WHEN cp.interior_price IS NOT NULL OR cp.oceanview_price IS NOT NULL 
              OR cp.balcony_price IS NOT NULL OR cp.suite_price IS NOT NULL THEN 1 END) as has_prices
FROM cruises c
LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id;

-- Check specific cruise line (e.g., NCL)
SELECT COUNT(*), cl.name
FROM cruises c
JOIN cruise_lines cl ON c.cruise_line_id = cl.id
LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
WHERE cl.name LIKE '%Norwegian%'
  AND cp.interior_price IS NOT NULL
GROUP BY cl.name;
```

### Find Problem Cruises
```sql
-- Find cruises with double-encoded JSON
SELECT id, cruise_id, jsonb_typeof(raw_data) as type
FROM cruises
WHERE jsonb_typeof(raw_data) != 'object' 
  AND raw_data IS NOT NULL
LIMIT 10;

-- Find cruises with prices in raw_data but not in cheapest_pricing
SELECT COUNT(*)
FROM cruises c
LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
WHERE jsonb_typeof(c.raw_data) = 'object'
  AND (c.raw_data->>'cheapestinside' IS NOT NULL 
    OR c.raw_data->>'cheapestoutside' IS NOT NULL)
  AND cp.interior_price IS NULL 
  AND cp.oceanview_price IS NULL;
```

### Running Comprehensive Fix
```bash
# Fix all double-encoded JSON and extract missing prices
cd backend
node scripts/fix-all-cruises-comprehensive.js
```

## URL Structure and Cruise IDs

The website uses URLs like: `/cruise/norwegian-jewel-2025-12-17-2198377`

Where:
- `2198377` is the cruise ID used in the URL
- This maps to `cruises.id` in the database
- `traveltek_cruise_id` stores the original Traveltek ID
- `cruise_id` may contain a different internal ID

## Key Lessons Learned

1. **Always validate data types on ingestion** - Don't assume JSON is properly formatted
2. **Use JSONB properly** - Parse strings to objects before storing as JSONB
3. **Denormalize critical data** - The `cheapest_pricing` table provides fast queries
4. **Test with real data** - NCL's `adultprice: "0.00"` pattern revealed assumptions
5. **Monitor data quality** - Regular checks for double-encoding and missing extractions
6. **Cache carefully** - Clear cache after fixing data issues

## Current Statistics (as of last check)

- **Total cruises**: 48,337
- **Double-encoded JSON**: 43,329 (89%)
- **Missing price extractions**: 1,152
- **No prices at all**: 9,163

After running the comprehensive fix:
- All double-encoded JSON should be fixed
- All available prices should be extracted
- NCL December 2025 should show ~83 cruises instead of 2

## Related Files

### Backend
- `/backend/src/services/webhook-processor-optimized-v2.service.ts` - Processes cruise data
- `/backend/src/services/cruise.service.ts` - Main cruise service
- `/backend/scripts/fix-all-cruises-comprehensive.js` - Comprehensive fix script
- `/backend/scripts/check-price-accuracy-by-line.js` - Validation script

### Frontend
- `/frontend/app/cruise/[slug]/page.tsx` - Cruise detail page
- `/frontend/app/cruises/page.tsx` - Cruise listing page

## Contact and Support

This documentation covers the cruise pricing system bug discovered in December 2024. The issue affected 89% of all cruises in the database due to double-encoded JSON preventing price extraction.

For questions about this system:
1. Check database status using the SQL queries above
2. Run the comprehensive fix script if needed
3. Clear API cache after fixes
4. Monitor the website to ensure prices display correctly