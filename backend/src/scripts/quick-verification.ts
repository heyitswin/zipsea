#!/usr/bin/env ts-node

import { db } from '../db/connection';
import { sql } from 'drizzle-orm';
import logger from '../config/logger';

/**
 * Quick verification script for webhook and batch processing system
 * Performs essential checks without complex operations
 */
async function quickVerification() {
  logger.info('🔍 Starting quick system verification...');
  
  try {
    // 1. Database connection test
    logger.info('1. Testing database connection...');
    const dbTest = await db.execute(sql`SELECT 1 as test`);
    logger.info('✅ Database connection successful');
    
    // 2. Check line 643 specifically
    logger.info('2. Checking line 643...');
    const line643Check = await db.execute(sql`
      SELECT COUNT(*) as cruise_count,
             COUNT(*) FILTER (WHERE needs_price_update = true) as marked_count
      FROM cruises 
      WHERE cruise_line_id = 643
    `);
    
    const line643Result = line643Check.rows[0];
    logger.info(`Line 643 status: ${line643Result?.cruise_count || 0} cruises, ${line643Result?.marked_count || 0} marked for update`);
    
    // 3. Check webhook events table
    logger.info('3. Checking webhook events...');
    const webhookCheck = await db.execute(sql`
      SELECT COUNT(*) as total,
             COUNT(*) FILTER (WHERE line_id = 643) as line_643_webhooks,
             MAX(created_at) as latest_webhook
      FROM webhook_events
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
    `);
    
    const webhookResult = webhookCheck.rows[0];
    logger.info(`Recent webhooks: ${webhookResult?.total || 0} total, ${webhookResult?.line_643_webhooks || 0} for line 643`);
    
    // 4. Check pending updates across all lines
    logger.info('4. Checking pending updates...');
    const pendingCheck = await db.execute(sql`
      SELECT cruise_line_id, COUNT(*) as pending_count
      FROM cruises
      WHERE needs_price_update = true
      GROUP BY cruise_line_id
      ORDER BY pending_count DESC
      LIMIT 10
    `);
    
    logger.info('Lines with pending updates:');
    pendingCheck.rows.forEach(row => {
      logger.info(`  Line ${row.cruise_line_id}: ${row.pending_count} cruises`);
    });
    
    // 5. Check cruise line mapping
    logger.info('5. Checking cruise line mapping...');
    const { getDatabaseLineId } = require('../config/cruise-line-mapping');
    const mappedId643 = getDatabaseLineId(643);
    logger.info(`Line 643 maps to database ID: ${mappedId643}`);
    
    // 6. Summary
    logger.info('\n📊 QUICK VERIFICATION SUMMARY:');
    logger.info('✅ Database connection working');
    logger.info(`✅ Line 643: ${line643Result?.cruise_count || 0} cruises found`);
    logger.info(`✅ Recent webhooks: ${webhookResult?.total || 0} in last 7 days`);
    
    const totalPending = pendingCheck.rows.reduce((sum, row) => sum + parseInt(row.pending_count), 0);
    logger.info(`✅ Total pending updates: ${totalPending} cruises`);
    
    // Recommendations
    logger.info('\n📋 NEXT STEPS:');
    if (line643Result?.marked_count > 0) {
      logger.info(`1. Line 643 has ${line643Result.marked_count} cruises marked - batch sync should process them`);
    }
    if (totalPending > 0) {
      logger.info(`2. ${totalPending} total cruises need updates - run batch sync`);
    }
    logger.info('3. Monitor webhook processing and batch sync execution');
    logger.info('4. Check FTP connectivity for affected cruise lines');
    
  } catch (error) {
    logger.error('❌ Verification failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run the verification
quickVerification().catch(console.error);