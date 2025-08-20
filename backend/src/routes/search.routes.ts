import { Router } from 'express';
import { searchController } from '../controllers/search.controller';

const router = Router();

/**
 * GET /api/v1/search
 * Advanced cruise search with filters (supports both GET and POST)
 */
router.get('/', searchController.searchCruises.bind(searchController));

/**
 * POST /api/v1/search
 * Advanced cruise search with filters (for complex filter objects)
 */
router.post('/', searchController.searchCruises.bind(searchController));

/**
 * GET /api/v1/search/filters
 * Get available filter options for search
 */
router.get('/filters', searchController.getFilters.bind(searchController));

/**
 * GET /api/v1/search/popular
 * Get popular destinations and cruise trends
 */
router.get('/popular', searchController.getPopular.bind(searchController));

/**
 * GET /api/v1/search/recommendations
 * Get personalized cruise recommendations
 */
router.get('/recommendations', searchController.getRecommendations.bind(searchController));

/**
 * GET /api/v1/search/suggestions
 * Get search suggestions and autocomplete based on query
 */
router.get('/suggestions', searchController.getSuggestions.bind(searchController));

// Rate limiting middleware for search endpoints (if needed)
// router.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

export default router;