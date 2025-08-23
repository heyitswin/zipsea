import { Router } from 'express';
import { cruiseController } from '../controllers/cruise.controller';

const router = Router();

/**
 * GET /api/v1/cruises
 * List cruises with pagination and basic filters
 */
router.get('/', cruiseController.listCruises.bind(cruiseController));

/**
 * GET /api/v1/cruises/last-minute-deals
 * Get 6 soonest cruises with cheapest pricing, starting from 3 weeks from today
 */
router.get('/last-minute-deals', cruiseController.getLastMinuteDeals.bind(cruiseController));

/**
 * GET /api/v1/cruises/:id
 * Get detailed cruise information
 */
router.get('/:id', cruiseController.getCruiseDetails.bind(cruiseController));

/**
 * GET /api/v1/cruises/:id/pricing
 * Get detailed pricing for a cruise
 */
router.get('/:id/pricing', cruiseController.getCruisePricing.bind(cruiseController));

/**
 * GET /api/v1/cruises/:id/pricing/:cabinCode
 * Get detailed pricing for a specific cabin type
 */
router.get('/:id/pricing/:cabinCode', cruiseController.getCabinPricing.bind(cruiseController));

/**
 * GET /api/v1/cruises/:id/itinerary
 * Get detailed itinerary for a cruise
 */
router.get('/:id/itinerary', cruiseController.getCruiseItinerary.bind(cruiseController));

/**
 * GET /api/v1/cruises/:id/ship
 * Get detailed ship information
 */
router.get('/:id/ship', cruiseController.getShipDetails.bind(cruiseController));

/**
 * GET /api/v1/cruises/:id/alternatives
 * Get alternative sailings for the same itinerary
 */
router.get('/:id/alternatives', cruiseController.getAlternativeSailings.bind(cruiseController));

/**
 * GET /api/v1/cruises/slug/:slug
 * Get cruise details by SEO-friendly slug
 * Format: ship-name-YYYY-MM-DD-cruiseId
 * Example: /api/v1/cruises/slug/symphony-of-the-seas-2025-10-05-2143102
 */
router.get('/slug/:slug', cruiseController.getCruiseBySlug.bind(cruiseController));

/**
 * GET /api/v1/cruises/:id/comprehensive
 * Get comprehensive cruise data with ALL database fields
 */
router.get('/:id/comprehensive', cruiseController.getComprehensiveCruiseData.bind(cruiseController));

/**
 * GET /api/v1/cruises/:id/dump
 * Get complete data dump with all raw database fields (for debugging)
 */
router.get('/:id/dump', cruiseController.dumpCruiseData.bind(cruiseController));

/**
 * GET /api/v1/cruises/find-for-redirect
 * Find cruise by ship name and sailing date for single result redirects
 * Query params: ?shipName=...&sailingDate=YYYY-MM-DD
 */
router.get('/find-for-redirect', cruiseController.findCruiseForRedirect.bind(cruiseController));

export default router;