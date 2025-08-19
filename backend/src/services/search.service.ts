import { and, or, eq, gte, lte, ilike, sql, desc, asc, inArray, isNotNull } from 'drizzle-orm';
import { BaseService } from './base.service';
import { 
  cruises, 
  ships, 
  cruiseLines, 
  ports, 
  regions, 
  cheapestPricing,
  pricing,
} from '../db/schema';
import { 
  CruiseSearchParams, 
  CruiseSearchResult, 
  CruiseListItem, 
  SearchFilters,
  FilterOption,
  PricingSummary
} from '../types/api.types';
import { CACHE_KEYS } from '../cache/cache-keys';
import logger from '../config/logger';

interface PopularDestination {
  id: number;
  name: string;
  cruiseCount: number;
  averagePrice: number;
  image?: string;
}

interface SearchSuggestion {
  type: 'port' | 'ship' | 'cruiseline' | 'region';
  id: number;
  name: string;
  subtitle?: string;
}

export class SearchService extends BaseService {
  /**
   * Search cruises with advanced filters using the cheapest_pricing table
   */
  async searchCruises(params: CruiseSearchParams): Promise<CruiseSearchResult> {
    const cacheKey = CACHE_KEYS.SEARCH_RESULTS(JSON.stringify(params));
    const cacheTTL = 30 * 60; // 30 minutes

    return this.getFromCacheOrDb(cacheKey, async () => {
      this.log('info', 'Executing cruise search', { params });

      // Build WHERE conditions
      const conditions = this.buildSearchConditions(params);
      
      // Build sort order
      const orderBy = this.buildSortOrder(params);

      // Calculate offset for pagination
      const offset = (params.page - 1) * params.limit;

      // Execute the main search query
      const searchQuery = this.db
        .select({
          // Cruise basic info
          id: cruises.id,
          name: cruises.name,
          sailingDate: cruises.sailingDate,
          returnDate: cruises.returnDate,
          nights: cruises.nights,
          
          // Cruise line info
          cruiseLineId: cruiseLines.id,
          cruiseLineName: cruiseLines.name,
          cruiseLineLogoUrl: cruiseLines.logoUrl,
          
          // Ship info
          shipId: ships.id,
          shipName: ships.name,
          shipImageUrl: ships.defaultImageUrl,
          
          // Port info
          embarkPortId: ports.id,
          embarkPortName: ports.name,
          embarkPortCity: ports.city,
          embarkPortCountry: ports.country,
          
          disembarkPortId: sql<number>`dp.id`,
          disembarkPortName: sql<string>`dp.name`,
          disembarkPortCity: sql<string>`dp.city`,
          disembarkPortCountry: sql<string>`dp.country`,
          
          // Region and port arrays
          regionIds: cruises.regionIds,
          portIds: cruises.portIds,
          
          // Pricing from cheapest_pricing table
          cheapestPrice: cheapestPricing.cheapestPrice,
          cheapestCabinType: cheapestPricing.cheapestCabinType,
          cheapestTaxes: cheapestPricing.cheapestTaxes,
          cheapestFuel: cheapestPricing.cheapestFuel,
          
          interiorPrice: cheapestPricing.interiorPrice,
          interiorTaxes: cheapestPricing.interiorTaxes,
          
          oceanviewPrice: cheapestPricing.oceanviewPrice,
          oceanviewTaxes: cheapestPricing.oceanviewTaxes,
          
          balconyPrice: cheapestPricing.balconyPrice,
          balconyTaxes: cheapestPricing.balconyTaxes,
          
          suitePrice: cheapestPricing.suitePrice,
          suiteTaxes: cheapestPricing.suiteTaxes,
          
          currency: cheapestPricing.currency,
        })
        .from(cruises)
        .innerJoin(cruiseLines, eq(cruises.cruiseLineId, cruiseLines.id))
        .innerJoin(ships, eq(cruises.shipId, ships.id))
        .leftJoin(ports, eq(cruises.embarkPortId, ports.id))
        .leftJoin(sql`ports dp`, sql`${cruises.disembarkPortId} = dp.id`)
        .leftJoin(cheapestPricing, eq(cruises.id, cheapestPricing.cruiseId))
        .where(and(...conditions))
        .orderBy(...orderBy)
        .limit(params.limit)
        .offset(offset);

      // Execute search and count queries in parallel
      const [searchResults, countResult] = await Promise.all([
        searchQuery,
        this.db
          .select({ count: sql<number>`count(*)` })
          .from(cruises)
          .innerJoin(cruiseLines, eq(cruises.cruiseLineId, cruiseLines.id))
          .innerJoin(ships, eq(cruises.shipId, ships.id))
          .leftJoin(ports, eq(cruises.embarkPortId, ports.id))
          .leftJoin(cheapestPricing, eq(cruises.id, cheapestPricing.cruiseId))
          .where(and(...conditions)),
      ]);

      const totalCount = countResult[0]?.count || 0;
      const totalPages = Math.ceil(totalCount / params.limit);

      // Transform results to API format
      const cruiseItems: CruiseListItem[] = await this.transformSearchResults(searchResults);

      // Get available filters for the current search context
      const filters = await this.getAvailableFilters();

      return {
        cruises: cruiseItems,
        filters,
        meta: {
          page: params.page,
          limit: params.limit,
          total: totalCount,
          totalPages,
          hasNext: params.page < totalPages,
          hasPrevious: params.page > 1,
        },
      };
    }, cacheTTL);
  }

  /**
   * Get available filter options
   */
  async getAvailableFilters(): Promise<SearchFilters> {
    const cacheKey = CACHE_KEYS.SEARCH_FILTERS;
    const cacheTTL = 6 * 60 * 60; // 6 hours

    return this.getFromCacheOrDb(cacheKey, async () => {
      this.log('info', 'Getting available search filters');

      const [
        cruiseLineFilters,
        shipFilters,
        destinationFilters,
        departurePortFilters,
        nightsRange,
        priceRange,
        sailingDateRange,
      ] = await Promise.all([
        this.getCruiseLineFilters(),
        this.getShipFilters(),
        this.getDestinationFilters(),
        this.getDeparturePortFilters(),
        this.getNightsRange(),
        this.getPriceRange(),
        this.getSailingDateRange(),
      ]);

      return {
        cruiseLines: cruiseLineFilters,
        ships: shipFilters,
        destinations: destinationFilters,
        departurePorts: departurePortFilters,
        nightsRange,
        priceRange,
        sailingDateRange,
      };
    }, cacheTTL);
  }

  /**
   * Get popular destinations
   */
  async getPopularDestinations(): Promise<PopularDestination[]> {
    const cacheKey = CACHE_KEYS.POPULAR_DESTINATIONS;
    const cacheTTL = 6 * 60 * 60; // 6 hours

    return this.getFromCacheOrDb(cacheKey, async () => {
      this.log('info', 'Getting popular destinations');

      // Get regions with the most cruises and their average prices
      const popularRegions = await this.db
        .select({
          regionId: sql<number>`unnest(${cruises.regionIds}::int[])`,
          cruiseCount: sql<number>`count(*)`,
          averagePrice: sql<number>`avg(${cheapestPricing.cheapestPrice})`,
        })
        .from(cruises)
        .leftJoin(cheapestPricing, eq(cruises.id, cheapestPricing.cruiseId))
        .where(and(
          eq(cruises.showCruise, true),
          gte(cruises.sailingDate, new Date())
        ))
        .groupBy(sql`unnest(${cruises.regionIds}::int[])`)
        .having(sql`count(*) >= 10`) // Only regions with at least 10 cruises
        .orderBy(desc(sql`count(*)`))
        .limit(20);

      // Get region names
      const regionIds = popularRegions.map(r => r.regionId);
      const regionNames = await this.db
        .select({
          id: regions.id,
          name: regions.name,
        })
        .from(regions)
        .where(inArray(regions.id, regionIds));

      const regionMap = new Map(regionNames.map(r => [r.id, r.name]));

      return popularRegions.map(region => ({
        id: region.regionId,
        name: regionMap.get(region.regionId) || `Region ${region.regionId}`,
        cruiseCount: region.cruiseCount,
        averagePrice: Math.round(region.averagePrice || 0),
      }));
    }, cacheTTL);
  }

  /**
   * Get search suggestions based on query
   */
  async getSuggestions(query: string): Promise<SearchSuggestion[]> {
    const cacheKey = CACHE_KEYS.SEARCH_SUGGESTIONS(query);
    const cacheTTL = 60 * 60; // 1 hour

    return this.getFromCacheOrDb(cacheKey, async () => {
      this.log('info', 'Getting search suggestions', { query });

      const searchTerm = `%${query}%`;
      
      const [portSuggestions, shipSuggestions, cruiseLineSuggestions] = await Promise.all([
        // Port suggestions
        this.db
          .select({
            id: ports.id,
            name: ports.name,
            subtitle: sql<string>`COALESCE(${ports.city} || ', ' || ${ports.country}, ${ports.country})`,
          })
          .from(ports)
          .where(or(
            ilike(ports.name, searchTerm),
            ilike(ports.city, searchTerm),
            ilike(ports.country, searchTerm)
          ))
          .limit(10),

        // Ship suggestions
        this.db
          .select({
            id: ships.id,
            name: ships.name,
            subtitle: cruiseLines.name,
          })
          .from(ships)
          .innerJoin(cruiseLines, eq(ships.cruiseLineId, cruiseLines.id))
          .where(ilike(ships.name, searchTerm))
          .limit(10),

        // Cruise line suggestions
        this.db
          .select({
            id: cruiseLines.id,
            name: cruiseLines.name,
            subtitle: sql<string>`null`,
          })
          .from(cruiseLines)
          .where(ilike(cruiseLines.name, searchTerm))
          .limit(10),
      ]);

      const suggestions: SearchSuggestion[] = [
        ...portSuggestions.map(p => ({
          type: 'port' as const,
          id: p.id,
          name: p.name,
          subtitle: p.subtitle,
        })),
        ...shipSuggestions.map(s => ({
          type: 'ship' as const,
          id: s.id,
          name: s.name,
          subtitle: s.subtitle,
        })),
        ...cruiseLineSuggestions.map(cl => ({
          type: 'cruiseline' as const,
          id: cl.id,
          name: cl.name,
          subtitle: cl.subtitle,
        })),
      ];

      // Sort by relevance (exact matches first)
      return suggestions.sort((a, b) => {
        const aExact = a.name.toLowerCase().startsWith(query.toLowerCase());
        const bExact = b.name.toLowerCase().startsWith(query.toLowerCase());
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        return 0;
      });
    }, cacheTTL);
  }

  // Private helper methods

  private buildSearchConditions(params: CruiseSearchParams) {
    const conditions = [
      eq(cruises.showCruise, true),
      eq(cruises.isActive, true),
    ];

    // Date filters
    if (params.sailingDateFrom) {
      conditions.push(gte(cruises.sailingDate, new Date(params.sailingDateFrom)));
    }
    if (params.sailingDateTo) {
      conditions.push(lte(cruises.sailingDate, new Date(params.sailingDateTo)));
    }

    // Duration filters
    if (params.minNights) {
      conditions.push(gte(cruises.nights, params.minNights));
    }
    if (params.maxNights) {
      conditions.push(lte(cruises.nights, params.maxNights));
    }

    // Price filters (using cheapest pricing)
    if (params.minPrice) {
      conditions.push(gte(cheapestPricing.cheapestPrice, params.minPrice));
    }
    if (params.maxPrice) {
      conditions.push(lte(cheapestPricing.cheapestPrice, params.maxPrice));
    }

    // Cabin type filter
    if (params.cabinType) {
      switch (params.cabinType) {
        case 'interior':
          conditions.push(isNotNull(cheapestPricing.interiorPrice));
          break;
        case 'oceanview':
          conditions.push(isNotNull(cheapestPricing.oceanviewPrice));
          break;
        case 'balcony':
          conditions.push(isNotNull(cheapestPricing.balconyPrice));
          break;
        case 'suite':
          conditions.push(isNotNull(cheapestPricing.suitePrice));
          break;
      }
    }

    // Search query filter
    if (params.q) {
      const searchTerm = `%${params.q}%`;
      conditions.push(or(
        ilike(cruises.name, searchTerm),
        ilike(ships.name, searchTerm),
        ilike(cruiseLines.name, searchTerm),
        ilike(ports.name, searchTerm)
      ));
    }

    // Specific filters
    if (params.cruiseLine) {
      conditions.push(eq(cruiseLines.id, parseInt(params.cruiseLine)));
    }
    if (params.ship) {
      conditions.push(eq(ships.id, parseInt(params.ship)));
    }
    if (params.departurePort) {
      conditions.push(eq(ports.id, parseInt(params.departurePort)));
    }

    return conditions;
  }

  private buildSortOrder(params: CruiseSearchParams) {
    const sortColumn = (() => {
      switch (params.sortBy) {
        case 'price':
          return cheapestPricing.cheapestPrice;
        case 'date':
          return cruises.sailingDate;
        case 'nights':
          return cruises.nights;
        case 'name':
          return cruises.name;
        default:
          return cheapestPricing.cheapestPrice;
      }
    })();

    return [params.sortOrder === 'desc' ? desc(sortColumn) : asc(sortColumn)];
  }

  private async transformSearchResults(results: any[]): Promise<CruiseListItem[]> {
    // Get all region IDs from results to batch fetch region names
    const allRegionIds = new Set<number>();
    results.forEach(result => {
      if (result.regionIds && Array.isArray(result.regionIds)) {
        result.regionIds.forEach((id: number) => allRegionIds.add(id));
      }
    });

    const regionNames = await this.db
      .select({
        id: regions.id,
        name: regions.name,
      })
      .from(regions)
      .where(inArray(regions.id, Array.from(allRegionIds)));

    const regionMap = new Map(regionNames.map(r => [r.id, r.name]));

    return results.map(result => ({
      id: result.id,
      name: result.name,
      cruiseLine: {
        id: result.cruiseLineId,
        name: result.cruiseLineName,
        logoUrl: result.cruiseLineLogoUrl,
      },
      ship: {
        id: result.shipId,
        name: result.shipName,
        imageUrl: result.shipImageUrl,
      },
      sailingDate: result.sailingDate,
      returnDate: result.returnDate,
      nights: result.nights,
      embarkPort: {
        id: result.embarkPortId,
        name: result.embarkPortName,
        city: result.embarkPortCity,
        country: result.embarkPortCountry,
      },
      disembarkPort: {
        id: result.disembarkPortId,
        name: result.disembarkPortName,
        city: result.disembarkPortCity,
        country: result.disembarkPortCountry,
      },
      regions: (result.regionIds || []).map((id: number) => ({
        id,
        name: regionMap.get(id) || `Region ${id}`,
      })),
      pricing: {
        cheapest: result.cheapestPrice ? {
          basePrice: parseFloat(result.cheapestPrice),
          totalPrice: parseFloat(result.cheapestPrice) + parseFloat(result.cheapestTaxes || '0') + parseFloat(result.cheapestFuel || '0'),
          taxes: parseFloat(result.cheapestTaxes || '0'),
          fees: parseFloat(result.cheapestFuel || '0'),
          currency: result.currency || 'USD',
          rateName: result.cheapestCabinType,
          perPerson: true,
        } : undefined,
        interior: result.interiorPrice ? {
          basePrice: parseFloat(result.interiorPrice),
          totalPrice: parseFloat(result.interiorPrice) + parseFloat(result.interiorTaxes || '0'),
          taxes: parseFloat(result.interiorTaxes || '0'),
          fees: 0,
          currency: result.currency || 'USD',
          perPerson: true,
        } : undefined,
        oceanview: result.oceanviewPrice ? {
          basePrice: parseFloat(result.oceanviewPrice),
          totalPrice: parseFloat(result.oceanviewPrice) + parseFloat(result.oceanviewTaxes || '0'),
          taxes: parseFloat(result.oceanviewTaxes || '0'),
          fees: 0,
          currency: result.currency || 'USD',
          perPerson: true,
        } : undefined,
        balcony: result.balconyPrice ? {
          basePrice: parseFloat(result.balconyPrice),
          totalPrice: parseFloat(result.balconyPrice) + parseFloat(result.balconyTaxes || '0'),
          taxes: parseFloat(result.balconyTaxes || '0'),
          fees: 0,
          currency: result.currency || 'USD',
          perPerson: true,
        } : undefined,
        suite: result.suitePrice ? {
          basePrice: parseFloat(result.suitePrice),
          totalPrice: parseFloat(result.suitePrice) + parseFloat(result.suiteTaxes || '0'),
          taxes: parseFloat(result.suiteTaxes || '0'),
          fees: 0,
          currency: result.currency || 'USD',
          perPerson: true,
        } : undefined,
      },
      availability: true, // This would come from inventory management
      highlights: [], // This would come from cruise-specific highlights
    }));
  }

  private async getCruiseLineFilters(): Promise<FilterOption[]> {
    const result = await this.db
      .select({
        id: cruiseLines.id,
        name: cruiseLines.name,
        count: sql<number>`count(${cruises.id})`,
      })
      .from(cruiseLines)
      .innerJoin(cruises, and(
        eq(cruises.cruiseLineId, cruiseLines.id),
        eq(cruises.showCruise, true),
        eq(cruises.isActive, true)
      ))
      .groupBy(cruiseLines.id, cruiseLines.name)
      .orderBy(cruiseLines.name);

    return result.map(item => ({
      value: item.id,
      label: item.name,
      count: item.count,
    }));
  }

  private async getShipFilters(): Promise<FilterOption[]> {
    const result = await this.db
      .select({
        id: ships.id,
        name: ships.name,
        cruiseLineName: cruiseLines.name,
        count: sql<number>`count(${cruises.id})`,
      })
      .from(ships)
      .innerJoin(cruiseLines, eq(ships.cruiseLineId, cruiseLines.id))
      .innerJoin(cruises, and(
        eq(cruises.shipId, ships.id),
        eq(cruises.showCruise, true),
        eq(cruises.isActive, true)
      ))
      .groupBy(ships.id, ships.name, cruiseLines.name)
      .orderBy(ships.name);

    return result.map(item => ({
      value: item.id,
      label: `${item.name} (${item.cruiseLineName})`,
      count: item.count,
    }));
  }

  private async getDestinationFilters(): Promise<FilterOption[]> {
    const result = await this.db
      .select({
        id: regions.id,
        name: regions.name,
        count: sql<number>`count(${cruises.id})`,
      })
      .from(regions)
      .innerJoin(sql`unnest(${cruises.regionIds}::int[]) AS region_id(id)`, sql`${regions.id} = region_id.id`)
      .innerJoin(cruises, and(
        eq(cruises.showCruise, true),
        eq(cruises.isActive, true)
      ))
      .groupBy(regions.id, regions.name)
      .orderBy(regions.name);

    return result.map(item => ({
      value: item.id,
      label: item.name,
      count: item.count,
    }));
  }

  private async getDeparturePortFilters(): Promise<FilterOption[]> {
    const result = await this.db
      .select({
        id: ports.id,
        name: ports.name,
        city: ports.city,
        country: ports.country,
        count: sql<number>`count(${cruises.id})`,
      })
      .from(ports)
      .innerJoin(cruises, and(
        eq(cruises.embarkPortId, ports.id),
        eq(cruises.showCruise, true),
        eq(cruises.isActive, true)
      ))
      .groupBy(ports.id, ports.name, ports.city, ports.country)
      .orderBy(ports.name);

    return result.map(item => ({
      value: item.id,
      label: item.city ? `${item.name}, ${item.city}` : item.name,
      count: item.count,
    }));
  }

  private async getNightsRange() {
    const result = await this.db
      .select({
        min: sql<number>`min(${cruises.nights})`,
        max: sql<number>`max(${cruises.nights})`,
      })
      .from(cruises)
      .where(and(
        eq(cruises.showCruise, true),
        eq(cruises.isActive, true)
      ));

    return {
      min: result[0]?.min || 1,
      max: result[0]?.max || 365,
    };
  }

  private async getPriceRange() {
    const result = await this.db
      .select({
        min: sql<number>`min(${cheapestPricing.cheapestPrice})`,
        max: sql<number>`max(${cheapestPricing.cheapestPrice})`,
      })
      .from(cheapestPricing)
      .innerJoin(cruises, and(
        eq(cruises.id, cheapestPricing.cruiseId),
        eq(cruises.showCruise, true),
        eq(cruises.isActive, true)
      ));

    return {
      min: Math.floor(result[0]?.min || 0),
      max: Math.ceil(result[0]?.max || 10000),
    };
  }

  private async getSailingDateRange() {
    const result = await this.db
      .select({
        min: sql<string>`min(${cruises.sailingDate})`,
        max: sql<string>`max(${cruises.sailingDate})`,
      })
      .from(cruises)
      .where(and(
        eq(cruises.showCruise, true),
        eq(cruises.isActive, true)
      ));

    return {
      min: result[0]?.min || new Date().toISOString().split('T')[0],
      max: result[0]?.max || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    };
  }
}