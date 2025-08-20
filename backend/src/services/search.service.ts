import { eq, and, or, gte, lte, like, inArray, sql, desc, asc } from 'drizzle-orm';
import { db } from '../db/connection';
import { logger } from '../config/logger';
import { cacheManager } from '../cache/cache-manager';
import { CacheKeys } from '../cache/cache-keys';
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
  cruiseLine?: number;
  ship?: number;
  nights?: {
    min?: number;
    max?: number;
  };
  price?: {
    min?: number;
    max?: number;
  };
  sailingDate?: {
    from?: string;
    to?: string;
  };
  cabinType?: string;
  passengers?: number;
  regions?: number[];
  ports?: number[];
}

export interface SearchOptions {
  page?: number;
  limit?: number;
  sortBy?: 'price' | 'date' | 'nights' | 'name';
  sortOrder?: 'asc' | 'desc';
  includeUnavailable?: boolean;
}

export interface SearchResult {
  cruises: CruiseSearchResult[];
  filters: SearchFiltersResponse;
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CruiseSearchResult {
  id: number;
  name: string;
  cruiseLine: {
    id: number;
    name: string;
    code?: string;
    logoUrl?: string;
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
  cruiseLines: Array<{ id: number; name: string; count: number }>;
  ships: Array<{ id: number; name: string; cruiseLineId: number; count: number }>;
  destinations: Array<{ name: string; count: number }>;
  departurePorts: Array<{ id: number; name: string; count: number }>;
  nightsRange: { min: number; max: number };
  priceRange: { min: number; max: number };
  sailingDateRange: { min: string; max: string };
}

export class SearchService {

  /**
   * Search cruises with filters and pagination
   */
  async searchCruises(filters: SearchFilters = {}, options: SearchOptions = {}): Promise<SearchResult> {
    const cacheKey = CacheKeys.search(JSON.stringify({ filters, options }));
    
    try {
      // Try to get from cache first
      const cached = await cacheManager.get<SearchResult>(cacheKey);
      if (cached) {
        logger.debug('Returning cached search results');
        return cached;
      }

      const page = Math.max(1, options.page || 1);
      const limit = Math.min(100, Math.max(1, options.limit || 20));
      const offset = (page - 1) * limit;

      // Build the base query
      let query = db
        .select({
          cruise: cruises,
          cruiseLine: cruiseLines,
          ship: ships,
          embarkPort: {
            id: sql<number>`embark_port.id`,
            name: sql<string>`embark_port.name`,
          },
          disembarkPort: {
            id: sql<number>`disembark_port.id`,
            name: sql<string>`disembark_port.name`,
          },
          cheapestPrice: cheapestPricing,
        })
        .from(cruises)
        .leftJoin(cruiseLines, eq(cruises.cruiseLineId, cruiseLines.id))
        .leftJoin(ships, eq(cruises.shipId, ships.id))
        .leftJoin(ports.as('embark_port'), eq(cruises.embarkPortId, sql`embark_port.id`))
        .leftJoin(ports.as('disembark_port'), eq(cruises.disembarkPortId, sql`disembark_port.id`))
        .leftJoin(cheapestPricing, eq(cruises.id, cheapestPricing.cruiseId))
        .where(and(
          eq(cruises.isActive, true),
          eq(cruises.showCruise, true),
          // Only show future cruises
          gte(cruises.sailingDate, new Date().toISOString().split('T')[0])
        ));

      // Apply filters
      const whereConditions = [
        eq(cruises.isActive, true),
        eq(cruises.showCruise, true),
        gte(cruises.sailingDate, new Date().toISOString().split('T')[0])
      ];

      if (filters.cruiseLine) {
        whereConditions.push(eq(cruises.cruiseLineId, filters.cruiseLine));
      }

      if (filters.ship) {
        whereConditions.push(eq(cruises.shipId, filters.ship));
      }

      if (filters.departurePort) {
        // Support both ID and name search for departure port
        if (isNaN(Number(filters.departurePort))) {
          // Search by port name
          whereConditions.push(
            or(
              like(sql`embark_port.name`, `%${filters.departurePort}%`),
              like(sql`disembark_port.name`, `%${filters.departurePort}%`)
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
        // Search in the portIds JSON array
        whereConditions.push(
          sql`${cruises.portIds}::jsonb ?| array[${filters.ports.map(id => `'${id}'`).join(',')}]`
        );
      }

      // Apply pricing filters
      if (filters.price?.min || filters.price?.max) {
        if (filters.price.min) {
          whereConditions.push(gte(cheapestPricing.cheapestPrice, filters.price.min.toString()));
        }
        if (filters.price.max) {
          whereConditions.push(lte(cheapestPricing.cheapestPrice, filters.price.max.toString()));
        }
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

      // Apply sorting
      const sortBy = options.sortBy || 'price';
      const sortOrder = options.sortOrder || 'asc';

      switch (sortBy) {
        case 'price':
          query = sortOrder === 'desc' 
            ? query.orderBy(desc(cheapestPricing.cheapestPrice))
            : query.orderBy(asc(cheapestPricing.cheapestPrice));
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
        default:
          query = query.orderBy(asc(cheapestPricing.cheapestPrice));
      }

      // Get total count (before pagination)
      const countQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(cruises)
        .leftJoin(cruiseLines, eq(cruises.cruiseLineId, cruiseLines.id))
        .leftJoin(ships, eq(cruises.shipId, ships.id))
        .leftJoin(ports.as('embark_port'), eq(cruises.embarkPortId, sql`embark_port.id`))
        .leftJoin(ports.as('disembark_port'), eq(cruises.disembarkPortId, sql`disembark_port.id`))
        .leftJoin(cheapestPricing, eq(cruises.id, cheapestPricing.cruiseId))
        .where(and(...whereConditions));

      const [totalResult, results] = await Promise.all([
        countQuery.execute(),
        query.limit(limit).offset(offset).execute()
      ]);

      const total = totalResult[0]?.count || 0;
      const totalPages = Math.ceil(total / limit);

      // Transform results to the expected format
      const cruiseResults: CruiseSearchResult[] = await Promise.all(
        results.map(async (row) => this.transformCruiseResult(row))
      );

      // Get search filters
      const searchFilters = await this.getSearchFilters();

      const result: SearchResult = {
        cruises: cruiseResults,
        filters: searchFilters,
        meta: {
          page,
          limit,
          total,
          totalPages,
        },
      };

      // Cache the result
      await cacheManager.set(cacheKey, result, 3600); // Cache for 1 hour

      logger.info(`Search completed: ${total} results found, page ${page}/${totalPages}`);
      return result;

    } catch (error) {
      logger.error('Search failed:', error);
      throw error;
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
    const portIds = Array.isArray(cruise.portIds) ? cruise.portIds : JSON.parse(cruise.portIds || '[]');
    const regionIds = Array.isArray(cruise.regionIds) ? cruise.regionIds : JSON.parse(cruise.regionIds || '[]');

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
        logoUrl: cruiseLine?.logoUrl,
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
        currency: cruise.currency || 'USD',
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
      const portsResult = await db
        .select({ name: ports.name })
        .from(ports)
        .where(inArray(ports.id, portIds));

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
      const regionsResult = await db
        .select({ name: regions.name })
        .from(regions)
        .where(inArray(regions.id, regionIds));

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

      // Get active cruise lines
      const cruiseLinesResult = await db
        .select({
          id: cruiseLines.id,
          name: cruiseLines.name,
          count: sql<number>`count(${cruises.id})`,
        })
        .from(cruiseLines)
        .leftJoin(cruises, and(
          eq(cruises.cruiseLineId, cruiseLines.id),
          eq(cruises.isActive, true),
          gte(cruises.sailingDate, new Date().toISOString().split('T')[0])
        ))
        .where(eq(cruiseLines.isActive, true))
        .groupBy(cruiseLines.id, cruiseLines.name)
        .having(sql`count(${cruises.id}) > 0`)
        .orderBy(cruiseLines.name);

      // Get ships with cruise counts
      const shipsResult = await db
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
        .orderBy(ships.name);

      // Get departure ports
      const departurePortsResult = await db
        .select({
          id: ports.id,
          name: ports.name,
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
        .groupBy(ports.id, ports.name)
        .having(sql`count(${cruises.id}) > 0`)
        .orderBy(ports.name);

      // Get ranges
      const rangesResult = await db
        .select({
          minNights: sql<number>`min(${cruises.nights})`,
          maxNights: sql<number>`max(${cruises.nights})`,
          minPrice: sql<number>`min(${cheapestPricing.cheapestPrice}::numeric)`,
          maxPrice: sql<number>`max(${cheapestPricing.cheapestPrice}::numeric)`,
          minDate: sql<string>`min(${cruises.sailingDate})`,
          maxDate: sql<string>`max(${cruises.sailingDate})`,
        })
        .from(cruises)
        .leftJoin(cheapestPricing, eq(cruises.id, cheapestPricing.cruiseId))
        .where(and(
          eq(cruises.isActive, true),
          gte(cruises.sailingDate, new Date().toISOString().split('T')[0])
        ));

      const ranges = rangesResult[0] || {};

      const filters: SearchFiltersResponse = {
        cruiseLines: cruiseLinesResult.map(cl => ({
          id: cl.id,
          name: cl.name,
          count: cl.count,
        })),
        ships: shipsResult.map(s => ({
          id: s.id,
          name: s.name,
          cruiseLineId: s.cruiseLineId,
          count: s.count,
        })),
        destinations: [], // TODO: Implement destination aggregation
        departurePorts: departurePortsResult.map(p => ({
          id: p.id,
          name: p.name,
          count: p.count,
        })),
        nightsRange: {
          min: ranges.minNights || 1,
          max: ranges.maxNights || 30,
        },
        priceRange: {
          min: ranges.minPrice || 0,
          max: ranges.maxPrice || 10000,
        },
        sailingDateRange: {
          min: ranges.minDate || new Date().toISOString().split('T')[0],
          max: ranges.maxDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        },
      };

      // Cache for 4 hours
      await cacheManager.set(cacheKey, filters, 14400);

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

      // Get popular cruises (for now, just get cheapest with good ratings)
      const results = await db
        .select({
          cruise: cruises,
          cruiseLine: cruiseLines,
          ship: ships,
          embarkPort: {
            id: sql<number>`embark_port.id`,
            name: sql<string>`embark_port.name`,
          },
          disembarkPort: {
            id: sql<number>`disembark_port.id`,
            name: sql<string>`disembark_port.name`,
          },
          cheapestPrice: cheapestPricing,
        })
        .from(cruises)
        .leftJoin(cruiseLines, eq(cruises.cruiseLineId, cruiseLines.id))
        .leftJoin(ships, eq(cruises.shipId, ships.id))
        .leftJoin(ports.as('embark_port'), eq(cruises.embarkPortId, sql`embark_port.id`))
        .leftJoin(ports.as('disembark_port'), eq(cruises.disembarkPortId, sql`disembark_port.id`))
        .leftJoin(cheapestPricing, eq(cruises.id, cheapestPricing.cruiseId))
        .where(and(
          eq(cruises.isActive, true),
          eq(cruises.showCruise, true),
          gte(cruises.sailingDate, new Date().toISOString().split('T')[0])
        ))
        .orderBy(asc(cheapestPricing.cheapestPrice), desc(ships.rating))
        .limit(limit);

      const popularCruises = await Promise.all(
        results.map(row => this.transformCruiseResult(row))
      );

      // Cache for 2 hours
      await cacheManager.set(cacheKey, popularCruises, 7200);

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
  }>> {
    if (!query || query.length < 2) return [];

    const cacheKey = CacheKeys.searchSuggestions(query, limit);

    try {
      const cached = await cacheManager.get<Array<{
        type: string;
        value: string;
        label: string;
        count?: number;
      }>>(cacheKey);
      if (cached) {
        return cached;
      }

      const suggestions: Array<{
        type: string;
        value: string;
        label: string;
        count?: number;
      }> = [];

      // Search cruise lines
      const cruiseLineResults = await db
        .select({ id: cruiseLines.id, name: cruiseLines.name })
        .from(cruiseLines)
        .where(and(
          like(cruiseLines.name, `%${query}%`),
          eq(cruiseLines.isActive, true)
        ))
        .limit(5);

      suggestions.push(...cruiseLineResults.map(cl => ({
        type: 'cruise-line',
        value: cl.id.toString(),
        label: cl.name,
      })));

      // Search ports
      const portResults = await db
        .select({ id: ports.id, name: ports.name })
        .from(ports)
        .where(and(
          like(ports.name, `%${query}%`),
          eq(ports.isActive, true)
        ))
        .limit(5);

      suggestions.push(...portResults.map(p => ({
        type: 'port',
        value: p.id.toString(),
        label: p.name,
      })));

      // Search regions
      const regionResults = await db
        .select({ id: regions.id, name: regions.name })
        .from(regions)
        .where(and(
          like(regions.name, `%${query}%`),
          eq(regions.isActive, true)
        ))
        .limit(5);

      suggestions.push(...regionResults.map(r => ({
        type: 'region',
        value: r.id.toString(),
        label: r.name,
      })));

      // Cache for 30 minutes
      await cacheManager.set(cacheKey, suggestions, 1800);

      return suggestions.slice(0, limit);

    } catch (error) {
      logger.error('Failed to get search suggestions:', error);
      return [];
    }
  }
}

// Singleton instance
export const searchService = new SearchService();