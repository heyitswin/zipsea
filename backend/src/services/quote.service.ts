import { db } from '../db/connection';
import { quoteRequests, cruises, ships } from '../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { logger } from '../config/logger';
import { emailService } from './email.service';
import type { QuoteRequest, NewQuoteRequest } from '../db/schema/quote-requests';

interface CreateQuoteData {
  userId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  cruiseId: string;
  cabinType: string;
  adults: number;
  children: number;
  travelInsurance: boolean;
  specialRequests?: string;
  discountQualifiers: {
    payInFull?: boolean;
    seniorCitizen?: boolean;
    military?: boolean;
    stateOfResidence?: string;
    loyaltyNumber?: string;
  };
}

class QuoteService {
  /**
   * Generate a unique quote reference number
   */
  private generateReferenceNumber(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `ZQ-${timestamp.toString().slice(-6)}${random.toString().padStart(3, '0')}`;
  }

  /**
   * Create a new quote request
   */
  async createQuoteRequest(data: CreateQuoteData): Promise<QuoteRequest> {
    try {
      const passengerDetails = {
        adults: data.adults,
        children: data.children,
        totalPassengers: data.adults + data.children,
      };

      const preferences = {
        travelInsurance: data.travelInsurance,
        ...data.discountQualifiers,
      };

      const contactInfo = {
        email: data.email,
      };

      // Calculate OBC amount (2.5% of typical cruise price, will be refined later)
      const obcAmount = this.calculateOnboardCredit(data.cabinType);

      const referenceNumber = this.generateReferenceNumber();

      // Store all extra fields in customer_details JSONB for production schema compatibility
      const customerDetails = {
        reference_number: referenceNumber,
        user_id: data.userId || null,
        cabin_type: data.cabinType,
        passenger_count: data.adults + data.children,
        adults: data.adults,
        children: data.children,
        passenger_details: passengerDetails,
        preferences,
        contact_info: contactInfo,
        obc_amount: String(obcAmount),
        source: 'website',
        quote_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        preferred_cabin_type: data.cabinType,
        special_requests: data.specialRequests,
        travel_insurance: data.travelInsurance,
        discount_qualifiers: data.discountQualifiers || {},
      };

      const quoteData: any = {
        cruiseId: data.cruiseId, // Keep as string - cruises.id is VARCHAR
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        email: data.email || null,
        phone: data.phone || null,
        customer_details: customerDetails,
        status: 'pending', // Changed to match production default
      };

      const result = await db.insert(quoteRequests).values(quoteData).returning();

      const quote = result[0];

      // Add the referenceNumber to the returned quote object for compatibility
      quote.referenceNumber = referenceNumber;

      logger.info('Quote request created successfully', {
        quoteId: quote.id,
        referenceNumber: quote.referenceNumber,
        cruiseId: data.cruiseId,
        customerEmail: data.email,
        userId: data.userId,
      });

      // Send confirmation email to customer and notification to team
      if (data.email) {
        try {
          // Get cruise details for email
          let cruiseName = '';
          let shipName = '';
          let departureDate = '';

          try {
            const cruiseDetails = await db
              .select({
                cruise: cruises.name,
                ship: ships.name,
                sailing: cruises.sailingDate,
              })
              .from(cruises)
              .leftJoin(ships, eq(cruises.shipId, ships.id))
              .where(eq(cruises.id, data.cruiseId))
              .limit(1);

            if (cruiseDetails.length > 0) {
              cruiseName = cruiseDetails[0].cruise || '';
              shipName = cruiseDetails[0].ship || '';
              departureDate = cruiseDetails[0].sailing || '';
            }
          } catch (cruiseError) {
            logger.warn('Could not fetch cruise details for email', {
              cruiseId: data.cruiseId,
              error: cruiseError instanceof Error ? cruiseError.message : 'Unknown error',
            });
          }

          const emailData = {
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            referenceNumber: quote.referenceNumber,
            cruiseName,
            shipName,
            departureDate,
            cabinType: data.cabinType,
            adults: data.adults,
            children: data.children,
            specialRequests: data.specialRequests,
          };

          // Send customer confirmation email
          const customerEmailSent = await emailService.sendQuoteConfirmationEmail(emailData);

          // Send team notification email
          const teamEmailSent = await emailService.sendQuoteNotificationToTeam(emailData);

          // Log email results
          logger.info('Quote confirmation emails processed', {
            quoteId: quote.id,
            referenceNumber: quote.referenceNumber,
            customerEmail: data.email,
            customerEmailSent,
            teamEmailSent,
            emailType: 'quote_confirmation',
          });
        } catch (emailError) {
          // Don't fail the quote creation if emails fail
          logger.error(
            'Failed to send quote confirmation emails, but quote was created successfully',
            {
              quoteId: quote.id,
              referenceNumber: quote.referenceNumber,
              customerEmail: data.email,
              error: emailError instanceof Error ? emailError.message : 'Unknown error',
            }
          );
        }
      } else {
        logger.warn('No customer email provided for quote - skipping confirmation emails', {
          quoteId: quote.id,
          referenceNumber: quote.referenceNumber,
        });
      }

      return quote;
    } catch (error) {
      logger.error('Error creating quote request:', error);
      throw error;
    }
  }

  /**
   * Calculate onboard credit based on cabin type
   */
  private calculateOnboardCredit(cabinType: string): number {
    const obcRates: Record<string, number> = {
      interior: 50,
      oceanview: 75,
      balcony: 100,
      suite: 150,
    };

    return obcRates[cabinType.toLowerCase()] || 50;
  }

  /**
   * Get quote request by ID
   */
  async getQuoteById(quoteId: string): Promise<QuoteRequest | null> {
    try {
      const result = await db
        .select()
        .from(quoteRequests)
        .where(eq(quoteRequests.id, quoteId))
        .limit(1);

      if (!result[0]) return null;

      // Add referenceNumber from customer_details
      const quote = result[0];
      const details =
        typeof quote.customer_details === 'string'
          ? JSON.parse(quote.customer_details as string)
          : (quote.customer_details as any) || {};

      return {
        ...quote,
        referenceNumber: details.reference_number || quote.id,
      } as any;
    } catch (error) {
      logger.error('Error getting quote by ID:', error);
      throw error;
    }
  }

  /**
   * Get all quotes for a user
   */
  async getUserQuotes(
    userId: string,
    limit = 20,
    offset = 0
  ): Promise<{
    quotes: QuoteRequest[];
    total: number;
  }> {
    try {
      // Get quotes
      // Since userId doesn't exist in production schema, we need to filter by customer_details
      // For now, return empty array as we can't filter by userId without that column
      const quotes = await db
        .select()
        .from(quoteRequests)
        .where(sql`customer_details->>'user_id' = ${userId}`)
        .orderBy(desc(quoteRequests.createdAt))
        .limit(limit)
        .offset(offset);

      // Get total count
      const countResult = await db
        .select({ count: sql`count(*)` })
        .from(quoteRequests)
        .where(sql`customer_details->>'user_id' = ${userId}`);

      const total = Number(countResult[0]?.count || 0);

      // Add referenceNumber to each quote from customer_details
      const quotesWithReferenceNumber = quotes.map(quote => {
        const details =
          typeof quote.customer_details === 'string'
            ? JSON.parse(quote.customer_details as string)
            : (quote.customer_details as any) || {};
        return {
          ...quote,
          referenceNumber: details.reference_number || quote.id,
        };
      });

      return { quotes: quotesWithReferenceNumber, total };
    } catch (error) {
      logger.error('Error getting user quotes:', error);
      throw error;
    }
  }

  /**
   * Get all quotes (admin)
   */
  async getAllQuotes(
    limit = 20,
    offset = 0,
    status?: string
  ): Promise<{
    quotes: QuoteRequest[];
    total: number;
  }> {
    try {
      let query = db.select().from(quoteRequests);

      if (status) {
        query = query.where(eq(quoteRequests.status, status));
      }

      const quotes = await query.orderBy(desc(quoteRequests.createdAt)).limit(limit).offset(offset);

      // Get total count
      let countQuery = db.select({ count: sql`count(*)` }).from(quoteRequests);

      if (status) {
        countQuery = countQuery.where(eq(quoteRequests.status, status));
      }

      const countResult = await countQuery;
      const total = Number(countResult[0]?.count || 0);

      return { quotes, total };
    } catch (error) {
      logger.error('Error getting all quotes:', error);
      throw error;
    }
  }

  /**
   * Update quote status
   */
  async updateQuoteStatus(quoteId: string, status: string, notes?: string): Promise<QuoteRequest> {
    try {
      const updateData: any = {
        status,
        updatedAt: new Date(),
      };

      if (notes) {
        updateData.notes = notes;
      }

      if (status === 'quoted') {
        updateData.quotedAt = new Date();
      } else if (status === 'booked') {
        updateData.bookedAt = new Date();
      }

      const result = await db
        .update(quoteRequests)
        .set(updateData)
        .where(eq(quoteRequests.id, quoteId))
        .returning();

      if (!result[0]) {
        throw new Error('Quote not found');
      }

      logger.info('Quote status updated', { quoteId, status });
      return result[0];
    } catch (error) {
      logger.error('Error updating quote status:', error);
      throw error;
    }
  }

  /**
   * Update quote with pricing information
   */
  async updateQuotePricing(
    quoteId: string,
    totalPrice: number,
    obcAmount: number,
    commission?: number
  ): Promise<QuoteRequest> {
    try {
      const result = await db
        .update(quoteRequests)
        .set({
          totalPrice: String(totalPrice),
          obcAmount: String(obcAmount),
          commission: commission ? String(commission) : null,
          status: 'quoted',
          quotedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(quoteRequests.id, quoteId))
        .returning();

      if (!result[0]) {
        throw new Error('Quote not found');
      }

      logger.info('Quote pricing updated', { quoteId, totalPrice, obcAmount });
      return result[0];
    } catch (error) {
      logger.error('Error updating quote pricing:', error);
      throw error;
    }
  }

  /**
   * Get quote with full details (including cruise info)
   */
  async getQuoteWithDetails(quoteId: string): Promise<any> {
    try {
      const result = await db
        .select({
          quote: quoteRequests,
          cruise: cruises,
        })
        .from(quoteRequests)
        .leftJoin(cruises, eq(quoteRequests.cruiseId, cruises.id))
        .where(eq(quoteRequests.id, quoteId))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      logger.error('Error getting quote with details:', error);
      throw error;
    }
  }

  /**
   * Submit quote response with pricing details
   */
  async submitQuoteResponse(
    quoteId: string,
    response: {
      categories: Array<{
        category: string;
        roomName?: string;
        finalPrice: number;
        obcAmount: number;
      }>;
      notes?: string;
    }
  ): Promise<QuoteRequest> {
    try {
      const result = await db
        .update(quoteRequests)
        .set({
          quoteResponse: response,
          status: 'responded',
          quotedAt: new Date(),
          updatedAt: new Date(),
          notes: response.notes,
        })
        .where(eq(quoteRequests.id, quoteId))
        .returning();

      if (!result[0]) {
        throw new Error('Quote not found');
      }

      logger.info('Quote response submitted', { quoteId });
      return result[0];
    } catch (error) {
      logger.error('Error submitting quote response:', error);
      throw error;
    }
  }

  /**
   * Get quotes for admin view with cruise details
   */
  async getQuotesForAdmin(limit = 100, offset = 0, status?: string): Promise<any[]> {
    try {
      let query = db
        .select({
          quote: quoteRequests,
          cruise: cruises,
        })
        .from(quoteRequests)
        .leftJoin(cruises, eq(quoteRequests.cruiseId, cruises.id));

      if (status) {
        query = query.where(eq(quoteRequests.status, status));
      }

      const result = await query.orderBy(desc(quoteRequests.createdAt)).limit(limit).offset(offset);

      return result;
    } catch (error) {
      logger.error('Error getting quotes for admin:', error);
      throw error;
    }
  }
}

export const quoteService = new QuoteService();
