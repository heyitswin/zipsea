import { Router } from 'express';
import { searchController } from '../controllers/search.controller';

const router = Router();

/**
 * POST /api/v1/search
 * Advanced cruise search with filters
 */
router.post('/', searchController.searchCruises.bind(searchController));

/**
 * GET /api/v1/search/filters
 * Get available filter options for search
 */
router.get('/filters', searchController.getFilters.bind(searchController));

/**
 * GET /api/v1/search/popular
 * Get popular destinations and search trends
 */
router.get('/popular', searchController.getPopular.bind(searchController));

/**
 * GET /api/v1/search/suggestions
 * Get search suggestions based on query
 */
router.get('/suggestions', searchController.getSuggestions.bind(searchController));

export default router;