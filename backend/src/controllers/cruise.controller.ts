import { Request, Response } from 'express';
import { cruiseService } from '../services/cruise.service';
import { searchService } from '../services/search.service';
import { searchHotfixService } from '../services/search-hotfix.service';
import { logger } from '../config/logger';

class CruiseController {
  async listCruises(req: Request, res: Response): Promise<void> {
    try {
      // HOTFIX: Use simpler query until search service is optimized
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const offset = (page - 1) * limit;
      
      const results = await searchHotfixService.getSimpleCruiseList(limit, offset);

      res.json({
        success: true,
        data: {
          cruises: results.cruises,
          meta: results.meta,
        },
      });
    } catch (error) {
      logger.error('List cruises failed:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to list cruises',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  async getCruiseDetails(req: Request, res: Response): Promise<void> {
    try {
      const cruiseId = Number(req.params.id);
      
      if (isNaN(cruiseId)) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid cruise ID',
            details: 'Cruise ID must be a number',
          },
        });
        return;
      }

      const cruiseDetails = await cruiseService.getCruiseDetails(cruiseId);
      
      if (!cruiseDetails) {
        res.status(404).json({
          success: false,
          error: {
            message: 'Cruise not found',
            details: `Cruise with ID ${cruiseId} does not exist`,
          },
        });
        return;
      }

      res.json({
        success: true,
        data: cruiseDetails,
      });
    } catch (error) {
      logger.error(`Get cruise details failed for ID ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to get cruise details',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  async getCruisePricing(req: Request, res: Response): Promise<void> {
    try {
      const cruiseId = Number(req.params.id);
      const cabinType = req.query.cabinType as string;
      const rateCode = req.query.rateCode as string;
      
      if (isNaN(cruiseId)) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid cruise ID',
            details: 'Cruise ID must be a number',
          },
        });
        return;
      }

      const pricing = await cruiseService.getCruisePricing(cruiseId, cabinType, rateCode);

      res.json({
        success: true,
        data: pricing,
      });
    } catch (error) {
      logger.error(`Get cruise pricing failed for ID ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to get cruise pricing',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  async getCruiseAvailability(req: Request, res: Response): Promise<void> {
    try {
      const cruiseId = Number(req.params.id);
      
      if (isNaN(cruiseId)) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid cruise ID',
            details: 'Cruise ID must be a number',
          },
        });
        return;
      }

      const availability = await cruiseService.checkCruiseAvailability(cruiseId);

      res.json({
        success: true,
        data: availability,
      });
    } catch (error) {
      logger.error(`Get cruise availability failed for ID ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to get cruise availability',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  async getCruiseItinerary(req: Request, res: Response): Promise<void> {
    try {
      const cruiseId = Number(req.params.id);
      
      if (isNaN(cruiseId)) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid cruise ID',
            details: 'Cruise ID must be a number',
          },
        });
        return;
      }

      const itinerary = await cruiseService.getCruiseItinerary(cruiseId);

      res.json({
        success: true,
        data: { itinerary },
      });
    } catch (error) {
      logger.error(`Get cruise itinerary failed for ID ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to get cruise itinerary',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  async getCabinPricing(req: Request, res: Response): Promise<void> {
    try {
      const cruiseId = Number(req.params.id);
      const cabinCode = req.params.cabinCode as string;
      
      if (isNaN(cruiseId)) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid cruise ID',
            details: 'Cruise ID must be a number',
          },
        });
        return;
      }

      if (!cabinCode) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Cabin code is required',
            details: 'Please provide a valid cabin code',
          },
        });
        return;
      }

      // Get pricing for specific cabin
      const pricing = await cruiseService.getCruisePricing(cruiseId);
      const cabinPricing = pricing.groupedByCabin[cabinCode] || [];

      res.json({
        success: true,
        data: { 
          cruiseId,
          cabinCode,
          pricing: cabinPricing 
        },
      });
    } catch (error) {
      logger.error(`Get cabin pricing failed for cruise ${req.params.id}, cabin ${req.params.cabinCode}:`, error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to get cabin pricing',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  async getShipDetails(req: Request, res: Response): Promise<void> {
    try {
      // For now, get ship details through cruise details
      // In the future, you might want a dedicated ship service
      const cruiseId = Number(req.params.id);
      
      if (isNaN(cruiseId)) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid cruise ID',
            details: 'Cruise ID must be a number',
          },
        });
        return;
      }

      const cruiseDetails = await cruiseService.getCruiseDetails(cruiseId);
      
      if (!cruiseDetails) {
        res.status(404).json({
          success: false,
          error: {
            message: 'Cruise not found',
            details: `Cruise with ID ${cruiseId} does not exist`,
          },
        });
        return;
      }

      res.json({
        success: true,
        data: {
          ship: cruiseDetails.ship,
          cabinCategories: cruiseDetails.cabinCategories,
        },
      });
    } catch (error) {
      logger.error(`Get ship details failed for cruise ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to get ship details',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  async getAlternativeSailings(req: Request, res: Response): Promise<void> {
    try {
      const cruiseId = Number(req.params.id);
      
      if (isNaN(cruiseId)) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid cruise ID',
            details: 'Cruise ID must be a number',
          },
        });
        return;
      }

      const alternatives = await cruiseService.getAlternativeSailings(cruiseId);

      res.json({
        success: true,
        data: { alternatives },
      });
    } catch (error) {
      logger.error(`Get alternative sailings failed for ID ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to get alternative sailings',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
}

export const cruiseController = new CruiseController();