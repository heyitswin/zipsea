import { Router } from 'express';
import { bookingController } from '../controllers/booking.controller';
import {
  authenticateToken,
  authenticateTokenOptional,
  authenticateAdmin,
} from '../middleware/auth';

const router = Router();

/**
 * Booking Routes
 *
 * These routes handle the complete live booking flow with Traveltek API.
 * Most routes support optional authentication for guest bookings,
 * but booking management requires authentication.
 */

// Session Management
/**
 * POST /api/booking/session
 * Create a new booking session
 *
 * Body:
 * - cruiseId: string (required)
 * - passengerCount: { adults: number, children: number, childAges: number[] } (required)
 *
 * Auth: Optional (for guest bookings)
 */
router.post('/session', authenticateTokenOptional, bookingController.createSession);

/**
 * GET /api/booking/session/:sessionId
 * Get session data
 *
 * Auth: Optional
 */
router.get('/session/:sessionId', bookingController.getSession);

/**
 * PATCH /api/booking/session/:sessionId
 * Update session data (e.g., set isHoldBooking flag)
 *
 * Body:
 * - isHoldBooking: boolean (optional)
 *
 * Auth: Optional
 */
router.patch('/session/:sessionId', bookingController.updateSession);

// Cabin Pricing & Selection
/**
 * GET /api/booking/:sessionId/pricing
 * Get live cabin pricing for the cruise in the session
 *
 * Query params:
 * - cruiseId: string (required)
 *
 * Auth: Optional
 */
router.get('/:sessionId/pricing', bookingController.getCabinPricing);

/**
 * GET /api/booking/:sessionId/commissionable-fare/:gradeNo/:rateCode/:resultNo
 * Get commissionable cruise fare for a cabin grade (for accurate OBC calculation)
 *
 * Returns the base cruise fare (commissionable amount only, excluding taxes/fees)
 * This is used to calculate onboard credit based on the actual fare rather than cached prices
 *
 * Path params:
 * - sessionId: string (required)
 * - gradeNo: string (required - cabin grade number)
 * - rateCode: string (required - rate/fare code)
 * - resultNo: string (required - cruise result number)
 *
 * Auth: Optional
 */
router.get(
  '/:sessionId/commissionable-fare/:gradeNo/:rateCode/:resultNo',
  bookingController.getCommissionableFare
);

/**
 * GET /api/booking/:sessionId/specific-cabins
 * Get list of specific cabins for a cabin grade
 *
 * Query params:
 * - cruiseId: string (required)
 * - resultNo: string (required - from pricing response)
 * - gradeNo: string (required - from pricing response)
 * - rateCode: string (required - from pricing response)
 *
 * Auth: Optional
 */
router.get('/:sessionId/specific-cabins', bookingController.getSpecificCabins);

/**
 * POST /api/booking/:sessionId/select-cabin
 * Select a cabin and add to basket
 *
 * Body:
 * - resultNo: string (required - from pricing response)
 * - gradeNo: string (required - from pricing response)
 * - rateCode: string (required - from pricing response)
 * - cabinResult: string (optional - specific cabin number)
 *
 * Auth: Optional
 */
router.post('/:sessionId/select-cabin', bookingController.selectCabin);

/**
 * GET /api/booking/:sessionId/basket
 * Get current basket contents
 *
 * Auth: Optional
 */
router.get('/:sessionId/basket', bookingController.getBasket);

// Booking Creation
/**
 * POST /api/booking/:sessionId/create
 * Create booking with passenger details and payment
 *
 * Body:
 * - passengers: Array<PassengerDetails> (required)
 * - contact: ContactDetails (required)
 * - payment: PaymentDetails (required)
 * - dining: string (required - dining selection code)
 *
 * Auth: Optional (but recommended for user tracking)
 */
router.post('/:sessionId/create', authenticateTokenOptional, bookingController.createBooking);

/**
 * POST /api/booking/:sessionId/hold
 * Create a hold booking without payment (reserves cabin for free)
 *
 * Body:
 * - firstName: string (required)
 * - lastName: string (required)
 * - email: string (required)
 * - phone: string (required)
 * - holdDurationDays: number (optional - defaults to 7 days)
 *
 * Auth: Optional
 */
router.post('/:sessionId/hold', authenticateTokenOptional, bookingController.createHoldBooking);

/**
 * POST /api/booking/:bookingId/complete-payment
 * Complete payment for a held booking
 *
 * Body:
 * - passengers: Array<PassengerDetails> (required - full details)
 * - contact: ContactDetails (required - full details)
 * - payment: PaymentDetails (required)
 *
 * Auth: Optional (but recommended)
 */
router.post(
  '/:bookingId/complete-payment',
  authenticateTokenOptional,
  bookingController.completeHoldPayment
);

// Booking Management (Auth Required)
/**
 * GET /api/booking/:bookingId
 * Get booking details
 *
 * Auth: Required
 */
router.get('/:bookingId', authenticateToken, bookingController.getBooking);

/**
 * GET /api/booking/user/bookings
 * Get all bookings for the authenticated user
 *
 * Auth: Required
 */
router.get('/user/bookings', authenticateToken, bookingController.getUserBookings);

/**
 * POST /api/booking/:bookingId/cancel
 * Cancel a booking
 *
 * Auth: Required
 */
router.post('/:bookingId/cancel', authenticateToken, bookingController.cancelBooking);

// Session Cleanup (Admin Only)
/**
 * POST /api/booking/cleanup-sessions
 * Cleanup expired sessions
 *
 * Auth: Admin only
 */
router.post('/cleanup-sessions', authenticateAdmin, bookingController.cleanupSessions);

export default router;
