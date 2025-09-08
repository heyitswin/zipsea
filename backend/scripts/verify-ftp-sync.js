const { db } = require('../dist/db/connection');
const { sql } = require('drizzle-orm');
const axios = require('axios');
const ftp = require('basic-ftp');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function verifyFtpSync() {
  console.log('🔍 FTP SYNC VERIFICATION');
  console.log('=' .repeat(80));
  console.log('Time:', new Date().toISOString());
  console.log('');

  const results = {
    credentials: {},
    database: {},
    webhooks: {},
    pricing: {},
    recommendations: []
  };

  // 1. VERIFY FTP CREDENTIALS
  console.log('1️⃣  VERIFYING FTP CREDENTIALS');
  console.log('-'.repeat(40));

  const ftpHost = process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net';
  const ftpUser = process.env.TRAVELTEK_FTP_USER;
  const ftpPassword = process.env.TRAVELTEK_FTP_PASSWORD;

  console.log(`Host: ${ftpHost}`);
  console.log(`User: ${ftpUser ? ftpUser.substring(0, 3) + '***' : 'NOT SET'}`);
  console.log(`Password: ${ftpPassword ? '***' + ftpPassword.substring(ftpPassword.length - 3) : 'NOT SET'}`);

  if (!ftpUser || !ftpPassword) {
    console.log('❌ FTP credentials are missing!');
    console.log('   Set TRAVELTEK_FTP_USER and TRAVELTEK_FTP_PASSWORD in Render environment variables');
    results.credentials.status = 'missing';
  } else {
    // Test FTP connection
    const client = new ftp.Client();
    client.ftp.verbose = false;

    try {
      console.log('\nTesting FTP connection...');
      await client.access({
        host: ftpHost,
        user: ftpUser,
        password: ftpPassword,
        secure: false
      });

      console.log('✅ FTP connection successful!');
      results.credentials.status = 'valid';

      // Test we can navigate to data directory
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      await client.cd(`/${year}/${month}`);
      console.log(`✅ Can access current month directory: /${year}/${month}`);

      // Count available cruise lines
      const dirs = await client.list();
      const cruiseLineCount = dirs.filter(d => d.isDirectory).length;
      console.log(`✅ Found ${cruiseLineCount} cruise lines with data for ${month}/${year}`);
      results.credentials.cruiseLines = cruiseLineCount;

    } catch (ftpError) {
      console.log('❌ FTP connection failed:', ftpError.message);
      results.credentials.status = 'invalid';
      results.credentials.error = ftpError.message;

      if (ftpError.message.includes('530') || ftpError.message.includes('Login incorrect')) {
        console.log('\n⚠️  IMPORTANT: FTP credentials are incorrect!');
        console.log('   1. Go to https://dashboard.render.com');
        console.log('   2. Open the "zipsea-production" service');
        console.log('   3. Go to Environment tab');
        console.log('   4. Update TRAVELTEK_FTP_USER and TRAVELTEK_FTP_PASSWORD');
        console.log('   5. Save and wait for service to redeploy');
      }
    } finally {
      client.close();
    }
  }

  // 2. VERIFY DATABASE UPDATES
  console.log('\n2️⃣  VERIFYING DATABASE UPDATES');
  console.log('-'.repeat(40));

  try {
    // Check updates in last hour
    const recentUpdates = await db.execute(sql`
      SELECT
        COUNT(*) as count,
        MAX(updated_at) as last_update
      FROM cruises
      WHERE updated_at > NOW() - INTERVAL '1 hour'
    `);

    console.log(`Updates in last hour: ${recentUpdates[0].count}`);
    console.log(`Last update: ${recentUpdates[0].last_update || 'None'}`);
    results.database.recentUpdates = recentUpdates[0].count;
    results.database.lastUpdate = recentUpdates[0].last_update;

    // Check updates by cruise line (last hour)
    const lineUpdates = await db.execute(sql`
      SELECT
        cl.name as cruise_line,
        COUNT(c.id) as count,
        MAX(c.updated_at) as last_update
      FROM cruises c
      JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      WHERE c.updated_at > NOW() - INTERVAL '1 hour'
      GROUP BY cl.name
      ORDER BY count DESC
      LIMIT 5
    `);

    if (lineUpdates.length > 0) {
      console.log('\nCruise lines updated in last hour:');
      lineUpdates.forEach(row => {
        console.log(`  ${row.cruise_line}: ${row.count} cruises`);
      });
      results.database.lineUpdates = lineUpdates;
    } else {
      console.log('⚠️  No cruise lines updated in last hour');
    }

  } catch (dbError) {
    console.log('❌ Database query failed:', dbError.message);
    results.database.error = dbError.message;
  }

  // 3. VERIFY PRICING DATA
  console.log('\n3️⃣  VERIFYING PRICING DATA');
  console.log('-'.repeat(40));

  try {
    // Check pricing updates
    const pricingStats = await db.execute(sql`
      SELECT
        COUNT(DISTINCT cruise_id) as cruises_with_pricing,
        COUNT(*) as total_pricing_records,
        MAX(updated_at) as last_pricing_update
      FROM cheapest_pricing
      WHERE updated_at > NOW() - INTERVAL '24 hours'
    `);

    console.log(`Cruises with pricing updates (24h): ${pricingStats[0].cruises_with_pricing}`);
    console.log(`Total pricing records updated (24h): ${pricingStats[0].total_pricing_records}`);
    console.log(`Last pricing update: ${pricingStats[0].last_pricing_update || 'None'}`);
    results.pricing = pricingStats[0];

    // Check if pricing is being extracted properly
    const samplePricing = await db.execute(sql`
      SELECT
        cp.cruise_id,
        cp.interior_price,
        cp.oceanview_price,
        cp.balcony_price,
        cp.suite_price,
        c.name as cruise_name
      FROM cheapest_pricing cp
      JOIN cruises c ON cp.cruise_id = c.id
      WHERE cp.updated_at > NOW() - INTERVAL '1 hour'
      LIMIT 3
    `);

    if (samplePricing.length > 0) {
      console.log('\nSample pricing updates:');
      samplePricing.forEach(row => {
        console.log(`  ${row.cruise_name}:`);
        console.log(`    Interior: $${row.interior_price || 'N/A'}`);
        console.log(`    Ocean View: $${row.oceanview_price || 'N/A'}`);
        console.log(`    Balcony: $${row.balcony_price || 'N/A'}`);
        console.log(`    Suite: $${row.suite_price || 'N/A'}`);
      });
    }

  } catch (pricingError) {
    console.log('❌ Pricing query failed:', pricingError.message);
    results.pricing.error = pricingError.message;
  }

  // 4. TEST WEBHOOK TRIGGER
  console.log('\n4️⃣  TESTING WEBHOOK TRIGGER');
  console.log('-'.repeat(40));

  console.log('Triggering test webhook for Celebrity Cruises...');

  try {
    const webhookResponse = await axios.post(
      'https://zipsea-production.onrender.com/api/webhooks/traveltek/cruiseline-pricing-updated',
      {
        lineid: 18, // Celebrity Cruises
        currency: 'USD',
        timestamp: new Date().toISOString()
      },
      {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' }
      }
    );

    console.log('✅ Webhook triggered successfully');
    console.log(`   Status: ${webhookResponse.status}`);
    console.log(`   Webhook ID: ${webhookResponse.data.webhookId}`);
    results.webhooks.status = 'success';
    results.webhooks.webhookId = webhookResponse.data.webhookId;

  } catch (webhookError) {
    console.log('❌ Webhook trigger failed:', webhookError.message);
    results.webhooks.status = 'failed';
    results.webhooks.error = webhookError.message;
  }

  // 5. CHECK FOR COMMON ISSUES
  console.log('\n5️⃣  CHECKING FOR COMMON ISSUES');
  console.log('-'.repeat(40));

  const issues = [];

  // Check if FTP is working
  if (results.credentials.status !== 'valid') {
    issues.push('❌ FTP credentials are invalid or missing');
  }

  // Check if webhooks are processing
  if (results.database.recentUpdates < 10) {
    issues.push('⚠️  Very few database updates - webhooks may not be processing');
  }

  // Check if pricing is being extracted
  if (results.pricing.cruises_with_pricing === 0) {
    issues.push('⚠️  No pricing updates - extraction may be failing');
  }

  // Check overall pricing coverage
  const coverageCheck = await db.execute(sql`
    SELECT
      COUNT(DISTINCT c.id) as total_cruises,
      COUNT(DISTINCT cp.cruise_id) as cruises_with_pricing
    FROM cruises c
    LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
    WHERE c.is_active = true
      AND c.sailing_date > CURRENT_DATE
  `);

  const coverage = (coverageCheck[0].cruises_with_pricing / coverageCheck[0].total_cruises) * 100;
  console.log(`\nPricing Coverage: ${coverage.toFixed(1)}% (${coverageCheck[0].cruises_with_pricing}/${coverageCheck[0].total_cruises} cruises)`);

  if (coverage < 50) {
    issues.push(`⚠️  Low pricing coverage (${coverage.toFixed(1)}%) - consider running full sync`);
  }

  if (issues.length > 0) {
    console.log('\n⚠️  Issues Found:');
    issues.forEach(issue => console.log(`   ${issue}`));
  } else {
    console.log('\n✅ All systems operational!');
  }

  // 6. RECOMMENDATIONS
  console.log('\n6️⃣  RECOMMENDATIONS');
  console.log('-'.repeat(40));

  if (results.credentials.status !== 'valid') {
    console.log('1. Fix FTP credentials in Render environment variables');
    console.log('   - TRAVELTEK_FTP_USER');
    console.log('   - TRAVELTEK_FTP_PASSWORD');
  }

  if (coverage < 50) {
    console.log('2. Run a full sync to populate missing pricing:');
    console.log('   SYNC_YEAR=2025 SYNC_MONTH=01 node scripts/sync-complete-enhanced.js');
  }

  if (results.database.recentUpdates < 100) {
    console.log('3. Trigger webhooks for major cruise lines:');
    console.log('   node scripts/trigger-all-webhooks.js');
  }

  console.log('\n📊 MONITORING COMMANDS:');
  console.log('-'.repeat(40));
  console.log('Check Slack: Look for webhook processing notifications');
  console.log('Check Render Logs: https://dashboard.render.com -> zipsea-production -> Logs');
  console.log('Check Database: psql $DATABASE_URL -c "SELECT COUNT(*) FROM cruises WHERE updated_at > NOW() - INTERVAL \'1 hour\';"');
  console.log('Test Specific Line: curl -X POST https://zipsea-production.onrender.com/api/webhooks/traveltek/cruiseline-pricing-updated -H "Content-Type: application/json" -d \'{"lineid": 27, "currency": "USD"}\'');

  console.log('\n' + '='.repeat(80));
  console.log('Verification completed at:', new Date().toISOString());

  process.exit(0);
}

verifyFtpSync();
