import { Router } from 'express';
import { bookingController } from '../controllers/booking.controller';
import { authenticateToken, authenticateTokenOptional, authenticateAdmin } from '../middleware/auth';

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
