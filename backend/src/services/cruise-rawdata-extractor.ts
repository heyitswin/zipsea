/**
 * Utility functions to extract data from raw_data JSON column
 * when regular columns are missing
 */

export function extractFromRawData(cruise: any) {
  if (!cruise?.rawData) return cruise;

  const raw = cruise.rawData;

  // Extract basic cruise info
  if (!cruise.name && raw.name) {
    cruise.name = raw.name;
  }

  // Extract pricing from raw_data if missing
  if (!cruise.interiorPrice && raw.cheapest?.combined?.inside) {
    cruise.interiorPrice = raw.cheapest.combined.inside;
  }
  if (!cruise.oceanviewPrice && raw.cheapest?.combined?.outside) {
    cruise.oceanviewPrice = raw.cheapest.combined.outside;
  }
  if (!cruise.balconyPrice && raw.cheapest?.combined?.balcony) {
    cruise.balconyPrice = raw.cheapest.combined.balcony;
  }
  if (!cruise.suitePrice && raw.cheapest?.combined?.suite) {
    cruise.suitePrice = raw.cheapest.combined.suite;
  }

  // Extract cheapest price
  if (!cruise.cheapestPrice) {
    const prices = [
      raw.cheapest?.combined?.inside,
      raw.cheapest?.combined?.outside,
      raw.cheapest?.combined?.balcony,
      raw.cheapest?.combined?.suite,
    ].filter(p => p && p > 0);

    if (prices.length > 0) {
      cruise.cheapestPrice = Math.min(...prices);
    }
  }

  return cruise;
}

export function extractShipFromRawData(ship: any, rawData: any) {
  if (!rawData?.shipcontent) return ship;

  const shipContent = rawData.shipcontent;

  // If ship is null, create a new ship object from raw data
  if (!ship) {
    ship = {
      id: shipContent.shipid,
      name: shipContent.name,
      description: shipContent.description || shipContent.shortdescription,
      defaultShipImage: shipContent.defaultshipimage,
      defaultShipImage2k: shipContent.defaultshipimage2k,
      starRating: shipContent.starrating,
      maxPassengers: shipContent.maxpassengers,
      tonnage: shipContent.tonnage,
      yearBuilt: shipContent.launchedyear,
    };
  } else {
    // Fill in missing fields
    if (!ship.description && (shipContent.description || shipContent.shortdescription)) {
      ship.description = shipContent.description || shipContent.shortdescription;
    }
    if (!ship.defaultShipImage && shipContent.defaultshipimage) {
      ship.defaultShipImage = shipContent.defaultshipimage;
    }
    if (!ship.defaultShipImage2k && shipContent.defaultshipimage2k) {
      ship.defaultShipImage2k = shipContent.defaultshipimage2k;
    }
    if (!ship.starRating && shipContent.starrating) {
      ship.starRating = shipContent.starrating;
    }
  }

  return ship;
}

export function extractItineraryFromRawData(rawData: any) {
  if (!rawData?.itinerary || !Array.isArray(rawData.itinerary)) {
    return [];
  }

  return rawData.itinerary.map((day: any, index: number) => ({
    id: `${rawData.codetocruiseid}-day-${index + 1}`,
    cruiseId: rawData.codetocruiseid,
    dayNumber: day.daynumber || day.day || index + 1,
    portName: day.name || day.itineraryname || day.portname || day.port?.name || 'At Sea',
    portId: day.portid,
    arrivalTime: day.arrivetime || day.arrivaltime,
    departureTime: day.departtime || day.departuretime,
    overnight: day.overnight === 'Y',
    description: day.description || day.port?.description || '',
    isSeaDay:
      day.name?.toLowerCase().includes('at sea') ||
      day.name?.toLowerCase().includes('sea day') ||
      day.name?.toLowerCase().includes('cruising') ||
      day.itineraryname?.toLowerCase().includes('at sea') ||
      day.itineraryname?.toLowerCase().includes('sea day') ||
      day.itineraryname?.toLowerCase().includes('cruising'),
    port: day.port
      ? {
          id: day.port.portid,
          name: day.port.name,
          country: day.port.country,
          description: day.port.description,
        }
      : null,
  }));
}

export function extractCheapestPricingFromRawData(rawData: any) {
  if (!rawData?.cheapest) return null;

  const cheapest = rawData.cheapest;
  const combined = cheapest.combined || {};

  const prices = [combined.inside, combined.outside, combined.balcony, combined.suite].filter(
    p => p && p > 0
  );

  const cheapestPrice = prices.length > 0 ? Math.min(...prices) : null;

  return {
    cruiseId: rawData.codetocruiseid,
    cheapestPrice: cheapestPrice,
    interiorPrice: combined.inside,
    oceanviewPrice: combined.outside,
    balconyPrice: combined.balcony,
    suitePrice: combined.suite,
    currency: rawData.currency || 'USD',
    cheapestCabinType:
      Object.entries(combined)
        .filter(([_, price]) => price)
        .sort(([_, a], [__, b]) => (a as number) - (b as number))[0]?.[0] || 'inside',
    lastUpdated: new Date().toISOString(),
    raw: rawData.cheapest,
  };
}

export function extractCabinCategoriesFromRawData(rawData: any) {
  const cabins = [];

  // Extract from actual cabin data if available
  if (rawData?.cabins && Array.isArray(rawData.cabins)) {
    rawData.cabins.forEach((cabin: any) => {
      cabins.push({
        id: cabin.cabinid,
        shipId: rawData.shipid,
        category: cabin.category || cabin.cabintype,
        name: cabin.name || cabin.cabinname,
        description: cabin.description,
        maxOccupancy: cabin.maxoccupancy,
        imageUrl: cabin.imageurl,
        imageUrlHd: cabin.imageurlhd,
        deckPlan: cabin.deckplan,
        amenities: cabin.amenities,
      });
    });
  }

  // Also create cabin categories from pricing sources if available
  const pricing = rawData?.cheapest?.combined;
  if (pricing) {
    // Helper to find cabin image by source
    const findCabinImageBySource = (source: string, cabinType: string) => {
      // If source is "prices", use default images based on cabin type
      if (!source || source === 'prices') {
        // Default cabin images based on type
        const defaultImages: Record<string, string> = {
          interior: '/images/cabins/interior-default.svg',
          oceanview: '/images/cabins/oceanview-default.svg',
          balcony: '/images/cabins/balcony-default.svg',
          suite: '/images/cabins/suite-default.svg',
        };
        return defaultImages[cabinType] || null;
      }

      // Look for cabin with matching id or category
      const matchingCabin = rawData?.cabins?.find(
        (cabin: any) =>
          cabin.cabinid === source ||
          cabin.category === source ||
          cabin.cabintype === source ||
          cabin.name === source ||
          cabin.cabinname === source
      );

      // Also check ship cabins if available
      if (!matchingCabin && rawData?.shipcontent?.cabins) {
        const shipCabin = rawData.shipcontent.cabins.find(
          (cabin: any) =>
            cabin.cabinid === source ||
            cabin.category === source ||
            cabin.cabintype === source ||
            cabin.name === source ||
            cabin.cabinname === source
        );
        if (shipCabin) {
          return shipCabin.imageurlhd || shipCabin.imageurl;
        }
      }

      return matchingCabin ? matchingCabin.imageurlhd || matchingCabin.imageurl : null;
    };

    // Add interior cabin if price exists
    if (pricing.inside && pricing.insidesource) {
      cabins.push({
        id: `${rawData.codetocruiseid}-interior`,
        shipId: rawData.shipid,
        category: 'interior',
        name: 'Interior Stateroom',
        description: 'Interior cabin without windows',
        maxOccupancy: null,
        imageUrl: findCabinImageBySource(pricing.insidesource, 'interior'),
        imageUrlHd: findCabinImageBySource(pricing.insidesource, 'interior'),
        deckPlan: null,
        amenities: null,
        source: pricing.insidesource,
      });
    }

    // Add oceanview cabin if price exists
    if (pricing.outside && pricing.outsidesource) {
      cabins.push({
        id: `${rawData.codetocruiseid}-oceanview`,
        shipId: rawData.shipid,
        category: 'oceanview',
        name: 'Ocean View Stateroom',
        description: 'Cabin with ocean view window',
        maxOccupancy: null,
        imageUrl: findCabinImageBySource(pricing.outsidesource, 'oceanview'),
        imageUrlHd: findCabinImageBySource(pricing.outsidesource, 'oceanview'),
        deckPlan: null,
        amenities: null,
        source: pricing.outsidesource,
      });
    }

    // Add balcony cabin if price exists
    if (pricing.balcony && pricing.balconysource) {
      cabins.push({
        id: `${rawData.codetocruiseid}-balcony`,
        shipId: rawData.shipid,
        category: 'balcony',
        name: 'Balcony Stateroom',
        description: 'Cabin with private balcony',
        maxOccupancy: null,
        imageUrl: findCabinImageBySource(pricing.balconysource, 'balcony'),
        imageUrlHd: findCabinImageBySource(pricing.balconysource, 'balcony'),
        deckPlan: null,
        amenities: null,
        source: pricing.balconysource,
      });
    }

    // Add suite cabin if price exists
    if (pricing.suite && pricing.suitesource) {
      cabins.push({
        id: `${rawData.codetocruiseid}-suite`,
        shipId: rawData.shipid,
        category: 'suite',
        name: 'Suite',
        description: 'Luxury suite accommodation',
        maxOccupancy: null,
        imageUrl: findCabinImageBySource(pricing.suitesource, 'suite'),
        imageUrlHd: findCabinImageBySource(pricing.suitesource, 'suite'),
        deckPlan: null,
        amenities: null,
        source: pricing.suitesource,
      });
    }
  }

  return cabins;
}

export function extractCruiseLineFromRawData(rawData: any) {
  if (!rawData?.linecontent) return null;

  const lineContent = rawData.linecontent;

  return {
    id: rawData.lineid,
    name: lineContent.name,
    code: lineContent.code,
    description: lineContent.description,
    logoUrl: lineContent.logourl,
  };
}

export function extractPortsFromRawData(rawData: any) {
  const ports = [];

  // Extract embark port
  if (rawData?.startportcontent) {
    ports.push({
      id: rawData.startportid,
      name: rawData.startportcontent.name,
      country: rawData.startportcontent.country,
      description: rawData.startportcontent.description,
      type: 'embark',
    });
  }

  // Extract disembark port
  if (rawData?.endportcontent) {
    ports.push({
      id: rawData.endportid,
      name: rawData.endportcontent.name,
      country: rawData.endportcontent.country,
      description: rawData.endportcontent.description,
      type: 'disembark',
    });
  }

  // Extract itinerary ports
  if (rawData?.itinerary && Array.isArray(rawData.itinerary)) {
    rawData.itinerary.forEach((day: any) => {
      if (day.port && !day.portname?.toLowerCase().includes('sea')) {
        ports.push({
          id: day.port.portid,
          name: day.port.name,
          country: day.port.country,
          description: day.port.description,
          type: 'visit',
        });
      }
    });
  }

  return ports;
}
