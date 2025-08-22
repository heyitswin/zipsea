import { Router } from 'express';
import { searchOptimizedController } from '../controllers/search-optimized.controller';
import { searchSimpleController } from '../controllers/search-simple.controller';

const router = Router();

/**
 * Optimized search routes using raw SQL for performance
 */

/**
 * GET /api/v1/search
 * Main search endpoint - optimized with raw SQL
 */
router.get('/', searchOptimizedController.searchCruises.bind(searchOptimizedController));

/**
 * POST /api/v1/search
 * Main search endpoint (POST) - for complex filter objects
 */
router.post('/', searchOptimizedController.searchCruises.bind(searchOptimizedController));

/**
 * GET /api/v1/search/cruises
 * Simple cruise list endpoint
 */
router.get('/cruises', searchOptimizedController.getCruiseList.bind(searchOptimizedController));

/**
 * GET /api/v1/search/filters
 * Get available filter options with counts
 */
router.get('/filters', searchOptimizedController.getSearchFilters.bind(searchOptimizedController));

/**
 * GET /api/v1/search/popular
 * Get popular cruises
 */
router.get('/popular', searchOptimizedController.getPopularCruises.bind(searchOptimizedController));

/**
 * GET /api/v1/search/suggestions
 * Get search suggestions/autocomplete
 */
router.get('/suggestions', searchOptimizedController.getSuggestions.bind(searchOptimizedController));

/**
 * GET /api/v1/search/by-ship
 * Find cruises by ship name and date - PRIMARY USE CASE
 */
router.get('/by-ship', searchSimpleController.findByShipAndDate.bind(searchSimpleController));

/**
 * GET /api/v1/search/ships
 * Get all ships with cruise counts
 */
router.get('/ships', searchSimpleController.getShipsWithCruises.bind(searchSimpleController));

/**
 * GET /api/v1/search/ships/:shipId/sailings
 * Get all sailings for a specific ship
 */
router.get('/ships/:shipId/sailings', searchSimpleController.getShipSailings.bind(searchSimpleController));

export default router;