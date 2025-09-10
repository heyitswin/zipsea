const fetch = require('node-fetch');

const API_URL = process.env.API_URL || 'https://zipsea-production.onrender.com';

async function testSearchAPI() {
  console.log('=== Testing Search API ===\n');
  console.log('API URL:', API_URL);

  try {
    // Test 1: Get all cruises
    console.log('\n1. Testing /api/v1/cruises (no filters):');
    const allCruisesRes = await fetch(`${API_URL}/api/v1/cruises?limit=5`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const allCruises = await allCruisesRes.json();
    console.log('Status:', allCruisesRes.status);
    console.log('Success:', allCruises.success);
    console.log('Total cruises:', allCruises.data?.meta?.total || 0);
    if (allCruises.data?.cruises?.length > 0) {
      console.log('First cruise:', {
        id: allCruises.data.cruises[0].id,
        name: allCruises.data.cruises[0].name,
        date: allCruises.data.cruises[0].sailing_date,
      });
    }

    // Test 2: Search by ship name
    console.log('\n2. Testing search by ship name (Wonder):');
    const wonderSearchUrl = `${API_URL}/api/v1/cruises?shipName=Wonder&limit=10`;
    console.log('URL:', wonderSearchUrl);
    const wonderRes = await fetch(wonderSearchUrl, {
      headers: { 'Content-Type': 'application/json' },
    });
    const wonderCruises = await wonderRes.json();
    console.log('Status:', wonderRes.status);
    console.log('Success:', wonderCruises.success);
    console.log('Results found:', wonderCruises.data?.cruises?.length || 0);
    if (wonderCruises.data?.cruises?.length > 0) {
      wonderCruises.data.cruises.forEach(cruise => {
        console.log(`- ${cruise.name} | ${cruise.sailing_date} | ${cruise.ship_name}`);
      });
    }

    // Test 3: Search for February 2026 cruises
    console.log('\n3. Testing search for Feb 2026 cruises:');
    const feb2026Url = `${API_URL}/api/v1/search/by-ship?sailingDate=2026-02-09`;
    console.log('URL:', feb2026Url);
    const feb2026Res = await fetch(feb2026Url, {
      headers: { 'Content-Type': 'application/json' },
    });
    const feb2026Cruises = await feb2026Res.json();
    console.log('Status:', feb2026Res.status);
    console.log('Success:', feb2026Cruises.success);
    console.log('Results found:', feb2026Cruises.data?.cruises?.length || 0);

    // Test 4: Get last minute deals
    console.log('\n4. Testing last minute deals:');
    const dealsRes = await fetch(`${API_URL}/api/v1/cruises/last-minute-deals`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const deals = await dealsRes.json();
    console.log('Status:', dealsRes.status);
    console.log('Success:', deals.success);
    console.log('Deals found:', deals.data?.deals?.length || 0);
    if (deals.data?.deals?.length > 0) {
      console.log('First deal:', {
        name: deals.data.deals[0].name,
        date: deals.data.deals[0].sailing_date,
        image: deals.data.deals[0].ship_image ? 'Has image' : 'No image',
      });
    }

    // Test 5: Search using the main search endpoint
    console.log('\n5. Testing main search endpoint:');
    const searchUrl = `${API_URL}/api/v1/search?q=Wonder&sailingDateFrom=2026-02-01&sailingDateTo=2026-02-28`;
    console.log('URL:', searchUrl);
    const searchRes = await fetch(searchUrl, {
      headers: { 'Content-Type': 'application/json' },
    });
    const searchResults = await searchRes.json();
    console.log('Status:', searchRes.status);
    console.log('Success:', searchResults.success);
    console.log('Results found:', searchResults.data?.cruises?.length || 0);
  } catch (error) {
    console.error('Error testing API:', error.message);
  }
}

testSearchAPI();
