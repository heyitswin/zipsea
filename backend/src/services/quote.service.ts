import { db } from '../db/connection';
import { quoteRequests, users, cruises } from '../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { logger } from '../config/logger';
import type { QuoteRequest, NewQuoteRequest } from '../db/schema/quote-requests';

interface CreateQuoteData {
  userId?: string;
  email?: string;
  cruiseId: string;
  cabinType: string;
  adults: number;
  children: number;
  travelInsurance: boolean;
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

      const quoteData: NewQuoteRequest = {
        userId: data.userId || null,
        cruiseId: parseInt(data.cruiseId),
        cabinType: data.cabinType,
        passengerCount: data.adults + data.children,
        passengerDetails,
        preferences,
        contactInfo,
        obcAmount: String(obcAmount),
        status: 'submitted',
        source: 'website',
        quoteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      };

      const result = await db
        .insert(quoteRequests)
        .values(quoteData)
        .returning();

      logger.info('Quote request created', { 
        quoteId: result[0].id,
        cruiseId: data.cruiseId,
        userId: data.userId 
      });

      return result[0];
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

      return result[0] || null;
    } catch (error) {
      logger.error('Error getting quote by ID:', error);
      throw error;
    }
  }

  /**
   * Get all quotes for a user
   */
  async getUserQuotes(userId: string, limit = 20, offset = 0): Promise<{
    quotes: QuoteRequest[];
    total: number;
  }> {
    try {
      // Get quotes
      const quotes = await db
        .select()
        .from(quoteRequests)
        .where(eq(quoteRequests.userId, userId))
        .orderBy(desc(quoteRequests.createdAt))
        .limit(limit)
        .offset(offset);

      // Get total count
      const countResult = await db
        .select({ count: sql`count(*)` })
        .from(quoteRequests)
        .where(eq(quoteRequests.userId, userId));

      const total = Number(countResult[0]?.count || 0);

      return { quotes, total };
    } catch (error) {
      logger.error('Error getting user quotes:', error);
      throw error;
    }
  }

  /**
   * Get all quotes (admin)
   */
  async getAllQuotes(limit = 20, offset = 0, status?: string): Promise<{
    quotes: QuoteRequest[];
    total: number;
  }> {
    try {
      let query = db.select().from(quoteRequests);

      if (status) {
        query = query.where(eq(quoteRequests.status, status));
      }

      const quotes = await query
        .orderBy(desc(quoteRequests.createdAt))
        .limit(limit)
        .offset(offset);

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
  async updateQuoteStatus(
    quoteId: string, 
    status: string, 
    notes?: string
  ): Promise<QuoteRequest> {
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
   * Get quote with full details (including cruise and user info)
   */
  async getQuoteWithDetails(quoteId: string): Promise<any> {
    try {
      const result = await db
        .select({
          quote: quoteRequests,
          cruise: cruises,
          user: users,
        })
        .from(quoteRequests)
        .leftJoin(cruises, eq(quoteRequests.cruiseId, cruises.id))
        .leftJoin(users, eq(quoteRequests.userId, users.id))
        .where(eq(quoteRequests.id, quoteId))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      logger.error('Error getting quote with details:', error);
      throw error;
    }
  }
}

export const quoteService = new QuoteService();