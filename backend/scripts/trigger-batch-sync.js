#!/usr/bin/env node

/**
 * Simple script to trigger batch sync via API endpoint
 * This is called by Render cron job every 5 minutes
 */

const https = require('https');

const API_URL = process.env.API_URL || 'https://zipsea-production.onrender.com';

function makeRequest() {
  return new Promise((resolve, reject) => {
    const url = `${API_URL}/api/admin/trigger-batch-sync`;
    console.log(`Triggering batch sync at ${url}`);
    
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
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
    
    req.on('error', (error) => {
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