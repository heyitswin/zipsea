require('dotenv').config();
const axios = require('axios');

async function testAPI() {
  console.log('=== Testing API Directly ===\n');

  try {
    // Test production API
    const response = await axios.get('https://api.zipsea.com/api/cruises/2173517/comprehensive');

    console.log('API Response Status:', response.status);
    console.log('Response has data:', !!response.data.data);

    const data = response.data.data;

    console.log('\nCruise info:');
    console.log('  ID:', data.cruise?.id);
    console.log('  Name:', data.cruise?.name);
    console.log('  Has rawData:', !!data.cruise?.rawData);

    if (data.cruise?.rawData) {
      const rawData = data.cruise.rawData;
      console.log('  Raw data type:', typeof rawData);
      console.log('  Raw data has itinerary:', !!rawData.itinerary);
      if (rawData.itinerary) {
        console.log('  Raw data itinerary length:', rawData.itinerary.length);
        if (rawData.itinerary.length > 0) {
          console.log('  First day in rawData:', JSON.stringify(rawData.itinerary[0], null, 2));
        }
      }
    }

    console.log('\nItinerary in response:');
    console.log('  Itinerary exists:', !!data.itinerary);
    console.log('  Itinerary is array:', Array.isArray(data.itinerary));
    console.log('  Itinerary length:', data.itinerary?.length || 0);

    if (data.itinerary && data.itinerary.length > 0) {
      console.log('  First day:', JSON.stringify(data.itinerary[0], null, 2));
    }

    // Check meta
    console.log('\nMeta info:');
    console.log('  Cache used:', data.meta?.cacheStatus?.used);
    console.log('  Timestamp:', data.meta?.timestamp);

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testAPI();
