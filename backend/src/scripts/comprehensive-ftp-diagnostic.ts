/**
 * COMPREHENSIVE FTP DIAGNOSTIC SCRIPT
 * 
 * This script provides detailed diagnostics for FTP download issues.
 * It systematically tests all potential failure points:
 * 
 * 1. FTP Path Structure Issues
 * 2. Actual File Availability 
 * 3. Connection/Network Issues
 * 4. Code Logic Issues
 * 5. Database Update Issues
 * 
 * Purpose: Identify WHY Royal Caribbean (22) has 4% success rate and AmaWaterways (63) has 24% success rate
 */

import { logger } from '../config/logger';
import * as ftp from 'basic-ftp';
import { env } from '../config/environment';
import { db } from '../db/connection';
import { sql } from 'drizzle-orm';
import { cruises, ships } from '../db/schema';
import { getWebhookLineId } from '../config/cruise-line-mapping';

interface DiagnosticResult {
  lineId: number;
  lineName: string;
  totalCruises: number;
  pathsAttempted: number;
  pathsSuccessful: number;
  filesFound: number;
  filesNotFound: number;
  downloadSuccessful: number;
  downloadFailed: number;
  connectionErrors: number;
  parseErrors: number;
  databaseUpdateErrors: number;
  detailedResults: DiagnosticDetail[];
  summary: {
    ftpConnectivity: 'PASS' | 'FAIL' | 'PARTIAL';
    pathStructure: 'PASS' | 'FAIL' | 'PARTIAL';
    fileAvailability: 'PASS' | 'FAIL' | 'PARTIAL';
    networkStability: 'PASS' | 'FAIL' | 'PARTIAL';
    codeLogic: 'PASS' | 'FAIL' | 'PARTIAL';
  };
  recommendations: string[];
}

interface DiagnosticDetail {
  cruiseId: string;
  shipName: string;
  shipId?: string;
  sailingDate: string;
  pathsAttempted: string[];
  pathUsed?: string;
  fileNamesAttempted: string[];
  fileNameUsed?: string;
  fileExists: boolean;
  fileSize?: number;
  downloadSuccess: boolean;
  downloadTime?: number;
  parseSuccess: boolean;
  databaseUpdateSuccess: boolean;
  error?: string;
  errorType?: 'connection' | 'path' | 'file' | 'parse' | 'database';
}

export class ComprehensiveFtpDiagnostic {
  private client: ftp.Client | null = null;
  private readonly CONNECTION_TIMEOUT = 30000;
  private readonly DOWNLOAD_TIMEOUT = 45000;
  
  /**
   * Run full diagnostic on specified cruise lines
   */
  async runDiagnostic(lineIds: number[], maxCruisesPerLine: number = 50): Promise<DiagnosticResult[]> {
    logger.info('🔍 STARTING COMPREHENSIVE FTP DIAGNOSTIC', {
      lineIds,
      maxCruisesPerLine,
      timestamp: new Date().toISOString()
    });

    const results: DiagnosticResult[] = [];

    for (const lineId of lineIds) {
      logger.info(`\n🏢 DIAGNOSING LINE ${lineId}`);
      const result = await this.diagnoseLine(lineId, maxCruisesPerLine);
      results.push(result);
      
      // Clean break between lines
      if (this.client) {
        try {
          await this.client.close();
        } catch {}
        this.client = null;
      }
      
      // Brief pause between lines
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Generate comprehensive report
    this.generateComprehensiveReport(results);
    
    return results;
  }

  /**
   * Diagnose a specific cruise line
   */
  private async diagnoseLine(lineId: number, maxCruises: number): Promise<DiagnosticResult> {
    const lineNames: Record<number, string> = {
      22: 'Royal Caribbean',
      63: 'AmaWaterways',
      15: 'Holland America',
      3: 'Celebrity Cruises',
      1: 'P&O Cruises'
    };

    const result: DiagnosticResult = {
      lineId,
      lineName: lineNames[lineId] || `Line ${lineId}`,
      totalCruises: 0,
      pathsAttempted: 0,
      pathsSuccessful: 0,
      filesFound: 0,
      filesNotFound: 0,
      downloadSuccessful: 0,
      downloadFailed: 0,
      connectionErrors: 0,
      parseErrors: 0,
      databaseUpdateErrors: 0,
      detailedResults: [],
      summary: {
        ftpConnectivity: 'FAIL',
        pathStructure: 'FAIL',
        fileAvailability: 'FAIL',
        networkStability: 'FAIL',
        codeLogic: 'FAIL'
      },
      recommendations: []
    };

    try {
      // Step 1: Test FTP Connectivity
      logger.info(`📡 Step 1: Testing FTP connectivity for line ${lineId}`);
      const connectSuccess = await this.testFtpConnectivity();
      result.summary.ftpConnectivity = connectSuccess ? 'PASS' : 'FAIL';
      
      if (!connectSuccess) {
        result.recommendations.push('FTP connection failed - check credentials and network');
        return result;
      }

      // Step 2: Get cruise data
      logger.info(`📊 Step 2: Fetching cruise data for line ${lineId}`);
      const cruises = await this.getCruiseData(lineId, maxCruises);
      result.totalCruises = cruises.length;

      if (cruises.length === 0) {
        result.recommendations.push('No cruises found in database for this line');
        return result;
      }

      logger.info(`Found ${cruises.length} cruises to test`);

      // Step 3: Test each cruise systematically
      logger.info(`🔬 Step 3: Testing each cruise systematically`);
      
      let connectionStable = true;
      let pathStructureGood = 0;
      let fileAvailabilityGood = 0;

      for (let i = 0; i < cruises.length; i++) {
        const cruise = cruises[i];
        logger.info(`\n📋 Testing cruise ${i + 1}/${cruises.length}: ${cruise.id}`);
        
        const detail = await this.diagnoseCruise(cruise);
        result.detailedResults.push(detail);
        
        // Update counters
        result.pathsAttempted += detail.pathsAttempted.length;
        if (detail.pathUsed) result.pathsSuccessful++;
        if (detail.fileExists) result.filesFound++;
        else result.filesNotFound++;
        
        if (detail.downloadSuccess) result.downloadSuccessful++;
        else result.downloadFailed++;
        
        if (detail.errorType === 'connection') {
          result.connectionErrors++;
          connectionStable = false;
        } else if (detail.errorType === 'parse') {
          result.parseErrors++;
        } else if (detail.errorType === 'database') {
          result.databaseUpdateErrors++;
        }
        
        if (detail.pathUsed) pathStructureGood++;
        if (detail.fileExists) fileAvailabilityGood++;
        
        // Brief pause between cruises
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Calculate summary scores
      result.summary.networkStability = connectionStable ? 'PASS' : (result.connectionErrors < cruises.length * 0.3 ? 'PARTIAL' : 'FAIL');
      result.summary.pathStructure = pathStructureGood > cruises.length * 0.8 ? 'PASS' : (pathStructureGood > cruises.length * 0.3 ? 'PARTIAL' : 'FAIL');
      result.summary.fileAvailability = fileAvailabilityGood > cruises.length * 0.8 ? 'PASS' : (fileAvailabilityGood > cruises.length * 0.3 ? 'PARTIAL' : 'FAIL');
      result.summary.codeLogic = (result.downloadSuccessful / Math.max(result.filesFound, 1)) > 0.9 ? 'PASS' : 'PARTIAL';

      // Generate recommendations
      this.generateRecommendations(result);

    } catch (error) {
      logger.error(`❌ Fatal error diagnosing line ${lineId}:`, error);
      result.recommendations.push(`Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      if (this.client) {
        try {
          await this.client.close();
        } catch {}
        this.client = null;
      }
    }

    return result;
  }

  /**
   * Test FTP connectivity
   */
  private async testFtpConnectivity(): Promise<boolean> {
    try {
      logger.info('🔌 Testing FTP connection...');
      
      if (!env.TRAVELTEK_FTP_HOST || !env.TRAVELTEK_FTP_USER || !env.TRAVELTEK_FTP_PASSWORD) {
        logger.error('❌ Missing FTP credentials');
        return false;
      }

      this.client = new ftp.Client();
      this.client.ftp.verbose = true; // Enable verbose logging for diagnostics

      const connectPromise = this.client.access({
        host: env.TRAVELTEK_FTP_HOST,
        user: env.TRAVELTEK_FTP_USER,
        password: env.TRAVELTEK_FTP_PASSWORD,
        secure: false
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout')), this.CONNECTION_TIMEOUT);
      });

      await Promise.race([connectPromise, timeoutPromise]);
      
      // Test basic operations
      const pwd = await this.client.pwd();
      logger.info('✅ FTP connection successful', { pwd });
      
      return true;

    } catch (error) {
      logger.error('❌ FTP connection failed:', error);
      return false;
    }
  }

  /**
   * Get cruise data for testing
   */
  private async getCruiseData(lineId: number, limit: number) {
    try {
      const cruiseData = await db
        .select({
          id: cruises.id,
          cruiseCode: cruises.cruiseId,
          shipId: cruises.shipId,
          shipName: sql<string>`COALESCE(ships.name, 'Unknown_Ship')`,
          sailingDate: cruises.sailingDate
        })
        .from(cruises)
        .leftJoin(ships, sql`${ships.id} = ${cruises.shipId}`)
        .where(
          sql`${cruises.cruiseLineId} = ${lineId} 
              AND ${cruises.sailingDate} >= CURRENT_DATE 
              AND ${cruises.sailingDate} <= CURRENT_DATE + INTERVAL '2 years'
              AND ${cruises.isActive} = true`
        )
        .orderBy(sql`${cruises.sailingDate} ASC`)
        .limit(limit);

      return cruiseData.map(cruise => ({
        id: cruise.id,
        cruiseCode: cruise.cruiseCode,
        shipId: cruise.shipId,
        shipName: cruise.shipName || `Ship_${cruise.id}`,
        sailingDate: new Date(cruise.sailingDate)
      }));

    } catch (error) {
      logger.error('❌ Failed to get cruise data:', error);
      return [];
    }
  }

  /**
   * Diagnose a single cruise thoroughly
   */
  private async diagnoseCruise(cruise: any): Promise<DiagnosticDetail> {
    const detail: DiagnosticDetail = {
      cruiseId: cruise.id,
      shipName: cruise.shipName,
      shipId: cruise.shipId,
      sailingDate: cruise.sailingDate.toISOString().split('T')[0],
      pathsAttempted: [],
      fileNamesAttempted: [],
      fileExists: false,
      downloadSuccess: false,
      parseSuccess: false,
      databaseUpdateSuccess: false
    };

    try {
      if (!this.client) {
        detail.error = 'No FTP connection';
        detail.errorType = 'connection';
        return detail;
      }

      // Generate all possible paths
      const paths = this.generatePossiblePaths(cruise);
      detail.pathsAttempted = paths;

      logger.info(`🔍 Testing ${paths.length} possible paths for cruise ${cruise.id}`);

      // Try each path
      let workingPath: string | null = null;
      for (const path of paths) {
        try {
          await this.client.cd(path);
          workingPath = path;
          detail.pathUsed = path;
          logger.info(`✅ Path found: ${path}`);
          break;
        } catch (error) {
          logger.debug(`❌ Path failed: ${path} - ${error instanceof Error ? error.message : 'Unknown'}`);
        }
      }

      if (!workingPath) {
        detail.error = `All paths failed: ${paths.join(', ')}`;
        detail.errorType = 'path';
        return detail;
      }

      // Test file existence
      const fileNames = this.generatePossibleFileNames(cruise);
      detail.fileNamesAttempted = fileNames;

      logger.info(`🔍 Testing ${fileNames.length} possible file names`);

      let workingFileName: string | null = null;
      for (const fileName of fileNames) {
        try {
          const list = await this.client.list();
          const fileFound = list.find(item => item.name.toLowerCase() === fileName.toLowerCase());
          
          if (fileFound) {
            workingFileName = fileName;
            detail.fileNameUsed = fileName;
            detail.fileExists = true;
            detail.fileSize = fileFound.size;
            logger.info(`✅ File found: ${fileName} (${fileFound.size} bytes)`);
            break;
          }
        } catch (error) {
          logger.debug(`❌ File check failed: ${fileName} - ${error instanceof Error ? error.message : 'Unknown'}`);
        }
      }

      if (!workingFileName) {
        detail.error = `No files found: ${fileNames.join(', ')}`;
        detail.errorType = 'file';
        return detail;
      }

      // Test download
      logger.info(`⬇️ Attempting download of ${workingFileName}`);
      const downloadStart = Date.now();
      
      try {
        const data = await this.downloadFileToMemory(workingFileName);
        detail.downloadTime = Date.now() - downloadStart;
        detail.downloadSuccess = true;
        
        logger.info(`✅ Download successful: ${data.length} bytes in ${detail.downloadTime}ms`);

        // Test parsing
        try {
          const jsonData = JSON.parse(data);
          detail.parseSuccess = true;
          logger.info(`✅ JSON parse successful`);

          // Test database update (dry run)
          try {
            await this.testDatabaseUpdate(cruise.id, jsonData);
            detail.databaseUpdateSuccess = true;
            logger.info(`✅ Database update test successful`);
          } catch (dbError) {
            detail.error = `Database update failed: ${dbError instanceof Error ? dbError.message : 'Unknown'}`;
            detail.errorType = 'database';
          }

        } catch (parseError) {
          detail.error = `JSON parse failed: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`;
          detail.errorType = 'parse';
        }

      } catch (downloadError) {
        detail.error = `Download failed: ${downloadError instanceof Error ? downloadError.message : 'Unknown'}`;
        detail.errorType = 'connection';
      }

    } catch (error) {
      detail.error = `Unexpected error: ${error instanceof Error ? error.message : 'Unknown'}`;
      detail.errorType = 'connection';
    }

    return detail;
  }

  /**
   * Generate all possible FTP paths for a cruise
   */
  private generatePossiblePaths(cruise: any): string[] {
    const paths: string[] = [];
    const webhookLineId = getWebhookLineId(cruise.cruiseLineId || 22); // Fallback to Royal Caribbean
    
    // Generate year/month combinations
    const sailingDate = cruise.sailingDate;
    const year = sailingDate.getFullYear();
    const month = String(sailingDate.getMonth() + 1).padStart(2, '0');
    
    // Also try current date (in case files are organized by upload date)
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
    
    const yearMonths = [
      `${year}/${month}`,
      `${currentYear}/${currentMonth}`
    ];
    
    // Remove duplicates
    const uniqueYearMonths = [...new Set(yearMonths)];
    
    // Ship variations
    const shipKeys: string[] = [];
    if (cruise.shipId) shipKeys.push(cruise.shipId);
    if (cruise.shipName) {
      shipKeys.push(cruise.shipName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').toLowerCase());
      shipKeys.push(cruise.shipName.replace(/[^a-zA-Z0-9]/g, ''));
      shipKeys.push(cruise.shipName);
    }
    
    // Remove duplicates
    const uniqueShipKeys = [...new Set(shipKeys)];
    
    for (const yearMonth of uniqueYearMonths) {
      // Pattern 1: Root level paths
      paths.push(`/${yearMonth}/${webhookLineId}`);
      paths.push(`/${yearMonth}/${cruise.cruiseLineId || webhookLineId}`); // Try database line ID too
      
      // Pattern 2: isell_json paths
      paths.push(`/isell_json/${yearMonth}/${webhookLineId}`);
      paths.push(`/isell_json/${yearMonth}/${cruise.cruiseLineId || webhookLineId}`);
      
      // Pattern 3: With ship subdirectories
      for (const shipKey of uniqueShipKeys) {
        paths.push(`/${yearMonth}/${webhookLineId}/${shipKey}`);
        paths.push(`/${yearMonth}/${cruise.cruiseLineId || webhookLineId}/${shipKey}`);
        paths.push(`/isell_json/${yearMonth}/${webhookLineId}/${shipKey}`);
        paths.push(`/isell_json/${yearMonth}/${cruise.cruiseLineId || webhookLineId}/${shipKey}`);
      }
    }
    
    // Remove duplicates and limit
    return [...new Set(paths)].slice(0, 30);
  }

  /**
   * Generate all possible file names for a cruise
   */
  private generatePossibleFileNames(cruise: any): string[] {
    const names: string[] = [];
    
    // Primary patterns
    names.push(`${cruise.id}.json`);
    names.push(`${cruise.cruiseCode}.json`);
    
    // Case variations
    names.push(`${cruise.id}.json`.toLowerCase());
    names.push(`${cruise.id}.json`.toUpperCase());
    names.push(`${cruise.cruiseCode}.json`.toLowerCase());
    names.push(`${cruise.cruiseCode}.json`.toUpperCase());
    
    // Remove duplicates
    return [...new Set(names)];
  }

  /**
   * Download file to memory with detailed logging
   */
  private async downloadFileToMemory(fileName: string): Promise<string> {
    if (!this.client) throw new Error('No FTP connection');
    
    const chunks: Buffer[] = [];
    
    const stream = require('stream');
    const memoryStream = new stream.Writable({
      write(chunk: Buffer, encoding: any, callback: any) {
        chunks.push(chunk);
        callback();
      }
    });
    
    const downloadPromise = this.client.downloadTo(memoryStream, fileName);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Download timeout')), this.DOWNLOAD_TIMEOUT);
    });
    
    await Promise.race([downloadPromise, timeoutPromise]);
    
    return Buffer.concat(chunks).toString('utf-8');
  }

  /**
   * Test database update without actually updating
   */
  private async testDatabaseUpdate(cruiseId: string, data: any): Promise<void> {
    // Just validate the data structure without updating
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid data structure');
    }
    
    if (!data.prices || typeof data.prices !== 'object') {
      throw new Error('Missing or invalid prices structure');
    }
    
    // Count potential pricing records
    let recordCount = 0;
    for (const [rateCode, cabins] of Object.entries(data.prices)) {
      if (typeof cabins === 'object') {
        for (const [cabinCode, occupancies] of Object.entries(cabins as any)) {
          if (typeof occupancies === 'object') {
            recordCount += Object.keys(occupancies as any).length;
          }
        }
      }
    }
    
    if (recordCount === 0) {
      throw new Error('No valid pricing records found');
    }
    
    logger.debug(`✅ Would create ${recordCount} pricing records`);
  }

  /**
   * Generate recommendations based on results
   */
  private generateRecommendations(result: DiagnosticResult): void {
    const recommendations: string[] = [];
    
    if (result.summary.ftpConnectivity === 'FAIL') {
      recommendations.push('CRITICAL: FTP connection failing - check credentials and network connectivity');
    }
    
    if (result.summary.pathStructure === 'FAIL') {
      recommendations.push('CRITICAL: Path structure issue - most cruise files are in incorrect directories');
      recommendations.push('Review FTP server directory structure and update path generation logic');
    } else if (result.summary.pathStructure === 'PARTIAL') {
      recommendations.push('WARNING: Some paths failing - review path generation patterns');
    }
    
    if (result.summary.fileAvailability === 'FAIL') {
      recommendations.push('CRITICAL: Most files do not exist on FTP server');
      recommendations.push('Check if files are being uploaded correctly or if cruise data is outdated');
    } else if (result.summary.fileAvailability === 'PARTIAL') {
      recommendations.push('WARNING: Some files missing - may be normal for future cruises');
    }
    
    if (result.summary.networkStability === 'FAIL') {
      recommendations.push('CRITICAL: Network connection unstable - implement better retry logic');
    } else if (result.summary.networkStability === 'PARTIAL') {
      recommendations.push('WARNING: Some connection issues - monitor network stability');
    }
    
    if (result.connectionErrors > 0) {
      recommendations.push(`Found ${result.connectionErrors} connection errors - investigate network issues`);
    }
    
    if (result.parseErrors > 0) {
      recommendations.push(`Found ${result.parseErrors} parse errors - files may be corrupted or in wrong format`);
    }
    
    if (result.databaseUpdateErrors > 0) {
      recommendations.push(`Found ${result.databaseUpdateErrors} database errors - check data validation logic`);
    }
    
    const successRate = result.totalCruises > 0 ? (result.downloadSuccessful / result.totalCruises) * 100 : 0;
    
    if (successRate < 50) {
      recommendations.push(`CRITICAL: ${successRate.toFixed(1)}% success rate - major issues need immediate attention`);
    } else if (successRate < 90) {
      recommendations.push(`WARNING: ${successRate.toFixed(1)}% success rate - room for improvement`);
    } else {
      recommendations.push(`GOOD: ${successRate.toFixed(1)}% success rate - minor optimizations possible`);
    }
    
    result.recommendations = recommendations;
  }

  /**
   * Generate comprehensive report
   */
  private generateComprehensiveReport(results: DiagnosticResult[]): void {
    logger.info('\n' + '='.repeat(80));
    logger.info('📊 COMPREHENSIVE FTP DIAGNOSTIC REPORT');
    logger.info('='.repeat(80));
    
    for (const result of results) {
      logger.info(`\n🏢 ${result.lineName} (ID: ${result.lineId})`);
      logger.info('-'.repeat(60));
      
      const successRate = result.totalCruises > 0 ? (result.downloadSuccessful / result.totalCruises) * 100 : 0;
      
      logger.info(`📈 Success Rate: ${successRate.toFixed(1)}% (${result.downloadSuccessful}/${result.totalCruises})`);
      logger.info(`📁 Path Success: ${result.pathsSuccessful}/${result.pathsAttempted} paths worked`);
      logger.info(`📄 File Availability: ${result.filesFound}/${result.totalCruises} files found`);
      
      logger.info(`\n🎯 Summary Scores:`);
      logger.info(`  • FTP Connectivity: ${result.summary.ftpConnectivity}`);
      logger.info(`  • Path Structure: ${result.summary.pathStructure}`);
      logger.info(`  • File Availability: ${result.summary.fileAvailability}`);
      logger.info(`  • Network Stability: ${result.summary.networkStability}`);
      logger.info(`  • Code Logic: ${result.summary.codeLogic}`);
      
      logger.info(`\n⚠️ Error Breakdown:`);
      logger.info(`  • Connection Errors: ${result.connectionErrors}`);
      logger.info(`  • Parse Errors: ${result.parseErrors}`);
      logger.info(`  • Database Errors: ${result.databaseUpdateErrors}`);
      
      logger.info(`\n💡 Recommendations:`);
      for (const rec of result.recommendations) {
        logger.info(`  • ${rec}`);
      }
      
      // Show sample failures
      const failures = result.detailedResults.filter(d => !d.downloadSuccess);
      if (failures.length > 0) {
        logger.info(`\n❌ Sample Failures (showing first 3):`);
        for (const failure of failures.slice(0, 3)) {
          logger.info(`  • Cruise ${failure.cruiseId}: ${failure.error}`);
        }
      }
    }
    
    logger.info('\n' + '='.repeat(80));
    logger.info('🎯 DIAGNOSTIC COMPLETE');
    logger.info('='.repeat(80));
  }
}

/**
 * Main diagnostic function
 */
export async function runComprehensiveFtpDiagnostic() {
  const diagnostic = new ComprehensiveFtpDiagnostic();
  
  // Test the problematic cruise lines
  const lineIds = [22, 63]; // Royal Caribbean, AmaWaterways
  const maxCruisesPerLine = 20; // Start small for testing
  
  try {
    const results = await diagnostic.runDiagnostic(lineIds, maxCruisesPerLine);
    
    logger.info('\n🎯 DIAGNOSTIC SUMMARY:');
    for (const result of results) {
      const successRate = result.totalCruises > 0 ? (result.downloadSuccessful / result.totalCruises) * 100 : 0;
      logger.info(`${result.lineName}: ${successRate.toFixed(1)}% success rate`);
    }
    
    return results;
    
  } catch (error) {
    logger.error('❌ Diagnostic failed:', error);
    throw error;
  }
}

// Export for use in other scripts
export { DiagnosticResult, DiagnosticDetail };