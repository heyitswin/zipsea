// API configuration and service functions

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

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
  id: number;
  shipId: number;
  shipName: string;
  cruiseLineName: string;
  departureDate: string;
  returnDate: string;
  duration: number;
  itinerary: string[];
  departurePort: string;
  prices: {
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
      url.searchParams.set('search', searchTerm);
    }
    
    const response = await fetch(url.toString(), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result: ApiResponse<ShipsResponse> = await response.json();
    
    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to fetch ships');
    }
    
    return result.data.ships;
  } catch (error) {
    console.error('Error fetching ships:', error);
    throw error;
  }
}

export async function searchShips(searchTerm: string): Promise<Ship[]> {
  try {
    const url = new URL(`${API_BASE_URL}/ships/search`);
    url.searchParams.set('q', searchTerm);
    
    const response = await fetch(url.toString(), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result: ApiResponse<ShipsResponse> = await response.json();
    
    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to search ships');
    }
    
    return result.data.ships;
  } catch (error) {
    console.error('Error searching ships:', error);
    throw error;
  }
}

export async function searchCruises(params: CruiseSearchParams): Promise<Cruise[]> {
  try {
    const url = new URL(`${API_BASE_URL}/cruises`);
    
    // Add search parameters
    if (params.shipId) {
      url.searchParams.set('shipId', params.shipId.toString());
    }
    if (params.shipName) {
      url.searchParams.set('shipName', params.shipName);
    }
    if (params.departureDate) {
      url.searchParams.set('departureDate', params.departureDate);
    }
    if (params.duration) {
      url.searchParams.set('duration', params.duration.toString());
    }
    if (params.limit) {
      url.searchParams.set('limit', params.limit.toString());
    }
    if (params.offset) {
      url.searchParams.set('offset', params.offset.toString());
    }
    
    const response = await fetch(url.toString(), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result: ApiResponse<CruisesResponse> = await response.json();
    
    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to search cruises');
    }
    
    // Map the API response to our Cruise interface
    const mappedCruises = result.data.cruises.map((cruise: any) => ({
      id: cruise.id,
      cruise_id: cruise.cruise_id || cruise.id,
      ship_name: cruise.ship_name || cruise.ship?.name || 'Unknown Ship',
      cruise_line: cruise.cruise_line_name || cruise.cruiseLine?.name || 'Unknown Cruise Line',
      name: cruise.name,
      departure_date: cruise.sailing_date || cruise.sailingDate,
      return_date: cruise.return_date || cruise.returnDate,
      duration: cruise.nights ? `${cruise.nights} nights` : undefined,
      departure_port: cruise.embark_port_name || cruise.embarkPort?.name,
      arrival_port: cruise.disembark_port_name || cruise.disembarkPort?.name,
      interior_cheapest_price: cruise.interior_price ? parseFloat(cruise.interior_price) : cruise.price?.interior || cruise.interiorPrice,
      oceanview_cheapest_price: cruise.oceanview_price ? parseFloat(cruise.oceanview_price) : cruise.price?.oceanview || cruise.oceanviewPrice,
      balcony_cheapest_price: cruise.balcony_price ? parseFloat(cruise.balcony_price) : cruise.price?.balcony || cruise.balconyPrice,
      suite_cheapest_price: cruise.suite_price ? parseFloat(cruise.suite_price) : cruise.price?.suite || cruise.suitePrice,
      onboard_credit: cruise.onboard_credit || cruise.onboardCredit,
      ...cruise // Include any other fields
    }));
    
    return mappedCruises;
  } catch (error) {
    console.error('Error searching cruises:', error);
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

export async function getCruiseBySlug(slug: string): Promise<ComprehensiveCruiseData | null> {
  try {
    const url = new URL(`${API_BASE_URL}/cruises/slug/${slug}`);
    
    const response = await fetch(url.toString(), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.status === 404) {
      return null; // Cruise not found
    }
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result: ApiResponse<ComprehensiveCruiseData> = await response.json();
    
    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to get cruise by slug');
    }
    
    return result.data;
  } catch (error) {
    console.error('Error getting cruise by slug:', error);
    throw error;
  }
}

export async function getComprehensiveCruiseData(cruiseId: number): Promise<ComprehensiveCruiseData | null> {
  try {
    const url = new URL(`${API_BASE_URL}/cruises/${cruiseId}/comprehensive`);
    
    const response = await fetch(url.toString(), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.status === 404) {
      return null; // Cruise not found
    }
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result: ApiResponse<ComprehensiveCruiseData> = await response.json();
    
    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to get comprehensive cruise data');
    }
    
    return result.data;
  } catch (error) {
    console.error('Error getting comprehensive cruise data:', error);
    throw error;
  }
}

// Fallback function that tries to get cruise details from the regular search endpoint
export async function getCruiseDetailsById(cruiseId: number): Promise<Cruise | null> {
  try {
    // Try to find the cruise in the search results
    const cruises = await searchCruises({ limit: 1000 }); // Get a large batch
    const cruise = cruises.find(c => c.id === cruiseId);
    
    if (!cruise) {
      return null;
    }
    
    return cruise;
  } catch (error) {
    console.error('Error getting cruise details by ID:', error);
    throw error;
  }
}

export interface LastMinuteDeals {
  id: number;
  cruise_id?: string;
  name: string;
  ship_name: string;
  cruise_line_name: string;
  nights: number;
  sailing_date: string;
  embark_port_name: string;
  cheapest_pricing: number;
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
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result: ApiResponse<LastMinuteDealsResponse> = await response.json();
    
    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to fetch last minute deals');
    }
    
    return result.data.deals;
  } catch (error) {
    console.error('Error fetching last minute deals:', error);
    throw error;
  }
}