// Script to check MS Botticelli cruise data from the API
const fetch = require('node-fetch');

async function checkMSBotticelliData() {
  const slug = 'MS-Botticelli-Mediterranean-04-28-2025-11N-venice-to-monte-carlo';
  const apiUrl = `https://api.zipsea.com/api/cruises/slug/${slug}`;

  console.log('Fetching MS Botticelli data from API...\n');
  console.log(`URL: ${apiUrl}\n`);

  try {
    const response = await fetch(apiUrl, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`HTTP error! status: ${response.status}`);
      const text = await response.text();
      console.error('Response:', text);
      return;
    }

    const data = await response.json();

    if (!data.success) {
      console.error('API returned error:', data.error);
      return;
    }

    const cruise = data.data;
    console.log('='.repeat(60));
    console.log('CRUISE BASIC INFO');
    console.log('='.repeat(60));
    console.log(`ID: ${cruise.id}`);
    console.log(`Name: ${cruise.name}`);
    console.log(`Ship: ${cruise.ship?.name || 'N/A'}`);
    console.log(`Cruise Line: ${cruise.cruiseLine?.name || 'N/A'}`);
    console.log(`Departure Date: ${cruise.sailingDate}`);
    console.log(`Nights: ${cruise.nights}`);

    console.log('\n' + '='.repeat(60));
    console.log('FEATURED IMAGE');
    console.log('='.repeat(60));
    // Check various possible locations for featured image
    console.log(`featuredImageUrl: ${cruise.featuredImageUrl || 'NOT FOUND'}`);
    console.log(`heroImageUrl: ${cruise.heroImageUrl || 'NOT FOUND'}`);
    console.log(`imageUrl: ${cruise.imageUrl || 'NOT FOUND'}`);
    console.log(`defaultImage: ${cruise.defaultImage || 'NOT FOUND'}`);

    // Check ship images
    if (cruise.ship) {
      console.log(`\nShip defaultShipImage: ${cruise.ship.defaultShipImage || 'NOT FOUND'}`);
      console.log(`Ship defaultShipImage2k: ${cruise.ship.defaultShipImage2k || 'NOT FOUND'}`);
      if (cruise.ship.images && Array.isArray(cruise.ship.images)) {
        console.log(`Ship has ${cruise.ship.images.length} additional images`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('CABIN CATEGORIES');
    console.log('='.repeat(60));

    if (cruise.cabinCategories && Array.isArray(cruise.cabinCategories)) {
      console.log(`Found ${cruise.cabinCategories.length} cabin categories:\n`);

      const cabinTypes = ['interior', 'outside', 'balcony', 'suite'];

      for (const type of cabinTypes) {
        const cabins = cruise.cabinCategories.filter(c =>
          c.category?.toLowerCase().includes(type) ||
          c.name?.toLowerCase().includes(type)
        );

        console.log(`\n${type.toUpperCase()} CABINS (${cabins.length} found):`);

        if (cabins.length > 0) {
          for (const cabin of cabins) {
            console.log(`  - ${cabin.name || cabin.cabinCode}`);
            console.log(`    Description: ${cabin.description ? 'YES (' + cabin.description.substring(0, 50) + '...)' : 'MISSING'}`);
            console.log(`    Image URL: ${cabin.imageUrl || 'MISSING'}`);
            console.log(`    Image URL HD: ${cabin.imageUrlHd || 'MISSING'}`);
            console.log(`    Category: ${cabin.category || 'N/A'}`);
          }
        }
      }
    } else {
      console.log('No cabin categories found!');
    }

    console.log('\n' + '='.repeat(60));
    console.log('ITINERARY IMAGES');
    console.log('='.repeat(60));

    if (cruise.itinerary && Array.isArray(cruise.itinerary)) {
      console.log(`Found ${cruise.itinerary.length} itinerary stops:\n`);

      for (const stop of cruise.itinerary) {
        const hasImage = stop.imageUrl || stop.portImageUrl || false;
        console.log(`Day ${stop.dayNumber}: ${stop.portName} - Image: ${hasImage ? 'YES' : 'MISSING'}`);
      }
    } else {
      console.log('No itinerary found!');
    }

    console.log('\n' + '='.repeat(60));
    console.log('PRICING INFO');
    console.log('='.repeat(60));

    if (cruise.cheapestPricing) {
      console.log(`Cheapest Price: ${cruise.cheapestPricing.cheapestPrice || 'N/A'}`);
      console.log(`Interior Price: ${cruise.cheapestPricing.interiorPrice || 'N/A'}`);
      console.log(`Oceanview Price: ${cruise.cheapestPricing.oceanviewPrice || 'N/A'}`);
      console.log(`Balcony Price: ${cruise.cheapestPricing.balconyPrice || 'N/A'}`);
      console.log(`Suite Price: ${cruise.cheapestPricing.suitePrice || 'N/A'}`);
    } else {
      console.log('No pricing info found!');
    }

  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

checkMSBotticelliData();
