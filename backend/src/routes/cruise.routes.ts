import { Router, Request, Response } from 'express';
import { cruiseController } from '../controllers/cruise.controller';
import { db } from '../db/connection';
import { sql } from 'drizzle-orm';
import { liveBookingFilter } from '../middleware/live-booking-filter';

const router = Router();

// Apply live booking filter to all cruise routes
router.use(liveBookingFilter);

/**
 * GET /api/v1/cruises
 * List cruises with pagination and basic filters
 */
router.get('/', cruiseController.listCruises.bind(cruiseController));

/**
 * GET /api/v1/cruises/available-dates
 * Get available sailing dates for a specific ship
 */
router.get('/available-dates', async (req: Request, res: Response) => {
  try {
    const shipId = parseInt(req.query.shipId as string);

    if (!shipId || isNaN(shipId)) {
      return res.status(400).json({
        error: 'Invalid shipId parameter',
        message: 'Please provide a valid numeric shipId',
      });
    }

    const result = await db.execute(sql`
      SELECT DISTINCT
        c.id,
        c.cruise_id,
        c.name,
        c.sailing_date,
        c.nights,
        ep.name as embark_port_name,
        dp.name as disembark_port_name,
        MIN(CAST(p.price AS DECIMAL)) as min_price
      FROM cruises c
      LEFT JOIN pricing p ON c.id = p.cruise_id
      LEFT JOIN ports ep ON c.embarkation_port_id = ep.id
      LEFT JOIN ports dp ON c.disembarkation_port_id = dp.id
      WHERE c.ship_id = ${shipId}
        AND c.sailing_date >= CURRENT_DATE + INTERVAL '14 days'
        AND c.is_active = true
      GROUP BY
        c.id,
        c.cruise_id,
        c.name,
        c.sailing_date,
        c.nights,
        ep.name,
        dp.name
      ORDER BY c.sailing_date ASC
    `);

    return res.json({
      shipId,
      dates: result.rows || [],
      count: result.rows?.length || 0,
    });
  } catch (error) {
    console.error('Error fetching available dates:', error);
    return res.status(500).json({
      error: 'Failed to fetch available dates',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

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
router.get(
  '/:id/comprehensive',
  cruiseController.getComprehensiveCruiseData.bind(cruiseController)
);

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
