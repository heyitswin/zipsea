import { Request, Response } from 'express';
import { shipService } from '../services/ship.service';
import { logger } from '../config/logger';

class ShipController {
  
  /**
   * GET /api/v1/ships
   * Get all ships with optional search filter
   */
  async getShips(req: Request, res: Response): Promise<void> {
    try {
      const searchTerm = req.query.search as string;
      
      let ships;
      if (searchTerm) {
        ships = await shipService.searchShips(searchTerm);
      } else {
        ships = await shipService.getAllShips();
      }

      res.json({
        success: true,
        data: {
          ships,
          total: ships.length,
        },
      });
    } catch (error) {
      logger.error('Get ships failed:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to get ships',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * GET /api/v1/ships/:id
   * Get detailed ship information by ID
   */
  async getShipById(req: Request, res: Response): Promise<void> {
    try {
      const shipId = Number(req.params.id);
      
      if (isNaN(shipId)) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid ship ID',
            details: 'Ship ID must be a number',
          },
        });
        return;
      }

      const ship = await shipService.getShipById(shipId);
      
      if (!ship) {
        res.status(404).json({
          success: false,
          error: {
            message: 'Ship not found',
            details: `Ship with ID ${shipId} does not exist`,
          },
        });
        return;
      }

      res.json({
        success: true,
        data: ship,
      });
    } catch (error) {
      logger.error(`Get ship by ID failed for ID ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to get ship details',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * GET /api/v1/ships/search
   * Search ships by name or cruise line
   */
  async searchShips(req: Request, res: Response): Promise<void> {
    try {
      const searchTerm = req.query.q as string;
      
      if (!searchTerm) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Search term is required',
            details: 'Please provide a search term using the "q" parameter',
          },
        });
        return;
      }

      const ships = await shipService.searchShips(searchTerm);

      res.json({
        success: true,
        data: {
          ships,
          total: ships.length,
          searchTerm,
        },
      });
    } catch (error) {
      logger.error(`Search ships failed for term "${req.query.q}":`, error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to search ships',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
}

export const shipController = new ShipController();