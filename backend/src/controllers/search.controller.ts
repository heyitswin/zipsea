import { Request, Response } from 'express';
import { searchService, SearchFilters, SearchOptions } from '../services/search.service';
import { logger } from '../config/logger';

class SearchController {
  async searchCruises(req: Request, res: Response): Promise<void> {
    try {
      // Parse query parameters
      const filters: SearchFilters = {
        destination: req.query.destination as string,
        departurePort: req.query.departurePort as string,
        cruiseLine: req.query.cruiseLine ? Number(req.query.cruiseLine) : undefined,
        ship: req.query.ship ? Number(req.query.ship) : undefined,
        nights: {
          min: req.query.minNights ? Number(req.query.minNights) : undefined,
          max: req.query.maxNights ? Number(req.query.maxNights) : undefined,
        },
        price: {
          min: req.query.minPrice ? Number(req.query.minPrice) : undefined,
          max: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
        },
        sailingDate: {
          from: req.query.sailingDateFrom as string,
          to: req.query.sailingDateTo as string,
        },
        cabinType: req.query.cabinType as string,
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
      };

      const options: SearchOptions = {
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 20,
        sortBy: req.query.sortBy as any,
        sortOrder: req.query.sortOrder as any,
        includeUnavailable: req.query.includeUnavailable === 'true',
      };

      // Remove undefined values from filters
      Object.keys(filters).forEach(key => {
        const value = filters[key as keyof SearchFilters];
        if (value === undefined || value === '' || value === null) {
          delete filters[key as keyof SearchFilters];
        }
      });

      // Perform search
      const results = await searchService.searchCruises(filters, options);

      res.json({
        success: true,
        data: results,
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
      const limit = req.query.limit ? Number(req.query.limit) : 10;

      if (!query || query.length < 2) {
        res.json({
          success: true,
          data: { suggestions: [] },
        });
        return;
      }

      const suggestions = await searchService.getSearchSuggestions(query, limit);
      
      res.json({
        success: true,
        data: { suggestions },
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
      const limit = req.query.limit ? Number(req.query.limit) : 10;
      const popularCruises = await searchService.getPopularCruises(limit);
      
      res.json({
        success: true,
        data: { 
          cruises: popularCruises,
          count: popularCruises.length 
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
}

export const searchController = new SearchController();