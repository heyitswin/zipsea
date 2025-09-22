import { db } from '../db/connection';
import { cruises, cruiseLines, ships, ports } from '../db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import logger from '../config/logger';

/**
 * Hotfix for search service - simpler, faster queries
 */
export class SearchHotfixService {
  async getSimpleCruiseList(limit: number = 20, offset: number = 0) {
    try {
      // Check if database is available
      if (!db) {
        logger.warn('Database not configured - returning empty cruise list');
        return {
          cruises: [],
          meta: {
            total: 0,
            limit,
            offset,
            page: Math.floor(offset / limit) + 1,
            totalPages: 0,
          },
        };
      }
      // Much simpler query without complex joins
      const results = await db.execute(sql`
        SELECT
          c.id,
          c.name,
          c.sailing_date,
          c.nights,
          c.embarkation_port_id,
          c.disembarkation_port_id,
          cl.name as cruise_line_name,
          s.name as ship_name,
          p1.name as embark_port,
          p2.name as disembark_port,
          NULL as cheapest_price
        FROM cruises c
        LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
        LEFT JOIN ships s ON c.ship_id = s.id
        LEFT JOIN ports p1 ON c.embarkation_port_id = p1.id
        LEFT JOIN ports p2 ON c.disembarkation_port_id = p2.id
        WHERE c.is_active = true
        AND c.sailing_date >= CURRENT_DATE + INTERVAL '14 days'
        ORDER BY c.sailing_date ASC
        LIMIT ${limit}
        OFFSET ${offset}
      `);

      // Get total count separately
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM cruises
        WHERE is_active = true
        AND sailing_date >= CURRENT_DATE + INTERVAL '14 days'
      `);

      // Handle both possible response formats from drizzle
      const resultsArray = (results as any)?.rows || (results as any) || [];
      const countData = (countResult as any)?.rows?.[0] || (countResult as any)?.[0] || {};
      const total = Number(countData.count || 0);

      return {
        cruises: resultsArray.map((row: any) => ({
          id: row.id,
          name: row.name,
          sailingDate: row.sailing_date,
          nights: row.nights,
          cruiseLine: {
            name: row.cruise_line_name || 'Unknown',
          },
          ship: {
            name: row.ship_name || 'Unknown',
          },
          embarkPort: {
            name: row.embark_port || 'Unknown',
          },
          disembarkPort: {
            name: row.disembark_port || 'Unknown',
          },
          price: row.cheapest_price
            ? {
                amount: Number(row.cheapest_price),
                currency: 'USD',
              }
            : null,
        })),
        meta: {
          total,
          limit,
          offset,
          page: Math.floor(offset / limit) + 1,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Hotfix search failed:', error);
      throw error;
    }
  }
}

export const searchHotfixService = new SearchHotfixService();
