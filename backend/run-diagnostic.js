#!/usr/bin/env node

/**
 * Production FTP Diagnostic Runner
 * 
 * Run this on Render to diagnose FTP issues:
 * node run-diagnostic.js
 */

const { runEnhancedFtpDiagnostic } = require('./dist/scripts/enhanced-ftp-diagnostic.js');

console.log('🚀 Starting Enhanced FTP Diagnostic on Production...');
console.log('This will test Royal Caribbean (4% success) and AmaWaterways (24% success)');

runEnhancedFtpDiagnostic()
  .then((results) => {
    console.log('\n✅ Diagnostic completed successfully!');
    console.log('Results available in logs above.');
    console.log('\nKey metrics:');
    
    for (const result of results) {
      console.log(`${result.lineName}: ${result.successRates.overallSuccess.toFixed(1)}% success rate`);
      console.log(`  - Files actually exist: ${result.filesActuallyExist}/${result.filesExpected}`);
      console.log(`  - Primary issue: ${result.errors.fileNotFound > result.errors.networkIssue ? 'Files not uploaded' : 'Network/code issues'}`);
    }
    
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Diagnostic failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  });