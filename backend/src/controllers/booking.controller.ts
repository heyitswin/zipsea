import { Request, Response } from 'express';
import { traveltekBookingService } from '../services/traveltek-booking.service';
import { traveltekSessionService } from '../services/traveltek-session.service';

/**
 * Booking Controller
 *
 * Handles HTTP requests for the booking API.
 * Validates input and delegates to booking services.
 */
class BookingController {
  /**
   * POST /api/booking/session
   * Create a new booking session
   */
  async createSession(req: Request, res: Response): Promise<void> {
    try {
      const { cruiseId, passengerCount } = req.body;

      // DEBUG: Log received cruiseId
      console.log(
        '[BookingController] createSession - Received cruiseId:',
        cruiseId,
        'Type:',
        typeof cruiseId
      );
      console.log(
        '[BookingController] createSession - Received passengerCount:',
        JSON.stringify(passengerCount)
      );

      // Validation
      if (!cruiseId) {
        res.status(400).json({ error: 'cruiseId is required' });
        return;
      }

      if (
        !passengerCount ||
        typeof passengerCount.adults !== 'number' ||
        typeof passengerCount.children !== 'number'
      ) {
        res.status(400).json({
          error: 'passengerCount is required with adults (number) and children (number)',
        });
        return;
      }

      if (
        passengerCount.children > 0 &&
        (!passengerCount.childAges || passengerCount.childAges.length !== passengerCount.children)
      ) {
        res.status(400).json({
          error: 'childAges array must be provided with exact count matching children',
        });
        return;
      }

      // Get userId from auth if available (optional)
      const userId = (req as any).user?.id;

      // Create session
      const { sessionId, sessionData } = await traveltekSessionService.createSession({
        cruiseId,
        passengerCount,
        userId,
      });

      res.status(201).json({
        sessionId,
        expiresAt: sessionData.expiresAt,
        passengerCount: sessionData.passengerCount,
      });
    } catch (error) {
      console.error('[BookingController] Create session error:', error);
      res.status(500).json({
        error: 'Failed to create booking session',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/booking/session/:sessionId
   * Get session data
   */
  async getSession(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;

      const sessionData = await traveltekSessionService.getSession(sessionId);

      if (!sessionData) {
        res.status(404).json({ error: 'Session not found or expired' });
        return;
      }

      res.json({
        sessionId,
        expiresAt: sessionData.expiresAt,
        passengerCount: sessionData.passengerCount,
        cruiseId: sessionData.cruiseId,
      });
    } catch (error) {
      console.error('[BookingController] Get session error:', error);
      res.status(500).json({
        error: 'Failed to get session',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/booking/:sessionId/pricing
   * Get live cabin pricing
   */
  async getCabinPricing(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { cruiseId } = req.query;

      if (!cruiseId || typeof cruiseId !== 'string') {
        res.status(400).json({ error: 'cruiseId query parameter is required' });
        return;
      }

      const pricingData = await traveltekBookingService.getCabinPricing(sessionId, cruiseId);

      res.json(pricingData);
    } catch (error) {
      console.error('[BookingController] Get cabin pricing error:', error);

      if (error instanceof Error && error.message.includes('Invalid or expired')) {
        res.status(401).json({ error: error.message });
        return;
      }

      res.status(500).json({
        error: 'Failed to get cabin pricing',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/booking/:sessionId/select-cabin
   * Select cabin and add to basket
   */
  async selectCabin(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { resultNo, gradeNo, rateCode, cabinResult } = req.body;

      if (!resultNo || !gradeNo || !rateCode) {
        res.status(400).json({ error: 'resultNo, gradeNo, and rateCode are required' });
        return;
      }

      // Get cruise ID from session
      const sessionData = await traveltekSessionService.getSession(sessionId);
      if (!sessionData || !sessionData.cruiseId) {
        res.status(404).json({ error: 'Session not found or expired' });
        return;
      }

      const basketData = await traveltekBookingService.selectCabin({
        sessionId,
        cruiseId: sessionData.cruiseId,
        resultNo,
        gradeNo,
        rateCode,
        cabinResult,
      });

      res.json(basketData);
    } catch (error) {
      console.error('[BookingController] Select cabin error:', error);

      if (error instanceof Error && error.message.includes('Invalid or expired')) {
        res.status(401).json({ error: error.message });
        return;
      }

      res.status(500).json({
        error: 'Failed to select cabin',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/booking/:sessionId/basket
   * Get basket contents
   */
  async getBasket(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;

      const basketData = await traveltekBookingService.getBasket(sessionId);

      res.json(basketData);
    } catch (error) {
      console.error('[BookingController] Get basket error:', error);

      if (error instanceof Error && error.message.includes('Invalid or expired')) {
        res.status(401).json({ error: error.message });
        return;
      }

      res.status(500).json({
        error: 'Failed to get basket',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/booking/:sessionId/create
   * Create booking with passenger and payment details
   */
  async createBooking(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { passengers, contact, payment, dining } = req.body;

      // Validation
      if (!passengers || !Array.isArray(passengers) || passengers.length === 0) {
        res.status(400).json({ error: 'passengers array is required' });
        return;
      }

      if (!contact || !contact.email || !contact.phone) {
        res.status(400).json({ error: 'contact details with email and phone are required' });
        return;
      }

      if (!payment || !payment.cardNumber || !payment.amount) {
        res.status(400).json({ error: 'payment details with cardNumber and amount are required' });
        return;
      }

      if (!dining) {
        res.status(400).json({ error: 'dining selection is required' });
        return;
      }

      // Create booking
      const bookingResult = await traveltekBookingService.createBooking({
        sessionId,
        passengers,
        contact,
        payment,
        dining,
      });

      res.status(201).json(bookingResult);
    } catch (error) {
      console.error('[BookingController] Create booking error:', error);

      if (error instanceof Error && error.message.includes('Invalid or expired')) {
        res.status(401).json({ error: error.message });
        return;
      }

      if (error instanceof Error && error.message.includes('Passenger count mismatch')) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(500).json({
        error: 'Failed to create booking',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/booking/:bookingId
   * Get booking details
   */
  async getBooking(req: Request, res: Response): Promise<void> {
    try {
      const { bookingId } = req.params;

      const booking = await traveltekBookingService.getBooking(bookingId);

      res.json(booking);
    } catch (error) {
      console.error('[BookingController] Get booking error:', error);

      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
        return;
      }

      res.status(500).json({
        error: 'Failed to get booking',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/booking/user/bookings
   * Get all bookings for authenticated user
   */
  async getUserBookings(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const bookings = await traveltekBookingService.getUserBookings(userId);

      res.json({ bookings });
    } catch (error) {
      console.error('[BookingController] Get user bookings error:', error);
      res.status(500).json({
        error: 'Failed to get user bookings',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/booking/:bookingId/cancel
   * Cancel booking
   */
  async cancelBooking(req: Request, res: Response): Promise<void> {
    try {
      const { bookingId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // TODO: Add authorization check - verify booking belongs to user

      await traveltekBookingService.cancelBooking(bookingId);

      res.json({ message: 'Booking cancelled successfully' });
    } catch (error) {
      console.error('[BookingController] Cancel booking error:', error);
      res.status(500).json({
        error: 'Failed to cancel booking',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/booking/cleanup-sessions
   * Cleanup expired sessions (admin only)
   */
  async cleanupSessions(req: Request, res: Response): Promise<void> {
    try {
      const count = await traveltekSessionService.cleanupExpiredSessions();

      res.json({
        message: `Cleaned up ${count} expired sessions`,
        count,
      });
    } catch (error) {
      console.error('[BookingController] Cleanup sessions error:', error);
      res.status(500).json({
        error: 'Failed to cleanup sessions',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const bookingController = new BookingController();
