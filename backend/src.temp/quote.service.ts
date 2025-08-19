import { and, eq, desc, sql, inArray, count } from 'drizzle-orm';
import { BaseService } from './base.service';
import { 
  quoteRequests, 
  cruises, 
  ships, 
  cruiseLines, 
  ports,
  users,
  cheapestPricing,
} from '../db/schema';
import { 
  QuoteRequest, 
  QuoteRequestData, 
  CruiseListItem,
  PassengerDetails,
  ContactInfo,
} from '../types/api.types';
import { CACHE_KEYS } from '../cache/cache-keys';
import logger from '../config/logger';

interface CreateQuoteRequestData extends QuoteRequestData {
  userId?: string | null;
}

interface UpdateQuoteRequestData {
  passengerDetails?: PassengerDetails;
  cabinPreference?: 'interior' | 'oceanview' | 'balcony' | 'suite';
  specialRequests?: string;
  contactInfo?: ContactInfo;
}

interface QuoteListResult {
  quotes: QuoteRequest[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

interface PaginationParams {
  page: number;
  limit: number;
}

interface QuoteSummary {
  totalQuotes: number;
  pendingQuotes: number;
  quotedQuotes: number;
  expiredQuotes: number;
  totalValue: number;
  recentQuotes: QuoteRequest[];
}

export class QuoteService extends BaseService {
  /**
   * Create a new quote request
   */
  async createQuoteRequest(data: CreateQuoteRequestData): Promise<QuoteRequest> {
    return this.executeTransaction(async (tx) => {
      this.log('info', 'Creating quote request', { 
        cruiseId: data.cruiseId, 
        userId: data.userId,
        passengerCount: data.passengerDetails.adults + data.passengerDetails.children,
      });

      // Verify cruise exists and is active
      const cruise = await tx
        .select({ 
          id: cruises.id, 
          name: cruises.name, 
          sailingDate: cruises.sailingDate,
          isActive: cruises.isActive,
          showCruise: cruises.showCruise,
        })
        .from(cruises)
        .where(eq(cruises.id, data.cruiseId))
        .limit(1);

      if (!cruise.length) {
        throw new Error('Cruise not found');
      }

      if (!cruise[0].isActive || !cruise[0].showCruise) {
        throw new Error('Cruise is not available for booking');
      }

      // Check if cruise is in the future
      const sailingDate = new Date(cruise[0].sailingDate);
      const now = new Date();
      if (sailingDate <= now) {
        throw new Error('Cannot request quotes for past cruises');
      }

      // Get estimated pricing for initial quote calculation
      const estimatedPrice = await this.getEstimatedPrice(data.cruiseId, data.cabinPreference);

      // Calculate quote expiry (30 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      // Insert quote request
      const insertResult = await tx
        .insert(quoteRequests)
        .values({
          userId: data.userId,
          cruiseId: data.cruiseId,
          passengerCount: data.passengerDetails.adults + data.passengerDetails.children + data.passengerDetails.infants,
          specialRequirements: data.specialRequests,
          contactInfo: {
            email: data.contactInfo.email,
            phone: data.contactInfo.phone,
            preferredContactMethod: data.contactInfo.preferredContactMethod,
            passengerDetails: data.passengerDetails,
            cabinPreference: data.cabinPreference,
          },
          status: 'pending',
          totalPrice: estimatedPrice,
          expiresAt,
        })
        .returning({
          id: quoteRequests.id,
          createdAt: quoteRequests.createdAt,
        });

      const newQuoteId = insertResult[0].id;

      // Clear user quotes cache if user is authenticated
      if (data.userId) {
        await this.invalidateCache(`user:quotes:${data.userId}:*`);
      }

      // Return the complete quote request
      const fullQuote = await this.getQuoteById(newQuoteId, data.userId);
      if (!fullQuote) {
        throw new Error('Failed to retrieve created quote request');
      }

      this.log('info', 'Quote request created successfully', { 
        quoteId: newQuoteId, 
        cruiseId: data.cruiseId,
        userId: data.userId,
      });

      return fullQuote;
    });
  }

  /**
   * Get quote request by ID
   */
  async getQuoteById(quoteId: string, userId?: string): Promise<QuoteRequest | null> {
    const cacheKey = CACHE_KEYS.QUOTE_DETAILS(quoteId);
    const cacheTTL = 30 * 60; // 30 minutes

    return this.getFromCacheOrDb(cacheKey, async () => {
      this.log('info', 'Getting quote request by ID', { quoteId, userId });

      const quoteQuery = await this.db
        .select({
          // Quote request details
          id: quoteRequests.id,
          userId: quoteRequests.userId,
          cruiseId: quoteRequests.cruiseId,
          passengerCount: quoteRequests.passengerCount,
          specialRequirements: quoteRequests.specialRequirements,
          contactInfo: quoteRequests.contactInfo,
          status: quoteRequests.status,
          totalPrice: quoteRequests.totalPrice,
          obcAmount: quoteRequests.obcAmount,
          expiresAt: quoteRequests.expiresAt,
          createdAt: quoteRequests.createdAt,
          updatedAt: quoteRequests.updatedAt,
          
          // Cruise details
          cruiseName: cruises.name,
          sailingDate: cruises.sailingDate,
          returnDate: cruises.returnDate,
          nights: cruises.nights,
          
          // Cruise line details
          cruiseLineId: cruiseLines.id,
          cruiseLineName: cruiseLines.name,
          cruiseLineLogoUrl: cruiseLines.logoUrl,
          
          // Ship details
          shipId: ships.id,
          shipName: ships.name,
          shipImageUrl: ships.defaultImageUrl,
          
          // Port details
          embarkPortId: ports.id,
          embarkPortName: ports.name,
          embarkPortCity: ports.city,
          embarkPortCountry: ports.country,
          
          // Disembark port details
          disembarkPortId: sql<number>`dp.id`,
          disembarkPortName: sql<string>`dp.name`,
          disembarkPortCity: sql<string>`dp.city`,
          disembarkPortCountry: sql<string>`dp.country`,
          
          // Pricing details
          cheapestPrice: cheapestPricing.cheapestPrice,
          currency: cheapestPricing.currency,
        })
        .from(quoteRequests)
        .innerJoin(cruises, eq(quoteRequests.cruiseId, cruises.id))
        .innerJoin(cruiseLines, eq(cruises.cruiseLineId, cruiseLines.id))
        .innerJoin(ships, eq(cruises.shipId, ships.id))
        .leftJoin(ports, eq(cruises.embarkPortId, ports.id))
        .leftJoin(sql`ports dp`, sql`${cruises.disembarkPortId} = dp.id`)
        .leftJoin(cheapestPricing, eq(cruises.id, cheapestPricing.cruiseId))
        .where(eq(quoteRequests.id, quoteId))
        .limit(1);

      if (!quoteQuery.length) {
        return null;
      }

      const quote = quoteQuery[0];

      // If userId is provided, verify access (user can only see their own quotes or quotes they created as guest)
      if (userId && quote.userId && quote.userId !== userId) {
        return null;
      }

      // Parse contact info and extract passenger details
      const contactInfo = quote.contactInfo as any;
      const passengerDetails = contactInfo?.passengerDetails || {
        adults: 2,
        children: 0,
        infants: 0,
      };

      const cruiseListItem: CruiseListItem = {
        id: quote.cruiseId,
        name: quote.cruiseName,
        cruiseLine: {
          id: quote.cruiseLineId,
          name: quote.cruiseLineName,
          logoUrl: quote.cruiseLineLogoUrl,
        },
        ship: {
          id: quote.shipId,
          name: quote.shipName,
          imageUrl: quote.shipImageUrl,
        },
        sailingDate: quote.sailingDate,
        returnDate: quote.returnDate,
        nights: quote.nights,
        embarkPort: {
          id: quote.embarkPortId,
          name: quote.embarkPortName,
          city: quote.embarkPortCity,
          country: quote.embarkPortCountry,
        },
        disembarkPort: {
          id: quote.disembarkPortId,
          name: quote.disembarkPortName,
          city: quote.disembarkPortCity,
          country: quote.disembarkPortCountry,
        },
        regions: [], // Would be populated from cruise regions
        pricing: {
          cheapest: quote.cheapestPrice ? {
            basePrice: parseFloat(quote.cheapestPrice),
            totalPrice: parseFloat(quote.cheapestPrice),
            taxes: 0,
            fees: 0,
            currency: quote.currency || 'USD',
            perPerson: true,
          } : undefined,
        },
        availability: true,
        highlights: [],
      };

      const quoteRequest: QuoteRequest = {
        id: quote.id,
        userId: quote.userId,
        cruiseId: quote.cruiseId,
        cruise: cruiseListItem,
        passengerDetails,
        cabinPreference: contactInfo?.cabinPreference,
        specialRequests: quote.specialRequirements,
        contactInfo: {
          email: contactInfo?.email || '',
          phone: contactInfo?.phone,
          preferredContactMethod: contactInfo?.preferredContactMethod || 'email',
        },
        status: quote.status as 'pending' | 'quoted' | 'expired' | 'declined',
        requestedAt: quote.createdAt,
        quoteExpiresAt: quote.expiresAt,
      };

      // Add quote details if quoted
      if (quote.status === 'quoted' && quote.totalPrice) {
        quoteRequest.quote = {
          totalPrice: parseFloat(quote.totalPrice),
          breakdown: {
            basePrice: parseFloat(quote.totalPrice),
            taxes: 0,
            fees: 0,
          },
          currency: quote.currency || 'USD',
          validUntil: quote.expiresAt || '',
          terms: 'Standard booking terms and conditions apply',
        };
      }

      return quoteRequest;
    }, cacheTTL);
  }

  /**
   * List user's quote requests
   */
  async listUserQuotes(userId: string, params: PaginationParams): Promise<QuoteListResult> {
    const cacheKey = CACHE_KEYS.USER_QUOTES(userId, params.page, params.limit);
    const cacheTTL = 15 * 60; // 15 minutes

    return this.getFromCacheOrDb(cacheKey, async () => {
      this.log('info', 'Listing user quote requests', { userId, ...params });

      const offset = (params.page - 1) * params.limit;

      // Get quote IDs for this user with pagination
      const quotesQuery = await this.db
        .select({ id: quoteRequests.id })
        .from(quoteRequests)
        .where(eq(quoteRequests.userId, userId))
        .orderBy(desc(quoteRequests.createdAt))
        .limit(params.limit)
        .offset(offset);

      // Get total count
      const countQuery = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(quoteRequests)
        .where(eq(quoteRequests.userId, userId));

      const totalCount = countQuery[0]?.count || 0;
      const totalPages = Math.ceil(totalCount / params.limit);

      // Get full quote details for each quote
      const quotes: QuoteRequest[] = [];
      for (const quoteRow of quotesQuery) {
        const quote = await this.getQuoteById(quoteRow.id, userId);
        if (quote) {
          quotes.push(quote);
        }
      }

      return {
        quotes,
        meta: {
          page: params.page,
          limit: params.limit,
          total: totalCount,
          totalPages,
          hasNext: params.page < totalPages,
          hasPrevious: params.page > 1,
        },
      };
    }, cacheTTL);
  }

  /**
   * Update quote request
   */
  async updateQuoteRequest(
    quoteId: string, 
    userId: string, 
    updateData: UpdateQuoteRequestData
  ): Promise<QuoteRequest | null> {
    return this.executeTransaction(async (tx) => {
      this.log('info', 'Updating quote request', { quoteId, userId });

      // Verify quote exists and belongs to user
      const existingQuote = await tx
        .select({ 
          id: quoteRequests.id, 
          userId: quoteRequests.userId,
          status: quoteRequests.status,
          contactInfo: quoteRequests.contactInfo,
        })
        .from(quoteRequests)
        .where(eq(quoteRequests.id, quoteId))
        .limit(1);

      if (!existingQuote.length) {
        return null;
      }

      const quote = existingQuote[0];

      // Verify ownership
      if (quote.userId !== userId) {
        return null;
      }

      // Don't allow updates to expired or quoted requests
      if (quote.status === 'expired' || quote.status === 'quoted') {
        throw new Error('Cannot update expired or already quoted requests');
      }

      // Merge contact info with existing data
      const existingContactInfo = quote.contactInfo as any || {};
      const updatedContactInfo = {
        ...existingContactInfo,
        ...(updateData.contactInfo || {}),
        ...(updateData.passengerDetails && { passengerDetails: updateData.passengerDetails }),
        ...(updateData.cabinPreference && { cabinPreference: updateData.cabinPreference }),
      };

      // Update passenger count if passenger details changed
      const newPassengerCount = updateData.passengerDetails
        ? updateData.passengerDetails.adults + updateData.passengerDetails.children + updateData.passengerDetails.infants
        : undefined;

      // Update the quote
      await tx
        .update(quoteRequests)
        .set({
          ...(updateData.specialRequests !== undefined && { specialRequirements: updateData.specialRequests }),
          ...(newPassengerCount && { passengerCount: newPassengerCount }),
          contactInfo: updatedContactInfo,
          updatedAt: new Date(),
        })
        .where(eq(quoteRequests.id, quoteId));

      // Clear caches
      await this.invalidateCache(CACHE_KEYS.QUOTE_DETAILS(quoteId));
      await this.invalidateCache(`user:quotes:${userId}:*`);

      // Return updated quote
      const updatedQuote = await this.getQuoteById(quoteId, userId);
      if (!updatedQuote) {
        throw new Error('Failed to retrieve updated quote request');
      }

      this.log('info', 'Quote request updated successfully', { quoteId, userId });

      return updatedQuote;
    });
  }

  /**
   * Cancel/delete quote request
   */
  async cancelQuoteRequest(quoteId: string, userId: string): Promise<boolean> {
    return this.executeTransaction(async (tx) => {
      this.log('info', 'Cancelling quote request', { quoteId, userId });

      // Verify quote exists and belongs to user
      const existingQuote = await tx
        .select({ 
          id: quoteRequests.id, 
          userId: quoteRequests.userId,
          status: quoteRequests.status,
        })
        .from(quoteRequests)
        .where(eq(quoteRequests.id, quoteId))
        .limit(1);

      if (!existingQuote.length) {
        return false;
      }

      const quote = existingQuote[0];

      // Verify ownership
      if (quote.userId !== userId) {
        return false;
      }

      // Update status to declined instead of deleting
      await tx
        .update(quoteRequests)
        .set({
          status: 'declined',
          updatedAt: new Date(),
        })
        .where(eq(quoteRequests.id, quoteId));

      // Clear caches
      await this.invalidateCache(CACHE_KEYS.QUOTE_DETAILS(quoteId));
      await this.invalidateCache(`user:quotes:${userId}:*`);

      this.log('info', 'Quote request cancelled successfully', { quoteId, userId });

      return true;
    });
  }

  /**
   * Get quote summary for user
   */
  async getQuoteSummary(userId: string): Promise<QuoteSummary> {
    const cacheKey = CACHE_KEYS.QUOTE_SUMMARY(userId);
    const cacheTTL = 30 * 60; // 30 minutes

    return this.getFromCacheOrDb(cacheKey, async () => {
      this.log('info', 'Getting quote summary', { userId });

      // Get quote statistics
      const stats = await this.db
        .select({
          status: quoteRequests.status,
          count: count(quoteRequests.id),
          totalValue: sql<number>`COALESCE(SUM(${quoteRequests.totalPrice}), 0)`,
        })
        .from(quoteRequests)
        .where(eq(quoteRequests.userId, userId))
        .groupBy(quoteRequests.status);

      // Get recent quotes (last 5)
      const recentQuoteIds = await this.db
        .select({ id: quoteRequests.id })
        .from(quoteRequests)
        .where(eq(quoteRequests.userId, userId))
        .orderBy(desc(quoteRequests.createdAt))
        .limit(5);

      const recentQuotes: QuoteRequest[] = [];
      for (const quoteRow of recentQuoteIds) {
        const quote = await this.getQuoteById(quoteRow.id, userId);
        if (quote) {
          recentQuotes.push(quote);
        }
      }

      // Calculate totals
      let totalQuotes = 0;
      let pendingQuotes = 0;
      let quotedQuotes = 0;
      let expiredQuotes = 0;
      let totalValue = 0;

      stats.forEach(stat => {
        totalQuotes += stat.count;
        totalValue += parseFloat(stat.totalValue?.toString() || '0');
        
        switch (stat.status) {
          case 'pending':
            pendingQuotes = stat.count;
            break;
          case 'quoted':
            quotedQuotes = stat.count;
            break;
          case 'expired':
            expiredQuotes = stat.count;
            break;
        }
      });

      return {
        totalQuotes,
        pendingQuotes,
        quotedQuotes,
        expiredQuotes,
        totalValue,
        recentQuotes,
      };
    }, cacheTTL);
  }

  // Private helper methods

  /**
   * Get estimated price for a cruise based on cabin preference
   */
  private async getEstimatedPrice(cruiseId: number, cabinPreference?: string): Promise<number> {
    const pricing = await this.db
      .select({
        cheapestPrice: cheapestPricing.cheapestPrice,
        interiorPrice: cheapestPricing.interiorPrice,
        oceanviewPrice: cheapestPricing.oceanviewPrice,
        balconyPrice: cheapestPricing.balconyPrice,
        suitePrice: cheapestPricing.suitePrice,
      })
      .from(cheapestPricing)
      .where(eq(cheapestPricing.cruiseId, cruiseId))
      .limit(1);

    if (!pricing.length) {
      return 0;
    }

    const prices = pricing[0];

    // Return price based on cabin preference
    switch (cabinPreference) {
      case 'interior':
        return parseFloat(prices.interiorPrice || prices.cheapestPrice || '0');
      case 'oceanview':
        return parseFloat(prices.oceanviewPrice || prices.cheapestPrice || '0');
      case 'balcony':
        return parseFloat(prices.balconyPrice || prices.cheapestPrice || '0');
      case 'suite':
        return parseFloat(prices.suitePrice || prices.cheapestPrice || '0');
      default:
        return parseFloat(prices.cheapestPrice || '0');
    }
  }
}