#!/usr/bin/env ts-node

import { ftpConnectionPool } from '../services/ftp-connection-pool.service';
import logger from '../config/logger';
import { Writable } from 'stream';

async function testFTPDownload() {
  logger.info('🔍 Testing FTP download to diagnose file processing errors...');
  
  let connection;
  
  try {
    // Get connection from pool
    connection = await ftpConnectionPool.getConnection();
    logger.info('✅ Connected to FTP');
    
    // Test paths from the logs - checking August and September 2025
    const testPaths = [
      '2025/08/22',  // Royal Caribbean
      '2025/09/22',
      '2025/08/3',   // Another line that had issues
      '2025/09/3'
    ];
    
    for (const basePath of testPaths) {
      logger.info(`\n📁 Checking path: ${basePath}`);
      
      try {
        // List directories
        const items = await connection.list(basePath);
        const shipDirs = items.filter(item => item.type === 2);
        
        if (shipDirs.length === 0) {
          logger.warn(`  No ship directories found in ${basePath}`);
          continue;
        }
        
        logger.info(`  Found ${shipDirs.length} ship directories`);
        
        // Test downloading from first ship
        const firstShip = shipDirs[0];
        const shipPath = `${basePath}/${firstShip.name}`;
        
        logger.info(`  Testing ship directory: ${shipPath}`);
        
        // List files in ship directory
        const files = await connection.list(shipPath);
        const jsonFiles = files.filter(f => f.name.endsWith('.json'));
        
        logger.info(`  Found ${jsonFiles.length} JSON files`);
        
        if (jsonFiles.length > 0) {
          // Try downloading first file
          const testFile = jsonFiles[0];
          const filePath = `${shipPath}/${testFile.name}`;
          
          logger.info(`  Attempting to download: ${filePath}`);
          logger.info(`  File size: ${testFile.size} bytes`);
          
          // Create writable stream to collect data
          const chunks: Buffer[] = [];
          const writableStream = new Writable({
            write(chunk: Buffer, encoding: string, callback: Function) {
              chunks.push(chunk);
              callback();
            }
          });
          
          try {
            // Download file
            await connection.downloadTo(writableStream, filePath);
            
            // Combine chunks and check content
            const buffer = Buffer.concat(chunks);
            const content = buffer.toString();
            
            logger.info(`  ✅ Downloaded ${buffer.length} bytes`);
            
            // Try parsing as JSON
            try {
              const data = JSON.parse(content);
              logger.info(`  ✅ Valid JSON with cruise ID: ${data.cruiseid}`);
              
              // Check for required fields
              const requiredFields = ['cruiseid', 'saildate', 'startdate'];
              const missingFields = requiredFields.filter(field => !data[field]);
              
              if (missingFields.length > 0) {
                logger.warn(`  ⚠️ Missing fields: ${missingFields.join(', ')}`);
              }
              
              // Check for price fields
              const priceFields = ['cheapestinside', 'cheapestoutside', 'cheapestbalcony', 'cheapestsuite'];
              const availablePrices = priceFields.filter(field => data[field]);
              
              logger.info(`  💰 Available prices: ${availablePrices.length > 0 ? availablePrices.join(', ') : 'NONE'}`);
              
              // Check cached prices
              if (data.cachedprices) {
                logger.info(`  💰 Cached prices available: ${Object.keys(data.cachedprices).join(', ')}`);
              }
              
            } catch (parseErr) {
              logger.error(`  ❌ JSON parse error: ${parseErr}`);
              logger.error(`  Content preview (first 500 chars): ${content.substring(0, 500)}`);
            }
            
          } catch (downloadErr) {
            logger.error(`  ❌ Download error: ${downloadErr}`);
            
            // Check if it's a connection error
            if (downloadErr instanceof Error) {
              if (downloadErr.message.includes('550')) {
                logger.error('  File not found on FTP server');
              } else if (downloadErr.message.includes('timeout')) {
                logger.error('  Download timeout - file may be too large or connection slow');
              } else if (downloadErr.message.includes('ECONNRESET')) {
                logger.error('  Connection reset - FTP server may have dropped connection');
              }
            }
          }
        }
        
      } catch (listErr) {
        logger.warn(`  Cannot access ${basePath}: ${listErr}`);
      }
    }
    
    // Test a specific problematic cruise line (643)
    logger.info('\n🔍 Testing line 643 specifically...');
    
    const line643Paths = ['2025/08/643', '2025/09/643'];
    for (const path of line643Paths) {
      try {
        const items = await connection.list(path);
        logger.info(`  Line 643 at ${path}: ${items.length} items found`);
      } catch (err) {
        logger.warn(`  Line 643 at ${path}: ${err}`);
      }
    }
    
  } catch (error) {
    logger.error('❌ FTP connection error:', error);
  } finally {
    if (connection) {
      ftpConnectionPool.releaseConnection(connection);
      logger.info('\n✅ Connection released back to pool');
    }
  }
  
  process.exit(0);
}

testFTPDownload().catch(console.error);