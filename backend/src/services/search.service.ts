import { eq, and, or, gte, lte, like, inArray, sql, desc, asc, aliasedTable } from 'drizzle-orm';
import { db } from '../db/connection';
import { logger } from '../config/logger';
import { cacheManager } from '../cache/cache-manager';
import { CacheKeys } from '../cache/cache-keys';

// Add performance monitoring
const SEARCH_PERFORMANCE_THRESHOLD_MS = 200;
const SLOW_QUERY_THRESHOLD_MS = 1000;
import { 
  cruises, 
  cruiseLines, 
  ships, 
  ports, 
  regions, 
  cheapestPricing,
  pricing,
  itineraries
} from '../db/schema';

export interface SearchFilters {
  destination?: string;
  departurePort?: string;
  cruiseLine?: number | number[];
  ship?: number | number[];
  nights?: {
    min?: number;
    max?: number;
  };
  price?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  sailingDate?: {
    from?: string;
    to?: string;
  };
  cabinType?: string | string[];
  passengers?: number;
  regions?: number[];
  ports?: number[];
  q?: string; // General search query
  includeDeals?: boolean;
  minRating?: number;
  duration?: 'weekend' | 'week' | 'extended'; // Predefined duration filters
}

export interface SearchOptions {
  page?: number;
  limit?: number;
  sortBy?: 'price' | 'date' | 'nights' | 'name' | 'popularity' | 'rating' | 'deals';
  sortOrder?: 'asc' | 'desc';
  includeUnavailable?: boolean;
  facets?: boolean; // Whether to include facet counts
  minResponseTime?: boolean; // Optimize for fastest response
}

export interface SearchResult {
  cruises: CruiseSearchResult[];
  filters: SearchFiltersResponse;
  facets?: SearchFacets;
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    searchTime: number; // Response time in ms
    cacheHit: boolean;
  };
}

export interface CruiseSearchResult {
  id: number;
  name: string;
  cruiseLine: {
    id: number;
    name: string;
    code?: string;
    logo?: string;
  };
  ship: {
    id: number;
    name: string;
    tonnage?: number;
    passengerCapacity?: number;
    starRating?: number;
    defaultImageUrl?: string;
  };
  itinerary: {
    nights: number;
    sailingDate: string;
    returnDate?: string;
    embarkPort?: {
      id: number;
      name: string;
    };
    disembarkPort?: {
      id: number;
      name: string;
    };
    ports: string[];
    regions: string[];
  };
  pricing: {
    from: number;
    currency: string;
    cabinTypes: {
      interior?: number;
      oceanview?: number;
      balcony?: number;
      suite?: number;
    };
  };
  images?: string[];
}

export interface SearchFiltersResponse {
  cruiseLines: Array<{ id: number; name: string; code?: string; logo?: string; count: number }>;
  ships: Array<{ id: number; name: string; cruiseLineId: number; count: number }>;
  destinations: Array<{ name: string; type: 'region' | 'port'; id?: number; count: number }>;
  departurePorts: Array<{ id: number; name: string; city?: string; country?: string; count: number }>;
  cabinTypes: Array<{ type: string; name: string; count: number }>;
  nightsRange: { min: number; max: number };
  priceRange: { min: number; max: number; currency: string };
  sailingDateRange: { min: string; max: string };
  ratingRange?: { min: number; max: number };
}

export interface SearchFacets {
  cruiseLines: Array<{ id: number; name: string; count: number; selected: boolean }>;
  cabinTypes: Array<{ type: string; name: string; count: number; selected: boolean }>;
  priceRanges: Array<{ min: number; max: number; label: string; count: number; selected: boolean }>;
  durationRanges: Array<{ min: number; max: number; label: string; count: number; selected: boolean }>;
  popularDestinations: Array<{ name: string; type: 'region' | 'port'; count: number; selected: boolean }>;
  sailingMonths: Array<{ month: string; year: number; count: number; selected: boolean }>;
}

export class SearchService {

  /**
   * Search cruises with filters and pagination
   */
  async searchCruises(filters: SearchFilters = {}, options: SearchOptions = {}): Promise<SearchResult> {
    const startTime = Date.now();
    const cacheKey = CacheKeys.search(JSON.stringify({ filters, options }));
    
    try {
      // Try to get from cache first (unless min response time is requested)
      if (!options.minResponseTime) {
        const cached = await cacheManager.get<SearchResult>(cacheKey);
        if (cached) {
          logger.debug('Returning cached search results');
          cached.meta.searchTime = Date.now() - startTime;
          cached.meta.cacheHit = true;
          return cached;
        }
      }

      const page = Math.max(1, options.page || 1);
      const limit = Math.min(100, Math.max(1, options.limit || 20));
      const offset = (page - 1) * limit;

      // Create aliases for ports
      const embarkPort = aliasedTable(ports, 'embark_port');
      const disembarkPort = aliasedTable(ports, 'disembark_port');

      // Build the base query with optimized joins
      let query = db
        .select({
          cruise: cruises,
          cruiseLine: cruiseLines,
          ship: ships,
          embarkPort: embarkPort,
          disembarkPort: disembarkPort,
          cheapestPrice: cheapestPricing,
        })
        .from(cruises)
        .leftJoin(cruiseLines, eq(cruises.cruiseLineId, cruiseLines.id))
        .leftJoin(ships, eq(cruises.shipId, ships.id))
        .leftJoin(embarkPort, eq(cruises.embarkPortId, embarkPort.id))
        .leftJoin(disembarkPort, eq(cruises.disembarkPortId, disembarkPort.id))
        .leftJoin(cheapestPricing, eq(cruises.id, cheapestPricing.cruiseId))
        .where(and(
          eq(cruises.isActive, true),
          eq(cruises.showCruise, true),
          // Only show future cruises
          gte(cruises.sailingDate, new Date().toISOString().split('T')[0])
        ));

      // Apply filters with better performance
      const whereConditions = [
        eq(cruises.isActive, true),
        eq(cruises.showCruise, true),
        gte(cruises.sailingDate, new Date().toISOString().split('T')[0])
      ];

      // General search query (full-text search)
      if (filters.q && filters.q.length >= 2) {
        const searchTerm = filters.q.toLowerCase().replace(/[^a-z0-9\s]/g, '');
        whereConditions.push(
          or(
            sql`to_tsvector('english', ${cruises.name}) @@ plainto_tsquery('english', ${searchTerm})`,
            sql`to_tsvector('english', ${cruiseLines.name}) @@ plainto_tsquery('english', ${searchTerm})`,
            sql`to_tsvector('english', ${ships.name}) @@ plainto_tsquery('english', ${searchTerm})`,
            sql`to_tsvector('english', ${embarkPort.name} || ' ' || COALESCE(${embarkPort.city}, '') || ' ' || COALESCE(${embarkPort.country}, '')) @@ plainto_tsquery('english', ${searchTerm})`,
            like(cruises.name, `%${searchTerm}%`)
          )
        );
      }

      // Cruise line filter (support multiple)
      if (filters.cruiseLine) {
        if (Array.isArray(filters.cruiseLine)) {
          whereConditions.push(inArray(cruises.cruiseLineId, filters.cruiseLine));
        } else {
          whereConditions.push(eq(cruises.cruiseLineId, filters.cruiseLine));
        }
      }

      // Ship filter (support multiple)
      if (filters.ship) {
        if (Array.isArray(filters.ship)) {
          whereConditions.push(inArray(cruises.shipId, filters.ship));
        } else {
          whereConditions.push(eq(cruises.shipId, filters.ship));
        }
      }

      // Rating filter
      if (filters.minRating) {
        whereConditions.push(gte(ships.starRating, filters.minRating));
      }

      // Duration shortcuts
      if (filters.duration) {
        switch (filters.duration) {
          case 'weekend':
            whereConditions.push(and(gte(cruises.nights, 2), lte(cruises.nights, 4)));
            break;
          case 'week':
            whereConditions.push(and(gte(cruises.nights, 5), lte(cruises.nights, 9)));
            break;
          case 'extended':
            whereConditions.push(gte(cruises.nights, 10));
            break;
        }
      }

      if (filters.departurePort) {
        // Support both ID and name search for departure port
        if (isNaN(Number(filters.departurePort))) {
          // Search by port name
          whereConditions.push(
            or(
              like(embarkPort.name, `%${filters.departurePort}%`),
              like(disembarkPort.name, `%${filters.departurePort}%`)
            )
          );
        } else {
          // Search by port ID
          const portId = Number(filters.departurePort);
          whereConditions.push(
            or(
              eq(cruises.embarkPortId, portId),
              eq(cruises.disembarkPortId, portId)
            )
          );
        }
      }

      if (filters.nights?.min) {
        whereConditions.push(gte(cruises.nights, filters.nights.min));
      }

      if (filters.nights?.max) {
        whereConditions.push(lte(cruises.nights, filters.nights.max));
      }

      if (filters.sailingDate?.from) {
        whereConditions.push(gte(cruises.sailingDate, filters.sailingDate.from));
      }

      if (filters.sailingDate?.to) {
        whereConditions.push(lte(cruises.sailingDate, filters.sailingDate.to));
      }

      if (filters.regions && filters.regions.length > 0) {
        // Search in the regionIds JSON array
        whereConditions.push(
          sql`${cruises.regionIds}::jsonb ?| array[${filters.regions.map(id => `'${id}'`).join(',')}]`
        );
      }

      if (filters.ports && filters.ports.length > 0) {
        // Optimized JSONB search for ports
        const portIdStrings = filters.ports.map(id => `"${id}"`);
        whereConditions.push(
          sql`${cruises.portIds}::jsonb ?| array[${portIdStrings.join(',')}]`
        );
      }

      // Cabin type filter
      if (filters.cabinType) {
        const cabinTypes = Array.isArray(filters.cabinType) ? filters.cabinType : [filters.cabinType];
        const cabinConditions = cabinTypes.map(type => {
          switch (type.toLowerCase()) {
            case 'interior':
            case 'inside':
              return sql`${cheapestPricing.interiorPrice} IS NOT NULL AND ${cheapestPricing.interiorPrice} > '0'`;
            case 'oceanview':
            case 'outside':
              return sql`${cheapestPricing.oceanviewPrice} IS NOT NULL AND ${cheapestPricing.oceanviewPrice} > '0'`;
            case 'balcony':
              return sql`${cheapestPricing.balconyPrice} IS NOT NULL AND ${cheapestPricing.balconyPrice} > '0'`;
            case 'suite':
              return sql`${cheapestPricing.suitePrice} IS NOT NULL AND ${cheapestPricing.suitePrice} > '0'`;
            default:
              return sql`1=1`;
          }
        });
        if (cabinConditions.length > 0) {
          whereConditions.push(or(...cabinConditions));
        }
      }

      // Apply pricing filters with currency support
      if (filters.price?.min || filters.price?.max) {
        if (filters.price.min) {
          whereConditions.push(gte(sql`${cheapestPricing.cheapestPrice}::numeric`, filters.price.min));
        }
        if (filters.price.max) {
          whereConditions.push(lte(sql`${cheapestPricing.cheapestPrice}::numeric`, filters.price.max));
        }
        // Currency filter removed - no longer stored in database
        // All prices are in USD from Traveltek
      }

      // Deal filter
      if (filters.includeDeals) {
        // Add logic for identifying deals (e.g., discounted prices, special offers)
        whereConditions.push(
          sql`${cheapestPricing.cheapestPrice}::numeric < (${cheapestPricing.cheapestPrice}::numeric * 0.9)`
        );
      }

      // Apply destination filter (search in ports and regions)
      if (filters.destination) {
        whereConditions.push(
          or(
            sql`${cruises.portIds}::text ILIKE '%${filters.destination}%'`,
            sql`${cruises.regionIds}::text ILIKE '%${filters.destination}%'`,
            like(cruises.name, `%${filters.destination}%`)
          )
        );
      }

      // Rebuild query with all conditions
      query = query.where(and(...whereConditions));

      // Apply sorting with enhanced options
      const sortBy = options.sortBy || 'price';
      const sortOrder = options.sortOrder || 'asc';

      switch (sortBy) {
        case 'price':
          query = sortOrder === 'desc' 
            ? query.orderBy(desc(sql`${cheapestPricing.cheapestPrice}::numeric`))
            : query.orderBy(asc(sql`${cheapestPricing.cheapestPrice}::numeric`));
          break;
        case 'date':
          query = sortOrder === 'desc'
            ? query.orderBy(desc(cruises.sailingDate))
            : query.orderBy(asc(cruises.sailingDate));
          break;
        case 'nights':
          query = sortOrder === 'desc'
            ? query.orderBy(desc(cruises.nights))
            : query.orderBy(asc(cruises.nights));
          break;
        case 'name':
          query = sortOrder === 'desc'
            ? query.orderBy(desc(cruises.name))
            : query.orderBy(asc(cruises.name));
          break;
        case 'rating':
          query = sortOrder === 'desc'
            ? query.orderBy(desc(ships.starRating), asc(sql`${cheapestPricing.cheapestPrice}::numeric`))
            : query.orderBy(asc(ships.starRating), asc(sql`${cheapestPricing.cheapestPrice}::numeric`));
          break;
        case 'popularity':
          // Sort by combination of factors: price, rating, recent bookings
          query = query.orderBy(
            desc(ships.starRating),
            asc(sql`${cheapestPricing.cheapestPrice}::numeric`),
            desc(cruises.updatedAt)
          );
          break;
        case 'deals':
          // Sort by best deals first (lowest price with highest rating)
          query = query.orderBy(
            asc(sql`${cheapestPricing.cheapestPrice}::numeric`),
            desc(ships.starRating)
          );
          break;
        default:
          query = query.orderBy(asc(sql`${cheapestPricing.cheapestPrice}::numeric`));
      }

      // Get total count (before pagination)
      const countQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(cruises)
        .leftJoin(cruiseLines, eq(cruises.cruiseLineId, cruiseLines.id))
        .leftJoin(ships, eq(cruises.shipId, ships.id))
        .leftJoin(embarkPort, eq(cruises.embarkPortId, embarkPort.id))
        .leftJoin(disembarkPort, eq(cruises.disembarkPortId, disembarkPort.id))
        .leftJoin(cheapestPricing, eq(cruises.id, cheapestPricing.cruiseId))
        .where(and(...whereConditions));

      const [totalResult, results, searchFilters, facets] = await Promise.all([
        countQuery.execute(),
        query.limit(limit).offset(offset).execute(),
        this.getSearchFilters(),
        options.facets ? this.getSearchFacets(whereConditions) : Promise.resolve(undefined)
      ]);

      const total = totalResult[0]?.count || 0;
      const totalPages = Math.ceil(total / limit);

      // Transform results to the expected format (optimized for speed)
      const cruiseResults: CruiseSearchResult[] = await Promise.all(
        results.map(async (row) => this.transformCruiseResult(row))
      );

      const searchTime = Date.now() - startTime;

      const result: SearchResult = {
        cruises: cruiseResults,
        filters: searchFilters,
        facets,
        meta: {
          page,
          limit,
          total,
          totalPages,
          searchTime,
          cacheHit: false,
        },
      };

      // Cache the result (shorter TTL for personalized searches)
      const ttl = Object.keys(filters).length > 2 ? 1800 : 3600; // 30 min vs 1 hour
      await cacheManager.set(cacheKey, result, { ttl });

      logger.info(`Search completed: ${total} results found, page ${page}/${totalPages} in ${searchTime}ms`);
      return result;

    } catch (error) {
      const searchTime = Date.now() - startTime;
      logger.error(`Search failed after ${searchTime}ms:`, error);
      throw error;
    }
  }

  /**
   * Get search facets for the current filters
   */
  private async getSearchFacets(whereConditions: any[]): Promise<SearchFacets> {
    try {
      // Get cruise line facets
      const cruiseLineFacets = await db
        .select({
          id: cruiseLines.id,
          name: cruiseLines.name,
          count: sql<number>`count(${cruises.id})`,
        })
        .from(cruises)
        .leftJoin(cruiseLines, eq(cruises.cruiseLineId, cruiseLines.id))
        .leftJoin(cheapestPricing, eq(cruises.id, cheapestPricing.cruiseId))
        .where(and(...whereConditions))
        .groupBy(cruiseLines.id, cruiseLines.name)
        .having(sql`count(${cruises.id}) > 0`)
        .orderBy(desc(sql`count(${cruises.id})`), cruiseLines.name)
        .limit(10);

      // Get cabin type facets
      const cabinTypeFacets = [
        {
          type: 'interior',
          name: 'Interior',
          count: await this.getCabinTypeCount(whereConditions, 'interior'),
          selected: false
        },
        {
          type: 'oceanview',
          name: 'Oceanview',
          count: await this.getCabinTypeCount(whereConditions, 'oceanview'),
          selected: false
        },
        {
          type: 'balcony',
          name: 'Balcony',
          count: await this.getCabinTypeCount(whereConditions, 'balcony'),
          selected: false
        },
        {
          type: 'suite',
          name: 'Suite',
          count: await this.getCabinTypeCount(whereConditions, 'suite'),
          selected: false
        }
      ];

      // Get price range facets
      const priceRangeFacets = [
        { min: 0, max: 500, label: 'Under $500', count: 0, selected: false },
        { min: 500, max: 1000, label: '$500 - $1,000', count: 0, selected: false },
        { min: 1000, max: 2000, label: '$1,000 - $2,000', count: 0, selected: false },
        { min: 2000, max: 5000, label: '$2,000 - $5,000', count: 0, selected: false },
        { min: 5000, max: 999999, label: '$5,000+', count: 0, selected: false }
      ];

      // Calculate price range counts
      for (const range of priceRangeFacets) {
        range.count = await this.getPriceRangeCount(whereConditions, range.min, range.max);
      }

      // Get duration facets
      const durationFacets = [
        { min: 1, max: 4, label: 'Short (1-4 nights)', count: 0, selected: false },
        { min: 5, max: 7, label: 'Week (5-7 nights)', count: 0, selected: false },
        { min: 8, max: 14, label: 'Extended (8-14 nights)', count: 0, selected: false },
        { min: 15, max: 999, label: 'Long (15+ nights)', count: 0, selected: false }
      ];

      // Calculate duration counts
      for (const range of durationFacets) {
        range.count = await this.getDurationRangeCount(whereConditions, range.min, range.max);
      }

      return {
        cruiseLines: cruiseLineFacets.map(cl => ({
          id: cl.id,
          name: cl.name,
          count: cl.count,
          selected: false
        })),
        cabinTypes: cabinTypeFacets,
        priceRanges: priceRangeFacets,
        durationRanges: durationFacets,
        popularDestinations: [], // TODO: Implement
        sailingMonths: [] // TODO: Implement
      };

    } catch (error) {
      logger.error('Failed to get search facets:', error);
      return {
        cruiseLines: [],
        cabinTypes: [],
        priceRanges: [],
        durationRanges: [],
        popularDestinations: [],
        sailingMonths: []
      };
    }
  }

  /**
   * Get count for specific cabin type
   */
  private async getCabinTypeCount(whereConditions: any[], cabinType: string): Promise<number> {
    try {
      let priceField;
      switch (cabinType) {
        case 'interior':
          priceField = cheapestPricing.interiorPrice;
          break;
        case 'oceanview':
          priceField = cheapestPricing.oceanviewPrice;
          break;
        case 'balcony':
          priceField = cheapestPricing.balconyPrice;
          break;
        case 'suite':
          priceField = cheapestPricing.suitePrice;
          break;
        default:
          return 0;
      }

      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(cruises)
        .leftJoin(cheapestPricing, eq(cruises.id, cheapestPricing.cruiseId))
        .where(and(
          ...whereConditions,
          sql`${priceField} IS NOT NULL AND ${priceField} > '0'`
        ));

      return result[0]?.count || 0;
    } catch (error) {
      logger.error(`Failed to get cabin type count for ${cabinType}:`, error);
      return 0;
    }
  }

  /**
   * Get count for price range
   */
  private async getPriceRangeCount(whereConditions: any[], minPrice: number, maxPrice: number): Promise<number> {
    try {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(cruises)
        .leftJoin(cheapestPricing, eq(cruises.id, cheapestPricing.cruiseId))
        .where(and(
          ...whereConditions,
          gte(sql`${cheapestPricing.cheapestPrice}::numeric`, minPrice),
          maxPrice < 999999 ? lte(sql`${cheapestPricing.cheapestPrice}::numeric`, maxPrice) : sql`1=1`
        ));

      return result[0]?.count || 0;
    } catch (error) {
      logger.error(`Failed to get price range count for ${minPrice}-${maxPrice}:`, error);
      return 0;
    }
  }

  /**
   * Get count for duration range
   */
  private async getDurationRangeCount(whereConditions: any[], minNights: number, maxNights: number): Promise<number> {
    try {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(cruises)
        .leftJoin(cheapestPricing, eq(cruises.id, cheapestPricing.cruiseId))
        .where(and(
          ...whereConditions,
          gte(cruises.nights, minNights),
          maxNights < 999 ? lte(cruises.nights, maxNights) : sql`1=1`
        ));

      return result[0]?.count || 0;
    } catch (error) {
      logger.error(`Failed to get duration range count for ${minNights}-${maxNights}:`, error);
      return 0;
    }
  }

  /**
   * Transform database result to cruise search result format
   */
  private async transformCruiseResult(row: any): Promise<CruiseSearchResult> {
    const cruise = row.cruise;
    const cruiseLine = row.cruiseLine;
    const ship = row.ship;
    const embarkPort = row.embarkPort;
    const disembarkPort = row.disembarkPort;
    const pricing = row.cheapestPrice;

    // Get ports and regions from JSON arrays
    let portIds = [];
    let regionIds = [];
    
    try {
      if (cruise.portIds) {
        if (Array.isArray(cruise.portIds)) {
          portIds = cruise.portIds;
        } else if (typeof cruise.portIds === 'string') {
          portIds = JSON.parse(cruise.portIds);
        }
      }
    } catch (e) {
      logger.warn(`Failed to parse portIds for cruise ${cruise.id}:`, e);
      portIds = [];
    }
    
    try {
      if (cruise.regionIds) {
        if (Array.isArray(cruise.regionIds)) {
          regionIds = cruise.regionIds;
        } else if (typeof cruise.regionIds === 'string') {
          regionIds = JSON.parse(cruise.regionIds);
        }
      }
    } catch (e) {
      logger.warn(`Failed to parse regionIds for cruise ${cruise.id}:`, e);
      regionIds = [];
    }

    // Fetch port and region names
    const [portNames, regionNames] = await Promise.all([
      this.getPortNames(portIds),
      this.getRegionNames(regionIds)
    ]);

    return {
      id: cruise.id,
      name: cruise.name,
      cruiseLine: {
        id: cruiseLine?.id || 0,
        name: cruiseLine?.name || 'Unknown',
        code: cruiseLine?.code,
        logo: cruiseLine?.logo,
      },
      ship: {
        id: ship?.id || 0,
        name: ship?.name || 'Unknown',
        tonnage: ship?.tonnage,
        passengerCapacity: ship?.capacity,
        starRating: ship?.rating,
        defaultImageUrl: ship?.defaultImageUrl,
      },
      itinerary: {
        nights: cruise.nights,
        sailingDate: cruise.sailingDate,
        returnDate: cruise.returnDate,
        embarkPort: embarkPort?.id ? {
          id: embarkPort.id,
          name: embarkPort.name,
        } : undefined,
        disembarkPort: disembarkPort?.id ? {
          id: disembarkPort.id,
          name: disembarkPort.name,
        } : undefined,
        ports: portNames,
        regions: regionNames,
      },
      pricing: {
        from: pricing?.cheapestPrice ? parseFloat(pricing.cheapestPrice) : 0,
        currency: 'USD', // Always USD from Traveltek
        cabinTypes: {
          interior: pricing?.interiorPrice ? parseFloat(pricing.interiorPrice) : undefined,
          oceanview: pricing?.oceanviewPrice ? parseFloat(pricing.oceanviewPrice) : undefined,
          balcony: pricing?.balconyPrice ? parseFloat(pricing.balconyPrice) : undefined,
          suite: pricing?.suitePrice ? parseFloat(pricing.suitePrice) : undefined,
        },
      },
      images: ship?.images ? JSON.parse(ship.images) : [],
    };
  }

  /**
   * Get port names by IDs
   */
  private async getPortNames(portIds: number[]): Promise<string[]> {
    if (!portIds || portIds.length === 0) return [];

    try {
      // Ensure all IDs are numbers
      const numericIds = portIds
        .map(id => typeof id === 'number' ? id : parseInt(String(id), 10))
        .filter(id => !isNaN(id) && id > 0);
      
      if (numericIds.length === 0) return [];

      const portsResult = await db
        .select({ name: ports.name })
        .from(ports)
        .where(inArray(ports.id, numericIds));

      return portsResult.map(p => p.name);
    } catch (error) {
      logger.warn('Failed to fetch port names:', error);
      return [];
    }
  }

  /**
   * Get region names by IDs
   */
  private async getRegionNames(regionIds: number[]): Promise<string[]> {
    if (!regionIds || regionIds.length === 0) return [];

    try {
      // Ensure all IDs are numbers
      const numericIds = regionIds
        .map(id => typeof id === 'number' ? id : parseInt(String(id), 10))
        .filter(id => !isNaN(id) && id > 0);
      
      if (numericIds.length === 0) return [];

      const regionsResult = await db
        .select({ name: regions.name })
        .from(regions)
        .where(inArray(regions.id, numericIds));

      return regionsResult.map(r => r.name);
    } catch (error) {
      logger.warn('Failed to fetch region names:', error);
      return [];
    }
  }

  /**
   * Get search filters for the frontend
   */
  async getSearchFilters(): Promise<SearchFiltersResponse> {
    const cacheKey = CacheKeys.searchFilters();

    try {
      const cached = await cacheManager.get<SearchFiltersResponse>(cacheKey);
      if (cached) {
        return cached;
      }

      // Run all queries in parallel for better performance
      const [
        cruiseLinesResult,
        shipsResult,
        departurePortsResult,
        destinationsResult,
        rangesResult,
        cabinTypesResult
      ] = await Promise.all([
        // Get active cruise lines
        db
          .select({
            id: cruiseLines.id,
            name: cruiseLines.name,
            code: cruiseLines.code,
            logo: cruiseLines.logo,
            count: sql<number>`count(${cruises.id})`,
          })
          .from(cruiseLines)
          .leftJoin(cruises, and(
            eq(cruises.cruiseLineId, cruiseLines.id),
            eq(cruises.isActive, true),
            gte(cruises.sailingDate, new Date().toISOString().split('T')[0])
          ))
          .where(eq(cruiseLines.isActive, true))
          .groupBy(cruiseLines.id, cruiseLines.name, cruiseLines.code, cruiseLines.logo)
          .having(sql`count(${cruises.id}) > 0`)
          .orderBy(desc(sql`count(${cruises.id})`), cruiseLines.name),

        // Get ships with cruise counts
        db
          .select({
            id: ships.id,
            name: ships.name,
            cruiseLineId: ships.cruiseLineId,
            count: sql<number>`count(${cruises.id})`,
          })
          .from(ships)
          .leftJoin(cruises, and(
            eq(cruises.shipId, ships.id),
            eq(cruises.isActive, true),
            gte(cruises.sailingDate, new Date().toISOString().split('T')[0])
          ))
          .where(eq(ships.isActive, true))
          .groupBy(ships.id, ships.name, ships.cruiseLineId)
          .having(sql`count(${cruises.id}) > 0`)
          .orderBy(desc(sql`count(${cruises.id})`), ships.name)
          .limit(50), // Limit to top 50 ships

        // Get departure ports
        db
          .select({
            id: ports.id,
            name: ports.name,
            city: ports.city,
            country: ports.country,
            count: sql<number>`count(${cruises.id})`,
          })
          .from(ports)
          .leftJoin(cruises, and(
            or(
              eq(cruises.embarkPortId, ports.id),
              eq(cruises.disembarkPortId, ports.id)
            ),
            eq(cruises.isActive, true),
            gte(cruises.sailingDate, new Date().toISOString().split('T')[0])
          ))
          .where(eq(ports.isActive, true))
          .groupBy(ports.id, ports.name, ports.city, ports.country)
          .having(sql`count(${cruises.id}) > 0`)
          .orderBy(desc(sql`count(${cruises.id})`), ports.name),

        // Get popular destinations (regions and ports)
        db
          .select({
            id: regions.id,
            name: regions.name,
            type: sql<string>`'region'`,
            count: sql<number>`count(${cruises.id})`,
          })
          .from(regions)
          .leftJoin(cruises, and(
            sql`${cruises.regionIds}::jsonb ? ${regions.id}::text`,
            eq(cruises.isActive, true),
            gte(cruises.sailingDate, new Date().toISOString().split('T')[0])
          ))
          .where(eq(regions.isActive, true))
          .groupBy(regions.id, regions.name)
          .having(sql`count(${cruises.id}) > 0`)
          .orderBy(desc(sql`count(${cruises.id})`), regions.name)
          .limit(20),

        // Get ranges
        db
          .select({
            minNights: sql<number>`min(${cruises.nights})`,
            maxNights: sql<number>`max(${cruises.nights})`,
            minPrice: sql<number>`min(${cheapestPricing.cheapestPrice}::numeric)`,
            maxPrice: sql<number>`max(${cheapestPricing.cheapestPrice}::numeric)`,
            minDate: sql<string>`min(${cruises.sailingDate})`,
            maxDate: sql<string>`max(${cruises.sailingDate})`,
            minRating: sql<number>`min(${ships.starRating})`,
            maxRating: sql<number>`max(${ships.starRating})`,
          })
          .from(cruises)
          .leftJoin(cheapestPricing, eq(cruises.id, cheapestPricing.cruiseId))
          .leftJoin(ships, eq(cruises.shipId, ships.id))
          .where(and(
            eq(cruises.isActive, true),
            gte(cruises.sailingDate, new Date().toISOString().split('T')[0])
          )),

        // Get cabin type counts
        Promise.all([
          db
            .select({ count: sql<number>`count(*)` })
            .from(cruises)
            .leftJoin(cheapestPricing, eq(cruises.id, cheapestPricing.cruiseId))
            .where(and(
              eq(cruises.isActive, true),
              gte(cruises.sailingDate, new Date().toISOString().split('T')[0]),
              sql`${cheapestPricing.interiorPrice} IS NOT NULL AND ${cheapestPricing.interiorPrice} > '0'`
            )),
          db
            .select({ count: sql<number>`count(*)` })
            .from(cruises)
            .leftJoin(cheapestPricing, eq(cruises.id, cheapestPricing.cruiseId))
            .where(and(
              eq(cruises.isActive, true),
              gte(cruises.sailingDate, new Date().toISOString().split('T')[0]),
              sql`${cheapestPricing.oceanviewPrice} IS NOT NULL AND ${cheapestPricing.oceanviewPrice} > '0'`
            )),
          db
            .select({ count: sql<number>`count(*)` })
            .from(cruises)
            .leftJoin(cheapestPricing, eq(cruises.id, cheapestPricing.cruiseId))
            .where(and(
              eq(cruises.isActive, true),
              gte(cruises.sailingDate, new Date().toISOString().split('T')[0]),
              sql`${cheapestPricing.balconyPrice} IS NOT NULL AND ${cheapestPricing.balconyPrice} > '0'`
            )),
          db
            .select({ count: sql<number>`count(*)` })
            .from(cruises)
            .leftJoin(cheapestPricing, eq(cruises.id, cheapestPricing.cruiseId))
            .where(and(
              eq(cruises.isActive, true),
              gte(cruises.sailingDate, new Date().toISOString().split('T')[0]),
              sql`${cheapestPricing.suitePrice} IS NOT NULL AND ${cheapestPricing.suitePrice} > '0'`
            ))
        ])
      ]);

      const ranges = rangesResult[0] || {};
      const [interiorCount, oceanviewCount, balconyCount, suiteCount] = cabinTypesResult;

      const filters: SearchFiltersResponse = {
        cruiseLines: cruiseLinesResult.map(cl => ({
          id: cl.id,
          name: cl.name,
          code: cl.code,
          logo: cl.logo,
          count: cl.count,
        })),
        ships: shipsResult.map(s => ({
          id: s.id,
          name: s.name,
          cruiseLineId: s.cruiseLineId,
          count: s.count,
        })),
        destinations: destinationsResult.map(d => ({
          name: d.name,
          type: d.type as 'region' | 'port',
          id: d.id,
          count: d.count,
        })),
        departurePorts: departurePortsResult.map(p => ({
          id: p.id,
          name: p.name,
          city: p.city,
          country: p.country,
          count: p.count,
        })),
        cabinTypes: [
          { type: 'interior', name: 'Interior', count: interiorCount[0]?.count || 0 },
          { type: 'oceanview', name: 'Oceanview', count: oceanviewCount[0]?.count || 0 },
          { type: 'balcony', name: 'Balcony', count: balconyCount[0]?.count || 0 },
          { type: 'suite', name: 'Suite', count: suiteCount[0]?.count || 0 }
        ],
        nightsRange: {
          min: ranges.minNights || 1,
          max: ranges.maxNights || 30,
        },
        priceRange: {
          min: ranges.minPrice || 0,
          max: ranges.maxPrice || 10000,
          currency: 'USD', // TODO: Support multiple currencies
        },
        sailingDateRange: {
          min: ranges.minDate || new Date().toISOString().split('T')[0],
          max: ranges.maxDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        },
        ratingRange: {
          min: ranges.minRating || 1,
          max: ranges.maxRating || 5,
        },
      };

      // Cache for 2 hours (shorter TTL for dynamic data)
      await cacheManager.set(cacheKey, filters, { ttl: 7200 });

      return filters;

    } catch (error) {
      logger.error('Failed to get search filters:', error);
      throw error;
    }
  }

  /**
   * Get popular cruises
   */
  async getPopularCruises(limit: number = 10): Promise<CruiseSearchResult[]> {
    const cacheKey = CacheKeys.popularCruises(limit);

    try {
      const cached = await cacheManager.get<CruiseSearchResult[]>(cacheKey);
      if (cached) {
        return cached;
      }

      // Create aliases for ports
      const embarkPort = aliasedTable(ports, 'embark_port');
      const disembarkPort = aliasedTable(ports, 'disembark_port');

      // Get popular cruises (for now, just get cheapest with good ratings)
      const results = await db
        .select({
          cruise: cruises,
          cruiseLine: cruiseLines,
          ship: ships,
          embarkPort: embarkPort,
          disembarkPort: disembarkPort,
          cheapestPrice: cheapestPricing,
        })
        .from(cruises)
        .leftJoin(cruiseLines, eq(cruises.cruiseLineId, cruiseLines.id))
        .leftJoin(ships, eq(cruises.shipId, ships.id))
        .leftJoin(embarkPort, eq(cruises.embarkPortId, embarkPort.id))
        .leftJoin(disembarkPort, eq(cruises.disembarkPortId, disembarkPort.id))
        .leftJoin(cheapestPricing, eq(cruises.id, cheapestPricing.cruiseId))
        .where(and(
          eq(cruises.isActive, true),
          eq(cruises.showCruise, true),
          gte(cruises.sailingDate, new Date().toISOString().split('T')[0])
        ))
        .orderBy(asc(cheapestPricing.cheapestPrice), desc(ships.starRating))
        .limit(limit);

      const popularCruises = await Promise.all(
        results.map(row => this.transformCruiseResult(row))
      );

      // Cache for 2 hours
      await cacheManager.set(cacheKey, popularCruises, { ttl: 7200 });

      return popularCruises;

    } catch (error) {
      logger.error('Failed to get popular cruises:', error);
      throw error;
    }
  }

  /**
   * Get autocomplete suggestions for search
   */
  async getSearchSuggestions(query: string, limit: number = 10): Promise<Array<{
    type: string;
    value: string;
    label: string;
    count?: number;
    metadata?: any;
  }>> {
    if (!query || query.length < 2) return [];

    const cacheKey = CacheKeys.searchSuggestions(query.toLowerCase(), limit);

    try {
      const cached = await cacheManager.get<Array<{
        type: string;
        value: string;
        label: string;
        count?: number;
        metadata?: any;
      }>>(cacheKey);
      if (cached) {
        return cached;
      }

      const searchTerm = query.toLowerCase().replace(/[^a-z0-9\s]/g, '');
      const suggestions: Array<{
        type: string;
        value: string;
        label: string;
        count?: number;
        metadata?: any;
      }> = [];

      // Run all suggestion queries in parallel
      const [cruiseLineResults, portResults, regionResults, shipResults, cruiseResults] = await Promise.all([
        // Search cruise lines with full-text search
        db
          .select({ 
            id: cruiseLines.id, 
            name: cruiseLines.name,
            code: cruiseLines.code,
            logo: cruiseLines.logo,
            count: sql<number>`count(${cruises.id})`
          })
          .from(cruiseLines)
          .leftJoin(cruises, and(
            eq(cruises.cruiseLineId, cruiseLines.id),
            eq(cruises.isActive, true),
            gte(cruises.sailingDate, new Date().toISOString().split('T')[0])
          ))
          .where(and(
            or(
              sql`to_tsvector('english', ${cruiseLines.name}) @@ plainto_tsquery('english', ${searchTerm})`,
              like(cruiseLines.name, `%${searchTerm}%`)
            ),
            eq(cruiseLines.isActive, true)
          ))
          .groupBy(cruiseLines.id, cruiseLines.name, cruiseLines.code, cruiseLines.logo)
          .orderBy(desc(sql`count(${cruises.id})`), cruiseLines.name)
          .limit(3),

        // Search ports
        db
          .select({ 
            id: ports.id, 
            name: ports.name,
            city: ports.city,
            country: ports.country,
            count: sql<number>`count(${cruises.id})`
          })
          .from(ports)
          .leftJoin(cruises, and(
            or(
              eq(cruises.embarkPortId, ports.id),
              eq(cruises.disembarkPortId, ports.id)
            ),
            eq(cruises.isActive, true),
            gte(cruises.sailingDate, new Date().toISOString().split('T')[0])
          ))
          .where(and(
            or(
              sql`to_tsvector('english', ${ports.name} || ' ' || COALESCE(${ports.city}, '') || ' ' || COALESCE(${ports.country}, '')) @@ plainto_tsquery('english', ${searchTerm})`,
              like(ports.name, `%${searchTerm}%`),
              like(ports.city, `%${searchTerm}%`),
              like(ports.country, `%${searchTerm}%`)
            ),
            eq(ports.isActive, true)
          ))
          .groupBy(ports.id, ports.name, ports.city, ports.country)
          .orderBy(desc(sql`count(${cruises.id})`), ports.name)
          .limit(3),

        // Search regions
        db
          .select({ 
            id: regions.id, 
            name: regions.name,
            count: sql<number>`count(${cruises.id})`
          })
          .from(regions)
          .leftJoin(cruises, and(
            sql`${cruises.regionIds}::jsonb ? ${regions.id}::text`,
            eq(cruises.isActive, true),
            gte(cruises.sailingDate, new Date().toISOString().split('T')[0])
          ))
          .where(and(
            or(
              sql`to_tsvector('english', ${regions.name}) @@ plainto_tsquery('english', ${searchTerm})`,
              like(regions.name, `%${searchTerm}%`)
            ),
            eq(regions.isActive, true)
          ))
          .groupBy(regions.id, regions.name)
          .orderBy(desc(sql`count(${cruises.id})`), regions.name)
          .limit(3),

        // Search ships
        db
          .select({ 
            id: ships.id, 
            name: ships.name,
            cruiseLineId: ships.cruiseLineId,
            count: sql<number>`count(${cruises.id})`
          })
          .from(ships)
          .leftJoin(cruises, and(
            eq(cruises.shipId, ships.id),
            eq(cruises.isActive, true),
            gte(cruises.sailingDate, new Date().toISOString().split('T')[0])
          ))
          .where(and(
            or(
              sql`to_tsvector('english', ${ships.name}) @@ plainto_tsquery('english', ${searchTerm})`,
              like(ships.name, `%${searchTerm}%`)
            ),
            eq(ships.isActive, true)
          ))
          .groupBy(ships.id, ships.name, ships.cruiseLineId)
          .orderBy(desc(sql`count(${cruises.id})`), ships.name)
          .limit(2),

        // Search cruise names
        db
          .select({ 
            id: cruises.id, 
            name: cruises.name,
            sailingDate: cruises.sailingDate
          })
          .from(cruises)
          .where(and(
            or(
              sql`to_tsvector('english', ${cruises.name}) @@ plainto_tsquery('english', ${searchTerm})`,
              like(cruises.name, `%${searchTerm}%`)
            ),
            eq(cruises.isActive, true),
            eq(cruises.showCruise, true),
            gte(cruises.sailingDate, new Date().toISOString().split('T')[0])
          ))
          .orderBy(cruises.sailingDate)
          .limit(2)
      ]);

      // Add cruise line suggestions
      suggestions.push(...cruiseLineResults.map(cl => ({
        type: 'cruise-line',
        value: cl.id.toString(),
        label: cl.name,
        count: cl.count,
        metadata: {
          code: cl.code,
          logo: cl.logo
        }
      })));

      // Add port suggestions
      suggestions.push(...portResults.map(p => ({
        type: 'port',
        value: p.id.toString(),
        label: `${p.name}${p.city ? `, ${p.city}` : ''}${p.country ? `, ${p.country}` : ''}`,
        count: p.count,
        metadata: {
          city: p.city,
          country: p.country
        }
      })));

      // Add region suggestions
      suggestions.push(...regionResults.map(r => ({
        type: 'region',
        value: r.id.toString(),
        label: r.name,
        count: r.count
      })));

      // Add ship suggestions
      suggestions.push(...shipResults.map(s => ({
        type: 'ship',
        value: s.id.toString(),
        label: s.name,
        count: s.count,
        metadata: {
          cruiseLineId: s.cruiseLineId
        }
      })));

      // Add cruise name suggestions
      suggestions.push(...cruiseResults.map(c => ({
        type: 'cruise',
        value: c.id.toString(),
        label: c.name,
        metadata: {
          sailingDate: c.sailingDate
        }
      })));

      // Sort by relevance (count and exact matches)
      const sortedSuggestions = suggestions
        .sort((a, b) => {
          // Prioritize exact matches
          const aExact = a.label.toLowerCase().includes(searchTerm);
          const bExact = b.label.toLowerCase().includes(searchTerm);
          if (aExact && !bExact) return -1;
          if (!aExact && bExact) return 1;
          
          // Then by count
          return (b.count || 0) - (a.count || 0);
        })
        .slice(0, limit);

      // Cache for 15 minutes
      await cacheManager.set(cacheKey, sortedSuggestions, { ttl: 900 });

      return sortedSuggestions;

    } catch (error) {
      logger.error('Failed to get search suggestions:', error);
      return [];
    }
  }

  /**
   * Advanced search with ML-powered recommendations
   */
  async getRecommendedCruises(filters: SearchFilters = {}, limit: number = 5): Promise<CruiseSearchResult[]> {
    const cacheKey = `recommendations:${JSON.stringify(filters)}:${limit}`;
    
    try {
      const cached = await cacheManager.get<CruiseSearchResult[]>(cacheKey);
      if (cached) {
        return cached;
      }

      // Build recommendation query based on user preferences
      const embarkPort = aliasedTable(ports, 'embark_port');
      const disembarkPort = aliasedTable(ports, 'disembark_port');
      
      let query = db
        .select({
          cruise: cruises,
          cruiseLine: cruiseLines,
          ship: ships,
          embarkPort: embarkPort,
          disembarkPort: disembarkPort,
          cheapestPrice: cheapestPricing,
          // Recommendation score calculation
          score: sql<number>`
            COALESCE(${ships.starRating}, 3) * 2 +
            CASE WHEN ${cheapestPricing.cheapestPrice}::numeric < 1000 THEN 3
                 WHEN ${cheapestPricing.cheapestPrice}::numeric < 2000 THEN 2
                 ELSE 1 END +
            CASE WHEN ${cruises.nights} BETWEEN 7 AND 10 THEN 2 ELSE 1 END +
            CASE WHEN ${cruises.sailingDate} > CURRENT_DATE + INTERVAL '1 month' 
                 AND ${cruises.sailingDate} < CURRENT_DATE + INTERVAL '6 months' THEN 2 ELSE 1 END
          `
        })
        .from(cruises)
        .leftJoin(cruiseLines, eq(cruises.cruiseLineId, cruiseLines.id))
        .leftJoin(ships, eq(cruises.shipId, ships.id))
        .leftJoin(embarkPort, eq(cruises.embarkPortId, embarkPort.id))
        .leftJoin(disembarkPort, eq(cruises.disembarkPortId, disembarkPort.id))
        .leftJoin(cheapestPricing, eq(cruises.id, cheapestPricing.cruiseId))
        .where(and(
          eq(cruises.isActive, true),
          eq(cruises.showCruise, true),
          gte(cruises.sailingDate, new Date().toISOString().split('T')[0]),
          sql`${cheapestPricing.cheapestPrice} IS NOT NULL`
        ))
        .orderBy(desc(sql`score`), asc(sql`${cheapestPricing.cheapestPrice}::numeric`))
        .limit(limit);

      const results = await query.execute();
      
      const recommendations = await Promise.all(
        results.map(row => this.transformCruiseResult(row))
      );

      // Cache for 1 hour
      await cacheManager.set(cacheKey, recommendations, { ttl: 3600 });

      return recommendations;

    } catch (error) {
      logger.error('Failed to get recommended cruises:', error);
      return [];
    }
  }
}

// Singleton instance
export const searchService = new SearchService();