#!/usr/bin/env tsx

/**
 * Quick FTP Test - Small Scale Diagnostic
 * 
 * This script runs a quick test on just a few cruises to rapidly identify issues.
 * Perfect for immediate debugging without running the full diagnostic suite.
 */

import { logger } from '../config/logger';
import * as ftp from 'basic-ftp';
import { env } from '../config/environment';
import { db } from '../db/connection';
import { sql } from 'drizzle-orm';
import { cruises, ships } from '../db/schema';
import { getWebhookLineId } from '../config/cruise-line-mapping';

interface QuickTestResult {
  lineId: number;
  lineName: string;
  ftpConnected: boolean;
  cruisesTested: number;
  pathsFound: number;
  filesFound: number;
  downloadsSuccessful: number;
  errors: string[];
  samplePaths: string[];
  sampleFiles: string[];
}

async function runQuickFtpTest(): Promise<void> {
  logger.info('🔬 QUICK FTP TEST STARTING');
  logger.info('Testing small sample to rapidly identify issues...\n');

  const testLines = [
    { id: 22, name: 'Royal Caribbean' },
    { id: 63, name: 'AmaWaterways' }
  ];

  const results: QuickTestResult[] = [];

  for (const line of testLines) {
    logger.info(`\n🏢 Testing ${line.name} (ID: ${line.id})`);
    logger.info('-'.repeat(50));

    const result: QuickTestResult = {
      lineId: line.id,
      lineName: line.name,
      ftpConnected: false,
      cruisesTested: 0,
      pathsFound: 0,
      filesFound: 0,
      downloadsSuccessful: 0,
      errors: [],
      samplePaths: [],
      sampleFiles: []
    };

    let client: ftp.Client | null = null;

    try {
      // Step 1: Test FTP Connection
      logger.info('📡 Step 1: Testing FTP connection...');
      
      if (!env.TRAVELTEK_FTP_HOST || !env.TRAVELTEK_FTP_USER || !env.TRAVELTEK_FTP_PASSWORD) {
        throw new Error('Missing FTP credentials');
      }

      client = new ftp.Client();
      client.ftp.verbose = true;

      await client.access({
        host: env.TRAVELTEK_FTP_HOST,
        user: env.TRAVELTEK_FTP_USER,
        password: env.TRAVELTEK_FTP_PASSWORD,
        secure: false
      });

      result.ftpConnected = true;
      logger.info('✅ FTP connection successful');

      // Step 2: Get sample cruises
      logger.info('📊 Step 2: Fetching sample cruises...');
      
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
          sql`${cruises.cruiseLineId} = ${line.id} 
              AND ${cruises.sailingDate} >= CURRENT_DATE 
              AND ${cruises.sailingDate} <= CURRENT_DATE + INTERVAL '1 year'
              AND ${cruises.isActive} = true`
        )
        .orderBy(sql`${cruises.sailingDate} ASC`)
        .limit(5); // Just 5 cruises for quick test

      logger.info(`Found ${cruiseData.length} cruises to test`);
      result.cruisesTested = cruiseData.length;

      if (cruiseData.length === 0) {
        result.errors.push('No cruises found in database');
        continue;
      }

      // Step 3: Test each cruise
      for (let i = 0; i < cruiseData.length; i++) {
        const cruise = cruiseData[i];
        logger.info(`\n🚢 Testing cruise ${i + 1}: ${cruise.id} (${cruise.shipName})`);

        const webhookLineId = getWebhookLineId(line.id);
        const sailingDate = new Date(cruise.sailingDate);
        const year = sailingDate.getFullYear();
        const month = String(sailingDate.getMonth() + 1).padStart(2, '0');

        // Try most common path patterns
        const pathsToTry = [
          `/${year}/${month}/${webhookLineId}`,
          `/isell_json/${year}/${month}/${webhookLineId}`,
          `/${year}/${month}/${line.id}`, // Try database line ID too
          `/isell_json/${year}/${month}/${line.id}`
        ];

        logger.info(`🔍 Trying ${pathsToTry.length} path patterns...`);

        let pathFound = false;
        let workingPath = '';

        for (const path of pathsToTry) {
          try {
            await client.cd(path);
            pathFound = true;
            workingPath = path;
            result.pathsFound++;
            result.samplePaths.push(path);
            logger.info(`✅ Path works: ${path}`);
            break;
          } catch (error) {
            logger.debug(`❌ Path failed: ${path}`);
          }
        }

        if (!pathFound) {
          logger.error(`❌ No valid paths found for cruise ${cruise.id}`);
          result.errors.push(`Cruise ${cruise.id}: No valid paths`);
          continue;
        }

        // Test file existence
        const filesToTry = [
          `${cruise.id}.json`,
          `${cruise.cruiseCode}.json`,
          `${cruise.id}.json`.toLowerCase(),
          `${cruise.cruiseCode}.json`.toLowerCase()
        ];

        logger.info(`🔍 Checking for files: ${filesToTry.join(', ')}`);

        let fileFound = false;
        let workingFile = '';

        try {
          const list = await client.list();
          logger.info(`📁 Directory contains ${list.length} items`);

          for (const fileName of filesToTry) {
            const foundItem = list.find(item => 
              item.name.toLowerCase() === fileName.toLowerCase()
            );

            if (foundItem) {
              fileFound = true;
              workingFile = fileName;
              result.filesFound++;
              result.sampleFiles.push(`${workingPath}/${fileName} (${foundItem.size} bytes)`);
              logger.info(`✅ File found: ${fileName} (${foundItem.size} bytes)`);
              break;
            }
          }

          if (!fileFound) {
            logger.error(`❌ No files found. Directory listing:`);
            for (const item of list.slice(0, 10)) {
              logger.info(`  - ${item.name} (${item.size} bytes)`);
            }
            result.errors.push(`Cruise ${cruise.id}: File not found in ${workingPath}`);
            continue;
          }

        } catch (listError) {
          logger.error(`❌ Failed to list directory: ${listError instanceof Error ? listError.message : 'Unknown'}`);
          result.errors.push(`Cruise ${cruise.id}: Directory listing failed`);
          continue;
        }

        // Test download
        try {
          logger.info(`⬇️ Testing download of ${workingFile}...`);
          
          const chunks: Buffer[] = [];
          const stream = require('stream');
          const memoryStream = new stream.Writable({
            write(chunk: Buffer, encoding: any, callback: any) {
              chunks.push(chunk);
              callback();
            }
          });

          await client.downloadTo(memoryStream, workingFile);
          const data = Buffer.concat(chunks).toString('utf-8');
          
          // Test JSON parsing
          const jsonData = JSON.parse(data);
          
          result.downloadsSuccessful++;
          logger.info(`✅ Download & parse successful: ${data.length} bytes`);

        } catch (downloadError) {
          logger.error(`❌ Download failed: ${downloadError instanceof Error ? downloadError.message : 'Unknown'}`);
          result.errors.push(`Cruise ${cruise.id}: Download failed - ${downloadError instanceof Error ? downloadError.message : 'Unknown'}`);
        }
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ Error testing ${line.name}: ${errorMsg}`);
      result.errors.push(`Fatal error: ${errorMsg}`);

    } finally {
      if (client) {
        try {
          await client.close();
        } catch {}
      }
    }

    results.push(result);
  }

  // Generate summary report
  logger.info('\n' + '='.repeat(60));
  logger.info('📊 QUICK TEST SUMMARY REPORT');
  logger.info('='.repeat(60));

  for (const result of results) {
    logger.info(`\n🏢 ${result.lineName} (${result.lineId})`);
    
    const successRate = result.cruisesTested > 0 ? 
      (result.downloadsSuccessful / result.cruisesTested) * 100 : 0;

    logger.info(`📈 Success Rate: ${successRate.toFixed(1)}% (${result.downloadsSuccessful}/${result.cruisesTested})`);
    logger.info(`📡 FTP Connection: ${result.ftpConnected ? '✅ PASS' : '❌ FAIL'}`);
    logger.info(`📁 Paths Found: ${result.pathsFound}/${result.cruisesTested}`);
    logger.info(`📄 Files Found: ${result.filesFound}/${result.cruisesTested}`);

    if (result.samplePaths.length > 0) {
      logger.info(`📂 Working Paths:`);
      for (const path of result.samplePaths) {
        logger.info(`   • ${path}`);
      }
    }

    if (result.sampleFiles.length > 0) {
      logger.info(`📄 Working Files:`);
      for (const file of result.sampleFiles) {
        logger.info(`   • ${file}`);
      }
    }

    if (result.errors.length > 0) {
      logger.info(`❌ Errors:`);
      for (const error of result.errors.slice(0, 3)) {
        logger.info(`   • ${error}`);
      }
      if (result.errors.length > 3) {
        logger.info(`   ... and ${result.errors.length - 3} more errors`);
      }
    }
  }

  logger.info('\n' + '='.repeat(60));
  logger.info('🎯 DIAGNOSIS');
  logger.info('='.repeat(60));

  for (const result of results) {
    logger.info(`\n${result.lineName}:`);
    
    if (!result.ftpConnected) {
      logger.info('  🚨 CRITICAL: FTP connection failing');
    } else if (result.pathsFound === 0) {
      logger.info('  🚨 CRITICAL: Path structure issues - no valid directories found');
    } else if (result.filesFound === 0) {
      logger.info('  🚨 CRITICAL: File availability issues - files do not exist');
    } else if (result.downloadsSuccessful === 0) {
      logger.info('  🚨 CRITICAL: Download/parsing issues - files exist but cannot be processed');
    } else if (result.downloadsSuccessful < result.cruisesTested) {
      logger.info('  ⚠️  WARNING: Partial success - some files work, others do not');
    } else {
      logger.info('  ✅ GOOD: All tests passing - issue may be with larger dataset');
    }
  }

  logger.info('\n✅ Quick test completed!');
}

// Run the test
runQuickFtpTest().catch(error => {
  logger.error('Quick test failed:', error);
  process.exit(1);
});