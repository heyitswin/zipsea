#!/usr/bin/env node

import dotenv from 'dotenv';
import Client from 'ftp';
import { db } from '../dist/db/connection.js';
import { sql } from 'drizzle-orm';

dotenv.config();

const FTP_HOST = process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net';
const FTP_USER = process.env.TRAVELTEK_FTP_USER;
const FTP_PASSWORD = process.env.TRAVELTEK_FTP_PASSWORD;

console.log('🔍 TRAVELTEK FTP & WEBHOOK SYNC INVESTIGATION');
console.log('=' . repeat(60));
console.log(`Started at: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET\n`);

// Check FTP credentials
console.log('📋 FTP Configuration Check:');
console.log(`   Host: ${FTP_HOST}`);
console.log(`   User: ${FTP_USER ? FTP_USER.substring(0, 3) + '***' : '❌ NOT SET'}`);
console.log(`   Password: ${FTP_PASSWORD ? '✅ SET' : '❌ NOT SET'}`);

if (!FTP_USER || !FTP_PASSWORD) {
  console.log('\n❌ FTP credentials are missing!');
  console.log('   Please set TRAVELTEK_FTP_USER and TRAVELTEK_FTP_PASSWORD environment variables');
  console.log('   In Render: Go to Environment > Add these variables');
  process.exit(1);
}

// Check recent webhook events
async function checkWebhookEvents() {
  console.log('\n📊 Recent Webhook Events (Last 24 Hours):');
  
  const recentWebhooks = await db.execute(sql`
    SELECT 
      id,
      event_type,
      line_id,
      processed,
      successful_count,
      failed_count,
      processing_time_ms,
      created_at,
      processed_at
    FROM webhook_events
    WHERE created_at >= NOW() - INTERVAL '24 hours'
    ORDER BY created_at DESC
    LIMIT 10
  `);

  if (recentWebhooks.length === 0) {
    console.log('   No webhook events in last 24 hours');
  } else {
    recentWebhooks.forEach((webhook, i) => {
      const status = webhook.processed ? '✅' : '⏳';
      const timeSince = Math.round((Date.now() - new Date(webhook.created_at).getTime()) / 60000);
      console.log(`   ${i + 1}. ${status} Line ${webhook.line_id} - ${timeSince}min ago (${webhook.successful_count || 0} successful)`);
    });
  }

  // Check cruises marked for update
  const markedCruises = await db.execute(sql`
    SELECT 
      cruise_line_id,
      COUNT(*) as count,
      MIN(price_update_requested_at) as oldest_request,
      MAX(price_update_requested_at) as newest_request
    FROM cruises
    WHERE needs_price_update = true
    GROUP BY cruise_line_id
    ORDER BY count DESC
    LIMIT 5
  `);

  console.log('\n⚠️  Cruises Marked for Price Update (Not Yet Synced):');
  if (markedCruises.length === 0) {
    console.log('   No cruises marked for update');
  } else {
    markedCruises.forEach(line => {
      const oldestMinutes = Math.round((Date.now() - new Date(line.oldest_request).getTime()) / 60000);
      console.log(`   Line ${line.cruise_line_id}: ${line.count} cruises (oldest: ${oldestMinutes}min ago)`);
    });
  }
}

// Test FTP connection and check file dates
async function testFTPConnection() {
  return new Promise((resolve, reject) => {
    const client = new Client();
    
    console.log('\n🔌 Testing FTP Connection...');
    
    client.on('ready', async () => {
      console.log('   ✅ Connected to FTP server');
      
      // List recent directories
      client.list('/2025', (err, list) => {
        if (err) {
          console.log('   ❌ Error listing /2025 directory:', err.message);
        } else {
          console.log('\n📁 Recent FTP Directories (/2025):');
          const sortedList = list.sort((a, b) => new Date(b.date) - new Date(a.date));
          sortedList.slice(0, 5).forEach(item => {
            if (item.type === 'd') {
              const modifiedAgo = Math.round((Date.now() - new Date(item.date).getTime()) / 3600000);
              console.log(`   ${item.name}/ - Modified ${modifiedAgo}h ago`);
            }
          });
        }
        
        // Check a specific month
        client.list('/2025/09', (err, list) => {
          if (err) {
            console.log('   ❌ Error listing /2025/09:', err.message);
          } else {
            console.log('\n📁 September 2025 Cruise Lines:');
            const directories = list.filter(item => item.type === 'd');
            console.log(`   Found ${directories.length} cruise line directories`);
            
            // Sample a few directories
            directories.slice(0, 3).forEach(dir => {
              const modifiedAgo = Math.round((Date.now() - new Date(dir.date).getTime()) / 3600000);
              console.log(`   Line ${dir.name}: Modified ${modifiedAgo}h ago`);
            });
          }
          
          client.end();
          resolve();
        });
      });
    });
    
    client.on('error', (err) => {
      console.log('   ❌ FTP Connection Error:', err.message);
      if (err.message.includes('Login incorrect')) {
        console.log('   ⚠️  FTP credentials are invalid or expired');
        console.log('   Please verify credentials with Traveltek');
      }
      reject(err);
    });
    
    // Connect
    client.connect({
      host: FTP_HOST,
      user: FTP_USER,
      password: FTP_PASSWORD,
      connTimeout: 10000,
      pasvTimeout: 10000
    });
  });
}

// Analyze the issue
async function analyzeIssue() {
  console.log('\n🔍 ANALYSIS SUMMARY:');
  console.log('=' . repeat(60));
  
  // Check if webhooks are being skipped due to size
  const largeWebhooks = await db.execute(sql`
    SELECT 
      line_id,
      COUNT(*) as webhook_count,
      SUM(successful_count) as total_successful
    FROM webhook_events
    WHERE created_at >= NOW() - INTERVAL '24 hours'
      AND successful_count > 100
    GROUP BY line_id
  `);

  if (largeWebhooks.length > 0) {
    console.log('\n⚠️  ISSUE FOUND: Large webhooks are being deferred!');
    console.log('   When webhooks have >100 cruises, the system marks them');
    console.log('   for later sync instead of downloading from FTP immediately.');
    console.log('\n   Affected cruise lines (last 24h):');
    largeWebhooks.forEach(line => {
      console.log(`   - Line ${line.line_id}: ${line.webhook_count} webhooks, ${line.total_successful} cruises deferred`);
    });
    console.log('\n   SOLUTION: Need to run batch FTP sync for these marked cruises');
  }

  // Check FTP sync schedule
  const lastFTPSync = await db.execute(sql`
    SELECT 
      cruise_line_id,
      MAX(last_modified) as last_sync
    FROM cruises
    WHERE last_modified IS NOT NULL
    GROUP BY cruise_line_id
    ORDER BY last_sync DESC
    LIMIT 5
  `);

  console.log('\n📅 Last FTP Sync Times by Cruise Line:');
  if (lastFTPSync.length === 0) {
    console.log('   No FTP sync records found');
  } else {
    lastFTPSync.forEach(line => {
      const hoursAgo = Math.round((Date.now() - new Date(line.last_sync).getTime()) / 3600000);
      console.log(`   Line ${line.cruise_line_id}: ${hoursAgo}h ago`);
    });
  }

  console.log('\n📋 RECOMMENDATIONS:');
  console.log('   1. FTP credentials need to be verified/updated in Render');
  console.log('   2. Large webhooks (>100 cruises) are being deferred');
  console.log('   3. Need to run manual FTP sync for marked cruises');
  console.log('   4. Consider reducing webhook batch size threshold');
}

// Main execution
async function main() {
  try {
    await checkWebhookEvents();
    
    if (FTP_USER && FTP_PASSWORD) {
      await testFTPConnection().catch(err => {
        console.log('   FTP test failed, continuing with analysis...');
      });
    }
    
    await analyzeIssue();
    
    console.log('\n✅ Investigation complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during investigation:', error);
    process.exit(1);
  }
}

main();