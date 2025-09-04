#!/usr/bin/env ts-node

/**
 * FTP PATTERNS ANALYZER
 * 
 * This script analyzes the FTP path generation logic and cruise data patterns
 * to identify potential issues WITHOUT requiring actual FTP credentials.
 * 
 * It focuses on:
 * 1. Database query patterns and cruise data quality
 * 2. FTP path generation logic validation  
 * 3. File name generation patterns
 * 4. Year/month combinations and sailing dates
 * 5. Ship ID/Name mapping issues
 * 
 * This can reveal issues that would cause low success rates even with valid credentials.
 */

import { logger } from '../config/logger';
import { db } from '../db/connection';
import { sql } from 'drizzle-orm';
import { cruises, ships } from '../db/schema';
import { getWebhookLineId } from '../config/cruise-line-mapping';

interface CruiseAnalysis {
  id: string;
  cruiseCode: string;
  shipId?: string;
  shipName: string;
  sailingDate: Date;
  possiblePaths: string[];
  possibleFileNames: string[];
  potentialIssues: string[];
  lineId: number;
}

interface LineAnalysis {
  lineId: number;
  lineName: string;
  webhookLineId: number;
  totalCruises: number;
  cruisesWithShipId: number;
  cruisesWithShipName: number;
  uniqueShips: number;
  sailingDateRange: {
    earliest: Date;
    latest: Date;
  };
  yearMonthCombinations: Set<string>;
  sampleCruises: CruiseAnalysis[];
  potentialIssues: string[];
  pathPatterns: {
    totalPaths: number;
    uniquePathTemplates: Set<string>;
  };
}

export class FtpPatternsAnalyzer {
  private readonly MAX_SAMPLE_CRUISES = 10;

  /**
   * Analyze FTP patterns for problematic cruise lines
   */
  async analyzeLines(lineIds: number[]): Promise<LineAnalysis[]> {
    logger.info('🔍 STARTING FTP PATTERNS ANALYSIS', {
      lineIds,
      timestamp: new Date().toISOString()
    });

    const results: LineAnalysis[] = [];

    for (const lineId of lineIds) {
      logger.info(`\n🏢 ANALYZING LINE ${lineId}`);
      const analysis = await this.analyzeLine(lineId);
      results.push(analysis);
    }

    this.generateComprehensiveReport(results);
    return results;
  }

  /**
   * Analyze a specific cruise line's patterns
   */
  private async analyzeLine(lineId: number): Promise<LineAnalysis> {
    const lineNames: Record<number, string> = {
      22: 'Royal Caribbean',
      63: 'AmaWaterways',
      15: 'Holland America',
      3: 'Celebrity Cruises',
      1: 'P&O Cruises'
    };

    const analysis: LineAnalysis = {
      lineId,
      lineName: lineNames[lineId] || `Line ${lineId}`,
      webhookLineId: getWebhookLineId(lineId),
      totalCruises: 0,
      cruisesWithShipId: 0,
      cruisesWithShipName: 0,
      uniqueShips: 0,
      sailingDateRange: {
        earliest: new Date(),
        latest: new Date()
      },
      yearMonthCombinations: new Set(),
      sampleCruises: [],
      potentialIssues: [],
      pathPatterns: {
        totalPaths: 0,
        uniquePathTemplates: new Set()
      }
    };

    try {
      // Get comprehensive cruise data
      logger.info(`📊 Fetching cruise data for line ${lineId}...`);
      
      const cruiseData = await db
        .select({
          id: cruises.id,
          cruiseCode: cruises.cruiseId,
          shipId: cruises.shipId,
          shipName: sql<string>`COALESCE(ships.name, 'Unknown_Ship')`,
          sailingDate: cruises.sailingDate,
          isActive: cruises.isActive
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
        .limit(500); // Get more data for analysis

      analysis.totalCruises = cruiseData.length;
      
      if (cruiseData.length === 0) {
        analysis.potentialIssues.push('No active cruises found in database for this line within date range');
        return analysis;
      }

      logger.info(`Found ${cruiseData.length} cruises to analyze`);

      // Analyze cruise data quality
      const sailingDates = cruiseData.map(c => new Date(c.sailingDate));
      analysis.sailingDateRange.earliest = new Date(Math.min(...sailingDates.map(d => d.getTime())));
      analysis.sailingDateRange.latest = new Date(Math.max(...sailingDates.map(d => d.getTime())));

      // Count data quality metrics
      for (const cruise of cruiseData) {
        if (cruise.shipId) analysis.cruisesWithShipId++;
        if (cruise.shipName && cruise.shipName !== 'Unknown_Ship') analysis.cruisesWithShipName++;
        
        // Track year/month combinations
        const date = new Date(cruise.sailingDate);
        const yearMonth = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`;
        analysis.yearMonthCombinations.add(yearMonth);
      }

      // Count unique ships
      const shipIdentifiers = new Set<string>();
      for (const cruise of cruiseData) {
        if (cruise.shipId) shipIdentifiers.add(cruise.shipId);
        if (cruise.shipName && cruise.shipName !== 'Unknown_Ship') {
          shipIdentifiers.add(cruise.shipName);
        }
      }
      analysis.uniqueShips = shipIdentifiers.size;

      // Analyze sample cruises in detail
      const sampleCruises = cruiseData.slice(0, this.MAX_SAMPLE_CRUISES);
      for (const cruise of sampleCruises) {
        const cruiseAnalysis = this.analyzeCruise(cruise, analysis.webhookLineId);
        analysis.sampleCruises.push(cruiseAnalysis);
        
        // Aggregate path patterns
        analysis.pathPatterns.totalPaths += cruiseAnalysis.possiblePaths.length;
        for (const path of cruiseAnalysis.possiblePaths) {
          const template = this.extractPathTemplate(path);
          analysis.pathPatterns.uniquePathTemplates.add(template);
        }
      }

      // Identify potential issues
      this.identifyPotentialIssues(analysis);

      logger.info(`✅ Analysis complete for ${analysis.lineName}`);

    } catch (error) {
      logger.error(`❌ Failed to analyze line ${lineId}:`, error);
      analysis.potentialIssues.push(`Database query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return analysis;
  }

  /**
   * Analyze individual cruise patterns
   */
  private analyzeCruise(cruise: any, webhookLineId: number): CruiseAnalysis {
    const analysis: CruiseAnalysis = {
      id: cruise.id,
      cruiseCode: cruise.cruiseCode,
      shipId: cruise.shipId,
      shipName: cruise.shipName,
      sailingDate: new Date(cruise.sailingDate),
      possiblePaths: [],
      possibleFileNames: [],
      potentialIssues: [],
      lineId: webhookLineId
    };

    // Generate possible paths (same logic as bulk downloader)
    analysis.possiblePaths = this.generatePossiblePaths(cruise, webhookLineId);
    analysis.possibleFileNames = this.generatePossibleFileNames(cruise);

    // Check for potential issues
    if (!cruise.shipId && (!cruise.shipName || cruise.shipName === 'Unknown_Ship')) {
      analysis.potentialIssues.push('Missing both ship ID and ship name - path generation will be incomplete');
    }

    if (!cruise.cruiseCode || cruise.cruiseCode.trim() === '') {
      analysis.potentialIssues.push('Missing cruise code - file name generation will rely only on ID');
    }

    // Check sailing date logic
    const now = new Date();
    const yearDiff = analysis.sailingDate.getFullYear() - now.getFullYear();
    if (yearDiff > 2) {
      analysis.potentialIssues.push('Sailing date is far in the future - files may not exist yet');
    }

    // Check for reasonable path count
    if (analysis.possiblePaths.length < 4) {
      analysis.potentialIssues.push('Very few path variations generated - may miss correct directory');
    }

    if (analysis.possiblePaths.length > 30) {
      analysis.potentialIssues.push('Too many path variations - may indicate excessive guessing');
    }

    return analysis;
  }

  /**
   * Generate possible FTP paths (same logic as bulk downloader but with analysis)
   */
  private generatePossiblePaths(cruise: any, webhookLineId: number): string[] {
    const paths: string[] = [];
    
    // Generate year/month combinations
    const sailingDate = new Date(cruise.sailingDate);
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
    if (cruise.shipName && cruise.shipName !== 'Unknown_Ship') {
      // Various ship name processing patterns
      shipKeys.push(cruise.shipName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').toLowerCase());
      shipKeys.push(cruise.shipName.replace(/[^a-zA-Z0-9]/g, ''));
      shipKeys.push(cruise.shipName.replace(/\s+/g, '_'));
      shipKeys.push(cruise.shipName);
    }
    
    // Remove duplicates
    const uniqueShipKeys = [...new Set(shipKeys)];
    
    for (const yearMonth of uniqueYearMonths) {
      // Pattern 1: Root level paths
      paths.push(`/${yearMonth}/${webhookLineId}`);
      
      // Pattern 2: isell_json paths  
      paths.push(`/isell_json/${yearMonth}/${webhookLineId}`);
      
      // Pattern 3: With ship subdirectories
      for (const shipKey of uniqueShipKeys) {
        paths.push(`/${yearMonth}/${webhookLineId}/${shipKey}`);
        paths.push(`/isell_json/${yearMonth}/${webhookLineId}/${shipKey}`);
      }
    }
    
    // Remove duplicates and return
    return [...new Set(paths)];
  }

  /**
   * Generate possible file names
   */
  private generatePossibleFileNames(cruise: any): string[] {
    const names: string[] = [];
    
    // Primary patterns
    names.push(`${cruise.id}.json`);
    if (cruise.cruiseCode) {
      names.push(`${cruise.cruiseCode}.json`);
    }
    
    // Case variations
    names.push(`${cruise.id}.json`.toLowerCase());
    names.push(`${cruise.id}.json`.toUpperCase());
    if (cruise.cruiseCode) {
      names.push(`${cruise.cruiseCode}.json`.toLowerCase());
      names.push(`${cruise.cruiseCode}.json`.toUpperCase());
    }
    
    // Remove duplicates
    return [...new Set(names)];
  }

  /**
   * Extract path template for pattern analysis
   */
  private extractPathTemplate(path: string): string {
    // Replace specific values with placeholders for pattern matching
    return path
      .replace(/\/\d{4}\/\d{2}\//g, '/YYYY/MM/')
      .replace(/\/\d+\//g, '/LINE_ID/')
      .replace(/\/[^\/]+$/, '/SHIP_KEY');
  }

  /**
   * Identify potential issues with the line's configuration
   */
  private identifyPotentialIssues(analysis: LineAnalysis): void {
    // Data quality issues
    if (analysis.cruisesWithShipId < analysis.totalCruises * 0.5) {
      analysis.potentialIssues.push(`Only ${analysis.cruisesWithShipId}/${analysis.totalCruises} cruises have ship IDs - may cause path issues`);
    }

    if (analysis.cruisesWithShipName < analysis.totalCruises * 0.9) {
      analysis.potentialIssues.push(`Only ${analysis.cruisesWithShipName}/${analysis.totalCruises} cruises have valid ship names`);
    }

    // Line ID mapping issues
    if (analysis.webhookLineId !== analysis.lineId) {
      analysis.potentialIssues.push(`Webhook line ID (${analysis.webhookLineId}) differs from database line ID (${analysis.lineId}) - using mapped ID`);
    }

    // Date range issues
    const daysDiff = Math.floor((analysis.sailingDateRange.latest.getTime() - analysis.sailingDateRange.earliest.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 730) { // More than 2 years
      analysis.potentialIssues.push(`Wide sailing date range (${daysDiff} days) may spread files across many directories`);
    }

    // Year/month combinations
    if (analysis.yearMonthCombinations.size > 12) {
      analysis.potentialIssues.push(`${analysis.yearMonthCombinations.size} year/month combinations - files spread across many directories`);
    }

    // Path complexity
    const avgPathsPerCruise = analysis.pathPatterns.totalPaths / Math.max(analysis.sampleCruises.length, 1);
    if (avgPathsPerCruise > 20) {
      analysis.potentialIssues.push(`High path complexity: ${avgPathsPerCruise.toFixed(1)} average paths per cruise`);
    }

    // Sample cruise issues
    const cruisesWithIssues = analysis.sampleCruises.filter(c => c.potentialIssues.length > 0).length;
    if (cruisesWithIssues > analysis.sampleCruises.length * 0.3) {
      analysis.potentialIssues.push(`${cruisesWithIssues}/${analysis.sampleCruises.length} sample cruises have data quality issues`);
    }
  }

  /**
   * Generate comprehensive report
   */
  private generateComprehensiveReport(results: LineAnalysis[]): void {
    logger.info('\n' + '='.repeat(80));
    logger.info('📊 FTP PATTERNS ANALYSIS REPORT');
    logger.info('='.repeat(80));
    
    for (const result of results) {
      logger.info(`\n🏢 ${result.lineName} (DB ID: ${result.lineId}, Webhook ID: ${result.webhookLineId})`);
      logger.info('-'.repeat(60));
      
      logger.info(`📈 Data Summary:`);
      logger.info(`  • Total Cruises: ${result.totalCruises}`);
      logger.info(`  • Cruises with Ship ID: ${result.cruisesWithShipId} (${Math.round((result.cruisesWithShipId/result.totalCruises)*100)}%)`);
      logger.info(`  • Cruises with Ship Name: ${result.cruisesWithShipName} (${Math.round((result.cruisesWithShipName/result.totalCruises)*100)}%)`);
      logger.info(`  • Unique Ships: ${result.uniqueShips}`);
      
      logger.info(`\n📅 Sailing Date Range:`);
      logger.info(`  • Earliest: ${result.sailingDateRange.earliest.toISOString().split('T')[0]}`);
      logger.info(`  • Latest: ${result.sailingDateRange.latest.toISOString().split('T')[0]}`);
      logger.info(`  • Year/Month Combinations: ${result.yearMonthCombinations.size}`);
      
      logger.info(`\n📁 Path Pattern Analysis:`);
      logger.info(`  • Total Paths Generated: ${result.pathPatterns.totalPaths}`);
      logger.info(`  • Unique Path Templates: ${result.pathPatterns.uniquePathTemplates.size}`);
      logger.info(`  • Average Paths per Cruise: ${(result.pathPatterns.totalPaths / Math.max(result.sampleCruises.length, 1)).toFixed(1)}`);
      
      logger.info(`\n📋 Year/Month Combinations:`);
      const sortedYearMonths = Array.from(result.yearMonthCombinations).sort();
      logger.info(`  • ${sortedYearMonths.slice(0, 6).join(', ')}${sortedYearMonths.length > 6 ? ` ... (+${sortedYearMonths.length - 6} more)` : ''}`);
      
      logger.info(`\n🔧 Path Templates:`);
      for (const template of Array.from(result.pathPatterns.uniquePathTemplates).slice(0, 5)) {
        logger.info(`  • ${template}`);
      }
      
      if (result.potentialIssues.length > 0) {
        logger.info(`\n⚠️ Potential Issues:`);
        for (const issue of result.potentialIssues) {
          logger.info(`  • ${issue}`);
        }
      }
      
      logger.info(`\n🚢 Sample Cruise Analysis:`);
      for (let i = 0; i < Math.min(3, result.sampleCruises.length); i++) {
        const cruise = result.sampleCruises[i];
        logger.info(`  Cruise ${cruise.id}:`);
        logger.info(`    • Ship: ${cruise.shipName} ${cruise.shipId ? `(ID: ${cruise.shipId})` : '(No ID)'}`);
        logger.info(`    • Sailing: ${cruise.sailingDate.toISOString().split('T')[0]}`);
        logger.info(`    • Paths: ${cruise.possiblePaths.length}, Files: ${cruise.possibleFileNames.length}`);
        if (cruise.potentialIssues.length > 0) {
          logger.info(`    • Issues: ${cruise.potentialIssues.join(', ')}`);
        }
      }
    }
    
    logger.info('\n' + '='.repeat(80));
    logger.info('🎯 DIAGNOSIS & RECOMMENDATIONS');
    logger.info('='.repeat(80));
    
    for (const result of results) {
      logger.info(`\n${result.lineName}:`);
      
      // Specific recommendations based on analysis
      const recommendations: string[] = [];
      
      if (result.cruisesWithShipId < result.totalCruises * 0.8) {
        recommendations.push('CRITICAL: Many cruises missing ship IDs - verify ship data sync');
      }
      
      if (result.yearMonthCombinations.size > 24) {
        recommendations.push('WARNING: Files spread across many months - consider date filtering');
      }
      
      if (result.pathPatterns.uniquePathTemplates.size > 10) {
        recommendations.push('WARNING: Complex path patterns - may be trying too many combinations');
      }
      
      const avgPathsPerCruise = result.pathPatterns.totalPaths / Math.max(result.sampleCruises.length, 1);
      if (avgPathsPerCruise > 25) {
        recommendations.push('WARNING: Too many path attempts per cruise - optimize path generation');
      }
      
      if (result.webhookLineId !== result.lineId) {
        recommendations.push('INFO: Using webhook line ID mapping - verify FTP server uses correct ID');
      }
      
      if (recommendations.length === 0) {
        recommendations.push('Data patterns look reasonable - issue likely in FTP connectivity or server-side file availability');
      }
      
      for (const rec of recommendations) {
        logger.info(`  • ${rec}`);
      }
    }
    
    logger.info('\n✅ Pattern analysis complete!');
    logger.info('This analysis helps identify issues that would cause low success rates even with valid FTP credentials.');
  }
}

/**
 * Main analysis function
 */
export async function analyzeFtpPatterns() {
  const analyzer = new FtpPatternsAnalyzer();
  
  // Analyze the problematic cruise lines
  const lineIds = [22, 63]; // Royal Caribbean, AmaWaterways
  
  try {
    const results = await analyzer.analyzeLines(lineIds);
    
    logger.info('\n🎯 ANALYSIS COMPLETE');
    logger.info('Key insights:');
    
    for (const result of results) {
      const dataQualityScore = Math.round(((result.cruisesWithShipId + result.cruisesWithShipName) / (result.totalCruises * 2)) * 100);
      logger.info(`${result.lineName}: ${dataQualityScore}% data quality score, ${result.pathPatterns.uniquePathTemplates.size} path patterns`);
    }
    
    return results;
    
  } catch (error) {
    logger.error('❌ Analysis failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  analyzeFtpPatterns().catch(error => {
    logger.error('Analysis failed:', error);
    process.exit(1);
  });
}