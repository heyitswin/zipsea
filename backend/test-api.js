const fetch = require('node-fetch');

async function test() {
  try {
    // Test search endpoint to find a ship with cruises
    const searchResponse = await fetch('http://localhost:3001/api/v1/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cruiseLine: 'Royal Caribbean',
        limit: 5
      })
    });

    const searchData = await searchResponse.json();
    console.log('Search results:', searchData.results?.length || 0, 'cruises found');

    if (searchData.results && searchData.results.length > 0) {
      const firstCruise = searchData.results[0];
      console.log('First cruise ship ID:', firstCruise.shipId);
      console.log('Ship name:', firstCruise.shipName);

      // Now test available-dates endpoint
      const datesResponse = await fetch(`http://localhost:3001/api/v1/cruises/available-dates?shipId=${firstCruise.shipId}`);
      const datesData = await datesResponse.json();
      console.log('\nAvailable dates response:');
      console.log('- Ship ID:', datesData.shipId);
      console.log('- Count:', datesData.count);
      if (datesData.dates && datesData.dates.length > 0) {
        console.log('- First date:', datesData.dates[0]);
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
