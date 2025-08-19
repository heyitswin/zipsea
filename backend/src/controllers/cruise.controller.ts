import { Request, Response } from 'express';
import { z } from 'zod';
import { CruiseService } from '../services/cruise.service';
import { db } from '../db/connection';
import { cacheManager } from '../cache/cache-manager';
import logger from '../config/logger';
import { ApiResponse, CruiseDetails, CruiseListItem } from '../types/api.types';

// Validation schemas
const cruiseListSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['price', 'date', 'nights', 'name']).default('date'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  cruiseLine: z.string().optional(),
  ship: z.string().optional(),
  departurePort: z.string().optional(),
});

const cruiseIdSchema = z.object({
  id: z.string().transform(val => parseInt(val, 10)).refine(val => !isNaN(val) && val > 0, {
    message: 'Cruise ID must be a positive integer',
  }),
});

const cabinCodeSchema = z.object({
  id: z.string().transform(val => parseInt(val, 10)).refine(val => !isNaN(val) && val > 0),
  cabinCode: z.string().min(1).max(10),
});

class CruiseController {
  private cruiseService: CruiseService;

  constructor() {
    this.cruiseService = new CruiseService(db, cacheManager);
  }

  /**
   * GET /api/v1/cruises
   * List cruises with pagination and basic filters
   */
  async listCruises(req: Request, res: Response): Promise<void> {
    try {
      const validatedParams = cruiseListSchema.parse({
        ...req.query,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      });

      logger.info('List cruises request received', {
        params: validatedParams,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      const result = await this.cruiseService.listCruises(validatedParams);

      const response: ApiResponse<{ cruises: CruiseListItem[]; meta: any }> = {
        success: true,
        data: result,
        meta: result.meta,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('List cruises failed', { error, query: req.query });
      
      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: {
            message: 'Invalid request parameters',
            code: 'VALIDATION_ERROR',
            status: 400,
            details: error.errors,
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        };
        res.status(400).json(response);
        return;
      }

      const response: ApiResponse = {
        success: false,
        error: {
          message: 'Failed to list cruises',
          code: 'CRUISE_LIST_ERROR',
          status: 500,
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      };
      res.status(500).json(response);
    }
  }

  /**
   * GET /api/v1/cruises/:id
   * Get detailed cruise information
   */
  async getCruiseDetails(req: Request, res: Response): Promise<void> {
    try {
      const { id } = cruiseIdSchema.parse({ id: req.params.id });

      logger.info('Get cruise details request received', {
        cruiseId: id,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      const cruise = await this.cruiseService.getCruiseById(id);

      if (!cruise) {
        const response: ApiResponse = {
          success: false,
          error: {
            message: 'Cruise not found',
            code: 'CRUISE_NOT_FOUND',
            status: 404,
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<CruiseDetails> = {
        success: true,
        data: cruise,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Get cruise details failed', { error, cruiseId: req.params.id });
      
      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: {
            message: 'Invalid cruise ID',
            code: 'VALIDATION_ERROR',
            status: 400,
            details: error.errors,
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        };
        res.status(400).json(response);
        return;
      }

      const response: ApiResponse = {
        success: false,
        error: {
          message: 'Failed to get cruise details',
          code: 'CRUISE_DETAILS_ERROR',
          status: 500,
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      };
      res.status(500).json(response);
    }
  }

  /**
   * GET /api/v1/cruises/:id/pricing
   * Get detailed pricing for a cruise
   */
  async getCruisePricing(req: Request, res: Response): Promise<void> {
    try {
      const { id } = cruiseIdSchema.parse({ id: req.params.id });

      logger.info('Get cruise pricing request received', {
        cruiseId: id,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      const pricing = await this.cruiseService.getCruisePricing(id);

      if (!pricing) {
        const response: ApiResponse = {
          success: false,
          error: {
            message: 'Cruise pricing not found',
            code: 'PRICING_NOT_FOUND',
            status: 404,
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: pricing,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Get cruise pricing failed', { error, cruiseId: req.params.id });
      
      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: {
            message: 'Invalid cruise ID',
            code: 'VALIDATION_ERROR',
            status: 400,
            details: error.errors,
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        };
        res.status(400).json(response);
        return;
      }

      const response: ApiResponse = {
        success: false,
        error: {
          message: 'Failed to get cruise pricing',
          code: 'PRICING_ERROR',
          status: 500,
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      };
      res.status(500).json(response);
    }
  }

  /**
   * GET /api/v1/cruises/:id/pricing/:cabinCode
   * Get detailed pricing for a specific cabin type
   */
  async getCabinPricing(req: Request, res: Response): Promise<void> {
    try {
      const { id, cabinCode } = cabinCodeSchema.parse({
        id: req.params.id,
        cabinCode: req.params.cabinCode,
      });

      logger.info('Get cabin pricing request received', {
        cruiseId: id,
        cabinCode,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      const cabinPricing = await this.cruiseService.getCabinPricing(id, cabinCode);

      if (!cabinPricing) {
        const response: ApiResponse = {
          success: false,
          error: {
            message: 'Cabin pricing not found',
            code: 'CABIN_PRICING_NOT_FOUND',
            status: 404,
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: cabinPricing,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Get cabin pricing failed', { 
        error, 
        cruiseId: req.params.id, 
        cabinCode: req.params.cabinCode 
      });
      
      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: {
            message: 'Invalid parameters',
            code: 'VALIDATION_ERROR',
            status: 400,
            details: error.errors,
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        };
        res.status(400).json(response);
        return;
      }

      const response: ApiResponse = {
        success: false,
        error: {
          message: 'Failed to get cabin pricing',
          code: 'CABIN_PRICING_ERROR',
          status: 500,
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      };
      res.status(500).json(response);
    }
  }

  /**
   * GET /api/v1/cruises/:id/itinerary
   * Get detailed itinerary for a cruise
   */
  async getCruiseItinerary(req: Request, res: Response): Promise<void> {
    try {
      const { id } = cruiseIdSchema.parse({ id: req.params.id });

      logger.info('Get cruise itinerary request received', {
        cruiseId: id,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      const itinerary = await this.cruiseService.getCruiseItinerary(id);

      const response: ApiResponse = {
        success: true,
        data: itinerary,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Get cruise itinerary failed', { error, cruiseId: req.params.id });
      
      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: {
            message: 'Invalid cruise ID',
            code: 'VALIDATION_ERROR',
            status: 400,
            details: error.errors,
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        };
        res.status(400).json(response);
        return;
      }

      const response: ApiResponse = {
        success: false,
        error: {
          message: 'Failed to get cruise itinerary',
          code: 'ITINERARY_ERROR',
          status: 500,
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      };
      res.status(500).json(response);
    }
  }

  /**
   * GET /api/v1/cruises/:id/ship
   * Get detailed ship information
   */
  async getShipDetails(req: Request, res: Response): Promise<void> {
    try {
      const { id } = cruiseIdSchema.parse({ id: req.params.id });

      logger.info('Get ship details request received', {
        cruiseId: id,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      const shipDetails = await this.cruiseService.getShipDetails(id);

      if (!shipDetails) {
        const response: ApiResponse = {
          success: false,
          error: {
            message: 'Ship details not found',
            code: 'SHIP_NOT_FOUND',
            status: 404,
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: shipDetails,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Get ship details failed', { error, cruiseId: req.params.id });
      
      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: {
            message: 'Invalid cruise ID',
            code: 'VALIDATION_ERROR',
            status: 400,
            details: error.errors,
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        };
        res.status(400).json(response);
        return;
      }

      const response: ApiResponse = {
        success: false,
        error: {
          message: 'Failed to get ship details',
          code: 'SHIP_DETAILS_ERROR',
          status: 500,
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      };
      res.status(500).json(response);
    }
  }

  /**
   * GET /api/v1/cruises/:id/alternatives
   * Get alternative sailings for the same itinerary
   */
  async getAlternativeSailings(req: Request, res: Response): Promise<void> {
    try {
      const { id } = cruiseIdSchema.parse({ id: req.params.id });

      logger.info('Get alternative sailings request received', {
        cruiseId: id,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      const alternatives = await this.cruiseService.getAlternativeSailings(id);

      const response: ApiResponse = {
        success: true,
        data: alternatives,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Get alternative sailings failed', { error, cruiseId: req.params.id });
      
      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: {
            message: 'Invalid cruise ID',
            code: 'VALIDATION_ERROR',
            status: 400,
            details: error.errors,
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        };
        res.status(400).json(response);
        return;
      }

      const response: ApiResponse = {
        success: false,
        error: {
          message: 'Failed to get alternative sailings',
          code: 'ALTERNATIVES_ERROR',
          status: 500,
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      };
      res.status(500).json(response);
    }
  }
}

export const cruiseController = new CruiseController();
export default cruiseController;