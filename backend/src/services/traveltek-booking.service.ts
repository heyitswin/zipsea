import { traveltekApiService } from './traveltek-api.service';
import { traveltekSessionService } from './traveltek-session.service';
import { db, sql } from '../db/connection';
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
  resultNo: string; // From cabin grades response
  gradeNo: string; // From cabin grades response
  rateCode: string; // From cabin grades response
  cabinResult?: string; // Optional specific cabin
}

interface BookingParams {
  sessionId: string;
  passengers: PassengerDetails[];
  contact: ContactDetails;
  payment: PaymentDetails;
  dining: string; // Dining selection code
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
   * OPTIMIZATION: Caches pricing data in Redis for 5 minutes to speed up repeated requests.
   *
   * @param sessionId - Active booking session ID
   * @param cruiseId - Cruise ID (codetocruiseid from Traveltek, stored as cruises.id)
   * @returns Cabin grades with pricing
   */
  async getCabinPricing(sessionId: string, cruiseId: string): Promise<any> {
    try {
      // Validate session
      const sessionData = await traveltekSessionService.getSession(sessionId);
      if (!sessionData) {
        throw new Error('Invalid or expired booking session');
      }

      const { adults, children, childAges } = sessionData.passengerCount;

      // Check Redis cache first for faster response
      // Cache key includes cruise ID and passenger count for accurate pricing
      const cacheKey = `cabin_pricing:${cruiseId}:${adults}a:${children}c:${childAges.join(',')}`;

      const Redis = require('ioredis');
      const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

      try {
        const cachedData = await redis.get(cacheKey);
        if (cachedData) {
          console.log(`[TraveltekBooking] 🚀 Cache HIT for cabin pricing: ${cruiseId}`);
          redis.disconnect();
          return JSON.parse(cachedData);
        }
        console.log(`[TraveltekBooking] Cache MISS for cabin pricing: ${cruiseId}`);
      } catch (cacheError) {
        console.warn('[TraveltekBooking] Redis cache read failed:', cacheError);
      }

      // Get cruise to verify it exists
      // Use raw SQL to avoid schema mismatch issues between environments
      const cruiseResult = await sql`
        SELECT id, cruise_line_id, ship_id, sailing_date
        FROM cruises
        WHERE id = ${cruiseId}
        LIMIT 1
      `;

      if (cruiseResult.length === 0) {
        redis.disconnect();
        throw new Error('Cruise not found');
      }

      const cruise = cruiseResult[0];

      // Get cabin grades from Traveltek API
      // cruises.id is the codetocruiseid from Traveltek

      // Format child DOBs for API (YYYY-MM-DD)
      // Calculate DOB from ages assuming today's date
      const childDobs = childAges.map((age: number) => {
        const dob = new Date();
        dob.setFullYear(dob.getFullYear() - age);
        return dob.toISOString().split('T')[0];
      });

      const pricingData = await traveltekApiService.getCabinGrades({
        sessionkey: sessionData.sessionKey,
        sid: sessionData.sid, // Fixed SID value (52471)
        codetocruiseid: cruise.id, // This is correct - cruises.id IS the codetocruiseid
        adults,
        children,
        childDobs: childDobs.length > 0 ? childDobs : undefined,
      });

      console.log(`[TraveltekBooking] Retrieved cabin pricing for cruise ${cruiseId}`);

      // Transform Traveltek response to match frontend expected format
      // Frontend expects: { cabins: [...] }
      // Traveltek returns: { results: [...] }
      const cabins = (pricingData.results || []).map((cabin: any) => ({
        code: cabin.code,
        name: cabin.name,
        description: cabin.description,
        category: cabin.codtype, // 'inside', 'outside', 'balcony', 'suite'
        imageUrl: cabin.imageurlhd || cabin.imageurl,
        cheapestPrice: parseFloat(cabin.cheapestprice || '0'),
        isGuaranteed:
          cabin.code?.toLowerCase().includes('guarantee') ||
          cabin.name?.toLowerCase().includes('guarantee'),
        resultNo: cabin.resultno,
        gradeNo: cabin.gradeno,
        rateCode: cabin.ratecode,
      }));

      const result = {
        cabins,
        sessionId,
        cruiseId,
      };

      // Cache the result for 5 minutes (300 seconds)
      // Pricing changes infrequently, so this provides a good balance
      try {
        await redis.setex(cacheKey, 300, JSON.stringify(result));
        console.log(`[TraveltekBooking] 💾 Cached cabin pricing for 5 minutes: ${cruiseId}`);
      } catch (cacheError) {
        console.warn('[TraveltekBooking] Failed to cache pricing:', cacheError);
      } finally {
        redis.disconnect();
      }

      return result;
    } catch (error) {
      console.error('[TraveltekBooking] Failed to get cabin pricing:', error);
      throw error;
    }
  }

  /**
   * Select cabin and add to basket
   *
   * User has selected a cabin grade from the pricing response.
   * Add it to the Traveltek basket.
   *
   * @param params - Cabin selection parameters (must include resultNo, gradeNo, rateCode from pricing response)
   * @returns Updated basket data
   */
  async selectCabin(params: CabinSelectionParams): Promise<any> {
    try {
      // Validate session
      const sessionData = await traveltekSessionService.getSession(params.sessionId);
      if (!sessionData) {
        throw new Error('Invalid or expired booking session');
      }

      // Get cruise data to verify
      // Use raw SQL to avoid schema mismatch issues between environments
      const cruiseResult = await sql`
        SELECT id, cruise_line_id, ship_id, sailing_date
        FROM cruises
        WHERE id = ${params.cruiseId}
        LIMIT 1
      `;

      if (cruiseResult.length === 0) {
        throw new Error('Cruise not found');
      }

      const cruise = cruiseResult[0];

      // FIXED: Use correct parameter names matching traveltek-api.service
      const basketData = await traveltekApiService.addToBasket({
        sessionkey: sessionData.sessionKey,
        type: 'cruise',
        resultno: params.resultNo,
        gradeno: params.gradeNo,
        ratecode: params.rateCode,
        cabinresult: params.cabinResult,
      });

      // Update session with basket data
      await traveltekSessionService.updateSession(params.sessionId, {
        selectedCabinGrade: params.gradeNo,
        selectedCabin: params.cabinResult,
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
   * Get specific available cabins for a cabin grade
   *
   * @param params - Cabin grade parameters
   * @returns List of specific cabins with availability
   */
  async getSpecificCabins(params: {
    sessionId: string;
    cruiseId: string;
    resultNo: string;
    gradeNo: string;
    rateCode: string;
  }): Promise<any> {
    try {
      // Validate session
      const sessionData = await traveltekSessionService.getSession(params.sessionId);
      if (!sessionData) {
        throw new Error('Invalid or expired booking session');
      }

      // Get specific cabins from Traveltek API
      const cabinsData = await traveltekApiService.getCabins({
        sessionkey: sessionData.sessionKey,
        sid: sessionData.sid,
        resultno: params.resultNo,
        gradeno: params.gradeNo,
        ratecode: params.rateCode,
      });

      // Transform response to match frontend expected format
      const cabins = (cabinsData.results || []).map((cabin: any) => ({
        cabinNo: cabin.cabinno,
        deck: cabin.deck,
        position: cabin.position,
        features: cabin.features || [],
        obstructed: cabin.obstructed || false,
        available: cabin.available !== false, // Default to true if not specified
        resultNo: cabin.resultno,
      }));

      console.log(
        `[TraveltekBooking] Retrieved ${cabins.length} specific cabins for grade ${params.gradeNo}`
      );

      return {
        cabins,
        sessionId: params.sessionId,
        cruiseId: params.cruiseId,
      };
    } catch (error) {
      console.error('[TraveltekBooking] Failed to get specific cabins:', error);
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

      // FIXED: getBasket takes sessionkey directly, not an object
      const basketData = await traveltekApiService.getBasket(sessionData.sessionKey);

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
      // FIXED: Match the exact parameter structure from traveltek-api.service
      const bookingResponse = await traveltekApiService.createBooking({
        sessionkey: sessionData.sessionKey,
        sid: sessionData.sid,
        contact: {
          firstname: params.contact.firstName,
          lastname: params.contact.lastName,
          email: params.contact.email,
          telephone: params.contact.phone,
          address1: params.contact.address,
          city: params.contact.city,
          county: params.contact.state,
          postcode: params.contact.postalCode,
          country: params.contact.country,
        },
        passengers: params.passengers.map(p => ({
          firstname: p.firstName,
          lastname: p.lastName,
          dob: p.dateOfBirth,
          gender: p.gender,
          paxtype: p.passengerType,
          age: this.calculateAge(p.dateOfBirth),
        })),
        dining: params.dining,
      });

      if (!bookingResponse.bookingid) {
        throw new Error('Booking creation failed: no booking ID returned');
      }

      // Step 4: Process payment
      const paymentResponse = await traveltekApiService.processPayment({
        sessionkey: sessionData.sessionKey,
        cardtype: 'VIS', // TODO: Determine from card number
        cardnumber: params.payment.cardNumber,
        expirymonth: params.payment.expiryMonth,
        expiryyear: params.payment.expiryYear,
        nameoncard: params.payment.cardholderName,
        cvv: params.payment.cvv,
        amount: params.payment.amount.toString(),
        address1: params.contact.address,
        city: params.contact.city,
        postcode: params.contact.postalCode,
        country: params.contact.country,
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
   * Calculate age from date of birth
   *
   * @param dob - Date of birth in YYYY-MM-DD format
   * @returns Age in years
   */
  private calculateAge(dob: string): number {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
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
