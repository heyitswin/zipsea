import { traveltekApiService } from './traveltek-api.service';
import { traveltekSessionService } from './traveltek-session.service';
import { db } from '../db';
import { bookings, bookingPassengers, bookingPayments } from '../db/schema';
import { eq } from 'drizzle-orm';

interface PassengerDetails {
  passengerNumber: number;
  passengerType: 'adult' | 'child' | 'infant';
  firstName: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
  gender: 'M' | 'F';
  citizenship: string; // ISO country code
  email?: string;
  phone?: string;
  isLeadPassenger: boolean;
}

interface ContactDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface PaymentDetails {
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  cardholderName: string;
  amount: number;
  paymentType: 'deposit' | 'full_payment';
}

interface CabinSelectionParams {
  sessionId: string;
  cruiseId: string;
  cabinGradeCode: string;
  cabinCode?: string;
}

interface BookingParams {
  sessionId: string;
  passengers: PassengerDetails[];
  contact: ContactDetails;
  payment: PaymentDetails;
}

interface BookingResult {
  bookingId: string;
  traveltekBookingId: string;
  status: 'confirmed' | 'pending' | 'failed';
  totalAmount: number;
  depositAmount: number;
  paidAmount: number;
  balanceDueDate: string;
  confirmationNumber?: string;
  bookingDetails: any;
}

/**
 * Booking Orchestration Service
 *
 * High-level service that orchestrates the complete booking flow:
 * 1. Get live cabin pricing
 * 2. Add to basket
 * 3. Collect passenger details
 * 4. Create booking with Traveltek
 * 5. Process payment
 * 6. Store booking in database
 *
 * Uses traveltek-api.service for API calls and traveltek-session.service for session management.
 */
class TraveltekBookingService {
  /**
   * Get live cabin pricing for a cruise
   *
   * This is called from the cruise detail page to show real-time pricing.
   * Requires an active booking session with passenger count.
   *
   * @param sessionId - Active booking session ID
   * @param cruiseId - Cruise ID (our database ID, not Traveltek's)
   * @returns Cabin grades with pricing
   */
  async getCabinPricing(sessionId: string, cruiseId: string): Promise<any> {
    try {
      // Validate session
      const sessionData = await traveltekSessionService.getSession(sessionId);
      if (!sessionData) {
        throw new Error('Invalid or expired booking session');
      }

      // Get Traveltek cruise ID (codetocruiseid)
      // Note: We need to map our cruise ID to Traveltek's cruise ID
      // This mapping should be stored in the cruises table
      const cruise = await db.query.cruises.findFirst({
        where: (cruises, { eq }) => eq(cruises.id, cruiseId),
      });

      if (!cruise) {
        throw new Error('Cruise not found');
      }

      // Get cabin grades from Traveltek API
      const { adults, children, childAges } = sessionData.passengerCount;

      // Format child DOBs for API (YYYY-MM-DD)
      // Calculate DOB from ages assuming today's date
      const childDobs = childAges.map(age => {
        const dob = new Date();
        dob.setFullYear(dob.getFullYear() - age);
        return dob.toISOString().split('T')[0];
      });

      const pricingData = await traveltekApiService.getCabinGrades({
        sessionkey: sessionData.sessionKey,
        codetocruiseid: cruise.id, // cruises.id is the codetocruiseid from Traveltek
        adults,
        children,
        childDobs: childDobs.length > 0 ? childDobs : undefined,
      });

      console.log(`[TraveltekBooking] Retrieved cabin pricing for cruise ${cruiseId}`);
      return pricingData;
    } catch (error) {
      console.error('[TraveltekBooking] Failed to get cabin pricing:', error);
      throw error;
    }
  }

  /**
   * Select cabin and add to basket
   *
   * User has selected a cabin grade (and optionally a specific cabin).
   * Add it to the Traveltek basket.
   *
   * @param params - Cabin selection parameters
   * @returns Updated basket data
   */
  async selectCabin(params: CabinSelectionParams): Promise<any> {
    try {
      // Validate session
      const sessionData = await traveltekSessionService.getSession(params.sessionId);
      if (!sessionData) {
        throw new Error('Invalid or expired booking session');
      }

      // Get cruise data
      const cruise = await db.query.cruises.findFirst({
        where: (cruises, { eq }) => eq(cruises.id, params.cruiseId),
      });

      if (!cruise) {
        throw new Error('Cruise not found');
      }

      // Add to basket
      const basketData = await traveltekApiService.addToBasket({
        sessionkey: sessionData.sessionKey,
        codetocruiseid: cruise.id, // cruises.id is the codetocruiseid from Traveltek
        cabingradecode: params.cabinGradeCode,
        cabincode: params.cabinCode,
      });

      // Update session with basket data
      await traveltekSessionService.updateSession(params.sessionId, {
        selectedCabinGrade: params.cabinGradeCode,
        selectedCabin: params.cabinCode,
        basketData,
      });

      console.log(`[TraveltekBooking] Added cabin to basket for session ${params.sessionId}`);
      return basketData;
    } catch (error) {
      console.error('[TraveltekBooking] Failed to select cabin:', error);
      throw error;
    }
  }

  /**
   * Get current basket contents
   *
   * @param sessionId - Active booking session ID
   * @returns Basket data
   */
  async getBasket(sessionId: string): Promise<any> {
    try {
      // Validate session
      const sessionData = await traveltekSessionService.getSession(sessionId);
      if (!sessionData) {
        throw new Error('Invalid or expired booking session');
      }

      const basketData = await traveltekApiService.getBasket({
        sessionkey: sessionData.sessionKey,
      });

      return basketData;
    } catch (error) {
      console.error('[TraveltekBooking] Failed to get basket:', error);
      throw error;
    }
  }

  /**
   * Create booking with passenger details
   *
   * This is the main booking flow that:
   * 1. Creates the booking with Traveltek
   * 2. Processes payment
   * 3. Stores everything in our database
   * 4. Marks session as completed
   *
   * @param params - Complete booking parameters
   * @returns Booking result with confirmation
   */
  async createBooking(params: BookingParams): Promise<BookingResult> {
    try {
      // Step 1: Validate session
      const sessionData = await traveltekSessionService.getSession(params.sessionId);
      if (!sessionData) {
        throw new Error('Invalid or expired booking session');
      }

      // Step 2: Validate passenger count matches session
      const totalPassengers = params.passengers.length;
      const expectedPassengers =
        sessionData.passengerCount.adults + sessionData.passengerCount.children;

      if (totalPassengers !== expectedPassengers) {
        throw new Error(
          `Passenger count mismatch: expected ${expectedPassengers}, got ${totalPassengers}`
        );
      }

      // Step 3: Create booking with Traveltek
      const bookingResponse = await traveltekApiService.createBooking({
        sessionkey: sessionData.sessionKey,
        contact: {
          title: params.contact.firstName.startsWith('Mr') ? 'Mr' : 'Mrs', // Simple logic
          firstname: params.contact.firstName,
          surname: params.contact.lastName,
          email: params.contact.email,
          telephone: params.contact.phone,
          address1: params.contact.address,
          city: params.contact.city,
          county: params.contact.state,
          postcode: params.contact.postalCode,
          country: params.contact.country,
        },
        passengers: params.passengers.map(p => ({
          passengernumber: p.passengerNumber,
          title: p.gender === 'M' ? 'Mr' : p.passengerType === 'child' ? 'Miss' : 'Mrs',
          firstname: p.firstName,
          surname: p.lastName,
          gender: p.gender,
          dob: p.dateOfBirth,
          nationality: p.citizenship,
        })),
      });

      if (!bookingResponse.bookingid) {
        throw new Error('Booking creation failed: no booking ID returned');
      }

      // Step 4: Process payment
      const paymentResponse = await traveltekApiService.processPayment({
        sessionkey: sessionData.sessionKey,
        bookingid: bookingResponse.bookingid,
        cardnumber: params.payment.cardNumber,
        expirymonth: params.payment.expiryMonth,
        expiryyear: params.payment.expiryYear,
        cvv: params.payment.cvv,
        cardholdername: params.payment.cardholderName,
        amount: params.payment.amount,
      });

      // Step 5: Store booking in our database
      const bookingId = await this.storeBooking({
        sessionId: params.sessionId,
        traveltekBookingId: bookingResponse.bookingid,
        bookingDetails: bookingResponse,
        passengers: params.passengers,
        payment: {
          ...params.payment,
          transactionId: paymentResponse.transactionid,
          last4: params.payment.cardNumber.slice(-4),
        },
      });

      // Step 6: Mark session as completed
      await traveltekSessionService.completeSession(params.sessionId);

      console.log(`[TraveltekBooking] Successfully created booking ${bookingId}`);

      // Step 7: Return booking result
      return {
        bookingId,
        traveltekBookingId: bookingResponse.bookingid,
        status: paymentResponse.status === 'success' ? 'confirmed' : 'pending',
        totalAmount: bookingResponse.totalcost,
        depositAmount: bookingResponse.depositamount,
        paidAmount: params.payment.amount,
        balanceDueDate: bookingResponse.balanceduedate,
        confirmationNumber: bookingResponse.confirmationnumber,
        bookingDetails: bookingResponse,
      };
    } catch (error) {
      console.error('[TraveltekBooking] Failed to create booking:', error);

      // Mark session as abandoned on failure
      await traveltekSessionService.abandonSession(params.sessionId);

      throw error;
    }
  }

  /**
   * Store booking in database
   *
   * Internal method to persist booking data.
   *
   * @param params - Booking data to store
   * @returns Booking ID (our database ID)
   */
  private async storeBooking(params: {
    sessionId: string;
    traveltekBookingId: string;
    bookingDetails: any;
    passengers: PassengerDetails[];
    payment: any;
  }): Promise<string> {
    try {
      // Insert booking
      const [booking] = await db
        .insert(bookings)
        .values({
          bookingSessionId: params.sessionId,
          traveltekBookingId: params.traveltekBookingId,
          status: 'confirmed',
          bookingDetails: params.bookingDetails,
          totalAmount: params.bookingDetails.totalcost.toString(),
          depositAmount: params.bookingDetails.depositamount.toString(),
          paidAmount: params.payment.amount.toString(),
          paymentStatus: 'paid',
          balanceDueDate: new Date(params.bookingDetails.balanceduedate),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({ id: bookings.id });

      // Insert passengers
      await db.insert(bookingPassengers).values(
        params.passengers.map(p => ({
          bookingId: booking.id,
          passengerNumber: p.passengerNumber,
          passengerType: p.passengerType,
          firstName: p.firstName,
          lastName: p.lastName,
          dateOfBirth: new Date(p.dateOfBirth),
          gender: p.gender,
          citizenship: p.citizenship,
          email: p.email || null,
          phone: p.phone || null,
          isLeadPassenger: p.isLeadPassenger,
          createdAt: new Date(),
        }))
      );

      // Insert payment
      await db.insert(bookingPayments).values({
        bookingId: booking.id,
        amount: params.payment.amount.toString(),
        paymentType: params.payment.paymentType,
        paymentMethod: 'credit_card',
        last4: params.payment.last4,
        transactionId: params.payment.transactionId,
        status: 'completed',
        createdAt: new Date(),
      });

      console.log(`[TraveltekBooking] Stored booking ${booking.id} in database`);
      return booking.id;
    } catch (error) {
      console.error('[TraveltekBooking] Failed to store booking in database:', error);
      throw error;
    }
  }

  /**
   * Get booking by ID
   *
   * @param bookingId - Booking ID (our database ID)
   * @returns Complete booking data with passengers and payments
   */
  async getBooking(bookingId: string): Promise<any> {
    try {
      const booking = await db.query.bookings.findFirst({
        where: eq(bookings.id, bookingId),
        with: {
          bookingSession: true,
          passengers: true,
          payments: true,
        },
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      return booking;
    } catch (error) {
      console.error(`[TraveltekBooking] Failed to get booking ${bookingId}:`, error);
      throw error;
    }
  }

  /**
   * Get bookings for a user
   *
   * @param userId - User ID
   * @returns Array of bookings
   */
  async getUserBookings(userId: string): Promise<any[]> {
    try {
      const userBookings = await db.query.bookings.findMany({
        where: (bookings, { eq, and }) =>
          and(
            eq(bookings.bookingSessionId, userId) // This needs to be fixed - should join through bookingSessions
          ),
        with: {
          bookingSession: true,
          passengers: true,
          payments: true,
        },
        orderBy: (bookings, { desc }) => [desc(bookings.createdAt)],
      });

      return userBookings;
    } catch (error) {
      console.error(`[TraveltekBooking] Failed to get bookings for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Cancel booking
   *
   * Note: This requires integration with Traveltek's cancellation API.
   * For now, just marks as cancelled in our database.
   *
   * @param bookingId - Booking ID (our database ID)
   */
  async cancelBooking(bookingId: string): Promise<void> {
    try {
      // TODO: Call Traveltek cancellation API

      // Mark as cancelled in our database
      await db
        .update(bookings)
        .set({
          status: 'cancelled',
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, bookingId));

      console.log(`[TraveltekBooking] Cancelled booking ${bookingId}`);
    } catch (error) {
      console.error(`[TraveltekBooking] Failed to cancel booking ${bookingId}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const traveltekBookingService = new TraveltekBookingService();
