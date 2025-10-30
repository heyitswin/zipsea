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

      logger.info('Search request received', {
        query: req.query,
        url: req.url,
      });

      // Parse filters from query params
      const filters: ComprehensiveSearchFilters = {
        // Text search
        q: req.query.q as string,

        // Date filters - handle multiple months
        // Support both 'departureMonth' and 'months' parameter names
        departureMonth: (() => {
          const param = req.query.departureMonth || req.query.months;
          if (!param) return undefined;
          return Array.isArray(param) ? (param as string[]) : [param as string];
        })(),
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,

        // Location filters - support both single and array values
        // Support both 'cruiseLineId' and 'cruiseLines' parameter names
        cruiseLineId: (() => {
          // If instant booking filter is active, restrict to live-bookable cruise lines
          if (req.query.instantBooking === 'true') {
            return [22, 3]; // Royal Caribbean and Celebrity
          }

          const param = req.query.cruiseLineId || req.query.cruiseLines;
          console.log(
            'Raw cruiseLineId param:',
            param,
            'Type:',
            typeof param,
            'IsArray:',
            Array.isArray(param)
          );
          if (!param) return undefined;
          if (Array.isArray(param)) {
            return param.map(Number).filter(n => !isNaN(n));
          }
          const num = Number(param);
          return !isNaN(num) ? num : undefined;
        })(),
        shipId: (() => {
          const param = req.query.shipId;
          if (!param) return undefined;
          if (Array.isArray(param)) {
            return param.map(Number).filter(n => !isNaN(n));
          }
          const num = Number(param);
          return !isNaN(num) ? num : undefined;
        })(),
        departurePortId: (() => {
          const param = req.query.departurePortId;
          if (!param) return undefined;
          if (Array.isArray(param)) {
            return param.map(Number).filter(n => !isNaN(n));
          }
          const num = Number(param);
          return !isNaN(num) ? num : undefined;
        })(),
        arrivalPortId: (() => {
          const param = req.query.arrivalPortId;
          if (!param) return undefined;
          if (Array.isArray(param)) {
            return param.map(Number).filter(n => !isNaN(n));
          }
          const num = Number(param);
          return !isNaN(num) ? num : undefined;
        })(),
        regionId: (() => {
          const param = req.query.regionId;
          if (!param) return undefined;
          if (Array.isArray(param)) {
            return param.map(Number).filter(n => !isNaN(n));
          }
          const num = Number(param);
          return !isNaN(num) ? num : undefined;
        })(),

        // Trip characteristics - handle nightRange parameter from frontend
        minNights: (() => {
          if (req.query.minNights) return Number(req.query.minNights);
          if (req.query.nightRange) {
            const ranges = Array.isArray(req.query.nightRange)
              ? (req.query.nightRange as string[])
              : [req.query.nightRange as string];
            const minValues = ranges.map(range => {
              if (range === '12+') return 12;
              const [min] = range.split('-');
              return parseInt(min);
            });
            return Math.min(...minValues);
          }
          return undefined;
        })(),
        maxNights: (() => {
          if (req.query.maxNights) return Number(req.query.maxNights);
          if (req.query.nightRange) {
            const ranges = Array.isArray(req.query.nightRange)
              ? (req.query.nightRange as string[])
              : [req.query.nightRange as string];
            const maxValues = ranges.map(range => {
              if (range === '12+') return 999;
              const parts = range.split('-');
              return parseInt(parts[1] || parts[0]);
            });
            return Math.max(...maxValues);
          }
          return undefined;
        })(),
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
      // Handle both page and offset parameters for compatibility
      const limit = req.query.limit ? Math.min(Number(req.query.limit), 100) : 20;
      let page = 1;

      if (req.query.page) {
        page = Number(req.query.page);
      } else if (req.query.offset) {
        // If offset is provided instead of page, calculate page from it
        const offset = Number(req.query.offset);
        page = Math.floor(offset / limit) + 1;
        logger.info(`Calculated page ${page} from offset ${offset} and limit ${limit}`);
      }

      const options: SearchOptions = {
        page,
        limit,
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

      // Perform search with detailed logging
      logger.info('=== COMPREHENSIVE SEARCH DEBUG ===');
      logger.info('Raw query params:', req.query);
      logger.info('Parsed filters:', JSON.stringify(filters, null, 2));
      logger.info('Search options:', JSON.stringify(options, null, 2));

      const results = await comprehensiveSearchService.searchCruises(filters, options);

      logger.info('Search completed:', {
        totalResults: results?.results?.length || 0,
        hasFilters: Object.keys(filters).length > 0,
        appliedFilters: Object.keys(filters),
        firstResult: results?.results?.[0]
          ? {
              id: results.results[0].id,
              name: results.results[0].name,
              cruiseLineId: results.results[0].cruiseLine?.id,
              cruiseLineName: results.results[0].cruiseLine?.name,
              shipId: results.results[0].ship?.id,
              shipName: results.results[0].ship?.name,
              nights: results.results[0].nights,
            }
          : null,
      });

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

      // Add headers to prevent caching
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        Pragma: 'no-cache',
        Expires: '0',
        'Surrogate-Control': 'no-store',
        'X-Response-Time': `${Date.now() - startTime}ms`,
        'X-Request-ID': `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      });

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
        cruiseLineId: (() => {
          const param = req.query.cruiseLineId || req.query.cruiseLines;
          if (!param) return undefined;
          return Array.isArray(param) ? param.map(Number) : Number(param);
        })(),
        regionId: req.query.regionId
          ? Array.isArray(req.query.regionId)
            ? req.query.regionId.map(Number)
            : Number(req.query.regionId)
          : undefined,
        departureMonth: (req.query.departureMonth || req.query.months) as string,
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
