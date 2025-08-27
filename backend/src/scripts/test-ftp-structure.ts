#!/usr/bin/env ts-node

import { ftpConnectionPool } from '../services/ftp-connection-pool.service';
import logger from '../config/logger';

async function testFTPStructure() {
  logger.info('🧪 Testing FTP structure and file access...');
  
  let connection;
  
  try {
    // Test with cruise line 3 (one that's showing errors)
    const lineId = 3;
    const year = 2025;
    const month = '08';
    
    connection = await ftpConnectionPool.getConnection();
    logger.info('✅ Connected to FTP');
    
    // List base directory
    logger.info('\n📁 Checking FTP root structure:');
    const rootList = await connection.list('/');
    logger.info(`   Found ${rootList.length} items in root`);
    const yearDirs = rootList.filter(item => item.type === 2 && item.name === String(year));
    logger.info(`   Year ${year} directory exists: ${yearDirs.length > 0}`);
    
    // Check year directory
    const yearPath = `${year}`;
    logger.info(`\n📁 Checking year directory: ${yearPath}`);
    const yearList = await connection.list(yearPath);
    const monthDirs = yearList.filter(item => item.type === 2);
    logger.info(`   Found ${monthDirs.length} month directories`);
    logger.info(`   Months: ${monthDirs.map(d => d.name).join(', ')}`);
    
    // Check month directory
    const monthPath = `${year}/${month}`;
    logger.info(`\n📁 Checking month directory: ${monthPath}`);
    const monthList = await connection.list(monthPath);
    const lineDirs = monthList.filter(item => item.type === 2);
    logger.info(`   Found ${lineDirs.length} cruise line directories`);
    logger.info(`   Lines: ${lineDirs.map(d => d.name).slice(0, 10).join(', ')}...`);
    
    // Check specific cruise line
    const linePath = `${year}/${month}/${lineId}`;
    logger.info(`\n📁 Checking cruise line ${lineId} directory: ${linePath}`);
    
    try {
      const lineList = await connection.list(linePath);
      const shipDirs = lineList.filter(item => item.type === 2);
      logger.info(`   Found ${shipDirs.length} ship directories`);
      
      if (shipDirs.length > 0) {
        // Check first ship
        const firstShip = shipDirs[0];
        const shipPath = `${linePath}/${firstShip.name}`;
        logger.info(`\n📁 Checking first ship directory: ${shipPath}`);
        
        const shipList = await connection.list(shipPath);
        const jsonFiles = shipList.filter(f => f.name.endsWith('.json'));
        logger.info(`   Found ${jsonFiles.length} JSON files`);
        
        if (jsonFiles.length > 0) {
          // Show sample files
          logger.info(`   Sample files (first 5):`);
          jsonFiles.slice(0, 5).forEach(f => {
            logger.info(`     - ${f.name} (${f.size} bytes)`);
          });
          
          // Try to check file size distribution
          const sizes = jsonFiles.map(f => f.size);
          const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
          const minSize = Math.min(...sizes);
          const maxSize = Math.max(...sizes);
          
          logger.info(`\n📊 File statistics:`);
          logger.info(`   Total files: ${jsonFiles.length}`);
          logger.info(`   Average size: ${Math.round(avgSize)} bytes`);
          logger.info(`   Min size: ${minSize} bytes`);
          logger.info(`   Max size: ${maxSize} bytes`);
          
          // Check for potential issues
          const tinyFiles = jsonFiles.filter(f => f.size < 100);
          const hugeFiles = jsonFiles.filter(f => f.size > 100000);
          
          if (tinyFiles.length > 0) {
            logger.warn(`   ⚠️ Found ${tinyFiles.length} very small files (<100 bytes)`);
            tinyFiles.slice(0, 3).forEach(f => {
              logger.warn(`     - ${f.name} (${f.size} bytes)`);
            });
          }
          
          if (hugeFiles.length > 0) {
            logger.warn(`   ⚠️ Found ${hugeFiles.length} very large files (>100KB)`);
            hugeFiles.slice(0, 3).forEach(f => {
              logger.warn(`     - ${f.name} (${f.size} bytes)`);
            });
          }
        }
      }
      
    } catch (err) {
      logger.error(`❌ Cannot access line directory ${linePath}:`, err);
    }
    
    // Check other months to see if structure is consistent
    logger.info(`\n📅 Checking previous month for comparison:`);
    const prevMonth = '07';
    const prevPath = `${year}/${prevMonth}/${lineId}`;
    
    try {
      const prevList = await connection.list(prevPath);
      const prevShips = prevList.filter(item => item.type === 2);
      logger.info(`   July 2025: ${prevShips.length} ship directories`);
    } catch (err) {
      logger.info(`   July 2025: Not accessible`);
    }
    
    // Summary
    logger.info('\n✅ FTP structure test completed');
    logger.info('Summary:');
    logger.info('- FTP connection: Working');
    logger.info('- Directory structure: Year/Month/LineId/ShipId/');
    logger.info('- File format: {codetocruiseid}.json');
    
  } catch (error) {
    logger.error('❌ FTP structure test failed:', error);
  } finally {
    if (connection) {
      ftpConnectionPool.releaseConnection(connection);
      logger.info('\n✅ Connection released');
    }
  }
  
  process.exit(0);
}

// Check if we have FTP credentials before trying
const requiredEnvVars = ['TRAVELTEK_FTP_HOST', 'TRAVELTEK_FTP_USER', 'TRAVELTEK_FTP_PASSWORD'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingVars.length > 0) {
  logger.error('FTP credentials not configured:', missingVars);
  logger.info('\n⚠️ This script requires FTP credentials to be set in environment variables:');
  logger.info('   TRAVELTEK_FTP_HOST');
  logger.info('   TRAVELTEK_FTP_USER'); 
  logger.info('   TRAVELTEK_FTP_PASSWORD');
  logger.info('\nThese are available in the Render.com environment.');
  process.exit(1);
}

testFTPStructure().catch(console.error);