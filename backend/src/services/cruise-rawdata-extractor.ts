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
    dayNumber: day.daynumber || index + 1,
    portName: day.portname || day.port?.name || 'At Sea',
    portId: day.portid,
    arrivalTime: day.arrivaltime,
    departureTime: day.departuretime,
    overnight: day.overnight === 'Y',
    description: day.port?.description || day.description || '',
    isSeaDay:
      day.portname?.toLowerCase().includes('sea') ||
      day.portname?.toLowerCase().includes('cruising'),
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
  if (!rawData?.cabins || !Array.isArray(rawData.cabins)) {
    return [];
  }

  return rawData.cabins.map((cabin: any) => ({
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
  }));
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
