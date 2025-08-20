#!/usr/bin/env node

/**
 * Initial Traveltek Data Sync Script
 * Pulls cruise data from FTP and populates database
 */

const https = require('https');

const ENV = process.argv[2] || 'production';
const BASE_URL = ENV === 'staging' 
  ? 'https://zipsea-backend.onrender.com'
  : 'https://zipsea-production.onrender.com';

console.log('🚀 Traveltek Initial Data Sync');
console.log('==============================');
console.log(`Environment: ${ENV}`);
console.log(`Base URL: ${BASE_URL}`);
console.log('');

function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    if (data) {
      const jsonData = JSON.stringify(data);
      options.headers['Content-Length'] = jsonData.length;
    }
    
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function checkHealth() {
  console.log('1️⃣  Checking system health...');
  try {
    const response = await makeRequest('/health/detailed');
    if (response.status === 200 && response.data.status === 'healthy') {
      console.log('   ✅ System is healthy');
      console.log(`   • Database: ${response.data.services.database.status}`);
      console.log(`   • Redis: ${response.data.services.redis.status}`);
      return true;
    } else {
      console.log('   ❌ System health check failed');
      console.log(`   Response: ${JSON.stringify(response.data)}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Health check error: ${error.message}`);
    return false;
  }
}

async function checkCronStatus() {
  console.log('\n2️⃣  Checking cron job status...');
  try {
    const response = await makeRequest('/api/v1/admin/cron/status');
    if (response.status === 200) {
      console.log('   ✅ Cron service accessible');
      const jobs = response.data.data.jobs;
      Object.entries(jobs).forEach(([name, status]) => {
        console.log(`   • ${name}: ${status}`);
      });
      return true;
    } else {
      console.log('   ⚠️  Cron status check failed');
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Cron check error: ${error.message}`);
    return false;
  }
}

async function triggerSync(type = 'recent') {
  console.log(`\n3️⃣  Triggering ${type} data sync...`);
  try {
    const response = await makeRequest('/api/v1/admin/sync/trigger', 'POST', { type });
    if (response.status === 200 && response.data.success) {
      console.log(`   ✅ ${type} sync triggered successfully`);
      console.log(`   • Message: ${response.data.message}`);
      console.log(`   • Timestamp: ${response.data.timestamp}`);
      return true;
    } else {
      console.log(`   ❌ Sync trigger failed`);
      console.log(`   Response: ${JSON.stringify(response.data)}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Sync trigger error: ${error.message}`);
    return false;
  }
}

async function checkDataCount() {
  console.log('\n4️⃣  Checking data in database...');
  try {
    // Try to search for cruises
    const response = await makeRequest('/api/v1/search', 'POST', {
      limit: 1
    });
    
    if (response.status === 200) {
      const data = response.data.data || response.data;
      if (data && data.total !== undefined) {
        console.log(`   ✅ Database has ${data.total} cruises`);
        return data.total;
      } else if (data && Array.isArray(data.cruises)) {
        console.log(`   ✅ Found ${data.cruises.length} cruises`);
        return data.cruises.length;
      }
    }
    
    console.log('   ⚠️  Could not determine cruise count');
    return 0;
  } catch (error) {
    console.log(`   ❌ Data check error: ${error.message}`);
    return 0;
  }
}

async function monitorSync(maxWaitMinutes = 5) {
  console.log(`\n5️⃣  Monitoring sync progress (max ${maxWaitMinutes} minutes)...`);
  
  const startTime = Date.now();
  const maxWaitMs = maxWaitMinutes * 60 * 1000;
  let lastCount = 0;
  let checkInterval = 10000; // Check every 10 seconds
  
  return new Promise((resolve) => {
    const checkProgress = async () => {
      const elapsed = Date.now() - startTime;
      const elapsedMinutes = Math.floor(elapsed / 60000);
      const elapsedSeconds = Math.floor((elapsed % 60000) / 1000);
      
      if (elapsed > maxWaitMs) {
        console.log(`\n   ⏱️  Timeout reached (${maxWaitMinutes} minutes)`);
        resolve(lastCount);
        return;
      }
      
      const count = await checkDataCount();
      
      if (count > lastCount) {
        console.log(`   📈 Progress: ${count} cruises loaded (+${count - lastCount}) [${elapsedMinutes}m ${elapsedSeconds}s]`);
        lastCount = count;
      } else {
        console.log(`   ⏳ Waiting... ${count} cruises [${elapsedMinutes}m ${elapsedSeconds}s]`);
      }
      
      // Continue checking
      setTimeout(checkProgress, checkInterval);
    };
    
    // Start checking
    setTimeout(checkProgress, 5000); // First check after 5 seconds
  });
}

async function runInitialSync() {
  console.log('Starting initial Traveltek data sync...\n');
  
  // Step 1: Check health
  const isHealthy = await checkHealth();
  if (!isHealthy) {
    console.log('\n❌ System is not healthy. Please check the service.');
    return;
  }
  
  // Step 2: Check cron status
  await checkCronStatus();
  
  // Step 3: Check initial data count
  const initialCount = await checkDataCount();
  console.log(`   Initial cruise count: ${initialCount}`);
  
  // Step 4: Trigger sync
  const syncTriggered = await triggerSync('recent');
  if (!syncTriggered) {
    console.log('\n❌ Failed to trigger sync. Please check logs.');
    return;
  }
  
  // Step 5: Monitor progress
  const finalCount = await monitorSync(5);
  
  // Summary
  console.log('\n==============================');
  console.log('📊 Sync Summary');
  console.log('==============================');
  console.log(`Initial cruises: ${initialCount}`);
  console.log(`Final cruises: ${finalCount}`);
  console.log(`New cruises added: ${finalCount - initialCount}`);
  
  if (finalCount > initialCount) {
    console.log('\n✅ Initial sync completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Test search API: curl -X POST ' + BASE_URL + '/api/v1/search -H "Content-Type: application/json" -d \'{"limit": 10}\'');
    console.log('2. Monitor webhook events in Render logs');
    console.log('3. Check individual cruise details');
  } else {
    console.log('\n⚠️  No new data was synced.');
    console.log('\nPossible reasons:');
    console.log('1. FTP credentials may not be configured correctly');
    console.log('2. No recent cruise data available on FTP');
    console.log('3. Sync is still processing (check Render logs)');
    console.log('\nCheck Render logs for detailed error messages.');
  }
}

// Run the sync
runInitialSync().catch(console.error);