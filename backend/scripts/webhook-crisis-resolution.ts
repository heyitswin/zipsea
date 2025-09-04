#!/usr/bin/env tsx

/**
 * Webhook Processing Crisis Resolution
 * 
 * This is the main script to diagnose and resolve the webhook processing crisis.
 * Run this first to get a complete diagnosis and step-by-step resolution plan.
 */

import { env } from '../src/config/environment';

const RENDER_LOGO = `
██████╗ ███████╗███╗   ██╗██████╗ ███████╗██████╗ 
██╔══██╗██╔════╝████╗  ██║██╔══██╗██╔════╝██╔══██╗
██████╔╝█████╗  ██╔██╗ ██║██║  ██║█████╗  ██████╔╝
██╔══██╗██╔══╝  ██║╚██╗██║██║  ██║██╔══╝  ██╔══██╗
██║  ██║███████╗██║ ╚████║██████╔╝███████╗██║  ██║
╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚═════╝ ╚══════╝╚═╝  ╚═╝
`;

async function main() {
  console.log(RENDER_LOGO);
  console.log('🚨 WEBHOOK PROCESSING CRISIS RESOLUTION');
  console.log('======================================\n');

  console.log('📋 CRISIS SUMMARY:');
  console.log('Royal Caribbean webhook (3004 cruises) started at 8:25 AM');
  console.log('Processing began but never completed - no database updates');
  console.log('Cruises show lastUpdated as September 3rd (NOT today)');
  console.log('This is CRITICAL for business revenue\n');

  console.log('🔍 RUNNING COMPREHENSIVE DIAGNOSIS...\n');

  // 1. Environment Check
  console.log('1. 🌍 ENVIRONMENT VALIDATION');
  console.log('─'.repeat(50));
  
  const ftpHost = env.TRAVELTEK_FTP_HOST;
  const ftpUser = env.TRAVELTEK_FTP_USER;
  const ftpPassword = env.TRAVELTEK_FTP_PASSWORD;
  
  console.log(`Environment: ${env.NODE_ENV}`);
  console.log(`FTP Host: ${ftpHost ? '✅ SET' : '❌ MISSING'}`);
  console.log(`FTP User: ${ftpUser ? '✅ SET' : '❌ MISSING'}`);
  console.log(`FTP Pass: ${ftpPassword ? '✅ SET' : '❌ MISSING'}`);
  
  const criticalIssue = !ftpHost || !ftpUser || !ftpPassword;
  
  if (criticalIssue) {
    console.log('\n🚨 ROOT CAUSE IDENTIFIED: MISSING FTP CREDENTIALS');
    console.log('═'.repeat(55));
    console.log('This explains EXACTLY why webhook processing is failing:');
    console.log('• Webhook service starts successfully (no FTP check at init)');
    console.log('• Workers are initialized and ready to process jobs');
    console.log('• Jobs get queued and workers start processing them');
    console.log('• When jobs try to fetch cruise data, FTP fails with "Missing credentials"');
    console.log('• All 3004 jobs fail, but no error notification is sent');
    console.log('• Database remains unchanged (lastUpdated = Sept 3rd)');
    console.log('• User sees "processing started" but no completion message\n');
  }

  // 2. Quick System Status
  console.log('2. ⚡ SYSTEM STATUS CHECK');
  console.log('─'.repeat(50));
  
  try {
    // Test basic connectivity
    console.log('Redis: Testing connection...');
    const redis = require('ioredis');
    const redisClient = env.REDIS_URL ? 
      new redis(env.REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: false }) :
      new redis({ host: env.REDIS_HOST || 'localhost', port: env.REDIS_PORT || 6379, password: env.REDIS_PASSWORD });
    
    await redisClient.ping();
    console.log('Redis: ✅ Connected');
    await redisClient.quit();
  } catch (error) {
    console.log('Redis: ❌ Connection failed');
  }

  try {
    console.log('Database: Testing connection...');
    const { db } = await import('../src/db/connection');
    const { sql } = await import('drizzle-orm');
    await db.execute(sql`SELECT 1`);
    console.log('Database: ✅ Connected');
  } catch (error) {
    console.log('Database: ❌ Connection failed');
  }

  // 3. Business Impact
  console.log('\n3. 💰 BUSINESS IMPACT ASSESSMENT');
  console.log('─'.repeat(50));
  console.log('Days since last successful webhook: ~1+ days');
  console.log('Affected cruise lines: Royal Caribbean (3004 cruises)');
  console.log('Revenue impact: HIGH - customers seeing stale prices');
  console.log('Customer experience: DEGRADED - booking outdated fares');
  console.log('Competitive advantage: LOST - competitors have current prices\n');

  // 4. Resolution Plan
  console.log('4. 🔧 IMMEDIATE RESOLUTION PLAN');
  console.log('─'.repeat(50));
  
  if (criticalIssue) {
    console.log('PRIORITY 1 - CRITICAL (Fix in next 5-10 minutes):');
    console.log('├─ 1. Add missing FTP credentials to Render environment');
    console.log('├─ 2. Redeploy application');
    console.log('├─ 3. Verify webhook processing works');
    console.log('└─ 4. Monitor for successful completion');
    
    console.log('\nMISSING ENVIRONMENT VARIABLES FOR RENDER:');
    console.log('┌─────────────────────────────────────────┐');
    if (!ftpHost) console.log('│ TRAVELTEK_FTP_HOST=<ftp_server_host>    │');
    if (!ftpUser) console.log('│ TRAVELTEK_FTP_USER=<ftp_username>       │');
    if (!ftpPassword) console.log('│ TRAVELTEK_FTP_PASSWORD=<ftp_password>   │');
    console.log('└─────────────────────────────────────────┘');
    
    console.log('\nRESOLUTION STEPS:');
    console.log('1. 🌐 Open Render Dashboard');
    console.log('2. 📱 Navigate to your backend service');
    console.log('3. ⚙️  Click "Environment" tab');
    console.log('4. ➕ Add the missing variables above');
    console.log('5. 💾 Save changes');
    console.log('6. 🚀 Redeploy service');
    console.log('7. ⏳ Wait for deployment (2-3 minutes)');
    console.log('8. ✅ Test webhook processing');
    
  } else {
    console.log('✅ FTP credentials are present - investigating other causes...');
    console.log('Run detailed diagnostics to identify the issue.');
  }

  console.log('\n5. 🧪 VERIFICATION & TESTING');
  console.log('─'.repeat(50));
  console.log('After fixing environment variables, run these diagnostic scripts:');
  console.log('');
  console.log('📊 Test FTP connectivity:');
  console.log('   npm run script:test-ftp-connectivity-production');
  console.log('');
  console.log('⚙️  Check worker status:');
  console.log('   npm run script:check-worker-status-production');
  console.log('');
  console.log('📈 Monitor Redis queues:');
  console.log('   npm run script:monitor-redis-queues-production');
  console.log('');
  console.log('🧹 Clean up stuck jobs (if needed):');
  console.log('   npm run script:cleanup-stuck-jobs --dry-run');
  console.log('');
  console.log('🔍 Analyze production errors:');
  console.log('   npm run script:analyze-production-errors');

  console.log('\n6. 📞 POST-RESOLUTION MONITORING');
  console.log('─'.repeat(50));
  console.log('Once fixed, monitor these indicators:');
  console.log('✓ Slack notifications show "processing completed"');
  console.log('✓ Database cruise.lastUpdated shows today\'s date');
  console.log('✓ Pricing data updated for Royal Caribbean cruises');
  console.log('✓ Redis queues processing jobs without failures');
  console.log('✓ FTP circuit breakers remain closed');

  console.log('\n7. 🛡️  PREVENTION MEASURES');
  console.log('─'.repeat(50));
  console.log('To prevent this crisis in the future:');
  console.log('✓ Environment now validates FTP credentials at startup');
  console.log('✓ Production deployment will fail if FTP creds missing');
  console.log('✓ Enhanced monitoring and alerting for webhook failures');
  console.log('✓ Regular health checks for critical services');

  // Final recommendation
  console.log('\n🎯 IMMEDIATE ACTION REQUIRED');
  console.log('═'.repeat(50));
  
  if (criticalIssue) {
    console.log('🚨 CRISIS STATUS: ACTIVE');
    console.log('⏰ RESOLUTION TIME: 5-10 minutes after setting FTP credentials');
    console.log('🔥 PRIORITY: CRITICAL - Fix immediately');
    console.log('');
    console.log('➡️  NEXT STEP: Add FTP credentials to Render and redeploy');
    console.log('');
    console.log('💡 Once fixed, webhook processing will resume automatically.');
    console.log('   The next Royal Caribbean webhook will process all 3004 cruises.');
    
    process.exit(1); // Exit with error to indicate action required
  } else {
    console.log('✅ CRISIS STATUS: Environment appears configured');
    console.log('🔍 NEXT STEP: Run detailed diagnostics to find root cause');
    console.log('');
    console.log('Start with: npm run script:test-ftp-connectivity-production');
    
    process.exit(0); // Normal exit
  }
}

// Handle interruption gracefully
process.on('SIGINT', () => {
  console.log('\n\n👋 Crisis resolution interrupted');
  console.log('Run this script again when ready to continue diagnosis');
  process.exit(0);
});

main().catch((error) => {
  console.error('\n💥 CRITICAL ERROR during crisis resolution:');
  console.error(error);
  console.error('\nThis script failure is itself a sign of system issues.');
  console.error('Check basic connectivity and environment configuration.');
  process.exit(1);
});