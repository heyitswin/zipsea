#!/usr/bin/env node

/**
 * Monitor deployment status by checking if the itinerary fix is live
 */

const https = require('https');

function checkDeployment() {
  return new Promise((resolve) => {
    https.get('https://api.zipsea.com/api/cruises/2143102', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          const hasItinerary = result.data?.itinerary?.length > 0;
          resolve(hasItinerary);
        } catch (e) {
          resolve(false);
        }
      });
    }).on('error', () => resolve(false));
  });
}

async function monitor() {
  console.log('🔍 Monitoring production deployment...');
  console.log('   Checking if itinerary data is available for cruise 2143102');
  console.log('   This will check every 30 seconds until deployment is complete\n');

  let attempts = 0;
  const maxAttempts = 20; // 10 minutes max

  while (attempts < maxAttempts) {
    attempts++;
    const deployed = await checkDeployment();

    if (deployed) {
      console.log('✅ Deployment successful! Itinerary is now showing on production.');
      console.log('   Check: https://www.zipsea.com/cruise/symphony-of-the-seas-2025-10-05-2143102');
      process.exit(0);
    }

    console.log(`⏳ Attempt ${attempts}/${maxAttempts}: Deployment not complete yet...`);

    if (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
    }
  }

  console.log('\n⚠️  Deployment is taking longer than expected.');
  console.log('   Please check Render dashboard at https://dashboard.render.com');
  console.log('   You may need to manually trigger deployment if auto-deploy is not enabled.');
  console.log('\n   To manually deploy:');
  console.log('   1. Go to your Render dashboard');
  console.log('   2. Select the backend service');
  console.log('   3. Click "Manual Deploy" and select the "production" branch');
  process.exit(1);
}

monitor();
