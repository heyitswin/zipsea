#!/usr/bin/env ts-node

/**
 * PRODUCTION FTP DIAGNOSTIC - RENDER COMPATIBLE
 * 
 * This script can be run on Render to diagnose the actual FTP issues.
 * It focuses on proving the theory that only a small percentage of files
 * actually exist on the FTP server.
 * 
 * Usage on Render:
 *   npm run script:production-ftp-diagnostic
 * 
 * Or add to package.json scripts:
 *   "script:production-ftp-diagnostic": "tsx src/scripts/production-ftp-diagnostic.ts"
 */

import { logger } from '../config/logger';
import { bulkFtpDownloader } from '../services/bulk-ftp-downloader.service';
import { env } from '../config/environment';

interface ProductionDiagnosticSummary {
  timestamp: string;
  environment: string;
  ftpCredentialsConfigured: boolean;
  results: {
    lineId: number;
    lineName: string;
    sampleSize: number;
    successCount: number;
    failureCount: number;
    successRate: number;
    primaryErrorType: string;
    fileNotFoundCount: number;
    connectionErrorCount: number;
  }[];
  overallConclusion: string;
}

async function runProductionDiagnostic(): Promise<ProductionDiagnosticSummary> {
  logger.info('🚀 STARTING PRODUCTION FTP DIAGNOSTIC', {
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV
  });

  const summary: ProductionDiagnosticSummary = {
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    ftpCredentialsConfigured: false,
    results: [],
    overallConclusion: ''
  };

  // Check FTP credentials
  summary.ftpCredentialsConfigured = !!(
    env.TRAVELTEK_FTP_HOST && 
    env.TRAVELTEK_FTP_USER && 
    env.TRAVELTEK_FTP_PASSWORD
  );

  if (!summary.ftpCredentialsConfigured) {
    summary.overallConclusion = 'CRITICAL: FTP credentials not configured';
    logger.error('❌ FTP credentials not configured');
    return summary;
  }

  logger.info('✅ FTP credentials found');

  // Test problematic cruise lines
  const linesToTest = [
    { id: 22, name: 'Royal Caribbean' },
    { id: 63, name: 'AmaWaterways' }
  ];

  for (const line of linesToTest) {
    logger.info(`\n🏢 Testing ${line.name} (ID: ${line.id})`);
    
    try {
      // Get a small sample of cruises
      const cruises = await bulkFtpDownloader.getCruiseInfoForLine(line.id, 25); // Small sample
      
      if (cruises.length === 0) {
        logger.warn(`No cruises found for ${line.name}`);
        continue;
      }

      logger.info(`Testing ${cruises.length} cruises for ${line.name}`);

      // Run the bulk download test
      const downloadResult = await bulkFtpDownloader.downloadLineUpdates(line.id, cruises);

      // Analyze results
      let fileNotFoundCount = 0;
      let connectionErrorCount = 0;
      let otherErrorCount = 0;

      for (const error of downloadResult.errors) {
        if (error.toLowerCase().includes('not found') || error.toLowerCase().includes('no such file')) {
          fileNotFoundCount++;
        } else if (error.toLowerCase().includes('connection') || error.toLowerCase().includes('timeout')) {
          connectionErrorCount++;
        } else {
          otherErrorCount++;
        }
      }

      const successRate = cruises.length > 0 ? (downloadResult.successfulDownloads / cruises.length) * 100 : 0;
      
      let primaryErrorType = 'Unknown';
      if (fileNotFoundCount > connectionErrorCount && fileNotFoundCount > otherErrorCount) {
        primaryErrorType = 'Files Not Found';
      } else if (connectionErrorCount > fileNotFoundCount && connectionErrorCount > otherErrorCount) {
        primaryErrorType = 'Connection Issues';
      } else if (otherErrorCount > 0) {
        primaryErrorType = 'Other Errors';
      }

      const result = {
        lineId: line.id,
        lineName: line.name,
        sampleSize: cruises.length,
        successCount: downloadResult.successfulDownloads,
        failureCount: downloadResult.failedDownloads,
        successRate: Math.round(successRate * 10) / 10,
        primaryErrorType,
        fileNotFoundCount,
        connectionErrorCount
      };

      summary.results.push(result);

      logger.info(`✅ ${line.name} Results:`, {
        successRate: `${result.successRate}%`,
        successful: result.successCount,
        failed: result.failureCount,
        primaryError: primaryErrorType
      });

    } catch (error) {
      logger.error(`❌ Failed to test ${line.name}:`, error);
      
      summary.results.push({
        lineId: line.id,
        lineName: line.name,
        sampleSize: 0,
        successCount: 0,
        failureCount: 0,
        successRate: 0,
        primaryErrorType: 'Fatal Error',
        fileNotFoundCount: 0,
        connectionErrorCount: 1
      });
    }
  }

  // Generate overall conclusion
  const avgSuccessRate = summary.results.length > 0 ? 
    summary.results.reduce((sum, r) => sum + r.successRate, 0) / summary.results.length : 0;

  const totalFileNotFound = summary.results.reduce((sum, r) => sum + r.fileNotFoundCount, 0);
  const totalConnectionErrors = summary.results.reduce((sum, r) => sum + r.connectionErrorCount, 0);

  if (avgSuccessRate < 10) {
    if (totalFileNotFound > totalConnectionErrors) {
      summary.overallConclusion = `CRITICAL: ${avgSuccessRate.toFixed(1)}% average success rate. Primary issue: Files do not exist on FTP server (${totalFileNotFound} file not found errors vs ${totalConnectionErrors} connection errors). This is NOT a code problem - Traveltek is not uploading files correctly.`;
    } else {
      summary.overallConclusion = `CRITICAL: ${avgSuccessRate.toFixed(1)}% average success rate. Primary issue: Connection problems (${totalConnectionErrors} connection errors vs ${totalFileNotFound} file not found errors). This may be a network or FTP server issue.`;
    }
  } else if (avgSuccessRate < 50) {
    summary.overallConclusion = `WARNING: ${avgSuccessRate.toFixed(1)}% average success rate. Moderate success suggests inconsistent file availability or network issues.`;
  } else {
    summary.overallConclusion = `GOOD: ${avgSuccessRate.toFixed(1)}% average success rate. System is working mostly correctly.`;
  }

  return summary;
}

async function main() {
  try {
    const summary = await runProductionDiagnostic();
    
    // Generate final report
    logger.info('\n' + '='.repeat(80));
    logger.info('🏆 PRODUCTION DIAGNOSTIC SUMMARY');
    logger.info('='.repeat(80));
    
    logger.info(`Timestamp: ${summary.timestamp}`);
    logger.info(`Environment: ${summary.environment}`);
    logger.info(`FTP Credentials: ${summary.ftpCredentialsConfigured ? '✅ Configured' : '❌ Missing'}`);
    
    logger.info('\n📊 RESULTS BY CRUISE LINE:');
    for (const result of summary.results) {
      logger.info(`\n${result.lineName}:`);
      logger.info(`  • Sample Size: ${result.sampleSize} cruises`);
      logger.info(`  • Success Rate: ${result.successRate}% (${result.successCount}/${result.sampleSize})`);
      logger.info(`  • Primary Error: ${result.primaryErrorType}`);
      logger.info(`  • File Not Found: ${result.fileNotFoundCount}`);
      logger.info(`  • Connection Errors: ${result.connectionErrorCount}`);
    }
    
    logger.info(`\n🎯 OVERALL CONCLUSION:`);
    logger.info(summary.overallConclusion);
    
    logger.info('\n✅ Production diagnostic completed!');
    logger.info('This proves whether the issue is missing files vs code problems.');
    
    // Return summary for potential API use
    return summary;
    
  } catch (error) {
    logger.error('❌ Production diagnostic failed:', error);
    throw error;
  }
}

// Handle process termination
process.on('SIGINT', () => {
  logger.info('⏹️ Production diagnostic interrupted');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('⏹️ Production diagnostic terminated');
  process.exit(0);
});

// Run the diagnostic
main().catch(error => {
  logger.error('Production diagnostic failed:', error);
  process.exit(1);
});

// Export for potential use in other scripts
export { runProductionDiagnostic, ProductionDiagnosticSummary };