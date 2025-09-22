import { db } from '../db/connection';
import { sql } from 'drizzle-orm';
import logger from '../config/logger';
import { cacheManager } from '../cache/cache-manager';
import { CacheKeys } from '../cache/cache-keys';

/**
 * Simplified optimized search service
 * Uses Drizzle's sql template literal for safe parameterization
 */
export class SearchOptimizedSimpleService {
  /**
   * Main search endpoint - simplified and safe
   */
  async searchCruises(filters: any = {}, options: any = {}) {
    const startTime = Date.now();
    logger.info('SearchOptimizedSimple: searchCruises called', { filters, options });

    try {
      // Check if database is available
      if (!db) {
        logger.warn('Database not configured - returning mock data');
        return {
          cruises: [],
          meta: {
            page: options.page || 1,
            limit: Math.min(options.limit || 20, 100),
            total: 0,
            totalPages: 0,
            searchTime: Date.now() - startTime,
            cacheHit: false,
            mockData: true,
          },
        };
      }

      // Set defaults
      const limit = Math.min(options.limit || 20, 100);
      const offset = ((options.page || 1) - 1) * limit;

      // Try cache first
      const cacheKey = CacheKeys.search(JSON.stringify({ filters, options }));
      const cached = await cacheManager.get<any>(cacheKey);
      if (cached) {
        return {
          ...cached,
          meta: {
            ...(cached.meta || {}),
            searchTime: Date.now() - startTime,
            cacheHit: true,
          },
        };
      }

      // Build a VERY simple query without joins to avoid timeout
      let query = sql`
        SELECT
          c.id,
          c.name,
          c.sailing_date,
          c.nights,
          'Unknown' as cruise_line_name,
          'Unknown' as ship_name,
          'Unknown' as embark_port_name,
          'Unknown' as disembark_port_name,
          NULL as cheapest_price
        FROM cruises c
        WHERE c.is_active = true
          AND c.sailing_date >= CURRENT_DATE + INTERVAL '14 days'`;

      // Add filter conditions
      if (filters.cruiseLine) {
        const lineIds = Array.isArray(filters.cruiseLine)
          ? filters.cruiseLine
          : [filters.cruiseLine];
        query = sql`${query} AND c.cruise_line_id = ANY(${lineIds}::int[])`;
      }

      if (filters.nights?.min) {
        query = sql`${query} AND c.nights >= ${filters.nights.min}`;
      }

      if (filters.nights?.max) {
        query = sql`${query} AND c.nights <= ${filters.nights.max}`;
      }

      if (filters.price?.min) {
        query = sql`${query} AND cp.cheapest_price >= ${filters.price.min}`;
      }

      if (filters.price?.max) {
        query = sql`${query} AND cp.cheapest_price <= ${filters.price.max}`;
      }

      if (filters.q) {
        const searchTerm = `%${filters.q}%`;
        query = sql`${query} AND c.name ILIKE ${searchTerm}`;
      }

      // Add ordering
      const sortBy = options.sortBy || 'date';
      if (sortBy === 'price') {
        // Price sorting disabled until pricing data is synced
        query = sql`${query} ORDER BY c.sailing_date ASC`;
      } else if (sortBy === 'nights') {
        query = sql`${query} ORDER BY c.nights ASC`;
      } else {
        query = sql`${query} ORDER BY c.sailing_date ASC`;
      }

      // Add limit and offset
      query = sql`${query} LIMIT ${limit} OFFSET ${offset}`;

      // Execute main query
      logger.info('Executing main query...');
      const results = await db.execute(query);
      logger.info('Query executed, got results:', { count: results?.length || 0 });

      // Get total count
      let countQuery = sql`
        SELECT COUNT(*) as total
        FROM cruises c
        WHERE c.is_active = true
          AND c.sailing_date >= CURRENT_DATE + INTERVAL '14 days'`;

      if (filters.cruiseLine) {
        const lineIds = Array.isArray(filters.cruiseLine)
          ? filters.cruiseLine
          : [filters.cruiseLine];
        countQuery = sql`${countQuery} AND c.cruise_line_id = ANY(${lineIds}::int[])`;
      }

      if (filters.nights?.min) {
        countQuery = sql`${countQuery} AND c.nights >= ${filters.nights.min}`;
      }

      if (filters.nights?.max) {
        countQuery = sql`${countQuery} AND c.nights <= ${filters.nights.max}`;
      }

      // Price filtering disabled until pricing data is synced
      // if (filters.price?.min) {
      //   countQuery = sql`${countQuery} AND cp.cheapest_price >= ${filters.price.min}`;
      // }
      //
      // if (filters.price?.max) {
      //   countQuery = sql`${countQuery} AND cp.cheapest_price <= ${filters.price.max}`;
      // }

      const countResult = await db.execute(countQuery);

      // Format results - handle both possible response formats from drizzle
      const resultsArray = (results as any)?.rows || (results as any) || [];
      const cruises = (resultsArray || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        sailingDate: row.sailing_date,
        returnDate: row.sailing_date
          ? new Date(new Date(row.sailing_date).getTime() + row.nights * 24 * 60 * 60 * 1000)
          : null,
        nights: row.nights,
        cruiseLine: {
          name: row.cruise_line_name || 'Unknown',
        },
        ship: {
          name: row.ship_name || 'Unknown',
        },
        embarkPort: {
          name: row.embark_port_name || 'Unknown',
        },
        disembarkPort: {
          name: row.disembark_port_name || 'Unknown',
        },
        price: row.cheapest_price
          ? {
              amount: Number(row.cheapest_price),
              currency: 'USD',
            }
          : null,
      }));

      const countData = (countResult as any)?.rows?.[0] || (countResult as any)?.[0] || {};
      const total = Number(countData.total || 0);

      const result = {
        cruises,
        meta: {
          page: options.page || 1,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          searchTime: Date.now() - startTime,
          cacheHit: false,
        },
      };

      // Cache the result
      await cacheManager.set(cacheKey, result, { ttl: 300 }); // 5 minute cache

      return result;
    } catch (error) {
      logger.error('Search query failed:', error);
      throw error;
    }
  }

  /**
   * Get popular cruises
   */
  async getPopularCruises(limit: number = 10) {
    const startTime = Date.now();

    try {
      // Check if database is available
      if (!db) {
        logger.warn('Database not configured - returning empty popular cruises');
        return [];
      }
      const cacheKey = CacheKeys.popularCruises(limit);
      const cached = await cacheManager.get<any>(cacheKey);
      if (cached) {
        return cached;
      }

      const query = sql`
        SELECT
          c.id,
          c.name,
          c.sailing_date,
          c.nights,
          cl.name as cruise_line_name,
          s.name as ship_name,
          NULL as cheapest_price
        FROM cruises c
        LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
        LEFT JOIN ships s ON c.ship_id = s.id
        WHERE c.is_active = true
          AND c.sailing_date >= CURRENT_DATE + INTERVAL '14 days'
        ORDER BY c.sailing_date ASC
        LIMIT ${limit}
      `;

      const results = await db.execute(query);

      const resultsArray = (results as any)?.rows || (results as any) || [];
      const cruises = (resultsArray || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        sailingDate: row.sailing_date,
        nights: row.nights,
        cruiseLine: row.cruise_line_name,
        ship: row.ship_name,
        price: row.cheapest_price ? Number(row.cheapest_price) : null,
      }));

      await cacheManager.set(cacheKey, cruises, { ttl: 3600 });

      logger.info(`Popular cruises query took ${Date.now() - startTime}ms`);

      return cruises;
    } catch (error) {
      logger.error('Failed to get popular cruises:', error);
      throw error;
    }
  }

  /**
   * Get search suggestions
   */
  async getSuggestions(query: string, limit: number = 10) {
    if (!query || query.length < 2) {
      return [];
    }

    try {
      // Check if database is available
      if (!db) {
        logger.warn('Database not configured - returning empty suggestions');
        return [];
      }
      const cacheKey = `search:suggestions:${query.toLowerCase()}`;
      const cached = await cacheManager.get<any>(cacheKey);
      if (cached) {
        return cached;
      }

      const searchTerm = `%${query}%`;

      const results = await db.execute(sql`
        SELECT DISTINCT name, 'cruise' as type
        FROM cruises
        WHERE is_active = true
          AND sailing_date >= CURRENT_DATE + INTERVAL '14 days'
          AND name ILIKE ${searchTerm}
        LIMIT ${limit}
      `);

      const suggestions = (results as any)?.rows || (results as any) || [];

      await cacheManager.set(cacheKey, suggestions, { ttl: 600 });

      return suggestions;
    } catch (error) {
      logger.error('Failed to get suggestions:', error);
      return [];
    }
  }
}

export const searchOptimizedSimpleService = new SearchOptimizedSimpleService();
