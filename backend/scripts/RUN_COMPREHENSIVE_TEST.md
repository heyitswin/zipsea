# 🚀 COMPREHENSIVE PRODUCTION TEST - THE ULTIMATE SOURCE OF TRUTH

## What This Test Does

This is the **MOST COMPREHENSIVE** test of your entire data pipeline. It validates EVERYTHING to give you complete confidence in your production data.

## Test Coverage

### 1. **Webhook Pipeline Integrity** 
- ✅ Webhook event processing statistics (7 days)
- ✅ Success/failure rates per cruise line
- ✅ Stuck processing detection
- ✅ Failure pattern analysis
- ✅ Processing time metrics

### 2. **Database Integrity & Constraints**
- ✅ Table structure validation
- ✅ Foreign key relationships
- ✅ Duplicate detection
- ✅ NULL value analysis
- ✅ Price value validation (negative/excessive)
- ✅ Trigger functionality

### 3. **Price Extraction Validation** 
- ✅ Tests 1000+ cruises
- ✅ Validates `cheapestinside` → `interior_price`
- ✅ Validates `cheapestoutside` → `oceanview_price`
- ✅ Validates `cheapestbalcony` → `balcony_price`
- ✅ Validates `cheapestsuite` → `suite_price`
- ✅ Cheapest price calculation verification
- ✅ Table consistency checks

### 4. **Data Freshness & Coverage**
- ✅ Update frequency analysis
- ✅ Stale data detection (>30 days)
- ✅ Price coverage by cruise line
- ✅ Sailing date coverage (gaps)
- ✅ Future cruise availability

### 5. **API Data Accuracy**
- ✅ Search endpoint validation
- ✅ Detail endpoint testing (100 cruises)
- ✅ API/Database consistency
- ✅ Response time metrics
- ✅ Price field verification

### 6. **Comprehensive Data Validation**
- ✅ Corrupted raw_data detection
- ✅ Price anomaly detection
- ✅ Duplicate cruise detection
- ✅ Trigger calculation verification
- ✅ Webhook → Update correlation

## How to Run

### On Your Local Machine (with production access):
```bash
cd backend
DATABASE_URL="postgresql://..." node scripts/test-production-comprehensive.js
```

### On Render Shell:
```bash
cd ~/project/src/backend
node scripts/test-production-comprehensive.js
```

## Output

The test provides:

1. **Console Output** with color coding:
   - 🚀 Magenta: Test sections
   - ✅ Green: Passed tests
   - ⚠️ Yellow: Warnings
   - ❌ Red: Errors
   - 💥 Bright Red: Critical failures

2. **Detailed JSON Report** saved to:
   ```
   backend/test-results/comprehensive-test-[timestamp].json
   ```

3. **Issue Categorization**:
   - **CRITICAL**: Immediate action required
   - **ERROR**: Significant issues
   - **WARNING**: Non-critical issues
   - **INFO**: Informational notes

4. **Actionable Recommendations** based on findings

## Interpreting Results

### Status Levels:

- **✅ PASSED**: Pipeline is healthy and trustworthy
- **⚠️ PASSED_WITH_WARNINGS**: Functional but needs attention
- **❌ FAILED**: Significant issues need fixing
- **💥 CRITICAL_FAILURE**: Immediate action required

### Key Metrics to Watch:

1. **Webhook Success Rate**: Should be >90%
2. **Data Freshness**: <20% should be >30 days old
3. **Price Coverage**: >60% should have prices
4. **API Consistency**: >95% API/DB match
5. **Extraction Accuracy**: >90% correct

## Sample Sizes

- **500** cruises per line tested
- **1000** cruises for price validation
- **100** API endpoint tests
- **2000** consistency checks
- **50** cruise lines maximum

## Common Issues & Solutions

### High webhook failure rate
- Check Redis/BullMQ status
- Verify FTP credentials
- Review processor logs

### Low price coverage
- Check FTP data availability
- Review extraction logic
- Verify webhook processing

### Stale data
- Increase webhook frequency
- Implement catch-up sync
- Check processing pipeline

### API/DB mismatch
- Clear API cache
- Check database triggers
- Verify query logic

## When to Run This Test

1. **Daily** - Schedule for overnight
2. **After deployments** - Verify nothing broke
3. **When suspicious** - Data seems wrong
4. **Before important demos** - Ensure everything works
5. **After FTP changes** - Verify extraction still works

## Performance Note

⚠️ **This is a HEAVY test** that:
- Queries thousands of records
- Makes 100+ API calls
- Runs complex validations
- Takes 2-5 minutes to complete

Run during low-traffic periods when possible.

## Exit Codes

- `0`: All tests passed
- `1`: Tests failed or warnings exceeded thresholds
- `2`: Fatal error/crash

## Support

If you see critical failures:
1. Check the detailed JSON report
2. Review the recommendations section
3. Run `test-pipeline-quick.js` for faster debugging
4. Check individual service logs

This test is your **source of truth** for data pipeline integrity!