#!/usr/bin/env tsx

/**
 * FTP CREDENTIAL VERIFICATION SCRIPT
 * 
 * This script verifies what FTP credentials are actually loaded
 * and compares environment vs processed values.
 * 
 * Usage:
 *   tsx scripts/check-ftp-credentials.ts
 */

import { logger } from '../src/config/logger';
import { env } from '../src/config/environment';

function main() {
  logger.info('🔍 FTP CREDENTIAL VERIFICATION SCRIPT');
  logger.info('=====================================');
  
  // Check raw environment variables
  logger.info('\n📋 RAW ENVIRONMENT VARIABLES:');
  logger.info(`NODE_ENV: ${process.env.NODE_ENV || 'UNDEFINED'}`);
  logger.info(`TRAVELTEK_FTP_HOST (raw): ${process.env.TRAVELTEK_FTP_HOST ? 'SET (length: ' + process.env.TRAVELTEK_FTP_HOST.length + ')' : 'MISSING'}`);
  logger.info(`TRAVELTEK_FTP_USER (raw): ${process.env.TRAVELTEK_FTP_USER ? 'SET (length: ' + process.env.TRAVELTEK_FTP_USER.length + ')' : 'MISSING'}`);
  logger.info(`TRAVELTEK_FTP_PASSWORD (raw): ${process.env.TRAVELTEK_FTP_PASSWORD ? 'SET (length: ' + process.env.TRAVELTEK_FTP_PASSWORD.length + ')' : 'MISSING'}`);
  
  // Check processed environment values
  logger.info('\n⚙️ PROCESSED ENVIRONMENT VALUES (via env config):');
  logger.info(`NODE_ENV (processed): ${env.NODE_ENV}`);
  logger.info(`TRAVELTEK_FTP_HOST (processed): ${env.TRAVELTEK_FTP_HOST ? 'SET (length: ' + env.TRAVELTEK_FTP_HOST.length + ')' : 'MISSING'}`);
  logger.info(`TRAVELTEK_FTP_USER (processed): ${env.TRAVELTEK_FTP_USER ? 'SET (length: ' + env.TRAVELTEK_FTP_USER.length + ')' : 'MISSING'}`);
  logger.info(`TRAVELTEK_FTP_PASSWORD (processed): ${env.TRAVELTEK_FTP_PASSWORD ? 'SET (length: ' + env.TRAVELTEK_FTP_PASSWORD.length + ')' : 'MISSING'}`);
  
  // Show preview (first few characters) for debugging
  logger.info('\n🔍 CREDENTIAL PREVIEWS (first 10 chars, masked):');
  const hostPreview = process.env.TRAVELTEK_FTP_HOST ? process.env.TRAVELTEK_FTP_HOST.substring(0, 10) + '***' : 'MISSING';
  const userPreview = process.env.TRAVELTEK_FTP_USER ? process.env.TRAVELTEK_FTP_USER.substring(0, 5) + '***' : 'MISSING';
  logger.info(`HOST: ${hostPreview}`);
  logger.info(`USER: ${userPreview}`);
  logger.info(`PASSWORD: ${process.env.TRAVELTEK_FTP_PASSWORD ? '[REDACTED - LENGTH: ' + process.env.TRAVELTEK_FTP_PASSWORD.length + ']' : 'MISSING'}`);
  
  // Check for common issues
  logger.info('\n⚠️ POTENTIAL ISSUES:');
  const issues = [];
  
  if (!process.env.TRAVELTEK_FTP_HOST) {
    issues.push('❌ TRAVELTEK_FTP_HOST is not set in environment');
  } else if (env.TRAVELTEK_FTP_HOST !== process.env.TRAVELTEK_FTP_HOST) {
    issues.push('⚠️ TRAVELTEK_FTP_HOST differs between raw and processed values');
  }
  
  if (!process.env.TRAVELTEK_FTP_USER) {
    issues.push('❌ TRAVELTEK_FTP_USER is not set in environment');
  } else if (env.TRAVELTEK_FTP_USER !== process.env.TRAVELTEK_FTP_USER) {
    issues.push('⚠️ TRAVELTEK_FTP_USER differs between raw and processed values');
  }
  
  if (!process.env.TRAVELTEK_FTP_PASSWORD) {
    issues.push('❌ TRAVELTEK_FTP_PASSWORD is not set in environment');
  } else if (env.TRAVELTEK_FTP_PASSWORD !== process.env.TRAVELTEK_FTP_PASSWORD) {
    issues.push('⚠️ TRAVELTEK_FTP_PASSWORD differs between raw and processed values');
  }
  
  // Check for whitespace issues
  if (process.env.TRAVELTEK_FTP_HOST && process.env.TRAVELTEK_FTP_HOST !== process.env.TRAVELTEK_FTP_HOST.trim()) {
    issues.push('⚠️ TRAVELTEK_FTP_HOST has leading/trailing whitespace');
  }
  
  if (process.env.TRAVELTEK_FTP_USER && process.env.TRAVELTEK_FTP_USER !== process.env.TRAVELTEK_FTP_USER.trim()) {
    issues.push('⚠️ TRAVELTEK_FTP_USER has leading/trailing whitespace');
  }
  
  if (process.env.TRAVELTEK_FTP_PASSWORD && process.env.TRAVELTEK_FTP_PASSWORD !== process.env.TRAVELTEK_FTP_PASSWORD.trim()) {
    issues.push('⚠️ TRAVELTEK_FTP_PASSWORD has leading/trailing whitespace');
  }
  
  if (issues.length === 0) {
    logger.info('✅ No issues detected with environment variable loading');
  } else {
    issues.forEach(issue => logger.info(issue));
  }
  
  // Final diagnosis
  logger.info('\n🎯 DIAGNOSIS:');
  const allCredsSet = process.env.TRAVELTEK_FTP_HOST && process.env.TRAVELTEK_FTP_USER && process.env.TRAVELTEK_FTP_PASSWORD;
  
  if (allCredsSet) {
    logger.info('✅ All FTP credentials are SET in environment variables');
    logger.info('✅ If FTP connections are still failing, the issue is likely:');
    logger.info('   • Incorrect credential values (wrong host/user/password)');
    logger.info('   • Network connectivity issues to FTP server');
    logger.info('   • FTP server configuration problems');
    logger.info('   • Firewall blocking connections');
  } else {
    logger.info('❌ Missing FTP credentials in environment variables');
    logger.info('❌ This WILL cause "FTP connection failed" errors');
    logger.info('❌ SOLUTION: Add the missing environment variables to Render backend service');
  }
  
  // Show exact variable names required
  logger.info('\n📝 EXACT ENVIRONMENT VARIABLE NAMES REQUIRED:');
  logger.info('   TRAVELTEK_FTP_HOST=<ftp-server-address>');
  logger.info('   TRAVELTEK_FTP_USER=<ftp-username>');  
  logger.info('   TRAVELTEK_FTP_PASSWORD=<ftp-password>');
  
  logger.info('\n✅ Credential verification completed!');
}

// Run the verification
main();