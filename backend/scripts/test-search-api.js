#!/usr/bin/env node

/**
 * Test the search API to verify everything is working
 */

const http = require('http');

console.log('🔍 Testing Search API');
console.log('=====================\n');

function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: process.env.PORT || 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
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

async function testAPI() {
  try {
    // Test 1: Basic search
    console.log('1️⃣ Testing basic search (5 cruises):');
    console.log('─'.repeat(40));
    
    const searchResult = await makeRequest('/api/v1/search', 'POST', {
      limit: 5
    });
    
    console.log(`Status: ${searchResult.status}`);
    
    if (searchResult.status === 200 && searchResult.data.success) {
      const cruises = searchResult.data.data?.cruises || [];
      console.log(`Found ${cruises.length} cruises\n`);
      
      cruises.forEach((cruise, i) => {
        console.log(`${i + 1}. ${cruise.name || 'Unnamed'}`);
        console.log(`   Line: ${cruise.cruiseLineName || 'Unknown'}`);
        console.log(`   Ship: ${cruise.shipName || 'Unknown'}`);
        console.log(`   Date: ${cruise.sailingDate}`);
        console.log(`   Nights: ${cruise.nights}`);
        console.log(`   Price: ${cruise.cheapestPrice ? '$' + cruise.cheapestPrice : 'No pricing'}`);
        console.log();
      });
    } else {
      console.log('Error:', searchResult.data);
    }
    
    // Test 2: Search with date filter
    console.log('\n2️⃣ Testing search with date filter (Jan 2025):');
    console.log('─'.repeat(40));
    
    const dateResult = await makeRequest('/api/v1/search', 'POST', {
      startDate: '2025-01-01',
      endDate: '2025-01-31',
      limit: 3
    });
    
    console.log(`Status: ${dateResult.status}`);
    if (dateResult.status === 200 && dateResult.data.success) {
      const cruises = dateResult.data.data?.cruises || [];
      console.log(`Found ${cruises.length} cruises for January 2025\n`);
    } else {
      console.log('Error:', dateResult.data);
    }
    
    // Test 3: Get available filters
    console.log('\n3️⃣ Testing filter endpoint:');
    console.log('─'.repeat(40));
    
    const filterResult = await makeRequest('/api/v1/search/filters', 'GET');
    
    console.log(`Status: ${filterResult.status}`);
    if (filterResult.status === 200 && filterResult.data.success) {
      const filters = filterResult.data.data;
      console.log('Available filters:');
      console.log(`  Cruise Lines: ${filters.cruiseLines?.length || 0}`);
      console.log(`  Ships: ${filters.ships?.length || 0}`);
      console.log(`  Ports: ${filters.ports?.length || 0}`);
      console.log(`  Regions: ${filters.regions?.length || 0}`);
    } else {
      console.log('Error:', filterResult.data);
    }
    
    // Test 4: Get cruise details
    console.log('\n4️⃣ Testing cruise detail endpoint:');
    console.log('─'.repeat(40));
    
    // Use a known cruise ID from our sync
    const cruiseId = 345235; // One we know exists
    const detailResult = await makeRequest(`/api/v1/cruises/${cruiseId}`, 'GET');
    
    console.log(`Status: ${detailResult.status}`);
    if (detailResult.status === 200 && detailResult.data.success) {
      const cruise = detailResult.data.data;
      console.log(`Found cruise: ${cruise.name}`);
      console.log(`  Itinerary: ${cruise.itinerary?.length || 0} stops`);
      console.log(`  Pricing options: ${cruise.pricing?.length || 0}`);
    } else {
      console.log('Error:', detailResult.data);
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Run tests
testAPI()
  .then(() => {
    console.log('\n✨ API tests complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal:', error.message);
    process.exit(1);
  });