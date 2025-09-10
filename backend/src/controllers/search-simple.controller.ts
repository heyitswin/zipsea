/**
 * Simple search controller for key use cases
 * Focuses on finding cruises by ship name and departure date
 */

import { Request, Response } from 'express';
import { searchFixedService } from '../services/search-fixed.service';
import logger from '../config/logger';
import postgres from 'postgres';
import { env } from '../config/environment';

const sql = postgres(env.DATABASE_URL, {
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: { rejectUnauthorized: false },
});

export class SearchSimpleController {
  /**
   * Find cruises by ship name and departure date
   * This is a primary use case for the search API
   */
  async findByShipAndDate(req: Request, res: Response): Promise<void> {
    try {
      const { shipName, departureDate, month, year } = req.query;

      // Build query conditions
      const conditions = [];
      const params = [];

      if (shipName) {
        // Search both in linked ships table AND in cruise's ship_name field
        conditions.push(
          `(LOWER(s.name) LIKE LOWER($${params.length + 1}) OR LOWER(c.ship_name) LIKE LOWER($${params.length + 2}))`
        );
        params.push(`%${shipName}%`);
        params.push(`%${shipName}%`);
      }

      if (departureDate) {
        conditions.push(`c.sailing_date = $${params.length + 1}`);
        params.push(departureDate);
      } else if (month && year) {
        conditions.push(`EXTRACT(MONTH FROM c.sailing_date) = $${params.length + 1}`);
        params.push(month);
        conditions.push(`EXTRACT(YEAR FROM c.sailing_date) = $${params.length + 1}`);
        params.push(year);
      }

      if (conditions.length === 0) {
        res.status(400).json({
          error: 'Please provide shipName and either departureDate or month/year',
        });
        return;
      }

      const whereClause = conditions.join(' AND ');

      const query = `
        SELECT
          c.id,
          c.cruise_id,
          c.name,
          c.voyage_code,
          c.sailing_date,
          c.nights,
          cl.name as cruise_line_name,
          COALESCE(s.name, c.ship_name) as ship_name,
          p1.name as embark_port_name,
          p2.name as disembark_port_name,
          c.port_ids,
          c.region_ids,
          cp.cheapest_price,
          cp.interior_price,
          cp.oceanview_price,
          cp.balcony_price,
          cp.suite_price
        FROM cruises c
        LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
        LEFT JOIN ships s ON c.ship_id = s.id
        LEFT JOIN ports p1 ON c.embarkation_port_id = p1.id
        LEFT JOIN ports p2 ON c.disembarkation_port_id = p2.id
        LEFT JOIN cheapest_pricing cp ON cp.cruise_id = c.id
        WHERE ${whereClause}
        ORDER BY c.sailing_date ASC
        LIMIT 100
      `;

      const results = await sql.unsafe(query, params);

      res.json({
        success: true,
        count: results.length,
        results,
      });
    } catch (error: any) {
      logger.error('Search by ship and date failed:', error);
      res.status(500).json({
        error: 'Search failed',
        message: error.message,
      });
    }
  }

  /**
   * Get all ships with upcoming cruises
   */
  async getShipsWithCruises(req: Request, res: Response): Promise<void> {
    try {
      const ships = await sql`
        SELECT DISTINCT
          s.id,
          s.name as ship_name,
          cl.name as cruise_line_name,
          COUNT(DISTINCT c.id) as cruise_count,
          MIN(c.sailing_date) as next_sailing,
          MAX(c.sailing_date) as last_sailing
        FROM ships s
        JOIN cruises c ON c.ship_id = s.id
        LEFT JOIN cruise_lines cl ON s.cruise_line_id = cl.id
        WHERE c.sailing_date >= CURRENT_DATE
        GROUP BY s.id, s.name, cl.name
        ORDER BY s.name
      `;

      res.json({
        success: true,
        count: ships.length,
        ships,
      });
    } catch (error: any) {
      logger.error('Get ships failed:', error);
      res.status(500).json({
        error: 'Failed to get ships',
        message: error.message,
      });
    }
  }

  /**
   * Get all sailing dates for a specific ship
   */
  async getShipSailings(req: Request, res: Response): Promise<void> {
    try {
      const { shipId } = req.params;

      const sailings = await sql`
        SELECT
          c.id,
          c.cruise_id,
          c.name,
          c.sailing_date,
          c.nights,
          p1.name as embark_port,
          p2.name as disembark_port
        FROM cruises c
        LEFT JOIN ports p1 ON c.embarkation_port_id = p1.id
        LEFT JOIN ports p2 ON c.disembarkation_port_id = p2.id
        WHERE c.ship_id = ${shipId}
        AND c.sailing_date >= CURRENT_DATE
        ORDER BY c.sailing_date ASC
      `;

      res.json({
        success: true,
        count: sailings.length,
        sailings,
      });
    } catch (error: any) {
      logger.error('Get ship sailings failed:', error);
      res.status(500).json({
        error: 'Failed to get ship sailings',
        message: error.message,
      });
    }
  }
}

export const searchSimpleController = new SearchSimpleController();
