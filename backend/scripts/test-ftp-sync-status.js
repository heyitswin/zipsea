const { db } = require('../dist/db/connection');
const { sql } = require('drizzle-orm');
const ftp = require('basic-ftp');
const path = require('path');

async function testFtpSyncStatus() {
  console.log('🔍 FTP Sync Status Test - ' + new Date().toISOString());
  console.log('=' .repeat(80));

  const results = {
    database: {},
    ftp: {},
    webhook: {},
    recommendations: []
  };

  try {
    // 1. Database Status Check
    console.log('\n📊 DATABASE STATUS');
    console.log('-'.repeat(40));

    // Total cruises
    const totalCruises = await db.execute(sql`
      SELECT COUNT(*) as count FROM cruises WHERE is_active = true
    `);
    results.database.totalActiveCruises = totalCruises[0].count;
    console.log(`✓ Total active cruises: ${results.database.totalActiveCruises}`);

    // Cruises with pricing
    const withPricing = await db.execute(sql`
      SELECT COUNT(DISTINCT cruise_id) as count
      FROM cheapest_pricing
      WHERE cruise_id IN (SELECT id FROM cruises WHERE is_active = true)
    `);
    results.database.cruisesWithPricing = withPricing[0].count;
    console.log(`✓ Cruises with pricing: ${results.database.cruisesWithPricing}`);

    // Recent updates (last 24 hours)
    const recentUpdates = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM cruises
      WHERE updated_at > NOW() - INTERVAL '24 hours'
        AND is_active = true
    `);
    results.database.updatedLast24h = recentUpdates[0].count;
    console.log(`✓ Updated in last 24h: ${results.database.updatedLast24h}`);

    // Updates by cruise line (last 24h)
    const lineUpdates = await db.execute(sql`
      SELECT
        cl.name as cruise_line,
        COUNT(c.id) as update_count
      FROM cruises c
      JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      WHERE c.updated_at > NOW() - INTERVAL '24 hours'
        AND c.is_active = true
      GROUP BY cl.name
      ORDER BY update_count DESC
      LIMIT 10
    `);

    console.log('\n📈 Recent Updates by Cruise Line (Last 24h):');
    lineUpdates.forEach(row => {
      console.log(`   ${row.cruise_line}: ${row.update_count} cruises`);
    });

    // 2. FTP Connection Test
    console.log('\n🔌 FTP CONNECTION TEST');
    console.log('-'.repeat(40));

    const client = new ftp.Client();
    client.ftp.verbose = false;

    try {
      await client.access({
        host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
        user: process.env.TRAVELTEK_FTP_USER,
        password: process.env.TRAVELTEK_FTP_PASSWORD,
        secure: false
      });

      console.log('✓ FTP connection successful');
      results.ftp.connected = true;

      // Test directory navigation
      const currentYear = new Date().getFullYear();
      const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
      const testPath = `/${currentYear}/${currentMonth}`;

      await client.cd(testPath);
      console.log(`✓ Can access current month directory: ${testPath}`);

      // List cruise lines in current month
      const lineDirectories = await client.list();
      const cruiseLineCount = lineDirectories.filter(item => item.isDirectory).length;
      console.log(`✓ Found ${cruiseLineCount} cruise lines with data for ${currentMonth}/${currentYear}`);
      results.ftp.cruiseLinesAvailable = cruiseLineCount;

      // Sample a cruise line to check file availability
      if (lineDirectories.length > 0) {
        const sampleLine = lineDirectories.find(d => d.isDirectory);
        if (sampleLine) {
          await client.cd(sampleLine.name);
          const shipDirs = await client.list();
          const shipCount = shipDirs.filter(item => item.isDirectory).length;

          if (shipCount > 0) {
            const sampleShip = shipDirs.find(d => d.isDirectory);
            await client.cd(sampleShip.name);
            const cruiseFiles = await client.list();
            const jsonFiles = cruiseFiles.filter(f => f.name.endsWith('.json'));
            console.log(`✓ Sample check - Line: ${sampleLine.name}, Ships: ${shipCount}, Files in ${sampleShip.name}: ${jsonFiles.length}`);
            results.ftp.sampleFileCount = jsonFiles.length;
          }
        }
      }

    } catch (ftpError) {
      console.error('❌ FTP connection failed:', ftpError.message);
      results.ftp.connected = false;
      results.ftp.error = ftpError.message;
    } finally {
      client.close();
    }

    // 3. Webhook Processing Status
    console.log('\n🔄 WEBHOOK PROCESSING STATUS');
    console.log('-'.repeat(40));

    // Check recent webhook logs (if webhook_logs table exists)
    try {
      const webhookStats = await db.execute(sql`
        SELECT
          COUNT(*) as total_webhooks,
          COUNT(CASE WHEN status = 'success' THEN 1 END) as successful,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
          MAX(created_at) as last_webhook
        FROM webhook_logs
        WHERE created_at > NOW() - INTERVAL '24 hours'
      `);

      if (webhookStats[0]) {
        const stats = webhookStats[0];
        console.log(`✓ Webhooks (24h): ${stats.total_webhooks} total, ${stats.successful} successful, ${stats.failed} failed`);
        console.log(`✓ Last webhook: ${stats.last_webhook || 'None'}`);
        results.webhook = stats;
      }
    } catch (e) {
      // Webhook logs table might not exist
      console.log('⚠️  Webhook logs table not found or accessible');
    }

    // 4. Data Freshness Analysis
    console.log('\n📅 DATA FRESHNESS ANALYSIS');
    console.log('-'.repeat(40));

    const staleData = await db.execute(sql`
      SELECT
        cl.name as cruise_line,
        COUNT(c.id) as stale_count
      FROM cruises c
      JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      WHERE c.is_active = true
        AND c.sailing_date > CURRENT_DATE
        AND (c.updated_at < NOW() - INTERVAL '7 days' OR c.updated_at IS NULL)
      GROUP BY cl.name
      HAVING COUNT(c.id) > 0
      ORDER BY stale_count DESC
      LIMIT 10
    `);

    if (staleData.length > 0) {
      console.log('⚠️  Cruise lines with stale data (>7 days old):');
      staleData.forEach(row => {
        console.log(`   ${row.cruise_line}: ${row.stale_count} cruises need updating`);
      });
      results.staleData = staleData;
    } else {
      console.log('✓ All cruise data is fresh (updated within 7 days)');
    }

    // 5. Recommendations
    console.log('\n💡 RECOMMENDATIONS');
    console.log('-'.repeat(40));

    const pricingCoverage = (results.database.cruisesWithPricing / results.database.totalActiveCruises) * 100;

    if (pricingCoverage < 80) {
      results.recommendations.push(`⚠️  Only ${pricingCoverage.toFixed(1)}% of cruises have pricing. Consider running a full sync.`);
      console.log(results.recommendations[results.recommendations.length - 1]);
    }

    if (results.database.updatedLast24h < 100) {
      results.recommendations.push(`⚠️  Only ${results.database.updatedLast24h} cruises updated in last 24h. Webhooks may not be working.`);
      console.log(results.recommendations[results.recommendations.length - 1]);
    }

    if (!results.ftp.connected) {
      results.recommendations.push('❌ FTP connection failed. Check credentials and network.');
      console.log(results.recommendations[results.recommendations.length - 1]);
    }

    if (staleData.length > 5) {
      results.recommendations.push(`⚠️  ${staleData.length} cruise lines have stale data. Consider targeted sync for these lines.`);
      console.log(results.recommendations[results.recommendations.length - 1]);
    }

    if (results.recommendations.length === 0) {
      console.log('✅ All systems operational. FTP sync appears to be working correctly.');
    }

    // 6. Test Commands
    console.log('\n🛠️  TEST COMMANDS');
    console.log('-'.repeat(40));
    console.log('To manually test specific aspects:');
    console.log('');
    console.log('1. Test webhook for a specific cruise line:');
    console.log('   curl -X POST https://zipsea-production.onrender.com/api/webhook/pricing \\');
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -d \'{"lineId": 1, "eventType": "pricing_update"}\'');
    console.log('');
    console.log('2. Force sync for a specific month:');
    console.log('   SYNC_YEAR=2025 SYNC_MONTH=01 node scripts/sync-complete-enhanced.js');
    console.log('');
    console.log('3. Check specific cruise line status:');
    console.log('   node scripts/check-line-sync-status.js --lineId=1');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }

  console.log('\n' + '='.repeat(80));
  console.log('Test completed at:', new Date().toISOString());

  process.exit(0);
}

testFtpSyncStatus();
