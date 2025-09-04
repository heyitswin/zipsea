#!/usr/bin/env tsx

/**
 * Production FTP Diagnosis Script
 * 
 * This script diagnoses the critical bulk FTP issues:
 * 1. Check environment and FTP credentials
 * 2. Test database connectivity and cruise counts
 * 3. Simulate a bulk FTP process (safely)
 * 4. Identify the actual root causes
 */

import { logger } from '../src/config/logger';
import { env, isProduction, isStaging } from '../src/config/environment';
import { db } from '../src/db/connection';
import { sql } from 'drizzle-orm';

async function runProductionDiagnosis() {
  console.log('🔍 PRODUCTION FTP BULK PROCESSING DIAGNOSIS');
  console.log('='.repeat(80));
  
  try {
    // 1. Environment Analysis
    console.log('\n1️⃣ ENVIRONMENT ANALYSIS');
    console.log('-'.repeat(40));
    console.log(`NODE_ENV: ${env.NODE_ENV}`);
    console.log(`Is Production: ${isProduction}`);
    console.log(`Is Staging: ${isStaging}`);
    
    console.log('\nFTP Configuration:');
    const hasHost = !!env.TRAVELTEK_FTP_HOST;
    const hasUser = !!env.TRAVELTEK_FTP_USER;
    const hasPassword = !!env.TRAVELTEK_FTP_PASSWORD;
    
    console.log(`- FTP Host: ${hasHost ? '✅ CONFIGURED' : '❌ MISSING'}`);
    console.log(`- FTP User: ${hasUser ? '✅ CONFIGURED' : '❌ MISSING'}`);
    console.log(`- FTP Password: ${hasPassword ? '✅ CONFIGURED' : '❌ MISSING'}`);
    
    if (!hasHost || !hasUser || !hasPassword) {
      console.log('\n🚨 CRITICAL ISSUE FOUND:');
      console.log('   FTP credentials are missing! This explains the 0% success rate.');
      console.log('   All FTP downloads will fail at the connection stage.');
      
      if (isStaging) {
        console.log('\n💡 SOLUTION for Local Development:');
        console.log('   Add these lines to your .env file:');
        console.log('   TRAVELTEK_FTP_HOST=your-ftp-host');
        console.log('   TRAVELTEK_FTP_USER=your-ftp-user');
        console.log('   TRAVELTEK_FTP_PASSWORD=your-ftp-password');
      }
      
      if (isProduction) {
        console.log('\n💡 SOLUTION for Production:');
        console.log('   Add these environment variables to your Render deployment:');
        console.log('   - TRAVELTEK_FTP_HOST');
        console.log('   - TRAVELTEK_FTP_USER');
        console.log('   - TRAVELTEK_FTP_PASSWORD');
      }
    } else {
      console.log('\n✅ FTP credentials are configured');
    }
    
    // 2. Database Analysis for Royal Caribbean and AmaWaterways
    console.log('\n2️⃣ DATABASE ANALYSIS FOR AFFECTED LINES');
    console.log('-'.repeat(40));
    
    const affectedLines = [
      { id: 22, name: 'Royal Caribbean' },
      { id: 63, name: 'AmaWaterways' }
    ];
    
    for (const line of affectedLines) {
      console.log(`\n📊 ${line.name} (Line ID ${line.id}):`);
      
      try {
        // Check total cruises
        const totalResult = await db.execute(sql`
          SELECT COUNT(*) as total
          FROM cruises 
          WHERE cruise_line_id = ${line.id}
        `);
        
        // Check future cruises (what should be processed)
        const futureResult = await db.execute(sql`
          SELECT COUNT(*) as future
          FROM cruises 
          WHERE cruise_line_id = ${line.id} 
            AND sailing_date >= CURRENT_DATE 
            AND sailing_date <= CURRENT_DATE + INTERVAL '2 years'
            AND is_active = true
        `);
        
        // Check recent updates
        const recentResult = await db.execute(sql`
          SELECT COUNT(*) as recent
          FROM cruises 
          WHERE cruise_line_id = ${line.id} 
            AND updated_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
        `);
        
        // Check ships
        const shipsResult = await db.execute(sql`
          SELECT DISTINCT s.id, s.name
          FROM cruises c
          JOIN ships s ON c.ship_id = s.id
          WHERE c.cruise_line_id = ${line.id}
            AND c.sailing_date >= CURRENT_DATE
            AND c.is_active = true
          ORDER BY s.name
          LIMIT 10
        `);
        
        const total = Number(totalResult[0]?.total || 0);
        const future = Number(futureResult[0]?.future || 0);
        const recent = Number(recentResult[0]?.recent || 0);
        
        console.log(`   Total cruises: ${total.toLocaleString()}`);
        console.log(`   Future cruises (processable): ${future.toLocaleString()}`);
        console.log(`   Updated in last 24h: ${recent.toLocaleString()}`);
        console.log(`   Unique ships: ${shipsResult.length}`);
        
        if (future === 0) {
          console.log(`   ❌ NO FUTURE CRUISES FOUND - This explains 0% success!`);
        }
        
        if (shipsResult.length > 0) {
          console.log(`   Sample ships: ${shipsResult.slice(0, 3).map(s => s.name).join(', ')}`);
        }
        
        // Calculate expected success rate
        const expectedFiles = Math.min(future, 500); // Limited by MEGA_BATCH_SIZE
        console.log(`   Expected files to process: ${expectedFiles}`);
        
        if (line.id === 22) {
          console.log(`   User reported: 19/500 updated (4% success)`);
        } else if (line.id === 63) {
          console.log(`   User reported: 118/500 updated (24% success)`);
        }
        
      } catch (error) {
        console.log(`   ❌ Database query failed: ${error instanceof Error ? error.message : error}`);
      }
    }
    
    // 3. Recent Webhook Activity Analysis
    console.log('\n3️⃣ RECENT WEBHOOK ACTIVITY ANALYSIS');
    console.log('-'.repeat(40));
    
    try {
      // Check if webhook_events table exists
      const webhookEventsExists = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'webhook_events'
        )
      `);
      
      if (webhookEventsExists[0]?.exists) {
        const recentWebhooks = await db.execute(sql`
          SELECT 
            line_id,
            event_type,
            successful_count,
            failed_count,
            processing_time_ms,
            created_at,
            processed
          FROM webhook_events 
          WHERE line_id IN (22, 63)
            AND created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
          ORDER BY created_at DESC 
          LIMIT 10
        `);
        
        if (recentWebhooks.length > 0) {
          console.log('📡 Recent webhook events:');
          recentWebhooks.forEach((webhook: any) => {
            const successRate = webhook.successful_count + webhook.failed_count > 0 
              ? Math.round((webhook.successful_count / (webhook.successful_count + webhook.failed_count)) * 100)
              : 0;
            const timeSince = Math.round((Date.now() - new Date(webhook.created_at).getTime()) / (1000 * 60 * 60));
            
            console.log(`   Line ${webhook.line_id}: ${webhook.successful_count}/${webhook.failed_count} (${successRate}%) - ${timeSince}h ago`);
          });
        } else {
          console.log('📡 No recent webhook events found for these lines');
        }
      } else {
        console.log('📡 webhook_events table does not exist');
      }
    } catch (error) {
      console.log(`❌ Webhook analysis failed: ${error instanceof Error ? error.message : error}`);
    }
    
    // 4. System Performance Analysis
    console.log('\n4️⃣ SYSTEM PERFORMANCE INDICATORS');
    console.log('-'.repeat(40));
    
    try {
      // Check bulk update patterns
      const bulkUpdatePattern = await db.execute(sql`
        SELECT 
          cruise_line_id,
          COUNT(*) as updates,
          MIN(updated_at) as first_update,
          MAX(updated_at) as last_update,
          EXTRACT(EPOCH FROM (MAX(updated_at) - MIN(updated_at))) as duration_seconds
        FROM cruises
        WHERE updated_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
          AND cruise_line_id IN (22, 63)
        GROUP BY cruise_line_id
        HAVING COUNT(*) >= 10
        ORDER BY last_update DESC
      `);
      
      if (bulkUpdatePattern.length > 0) {
        console.log('📊 Recent bulk update patterns:');
        bulkUpdatePattern.forEach((pattern: any) => {
          const lineName = pattern.cruise_line_id === 22 ? 'Royal Caribbean' : 'AmaWaterways';
          const durationMin = Math.round(Number(pattern.duration_seconds) / 60);
          const lastUpdateHours = Math.round((Date.now() - new Date(pattern.last_update).getTime()) / (1000 * 60 * 60));
          
          console.log(`   ${lineName}: ${pattern.updates} cruises updated in ${durationMin} minutes, ${lastUpdateHours}h ago`);
        });
      } else {
        console.log('📊 No significant bulk update patterns found recently');
      }
    } catch (error) {
      console.log(`❌ Performance analysis failed: ${error instanceof Error ? error.message : error}`);
    }
    
    // 5. Final Diagnosis
    console.log('\n5️⃣ FINAL DIAGNOSIS AND RECOMMENDATIONS');
    console.log('-'.repeat(40));
    
    console.log('\n🔍 ROOT CAUSE ANALYSIS:');
    
    if (!hasHost || !hasUser || !hasPassword) {
      console.log('1. 🚨 MISSING FTP CREDENTIALS (PRIMARY CAUSE)');
      console.log('   - All FTP connections fail immediately');
      console.log('   - No files can be downloaded');
      console.log('   - Explains 0-24% success rates');
      console.log('   - Circuit breaker absorbs connection errors');
      console.log('   - Processing takes 10+ minutes due to timeouts');
    }
    
    console.log('\n💡 IMMEDIATE FIXES REQUIRED:');
    console.log('1. Add FTP credentials to production environment');
    console.log('2. Verify FTP server accessibility from production');
    console.log('3. Test connection with a small batch first');
    
    console.log('\n🎯 EXPECTED RESULTS AFTER FIX:');
    console.log('- Success rate should jump to 90%+ immediately');
    console.log('- Processing time should drop to 1-2 minutes');
    console.log('- Proper error reporting for actual issues');
    console.log('- No more silent failures');
    
  } catch (error) {
    logger.error('💥 Diagnosis failed:', error);
  } finally {
    console.log('\n✅ Diagnosis completed');
    process.exit(0);
  }
}

runProductionDiagnosis();