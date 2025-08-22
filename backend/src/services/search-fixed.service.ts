/**
 * Fixed search service that works with the correct database schema
 * Based on the recreated database structure from Traveltek API
 */

import postgres from 'postgres';
import { env } from '../config/environment';
import logger from '../config/logger';

const sql = postgres(env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: { rejectUnauthorized: false }
});

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
        offset = 0
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
          c.sail_nights,
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

      const results = await sql.unsafe(query, params);

      // Get total count for pagination
      const countQuery = `
        SELECT COUNT(*) as total
        FROM cruises c
        WHERE ${whereClause}
      `;

      const countResult = await sql.unsafe(countQuery, params.slice(0, -2)); // Exclude limit and offset
      const total = parseInt(countResult[0].total);

      return {
        results,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + results.length < total
        }
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
      const cruise = await sql`
        SELECT 
          c.*,
          cl.name as cruise_line_name,
          cl.code as cruise_line_code,
          s.name as ship_name,
          s.code as ship_code,
          s.tonnage as ship_tonnage,
          s.total_cabins as ship_total_cabins,
          s.occupancy as ship_occupancy,
          p1.name as embark_port_name,
          p2.name as disembark_port_name
        FROM cruises c
        LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
        LEFT JOIN ships s ON c.ship_id = s.id
        LEFT JOIN ports p1 ON c.embarkation_port_id = p1.id
        LEFT JOIN ports p2 ON c.disembarkation_port_id = p2.id
        WHERE c.id = ${id}
      `;

      if (cruise.length === 0) {
        return null;
      }

      // Get itinerary if it exists
      const itinerary = await sql`
        SELECT 
          i.*,
          p.name as port_name,
          p.code as port_code,
          p.country as port_country
        FROM itineraries i
        LEFT JOIN ports p ON i.port_id = p.id
        WHERE i.cruise_id = ${id}
        ORDER BY i.day_number ASC
      `;

      return {
        ...cruise[0],
        itinerary
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
      const [cruiseLines, ships, ports, nights] = await Promise.all([
        sql`
          SELECT DISTINCT cl.id, cl.name
          FROM cruise_lines cl
          JOIN cruises c ON c.cruise_line_id = cl.id
          WHERE c.is_active = true
          ORDER BY cl.name
        `,
        sql`
          SELECT DISTINCT s.id, s.name, s.cruise_line_id
          FROM ships s
          JOIN cruises c ON c.ship_id = s.id
          WHERE c.is_active = true
          ORDER BY s.name
        `,
        sql`
          SELECT DISTINCT p.id, p.name
          FROM ports p
          WHERE p.id IN (
            SELECT embarkation_port_id FROM cruises WHERE is_active = true
            UNION
            SELECT disembarkation_port_id FROM cruises WHERE is_active = true
          )
          ORDER BY p.name
        `,
        sql`
          SELECT DISTINCT nights
          FROM cruises
          WHERE is_active = true
          ORDER BY nights
        `
      ]);

      return {
        cruiseLines,
        ships,
        ports,
        nights: nights.map(n => n.nights)
      };

    } catch (error) {
      logger.error('Get filters failed:', error);
      throw error;
    }
  }
}

export const searchFixedService = new SearchFixedService();