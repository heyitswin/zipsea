import { Request, Response } from 'express';
import { sql } from '../db/connection';
import logger from '../config/logger';

export class FilterOptionsController {
  /**
   * Get all unique filter options from the database
   */
  async getFilterOptions(req: Request, res: Response): Promise<void> {
    try {
      // Get unique cruise lines
      const cruiseLines = await sql`
        SELECT DISTINCT cl.id, cl.name
        FROM cruise_lines cl
        INNER JOIN cruises c ON c.cruise_line_id = cl.id
        WHERE c.is_active = true
        AND c.sailing_date >= CURRENT_DATE
        ORDER BY cl.name ASC
      `;

      // Get unique ships
      const ships = await sql`
        SELECT DISTINCT s.id, s.name
        FROM ships s
        INNER JOIN cruises c ON c.ship_id = s.id
        WHERE c.is_active = true
        AND c.sailing_date >= CURRENT_DATE
        ORDER BY s.name ASC
      `;

      // Get unique departure ports
      const departurePorts = await sql`
        SELECT DISTINCT p.id, p.name
        FROM ports p
        INNER JOIN cruises c ON c.embarkation_port_id = p.id
        WHERE c.is_active = true
        AND c.sailing_date >= CURRENT_DATE
        ORDER BY p.name ASC
      `;

      // Get unique regions
      // Note: region_ids is stored as a JSONB array in cruises table
      const regions = await sql`
        SELECT DISTINCT r.id, r.name
        FROM regions r
        WHERE EXISTS (
          SELECT 1 FROM cruises c
          WHERE c.is_active = true
          AND c.sailing_date >= CURRENT_DATE
          AND c.region_ids::jsonb @> to_jsonb(r.id)
        )
        ORDER BY r.name ASC
      `;

      res.json({
        cruiseLines,
        ships,
        departurePorts,
        regions,
      });
    } catch (error: any) {
      logger.error('Failed to fetch filter options:', error);
      res.status(500).json({
        error: 'Failed to fetch filter options',
        message: error.message,
      });
    }
  }
}

export default new FilterOptionsController();
