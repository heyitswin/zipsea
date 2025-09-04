#!/usr/bin/env tsx

/**
 * Production FTP Connectivity Diagnostic Script
 * 
 * This script tests FTP connectivity specifically on Render production environment.
 * It checks:
 * - Environment variables are available
 * - FTP connection can be established
 * - File retrieval works
 * - Circuit breaker status
 * - Connection pooling status
 */

import { improvedFTPService } from '../src/services/improved-ftp.service';
import { logger } from '../src/config/logger';

async function main() {
  console.log('🔍 Production FTP Connectivity Diagnostic');
  console.log('=========================================\n');

  // 1. Check environment variables
  console.log('1. 📋 Checking FTP Environment Variables');
  console.log('───────────────────────────────────────');
  
  const ftpHost = process.env.TRAVELTEK_FTP_HOST;
  const ftpUser = process.env.TRAVELTEK_FTP_USER;
  const ftpPassword = process.env.TRAVELTEK_FTP_PASSWORD;
  
  console.log(`FTP Host: ${ftpHost ? '✅ Set' : '❌ Missing'}`);
  console.log(`FTP User: ${ftpUser ? '✅ Set' : '❌ Missing'}`);
  console.log(`FTP Password: ${ftpPassword ? '✅ Set' : '❌ Missing'}`);
  
  if (!ftpHost || !ftpUser || !ftpPassword) {
    console.log('\n❌ CRITICAL: FTP credentials are missing from environment variables!');
    console.log('This is the root cause of the webhook processing failure.');
    console.log('\nRequired environment variables:');
    console.log('- TRAVELTEK_FTP_HOST');
    console.log('- TRAVELTEK_FTP_USER');
    console.log('- TRAVELTEK_FTP_PASSWORD');
    process.exit(1);
  }
  
  console.log(`\nFTP Host: ${ftpHost}`);
  console.log(`FTP User: ${ftpUser}`);
  console.log(`FTP Password: ${'*'.repeat(ftpPassword.length)}`);

  // 2. Test FTP Health Check
  console.log('\n2. 🏥 FTP Service Health Check');
  console.log('─────────────────────────────');
  
  try {
    const healthStatus = await improvedFTPService.healthCheck();
    console.log(`Connection Status: ${healthStatus.connected ? '✅ Connected' : '❌ Disconnected'}`);
    console.log(`Queue Status: ${healthStatus.queueStatus.pending} pending, ${healthStatus.queueStatus.active} active`);
    
    if (healthStatus.error) {
      console.log(`Error: ${healthStatus.error}`);
    }
    
    console.log('\nCircuit Breaker Status:');
    for (const [name, status] of Object.entries(healthStatus.circuitStatus)) {
      console.log(`  ${name}: ${status.isOpen ? '🚨 OPEN' : '✅ Closed'} (failures: ${status.failureCount})`);
      if (status.lastFailureTime) {
        console.log(`    Last failure: ${status.lastFailureTime}`);
      }
    }
    
  } catch (error) {
    console.log(`❌ Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // 3. Test actual file retrieval
  console.log('\n3. 📁 Test File Retrieval');
  console.log('─────────────────────────');
  
  // Try to fetch a Royal Caribbean file (line 3, which had 3004 cruises)
  const testPaths = [
    '2024/09/3/16/20240905.json',      // Most recent Royal Caribbean
    '2024/09/3/16/20240904.json',      // Previous day
    '2024/08/3/16/20240830.json',      // Older file
    'isell_json/2024/09/3/16/20240905.json'  // Alternative path
  ];
  
  console.log('Testing file retrieval with sample Royal Caribbean files...');
  
  for (const testPath of testPaths) {
    try {
      console.log(`\n  🔍 Testing: ${testPath}`);
      const startTime = Date.now();
      
      const result = await improvedFTPService.getCruiseDataFile(testPath);
      const duration = Date.now() - startTime;
      
      if (result) {
        console.log(`  ✅ Success! Retrieved file in ${duration}ms`);
        console.log(`     File contains: ${Object.keys(result).join(', ')}`);
        if (result.prices) {
          const priceKeys = Object.keys(result.prices);
          console.log(`     Pricing data: ${priceKeys.length} rate codes`);
        }
        break; // Stop after first successful retrieval
      }
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.log(`  ❌ Failed: ${errorMsg}`);
      
      // Check if this is an FTP connection error vs file not found
      if (errorMsg.includes('timeout') || errorMsg.includes('connection') || errorMsg.includes('ECONNREFUSED')) {
        console.log('     ^ This appears to be an FTP connectivity issue');
      } else if (errorMsg.includes('not found') || errorMsg.includes('404')) {
        console.log('     ^ This appears to be a file not found issue (FTP connection working)');
      }
    }
  }

  // 4. Check FTP service statistics
  console.log('\n4. 📊 FTP Service Statistics');
  console.log('───────────────────────────');
  
  const stats = improvedFTPService.getStats();
  console.log(`Active Requests: ${stats.activeRequests}`);
  console.log(`Queue Length: ${stats.queueLength}`);
  
  console.log('\nCircuit Breaker Details:');
  for (const [name, state] of Object.entries(stats.circuitBreakers)) {
    console.log(`  ${name}:`);
    console.log(`    Open: ${state.isOpen}`);
    console.log(`    Failures: ${state.failureCount}`);
    console.log(`    Last Failure: ${state.lastFailureTime ? new Date(state.lastFailureTime).toISOString() : 'Never'}`);
  }

  // 5. Test circuit breaker recovery
  console.log('\n5. 🔄 Circuit Breaker Recovery Test');
  console.log('──────────────────────────────────');
  
  // If any circuit breaker is open, try to reset it
  let hasOpenCircuit = false;
  for (const [name, state] of Object.entries(stats.circuitBreakers)) {
    if (state.isOpen) {
      hasOpenCircuit = true;
      console.log(`🚨 Circuit breaker "${name}" is OPEN - attempting manual reset...`);
      
      const resetSuccess = improvedFTPService.resetCircuitBreaker(name);
      if (resetSuccess) {
        console.log(`✅ Successfully reset circuit breaker "${name}"`);
        
        // Test if it works now
        try {
          const healthAfterReset = await improvedFTPService.healthCheck();
          console.log(`   Health check after reset: ${healthAfterReset.connected ? '✅ Connected' : '❌ Still disconnected'}`);
        } catch (error) {
          console.log(`   Health check after reset failed: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
      } else {
        console.log(`❌ Failed to reset circuit breaker "${name}"`);
      }
    }
  }
  
  if (!hasOpenCircuit) {
    console.log('✅ No open circuit breakers found');
  }

  // 6. Final recommendation
  console.log('\n6. 💡 Diagnostic Summary & Recommendations');
  console.log('─────────────────────────────────────────');
  
  const finalHealthCheck = await improvedFTPService.healthCheck();
  
  if (finalHealthCheck.connected) {
    console.log('✅ FTP CONNECTION IS WORKING');
    console.log('\nThis means the webhook processing issue is likely:');
    console.log('• Workers are not running/initialized properly');
    console.log('• Jobs are stuck in Redis queues');
    console.log('• Database connection issues');
    console.log('\nNext steps: Check worker status and Redis queues');
  } else {
    console.log('❌ FTP CONNECTION IS NOT WORKING');
    console.log(`\nError: ${finalHealthCheck.error}`);
    
    if (finalHealthCheck.error?.includes('credentials')) {
      console.log('\n🔧 ACTION REQUIRED: FTP credentials are invalid or missing');
      console.log('• Verify TRAVELTEK_FTP_* environment variables on Render');
      console.log('• Check if credentials have expired or changed');
    } else if (finalHealthCheck.error?.includes('timeout') || finalHealthCheck.error?.includes('connection')) {
      console.log('\n🔧 ACTION REQUIRED: FTP server connectivity issue');
      console.log('• FTP server may be down or blocking connections');
      console.log('• Network connectivity issues from Render to FTP server');
      console.log('• Firewall blocking connections');
    }
  }
  
  console.log('\n✨ Diagnostic complete!');
  
  process.exit(0);
}

// Handle errors gracefully
main().catch((error) => {
  console.error('\n💥 Fatal error during FTP diagnostic:', error);
  
  if (error instanceof Error && error.message.includes('Missing FTP credentials')) {
    console.log('\n🚨 ROOT CAUSE IDENTIFIED: Missing FTP credentials in environment');
    console.log('This explains why webhook processing is failing!');
  }
  
  process.exit(1);
});