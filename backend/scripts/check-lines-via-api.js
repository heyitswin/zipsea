#!/usr/bin/env node

/**
 * Check cruise lines via the API
 */

const https = require('https');

const API_URL = 'https://zipsea-production.onrender.com';

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const url = `${API_URL}${path}`;
    const parsedUrl = new URL(url);
    
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + (parsedUrl.search || ''),
      method: 'GET',
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
          resolve(response);
        } catch (e) {
          resolve(data);
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function checkLines() {
  console.log('🔍 Checking cruise lines in database via API...\n');
  
  try {
    // Test search for Royal Caribbean cruise
    console.log('📋 Testing Royal Caribbean cruise search:');
    const rcSearch = await makeRequest('/api/v1/search/by-ship?shipName=Vision%20of%20the%20Seas&departureDate=2027-4-9');
    
    if (rcSearch.results && rcSearch.results[0]) {
      const cruise = rcSearch.results[0];
      console.log(`Found cruise: ${cruise.name}`);
      console.log(`  - ID: ${cruise.id} (codetocruiseid)`);
      console.log(`  - Cruise ID: ${cruise.cruise_id} (original cruiseid)`);
      console.log(`  - Line Name: ${cruise.cruise_line_name}`);
      console.log('');
      
      // Now check what happens when we send a webhook for line 3
      console.log('🔍 What cruise_line_id does this cruise have in the database?');
      console.log('We need to query the database directly to find out.');
      console.log('');
    }
    
    // Try different line IDs
    console.log('📋 Testing webhook simulation for different line IDs:');
    
    const testLineIds = [1, 3, 21, 44];
    for (const lineId of testLineIds) {
      console.log(`\nTesting line ID ${lineId}:`);
      
      // Check pending syncs to see if this line exists
      const pendingResponse = await makeRequest('/api/admin/pending-syncs');
      
      if (pendingResponse.byLine) {
        const hasLine = pendingResponse.byLine.some(l => l.cruise_line_id === lineId);
        if (hasLine) {
          const lineData = pendingResponse.byLine.find(l => l.cruise_line_id === lineId);
          console.log(`  ✅ Line ${lineId} exists with ${lineData.count} cruises`);
        } else {
          console.log(`  ⚠️ Line ${lineId} not found in pending syncs`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkLines();