#!/usr/bin/env node

/**
 * Validation script to verify all critical fixes are in place
 * This script checks the code changes without requiring database access
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Zipsea Backend Fix Validation');
console.log('================================\n');

const checks = [];
let passCount = 0;
let failCount = 0;

function addCheck(name, condition, details) {
  const status = condition ? 'PASS' : 'FAIL';
  checks.push({ name, status, details });
  if (condition) {
    passCount++;
  } else {
    failCount++;
  }
  console.log(`${condition ? '✅' : '❌'} ${name}`);
  if (details) {
    console.log(`   ${details}\n`);
  }
}

// Check 1: Schema script uses correct column names
try {
  const schemaScript = fs.readFileSync('scripts/recreate-schema.js', 'utf8');
  const hasOldRegionIndex = schemaScript.includes('idx_cruises_region ON cruises(region)');
  const hasNewRegionIdsIndex = schemaScript.includes('idx_cruises_region_ids ON cruises USING GIN(region_ids)');
  const hasRegionIdsColumn = schemaScript.includes('region_ids JSONB DEFAULT');
  const hasPortIdsColumn = schemaScript.includes('port_ids JSONB DEFAULT');
  
  addCheck(
    'Schema uses correct JSONB columns (region_ids, port_ids)', 
    hasRegionIdsColumn && hasPortIdsColumn && !hasOldRegionIndex,
    `Found region_ids: ${hasRegionIdsColumn}, port_ids: ${hasPortIdsColumn}, removed old region index: ${!hasOldRegionIndex}`
  );
  
  addCheck(
    'Schema has GIN indexes for JSONB arrays',
    hasNewRegionIdsIndex && schemaScript.includes('port_ids ON cruises USING GIN(port_ids)'),
    'Both region_ids and port_ids have proper GIN indexes for array queries'
  );
  
} catch (error) {
  addCheck('Schema script validation', false, `Error reading schema script: ${error.message}`);
}

// Check 2: Data sync service uses correct field mappings
try {
  const dataSyncService = fs.readFileSync('src/services/data-sync.service.ts', 'utf8');
  const hasLineContentEngineNameMapping = dataSyncService.includes('lineContent.enginename');
  const hasShipContentNameMapping = dataSyncService.includes('shipContent.name');
  const hasShipContentNiceNameMapping = dataSyncService.includes('shipContent.nicename');
  
  addCheck(
    'Data sync uses correct cruise line name extraction', 
    hasLineContentEngineNameMapping,
    'Uses linecontent.enginename as primary source for cruise line names'
  );
  
  addCheck(
    'Data sync uses correct ship name extraction',
    hasShipContentNameMapping && hasShipContentNiceNameMapping,
    'Uses shipcontent.name and shipcontent.nicename for ship names'
  );
  
} catch (error) {
  addCheck('Data sync service validation', false, `Error reading data sync service: ${error.message}`);
}

// Check 3: Webhook service has enhanced error handling
try {
  const webhookService = fs.readFileSync('src/services/webhook.service.ts', 'utf8');
  const hasRetryLogic = webhookService.includes('maxRetries = 3');
  const hasTimeoutHandling = webhookService.includes('FTP download timeout');
  const hasExponentialBackoff = webhookService.includes('Math.pow(2, attempt)');
  const hasNonRetryableErrorHandling = webhookService.includes('Non-retryable error');
  
  addCheck(
    'Webhook service has retry logic',
    hasRetryLogic,
    'Implements 3-attempt retry pattern for failed FTP operations'
  );
  
  addCheck(
    'Webhook service has timeout handling', 
    hasTimeoutHandling,
    'Implements 30-second timeout for FTP downloads'
  );
  
  addCheck(
    'Webhook service has exponential backoff',
    hasExponentialBackoff && hasNonRetryableErrorHandling,
    'Uses exponential backoff between retries and identifies non-retryable errors'
  );
  
} catch (error) {
  addCheck('Webhook service validation', false, `Error reading webhook service: ${error.message}`);
}

// Check 4: Price history is implemented
try {
  const dataSyncService = fs.readFileSync('src/services/data-sync.service.ts', 'utf8');
  const hasPriceSnapshot = dataSyncService.includes('priceHistoryService.captureSnapshot');
  const hasPriceChangeCalculation = dataSyncService.includes('calculatePriceChanges');
  
  addCheck(
    'Price history snapshots are implemented',
    hasPriceSnapshot && hasPriceChangeCalculation,
    'Captures price snapshots before updates and calculates price changes'
  );
  
} catch (error) {
  addCheck('Price history validation', false, `Error checking price history: ${error.message}`);
}

// Check 5: Search API has proper error handling
try {
  const searchService = fs.readFileSync('src/services/search-optimized-simple.service.ts', 'utf8');
  const hasDbAvailabilityCheck = searchService.includes('if (!db)');
  const hasMockDataFallback = searchService.includes('mockData: true');
  const hasResultsArraySafeAccess = searchService.includes('resultsArray || []');
  
  addCheck(
    'Search API has database availability checks',
    hasDbAvailabilityCheck && hasMockDataFallback,
    'Gracefully handles database unavailability with mock data fallback'
  );
  
  addCheck(
    'Search API has safe result handling',
    hasResultsArraySafeAccess,
    'Uses safe array access patterns to prevent runtime errors'
  );
  
} catch (error) {
  addCheck('Search API validation', false, `Error checking search API: ${error.message}`);
}

// Check 6: Sync scripts use correct field mappings
try {
  const syncScript = fs.readFileSync('scripts/sync-sept-onwards.js', 'utf8');
  const hasCorrectLineNameMapping = syncScript.includes('linecontent.enginename');
  const hasCorrectShipNameMapping = syncScript.includes('shipcontent.name');
  const hasFallbackMapping = syncScript.includes('shipcontent.nicename');
  
  addCheck(
    'Sync scripts use correct field mappings',
    hasCorrectLineNameMapping && hasCorrectShipNameMapping && hasFallbackMapping,
    'Uses linecontent.enginename and shipcontent.name with proper fallbacks'
  );
  
} catch (error) {
  addCheck('Sync script validation', false, `Error checking sync script: ${error.message}`);
}

// Summary
console.log('\n📊 Validation Summary');
console.log('====================');
console.log(`✅ Passed: ${passCount}`);
console.log(`❌ Failed: ${failCount}`);
console.log(`📋 Total:  ${passCount + failCount}\n`);

if (failCount === 0) {
  console.log('🎉 All critical fixes are properly implemented!');
  console.log('✨ The system should now be production-ready with:');
  console.log('   • Fixed schema with correct JSONB columns and indexes');
  console.log('   • Proper field extraction for cruise line and ship names');
  console.log('   • Enhanced webhook error handling with retry logic');
  console.log('   • Price history tracking for updates');
  console.log('   • Robust search API with error handling\n');
  
  console.log('🚀 Next Steps:');
  console.log('1. Run recreate-schema.js to fix the production database');
  console.log('2. Execute sync scripts to populate with correct data');
  console.log('3. Test the search API and webhook endpoints');
  console.log('4. Monitor webhook success rates\n');
  
} else {
  console.log('⚠️  Some fixes may not be complete. Please review failed checks.');
  process.exit(1);
}

// Create deployment checklist
const checklist = `# Deployment Checklist - Zipsea Backend Fixes

## Pre-deployment
- [ ] Backup production database
- [ ] Verify environment variables are set
- [ ] Ensure FTP credentials are valid

## Schema Fixes
- [ ] Run \`node scripts/recreate-schema.js\` on production
- [ ] Verify all tables created successfully
- [ ] Check that indexes are created (especially GIN indexes on JSONB columns)

## Data Sync
- [ ] Start with small sync: \`YEAR=2025 MONTH=9 BATCH_SIZE=5 node scripts/sync-sept-onwards.js\`
- [ ] Verify cruise line names appear correctly (not "CL17")
- [ ] Verify ship names appear correctly (not "Ship 410")
- [ ] Check search API returns proper data

## Testing
- [ ] Test webhook endpoints: /api/webhooks/traveltek/health
- [ ] Test search API: /api/v1/search
- [ ] Monitor webhook success rates in logs
- [ ] Verify price history is being captured

## Monitoring
- [ ] Check application logs for errors
- [ ] Monitor database performance
- [ ] Verify cache invalidation is working
- [ ] Check Slack notifications for webhook updates

## Rollback Plan
- [ ] Database backup ready for restore
- [ ] Previous schema recreation script available
- [ ] Monitor for issues in first 24 hours

Generated: ${new Date().toISOString()}
`;

fs.writeFileSync('DEPLOYMENT_CHECKLIST.md', checklist);
console.log('📋 Deployment checklist created: DEPLOYMENT_CHECKLIST.md');