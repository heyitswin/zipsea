import { Request, Response } from 'express';
import { searchService, SearchFilters, SearchOptions } from '../services/search.service';
import { logger } from '../config/logger';

// Request validation helpers
const validateSearchQuery = (query: string): { valid: boolean; error?: string } => {
  if (!query) return { valid: false, error: 'Query is required' };
  if (query.length < 2) return { valid: false, error: 'Query must be at least 2 characters' };
  if (query.length > 100) return { valid: false, error: 'Query must be less than 100 characters' };
  if (!/^[a-zA-Z0-9\s\-_.,!?]+$/.test(query)) return { valid: false, error: 'Query contains invalid characters' };
  return { valid: true };
};

const validatePaginationParams = (page?: number, limit?: number): { page: number; limit: number } => {
  const validPage = Math.max(1, page || 1);
  const validLimit = Math.min(100, Math.max(1, limit || 20));
  return { page: validPage, limit: validLimit };
};

class SearchController {
  async searchCruises(req: Request, res: Response): Promise<void> {
    try {
      // Parse query parameters
      const filters: SearchFilters = {
        q: req.query.q as string,
        destination: req.query.destination as string,
        departurePort: req.query.departurePort as string,
        cruiseLine: req.query.cruiseLine ? 
          (Array.isArray(req.query.cruiseLine) ? 
            req.query.cruiseLine.map(Number) : 
            Number(req.query.cruiseLine)
          ) : undefined,
        ship: req.query.ship ? 
          (Array.isArray(req.query.ship) ? 
            req.query.ship.map(Number) : 
            Number(req.query.ship)
          ) : undefined,
        nights: {
          min: req.query.minNights ? Number(req.query.minNights) : undefined,
          max: req.query.maxNights ? Number(req.query.maxNights) : undefined,
        },
        price: {
          min: req.query.minPrice ? Number(req.query.minPrice) : undefined,
          max: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
          currency: req.query.priceCurrency as string,
        },
        sailingDate: {
          from: req.query.sailingDateFrom as string,
          to: req.query.sailingDateTo as string,
        },
        cabinType: req.query.cabinType ? 
          (Array.isArray(req.query.cabinType) ? 
            req.query.cabinType as string[] : 
            req.query.cabinType as string
          ) : undefined,
        passengers: req.query.passengers ? Number(req.query.passengers) : undefined,
        regions: req.query.regions ? 
          (Array.isArray(req.query.regions) ? 
            req.query.regions.map(Number) : 
            [Number(req.query.regions)]
          ) : undefined,
        ports: req.query.ports ? 
          (Array.isArray(req.query.ports) ? 
            req.query.ports.map(Number) : 
            [Number(req.query.ports)]
          ) : undefined,
        includeDeals: req.query.includeDeals === 'true',
        minRating: req.query.minRating ? Number(req.query.minRating) : undefined,
        duration: req.query.duration as 'weekend' | 'week' | 'extended',
      };

      const options: SearchOptions = {
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Math.min(100, Number(req.query.limit)) : 20,
        sortBy: req.query.sortBy as any,
        sortOrder: req.query.sortOrder as any,
        includeUnavailable: req.query.includeUnavailable === 'true',
        facets: req.query.facets === 'true',
        minResponseTime: req.query.fast === 'true',
      };

      // Clean up filters - remove undefined, empty strings, and empty objects
      Object.keys(filters).forEach(key => {
        const value = filters[key as keyof SearchFilters];
        if (value === undefined || value === '' || value === null) {
          delete filters[key as keyof SearchFilters];
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // Clean up nested objects like price and nights
          const cleanObj = Object.fromEntries(
            Object.entries(value).filter(([, v]) => v !== undefined && v !== '' && v !== null)
          );
          if (Object.keys(cleanObj).length === 0) {
            delete filters[key as keyof SearchFilters];
          } else {
            (filters as any)[key] = cleanObj;
          }
        }
      });

      // Validate pagination parameters
      if (options.page && options.page < 1) options.page = 1;
      if (options.limit && options.limit < 1) options.limit = 20;
      if (options.limit && options.limit > 100) options.limit = 100;

      // Perform search
      const results = await searchService.searchCruises(filters, options);

      // Add response timing
      const responseTime = Date.now() - Date.now();
      
      res.json({
        success: true,
        data: results,
        meta: {
          ...results.meta,
          responseTime,
          query: {
            filters: Object.keys(filters).length,
            options: Object.keys(options).length
          }
        },
      });

    } catch (error) {
      logger.error('Search cruises failed:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to search cruises',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  async getSearchFilters(req: Request, res: Response): Promise<void> {
    try {
      const filters = await searchService.getSearchFilters();
      
      res.json({
        success: true,
        data: filters,
      });
    } catch (error) {
      logger.error('Get search filters failed:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to get search filters',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  async getSuggestions(req: Request, res: Response): Promise<void> {
    try {
      const query = req.query.q as string;
      const limit = req.query.limit ? Math.min(20, Number(req.query.limit)) : 10;

      if (!query || query.length < 2) {
        res.json({
          success: true,
          data: { 
            suggestions: [],
            message: 'Query too short - minimum 2 characters required'
          },
        });
        return;
      }

      if (query.length > 100) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Query too long - maximum 100 characters allowed',
          },
        });
        return;
      }

      const suggestions = await searchService.getSearchSuggestions(query, limit);
      
      res.json({
        success: true,
        data: { 
          suggestions,
          query,
          count: suggestions.length
        },
      });
    } catch (error) {
      logger.error('Get suggestions failed:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to get suggestions',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  async getFilters(req: Request, res: Response): Promise<void> {
    // This is an alias for getSearchFilters for backward compatibility
    await this.getSearchFilters(req, res);
  }

  async getPopular(req: Request, res: Response): Promise<void> {
    try {
      const limit = req.query.limit ? Math.min(50, Number(req.query.limit)) : 10;
      const popularCruises = await searchService.getPopularCruises(limit);
      
      res.json({
        success: true,
        data: { 
          cruises: popularCruises,
          count: popularCruises.length,
          meta: {
            limit,
            cached: true // Popular cruises are typically cached
          }
        },
      });
    } catch (error) {
      logger.error('Get popular cruises failed:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to get popular cruises',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  async getRecommendations(req: Request, res: Response): Promise<void> {
    try {
      const limit = req.query.limit ? Math.min(20, Number(req.query.limit)) : 5;
      
      // Extract basic filters for recommendations
      const filters: SearchFilters = {
        cruiseLine: req.query.cruiseLine ? Number(req.query.cruiseLine) : undefined,
        departurePort: req.query.departurePort as string,
        price: {
          max: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
        },
        nights: {
          min: req.query.minNights ? Number(req.query.minNights) : undefined,
          max: req.query.maxNights ? Number(req.query.maxNights) : undefined,
        },
      };

      // Clean up filters
      Object.keys(filters).forEach(key => {
        const value = filters[key as keyof SearchFilters];
        if (value === undefined || value === '' || value === null) {
          delete filters[key as keyof SearchFilters];
        }
      });

      const recommendations = await searchService.getRecommendedCruises(filters, limit);
      
      res.json({
        success: true,
        data: { 
          cruises: recommendations,
          count: recommendations.length,
          filters,
          meta: {
            limit,
            algorithm: 'score-based',
            factors: ['rating', 'price', 'duration', 'sailing_date']
          }
        },
      });
    } catch (error) {
      logger.error('Get recommendations failed:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to get recommendations',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
}

export const searchController = new SearchController();