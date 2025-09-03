/**
 * Script to verify Line 24 data completeness and sync accuracy
 * This script will help determine if all JSON files are being downloaded
 * and if all data from those files is being stored in the database.
 */

import { logger } from '../src/config/logger';
import { db } from '../src/db/connection';
import { sql } from 'drizzle-orm';
import { ftpConnectionPool } from '../src/services/ftp-connection-pool.service';
import { Writable } from 'stream';

interface CruiseFileData {
  codetocruiseid: string;
  cruiseid: string;
  name: string;
  saildate: string;
  nights: number;
  cheapestinside?: number;
  cheapestoutside?: number;
  cheapestbalcony?: number;
  cheapestsuite?: number;
  itinerary?: any[];
  ports?: any;
  portids?: string;
  regionids?: string;
  voyagecode?: string;
  itinerarycode?: string;
  startportid?: number;
  endportid?: number;
  seadays?: number;
  shipcontent?: any;
  linecontent?: any;
}

interface VerificationResult {
  line24Analysis: {
    totalFTPFiles: number;
    sampledFiles: number;
    dbCruisesCount: number;
    cruisesWithPrices: number;
    cruisesWithoutPrices: number;
    itineraryDataMissing: number;
    portDataMissing: number;
    missingInDB: string[];
  };
  sampleCruiseComparison: {
    ftpData: any;
    dbData: any;
    missingFields: string[];
  }[];
  recommendations: string[];
}

export class Line24DataVerificationService {
  private readonly LINE_ID = 24;
  private readonly SAMPLE_SIZE = 20; // Sample 20 cruises for detailed verification

  async verifyDataCompleteness(): Promise<VerificationResult> {
    logger.info('🔍 Starting Line 24 data completeness verification');

    const result: VerificationResult = {
      line24Analysis: {
        totalFTPFiles: 0,
        sampledFiles: 0,
        dbCruisesCount: 0,
        cruisesWithPrices: 0,
        cruisesWithoutPrices: 0,
        itineraryDataMissing: 0,
        portDataMissing: 0,
        missingInDB: []
      },
      sampleCruiseComparison: [],
      recommendations: []
    };

    try {
      // Step 1: Count cruises in database for Line 24
      await this.analyzeDatabaseState(result);

      // Step 2: Sample FTP files and compare with database
      await this.sampleFTPFiles(result);

      // Step 3: Generate recommendations
      this.generateRecommendations(result);

    } catch (error) {
      logger.error('❌ Error during verification:', error);
      throw error;
    }

    return result;
  }

  private async analyzeDatabaseState(result: VerificationResult): Promise<void> {
    logger.info('📊 Analyzing database state for Line 24');

    // Count total cruises for Line 24
    const cruiseCount = await db.execute(sql`
      SELECT COUNT(*) as count FROM cruises WHERE cruise_line_id = ${this.LINE_ID}
    `);
    result.line24Analysis.dbCruisesCount = cruiseCount[0]?.count || 0;

    // Count cruises with pricing data
    const cruisesWithPrices = await db.execute(sql`
      SELECT COUNT(*) as count FROM cruises 
      WHERE cruise_line_id = ${this.LINE_ID}
        AND (interior_price IS NOT NULL OR oceanview_price IS NOT NULL 
             OR balcony_price IS NOT NULL OR suite_price IS NOT NULL)
    `);
    result.line24Analysis.cruisesWithPrices = cruisesWithPrices[0]?.count || 0;
    result.line24Analysis.cruisesWithoutPrices = result.line24Analysis.dbCruisesCount - result.line24Analysis.cruisesWithPrices;

    // Count cruises missing itinerary data
    const itineraryMissing = await db.execute(sql`
      SELECT COUNT(*) as count FROM cruises c
      LEFT JOIN itineraries i ON c.id = i.cruise_id
      WHERE c.cruise_line_id = ${this.LINE_ID} AND i.id IS NULL
    `);
    result.line24Analysis.itineraryDataMissing = itineraryMissing[0]?.count || 0;

    // Count cruises with missing port data
    const portDataMissing = await db.execute(sql`
      SELECT COUNT(*) as count FROM cruises 
      WHERE cruise_line_id = ${this.LINE_ID}
        AND (embarkation_port_id IS NULL OR port_ids IS NULL OR port_ids = '')
    `);
    result.line24Analysis.portDataMissing = portDataMissing[0]?.count || 0;

    logger.info('✅ Database analysis complete', {
      totalCruises: result.line24Analysis.dbCruisesCount,
      withPrices: result.line24Analysis.cruisesWithPrices,
      withoutPrices: result.line24Analysis.cruisesWithoutPrices,
      missingItinerary: result.line24Analysis.itineraryDataMissing,
      missingPortData: result.line24Analysis.portDataMissing
    });
  }

  private async sampleFTPFiles(result: VerificationResult): Promise<void> {
    logger.info(`🔍 Sampling ${this.SAMPLE_SIZE} FTP files for Line 24`);

    let connection: any = null;
    try {
      connection = await ftpConnectionPool.getConnection();
      
      // Generate paths for current and next 2 months
      const paths = this.generateFTPPaths();
      const sampleFiles: string[] = [];

      // Collect sample files
      for (const monthPath of paths.slice(0, 3)) { // Check first 3 months only
        try {
          const shipDirs = await connection.list(monthPath);
          const directories = shipDirs.filter((item: any) => item.type === 2);
          
          // Check first ship directory
          if (directories.length > 0) {
            const shipPath = `${monthPath}/${directories[0].name}`;
            const files = await connection.list(shipPath);
            const jsonFiles = files.filter((f: any) => f.name.endsWith('.json'));
            
            result.line24Analysis.totalFTPFiles += jsonFiles.length;
            
            // Take first few files as samples
            const samplesToTake = Math.min(jsonFiles.length, Math.floor(this.SAMPLE_SIZE / 3));
            for (let i = 0; i < samplesToTake; i++) {
              sampleFiles.push(`${shipPath}/${jsonFiles[i].name}`);
            }
          }
        } catch (err) {
          logger.warn(`Cannot access ${monthPath}:`, err);
        }
      }

      result.line24Analysis.sampledFiles = sampleFiles.length;
      logger.info(`📁 Found ${result.line24Analysis.totalFTPFiles} total FTP files, sampling ${sampleFiles.length}`);

      // Download and analyze sample files
      for (const filePath of sampleFiles) {
        try {
          const ftpData = await this.downloadAndParseFile(connection, filePath);
          if (ftpData) {
            await this.compareWithDatabase(ftpData, result);
          }
        } catch (err) {
          logger.error(`Error processing sample file ${filePath}:`, err);
        }
      }

    } catch (error) {
      logger.error('Error sampling FTP files:', error);
      throw error;
    } finally {
      if (connection) {
        ftpConnectionPool.releaseConnection(connection);
      }
    }
  }

  private async downloadAndParseFile(connection: any, filePath: string): Promise<CruiseFileData | null> {
    try {
      const chunks: Buffer[] = [];
      const writableStream = new Writable({
        write(chunk: Buffer, encoding: string, callback: Function) {
          chunks.push(chunk);
          callback();
        }
      });

      await Promise.race([
        connection.downloadTo(writableStream, filePath),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Download timeout')), 30000)
        )
      ]);

      const buffer = Buffer.concat(chunks);
      const content = buffer.toString();
      return JSON.parse(content) as CruiseFileData;
    } catch (err) {
      logger.error(`Failed to download/parse ${filePath}:`, err);
      return null;
    }
  }

  private async compareWithDatabase(ftpData: CruiseFileData, result: VerificationResult): Promise<void> {
    const cruiseId = ftpData.codetocruiseid;
    
    // Get cruise data from database
    const dbResult = await db.execute(sql`
      SELECT c.*, 
             COUNT(i.id) as itinerary_count,
             p_start.name as start_port_name,
             p_end.name as end_port_name
      FROM cruises c
      LEFT JOIN itineraries i ON c.id = i.cruise_id
      LEFT JOIN ports p_start ON c.embarkation_port_id = p_start.id
      LEFT JOIN ports p_end ON c.disembarkation_port_id = p_end.id
      WHERE c.id = ${cruiseId}
      GROUP BY c.id, p_start.name, p_end.name
    `);

    if (dbResult.length === 0) {
      // Cruise exists in FTP but not in database
      result.line24Analysis.missingInDB.push(cruiseId);
      logger.warn(`❌ Cruise ${cruiseId} exists in FTP but missing from database`);
      return;
    }

    const dbData = dbResult[0];
    const missingFields: string[] = [];

    // Compare key fields
    if (ftpData.itinerary && ftpData.itinerary.length > 0 && dbData.itinerary_count === 0) {
      missingFields.push('itinerary');
    }
    
    if (ftpData.portids && !dbData.port_ids) {
      missingFields.push('port_ids');
    }
    
    if (ftpData.voyagecode && !dbData.voyage_code) {
      missingFields.push('voyage_code');
    }
    
    if (ftpData.itinerarycode && !dbData.itinerary_code) {
      missingFields.push('itinerary_code');
    }
    
    if (ftpData.seadays && !dbData.sea_days) {
      missingFields.push('sea_days');
    }
    
    if (ftpData.startportid && !dbData.embarkation_port_id) {
      missingFields.push('embarkation_port_id');
    }

    if (missingFields.length > 0) {
      result.sampleCruiseComparison.push({
        ftpData: {
          codetocruiseid: ftpData.codetocruiseid,
          name: ftpData.name,
          hasItinerary: ftpData.itinerary ? ftpData.itinerary.length : 0,
          portIds: ftpData.portids,
          voyageCode: ftpData.voyagecode,
          itineraryCode: ftpData.itinerarycode,
          seaDays: ftpData.seadays,
          startPortId: ftpData.startportid
        },
        dbData: {
          id: dbData.id,
          name: dbData.name,
          itineraryCount: dbData.itinerary_count,
          portIds: dbData.port_ids,
          voyageCode: dbData.voyage_code,
          itineraryCode: dbData.itinerary_code,
          seaDays: dbData.sea_days,
          startPortId: dbData.embarkation_port_id
        },
        missingFields
      });
    }
  }

  private generateFTPPaths(): string[] {
    const paths: string[] = [];
    const now = new Date();
    
    for (let monthOffset = 0; monthOffset < 6; monthOffset++) {
      const checkDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
      const year = checkDate.getFullYear();
      const month = String(checkDate.getMonth() + 1).padStart(2, '0');
      paths.push(`${year}/${month}/${this.LINE_ID}`);
    }

    return paths;
  }

  private generateRecommendations(result: VerificationResult): void {
    const analysis = result.line24Analysis;
    
    if (analysis.missingInDB.length > 0) {
      result.recommendations.push(
        `⚠️ ${analysis.missingInDB.length} cruises found in FTP but missing from database. Sync process may be incomplete.`
      );
    }

    if (analysis.cruisesWithoutPrices > 0) {
      const percentageWithoutPrices = ((analysis.cruisesWithoutPrices / analysis.dbCruisesCount) * 100).toFixed(1);
      result.recommendations.push(
        `💰 ${analysis.cruisesWithoutPrices} cruises (${percentageWithoutPrices}%) have no pricing data. This explains the discrepancy between "cruises updated" and "prices updated".`
      );
    }

    if (analysis.itineraryDataMissing > 0) {
      const percentageMissing = ((analysis.itineraryDataMissing / analysis.dbCruisesCount) * 100).toFixed(1);
      result.recommendations.push(
        `🗺️ ${analysis.itineraryDataMissing} cruises (${percentageMissing}%) are missing itinerary data. The sync process may not be storing itinerary information.`
      );
    }

    if (analysis.portDataMissing > 0) {
      result.recommendations.push(
        `⚓ ${analysis.portDataMissing} cruises have incomplete port information.`
      );
    }

    if (result.sampleCruiseComparison.length > 0) {
      result.recommendations.push(
        `🔍 ${result.sampleCruiseComparison.length} sample cruises show missing data fields in the database compared to FTP files.`
      );
    }

    // Key findings
    if (analysis.totalFTPFiles > analysis.dbCruisesCount) {
      result.recommendations.push(
        `📊 FINDING: FTP contains more files than database records. This suggests not all JSON files are being processed.`
      );
    }

    if (analysis.cruisesWithPrices < analysis.dbCruisesCount * 0.8) {
      result.recommendations.push(
        `💡 FINDING: Less than 80% of cruises have pricing data. This is likely why "prices updated" count is lower than "cruises updated" count.`
      );
    }
  }
}

// Execute the verification
async function main() {
  const verificationService = new Line24DataVerificationService();
  
  try {
    const result = await verificationService.verifyDataCompleteness();
    
    console.log('\n🎯 LINE 24 DATA COMPLETENESS VERIFICATION REPORT');
    console.log('================================================\n');
    
    console.log('📊 DATABASE ANALYSIS:');
    console.log(`   Total cruises in DB: ${result.line24Analysis.dbCruisesCount}`);
    console.log(`   Cruises with prices: ${result.line24Analysis.cruisesWithPrices}`);
    console.log(`   Cruises without prices: ${result.line24Analysis.cruisesWithoutPrices}`);
    console.log(`   Missing itinerary data: ${result.line24Analysis.itineraryDataMissing}`);
    console.log(`   Missing port data: ${result.line24Analysis.portDataMissing}`);
    
    console.log('\n📁 FTP ANALYSIS:');
    console.log(`   Total FTP files found: ${result.line24Analysis.totalFTPFiles}`);
    console.log(`   Sample files analyzed: ${result.line24Analysis.sampledFiles}`);
    console.log(`   Cruises missing from DB: ${result.line24Analysis.missingInDB.length}`);
    
    if (result.sampleCruiseComparison.length > 0) {
      console.log('\n🔍 SAMPLE CRUISE COMPARISONS (showing data gaps):');
      result.sampleCruiseComparison.forEach((comparison, index) => {
        console.log(`   ${index + 1}. Cruise ${comparison.ftpData.codetocruiseid}:`);
        console.log(`      Missing fields: ${comparison.missingFields.join(', ')}`);
      });
    }
    
    console.log('\n💡 RECOMMENDATIONS:');
    result.recommendations.forEach(rec => console.log(`   ${rec}`));
    
    console.log('\n✅ Verification complete!');
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

if (require.main === module) {
  main();
}