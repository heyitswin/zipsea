import { Request, Response } from 'express';
import { sql } from '../config/database';
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
        SELECT DISTINCT dp.id, dp.name
        FROM departure_ports dp
        INNER JOIN cruises c ON c.departure_port_id = dp.id
        WHERE c.is_active = true
        AND c.sailing_date >= CURRENT_DATE
        ORDER BY dp.name ASC
      `;

      // Get unique regions
      const regions = await sql`
        SELECT DISTINCT r.id, r.name
        FROM regions r
        INNER JOIN cruise_regions cr ON cr.region_id = r.id
        INNER JOIN cruises c ON c.id = cr.cruise_id
        WHERE c.is_active = true
        AND c.sailing_date >= CURRENT_DATE
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
