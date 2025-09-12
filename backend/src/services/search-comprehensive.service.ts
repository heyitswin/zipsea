/**
 * Comprehensive search service with all filtering capabilities
 * Supports filtering by cruise line, departure month, region, port, and more
 * Optimized for performance with proper indexing and caching
 */

import { db } from '../db/connection';
import { cruises, cruiseLines, ships, ports, regions, cheapestPricing } from '../db/schema';
import { sql, eq, and, or, inArray, gte, lte, like, desc, asc, isNotNull } from 'drizzle-orm';
import logger from '../config/logger';
import { cacheManager } from '../cache/cache-manager';
import { CacheKeys } from '../cache/cache-keys';

export interface ComprehensiveSearchFilters {
  // Text search
  q?: string; // General search query

  // Date filters
  departureMonth?: string | string[]; // Format: YYYY-MM, can be multiple
  startDate?: string; // Format: YYYY-MM-DD
  endDate?: string; // Format: YYYY-MM-DD

  // Location filters
  cruiseLineId?: number | number[];
  shipId?: number | number[];
  departurePortId?: number | number[];
  arrivalPortId?: number | number[];
  regionId?: number | number[];

  // Trip characteristics
  minNights?: number;
  maxNights?: number;
  nights?: number; // Exact nights

  // Price filters
  minPrice?: number;
  maxPrice?: number;
  currency?: string;

  // Cabin filters
  cabinType?: string | string[];

  // Other
  passengers?: number;
  includeUnavailable?: boolean;
}

export interface SearchOptions {
  page?: number;
  limit?: number;
  sortBy?: 'date' | 'price' | 'nights' | 'popularity';
  sortOrder?: 'asc' | 'desc';
  includeFacets?: boolean;
}

export class ComprehensiveSearchService {
  /**
   * Main comprehensive search endpoint
   */
  async searchCruises(filters: ComprehensiveSearchFilters = {}, options: SearchOptions = {}) {
    const startTime = Date.now();

    try {
      // Set defaults
      const page = options.page || 1;
      const limit = Math.min(options.limit || 20, 100);
      const offset = (page - 1) * limit;
      const sortBy = options.sortBy || 'date';
      const sortOrder = options.sortOrder || 'asc';

      // Generate cache key
      const cacheKey = CacheKeys.search(JSON.stringify({ filters, options }));

      // Try cache first (with short TTL for dynamic data)
      const cached = await cacheManager.get<any>(cacheKey);
      if (cached && !filters.includeUnavailable) {
        return {
          ...cached,
          meta: {
            ...cached.meta,
            searchTime: Date.now() - startTime,
            cacheHit: true,
          },
        };
      }

      // Build WHERE conditions
      // Set minimum departure date to today
      const today = new Date();
      const minDepartureDate = today.toISOString().split('T')[0];

      const conditions: any[] = [
        eq(cruises.isActive, true),
        gte(cruises.sailingDate, minDepartureDate),
        // Filter out cruises with no valid prices or prices <= $99
        sql`(
          LEAST(
            COALESCE(${cruises.interiorPrice}, 999999),
            COALESCE(${cruises.oceanviewPrice}, 999999),
            COALESCE(${cruises.balconyPrice}, 999999),
            COALESCE(${cruises.suitePrice}, 999999)
          ) > 99
          AND (
            ${cruises.interiorPrice} IS NOT NULL OR
            ${cruises.oceanviewPrice} IS NOT NULL OR
            ${cruises.balconyPrice} IS NOT NULL OR
            ${cruises.suitePrice} IS NOT NULL
          )
        )`,
      ];

      // Text search
      if (filters.q) {
        const searchPattern = `%${filters.q}%`;
        conditions.push(
          or(
            like(cruises.name, searchPattern),
            sql`${cruises.id} IN (
              SELECT c.id FROM cruises c
              LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
              LEFT JOIN ships s ON c.ship_id = s.id
              WHERE cl.name ILIKE ${searchPattern}
                 OR s.name ILIKE ${searchPattern}
            )`
          )
        );
      }

      // Date filters - handle multiple departure months
      if (filters.departureMonth) {
        const months = Array.isArray(filters.departureMonth)
          ? filters.departureMonth
          : [filters.departureMonth];

        const monthConditions = months.map(monthStr => {
          const [year, month] = monthStr.split('-');
          const startOfMonth = `${year}-${month}-01`;
          // Fix: JavaScript months are 0-indexed, but our month string is 1-indexed
          // So for "2025-09", we need new Date(2025, 9, 0) to get last day of September
          const endOfMonth = new Date(parseInt(year), parseInt(month), 0)
            .toISOString()
            .split('T')[0];
          logger.info(`Date filter for ${monthStr}: ${startOfMonth} to ${endOfMonth}`);
          return and(gte(cruises.sailingDate, startOfMonth), lte(cruises.sailingDate, endOfMonth));
        });

        if (monthConditions.length > 0) {
          conditions.push(or(...monthConditions));
        }
      }

      if (filters.startDate) {
        conditions.push(gte(cruises.sailingDate, filters.startDate));
      }

      if (filters.endDate) {
        conditions.push(lte(cruises.sailingDate, filters.endDate));
      }

      // Cruise line filter
      if (filters.cruiseLineId) {
        const lineIds = Array.isArray(filters.cruiseLineId)
          ? filters.cruiseLineId
          : [filters.cruiseLineId];
        logger.info('Applying cruise line filter:', { lineIds });
        conditions.push(inArray(cruises.cruiseLineId, lineIds));
      }

      // Ship filter
      if (filters.shipId) {
        const shipIds = Array.isArray(filters.shipId) ? filters.shipId : [filters.shipId];
        logger.info('Applying ship filter:', { shipIds });
        conditions.push(inArray(cruises.shipId, shipIds));
      }

      // Departure port filter
      if (filters.departurePortId) {
        const portIds = Array.isArray(filters.departurePortId)
          ? filters.departurePortId
          : [filters.departurePortId];
        logger.info('Applying departure port filter:', { portIds });
        conditions.push(inArray(cruises.embarkPortId, portIds));
      }

      // Arrival port filter
      if (filters.arrivalPortId) {
        const portIds = Array.isArray(filters.arrivalPortId)
          ? filters.arrivalPortId
          : [filters.arrivalPortId];
        logger.info('Applying arrival port filter:', { portIds });
        conditions.push(inArray(cruises.disembarkPortId, portIds));
      }

      // Region filter - handle comma-separated string in DB
      if (filters.regionId) {
        const regionIds = Array.isArray(filters.regionId) ? filters.regionId : [filters.regionId];
        logger.info('Applying region filter:', { regionIds });
        const regionConditions = regionIds.map(
          id =>
            sql`(
            ${cruises.regionIds} = ${id.toString()} OR
            ${cruises.regionIds} LIKE ${id + ',%'} OR
            ${cruises.regionIds} LIKE ${'%,' + id + ',%'} OR
            ${cruises.regionIds} LIKE ${'%,' + id}
          )`
        );
        if (regionConditions.length > 0) {
          conditions.push(or(...regionConditions));
        }
      }

      // Nights filters
      if (filters.nights) {
        conditions.push(eq(cruises.nights, filters.nights));
      } else {
        if (filters.minNights) {
          conditions.push(gte(cruises.nights, filters.minNights));
        }
        if (filters.maxNights) {
          conditions.push(lte(cruises.nights, filters.maxNights));
        }
      }

      // Build the main query - with JOINs for proper data
      let query = db
        .select({
          id: cruises.id,
          cruiseId: cruises.cruiseId,
          name: cruises.name,
          voyageCode: cruises.voyageCode,
          sailingDate: cruises.sailingDate,
          nights: cruises.nights,
          seaDays: cruises.seaDays,
          cruiseLineId: cruises.cruiseLineId,
          cruiseLineName: sql<string>`COALESCE(${cruiseLines.name}, 'Unknown')`,
          cruiseLineCode: sql<string>`COALESCE(${cruiseLines.code}, '')`,
          shipId: cruises.shipId,
          shipName: sql<string>`COALESCE(${ships.name}, 'Unknown')`,
          shipCode: sql<string>`COALESCE(${ships.code}, '')`,
          shipImage: sql<string>`COALESCE(${ships.defaultShipImage}, '')`,
          shipImage2k: sql<string>`COALESCE(${ships.defaultShipImage2k}, '')`,
          shipImageHd: sql<string>`COALESCE(${ships.defaultShipImageHd}, '')`,
          embarkPortId: cruises.embarkPortId,
          embarkPortName: sql<string>`COALESCE(${ports.name}, 'Unknown')`,
          disembarkPortId: cruises.disembarkPortId,
          disembarkPortName: sql<string>`COALESCE(dp.name, 'Unknown')`,
          regionIds: cruises.regionIds,
          portIds: cruises.portIds,
          // Pricing fields
          interiorPrice: cruises.interiorPrice,
          oceanviewPrice: cruises.oceanviewPrice,
          balconyPrice: cruises.balconyPrice,
          suitePrice: cruises.suitePrice,
          // Metadata
          createdAt: cruises.createdAt,
          updatedAt: cruises.updatedAt,
        })
        .from(cruises)
        .leftJoin(cruiseLines, eq(cruises.cruiseLineId, cruiseLines.id))
        .leftJoin(ships, eq(cruises.shipId, ships.id))
        .leftJoin(ports, eq(cruises.embarkPortId, ports.id))
        .leftJoin(sql`ports dp`, sql`dp.id = ${cruises.disembarkPortId}`)
        .where(and(...conditions));

      // Apply price filters if we have pricing data
      if (filters.minPrice || filters.maxPrice) {
        // Use LEAST to get minimum price across all cabin types
        const priceExpression = sql`LEAST(
          COALESCE(${cruises.interiorPrice}, 999999),
          COALESCE(${cruises.oceanviewPrice}, 999999),
          COALESCE(${cruises.balconyPrice}, 999999),
          COALESCE(${cruises.suitePrice}, 999999)
        )`;

        if (filters.minPrice) {
          query = query.where(sql`${priceExpression} >= ${filters.minPrice}`);
        }
        if (filters.maxPrice) {
          query = query.where(sql`${priceExpression} <= ${filters.maxPrice}`);
        }
      }

      // Apply sorting
      if (sortBy === 'price') {
        const priceExpression = sql`LEAST(
          COALESCE(${cruises.interiorPrice}, 999999),
          COALESCE(${cruises.oceanviewPrice}, 999999),
          COALESCE(${cruises.balconyPrice}, 999999),
          COALESCE(${cruises.suitePrice}, 999999)
        )`;
        query =
          sortOrder === 'desc'
            ? query.orderBy(desc(priceExpression))
            : query.orderBy(asc(priceExpression));
      } else if (sortBy === 'nights') {
        query =
          sortOrder === 'desc'
            ? query.orderBy(desc(cruises.nights))
            : query.orderBy(asc(cruises.nights));
      } else if (sortBy === 'popularity') {
        // Sort by a combination of factors
        query = query.orderBy(
          desc(isNotNull(cruises.interiorPrice)),
          asc(cruises.sailingDate),
          desc(cruises.nights)
        );
      } else {
        // Default to date sorting
        query =
          sortOrder === 'desc'
            ? query.orderBy(desc(cruises.sailingDate))
            : query.orderBy(asc(cruises.sailingDate));
      }

      // Apply pagination
      query = query.limit(limit).offset(offset);

      // Execute query with timeout
      logger.info('Executing database query...');
      const queryPromise = query;
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Database query timeout after 30s')), 30000)
      );

      let results;
      try {
        results = await Promise.race([queryPromise, timeoutPromise]);
        logger.info('Query executed successfully', { count: results.length });
      } catch (error: any) {
        logger.error('Query execution failed:', error);
        throw new Error(`Database query failed: ${error.message}`);
      }

      // Get total count for pagination
      const countQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(cruises)
        .leftJoin(cruiseLines, eq(cruises.cruiseLineId, cruiseLines.id))
        .leftJoin(ships, eq(cruises.shipId, ships.id))
        .where(and(...conditions));

      const [{ count }] = await countQuery;
      const total = Number(count);

      // Format results
      const formattedResults = results.map(cruise => ({
        id: cruise.id,
        cruiseId: cruise.cruiseId,
        name: cruise.name,
        voyageCode: cruise.voyageCode,
        sailingDate: cruise.sailingDate,
        returnDate: cruise.sailingDate
          ? new Date(
              new Date(cruise.sailingDate).getTime() + (cruise.nights || 0) * 24 * 60 * 60 * 1000
            )
              .toISOString()
              .split('T')[0]
          : null,
        nights: cruise.nights,
        seaDays: cruise.seaDays,
        cruiseLine: {
          id: cruise.cruiseLineId,
          name: cruise.cruiseLineName || 'Unknown',
          code: cruise.cruiseLineCode,
        },
        ship: {
          id: cruise.shipId,
          name: cruise.shipName || 'Unknown',
          code: cruise.shipCode,
          defaultShipImage: cruise.shipImage,
          defaultShipImage2k: cruise.shipImage2k,
          defaultShipImageHd: cruise.shipImageHd,
        },
        embarkPort: {
          id: cruise.embarkPortId,
          name: cruise.embarkPortName || 'Unknown',
        },
        disembarkPort: {
          id: cruise.disembarkPortId,
          name: cruise.disembarkPortName || 'Unknown',
        },
        pricing: {
          interior: cruise.interiorPrice ? parseFloat(cruise.interiorPrice) : null,
          oceanview: cruise.oceanviewPrice ? parseFloat(cruise.oceanviewPrice) : null,
          balcony: cruise.balconyPrice ? parseFloat(cruise.balconyPrice) : null,
          suite: cruise.suitePrice ? parseFloat(cruise.suitePrice) : null,
          currency: filters.currency || 'USD',
          lowestPrice:
            Math.min(
              ...[
                cruise.interiorPrice ? parseFloat(cruise.interiorPrice) : Infinity,
                cruise.oceanviewPrice ? parseFloat(cruise.oceanviewPrice) : Infinity,
                cruise.balconyPrice ? parseFloat(cruise.balconyPrice) : Infinity,
                cruise.suitePrice ? parseFloat(cruise.suitePrice) : Infinity,
              ].filter(p => p !== Infinity)
            ) || null,
        },

        regionIds: cruise.regionIds,
        portIds: cruise.portIds,
      }));

      // Get facets if requested
      let facets = null;
      if (options.includeFacets) {
        facets = await this.getSearchFacets(filters);
      }

      const response = {
        results: formattedResults,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: offset + results.length < total,
        },
        meta: {
          searchTime: Date.now() - startTime,
          cacheHit: false,
          filters: Object.keys(filters).filter(
            k => filters[k as keyof ComprehensiveSearchFilters] !== undefined
          ),
        },
        ...(facets && { facets }),
      };

      // Cache the response with 5 minute TTL
      await cacheManager.set(cacheKey, response, { ttl: 300 });

      return response;
    } catch (error) {
      logger.error('Comprehensive search failed:', error);
      throw error;
    }
  }

  /**
   * Get search facets for filtering UI
   */
  async getSearchFacets(currentFilters: ComprehensiveSearchFilters = {}) {
    try {
      const [cruiseLinesData, shipsData, departurePorts, regionsData, nightsRange, priceRange] =
        await Promise.all([
          // Get cruise lines with counts
          db
            .select({
              id: cruiseLines.id,
              name: cruiseLines.name,
              count: sql<number>`count(DISTINCT ${cruises.id})`,
            })
            .from(cruiseLines)
            .leftJoin(
              cruises,
              and(
                eq(cruises.cruiseLineId, cruiseLines.id),
                eq(cruises.isActive, true),
                gte(cruises.sailingDate, new Date().toISOString().split('T')[0])
              )
            )
            .where(eq(cruiseLines.isActive, true))
            .groupBy(cruiseLines.id, cruiseLines.name)
            .having(sql`count(${cruises.id}) > 0`)
            .orderBy(cruiseLines.name),

          // Get ships with counts
          db
            .select({
              id: ships.id,
              name: ships.name,
              cruiseLineId: ships.cruiseLineId,
              count: sql<number>`count(DISTINCT ${cruises.id})`,
            })
            .from(ships)
            .leftJoin(
              cruises,
              and(
                eq(cruises.shipId, ships.id),
                eq(cruises.isActive, true),
                gte(cruises.sailingDate, new Date().toISOString().split('T')[0])
              )
            )
            .where(eq(ships.isActive, true))
            .groupBy(ships.id, ships.name, ships.cruiseLineId)
            .having(sql`count(${cruises.id}) > 0`)
            .orderBy(ships.name),

          // Get departure ports with counts
          db
            .select({
              id: ports.id,
              name: ports.name,
              country: ports.country,
              count: sql<number>`count(DISTINCT ${cruises.id})`,
            })
            .from(ports)
            .leftJoin(
              cruises,
              and(
                eq(cruises.embarkPortId, ports.id),
                eq(cruises.isActive, true),
                gte(cruises.sailingDate, new Date().toISOString().split('T')[0])
              )
            )
            .where(eq(ports.isActive, true))
            .groupBy(ports.id, ports.name, ports.country)
            .having(sql`count(${cruises.id}) > 0`)
            .orderBy(desc(sql`count(${cruises.id})`), ports.name)
            .limit(20),

          // Get regions with counts
          db
            .select({
              id: regions.id,
              name: regions.name,
              count: sql<number>`count(DISTINCT ${cruises.id})`,
            })
            .from(regions)
            .leftJoin(
              cruises,
              and(
                sql`(
                ${cruises.regionIds} = ${regions.id}::text OR
                ${cruises.regionIds} LIKE ${regions.id}::text || ',%' OR
                ${cruises.regionIds} LIKE '%,' || ${regions.id}::text || ',%' OR
                ${cruises.regionIds} LIKE '%,' || ${regions.id}::text
              )`,
                eq(cruises.isActive, true),
                gte(cruises.sailingDate, new Date().toISOString().split('T')[0])
              )
            )
            .where(eq(regions.isActive, true))
            .groupBy(regions.id, regions.name)
            .having(sql`count(${cruises.id}) > 0`)
            .orderBy(regions.name),

          // Get nights range
          db
            .select({
              min: sql<number>`MIN(nights)`,
              max: sql<number>`MAX(nights)`,
            })
            .from(cruises)
            .where(
              and(
                eq(cruises.isActive, true),
                gte(cruises.sailingDate, new Date().toISOString().split('T')[0])
              )
            ),

          // Get price range
          db
            .select({
              min: sql<number>`MIN(LEAST(
              COALESCE(interior_price, 999999),
              COALESCE(oceanview_price, 999999),
              COALESCE(balcony_price, 999999),
              COALESCE(suite_price, 999999)
            ))`,
              max: sql<number>`MAX(GREATEST(
              COALESCE(interior_price, 0),
              COALESCE(oceanview_price, 0),
              COALESCE(balcony_price, 0),
              COALESCE(suite_price, 0)
            ))`,
            })
            .from(cruises)
            .where(
              and(
                eq(cruises.isActive, true),
                gte(cruises.sailingDate, new Date().toISOString().split('T')[0]),
                or(
                  isNotNull(cruises.interiorPrice),
                  isNotNull(cruises.oceanviewPrice),
                  isNotNull(cruises.balconyPrice),
                  isNotNull(cruises.suitePrice)
                )
              )
            ),
        ]);

      return {
        cruiseLines: cruiseLinesData,
        ships: shipsData,
        departurePorts,
        regions: regionsData,
        nightsRange: nightsRange[0] || { min: 1, max: 30 },
        priceRange: priceRange[0] || { min: 0, max: 10000 },
        cabinTypes: [
          { value: 'interior', label: 'Interior', available: true },
          { value: 'oceanview', label: 'Ocean View', available: true },
          { value: 'balcony', label: 'Balcony', available: true },
          { value: 'suite', label: 'Suite', available: true },
        ],
      };
    } catch (error) {
      logger.error('Failed to get search facets:', error);
      return null;
    }
  }

  /**
   * Get popular cruises
   */
  async getPopularCruises(limit = 10) {
    try {
      const results = await db
        .select({
          id: cruises.id,
          cruiseId: cruises.cruiseId,
          name: cruises.name,
          sailingDate: cruises.sailingDate,
          nights: cruises.nights,
          cruiseLineName: cruiseLines.name,
          shipName: ships.name,
          embarkPortName: sql<string>`ep.name`,
          interiorPrice: cruises.interiorPrice,
        })
        .from(cruises)
        .leftJoin(cruiseLines, eq(cruises.cruiseLineId, cruiseLines.id))
        .leftJoin(ships, eq(cruises.shipId, ships.id))
        .leftJoin(sql`ports ep`, sql`${cruises.embarkPortId} = ep.id`)
        .where(
          and(
            eq(cruises.isActive, true),
            gte(cruises.sailingDate, new Date().toISOString().split('T')[0]),
            isNotNull(cruises.interiorPrice)
          )
        )
        .orderBy(asc(cruises.sailingDate), asc(cruises.interiorPrice))
        .limit(limit);

      return results;
    } catch (error) {
      logger.error('Failed to get popular cruises:', error);
      throw error;
    }
  }

  /**
   * Get search suggestions for autocomplete
   */
  async getSuggestions(query: string, limit = 10) {
    if (!query || query.length < 2) {
      return [];
    }

    try {
      const searchPattern = `%${query}%`;

      const [shipSuggestions, portSuggestions, regionSuggestions] = await Promise.all([
        // Ship suggestions
        db
          .select({
            id: ships.id,
            name: ships.name,
            type: sql<string>`'ship'`,
          })
          .from(ships)
          .where(and(like(ships.name, searchPattern), eq(ships.isActive, true)))
          .limit(Math.ceil(limit / 3)),

        // Port suggestions
        db
          .select({
            id: ports.id,
            name: ports.name,
            type: sql<string>`'port'`,
          })
          .from(ports)
          .where(and(like(ports.name, searchPattern), eq(ports.isActive, true)))
          .limit(Math.ceil(limit / 3)),

        // Region suggestions
        db
          .select({
            id: regions.id,
            name: regions.name,
            type: sql<string>`'region'`,
          })
          .from(regions)
          .where(and(like(regions.name, searchPattern), eq(regions.isActive, true)))
          .limit(Math.ceil(limit / 3)),
      ]);

      return [...shipSuggestions, ...portSuggestions, ...regionSuggestions].slice(0, limit);
    } catch (error) {
      logger.error('Failed to get suggestions:', error);
      return [];
    }
  }
}

export const comprehensiveSearchService = new ComprehensiveSearchService();
