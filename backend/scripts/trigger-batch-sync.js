#!/usr/bin/env node

/**
 * WARNING: This script is DEPRECATED!
 *
 * The internal cron service now handles batch syncing automatically every 15 minutes.
 * This external Render cron job should be DISABLED in the Render dashboard.
 *
 * To disable: Go to Render Dashboard > Your Service > Jobs > Delete this cron job
 *
 * The new system:
 * 1. Webhooks flag cruises with needs_price_update = true
 * 2. Internal cron runs priceSyncBatchServiceV6 every 15 minutes
 * 3. Only clears flags after successful processing
 */

const https = require('https');

const API_URL = process.env.API_URL || 'https://zipsea-production.onrender.com';

function makeRequest() {
  console.log('⚠️  WARNING: This Render cron job is DEPRECATED!');
  console.log('⚠️  The internal cron service handles batch syncing automatically.');
  console.log('⚠️  Please disable this cron job in Render Dashboard > Jobs');
  console.log('');

  return new Promise((resolve, reject) => {
    const url = `${API_URL}/api/admin/trigger-batch-sync`;
    console.log(`Still triggering batch sync at ${url} (but this should be disabled)`);

    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    };

    const req = https.request(options, res => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('Response:', response);

          if (response.pendingLines > 0) {
            console.log(`✅ Batch sync triggered for ${response.pendingLines} cruise line(s)`);
          } else {
            console.log('✅ No pending updates');
          }
          resolve(response);
        } catch (e) {
          console.error('Failed to parse response:', data);
          reject(e);
        }
      });
    });

    req.on('error', error => {
      console.error('Request failed:', error.message);
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function run() {
  try {
    await makeRequest();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to trigger batch sync:', error.message);
    process.exit(1);
  }
}

run();
