#!/usr/bin/env node

const { traveltekFTPService } = require('../dist/services/traveltek-ftp.service');
const { db } = require('../dist/db/connection');
const { sql } = require('drizzle-orm');

/**
 * Comprehensive FTP Sync Investigation Script
 * 
 * This script investigates:
 * 1. Current FTP connection status
 * 2. File modification dates on FTP vs database sync dates
 * 3. Missing files or directories we might not be monitoring
 * 4. Recent webhook activity vs FTP sync dates
 * 5. Sample file content to verify data freshness
 */

async function investigateFTPSyncStatus() {
  console.log('\n🔍 === TRAVELTEK FTP SYNC INVESTIGATION ===\n');
  
  let ftpConnected = false;
  
  try {
    // 1. Test FTP Connection
    console.log('1. 🔌 Testing FTP Connection...');
    const healthCheck = await traveltekFTPService.healthCheck();
    
    if (healthCheck.connected) {
      console.log('   ✅ FTP Connection: SUCCESS');
      ftpConnected = true;
    } else {
      console.log('   ❌ FTP Connection: FAILED');
      console.log('   Error:', healthCheck.error);
      
      // Try to get more detailed connection info
      try {
        await traveltekFTPService.connect();
        console.log('   🔄 Manual connection attempt: SUCCESS');
        ftpConnected = true;
      } catch (connectError) {
        console.log('   ❌ Manual connection attempt: FAILED');
        console.log('   Details:', connectError.message);
      }
    }
    
    if (!ftpConnected) {
      console.log('\n⚠️  Cannot proceed with FTP investigation - connection failed');
      await investigateDatabaseSyncStatus();
      return;
    }
    
    // 2. Check FTP Directory Structure
    console.log('\n2. 📁 Checking FTP Directory Structure...');
    await checkFTPStructure();
    
    // 3. Sample File Modification Times
    console.log('\n3. ⏰ Checking File Modification Times...');
    await checkFileModificationTimes();
    
    // 4. Compare with Database Sync Times
    console.log('\n4. 🏢 Checking Database Sync Status...');
    await investigateDatabaseSyncStatus();
    
    // 5. Check Recent Webhook Activity
    console.log('\n5. 🔔 Checking Recent Webhook Activity...');
    await checkWebhookActivity();
    
    // 6. Identify Potential Gaps
    console.log('\n6. 🕳️  Identifying Potential Sync Gaps...');
    await identifySyncGaps();
    
  } catch (error) {
    console.error('❌ Investigation failed:', error.message);
  } finally {
    try {
      await traveltekFTPService.disconnect();
      console.log('\n🔌 FTP connection closed');
    } catch (disconnectError) {
      console.log('⚠️  Error disconnecting from FTP:', disconnectError.message);
    }
  }
}

async function checkFTPStructure() {
  try {
    // Check current year structure
    const currentYear = new Date().getFullYear().toString();
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    
    console.log(`   📅 Checking current period: ${currentYear}/${currentMonth}`);
    
    // List root directory
    const rootFiles = await traveltekFTPService.listFiles('.');
    const yearDirs = rootFiles
      .filter(f => f.type === 'd' && /^\d{4}$/.test(f.name))
      .map(f => f.name)
      .sort();
    
    console.log(`   📂 Available years: ${yearDirs.join(', ')}`);
    
    if (!yearDirs.includes(currentYear)) {
      console.log(`   ⚠️  Current year ${currentYear} not found in FTP!`);
      return;
    }
    
    // Check months for current year
    const monthFiles = await traveltekFTPService.listFiles(currentYear);
    const monthDirs = monthFiles
      .filter(f => f.type === 'd' && /^\d{2}$/.test(f.name))
      .map(f => f.name)
      .sort();
    
    console.log(`   📅 Available months in ${currentYear}: ${monthDirs.join(', ')}`);
    
    if (!monthDirs.includes(currentMonth)) {
      console.log(`   ⚠️  Current month ${currentMonth} not found in ${currentYear}!`);
      return;
    }
    
    // Check cruise lines for current month
    const lineFiles = await traveltekFTPService.listFiles(`${currentYear}/${currentMonth}`);
    const lineDirs = lineFiles
      .filter(f => f.type === 'd')
      .map(f => ({ name: f.name, date: f.date }))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    console.log(`   🚢 Available cruise lines in ${currentYear}/${currentMonth}:`);
    lineDirs.forEach(line => {
      console.log(`      Line ${line.name}: Last modified ${line.date || 'Unknown'}`);
    });
    
    // Sample a few cruise lines for ship data
    const sampleLines = lineDirs.slice(0, 3);
    for (const line of sampleLines) {
      try {
        const shipFiles = await traveltekFTPService.listFiles(`${currentYear}/${currentMonth}/${line.name}`);
        const shipDirs = shipFiles
          .filter(f => f.type === 'd')
          .map(f => f.name);
        
        console.log(`      └─ Line ${line.name} ships: ${shipDirs.slice(0, 5).join(', ')}${shipDirs.length > 5 ? ' ...' : ''} (${shipDirs.length} total)`);
        
        // Sample one ship to see cruise files
        if (shipDirs.length > 0) {
          const sampleShip = shipDirs[0];
          const cruiseFiles = await traveltekFTPService.listFiles(`${currentYear}/${currentMonth}/${line.name}/${sampleShip}`);
          const jsonFiles = cruiseFiles
            .filter(f => f.name.endsWith('.json'))
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 3);
          
          if (jsonFiles.length > 0) {
            console.log(`         └─ Ship ${sampleShip} sample files:`);
            jsonFiles.forEach(file => {
              console.log(`            ${file.name}: ${file.date || 'No date'} (${file.size || 0} bytes)`);
            });
          }
        }
      } catch (error) {
        console.log(`      └─ Line ${line.name}: Error accessing ships - ${error.message}`);
      }
    }
    
  } catch (error) {
    console.log(`   ❌ Error checking FTP structure: ${error.message}`);
  }
}

async function checkFileModificationTimes() {
  try {
    const now = new Date();
    const currentYear = now.getFullYear().toString();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    
    // Get recently modified files across different cruise lines
    const recentFiles = [];
    
    try {
      const lineFiles = await traveltekFTPService.listFiles(`${currentYear}/${currentMonth}`);
      const lineDirs = lineFiles
        .filter(f => f.type === 'd')
        .slice(0, 5); // Check first 5 lines
      
      for (const line of lineDirs) {
        try {
          const shipFiles = await traveltekFTPService.listFiles(`${currentYear}/${currentMonth}/${line.name}`);
          const shipDirs = shipFiles
            .filter(f => f.type === 'd')
            .slice(0, 2); // Check first 2 ships per line
          
          for (const ship of shipDirs) {
            try {
              const cruiseFiles = await traveltekFTPService.listFiles(`${currentYear}/${currentMonth}/${line.name}/${ship.name}`);
              const jsonFiles = cruiseFiles
                .filter(f => f.name.endsWith('.json'))
                .slice(0, 5); // Check first 5 cruises per ship
              
              jsonFiles.forEach(file => {
                recentFiles.push({
                  path: `${currentYear}/${currentMonth}/${line.name}/${ship.name}/${file.name}`,
                  date: file.date,
                  size: file.size,
                  lineId: line.name,
                  shipId: ship.name,
                  cruiseId: file.name.replace('.json', '')
                });
              });
              
            } catch (cruiseError) {
              console.log(`   ⚠️  Cannot access cruises for line ${line.name}, ship ${ship.name}: ${cruiseError.message}`);
            }
          }
        } catch (shipError) {
          console.log(`   ⚠️  Cannot access ships for line ${line.name}: ${shipError.message}`);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ Error checking modification times: ${error.message}`);
      return;
    }
    
    if (recentFiles.length === 0) {
      console.log('   ⚠️  No files found to check modification times');
      return;
    }
    
    // Sort by modification date
    recentFiles.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    console.log(`   📊 File modification analysis (${recentFiles.length} files sampled):`);
    console.log(`   📁 Most recently modified files:`);
    
    recentFiles.slice(0, 10).forEach((file, index) => {
      const modDate = new Date(file.date);
      const hoursAgo = Math.round((now - modDate) / (1000 * 60 * 60));
      console.log(`      ${index + 1}. Line ${file.lineId}, Ship ${file.shipId}, Cruise ${file.cruiseId}`);
      console.log(`         Modified: ${file.date} (${hoursAgo} hours ago)`);
    });
    
    // Analysis
    const filesLast24h = recentFiles.filter(f => (now - new Date(f.date)) < 24 * 60 * 60 * 1000);
    const filesLast12h = recentFiles.filter(f => (now - new Date(f.date)) < 12 * 60 * 60 * 1000);
    const filesLast6h = recentFiles.filter(f => (now - new Date(f.date)) < 6 * 60 * 60 * 1000);
    
    console.log(`\n   📈 Modification frequency analysis:`);
    console.log(`      Files modified in last 6 hours:  ${filesLast6h.length}`);
    console.log(`      Files modified in last 12 hours: ${filesLast12h.length}`);
    console.log(`      Files modified in last 24 hours: ${filesLast24h.length}`);
    
    if (filesLast12h.length > 0) {
      console.log(`   ✅ Recent activity detected - files are being updated on FTP`);
    } else {
      console.log(`   ⚠️  No recent file modifications in last 12 hours`);
    }
    
  } catch (error) {
    console.log(`   ❌ Error checking file modification times: ${error.message}`);
  }
}

async function investigateDatabaseSyncStatus() {
  try {
    // Check cruise line sync timestamps
    console.log('   🏢 Cruise line sync status:');
    
    const cruiseLineSync = await db.execute(sql`
      SELECT 
        id,
        name,
        code,
        last_sync_at,
        EXTRACT(EPOCH FROM (NOW() - last_sync_at)) / 3600 as hours_since_sync,
        is_active
      FROM cruise_lines 
      WHERE is_active = true
      ORDER BY last_sync_at DESC
    `);
    
    if (cruiseLineSync.length === 0) {
      console.log('      ❌ No active cruise lines found in database');
      return;
    }
    
    cruiseLineSync.forEach(line => {
      const hoursAgo = line.hours_since_sync ? Math.round(line.hours_since_sync) : 'Never';
      console.log(`      Line ${line.id} (${line.name}): Last sync ${hoursAgo === 'Never' ? 'Never' : hoursAgo + ' hours ago'}`);
    });
    
    // Find lines that haven't synced recently
    const staleLines = cruiseLineSync.filter(line => 
      !line.last_sync_at || line.hours_since_sync > 24
    );
    
    if (staleLines.length > 0) {
      console.log(`\n   ⚠️  Lines with stale sync (>24h or never):`);
      staleLines.forEach(line => {
        console.log(`      Line ${line.id} (${line.name}): ${line.last_sync_at ? Math.round(line.hours_since_sync) + 'h ago' : 'Never synced'}`);
      });
    }
    
    // Check general cruise data freshness
    const dataFreshness = await db.execute(sql`
      SELECT 
        COUNT(*) as total_cruises,
        COUNT(*) FILTER (WHERE sailing_date >= CURRENT_DATE) as future_cruises,
        COUNT(*) FILTER (WHERE needs_price_update = true) as needs_updates,
        MAX(updated_at) as last_cruise_update,
        EXTRACT(EPOCH FROM (NOW() - MAX(updated_at))) / 3600 as hours_since_last_update
      FROM cruises
    `);
    
    if (dataFreshness.length > 0) {
      const stats = dataFreshness[0];
      console.log(`\n   📊 Database content status:`);
      console.log(`      Total cruises: ${stats.total_cruises}`);
      console.log(`      Future cruises: ${stats.future_cruises}`);
      console.log(`      Cruises needing updates: ${stats.needs_updates}`);
      console.log(`      Last cruise update: ${stats.last_cruise_update || 'Never'}`);
      if (stats.hours_since_last_update) {
        console.log(`      Hours since last update: ${Math.round(stats.hours_since_last_update)}`);
      }
    }
    
  } catch (error) {
    console.log(`   ❌ Error checking database sync status: ${error.message}`);
  }
}

async function checkWebhookActivity() {
  try {
    // Check recent webhook events
    const recentWebhooks = await db.execute(sql`
      SELECT 
        id,
        event_type,
        line_id,
        created_at,
        processed,
        processed_at,
        successful_count,
        failed_count,
        EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 as hours_ago
      FROM webhook_events
      WHERE created_at >= NOW() - INTERVAL '7 days'
      ORDER BY created_at DESC
      LIMIT 20
    `);
    
    if (recentWebhooks.length === 0) {
      console.log('   📭 No webhook events in last 7 days');
      return;
    }
    
    console.log(`   📨 Recent webhook activity (last 7 days):`);
    
    recentWebhooks.forEach(webhook => {
      const hoursAgo = Math.round(webhook.hours_ago);
      const status = webhook.processed ? '✅ Processed' : '⏳ Pending';
      console.log(`      ${webhook.event_type} - Line ${webhook.line_id}: ${hoursAgo}h ago (${status})`);
      if (webhook.processed && (webhook.successful_count || webhook.failed_count)) {
        console.log(`         └─ Results: ${webhook.successful_count || 0} successful, ${webhook.failed_count || 0} failed`);
      }
    });
    
    // Analyze webhook frequency
    const webhookStats = await db.execute(sql`
      SELECT 
        COUNT(*) as total_webhooks,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as last_24h,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '12 hours') as last_12h,
        COUNT(*) FILTER (WHERE processed = false) as pending,
        AVG(EXTRACT(EPOCH FROM (processed_at - created_at))) as avg_processing_seconds
      FROM webhook_events
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `);
    
    if (webhookStats.length > 0) {
      const stats = webhookStats[0];
      console.log(`\n   📈 Webhook frequency analysis:`);
      console.log(`      Webhooks in last 24 hours: ${stats.last_24h}`);
      console.log(`      Webhooks in last 12 hours: ${stats.last_12h}`);
      console.log(`      Pending webhooks: ${stats.pending}`);
      if (stats.avg_processing_seconds) {
        console.log(`      Average processing time: ${Math.round(stats.avg_processing_seconds)}s`);
      }
    }
    
  } catch (error) {
    console.log(`   ❌ Error checking webhook activity: ${error.message}`);
  }
}

async function identifySyncGaps() {
  try {
    console.log('   🔍 Analyzing potential sync gaps...');
    
    // Compare webhook activity with FTP file dates
    const lastWebhook = await db.execute(sql`
      SELECT 
        MAX(created_at) as last_webhook,
        EXTRACT(EPOCH FROM (NOW() - MAX(created_at))) / 3600 as hours_since_last_webhook
      FROM webhook_events
      WHERE event_type = 'cruiseline_pricing_updated'
    `);
    
    if (lastWebhook.length > 0 && lastWebhook[0].last_webhook) {
      const hoursAgo = Math.round(lastWebhook[0].hours_since_last_webhook);
      console.log(`      Last pricing webhook: ${hoursAgo} hours ago`);
      
      if (hoursAgo > 12) {
        console.log(`      ⚠️  Gap detected: No webhooks received in ${hoursAgo} hours`);
        console.log(`         This could indicate:`);
        console.log(`         - Webhook delivery issues`);
        console.log(`         - No actual price updates from Traveltek`);
        console.log(`         - Configuration issues with Traveltek webhook setup`);
      }
    } else {
      console.log(`      ❌ No pricing webhooks found in database`);
    }
    
    // Check for lines that have data but no recent webhooks
    const linesWithoutRecentWebhooks = await db.execute(sql`
      SELECT 
        cl.id,
        cl.name,
        COUNT(c.id) as cruise_count,
        MAX(we.created_at) as last_webhook
      FROM cruise_lines cl
      LEFT JOIN cruises c ON cl.id = c.cruise_line_id AND c.sailing_date >= CURRENT_DATE
      LEFT JOIN webhook_events we ON cl.id = we.line_id AND we.created_at >= NOW() - INTERVAL '7 days'
      WHERE cl.is_active = true
      GROUP BY cl.id, cl.name
      HAVING COUNT(c.id) > 0 AND (MAX(we.created_at) IS NULL OR MAX(we.created_at) < NOW() - INTERVAL '24 hours')
      ORDER BY cruise_count DESC
    `);
    
    if (linesWithoutRecentWebhooks.length > 0) {
      console.log(`\n   📋 Cruise lines with data but no recent webhooks:`);
      linesWithoutRecentWebhooks.forEach(line => {
        console.log(`      Line ${line.id} (${line.name}): ${line.cruise_count} cruises, last webhook: ${line.last_webhook || 'Never'}`);
      });
    }
    
    // Recommendations
    console.log(`\n   💡 Recommendations:`);
    
    if (lastWebhook[0]?.hours_since_last_webhook > 12) {
      console.log(`      1. Verify webhook setup in Traveltek iSell portal`);
      console.log(`      2. Check if webhook endpoint is accessible: https://zipsea-production.onrender.com/api/webhooks/traveltek`);
      console.log(`      3. Contact Traveltek support to verify webhook delivery`);
    }
    
    if (linesWithoutRecentWebhooks.length > 0) {
      console.log(`      4. Consider manual sync for lines without recent webhook activity`);
      console.log(`      5. Verify these cruise lines are active in Traveltek system`);
    }
    
    console.log(`      6. Monitor FTP file modification times vs database sync times`);
    console.log(`      7. Check Render logs for any FTP connection or processing errors`);
    
  } catch (error) {
    console.log(`   ❌ Error identifying sync gaps: ${error.message}`);
  }
}

// Run the investigation
if (require.main === module) {
  investigateFTPSyncStatus()
    .then(() => {
      console.log('\n✅ Investigation completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Investigation failed:', error);
      process.exit(1);
    });
}

module.exports = { investigateFTPSyncStatus };