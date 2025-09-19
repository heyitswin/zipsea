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

  // DO NOT extract pricing from raw_data - the database prices are correct
  // The raw_data contains incorrect values from FTP files
  // Database prices are properly calculated from cabin prices, not from raw JSON fields

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

  return rawData.itinerary.map((day: any, index: number) => {
    // Use 'name' or 'itineraryname' fields, fallback to 'portname' for compatibility
    const portName = day.name || day.itineraryname || day.portname || day.port?.name || 'At Sea';

    return {
      id: `${rawData.codetocruiseid || rawData.id}-day-${index + 1}`,
      cruiseId: rawData.codetocruiseid || rawData.id,
      dayNumber: day.day || day.daynumber || index + 1,
      portName: portName,
      portId: day.portid,
      arrivalTime: day.arrivetime || day.arrivaltime,
      departureTime: day.departtime || day.departuretime,
      overnight: day.overnight === 'Y',
      description: day.description || day.port?.description || '',
      isSeaDay:
        portName.toLowerCase().includes('at sea') || portName.toLowerCase().includes('cruising'),
      port: day.port
        ? {
            id: day.port.portid,
            name: day.port.name,
            country: day.port.country,
            description: day.port.description,
          }
        : null,
    };
  });
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
  if (!rawData?.cabins) {
    return [];
  }

  // Handle both array and object formats
  let cabinArray: any[] = [];

  if (Array.isArray(rawData.cabins)) {
    cabinArray = rawData.cabins;
  } else if (typeof rawData.cabins === 'object') {
    // Convert object to array (cabins are stored as object with cabin IDs as keys)
    cabinArray = Object.values(rawData.cabins);
  }

  return cabinArray.map((cabin: any) => ({
    shipId: rawData.shipid || rawData.ship_id,
    code: cabin.cabincode || cabin.code || '',
    codeAlt: cabin.cabincodealt,
    name: cabin.name || cabin.cabinname || '',
    description: cabin.description,
    category: cabin.codtype || cabin.category || cabin.cabintype || '',
    categoryAlt: cabin.categoryalt,
    colorCode: cabin.colourcode || cabin.colorcode,
    colorCodeAlt: cabin.colourcodealt,
    imageUrl: cabin.imageurl,
    imageUrlHd: cabin.imageurlhd,
    isDefault: cabin.isdefault || false,
    validFrom: cabin.validfrom,
    validTo: cabin.validto,
    maxOccupancy: cabin.maxoccupancy || 4,
    minOccupancy: cabin.minoccupancy || 1,
    size: cabin.size || undefined,
    bedConfiguration: cabin.bedconfiguration || undefined,
    amenities: cabin.amenities || [],
    deckLocations: cabin.decklocations || cabin.allcabindecks || [],
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
