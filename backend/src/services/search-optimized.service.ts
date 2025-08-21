import { db } from '../db/connection';
import { sql } from 'drizzle-orm';
import logger from '../config/logger';
import { cacheManager } from '../cache/cache-manager';
import { CacheKeys } from '../cache/cache-keys';

/**
 * Optimized search service using raw SQL for performance
 * Replaces slow Drizzle ORM queries with direct SQL
 */
export class SearchOptimizedService {
  
  /**
   * Main search endpoint - optimized version
   */
  async searchCruises(filters: any = {}, options: any = {}) {
    const startTime = Date.now();
    
    try {
      // Set defaults
      const limit = Math.min(options.limit || 20, 100);
      const offset = ((options.page || 1) - 1) * limit;
      const sortBy = options.sortBy || 'date';
      const sortOrder = options.sortOrder || 'asc';
      
      // Try cache first
      const cacheKey = CacheKeys.searchResults(JSON.stringify({ filters, options }));
      const cached = await cacheManager.get(cacheKey);
      if (cached) {
        return {
          ...cached,
          meta: {
            ...cached.meta,
            searchTime: Date.now() - startTime,
            cacheHit: true
          }
        };
      }
      
      // Build WHERE conditions
      const conditions = [];
      const params = [];
      let paramIndex = 1;
      
      // Always filter active cruises
      conditions.push('c.is_active = true');
      conditions.push('c.sailing_date >= CURRENT_DATE');
      
      // Apply filters
      if (filters.cruiseLine) {
        const lineIds = Array.isArray(filters.cruiseLine) ? filters.cruiseLine : [filters.cruiseLine];
        conditions.push(`c.cruise_line_id = ANY($${paramIndex}::int[])`);
        params.push(lineIds);
        paramIndex++;
      }
      
      if (filters.ship) {
        const shipIds = Array.isArray(filters.ship) ? filters.ship : [filters.ship];
        conditions.push(`c.ship_id = ANY($${paramIndex}::int[])`);
        params.push(shipIds);
        paramIndex++;
      }
      
      if (filters.nights?.min) {
        conditions.push(`c.nights >= $${paramIndex}`);
        params.push(filters.nights.min);
        paramIndex++;
      }
      
      if (filters.nights?.max) {
        conditions.push(`c.nights <= $${paramIndex}`);
        params.push(filters.nights.max);
        paramIndex++;
      }
      
      if (filters.sailingDate?.from) {
        conditions.push(`c.sailing_date >= $${paramIndex}`);
        params.push(filters.sailingDate.from);
        paramIndex++;
      }
      
      if (filters.sailingDate?.to) {
        conditions.push(`c.sailing_date <= $${paramIndex}`);
        params.push(filters.sailingDate.to);
        paramIndex++;
      }
      
      if (filters.price?.min) {
        conditions.push(`cp.cheapest_price >= $${paramIndex}`);
        params.push(filters.price.min);
        paramIndex++;
      }
      
      if (filters.price?.max) {
        conditions.push(`cp.cheapest_price <= $${paramIndex}`);
        params.push(filters.price.max);
        paramIndex++;
      }
      
      if (filters.regions && filters.regions.length > 0) {
        conditions.push(`c.region_ids && $${paramIndex}::int[]`);
        params.push(filters.regions);
        paramIndex++;
      }
      
      if (filters.ports && filters.ports.length > 0) {
        conditions.push(`(c.embark_port_id = ANY($${paramIndex}::int[]) OR c.disembark_port_id = ANY($${paramIndex}::int[]))`);
        params.push(filters.ports);
        paramIndex++;
      }
      
      // Full text search
      if (filters.q) {
        conditions.push(`(
          c.name ILIKE $${paramIndex} OR 
          cl.name ILIKE $${paramIndex} OR 
          s.name ILIKE $${paramIndex}
        )`);
        params.push(`%${filters.q}%`);
        paramIndex++;
      }
      
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      
      // Build ORDER BY
      let orderByClause = '';
      switch (sortBy) {
        case 'price':
          orderByClause = `ORDER BY cp.cheapest_price ${sortOrder === 'desc' ? 'DESC NULLS LAST' : 'ASC NULLS LAST'}`;
          break;
        case 'nights':
          orderByClause = `ORDER BY c.nights ${sortOrder === 'desc' ? 'DESC' : 'ASC'}`;
          break;
        case 'name':
          orderByClause = `ORDER BY c.name ${sortOrder === 'desc' ? 'DESC' : 'ASC'}`;
          break;
        case 'popularity':
          orderByClause = `ORDER BY c.popularity_score ${sortOrder === 'desc' ? 'DESC NULLS LAST' : 'ASC NULLS LAST'}`;
          break;
        case 'date':
        default:
          orderByClause = `ORDER BY c.sailing_date ${sortOrder === 'desc' ? 'DESC' : 'ASC'}`;
          break;
      }
      
      // Main query - optimized with specific columns
      const query = `
        SELECT 
          c.id,
          c.name,
          c.sailing_date,
          c.return_date,
          c.nights,
          c.embark_port_id,
          c.disembark_port_id,
          c.popularity_score,
          c.avg_rating,
          cl.id as cruise_line_id,
          cl.name as cruise_line_name,
          cl.code as cruise_line_code,
          cl.logo_url as cruise_line_logo,
          s.id as ship_id,
          s.name as ship_name,
          s.tonnage as ship_tonnage,
          s.passenger_capacity as ship_capacity,
          s.star_rating as ship_rating,
          s.default_image_url as ship_image,
          p1.id as embark_port_id,
          p1.name as embark_port_name,
          p1.city as embark_port_city,
          p1.country as embark_port_country,
          p2.id as disembark_port_id,
          p2.name as disembark_port_name,
          p2.city as disembark_port_city,
          p2.country as disembark_port_country,
          cp.cheapest_price,
          cp.currency
        FROM cruises c
        LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
        LEFT JOIN ships s ON c.ship_id = s.id
        LEFT JOIN ports p1 ON c.embark_port_id = p1.id
        LEFT JOIN ports p2 ON c.disembark_port_id = p2.id
        LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
        ${whereClause}
        ${orderByClause}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      params.push(limit, offset);
      
      // Count query - simpler without unnecessary joins
      const countQuery = `
        SELECT COUNT(*) as total
        FROM cruises c
        ${filters.price?.min || filters.price?.max ? 'LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id' : ''}
        ${filters.q ? 'LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id LEFT JOIN ships s ON c.ship_id = s.id' : ''}
        ${whereClause}
      `;
      
      // Execute queries
      const [results, countResult] = await Promise.all([
        db.execute(sql.raw(query, params)),
        db.execute(sql.raw(countQuery, params.slice(0, -2))) // Remove limit/offset params
      ]);
      
      // Format results
      const cruises = (results as any).rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        sailingDate: row.sailing_date,
        returnDate: row.return_date,
        nights: row.nights,
        popularityScore: row.popularity_score,
        avgRating: row.avg_rating,
        cruiseLine: {
          id: row.cruise_line_id,
          name: row.cruise_line_name || 'Unknown',
          code: row.cruise_line_code,
          logoUrl: row.cruise_line_logo
        },
        ship: {
          id: row.ship_id,
          name: row.ship_name || 'Unknown',
          tonnage: row.ship_tonnage,
          passengerCapacity: row.ship_capacity,
          starRating: row.ship_rating,
          defaultImageUrl: row.ship_image
        },
        embarkPort: row.embark_port_id ? {
          id: row.embark_port_id,
          name: row.embark_port_name,
          city: row.embark_port_city,
          country: row.embark_port_country
        } : null,
        disembarkPort: row.disembark_port_id ? {
          id: row.disembark_port_id,
          name: row.disembark_port_name,
          city: row.disembark_port_city,
          country: row.disembark_port_country
        } : null,
        price: row.cheapest_price ? {
          amount: Number(row.cheapest_price),
          currency: row.currency || 'USD'
        } : null
      }));
      
      const total = Number((countResult as any).rows[0].total);
      
      const result = {
        cruises,
        meta: {
          page: options.page || 1,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          searchTime: Date.now() - startTime,
          cacheHit: false
        }
      };
      
      // Cache the result
      await cacheManager.set(cacheKey, result, 300); // 5 minute cache
      
      // Log slow queries
      if (result.meta.searchTime > 1000) {
        logger.warn('Slow search query', {
          filters,
          options,
          searchTime: result.meta.searchTime
        });
      }
      
      return result;
      
    } catch (error) {
      logger.error('Search query failed:', error);
      throw error;
    }
  }
  
  /**
   * Get popular cruises - optimized
   */
  async getPopularCruises(limit: number = 10) {
    const startTime = Date.now();
    
    try {
      // Try cache first
      const cacheKey = CacheKeys.popularCruises();
      const cached = await cacheManager.get(cacheKey);
      if (cached) {
        return cached;
      }
      
      const query = `
        SELECT 
          c.id,
          c.name,
          c.sailing_date,
          c.nights,
          c.popularity_score,
          cl.name as cruise_line_name,
          s.name as ship_name,
          cp.cheapest_price
        FROM cruises c
        LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
        LEFT JOIN ships s ON c.ship_id = s.id
        LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
        WHERE c.is_active = true
          AND c.sailing_date >= CURRENT_DATE
          AND c.popularity_score IS NOT NULL
        ORDER BY c.popularity_score DESC
        LIMIT $1
      `;
      
      const results = await db.execute(sql.raw(query, [limit]));
      
      const cruises = (results as any).rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        sailingDate: row.sailing_date,
        nights: row.nights,
        popularityScore: row.popularity_score,
        cruiseLine: row.cruise_line_name,
        ship: row.ship_name,
        price: row.cheapest_price ? Number(row.cheapest_price) : null
      }));
      
      // Cache for 1 hour
      await cacheManager.set(cacheKey, cruises, 3600);
      
      logger.info(`Popular cruises query took ${Date.now() - startTime}ms`);
      
      return cruises;
      
    } catch (error) {
      logger.error('Failed to get popular cruises:', error);
      throw error;
    }
  }
  
  /**
   * Get search filters with counts - optimized
   */
  async getSearchFilters() {
    const startTime = Date.now();
    
    try {
      // Try cache first
      const cacheKey = 'search:filters';
      const cached = await cacheManager.get(cacheKey);
      if (cached) {
        return cached;
      }
      
      // Get all filter options in parallel
      const [cruiseLines, ships, ports, priceRange, nightsRange, dateRange] = await Promise.all([
        // Cruise lines with cruise count
        db.execute(sql`
          SELECT cl.id, cl.name, COUNT(c.id) as cruise_count
          FROM cruise_lines cl
          JOIN cruises c ON c.cruise_line_id = cl.id
          WHERE c.is_active = true AND c.sailing_date >= CURRENT_DATE
          GROUP BY cl.id, cl.name
          HAVING COUNT(c.id) > 0
          ORDER BY cl.name
        `),
        
        // Ships with cruise count
        db.execute(sql`
          SELECT s.id, s.name, s.star_rating, COUNT(c.id) as cruise_count
          FROM ships s
          JOIN cruises c ON c.ship_id = s.id
          WHERE c.is_active = true AND c.sailing_date >= CURRENT_DATE
          GROUP BY s.id, s.name, s.star_rating
          HAVING COUNT(c.id) > 0
          ORDER BY s.name
        `),
        
        // Ports with cruise count
        db.execute(sql`
          SELECT DISTINCT p.id, p.name, p.city, p.country, COUNT(DISTINCT c.id) as cruise_count
          FROM ports p
          JOIN cruises c ON (c.embark_port_id = p.id OR c.disembark_port_id = p.id)
          WHERE c.is_active = true AND c.sailing_date >= CURRENT_DATE
          GROUP BY p.id, p.name, p.city, p.country
          HAVING COUNT(DISTINCT c.id) > 0
          ORDER BY p.name
        `),
        
        // Price range
        db.execute(sql`
          SELECT 
            MIN(cp.cheapest_price) as min_price,
            MAX(cp.cheapest_price) as max_price
          FROM cheapest_pricing cp
          JOIN cruises c ON c.id = cp.cruise_id
          WHERE c.is_active = true AND c.sailing_date >= CURRENT_DATE
        `),
        
        // Nights range
        db.execute(sql`
          SELECT 
            MIN(nights) as min_nights,
            MAX(nights) as max_nights
          FROM cruises
          WHERE is_active = true AND sailing_date >= CURRENT_DATE
        `),
        
        // Date range
        db.execute(sql`
          SELECT 
            MIN(sailing_date) as min_date,
            MAX(sailing_date) as max_date
          FROM cruises
          WHERE is_active = true AND sailing_date >= CURRENT_DATE
        `)
      ]);
      
      const filters = {
        cruiseLines: (cruiseLines as any).rows.map((cl: any) => ({
          id: cl.id,
          name: cl.name,
          count: Number(cl.cruise_count)
        })),
        ships: (ships as any).rows.map((s: any) => ({
          id: s.id,
          name: s.name,
          starRating: s.star_rating,
          count: Number(s.cruise_count)
        })),
        ports: (ports as any).rows.map((p: any) => ({
          id: p.id,
          name: p.name,
          city: p.city,
          country: p.country,
          count: Number(p.cruise_count)
        })),
        priceRange: {
          min: Number((priceRange as any).rows[0]?.min_price) || 0,
          max: Number((priceRange as any).rows[0]?.max_price) || 10000
        },
        nightsRange: {
          min: Number((nightsRange as any).rows[0]?.min_nights) || 1,
          max: Number((nightsRange as any).rows[0]?.max_nights) || 30
        },
        dateRange: {
          min: (dateRange as any).rows[0]?.min_date || new Date().toISOString().split('T')[0],
          max: (dateRange as any).rows[0]?.max_date || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        }
      };
      
      // Cache for 30 minutes
      await cacheManager.set(cacheKey, filters, 1800);
      
      logger.info(`Search filters query took ${Date.now() - startTime}ms`);
      
      return filters;
      
    } catch (error) {
      logger.error('Failed to get search filters:', error);
      throw error;
    }
  }
  
  /**
   * Autocomplete/suggestions endpoint - optimized
   */
  async getSuggestions(query: string, limit: number = 10) {
    if (!query || query.length < 2) {
      return [];
    }
    
    const startTime = Date.now();
    
    try {
      // Try cache first
      const cacheKey = `search:suggestions:${query.toLowerCase()}`;
      const cached = await cacheManager.get(cacheKey);
      if (cached) {
        return cached;
      }
      
      const searchTerm = `%${query}%`;
      
      // Get suggestions from multiple sources
      const [cruiseResults, lineResults, shipResults, portResults] = await Promise.all([
        // Cruise names
        db.execute(sql.raw(`
          SELECT DISTINCT name, 'cruise' as type
          FROM cruises
          WHERE is_active = true 
            AND sailing_date >= CURRENT_DATE
            AND name ILIKE $1
          LIMIT $2
        `, [searchTerm, Math.ceil(limit / 4)])),
        
        // Cruise line names
        db.execute(sql.raw(`
          SELECT DISTINCT cl.name, 'cruise_line' as type
          FROM cruise_lines cl
          JOIN cruises c ON c.cruise_line_id = cl.id
          WHERE c.is_active = true 
            AND c.sailing_date >= CURRENT_DATE
            AND cl.name ILIKE $1
          LIMIT $2
        `, [searchTerm, Math.ceil(limit / 4)])),
        
        // Ship names
        db.execute(sql.raw(`
          SELECT DISTINCT s.name, 'ship' as type
          FROM ships s
          JOIN cruises c ON c.ship_id = s.id
          WHERE c.is_active = true 
            AND c.sailing_date >= CURRENT_DATE
            AND s.name ILIKE $1
          LIMIT $2
        `, [searchTerm, Math.ceil(limit / 4)])),
        
        // Port names
        db.execute(sql.raw(`
          SELECT DISTINCT p.name || ', ' || p.country as name, 'port' as type
          FROM ports p
          JOIN cruises c ON (c.embark_port_id = p.id OR c.disembark_port_id = p.id)
          WHERE c.is_active = true 
            AND c.sailing_date >= CURRENT_DATE
            AND (p.name ILIKE $1 OR p.city ILIKE $1 OR p.country ILIKE $1)
          LIMIT $2
        `, [searchTerm, Math.ceil(limit / 4)]))
      ]);
      
      // Combine and format results
      const suggestions = [
        ...(cruiseResults as any).rows,
        ...(lineResults as any).rows,
        ...(shipResults as any).rows,
        ...(portResults as any).rows
      ].slice(0, limit);
      
      // Cache for 10 minutes
      await cacheManager.set(cacheKey, suggestions, 600);
      
      logger.info(`Suggestions query for "${query}" took ${Date.now() - startTime}ms`);
      
      return suggestions;
      
    } catch (error) {
      logger.error('Failed to get suggestions:', error);
      return [];
    }
  }
}

export const searchOptimizedService = new SearchOptimizedService();