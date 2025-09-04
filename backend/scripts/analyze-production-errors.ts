#!/usr/bin/env tsx

/**
 * Production Error Analysis Script
 * 
 * This script analyzes recent errors in the system to identify patterns
 * that might explain why webhook processing is failing.
 */

import IORedis from 'ioredis';
import { Queue, Job } from 'bullmq';
import { env } from '../src/config/environment';
import { db } from '../src/db/connection';
import { sql } from 'drizzle-orm';

interface ErrorPattern {
  type: string;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  examples: string[];
}

async function main() {
  console.log('🔍 Production Error Analysis');
  console.log('===========================\n');

  // Initialize Redis connection
  const redis = env.REDIS_URL ? 
    new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    }) :
    new IORedis({
      host: env.REDIS_HOST || 'localhost',
      port: env.REDIS_PORT || 6379,
      password: env.REDIS_PASSWORD,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

  try {
    console.log('1. 🚨 BullMQ Failed Jobs Analysis');
    console.log('────────────────────────────────');
    
    const queueNames = ['realtime-webhooks', 'cruise-processing'];
    const errorPatterns = new Map<string, ErrorPattern>();
    
    for (const queueName of queueNames) {
      console.log(`\n📋 Analyzing failed jobs in ${queueName}:`);
      
      const queue = new Queue(queueName, { connection: redis });
      
      try {
        // Get failed jobs
        const failedJobs = await queue.getFailed(0, 50); // Last 50 failures
        console.log(`  Found ${failedJobs.length} failed jobs`);
        
        if (failedJobs.length > 0) {
          console.log(`  Analyzing failure patterns...`);
          
          for (const job of failedJobs) {
            const error = job.failedReason || 'Unknown error';
            const timestamp = new Date(job.timestamp);
            
            // Classify error type
            let errorType = 'Unknown';
            if (error.includes('FTP') || error.includes('connection') || error.includes('timeout')) {
              errorType = 'FTP Connection';
            } else if (error.includes('credentials') || error.includes('authentication')) {
              errorType = 'FTP Credentials';
            } else if (error.includes('file not found') || error.includes('404')) {
              errorType = 'File Not Found';
            } else if (error.includes('JSON') || error.includes('parse')) {
              errorType = 'JSON Parse Error';
            } else if (error.includes('database') || error.includes('sql')) {
              errorType = 'Database Error';
            } else if (error.includes('Circuit breaker')) {
              errorType = 'Circuit Breaker';
            } else if (error.includes('redis') || error.includes('Redis')) {
              errorType = 'Redis Error';
            }
            
            // Track pattern
            const key = `${queueName}:${errorType}`;
            if (errorPatterns.has(key)) {
              const pattern = errorPatterns.get(key)!;
              pattern.count++;
              pattern.lastSeen = timestamp;
              if (pattern.examples.length < 3) {
                pattern.examples.push(error);
              }
            } else {
              errorPatterns.set(key, {
                type: errorType,
                count: 1,
                firstSeen: timestamp,
                lastSeen: timestamp,
                examples: [error]
              });
            }
          }
          
          // Show recent failure details
          console.log(`\n  Recent failure examples:`);
          for (const job of failedJobs.slice(0, 5)) {
            const failedAt = new Date(job.timestamp);
            const ageHours = Math.floor((Date.now() - job.timestamp) / (1000 * 60 * 60));
            console.log(`    - ${failedAt.toISOString()} (${ageHours}h ago): ${job.failedReason?.substring(0, 100)}...`);
          }
        }
        
      } catch (error) {
        console.log(`  ❌ Error analyzing ${queueName}: ${error instanceof Error ? error.message : 'Unknown'}`);
      } finally {
        await queue.close();
      }
    }

    // Display error pattern summary
    if (errorPatterns.size > 0) {
      console.log('\n📊 Error Pattern Summary');
      console.log('───────────────────────');
      
      const sortedPatterns = Array.from(errorPatterns.entries())
        .sort(([,a], [,b]) => b.count - a.count);
      
      for (const [key, pattern] of sortedPatterns) {
        const queue = key.split(':')[0];
        const ageHours = Math.floor((Date.now() - pattern.lastSeen.getTime()) / (1000 * 60 * 60));
        
        console.log(`\n  ${pattern.type} (${queue} queue):`);
        console.log(`    Count: ${pattern.count} failures`);
        console.log(`    Last seen: ${pattern.lastSeen.toISOString()} (${ageHours}h ago)`);
        console.log(`    Example: ${pattern.examples[0].substring(0, 120)}...`);
      }
    }

    console.log('\n2. 📈 Database Update Activity');
    console.log('─────────────────────────────');
    
    try {
      // Check recent cruise updates
      const recentUpdates = await db.execute(sql`
        SELECT 
          cruise_line_id,
          COUNT(*) as cruise_count,
          MAX(last_updated) as most_recent_update
        FROM cruises 
        WHERE last_updated >= NOW() - INTERVAL '24 hours'
        GROUP BY cruise_line_id
        ORDER BY cruise_count DESC
      `);
      
      console.log('Cruises updated in last 24 hours:');
      if (recentUpdates.length === 0) {
        console.log('  ❌ NO CRUISES UPDATED - This confirms webhook processing is broken!');
      } else {
        for (const row of recentUpdates) {
          console.log(`  Line ${row.cruise_line_id}: ${row.cruise_count} cruises (latest: ${row.most_recent_update})`);
        }
      }
      
      // Check pricing updates
      const pricingUpdates = await db.execute(sql`
        SELECT DATE(created_at) as update_date, COUNT(*) as price_records
        FROM pricing 
        WHERE created_at >= NOW() - INTERVAL '3 days'
        GROUP BY DATE(created_at)
        ORDER BY update_date DESC
      `);
      
      console.log('\nPricing records created in last 3 days:');
      if (pricingUpdates.length === 0) {
        console.log('  ❌ NO PRICING UPDATES - Confirms no successful webhook processing');
      } else {
        for (const row of pricingUpdates) {
          console.log(`  ${row.update_date}: ${row.price_records} pricing records`);
        }
      }
      
    } catch (error) {
      console.log(`❌ Error checking database activity: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    console.log('\n3. 🕐 Timeline Analysis');
    console.log('──────────────────────');
    
    try {
      // Check when things stopped working
      const lastSuccessfulUpdates = await db.execute(sql`
        SELECT 
          cruise_line_id,
          MAX(last_updated) as last_update,
          COUNT(*) as total_cruises
        FROM cruises 
        WHERE last_updated >= '2024-09-01'
        GROUP BY cruise_line_id
        ORDER BY last_update DESC
      `);
      
      console.log('Last successful updates by cruise line:');
      for (const row of lastSuccessfulUpdates.slice(0, 10)) {
        const daysSince = Math.floor((Date.now() - new Date(row.last_update).getTime()) / (1000 * 60 * 60 * 24));
        const status = daysSince === 0 ? '✅ Today' : daysSince === 1 ? '⚠️ Yesterday' : `❌ ${daysSince} days ago`;
        console.log(`  Line ${row.cruise_line_id}: ${row.last_update} (${status})`);
      }
      
      // Specific check for Royal Caribbean (Line 3)
      const royalCaribbean = lastSuccessfulUpdates.find(row => row.cruise_line_id === 3);
      if (royalCaribbean) {
        const daysSince = Math.floor((Date.now() - new Date(royalCaribbean.last_update).getTime()) / (1000 * 60 * 60 * 24));
        console.log(`\n🚢 Royal Caribbean (Line 3) Analysis:`);
        console.log(`  Last update: ${royalCaribbean.last_update}`);
        console.log(`  Days since last update: ${daysSince}`);
        console.log(`  Total cruises in system: ${royalCaribbean.total_cruises}`);
        
        if (daysSince > 0) {
          console.log('  🚨 This confirms Royal Caribbean webhook processing is broken!');
        }
      }
      
    } catch (error) {
      console.log(`❌ Error in timeline analysis: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    console.log('\n4. 🔧 System Health Check');
    console.log('────────────────────────');
    
    // Check Redis health
    try {
      await redis.ping();
      console.log('✅ Redis: Connected and responsive');
      
      const redisInfo = await redis.info('stats');
      const totalCommandsMatch = redisInfo.match(/total_commands_processed:(\d+)/);
      if (totalCommandsMatch) {
        console.log(`   Total commands processed: ${totalCommandsMatch[1]}`);
      }
      
    } catch (error) {
      console.log(`❌ Redis: Connection failed - ${error instanceof Error ? error.message : 'Unknown'}`);
    }
    
    // Check database connectivity
    try {
      const dbTest = await db.execute(sql`SELECT 1 as test`);
      console.log('✅ Database: Connected and responsive');
    } catch (error) {
      console.log(`❌ Database: Connection failed - ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    console.log('\n5. 🎯 Root Cause Analysis');
    console.log('────────────────────────');
    
    // Analyze the patterns to determine root cause
    let rootCause = 'Unknown';
    let confidence = 'Low';
    let recommendation = 'Further investigation needed';
    
    const topErrorType = Array.from(errorPatterns.entries())
      .sort(([,a], [,b]) => b.count - a.count)[0];
    
    if (!topErrorType && recentUpdates.length === 0) {
      rootCause = 'Workers not running or not processing jobs';
      confidence = 'High';
      recommendation = 'Check worker initialization and Redis queue status';
    } else if (topErrorType && topErrorType[1].type === 'FTP Credentials') {
      rootCause = 'FTP credentials are missing or invalid';
      confidence = 'High';
      recommendation = 'Verify FTP environment variables on Render';
    } else if (topErrorType && topErrorType[1].type === 'FTP Connection') {
      rootCause = 'FTP server connectivity issues';
      confidence = 'Medium';
      recommendation = 'Test FTP connectivity and check network/firewall issues';
    } else if (topErrorType && topErrorType[1].type === 'Circuit Breaker') {
      rootCause = 'FTP circuit breaker is open due to repeated failures';
      confidence = 'Medium';
      recommendation = 'Reset circuit breaker and fix underlying FTP issues';
    }
    
    console.log(`Root Cause Assessment:`);
    console.log(`  Probable cause: ${rootCause}`);
    console.log(`  Confidence level: ${confidence}`);
    console.log(`  Recommendation: ${recommendation}`);
    
    if (topErrorType) {
      console.log(`\nDominant error pattern:`);
      console.log(`  Type: ${topErrorType[1].type}`);
      console.log(`  Occurrences: ${topErrorType[1].count}`);
      console.log(`  Example: ${topErrorType[1].examples[0].substring(0, 200)}...`);
    }

    console.log('\n6. 📝 Action Plan');
    console.log('─────────────────');
    
    console.log('Immediate actions to take:');
    
    if (rootCause.includes('Workers not running')) {
      console.log('1. 🔄 Check if workers are running: npm run script:check-worker-status-production');
      console.log('2. 📊 Monitor Redis queues: npm run script:monitor-redis-queues-production');
      console.log('3. 🔄 Restart the application to reinitialize workers');
    } else if (rootCause.includes('FTP credentials')) {
      console.log('1. 🧪 Test FTP connectivity: npm run script:test-ftp-connectivity-production');
      console.log('2. ✅ Verify FTP environment variables on Render dashboard');
      console.log('3. 🔄 Restart application after fixing credentials');
    } else if (rootCause.includes('FTP')) {
      console.log('1. 🧪 Test FTP connectivity: npm run script:test-ftp-connectivity-production');
      console.log('2. 🔄 Reset circuit breakers if needed');
      console.log('3. 📞 Contact FTP provider if connectivity issues persist');
    }
    
    console.log('\nMonitoring commands:');
    console.log('• Queue status: npm run script:monitor-redis-queues-production');
    console.log('• Worker status: npm run script:check-worker-status-production');
    console.log('• FTP status: npm run script:test-ftp-connectivity-production');

    console.log('\n✨ Error analysis complete!');

  } catch (error) {
    console.error('❌ Error during error analysis:', error);
  } finally {
    await redis.quit();
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});