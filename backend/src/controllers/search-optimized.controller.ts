import { Request, Response } from 'express';
import { searchOptimizedService } from '../services/search-optimized.service';
import { searchHotfixService } from '../services/search-hotfix.service';
import logger from '../config/logger';

/**
 * Optimized search controller using raw SQL for performance
 */
class SearchOptimizedController {
  
  /**
   * Main search endpoint - uses optimized service
   */
  async searchCruises(req: Request, res: Response): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Parse filters from query params
      const filters: any = {
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
        cabinType: req.query.cabinType,
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
      
      // Parse options
      const options = {
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Math.min(Number(req.query.limit), 100) : 20,
        sortBy: req.query.sortBy as string || 'date',
        sortOrder: req.query.sortOrder as string || 'asc',
        includeUnavailable: req.query.includeUnavailable === 'true',
        facets: req.query.facets === 'true'
      };
      
      // Clean up empty filter values
      Object.keys(filters).forEach(key => {
        if (filters[key] === undefined || filters[key] === '') {
          delete filters[key];
        }
        if (typeof filters[key] === 'object') {
          Object.keys(filters[key]).forEach(subKey => {
            if (filters[key][subKey] === undefined || filters[key][subKey] === '') {
              delete filters[key][subKey];
            }
          });
          if (Object.keys(filters[key]).length === 0) {
            delete filters[key];
          }
        }
      });
      
      // Use optimized service
      const result = await searchOptimizedService.searchCruises(filters, options);
      
      // Log performance
      const totalTime = Date.now() - startTime;
      if (totalTime > 1000) {
        logger.warn('Slow search request', {
          filters,
          options,
          totalTime
        });
      }
      
      res.json(result);
      
    } catch (error: any) {
      logger.error('Search failed:', error);
      res.status(500).json({ 
        error: 'Search failed', 
        message: error.message 
      });
    }
  }
  
  /**
   * Simple cruise list - uses hotfix service for simplicity
   */
  async getCruiseList(req: Request, res: Response): Promise<void> {
    try {
      const limit = req.query.limit ? Math.min(Number(req.query.limit), 100) : 20;
      const offset = req.query.offset ? Number(req.query.offset) : 0;
      
      const result = await searchHotfixService.getSimpleCruiseList(limit, offset);
      
      res.json(result);
      
    } catch (error: any) {
      logger.error('Get cruise list failed:', error);
      res.status(500).json({ 
        error: 'Failed to get cruise list', 
        message: error.message 
      });
    }
  }
  
  /**
   * Get popular cruises
   */
  async getPopularCruises(req: Request, res: Response): Promise<void> {
    try {
      const limit = req.query.limit ? Math.min(Number(req.query.limit), 50) : 10;
      
      const cruises = await searchOptimizedService.getPopularCruises(limit);
      
      res.json({
        cruises,
        meta: {
          total: cruises.length
        }
      });
      
    } catch (error: any) {
      logger.error('Get popular cruises failed:', error);
      res.status(500).json({ 
        error: 'Failed to get popular cruises', 
        message: error.message 
      });
    }
  }
  
  /**
   * Get search filters with counts
   */
  async getSearchFilters(req: Request, res: Response): Promise<void> {
    try {
      const filters = await searchOptimizedService.getSearchFilters();
      
      res.json(filters);
      
    } catch (error: any) {
      logger.error('Get search filters failed:', error);
      res.status(500).json({ 
        error: 'Failed to get search filters', 
        message: error.message 
      });
    }
  }
  
  /**
   * Get search suggestions/autocomplete
   */
  async getSuggestions(req: Request, res: Response): Promise<void> {
    try {
      const query = req.query.q as string;
      
      if (!query || query.length < 2) {
        res.json([]);
        return;
      }
      
      const limit = req.query.limit ? Math.min(Number(req.query.limit), 20) : 10;
      
      const suggestions = await searchOptimizedService.getSuggestions(query, limit);
      
      res.json(suggestions);
      
    } catch (error: any) {
      logger.error('Get suggestions failed:', error);
      res.status(500).json({ 
        error: 'Failed to get suggestions', 
        message: error.message 
      });
    }
  }
}

export const searchOptimizedController = new SearchOptimizedController();