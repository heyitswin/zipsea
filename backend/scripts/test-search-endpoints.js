#!/usr/bin/env node

/**
 * TEST SEARCH ENDPOINTS
 * 
 * This script tests all search API endpoints without requiring database access.
 * It tests the actual production API to ensure everything is working correctly.
 */

const API_BASE_URL = process.env.API_URL || 'https://zipsea-production.onrender.com';

async function testEndpoint(name, url, description) {
  console.log(`\n🧪 ${name}`);
  console.log(`   ${description}`);
  console.log(`   URL: ${url}`);
  
  try {
    const response = await fetch(url);
    const status = `${response.status} ${response.statusText}`;
    
    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ Status: ${status}`);
      
      // Show relevant info based on endpoint
      if (data.results) {
        console.log(`   📊 Results: ${data.results.length} items`);
        if (data.results[0]) {
          console.log(`   📝 Sample: ${data.results[0].name || data.results[0].id}`);
        }
      } else if (data.cruises) {
        console.log(`   📊 Cruises: ${data.cruises.length} items`);
        if (data.cruises[0]) {
          console.log(`   📝 Sample: ${data.cruises[0].name || 'Cruise'}`);
        }
      } else if (data.count !== undefined) {
        console.log(`   📊 Count: ${data.count} items`);
      }
      
      return true;
    } else {
      const error = await response.text();
      console.log(`   ❌ Status: ${status}`);
      console.log(`   ❌ Error: ${error.substring(0, 100)}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Request failed: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('🔍 TESTING SEARCH API ENDPOINTS');
  console.log('================================');
  console.log(`API Base: ${API_BASE_URL}\n`);
  
  const tests = [
    // Main search endpoints
    {
      name: 'Test 1: Main Search (September 2025)',
      url: `${API_BASE_URL}/api/v1/search?startDate=2025-09-01&endDate=2025-09-30&limit=5`,
      description: 'Search for cruises in September 2025'
    },
    {
      name: 'Test 2: Search with Nights Filter',
      url: `${API_BASE_URL}/api/v1/search?startDate=2025-09-01&endDate=2025-09-30&nights=7&limit=5`,
      description: 'Search for 7-night cruises in September 2025'
    },
    {
      name: 'Test 3: Simple Cruise List',
      url: `${API_BASE_URL}/api/search/cruises?limit=5`,
      description: 'Get a simple list of cruises'
    },
    {
      name: 'Test 4: Search by Ship Name',
      url: `${API_BASE_URL}/api/v1/search/by-ship?shipName=Utopia&month=9&year=2025`,
      description: 'Find Utopia of the Seas sailings in Sept 2025'
    },
    {
      name: 'Test 5: Search by Ship (Partial Name)',
      url: `${API_BASE_URL}/api/v1/search/by-ship?shipName=Royal&limit=5`,
      description: 'Find ships with "Royal" in the name'
    },
    {
      name: 'Test 6: Get All Ships',
      url: `${API_BASE_URL}/api/v1/search/ships?limit=10`,
      description: 'Get list of ships with cruise counts'
    },
    {
      name: 'Test 7: Search Filters',
      url: `${API_BASE_URL}/api/v1/search/filters`,
      description: 'Get available search filter options'
    },
    {
      name: 'Test 8: Popular Cruises',
      url: `${API_BASE_URL}/api/v1/search/popular?limit=5`,
      description: 'Get popular cruise recommendations'
    },
    {
      name: 'Test 9: Search with Pagination',
      url: `${API_BASE_URL}/api/v1/search?startDate=2025-09-01&endDate=2025-09-30&limit=10&offset=10`,
      description: 'Test pagination (page 2 of results)'
    },
    {
      name: 'Test 10: Cruise Details',
      url: `${API_BASE_URL}/api/v1/cruises/2144120`,
      description: 'Get details for a specific cruise (ID: 2144120)'
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    const result = await testEndpoint(test.name, test.url, test.description);
    if (result) passed++;
    else failed++;
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${passed}/${tests.length}`);
  if (failed > 0) {
    console.log(`❌ Failed: ${failed}/${tests.length}`);
  }
  
  // Key endpoints status
  console.log('\n📋 KEY ENDPOINTS STATUS:');
  console.log('   • Main Search: /api/v1/search');
  console.log('   • Ship Search: /api/v1/search/by-ship');
  console.log('   • Cruise List: /api/search/cruises');
  console.log('   • Ship List: /api/v1/search/ships');
  console.log('   • Cruise Details: /api/v1/cruises/:id');
  
  console.log('\n💡 NOTES:');
  console.log('   • All endpoints should return 200 OK');
  console.log('   • September 2025 data has 2,429 cruises');
  console.log('   • Static pricing data not yet synced');
  console.log('   • Webhook URL ready for configuration');
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! The search API is fully functional.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the errors above.');
  }
}

// Run the tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});