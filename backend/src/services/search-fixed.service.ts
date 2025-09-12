/**
 * Fixed search service that works with the correct database schema
 * Based on the recreated database structure from Traveltek API
 */

import { db } from '../db/connection';
import { sql } from 'drizzle-orm';
import logger from '../config/logger';

export interface SearchFilters {
  startDate?: string;
  endDate?: string;
  nights?: number;
  minNights?: number;
  maxNights?: number;
  cruiseLineId?: number;
  shipId?: number;
  embarkPortId?: number;
  limit?: number;
  offset?: number;
}

class SearchFixedService {
  /**
   * Search cruises with the correct schema
   */
  async searchCruises(filters: SearchFilters) {
    try {
      const {
        startDate,
        endDate,
        nights,
        minNights,
        maxNights,
        cruiseLineId,
        shipId,
        embarkPortId,
        limit = 50,
        offset = 0,
      } = filters;

      // Build WHERE conditions
      const conditions = ['c.is_active = true'];
      const params: any[] = [];
      let paramCount = 1;

      if (startDate) {
        conditions.push(`c.sailing_date >= $${paramCount}`);
        params.push(startDate);
        paramCount++;
      }

      if (endDate) {
        conditions.push(`c.sailing_date <= $${paramCount}`);
        params.push(endDate);
        paramCount++;
      }

      if (nights) {
        conditions.push(`c.nights = $${paramCount}`);
        params.push(nights);
        paramCount++;
      }

      if (minNights) {
        conditions.push(`c.nights >= $${paramCount}`);
        params.push(minNights);
        paramCount++;
      }

      if (maxNights) {
        conditions.push(`c.nights <= $${paramCount}`);
        params.push(maxNights);
        paramCount++;
      }

      if (cruiseLineId) {
        conditions.push(`c.cruise_line_id = $${paramCount}`);
        params.push(cruiseLineId);
        paramCount++;
      }

      if (shipId) {
        conditions.push(`c.ship_id = $${paramCount}`);
        params.push(shipId);
        paramCount++;
      }

      if (embarkPortId) {
        conditions.push(`c.embarkation_port_id = $${paramCount}`);
        params.push(embarkPortId);
        paramCount++;
      }

      // Add limit and offset
      conditions.push(`LIMIT $${paramCount}`);
      params.push(limit);
      paramCount++;

      conditions.push(`OFFSET $${paramCount}`);
      params.push(offset);

      const whereClause = conditions.slice(0, -2).join(' AND '); // Remove LIMIT and OFFSET from WHERE
      const limitClause = conditions.slice(-2).join(' '); // Get just LIMIT and OFFSET

      // Query cruises with joins to get names
      const query = `
        SELECT
          c.id,
          c.cruise_id,
          c.name,
          c.voyage_code,
          c.itinerary_code,
          c.sailing_date,
          c.nights,
          c.sea_days,
          c.cruise_line_id,
          cl.name as cruise_line_name,
          c.ship_id,
          s.name as ship_name,
          c.embarkation_port_id,
          p1.name as embark_port_name,
          c.disembarkation_port_id,
          p2.name as disembark_port_name,
          c.no_fly,
          c.depart_uk,
          c.show_cruise,
          c.market_id,
          c.port_ids,
          c.region_ids,
          c.created_at,
          c.updated_at
        FROM cruises c
        LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
        LEFT JOIN ships s ON c.ship_id = s.id
        LEFT JOIN ports p1 ON c.embarkation_port_id = p1.id
        LEFT JOIN ports p2 ON c.disembarkation_port_id = p2.id
        WHERE ${whereClause}
        ORDER BY c.sailing_date ASC, c.nights ASC
        ${limitClause}
      `;

      // Simplified query without dynamic conditions for now
      const resultsQuery = await db.execute(sql`
        SELECT
          c.id,
          c.cruise_id,
          c.name,
          c.voyage_code,
          c.itinerary_code,
          c.sailing_date,
          c.nights,
          c.sea_days,
          c.cruise_line_id,
          cl.name as cruise_line_name,
          c.ship_id,
          s.name as ship_name,
          c.embarkation_port_id,
          p1.name as embark_port_name,
          c.disembarkation_port_id,
          p2.name as disembark_port_name,
          c.no_fly,
          c.depart_uk,
          c.show_cruise,
          c.port_ids,
          c.region_ids,
          c.created_at,
          c.updated_at
        FROM cruises c
        LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
        LEFT JOIN ships s ON c.ship_id = s.id
        LEFT JOIN ports p1 ON c.embarkation_port_id = p1.id
        LEFT JOIN ports p2 ON c.disembarkation_port_id = p2.id
        WHERE c.is_active = true
        AND c.sailing_date >= CURRENT_DATE
        ORDER BY c.sailing_date ASC, c.nights ASC
        LIMIT ${limit}
        OFFSET ${offset}
      `);
      const results = (resultsQuery as any).rows || resultsQuery || [];

      // Get total count for pagination
      const countQuery = `
        SELECT COUNT(*) as total
        FROM cruises c
        WHERE ${whereClause}
      `;

      const countResultQuery = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM cruises c
        WHERE c.is_active = true
        AND c.sailing_date >= CURRENT_DATE
      `);
      const countResult = (countResultQuery as any).rows || countResultQuery || [];
      const total = parseInt(countResult[0]?.total || '0');

      return {
        results,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + results.length < total,
        },
      };
    } catch (error) {
      logger.error('Search failed:', error);
      throw error;
    }
  }

  /**
   * Get cruise details by ID
   */
  async getCruiseById(id: number) {
    try {
      const cruiseResult = await db.execute(sql`
        SELECT
          c.*,
          cl.name as cruise_line_name,
          cl.code as cruise_line_code,
          s.name as ship_name,
          s.code as ship_code,
          s.tonnage as ship_tonnage,
          s.total_cabins as ship_total_cabins,
          s.max_passengers as ship_max_passengers,
          p1.name as embark_port_name,
          p2.name as disembark_port_name
        FROM cruises c
        LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
        LEFT JOIN ships s ON c.ship_id = s.id
        LEFT JOIN ports p1 ON c.embarkation_port_id = p1.id
        LEFT JOIN ports p2 ON c.disembarkation_port_id = p2.id
        WHERE c.id = ${id}
      `);

      const cruise = (cruiseResult as any).rows || cruiseResult || [];
      if (cruise.length === 0) {
        return null;
      }

      // Get itinerary if it exists
      const itineraryResult = await db.execute(sql`
        SELECT
          i.*,
          p.name as port_name,
          p.code as port_code,
          p.country as port_country
        FROM itineraries i
        LEFT JOIN ports p ON i.port_id = p.id
        WHERE i.cruise_id = ${id}
        ORDER BY i.day_number ASC
      `);

      const itinerary = (itineraryResult as any).rows || itineraryResult || [];
      return {
        ...cruise[0],
        itinerary,
      };
    } catch (error) {
      logger.error('Get cruise by ID failed:', error);
      throw error;
    }
  }

  /**
   * Get available filters for search
   */
  async getFilters() {
    try {
      const [cruiseLines, ships, ports, priceResult, nightsResult, dateResult] = await Promise.all([
        db.execute(sql`
          SELECT DISTINCT cl.id, cl.name
          FROM cruise_lines cl
          JOIN cruises c ON c.cruise_line_id = cl.id
          WHERE c.is_active = true
          AND c.sailing_date >= CURRENT_DATE
          ORDER BY cl.name
          LIMIT 100
        `),
        db.execute(sql`
          SELECT DISTINCT s.id, s.name, s.cruise_line_id
          FROM ships s
          JOIN cruises c ON c.ship_id = s.id
          WHERE c.is_active = true
          AND c.sailing_date >= CURRENT_DATE
          ORDER BY s.name
          LIMIT 200
        `),
        db.execute(sql`
          SELECT DISTINCT p.id, p.name
          FROM ports p
          WHERE p.id IN (
            SELECT embarkation_port_id FROM cruises WHERE is_active = true AND sailing_date >= CURRENT_DATE
            UNION
            SELECT disembarkation_port_id FROM cruises WHERE is_active = true AND sailing_date >= CURRENT_DATE
          )
          ORDER BY p.name
          LIMIT 100
        `),
        db.execute(sql`
          SELECT
            MIN(COALESCE(cp.cheapest_price, 0)) as min_price,
            MAX(COALESCE(cp.cheapest_price, 99999)) as max_price
          FROM cruises c
          LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
          WHERE c.is_active = true
          AND c.sailing_date >= CURRENT_DATE
        `),
        db.execute(sql`
          SELECT
            MIN(nights) as min_nights,
            MAX(nights) as max_nights
          FROM cruises
          WHERE is_active = true
          AND sailing_date >= CURRENT_DATE
        `),
        db.execute(sql`
          SELECT
            MIN(sailing_date) as min_date,
            MAX(sailing_date) as max_date
          FROM cruises
          WHERE is_active = true
          AND sailing_date >= CURRENT_DATE
        `),
      ]);

      // Handle both possible response formats from drizzle
      const cruiseLinesData = (cruiseLines as any).rows || cruiseLines || [];
      const shipsData = (ships as any).rows || ships || [];
      const portsData = (ports as any).rows || ports || [];
      const priceData = ((priceResult as any).rows || priceResult || [])[0] || {};
      const nightsData = ((nightsResult as any).rows || nightsResult || [])[0] || {};
      const dateData = ((dateResult as any).rows || dateResult || [])[0] || {};

      logger.info(
        `Filter data fetched: ${cruiseLinesData.length} cruise lines, ${shipsData.length} ships, ${portsData.length} ports`
      );

      return {
        cruiseLines: cruiseLinesData,
        ships: shipsData,
        ports: portsData,
        priceRange: {
          min: priceData.min_price || 0,
          max: priceData.max_price || 10000,
        },
        nightsRange: {
          min: nightsData.min_nights || 1,
          max: nightsData.max_nights || 30,
        },
        dateRange: {
          min: dateData.min_date || new Date().toISOString().split('T')[0],
          max:
            dateData.max_date ||
            new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        },
      };
    } catch (error) {
      logger.error('Get filters failed:', error);
      throw error;
    }
  }
}

export const searchFixedService = new SearchFixedService();
