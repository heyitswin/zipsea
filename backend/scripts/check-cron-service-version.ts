#!/usr/bin/env tsx
/**
 * Check which batch service version is currently deployed and running
 */

import { logger } from '../src/config/logger';

async function checkServiceVersion() {
  logger.info('🔍 Checking deployed batch service version...');

  try {
    // Check the current cron script
    const fs = require('fs');
    const cronScript = fs.readFileSync('/Users/winlin/Desktop/sites/zipsea/backend/scripts/sync-pending-prices.js', 'utf8');
    
    logger.info('📄 Current cron script analysis:');
    
    if (cronScript.includes('price-sync-batch-v5')) {
      logger.info('✅ Cron script is using V5 service (with new limits)');
    } else if (cronScript.includes('price-sync-batch-v4')) {
      logger.info('⚠️ Cron script is using V4 service');
    } else if (cronScript.includes('price-sync-batch.service')) {
      logger.info('⚠️ Cron script is using original batch service (old limits)');
    }

    // Show the service import line
    const serviceImportMatch = cronScript.match(/require\(['"]\.\.\/dist\/services\/[^'"]+['"]\)/);
    if (serviceImportMatch) {
      logger.info(`🔗 Service import: ${serviceImportMatch[0]}`);
    }

    // Show the service call
    const serviceCallMatch = cronScript.match(/[a-zA-Z_]+\.sync[A-Za-z]*/);
    if (serviceCallMatch) {
      logger.info(`📞 Service call: ${serviceCallMatch[0]}`);
    }

    // Check if the dist files exist
    const path = require('path');
    const distPath = path.join(__dirname, '..', 'dist', 'services');
    
    logger.info('\n📁 Available compiled services in dist/:');
    if (fs.existsSync(distPath)) {
      const distFiles = fs.readdirSync(distPath);
      const batchFiles = distFiles.filter(f => f.includes('batch'));
      batchFiles.forEach(file => {
        logger.info(`  ${file}`);
      });
    } else {
      logger.warn('⚠️ dist/services directory not found - services may not be compiled');
    }

  } catch (error) {
    logger.error('❌ Error checking service version:', error);
  }

  process.exit(0);
}

checkServiceVersion().catch(console.error);