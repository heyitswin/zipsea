// API configuration and service functions

// Use relative URL in production to leverage Next.js rewrites
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? "/api/v1" // Use relative path in production
    : "http://localhost:3001/api/v1");

export interface Ship {
  id: number;
  name: string;
  cruiseLineName: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    message: string;
    details: string;
  };
}

export interface ShipsResponse {
  ships: Ship[];
  total: number;
}

export interface Cruise {
  id: string;
  name: string;
  sailingDate: string;
  nights: number;
  cruiseLine: {
    name: string;
  };
  ship: {
    name: string;
  };
  embarkPort: {
    name: string;
  };
  disembarkPort: {
    name: string;
  };
  price: {
    amount: number;
    currency: string;
  } | null;
  // Legacy fields for backward compatibility
  shipId?: number;
  shipName?: string;
  cruiseLineName?: string;
  departureDate?: string;
  returnDate?: string;
  duration?: number;
  itinerary?: string[];
  departurePort?: string;
  prices?: {
    interior?: number;
    oceanview?: number;
    balcony?: number;
    suite?: number;
  };
  description?: string;
  onboardCredit?: number;
  [key: string]: any; // For any additional fields from the API
}

export interface CruiseSearchParams {
  shipId?: number;
  shipName?: string;
  departureDate?: string;
  duration?: number;
  limit?: number;
  offset?: number;
}

export interface CruisesResponse {
  cruises: Cruise[];
  total: number;
}

export async function fetchShips(searchTerm?: string): Promise<Ship[]> {
  try {
    const url = new URL(`${API_BASE_URL}/ships`);
    if (searchTerm && searchTerm.trim()) {
      url.searchParams.set("search", searchTerm);
    }

    const response = await fetch(url.toString(), {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: ApiResponse<ShipsResponse> = await response.json();

    if (!result.success) {
      throw new Error(result.error?.message || "Failed to fetch ships");
    }

    return result.data.ships;
  } catch (error) {
    console.error("Error fetching ships:", error);
    throw error;
  }
}

export async function searchShips(searchTerm: string): Promise<Ship[]> {
  try {
    const url = new URL(`${API_BASE_URL}/ships/search`);
    url.searchParams.set("q", searchTerm);

    const response = await fetch(url.toString(), {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: ApiResponse<ShipsResponse> = await response.json();

    if (!result.success) {
      throw new Error(result.error?.message || "Failed to search ships");
    }

    return result.data.ships;
  } catch (error) {
    console.error("Error searching ships:", error);
    throw error;
  }
}

export async function searchCruises(
  params: CruiseSearchParams,
): Promise<Cruise[]> {
  try {
    const url = new URL(`${API_BASE_URL}/cruises`);

    // Add search parameters
    if (params.shipId) {
      url.searchParams.set("shipId", params.shipId.toString());
    }
    if (params.shipName) {
      url.searchParams.set("shipName", params.shipName);
    }
    if (params.departureDate) {
      url.searchParams.set("departureDate", params.departureDate);
    }
    if (params.duration) {
      url.searchParams.set("duration", params.duration.toString());
    }
    if (params.limit) {
      url.searchParams.set("limit", params.limit.toString());
    }
    if (params.offset) {
      url.searchParams.set("offset", params.offset.toString());
    }

    const response = await fetch(url.toString(), {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: ApiResponse<CruisesResponse> = await response.json();

    if (!result.success) {
      throw new Error(result.error?.message || "Failed to search cruises");
    }

    // Normalize the API response using our helper function
    const normalizedCruises = result.data.cruises.map((cruise: any) => {
      const normalized = normalizeCruiseData(cruise);

      // Additional legacy field mappings for search results
      return {
        ...normalized,
        cruise_id: normalized.cruise_id || normalized.id,
        ship_name: normalized.shipName,
        cruise_line: normalized.cruiseLineName,
        departure_date: normalized.departureDate,
        return_date: normalized.returnDate,
        duration: normalized.nights ? `${normalized.nights} nights` : undefined,
        departure_port: normalized.departurePort,
        arrival_port: normalized.arrivalPort,
        interior_cheapest_price: normalized.prices?.interior,
        oceanview_cheapest_price: normalized.prices?.oceanview,
        balcony_cheapest_price: normalized.prices?.balcony,
        suite_cheapest_price: normalized.prices?.suite,
        onboard_credit: normalized.onboardCredit,
      };
    });

    return normalizedCruises;
  } catch (error) {
    console.error("Error searching cruises:", error);
    throw error;
  }
}

export interface ComprehensiveCruiseData {
  cruise: {
    id: number;
    cruiseId?: string;
    name: string;
    voyageCode?: string;
    itineraryCode?: string;
    sailingDate: string;
    startDate?: string;
    nights: number;
    sailNights?: number;
    seaDays?: number;
    embarkPortId?: number;
    disembarkPortId?: number;
    portIds?: string;
    regionIds?: string;
    marketId?: number;
    ownerId?: string;
    noFly?: boolean;
    departUk?: boolean;
    showCruise?: boolean;
    flyCruiseInfo?: string;
    lastCached?: string;
    cachedDate?: string;
    traveltekFilePath?: string;
    isActive: boolean;
    createdAt?: string;
    updatedAt?: string;
  };
  cruiseLine?: {
    id: number;
    name: string;
    code?: string;
    description?: string;
    raw?: {
      logo?: string;
      [key: string]: any;
    };
  };
  ship?: {
    id: number;
    name: string;
    code?: string;
    description?: string;
    cruiseLineId: number;
    capacity?: number;
    yearBuilt?: number;
    tonnage?: number;
    length?: number;
    width?: number;
    decks?: number;
    shortDescription?: string;
    defaultShipImage?: string;
    defaultShipImage2k?: string;
    starRating?: number;
    raw?: {
      launched?: string;
      totalCabins?: number;
      occupancy?: number;
      [key: string]: any;
    };
  };
  embarkPort?: {
    id: number;
    name: string;
    code?: string;
    country?: string;
    timezone?: string;
  };
  disembarkPort?: {
    id: number;
    name: string;
    code?: string;
    country?: string;
    timezone?: string;
  };
  regions: Array<{
    id: number;
    name: string;
    code?: string;
    description?: string;
  }>;
  ports: Array<{
    id: number;
    name: string;
    code?: string;
    country?: string;
    timezone?: string;
  }>;
  pricing?: {
    options: Array<{
      cabinType?: string;
      cabinCode?: string;
      rateCode?: string;
      price?: number;
      currency?: string;
    }>;
    summary?: {
      availableOptions: number;
      priceRange?: { min: number; max: number };
      cabinTypes: string[];
      rateCodes: string[];
    };
  };
  cheapestPricing?: {
    cruiseId: number;
    cheapestPrice: string;
    cheapestCabinType?: string;
    interiorPrice: string;
    oceanviewPrice: string;
    balconyPrice: string;
    suitePrice: string;
    currency: string;
    lastUpdated: string;
    raw?: any;
  };
  itinerary?: Array<{
    id: string;
    cruiseId: string;
    dayNumber: number;
    date: string;
    portName: string;
    portId: number;
    arrivalTime?: string;
    departureTime?: string;
    status: string;
    overnight: boolean;
    description?: string;
    raw?: any;
  }>;
  cabinCategories?: Array<{
    shipId: number;
    cabinCode: string;
    cabinCodeAlt?: string;
    name: string;
    description: string;
    category: string;
    colorCode?: string;
    imageUrl?: string;
    imageUrlHd?: string;
    isDefault: boolean;
    maxOccupancy: number;
    minOccupancy: number;
    isActive: boolean;
    raw?: any;
  }>;
  alternativeSailings?: Array<{
    id: number;
    alternativeCruiseId: number;
    sailingDate: string;
    price?: number;
  }>;
  seoData?: {
    title?: string;
    description?: string;
    keywords?: string[];
  };
  meta?: {
    requestedAt?: string;
    dataVersion?: string;
    totalFields?: number;
    cacheStatus?: {
      used: boolean;
      key?: string;
    };
  };
}

export async function getCruiseBySlug(
  slug: string,
): Promise<ComprehensiveCruiseData | null> {
  try {
    const url = new URL(`${API_BASE_URL}/cruises/slug/${slug}`);

    const response = await fetch(url.toString(), {
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store", // Disable caching to always get fresh data
    });

    if (response.status === 404) {
      return null; // Cruise not found
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: ApiResponse<ComprehensiveCruiseData> = await response.json();

    if (!result.success) {
      throw new Error(result.error?.message || "Failed to get cruise by slug");
    }

    return result.data;
  } catch (error) {
    console.error("Error getting cruise by slug:", error);
    throw error;
  }
}

export async function getComprehensiveCruiseData(
  cruiseId: number,
): Promise<ComprehensiveCruiseData | null> {
  try {
    const url = new URL(`${API_BASE_URL}/cruises/${cruiseId}/comprehensive`);

    const response = await fetch(url.toString(), {
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store", // Disable caching to always get fresh data
    });

    if (response.status === 404) {
      return null; // Cruise not found
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: ApiResponse<ComprehensiveCruiseData> = await response.json();

    if (!result.success) {
      throw new Error(
        result.error?.message || "Failed to get comprehensive cruise data",
      );
    }

    return result.data;
  } catch (error) {
    console.error("Error getting comprehensive cruise data:", error);
    throw error;
  }
}

// Fallback function that tries to get cruise details from the regular search endpoint
export async function getCruiseDetailsById(
  cruiseId: number,
): Promise<Cruise | null> {
  try {
    // Try to find the cruise in the search results
    const cruises = await searchCruises({ limit: 1000 }); // Get a large batch
    const cruise = cruises.find((c) => c.id === cruiseId);

    if (!cruise) {
      return null;
    }

    return cruise;
  } catch (error) {
    console.error("Error getting cruise details by ID:", error);
    throw error;
  }
}

export interface LastMinuteDeals {
  id: number;
  cruise_id?: string;
  name: string;
  ship_id?: number;
  ship_name: string;
  cruise_line_name: string;
  nights: number;
  sailing_date: string;
  return_date?: string;
  embark_port_name: string;
  embarkation_port_name?: string;
  cheapest_pricing: number;
  cheapest_price?: number;
  ship_image?: string;
  onboard_credit?: number;
}

export interface LastMinuteDealsResponse {
  deals: LastMinuteDeals[];
  total: number;
}

export async function fetchLastMinuteDeals(): Promise<LastMinuteDeals[]> {
  try {
    const url = new URL(`${API_BASE_URL}/cruises/last-minute-deals`);

    const response = await fetch(url.toString(), {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: ApiResponse<LastMinuteDealsResponse> = await response.json();

    if (!result.success) {
      throw new Error(
        result.error?.message || "Failed to fetch last minute deals",
      );
    }

    return result.data.deals;
  } catch (error) {
    console.error("Error fetching last minute deals:", error);
    throw error;
  }
}

export interface AvailableSailingDate {
  date: string;
  cruiseCount: number;
  sailingDates: string[];
}

export interface AvailableSailingDatesResponse {
  dates: AvailableSailingDate[];
  total: number;
}

// Helper function to normalize cruise data for backward compatibility
export function normalizeCruiseData(cruise: any): any {
  return {
    // New schema fields
    id: cruise.id,
    name: cruise.name,
    sailingDate: cruise.sailingDate || cruise.sailing_date,
    nights: cruise.nights,
    cruiseLine: cruise.cruiseLine,
    ship: cruise.ship,
    embarkPort: cruise.embarkPort,
    disembarkPort: cruise.disembarkPort,
    price: cruise.price,

    // Legacy field mappings for backward compatibility
    shipId: cruise.shipId || cruise.ship_id,
    shipName: cruise.shipName || cruise.ship_name || cruise.ship?.name,
    cruiseLineName:
      cruise.cruiseLineName ||
      cruise.cruise_line_name ||
      cruise.cruiseLine?.name,
    departureDate:
      cruise.departureDate ||
      cruise.departure_date ||
      cruise.sailingDate ||
      cruise.sailing_date,
    returnDate: cruise.returnDate || cruise.return_date,
    duration: cruise.duration || cruise.nights,
    departurePort:
      cruise.departurePort || cruise.departure_port || cruise.embarkPort?.name,
    arrivalPort:
      cruise.arrivalPort || cruise.arrival_port || cruise.disembarkPort?.name,

    // Pricing fields
    prices: {
      interior: cruise.interior_cheapest_price || cruise.interiorPrice,
      oceanview: cruise.oceanview_cheapest_price || cruise.oceanviewPrice,
      balcony: cruise.balcony_cheapest_price || cruise.balconyPrice,
      suite: cruise.suite_cheapest_price || cruise.suitePrice,
    },

    // Additional fields
    onboardCredit: cruise.onboard_credit || cruise.onboardCredit,

    // Pass through any other fields
    ...cruise,
  };
}

export async function fetchAvailableSailingDates(
  shipId: number,
): Promise<AvailableSailingDate[]> {
  try {
    const url = new URL(`${API_BASE_URL}/cruises/available-dates`);
    url.searchParams.set("shipId", shipId.toString());

    const response = await fetch(url.toString(), {
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Handle common error cases
    if (response.status === 400) {
      console.warn(
        `Available sailing dates API returned 400 for shipId ${shipId}. This feature may not be implemented on the backend yet.`,
      );
      return []; // Return empty array instead of throwing
    }

    if (response.status === 404) {
      console.warn(
        `Available sailing dates endpoint not found. This feature may not be implemented on the backend yet.`,
      );
      return []; // Return empty array instead of throwing
    }

    if (!response.ok) {
      console.warn(
        `Available sailing dates API error: ${response.status}. Disabling smart date filtering.`,
      );
      return []; // Return empty array instead of throwing
    }

    const result: ApiResponse<AvailableSailingDatesResponse> =
      await response.json();

    if (!result.success) {
      console.warn(
        `Available sailing dates API returned error: ${result.error?.message}. Disabling smart date filtering.`,
      );
      return []; // Return empty array instead of throwing
    }

    console.log(
      `Successfully loaded ${result.data.dates.length} available sailing dates for ship ${shipId}`,
    );
    return result.data.dates;
  } catch (error) {
    console.warn("Available sailing dates feature unavailable:", error);
    return []; // Return empty array instead of throwing
  }
}
