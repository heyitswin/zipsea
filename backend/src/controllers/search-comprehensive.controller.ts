/**
 * Comprehensive search controller
 * Handles all search requests with full filtering capabilities
 */

import { Request, Response } from 'express';
import { comprehensiveSearchService } from '../services/search-comprehensive.service';
import type {
  ComprehensiveSearchFilters,
  SearchOptions,
} from '../services/search-comprehensive.service';
import logger from '../config/logger';

class SearchComprehensiveController {
  /**
   * Main search endpoint with all filters
   * GET /api/v1/search/comprehensive
   */
  async search(req: Request, res: Response): Promise<void> {
    try {
      const startTime = Date.now();

      // Parse filters from query params
      const filters: ComprehensiveSearchFilters = {
        // Text search
        q: req.query.q as string,

        // Date filters
        departureMonth: req.query.departureMonth as string, // YYYY-MM
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,

        // Location filters - support both single and array values
        cruiseLineId: req.query.cruiseLineId
          ? Array.isArray(req.query.cruiseLineId)
            ? req.query.cruiseLineId.map(Number)
            : Number(req.query.cruiseLineId)
          : undefined,
        shipId: req.query.shipId
          ? Array.isArray(req.query.shipId)
            ? req.query.shipId.map(Number)
            : Number(req.query.shipId)
          : undefined,
        departurePortId: req.query.departurePortId
          ? Array.isArray(req.query.departurePortId)
            ? req.query.departurePortId.map(Number)
            : Number(req.query.departurePortId)
          : undefined,
        arrivalPortId: req.query.arrivalPortId
          ? Array.isArray(req.query.arrivalPortId)
            ? req.query.arrivalPortId.map(Number)
            : Number(req.query.arrivalPortId)
          : undefined,
        regionId: req.query.regionId
          ? Array.isArray(req.query.regionId)
            ? req.query.regionId.map(Number)
            : Number(req.query.regionId)
          : undefined,

        // Trip characteristics
        minNights: req.query.minNights ? Number(req.query.minNights) : undefined,
        maxNights: req.query.maxNights ? Number(req.query.maxNights) : undefined,
        nights: req.query.nights ? Number(req.query.nights) : undefined,

        // Price filters
        minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
        maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
        currency: (req.query.currency as string) || 'USD',

        // Cabin filters
        cabinType: req.query.cabinType
          ? Array.isArray(req.query.cabinType)
            ? (req.query.cabinType as string[])
            : [req.query.cabinType as string]
          : undefined,

        // Other
        passengers: req.query.passengers ? Number(req.query.passengers) : undefined,
        includeUnavailable: req.query.includeUnavailable === 'true',
      };

      // Parse options
      const options: SearchOptions = {
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Math.min(Number(req.query.limit), 100) : 20,
        sortBy: (req.query.sortBy as 'date' | 'price' | 'nights' | 'popularity') || 'date',
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'asc',
        includeFacets: req.query.includeFacets === 'true',
      };

      // Remove undefined values from filters
      Object.keys(filters).forEach(key => {
        if (filters[key as keyof ComprehensiveSearchFilters] === undefined) {
          delete filters[key as keyof ComprehensiveSearchFilters];
        }
      });

      // Perform search
      const results = await comprehensiveSearchService.searchCruises(filters, options);

      // Log slow queries
      const totalTime = Date.now() - startTime;
      if (totalTime > 1000) {
        logger.warn('Slow comprehensive search request', {
          filters,
          options,
          totalTime,
          resultCount: results.results.length,
        });
      }

      res.json(results);
    } catch (error: any) {
      logger.error('Comprehensive search failed:', error);
      res.status(500).json({
        error: 'Search failed',
        message: error.message,
      });
    }
  }

  /**
   * Get search facets/filters
   * GET /api/v1/search/comprehensive/facets
   */
  async getFacets(req: Request, res: Response): Promise<void> {
    try {
      // Parse current filters to get contextual facets
      const filters: ComprehensiveSearchFilters = {
        cruiseLineId: req.query.cruiseLineId
          ? Array.isArray(req.query.cruiseLineId)
            ? req.query.cruiseLineId.map(Number)
            : Number(req.query.cruiseLineId)
          : undefined,
        regionId: req.query.regionId
          ? Array.isArray(req.query.regionId)
            ? req.query.regionId.map(Number)
            : Number(req.query.regionId)
          : undefined,
        departureMonth: req.query.departureMonth as string,
      };

      const facets = await comprehensiveSearchService.getSearchFacets(filters);

      res.json(facets);
    } catch (error: any) {
      logger.error('Get facets failed:', error);
      res.status(500).json({
        error: 'Failed to get search facets',
        message: error.message,
      });
    }
  }

  /**
   * Get popular cruises
   * GET /api/v1/search/comprehensive/popular
   */
  async getPopular(req: Request, res: Response): Promise<void> {
    try {
      const limit = req.query.limit ? Math.min(Number(req.query.limit), 50) : 10;

      const cruises = await comprehensiveSearchService.getPopularCruises(limit);

      res.json({
        cruises,
        meta: {
          total: cruises.length,
        },
      });
    } catch (error: any) {
      logger.error('Get popular cruises failed:', error);
      res.status(500).json({
        error: 'Failed to get popular cruises',
        message: error.message,
      });
    }
  }

  /**
   * Get search suggestions
   * GET /api/v1/search/comprehensive/suggestions
   */
  async getSuggestions(req: Request, res: Response): Promise<void> {
    try {
      const query = req.query.q as string;

      if (!query || query.length < 2) {
        res.json([]);
        return;
      }

      const limit = req.query.limit ? Math.min(Number(req.query.limit), 20) : 10;

      const suggestions = await comprehensiveSearchService.getSuggestions(query, limit);

      res.json(suggestions);
    } catch (error: any) {
      logger.error('Get suggestions failed:', error);
      res.status(500).json({
        error: 'Failed to get suggestions',
        message: error.message,
      });
    }
  }
}

export const searchComprehensiveController = new SearchComprehensiveController();
