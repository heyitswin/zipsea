// Standardized cache key definitions for consistent caching across the application

export const CACHE_KEYS = {
  // Search results and filters
  SEARCH_RESULTS: (params: string) => `search:results:${Buffer.from(params).toString('base64').slice(0, 32)}`,
  SEARCH_FILTERS: 'search:filters',
  SEARCH_SUGGESTIONS: (query: string) => `search:suggestions:${query.toLowerCase()}`,
  POPULAR_DESTINATIONS: 'search:popular_destinations',
  
  // Cruise data
  CRUISE_LIST: (params: string) => `cruise:list:${Buffer.from(params).toString('base64').slice(0, 32)}`,
  CRUISE_DETAILS: (cruiseId: number) => `cruise:${cruiseId}:details`,
  CRUISE_PRICING: (cruiseId: number) => `cruise:${cruiseId}:pricing`,
  CRUISE_ITINERARY: (cruiseId: number) => `cruise:${cruiseId}:itinerary`,
  CABIN_PRICING: (cruiseId: number, cabinCode: string) => `cruise:${cruiseId}:cabin:${cabinCode}:pricing`,
  SHIP_DETAILS: (cruiseId: number) => `cruise:${cruiseId}:ship`,
  ALTERNATIVE_SAILINGS: (cruiseId: number) => `cruise:${cruiseId}:alternatives`,
  
  // Quote data
  QUOTE_DETAILS: (quoteId: string) => `quote:${quoteId}`,
  USER_QUOTES: (userId: string, page: number, limit: number) => `user:${userId}:quotes:${page}:${limit}`,
  QUOTE_SUMMARY: (userId: string) => `user:${userId}:quotes:summary`,
};

export const CacheKeys = {
  // Search-related cache keys
  search: (params: string) => `search:${Buffer.from(params).toString('base64').slice(0, 32)}`,
  searchFilters: () => 'search:filters',
  searchSuggestions: (query: string, limit: number) => `search:suggestions:${query}:${limit}`,
  popularCruises: (limit: number) => `search:popular:${limit}`,
  
  // Cruise-related cache keys
  cruiseDetails: (cruiseId: string) => `cruise:${cruiseId}:details`,
  pricing: (cruiseId: string, cabinType: string) => `cruise:${cruiseId}:pricing:${cabinType}`,

  // Cruise search patterns
  SEARCH: {
    CRUISE: (params: string) => `search:cruise:${params}`,
    FILTERS: 'search:filters',
    SUGGESTIONS: (query: string) => `search:suggestions:${query}`,
    POPULAR: 'search:popular',
    REGIONS: 'search:regions',
    PORTS: 'search:ports',
  },

  // Individual cruise data
  CRUISE: {
    DETAILS: (cruiseId: number) => `cruise:${cruiseId}`,
    PRICING: (cruiseId: number) => `cruise:${cruiseId}:pricing`,
    CABINS: (cruiseId: number) => `cruise:${cruiseId}:cabins`,
    ITINERARY: (cruiseId: number) => `cruise:${cruiseId}:itinerary`,
    ALTERNATIVES: (cruiseId: number) => `cruise:${cruiseId}:alternatives`,
    CHEAPEST: (cruiseId: number) => `cruise:${cruiseId}:cheapest`,
  },

  // Live pricing cache (shorter TTL)
  LIVE_PRICING: {
    CRUISE: (cruiseId: number) => `live:${cruiseId}`,
    CABIN: (cruiseId: number, cabinCode: string) => `live:${cruiseId}:${cabinCode}`,
    OCCUPANCY: (cruiseId: number, cabinCode: string, occupancy: string) => 
      `live:${cruiseId}:${cabinCode}:${occupancy}`,
  },

  // Ship and line data
  SHIP: {
    DETAILS: (shipId: number) => `ship:${shipId}`,
    CONTENT: (shipId: number) => `ship:${shipId}:content`,
    IMAGES: (shipId: number) => `ship:${shipId}:images`,
    AMENITIES: (shipId: number) => `ship:${shipId}:amenities`,
  },

  CRUISE_LINE: {
    DETAILS: (lineId: number) => `line:${lineId}`,
    SHIPS: (lineId: number) => `line:${lineId}:ships`,
  },

  // Port and region data
  PORT: {
    DETAILS: (portId: number) => `port:${portId}`,
    DEPARTURES: (portId: number) => `port:${portId}:departures`,
  },

  REGION: {
    DETAILS: (regionId: number) => `region:${regionId}`,
    HIERARCHY: 'regions:hierarchy',
    CRUISES: (regionId: number) => `region:${regionId}:cruises`,
  },

  // User-specific data
  USER: {
    PROFILE: (userId: string) => `user:${userId}`,
    PREFERENCES: (userId: string) => `user:${userId}:preferences`,
    QUOTES: (userId: string) => `user:${userId}:quotes`,
    SEARCHES: (userId: string) => `user:${userId}:searches`,
    FAVORITES: (userId: string) => `user:${userId}:favorites`,
  },

  // Quote and booking data
  QUOTE: {
    REQUEST: (quoteId: string) => `quote:${quoteId}`,
    PRICING: (quoteId: string) => `quote:${quoteId}:pricing`,
    STATUS: (quoteId: string) => `quote:${quoteId}:status`,
  },

  // Traveltek sync status
  SYNC: {
    STATUS: 'sync:status',
    LAST_RUN: 'sync:last_run',
    IN_PROGRESS: 'sync:in_progress',
    ERRORS: 'sync:errors',
    CRUISE_LINE: (lineId: number) => `sync:line:${lineId}`,
    FILE: (filePath: string) => `sync:file:${filePath.replace(/[\/\\]/g, ':')}`,
  },

  // System and health data
  SYSTEM: {
    HEALTH: 'system:health',
    STATS: 'system:stats',
    CONFIG: 'system:config',
  },

  // API rate limiting
  RATE_LIMIT: {
    IP: (ip: string) => `rate:ip:${ip}`,
    USER: (userId: string) => `rate:user:${userId}`,
    ENDPOINT: (endpoint: string, identifier: string) => `rate:${endpoint}:${identifier}`,
  },

  // Session and authentication
  SESSION: {
    TOKEN: (token: string) => `session:${token}`,
    USER: (userId: string) => `session:user:${userId}`,
    REFRESH: (refreshToken: string) => `refresh:${refreshToken}`,
  },

  // Analytics and metrics
  ANALYTICS: {
    DAILY_STATS: (date: string) => `analytics:daily:${date}`,
    POPULAR_CRUISES: (period: string) => `analytics:popular:${period}`,
    SEARCH_TRENDS: (period: string) => `analytics:trends:${period}`,
  },
} as const;

// Helper function to generate search cache key from parameters
export function generateSearchKey(params: {
  region?: string;
  departure?: string;
  duration?: string;
  startDate?: string;
  endDate?: string;
  cruiseLine?: string;
  ship?: string;
  cabinType?: string;
  priceMin?: string;
  priceMax?: string;
  sortBy?: string;
  page?: string;
  limit?: string;
}): string {
  // Sort parameters to ensure consistent cache keys
  const sortedParams = Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${value}`)
    .join('|');

  return CacheKeys.SEARCH.CRUISE(sortedParams);
}

// Helper function to generate user-specific cache key
export function generateUserKey(userId: string, type: keyof typeof CacheKeys.USER): string {
  return CacheKeys.USER[type](userId);
}

// Helper function to generate cruise-specific cache key
export function generateCruiseKey(cruiseId: number, type: keyof typeof CacheKeys.CRUISE): string {
  return CacheKeys.CRUISE[type](cruiseId);
}

// Cache TTL constants (in seconds)
export const CacheTTL = {
  // Short-lived cache
  SEARCH_RESULTS: 30 * 60, // 30 minutes
  LIVE_PRICING: 15 * 60, // 15 minutes
  RATE_LIMIT: 15 * 60, // 15 minutes

  // Medium-lived cache
  CRUISE_DETAILS: 6 * 60 * 60, // 6 hours
  SHIP_CONTENT: 24 * 60 * 60, // 24 hours
  PORT_DATA: 24 * 60 * 60, // 24 hours

  // Long-lived cache
  REGION_DATA: 7 * 24 * 60 * 60, // 7 days
  CRUISE_LINE_DATA: 7 * 24 * 60 * 60, // 7 days
  SYSTEM_CONFIG: 7 * 24 * 60 * 60, // 7 days

  // User-specific cache
  USER_SESSION: 24 * 60 * 60, // 24 hours
  USER_PREFERENCES: 7 * 24 * 60 * 60, // 7 days
  USER_QUOTES: 30 * 24 * 60 * 60, // 30 days

  // Sync and status cache
  SYNC_STATUS: 5 * 60, // 5 minutes
  HEALTH_CHECK: 2 * 60, // 2 minutes
} as const;

export default CacheKeys;