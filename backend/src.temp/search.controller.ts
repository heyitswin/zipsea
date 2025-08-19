import { Request, Response } from 'express';
import { z } from 'zod';
import { SearchService } from '../services/search.service';
import { db } from '../db/connection';
import { cacheManager } from '../cache/cache-manager';
import logger from '../config/logger';
import { ApiResponse, CruiseSearchParams, CruiseSearchResult, SearchFilters } from '../types/api.types';

// Validation schemas
const cruiseSearchSchema = z.object({
  destination: z.string().optional(),
  departurePort: z.string().optional(),
  cruiseLine: z.string().optional(),
  ship: z.string().optional(),
  minNights: z.number().int().min(1).max(365).optional(),
  maxNights: z.number().int().min(1).max(365).optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  sailingDateFrom: z.string().datetime().optional(),
  sailingDateTo: z.string().datetime().optional(),
  cabinType: z.enum(['interior', 'oceanview', 'balcony', 'suite']).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['price', 'date', 'nights', 'name']).default('price'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  q: z.string().optional(),
});

class SearchController {
  private searchService: SearchService;

  constructor() {
    this.searchService = new SearchService(db, cacheManager);
  }

  /**
   * POST /api/v1/search
   * Advanced cruise search with filters
   */
  async searchCruises(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = cruiseSearchSchema.parse({
        ...req.body,
        ...req.query, // Allow search params in query string too
      });

      logger.info('Cruise search request received', {
        params: validatedData,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      const searchParams: CruiseSearchParams = validatedData;
      const result = await this.searchService.searchCruises(searchParams);

      const response: ApiResponse<CruiseSearchResult> = {
        success: true,
        data: result,
        meta: result.meta,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Search cruises failed', { error, body: req.body });
      
      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: {
            message: 'Invalid search parameters',
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
          message: 'Search failed',
          code: 'SEARCH_ERROR',
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
   * GET /api/v1/search/filters
   * Get available filter options for search
   */
  async getFilters(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Getting search filters');

      const filters = await this.searchService.getAvailableFilters();

      const response: ApiResponse<SearchFilters> = {
        success: true,
        data: filters,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Get filters failed', { error });

      const response: ApiResponse = {
        success: false,
        error: {
          message: 'Failed to get search filters',
          code: 'FILTERS_ERROR',
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
   * GET /api/v1/search/popular
   * Get popular destinations and search trends
   */
  async getPopular(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Getting popular destinations');

      const popular = await this.searchService.getPopularDestinations();

      const response: ApiResponse = {
        success: true,
        data: popular,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Get popular destinations failed', { error });

      const response: ApiResponse = {
        success: false,
        error: {
          message: 'Failed to get popular destinations',
          code: 'POPULAR_ERROR',
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
   * GET /api/v1/search/suggestions
   * Get search suggestions based on query
   */
  async getSuggestions(req: Request, res: Response): Promise<void> {
    try {
      const { q } = req.query;

      if (!q || typeof q !== 'string' || q.trim().length < 2) {
        const response: ApiResponse = {
          success: false,
          error: {
            message: 'Query parameter "q" is required and must be at least 2 characters',
            code: 'VALIDATION_ERROR',
            status: 400,
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        };
        res.status(400).json(response);
        return;
      }

      logger.info('Getting search suggestions', { query: q });

      const suggestions = await this.searchService.getSuggestions(q.trim());

      const response: ApiResponse = {
        success: true,
        data: suggestions,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Get suggestions failed', { error, query: req.query.q });

      const response: ApiResponse = {
        success: false,
        error: {
          message: 'Failed to get search suggestions',
          code: 'SUGGESTIONS_ERROR',
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

export const searchController = new SearchController();
export default searchController;