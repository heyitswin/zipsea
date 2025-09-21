# Zipsea Pipeline Test Scripts

## Overview
These test scripts provide comprehensive validation of the entire data pipeline from FTP webhooks to API responses.

## Master Test Scripts

### 1. `test-master-pipeline.js` - Comprehensive Pipeline Test
**The Source of Truth for the entire data pipeline**

Tests:
- ✅ Webhook triggers and cruise line updates
- ✅ FTP data retrieval and processing  
- ✅ Database storage correctness
- ✅ Price extraction accuracy (cheapestinterior/outside/balcony/suite)
- ✅ API serving correct data

**Usage:**
```bash
# Run locally (requires FTP credentials)
node scripts/test-master-pipeline.js
```

**Output:**
- Detailed test results for each pipeline component
- Cruise line update statistics (last 24h)
- Price change tracking
- Data freshness metrics
- API/Database consistency checks
- JSON report saved to `test-results/` directory

### 2. `test-pipeline-quick.js` - Quick Validation
**Fast validation for critical pipeline components**

Tests:
- Webhook activity (24h)
- Data freshness
- Pricing coverage
- Top cruise lines by updates
- API health checks
- Price consistency

**Usage:**
```bash
# Run locally
node scripts/test-pipeline-quick.js
```

### 3. `test-pipeline-simple.js` - Render Shell Compatible
**Simplified test for Render shell (no FTP required)**

Tests:
- Database status
- Recent webhook activity
- API endpoints
- Data consistency
- Price tracking

**Usage:**
```bash
# Run on Render shell
node scripts/test-pipeline-simple.js
```

## API Test Scripts

### 4. `test-api-curl.js` - Production API Test
Tests the production API using curl commands.

**Usage:**
```bash
# Run on Render shell
node scripts/test-api-curl.js
```

### 5. `test-api-simple.js` - Simple API Test
Quick API validation with formatted output.

**Usage:**
```bash
# Run on Render shell
node scripts/test-api-simple.js
```

## What Each Test Validates

### Webhook Pipeline
- Cruise lines are being updated via webhooks
- All cruises from current month onwards are pulled
- Webhook success/failure rates
- Update frequency per cruise line

### Database Storage
- Cruises table has correct pricing fields
- cheapest_pricing table is populated
- raw_data contains FTP JSON
- Data freshness (% updated in last 24h)

### Price Extraction
- `cheapestinterior` → `interior_price`
- `cheapestoutside` → `oceanview_price`  
- `cheapestbalcony` → `balcony_price`
- `cheapestsuite` → `suite_price`
- Cheapest overall price calculation

### API Serving
- `/api/v1/search/cruises` returns prices
- `/api/v1/cruises/{id}` returns individual price fields
- API data matches database values

## Key Metrics Tracked

1. **Cruise Line Updates**
   - Last webhook timestamp
   - Number of webhooks (24h)
   - Cruises updated (24h)
   - Date range of cruises

2. **Data Quality**
   - Pricing field coverage %
   - Data freshness (hours since update)
   - Price extraction accuracy %
   - API/DB consistency %

3. **Price Changes**
   - Number of price changes detected
   - Price snapshots created
   - Percentage changes tracked

## Environment Variables Required

For full testing:
```
DATABASE_URL=postgresql://...
TRAVELTEK_FTP_HOST=ftpeu1prod.traveltek.net
TRAVELTEK_FTP_USER=your-username
TRAVELTEK_FTP_PASSWORD=your-password
```

For API-only testing:
- No environment variables required (uses production endpoints)

## Interpreting Results

### ✅ PASSED
- All critical checks passed
- Pipeline is functioning correctly
- Data is flowing end-to-end

### ⚠️ WARNINGS
- Non-critical issues detected
- May need attention but not blocking
- Examples: Low update %, missing optional fields

### ❌ FAILED
- Critical pipeline issues detected
- Immediate attention required
- Examples: No webhooks, API down, data corruption

## Recommended Testing Schedule

1. **Continuous**: `test-pipeline-quick.js` - Every hour
2. **Daily**: `test-master-pipeline.js` - Once per day
3. **On-demand**: `test-api-simple.js` - After deployments
4. **Debugging**: `test-api-debug.js` - When issues occur

## Troubleshooting

### No webhook events
- Check Traveltek webhook configuration
- Verify webhook endpoints are accessible
- Check Redis/BullMQ worker status

### Low pricing coverage
- Verify FTP credentials are correct
- Check webhook processor logs
- Ensure price extraction logic handles all formats

### API/DB mismatch
- Check if triggers are updating correctly
- Verify cache invalidation
- Ensure API queries join correct tables

### Stale data
- Check if webhook workers are processing
- Verify FTP connection is stable
- Check for database connection issues