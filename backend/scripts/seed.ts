import { db } from '../src/db/connection';
import { cruiseLines, ships, ports, regions, cruises, cabinCategories, pricing, cheapestPricing } from '../src/db/schema';
import logger from '../src/config/logger';

async function seedDatabase() {
  try {
    logger.info('Starting database seeding...');

    // Seed cruise lines
    const cruiseLineData = [
      {
        id: 1,
        name: 'Royal Caribbean International',
        code: 'RCI',
        logoUrl: 'https://example.com/rci-logo.png',
        description: 'Royal Caribbean International is known for driving innovation at sea.',
        website: 'https://www.royalcaribbean.com',
        headquarters: 'Miami, Florida',
        foundedYear: 1968,
        fleetSize: 30,
        isActive: true,
      },
      {
        id: 2,
        name: 'Norwegian Cruise Line',
        code: 'NCL',
        logoUrl: 'https://example.com/ncl-logo.png',
        description: 'Norwegian Cruise Line is known for freestyle cruising.',
        website: 'https://www.ncl.com',
        headquarters: 'Miami, Florida',
        foundedYear: 1966,
        fleetSize: 17,
        isActive: true,
      },
      {
        id: 3,
        name: 'Carnival Cruise Line',
        code: 'CCL',
        logoUrl: 'https://example.com/carnival-logo.png',
        description: 'Carnival Cruise Line offers fun for everyone.',
        website: 'https://www.carnival.com',
        headquarters: 'Miami, Florida',
        foundedYear: 1972,
        fleetSize: 27,
        isActive: true,
      },
    ];

    await db.insert(cruiseLines).values(cruiseLineData).onConflictDoNothing();
    logger.info(`Seeded ${cruiseLineData.length} cruise lines`);

    // Seed regions
    const regionData = [
      { id: 1, name: 'Caribbean', code: 'CARIB', description: 'Tropical paradise with crystal clear waters', isPopular: true },
      { id: 2, name: 'Mediterranean', code: 'MED', description: 'Historic ports and beautiful coastlines', isPopular: true },
      { id: 3, name: 'Alaska', code: 'ALASKA', description: 'Scenic glaciers and wildlife', isPopular: true },
      { id: 4, name: 'Northern Europe', code: 'NORTH', description: 'Baltic Sea and Norwegian Fjords', isPopular: false },
      { id: 5, name: 'Asia', code: 'ASIA', description: 'Exotic cultures and modern cities', isPopular: false },
    ];

    await db.insert(regions).values(regionData).onConflictDoNothing();
    logger.info(`Seeded ${regionData.length} regions`);

    // Seed ports
    const portData = [
      {
        id: 1,
        name: 'Miami',
        code: 'MIA',
        country: 'United States',
        countryCode: 'US',
        state: 'Florida',
        city: 'Miami',
        latitude: '25.7617',
        longitude: '-80.1918',
        timezone: 'America/New_York',
      },
      {
        id: 2,
        name: 'Nassau',
        code: 'NAS',
        country: 'Bahamas',
        countryCode: 'BS',
        city: 'Nassau',
        latitude: '25.0443',
        longitude: '-77.3504',
        timezone: 'America/Nassau',
      },
      {
        id: 3,
        name: 'Cozumel',
        code: 'CZM',
        country: 'Mexico',
        countryCode: 'MX',
        city: 'Cozumel',
        latitude: '20.4230',
        longitude: '-86.9223',
        timezone: 'America/Cancun',
      },
      {
        id: 4,
        name: 'Barcelona',
        code: 'BCN',
        country: 'Spain',
        countryCode: 'ES',
        city: 'Barcelona',
        latitude: '41.3851',
        longitude: '2.1734',
        timezone: 'Europe/Madrid',
      },
    ];

    await db.insert(ports).values(portData).onConflictDoNothing();
    logger.info(`Seeded ${portData.length} ports`);

    // Seed ships
    const shipData = [
      {
        id: 1,
        cruiseLineId: 1,
        name: 'Symphony of the Seas',
        code: 'SYMP',
        shipClass: 'Oasis',
        tonnage: 228081,
        totalCabins: 2759,
        capacity: 5518,
        rating: 5,
        description: 'The world\'s largest cruise ship with innovative features.',
        highlights: 'FlowRider surf simulator, zip line, rock climbing walls',
        defaultImageUrl: 'https://example.com/symphony.jpg',
        images: JSON.stringify([
          { imageurl: 'https://example.com/symphony1.jpg', caption: 'Ship exterior' },
          { imageurl: 'https://example.com/symphony2.jpg', caption: 'Main pool deck' },
        ]),
        launchedYear: 2018,
        decks: 18,
      },
      {
        id: 2,
        cruiseLineId: 2,
        name: 'Norwegian Gem',
        code: 'GEM',
        shipClass: 'Jewel',
        tonnage: 93530,
        totalCabins: 1197,
        capacity: 2394,
        rating: 4,
        description: 'Freestyle cruising with multiple dining venues.',
        highlights: 'Rock climbing wall, spa, multiple specialty restaurants',
        defaultImageUrl: 'https://example.com/gem.jpg',
        images: JSON.stringify([
          { imageurl: 'https://example.com/gem1.jpg', caption: 'Ship exterior' },
        ]),
        launchedYear: 2007,
        decks: 12,
      },
    ];

    await db.insert(ships).values(shipData).onConflictDoNothing();
    logger.info(`Seeded ${shipData.length} ships`);

    // Seed sample cruises
    const cruiseData = [
      {
        id: 1001,
        codeToCruiseId: '1001',
        cruiseLineId: 1,
        shipId: 1,
        name: '7 Night Eastern Caribbean',
        itineraryCode: 'ECARIB7',
        voyageCode: 'SY240315',
        sailingDate: '2025-03-15',
        returnDate: '2025-03-22',
        nights: 7,
        sailNights: 7,
        seaDays: 3,
        embarkPortId: 1,
        disembarkPortId: 1,
        regionIds: JSON.stringify([1]),
        portIds: JSON.stringify([1, 2, 3]),
        marketId: 1,
        ownerId: 1,
        currency: 'USD',
        traveltekFilePath: '2025/03/1/1/1001.json',
      },
      {
        id: 1002,
        codeToCruiseId: '1002',
        cruiseLineId: 2,
        shipId: 2,
        name: '7 Night Western Caribbean',
        itineraryCode: 'WCARIB7',
        voyageCode: 'GEM240322',
        sailingDate: '2025-03-22',
        returnDate: '2025-03-29',
        nights: 7,
        sailNights: 7,
        seaDays: 2,
        embarkPortId: 1,
        disembarkPortId: 1,
        regionIds: JSON.stringify([1]),
        portIds: JSON.stringify([1, 3]),
        marketId: 1,
        ownerId: 1,
        currency: 'USD',
        traveltekFilePath: '2025/03/2/2/1002.json',
      },
    ];

    await db.insert(cruises).values(cruiseData).onConflictDoNothing();
    logger.info(`Seeded ${cruiseData.length} cruises`);

    // Seed cabin categories
    const cabinCategoryData = [
      {
        shipId: 1,
        cabinCode: 'IB',
        name: 'Interior Stateroom',
        description: 'Comfortable interior stateroom with modern amenities',
        category: 'interior',
        colorCode: '#8B4513',
        imageUrl: 'https://example.com/interior.jpg',
        maxOccupancy: 4,
        minOccupancy: 1,
        size: '150 sq ft',
        bedConfiguration: 'Two twin beds (convertible to queen)',
        amenities: JSON.stringify(['TV', 'Safe', 'Hair dryer', 'Mini fridge']),
      },
      {
        shipId: 1,
        cabinCode: 'OV',
        name: 'Ocean View Stateroom',
        description: 'Ocean view stateroom with large window',
        category: 'oceanview',
        colorCode: '#4169E1',
        imageUrl: 'https://example.com/oceanview.jpg',
        maxOccupancy: 4,
        minOccupancy: 1,
        size: '175 sq ft',
        bedConfiguration: 'Two twin beds (convertible to queen)',
        amenities: JSON.stringify(['TV', 'Safe', 'Hair dryer', 'Mini fridge', 'Ocean view']),
      },
      {
        shipId: 1,
        cabinCode: 'BA',
        name: 'Balcony Stateroom',
        description: 'Spacious balcony stateroom with private veranda',
        category: 'balcony',
        colorCode: '#32CD32',
        imageUrl: 'https://example.com/balcony.jpg',
        maxOccupancy: 4,
        minOccupancy: 1,
        size: '185 sq ft + 35 sq ft balcony',
        bedConfiguration: 'Two twin beds (convertible to queen)',
        amenities: JSON.stringify(['TV', 'Safe', 'Hair dryer', 'Mini fridge', 'Private balcony']),
      },
      {
        shipId: 1,
        cabinCode: 'SU',
        name: 'Junior Suite',
        description: 'Luxurious junior suite with separate living area',
        category: 'suite',
        colorCode: '#FFD700',
        imageUrl: 'https://example.com/suite.jpg',
        maxOccupancy: 4,
        minOccupancy: 1,
        size: '285 sq ft + 65 sq ft balcony',
        bedConfiguration: 'Queen bed + sofa bed',
        amenities: JSON.stringify(['TV', 'Safe', 'Hair dryer', 'Mini fridge', 'Private balcony', 'Sitting area', 'Priority boarding']),
      },
    ];

    await db.insert(cabinCategories).values(cabinCategoryData).onConflictDoNothing();
    logger.info(`Seeded ${cabinCategoryData.length} cabin categories`);

    // Seed sample pricing
    const pricingData = [
      {
        cruiseId: 1001,
        rateCode: 'RACK',
        cabinCode: 'IB',
        occupancyCode: '102',
        cabinType: 'Interior',
        basePrice: '599.00',
        adultPrice: '599.00',
        childPrice: '299.00',
        taxes: '125.00',
        ncf: '105.00',
        gratuity: '101.50',
        fuel: '0.00',
        nonComm: '105.00',
        totalPrice: '930.50',
        isAvailable: true,
        priceType: 'static',
        currency: 'USD',
      },
      {
        cruiseId: 1001,
        rateCode: 'RACK',
        cabinCode: 'OV',
        occupancyCode: '102',
        cabinType: 'Ocean View',
        basePrice: '799.00',
        adultPrice: '799.00',
        childPrice: '399.00',
        taxes: '125.00',
        ncf: '105.00',
        gratuity: '101.50',
        fuel: '0.00',
        nonComm: '105.00',
        totalPrice: '1130.50',
        isAvailable: true,
        priceType: 'static',
        currency: 'USD',
      },
      {
        cruiseId: 1001,
        rateCode: 'RACK',
        cabinCode: 'BA',
        occupancyCode: '102',
        cabinType: 'Balcony',
        basePrice: '999.00',
        adultPrice: '999.00',
        childPrice: '499.00',
        taxes: '125.00',
        ncf: '105.00',
        gratuity: '101.50',
        fuel: '0.00',
        nonComm: '105.00',
        totalPrice: '1330.50',
        isAvailable: true,
        priceType: 'static',
        currency: 'USD',
      },
      {
        cruiseId: 1001,
        rateCode: 'RACK',
        cabinCode: 'SU',
        occupancyCode: '102',
        cabinType: 'Suite',
        basePrice: '1999.00',
        adultPrice: '1999.00',
        childPrice: '999.00',
        taxes: '125.00',
        ncf: '105.00',
        gratuity: '101.50',
        fuel: '0.00',
        nonComm: '105.00',
        totalPrice: '2330.50',
        isAvailable: true,
        priceType: 'static',
        currency: 'USD',
      },
    ];

    await db.insert(pricing).values(pricingData).onConflictDoNothing();
    logger.info(`Seeded ${pricingData.length} pricing records`);

    // Seed cheapest pricing
    const cheapestPricingData = [
      {
        cruiseId: 1001,
        cheapestPrice: '599.00',
        cheapestCabinType: 'Interior',
        cheapestTaxes: '125.00',
        cheapestNcf: '105.00',
        cheapestGratuity: '101.50',
        cheapestFuel: '0.00',
        cheapestNonComm: '105.00',
        interiorPrice: '599.00',
        interiorTaxes: '125.00',
        interiorNcf: '105.00',
        interiorGratuity: '101.50',
        interiorFuel: '0.00',
        interiorNonComm: '105.00',
        interiorPriceCode: 'RACK|IB|102',
        oceanviewPrice: '799.00',
        oceanviewTaxes: '125.00',
        oceanviewNcf: '105.00',
        oceanviewGratuity: '101.50',
        oceanviewFuel: '0.00',
        oceanviewNonComm: '105.00',
        oceanviewPriceCode: 'RACK|OV|102',
        balconyPrice: '999.00',
        balconyTaxes: '125.00',
        balconyNcf: '105.00',
        balconyGratuity: '101.50',
        balconyFuel: '0.00',
        balconyNonComm: '105.00',
        balconyPriceCode: 'RACK|BA|102',
        suitePrice: '1999.00',
        suiteTaxes: '125.00',
        suiteNcf: '105.00',
        suiteGratuity: '101.50',
        suiteFuel: '0.00',
        suiteNonComm: '105.00',
        suitePriceCode: 'RACK|SU|102',
        currency: 'USD',
      },
    ];

    await db.insert(cheapestPricing).values(cheapestPricingData).onConflictDoNothing();
    logger.info(`Seeded ${cheapestPricingData.length} cheapest pricing records`);

    logger.info('Database seeding completed successfully!');
  } catch (error) {
    logger.error('Database seeding failed:', error);
    throw error;
  }
}

// Allow running seeds directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('✅ Database seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}

export default seedDatabase;