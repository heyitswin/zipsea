#!/usr/bin/env ts-node
import { logger } from '../src/config/logger';
import { env } from '../src/config/environment';
import { dataSyncService } from '../src/services/data-sync.service';
import { traveltekFTPService } from '../src/services/traveltek-ftp.service';

/**
 * Data Synchronization Script
 * 
 * This script synchronizes cruise data from Traveltek FTP server:
 * 1. Connects to FTP server
 * 2. Downloads cruise data files
 * 3. Parses and stores data in database
 * 4. Updates pricing information
 */

interface SyncOptions {
  year?: string;
  month?: string;
  lineid?: string;
  shipid?: string;
  recent?: number; // days
  full?: boolean;
}

async function syncData(options: SyncOptions = {}): Promise<void> {
  try {
    logger.info('🚀 Starting data synchronization...');

    // Validate FTP credentials
    if (!env.TRAVELTEK_FTP_USER || !env.TRAVELTEK_FTP_PASSWORD) {
      throw new Error('Traveltek FTP credentials are required (TRAVELTEK_FTP_USER, TRAVELTEK_FTP_PASSWORD)');
    }

    logger.info('✅ FTP credentials validated');

    // Test FTP connection
    logger.info('🔗 Testing FTP connection...');
    const healthCheck = await traveltekFTPService.healthCheck();
    if (!healthCheck.connected) {
      throw new Error(`FTP connection failed: ${healthCheck.error}`);
    }
    logger.info('✅ FTP connection successful');

    // Perform sync based on options
    if (options.recent) {
      logger.info(`📥 Syncing recent data (${options.recent} days)...`);
      await dataSyncService.syncRecentCruiseData(options.recent);
    } else if (options.full) {
      logger.info('📥 Starting full data sync...');
      await dataSyncService.fullSyncCruiseData(options.year, options.month);
    } else {
      // Default: sync recent data for the last day
      logger.info('📥 Syncing recent data (24 hours)...');
      await dataSyncService.syncRecentCruiseData(1);
    }

    logger.info('🎉 Data synchronization completed successfully');

  } catch (error) {
    logger.error('❌ Data synchronization failed:', error);
    throw error;
  } finally {
    // Ensure FTP connection is closed
    await traveltekFTPService.disconnect();
  }
}

async function testFTPConnection(): Promise<void> {
  try {
    logger.info('🔗 Testing FTP connection...');
    
    if (!env.TRAVELTEK_FTP_USER || !env.TRAVELTEK_FTP_PASSWORD) {
      throw new Error('FTP credentials not found in environment variables');
    }

    const healthCheck = await traveltekFTPService.healthCheck();
    if (healthCheck.connected) {
      logger.info('✅ FTP connection successful');
      
      // Try to list some directories
      logger.info('📁 Testing directory listing...');
      const years = await traveltekFTPService.getAvailableYears();
      logger.info(`📊 Found ${years.length} years: ${years.slice(0, 5).join(', ')}${years.length > 5 ? '...' : ''}`);
      
      if (years.length > 0) {
        const months = await traveltekFTPService.getAvailableMonths(years[years.length - 1]);
        logger.info(`📊 Found ${months.length} months in ${years[years.length - 1]}: ${months.join(', ')}`);
      }
    } else {
      logger.error(`❌ FTP connection failed: ${healthCheck.error}`);
    }
  } catch (error) {
    logger.error('❌ FTP test failed:', error);
    throw error;
  } finally {
    await traveltekFTPService.disconnect();
  }
}

async function discoverData(year?: string, month?: string): Promise<void> {
  try {
    logger.info('🔍 Discovering available cruise data...');
    
    const files = await traveltekFTPService.discoverCruiseFiles(year, month);
    logger.info(`📊 Found ${files.length} cruise data files`);
    
    if (files.length > 0) {
      // Group files by year/month
      const grouped = files.reduce((acc, file) => {
        const key = `${file.year}/${file.month}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(file);
        return acc;
      }, {} as Record<string, typeof files>);

      logger.info('📈 Files by month:');
      Object.entries(grouped).forEach(([key, files]) => {
        logger.info(`  ${key}: ${files.length} files`);
      });

      // Show recent files
      const recent = files
        .filter(f => f.lastModified)
        .sort((a, b) => (b.lastModified?.getTime() || 0) - (a.lastModified?.getTime() || 0))
        .slice(0, 10);

      if (recent.length > 0) {
        logger.info('🕒 Most recent files:');
        recent.forEach(file => {
          logger.info(`  ${file.filePath} (${file.lastModified?.toISOString()})`);
        });
      }
    }
  } catch (error) {
    logger.error('❌ Data discovery failed:', error);
    throw error;
  } finally {
    await traveltekFTPService.disconnect();
  }
}

// Command line interface
if (require.main === module) {
  const command = process.argv[2];
  const args = process.argv.slice(3);
  
  // Parse arguments
  const options: SyncOptions = {};
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    
    switch (flag) {
      case '--year':
        options.year = value;
        break;
      case '--month':
        options.month = value;
        break;
      case '--lineid':
        options.lineid = value;
        break;
      case '--shipid':
        options.shipid = value;
        break;
      case '--recent':
        options.recent = parseInt(value) || 1;
        break;
      case '--full':
        options.full = true;
        i--; // No value for this flag
        break;
    }
  }

  const handleCommand = async () => {
    switch (command) {
      case 'test':
        await testFTPConnection();
        break;
        
      case 'discover':
        await discoverData(options.year, options.month);
        break;
        
      case 'recent':
        options.recent = options.recent || 1;
        await syncData(options);
        break;
        
      case 'full':
        options.full = true;
        await syncData(options);
        break;
        
      case 'sync':
      default:
        await syncData(options);
        break;
    }
  };

  handleCommand()
    .then(() => {
      console.log('✅ Command completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Command failed:', error);
      process.exit(1);
    });
}

export { syncData, testFTPConnection, discoverData };