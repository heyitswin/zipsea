#!/usr/bin/env node

/**
 * Check the current status of webhook processing
 * Shows Redis queue stats and recent database updates
 */

const Redis = require('ioredis');
const { Pool } = require('pg');

async function checkWebhookStatus() {
  // Connect to Redis
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  
  // Connect to database
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('\n=== WEBHOOK PROCESSING STATUS ===\n');
    console.log(`Time: ${new Date().toISOString()}\n`);

    // Check Redis queues
    console.log('📊 REDIS QUEUE STATUS:');
    
    // Check realtime-webhooks queue
    const webhookQueueKey = 'bull:realtime-webhooks:';
    const webhookWaiting = await redis.llen(`${webhookQueueKey}wait`);
    const webhookActive = await redis.llen(`${webhookQueueKey}active`);
    const webhookCompleted = await redis.zcard(`${webhookQueueKey}completed`);
    const webhookFailed = await redis.zcard(`${webhookQueueKey}failed`);
    
    console.log(`\nRealtime Webhooks Queue:`);
    console.log(`  ⏳ Waiting: ${webhookWaiting}`);
    console.log(`  🔄 Active: ${webhookActive}`);
    console.log(`  ✅ Completed: ${webhookCompleted}`);
    console.log(`  ❌ Failed: ${webhookFailed}`);

    // Check cruise-processing queue
    const cruiseQueueKey = 'bull:cruise-processing:';
    const cruiseWaiting = await redis.llen(`${cruiseQueueKey}wait`);
    const cruiseActive = await redis.llen(`${cruiseQueueKey}active`);
    const cruiseCompleted = await redis.zcard(`${cruiseQueueKey}completed`);
    const cruiseFailed = await redis.zcard(`${cruiseQueueKey}failed`);
    
    console.log(`\nCruise Processing Queue:`);
    console.log(`  ⏳ Waiting: ${cruiseWaiting}`);
    console.log(`  🔄 Active: ${cruiseActive}`);
    console.log(`  ✅ Completed: ${cruiseCompleted}`);
    console.log(`  ❌ Failed: ${cruiseFailed}`);

    // Check database for recent updates
    console.log('\n📈 DATABASE UPDATE STATUS:');
    
    // Check cruises updated in last hour
    const recentUpdatesQuery = `
      SELECT 
        cl.name as cruise_line,
        cl.id as line_id,
        COUNT(CASE WHEN c.pricing_updated_at > NOW() - INTERVAL '5 minutes' THEN 1 END) as last_5_min,
        COUNT(CASE WHEN c.pricing_updated_at > NOW() - INTERVAL '15 minutes' THEN 1 END) as last_15_min,
        COUNT(CASE WHEN c.pricing_updated_at > NOW() - INTERVAL '1 hour' THEN 1 END) as last_hour,
        MAX(c.pricing_updated_at) as most_recent_update
      FROM cruises c
      JOIN cruise_lines cl ON c.line_id = cl.id
      WHERE c.pricing_updated_at > NOW() - INTERVAL '1 hour'
      GROUP BY cl.id, cl.name
      HAVING COUNT(CASE WHEN c.pricing_updated_at > NOW() - INTERVAL '1 hour' THEN 1 END) > 0
      ORDER BY COUNT(CASE WHEN c.pricing_updated_at > NOW() - INTERVAL '5 minutes' THEN 1 END) DESC
      LIMIT 10
    `;
    
    const result = await pool.query(recentUpdatesQuery);
    
    if (result.rows.length > 0) {
      console.log('\nRecent cruise updates by line:');
      console.log('Line Name                    | Line ID | Last 5m | Last 15m | Last Hour | Most Recent');
      console.log('----------------------------|---------|---------|----------|-----------|----------------------');
      
      result.rows.forEach(row => {
        const lineName = row.cruise_line.padEnd(27).substring(0, 27);
        const lineId = row.line_id.toString().padEnd(7);
        const last5 = row.last_5_min.toString().padEnd(7);
        const last15 = row.last_15_min.toString().padEnd(8);
        const lastHour = row.last_hour.toString().padEnd(9);
        const recent = row.most_recent_update ? new Date(row.most_recent_update).toISOString().substring(11, 19) : 'Never';
        
        console.log(`${lineName} | ${lineId} | ${last5} | ${last15} | ${lastHour} | ${recent}`);
      });
    } else {
      console.log('\n⚠️  No cruise updates in the last hour');
    }

    // Check webhook records in database
    const webhookQuery = `
      SELECT 
        webhook_id,
        event_type,
        line_id,
        status,
        created_at,
        processed_at,
        EXTRACT(EPOCH FROM (processed_at - created_at)) as processing_time_seconds
      FROM webhook_logs
      WHERE created_at > NOW() - INTERVAL '30 minutes'
      ORDER BY created_at DESC
      LIMIT 5
    `;
    
    const webhookResult = await pool.query(webhookQuery);
    
    if (webhookResult.rows.length > 0) {
      console.log('\n📝 Recent Webhook Logs:');
      console.log('Webhook ID                    | Line | Status    | Processing Time | Created At');
      console.log('------------------------------|------|-----------|-----------------|------------');
      
      webhookResult.rows.forEach(row => {
        const webhookId = (row.webhook_id || 'N/A').substring(0, 28).padEnd(28);
        const lineId = (row.line_id || 'N/A').toString().padEnd(4);
        const status = (row.status || 'pending').padEnd(9);
        const procTime = row.processing_time_seconds ? `${Math.round(row.processing_time_seconds)}s`.padEnd(15) : 'In Progress     ';
        const createdAt = new Date(row.created_at).toISOString().substring(11, 19);
        
        console.log(`${webhookId} | ${lineId} | ${status} | ${procTime} | ${createdAt}`);
      });
    } else {
      console.log('\n⚠️  No webhook logs in the last 30 minutes');
    }

    // Check for Line 3 specifically (current processing)
    const line3Query = `
      SELECT 
        COUNT(*) as total_cruises,
        COUNT(CASE WHEN pricing_updated_at > NOW() - INTERVAL '30 minutes' THEN 1 END) as updated_last_30min,
        COUNT(CASE WHEN pricing_updated_at > NOW() - INTERVAL '5 minutes' THEN 1 END) as updated_last_5min,
        MAX(pricing_updated_at) as last_update
      FROM cruises 
      WHERE line_id = 22  -- Line 3 maps to database line 22
    `;
    
    const line3Result = await pool.query(line3Query);
    
    console.log('\n🎯 LINE 3 (ID: 22) SPECIFIC STATUS:');
    if (line3Result.rows[0]) {
      const row = line3Result.rows[0];
      console.log(`  Total Cruises: ${row.total_cruises}`);
      console.log(`  Updated in last 30 min: ${row.updated_last_30min}`);
      console.log(`  Updated in last 5 min: ${row.updated_last_5min}`);
      console.log(`  Last Update: ${row.last_update ? new Date(row.last_update).toISOString() : 'Never'}`);
      
      if (row.updated_last_5min > 0) {
        const successRate = Math.round((row.updated_last_5min / row.total_cruises) * 100);
        console.log(`  📈 Processing appears active! ${row.updated_last_5min} cruises updated recently`);
      }
    }

  } catch (error) {
    console.error('Error checking status:', error);
  } finally {
    await redis.quit();
    await pool.end();
  }
}

// Run the check
checkWebhookStatus().catch(console.error);