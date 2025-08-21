import { Router } from 'express';
import { searchOptimizedController } from '../controllers/search-optimized.controller';

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

export default router;