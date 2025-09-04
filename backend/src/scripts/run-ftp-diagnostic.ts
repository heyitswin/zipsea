#!/usr/bin/env tsx

/**
 * FTP Diagnostic Test Runner
 * 
 * This script runs the comprehensive FTP diagnostic to identify why:
 * - Royal Caribbean has only 4% success rate
 * - AmaWaterways has only 24% success rate
 * 
 * Usage:
 *   npm run tsx src/scripts/run-ftp-diagnostic.ts
 * 
 * Or with custom parameters:
 *   npm run tsx src/scripts/run-ftp-diagnostic.ts --lines=22,63 --max-cruises=10
 */

import { runComprehensiveFtpDiagnostic } from './comprehensive-ftp-diagnostic';
import { logger } from '../config/logger';

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  
  let lineIds = [22, 63]; // Default: Royal Caribbean, AmaWaterways
  let maxCruisesPerLine = 20; // Default: test 20 cruises per line
  
  for (const arg of args) {
    if (arg.startsWith('--lines=')) {
      lineIds = arg.split('=')[1].split(',').map(id => parseInt(id.trim()));
    } else if (arg.startsWith('--max-cruises=')) {
      maxCruisesPerLine = parseInt(arg.split('=')[1]);
    }
  }
  
  logger.info('🚀 Starting FTP Diagnostic Test Runner', {
    lineIds,
    maxCruisesPerLine,
    timestamp: new Date().toISOString()
  });
  
  try {
    const results = await runComprehensiveFtpDiagnostic();
    
    logger.info('\n✅ Diagnostic completed successfully!');
    logger.info('\nNext steps:');
    logger.info('1. Review the detailed logs above');
    logger.info('2. Check the recommendations for each cruise line');
    logger.info('3. Implement the suggested fixes');
    logger.info('4. Re-run the diagnostic to verify improvements');
    
    // Exit with success code
    process.exit(0);
    
  } catch (error) {
    logger.error('❌ Diagnostic failed:', error);
    
    logger.error('\nTroubleshooting:');
    logger.error('1. Check FTP credentials are set in environment variables');
    logger.error('2. Ensure database connection is working');
    logger.error('3. Verify network connectivity to FTP server');
    
    // Exit with error code
    process.exit(1);
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  logger.info('\n⏹️  Diagnostic interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  logger.info('\n⏹️  Diagnostic terminated');
  process.exit(1);
});

// Run the diagnostic
main();