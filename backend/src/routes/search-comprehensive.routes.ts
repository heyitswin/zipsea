/**
 * Comprehensive search routes
 * All-in-one search endpoint with full filtering capabilities
 */

import { Router } from 'express';
import { searchComprehensiveController } from '../controllers/search-comprehensive.controller';

const router = Router();

/**
 * @route GET /api/v1/search/comprehensive
 * @desc Main comprehensive search endpoint with all filters
 * @query {string} q - General search query
 * @query {string} departureMonth - Filter by departure month (YYYY-MM)
 * @query {string} startDate - Filter cruises departing after this date (YYYY-MM-DD)
 * @query {string} endDate - Filter cruises departing before this date (YYYY-MM-DD)
 * @query {number|number[]} cruiseLineId - Filter by cruise line ID(s)
 * @query {number|number[]} shipId - Filter by ship ID(s)
 * @query {number|number[]} departurePortId - Filter by departure port ID(s)
 * @query {number|number[]} arrivalPortId - Filter by arrival port ID(s)
 * @query {number|number[]} regionId - Filter by region ID(s)
 * @query {number} nights - Filter by exact number of nights
 * @query {number} minNights - Filter by minimum nights
 * @query {number} maxNights - Filter by maximum nights
 * @query {number} minPrice - Filter by minimum price
 * @query {number} maxPrice - Filter by maximum price
 * @query {string} currency - Price currency (default: USD)
 * @query {string|string[]} cabinType - Filter by cabin type(s)
 * @query {number} passengers - Number of passengers
 * @query {boolean} includeUnavailable - Include unavailable cruises
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Results per page (max: 100, default: 20)
 * @query {string} sortBy - Sort by: date, price, nights, popularity (default: date)
 * @query {string} sortOrder - Sort order: asc, desc (default: asc)
 * @query {boolean} includeFacets - Include search facets in response
 */
router.get('/', searchComprehensiveController.search.bind(searchComprehensiveController));

/**
 * @route GET /api/v1/search/comprehensive/facets
 * @desc Get available search facets/filters with counts
 * @query {number|number[]} cruiseLineId - Current cruise line filter
 * @query {number|number[]} regionId - Current region filter
 * @query {string} departureMonth - Current departure month filter
 */
router.get('/facets', searchComprehensiveController.getFacets.bind(searchComprehensiveController));

/**
 * @route GET /api/v1/search/comprehensive/popular
 * @desc Get popular cruises
 * @query {number} limit - Maximum results (max: 50, default: 10)
 */
router.get('/popular', searchComprehensiveController.getPopular.bind(searchComprehensiveController));

/**
 * @route GET /api/v1/search/comprehensive/suggestions
 * @desc Get search suggestions for autocomplete
 * @query {string} q - Search query (minimum 2 characters)
 * @query {number} limit - Maximum suggestions (max: 20, default: 10)
 */
router.get('/suggestions', searchComprehensiveController.getSuggestions.bind(searchComprehensiveController));

export default router;
