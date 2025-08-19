import { Router } from 'express';
import { cruiseController } from '../controllers/cruise.controller';

const router = Router();

/**
 * GET /api/v1/cruises
 * List cruises with pagination and basic filters
 */
router.get('/', cruiseController.listCruises.bind(cruiseController));

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

export default router;