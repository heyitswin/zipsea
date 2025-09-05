import { logger } from '../config/logger';
import postgres from 'postgres';
import { env } from '../config/environment';

const sql = postgres(env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: { rejectUnauthorized: false },
});

export interface QuoteRequestData {
  userId?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  cruiseId: string; // Now handles VARCHAR cruise IDs from new schema
  cabinType: string;
  adults: number;
  children: number;
  travelInsurance: boolean;
  specialRequests?: string;
  discountQualifiers?: Record<string, any>;
}

export interface QuoteResponse {
  id: string;
  referenceNumber: string;
  status: string;
  createdAt: string;
  userId?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  cruiseId: string;
  cabinType: string;
  adults: number;
  children: number;
  travelInsurance: boolean;
  specialRequests?: string;
  discountQualifiers?: Record<string, any>;
}

export interface QuoteWithDetails extends QuoteResponse {
  cruise?: {
    id: string;
    cruise_id: string;
    name: string;
    sailing_date: string;
    return_date?: string;
    nights: number;
    ship_name: string;
    cruise_line_name: string;
    embark_port_name?: string;
    cheapest_price?: number;
  };
  pricing?: {
    interior_price?: number;
    oceanview_price?: number;
    balcony_price?: number;
    suite_price?: number;
    cheapest_price?: number;
    currency: string;
  };
}

class QuoteServiceFixed {
  private generateReferenceNumber(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `ZS-${timestamp}-${random}`.toUpperCase();
  }

  private async ensureQuoteRequestsTable(): Promise<void> {
    try {
      // Check if table exists and create it with proper schema if needed
      await sql`
        CREATE TABLE IF NOT EXISTS quote_requests (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          reference_number VARCHAR(50) UNIQUE NOT NULL,
          user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          email VARCHAR(255) NOT NULL,
          first_name VARCHAR(100),
          last_name VARCHAR(100),
          phone VARCHAR(20),
          cruise_id VARCHAR NOT NULL, -- Changed to VARCHAR to match cruises.id
          cabin_type VARCHAR(100) NOT NULL,
          adults INTEGER NOT NULL DEFAULT 2,
          children INTEGER NOT NULL DEFAULT 0,
          travel_insurance BOOLEAN NOT NULL DEFAULT false,
          special_requests TEXT,
          discount_qualifiers JSONB DEFAULT '{}',
          status VARCHAR(50) NOT NULL DEFAULT 'pending',
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        )
      `;

      // Create index on cruise_id for performance
      await sql`
        CREATE INDEX IF NOT EXISTS idx_quote_requests_cruise_id
        ON quote_requests(cruise_id)
      `;

      // Create index on email for lookup
      await sql`
        CREATE INDEX IF NOT EXISTS idx_quote_requests_email
        ON quote_requests(email)
      `;

      // Create index on status for filtering
      await sql`
        CREATE INDEX IF NOT EXISTS idx_quote_requests_status
        ON quote_requests(status)
      `;

      logger.info('Quote requests table ensured with proper schema');
    } catch (error) {
      logger.error('Error ensuring quote_requests table:', error);
    }
  }

  async createQuoteRequest(data: QuoteRequestData): Promise<QuoteResponse> {
    try {
      await this.ensureQuoteRequestsTable();

      const referenceNumber = this.generateReferenceNumber();

      // Validate cruise exists in the new schema
      const cruiseExists = await sql`
        SELECT id, cruise_id, name
        FROM cruises
        WHERE id = ${data.cruiseId} OR cruise_id = ${data.cruiseId}
        LIMIT 1
      `;

      if (cruiseExists.length === 0) {
        throw new Error(`Cruise not found with ID: ${data.cruiseId}`);
      }

      const actualCruiseId = cruiseExists[0].id; // Use the primary key

      // Insert quote request
      const result = await sql`
        INSERT INTO quote_requests (
          reference_number,
          user_id,
          email,
          first_name,
          last_name,
          phone,
          cruise_id,
          cabin_type,
          adults,
          children,
          travel_insurance,
          special_requests,
          discount_qualifiers,
          status
        )
        VALUES (
          ${referenceNumber},
          ${data.userId || null},
          ${data.email},
          ${data.firstName || null},
          ${data.lastName || null},
          ${data.phone || null},
          ${actualCruiseId},
          ${data.cabinType},
          ${data.adults},
          ${data.children},
          ${data.travelInsurance},
          ${data.specialRequests || null},
          ${JSON.stringify(data.discountQualifiers || {})},
          'pending'
        )
        RETURNING *
      `;

      const quote = result[0];

      return {
        id: quote.id,
        referenceNumber: quote.reference_number,
        status: quote.status,
        createdAt: quote.created_at,
        userId: quote.user_id,
        email: quote.email,
        firstName: quote.first_name,
        lastName: quote.last_name,
        phone: quote.phone,
        cruiseId: quote.cruise_id,
        cabinType: quote.cabin_type,
        adults: quote.adults,
        children: quote.children,
        travelInsurance: quote.travel_insurance,
        specialRequests: quote.special_requests,
        discountQualifiers: quote.discount_qualifiers,
      };
    } catch (error) {
      logger.error('Error creating quote request:', error);
      throw new Error('Failed to create quote request');
    }
  }

  async getAllQuotes(
    limit: number = 20,
    offset: number = 0,
    status?: string
  ): Promise<{ quotes: QuoteResponse[]; total: number }> {
    try {
      await this.ensureQuoteRequestsTable();

      // Build WHERE clause
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (status) {
        whereClause += ` AND status = $${params.length + 1}`;
        params.push(status);
      }

      // Get total count
      const totalResult = await sql.unsafe(`
        SELECT COUNT(*) as total
        FROM quote_requests
        ${whereClause}
      `, params);

      const total = parseInt(totalResult[0].total);

      // Get paginated quotes
      const quotesResult = await sql.unsafe(`
        SELECT * FROM quote_requests
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]);

      const quotes = quotesResult.map((quote: any) => ({
        id: quote.id,
        referenceNumber: quote.reference_number,
        status: quote.status,
        createdAt: quote.created_at,
        userId: quote.user_id,
        email: quote.email,
        firstName: quote.first_name,
        lastName: quote.last_name,
        phone: quote.phone,
        cruiseId: quote.cruise_id,
        cabinType: quote.cabin_type,
        adults: quote.adults,
        children: quote.children,
        travelInsurance: quote.travel_insurance,
        specialRequests: quote.special_requests,
        discountQualifiers: quote.discount_qualifiers,
      }));

      return { quotes, total };
    } catch (error) {
      logger.error('Error getting all quotes:', error);
      throw new Error('Failed to get quotes');
    }
  }

  async getQuoteWithDetails(id: string): Promise<QuoteWithDetails | null> {
    try {
      await this.ensureQuoteRequestsTable();

      // Get quote with cruise details using proper joins for new schema
      const result = await sql`
        SELECT
          q.*,
          c.id as cruise_id,
          c.cruise_id as cruise_secondary_id,
          c.name as cruise_name,
          c.sailing_date,
          c.return_date,
          c.nights,
          c.interior_price,
          c.oceanview_price,
          c.balcony_price,
          c.suite_price,
          c.cheapest_price,
          c.currency,
          s.name as ship_name,
          cl.name as cruise_line_name,
          ep.name as embark_port_name
        FROM quote_requests q
        LEFT JOIN cruises c ON q.cruise_id = c.id
        LEFT JOIN ships s ON c.ship_id = s.id
        LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
        LEFT JOIN ports ep ON c.embarkation_port_id = ep.id
        WHERE q.id = ${id}
        LIMIT 1
      `;

      if (result.length === 0) {
        return null;
      }

      const row = result[0];

      const quote: QuoteWithDetails = {
        id: row.id,
        referenceNumber: row.reference_number,
        status: row.status,
        createdAt: row.created_at,
        userId: row.user_id,
        email: row.email,
        firstName: row.first_name,
        lastName: row.last_name,
        phone: row.phone,
        cruiseId: row.cruise_id,
        cabinType: row.cabin_type,
        adults: row.adults,
        children: row.children,
        travelInsurance: row.travel_insurance,
        specialRequests: row.special_requests,
        discountQualifiers: row.discount_qualifiers,
      };

      // Add cruise details if available
      if (row.cruise_name) {
        quote.cruise = {
          id: row.cruise_id,
          cruise_id: row.cruise_secondary_id,
          name: row.cruise_name,
          sailing_date: row.sailing_date,
          return_date: row.return_date || (row.sailing_date && row.nights ?
            new Date(new Date(row.sailing_date).getTime() + (row.nights * 24 * 60 * 60 * 1000)).toISOString().split('T')[0]
            : null),
          nights: row.nights,
          ship_name: row.ship_name,
          cruise_line_name: row.cruise_line_name,
          embark_port_name: row.embark_port_name,
          cheapest_price: row.cheapest_price ? parseFloat(row.cheapest_price) : null,
        };
      }

      // Add pricing details if available
      if (row.interior_price || row.oceanview_price || row.balcony_price || row.suite_price) {
        quote.pricing = {
          interior_price: row.interior_price ? parseFloat(row.interior_price) : null,
          oceanview_price: row.oceanview_price ? parseFloat(row.oceanview_price) : null,
          balcony_price: row.balcony_price ? parseFloat(row.balcony_price) : null,
          suite_price: row.suite_price ? parseFloat(row.suite_price) : null,
          cheapest_price: row.cheapest_price ? parseFloat(row.cheapest_price) : null,
          currency: row.currency || 'USD',
        };
      }

      return quote;
    } catch (error) {
      logger.error('Error getting quote with details:', error);
      throw new Error('Failed to get quote details');
    }
  }

  async updateQuoteStatus(
    id: string,
    status: string,
    notes?: string
  ): Promise<QuoteResponse> {
    try {
      await this.ensureQuoteRequestsTable();

      const result = await sql`
        UPDATE quote_requests
        SET
          status = ${status},
          notes = ${notes || null},
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;

      if (result.length === 0) {
        throw new Error('Quote not found');
      }

      const quote = result[0];

      return {
        id: quote.id,
        referenceNumber: quote.reference_number,
        status: quote.status,
        createdAt: quote.created_at,
        userId: quote.user_id,
        email: quote.email,
        firstName: quote.first_name,
        lastName: quote.last_name,
        phone: quote.phone,
        cruiseId: quote.cruise_id,
        cabinType: quote.cabin_type,
        adults: quote.adults,
        children: quote.children,
        travelInsurance: quote.travel_insurance,
        specialRequests: quote.special_requests,
        discountQualifiers: quote.discount_qualifiers,
      };
    } catch (error) {
      logger.error('Error updating quote status:', error);
      throw new Error('Failed to update quote status');
    }
  }

  async getQuotesByUserId(userId: string): Promise<QuoteResponse[]> {
    try {
      await this.ensureQuoteRequestsTable();

      const result = await sql`
        SELECT * FROM quote_requests
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
      `;

      return result.map((quote: any) => ({
        id: quote.id,
        referenceNumber: quote.reference_number,
        status: quote.status,
        createdAt: quote.created_at,
        userId: quote.user_id,
        email: quote.email,
        firstName: quote.first_name,
        lastName: quote.last_name,
        phone: quote.phone,
        cruiseId: quote.cruise_id,
        cabinType: quote.cabin_type,
        adults: quote.adults,
        children: quote.children,
        travelInsurance: quote.travel_insurance,
        specialRequests: quote.special_requests,
        discountQualifiers: quote.discount_qualifiers,
      }));
    } catch (error) {
      logger.error('Error getting quotes by user ID:', error);
      throw new Error('Failed to get user quotes');
    }
  }

  async deleteQuote(id: string): Promise<boolean> {
    try {
      await this.ensureQuoteRequestsTable();

      const result = await sql`
        DELETE FROM quote_requests
        WHERE id = ${id}
      `;

      return result.count > 0;
    } catch (error) {
      logger.error('Error deleting quote:', error);
      throw new Error('Failed to delete quote');
    }
  }

  async getQuoteStats(): Promise<{
    total: number;
    pending: number;
    completed: number;
    cancelled: number;
  }> {
    try {
      await this.ensureQuoteRequestsTable();

      const result = await sql`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled
        FROM quote_requests
      `;

      const stats = result[0];

      return {
        total: parseInt(stats.total),
        pending: parseInt(stats.pending),
        completed: parseInt(stats.completed),
        cancelled: parseInt(stats.cancelled),
      };
    } catch (error) {
      logger.error('Error getting quote stats:', error);
      throw new Error('Failed to get quote statistics');
    }
  }
}

export const quoteServiceFixed = new QuoteServiceFixed();
