import { Request, Response } from 'express';
import { z } from 'zod';
import { QuoteService } from '../services/quote.service';
import { db } from '../db/connection';
import { cacheManager } from '../cache/cache-manager';
import logger from '../config/logger';
import { ApiResponse, QuoteRequest, QuoteRequestData } from '../types/api.types';

// Validation schemas
const passengerDetailsSchema = z.object({
  adults: z.number().int().min(1).max(8),
  children: z.number().int().min(0).max(6),
  infants: z.number().int().min(0).max(4),
  ages: z.array(z.number().int().min(0).max(120)).optional(),
});

const contactInfoSchema = z.object({
  email: z.string().email(),
  phone: z.string().optional(),
  preferredContactMethod: z.enum(['email', 'phone']),
});

const quoteRequestSchema = z.object({
  cruiseId: z.number().int().positive(),
  passengerDetails: passengerDetailsSchema,
  cabinPreference: z.enum(['interior', 'oceanview', 'balcony', 'suite']).optional(),
  specialRequests: z.string().max(1000).optional(),
  contactInfo: contactInfoSchema,
});

const quoteUpdateSchema = z.object({
  passengerDetails: passengerDetailsSchema.optional(),
  cabinPreference: z.enum(['interior', 'oceanview', 'balcony', 'suite']).optional(),
  specialRequests: z.string().max(1000).optional(),
  contactInfo: contactInfoSchema.optional(),
});

const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

class QuoteController {
  private quoteService: QuoteService;

  constructor() {
    this.quoteService = new QuoteService(db, cacheManager);
  }

  /**
   * POST /api/v1/quotes
   * Create a new quote request
   */
  async createQuote(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = quoteRequestSchema.parse(req.body);
      const userId = req.auth?.userId || null; // From Clerk middleware (optional for guests)

      logger.info('Quote request creation started', {
        cruiseId: validatedData.cruiseId,
        userId,
        passengerCount: validatedData.passengerDetails.adults + validatedData.passengerDetails.children,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      const quote = await this.quoteService.createQuoteRequest({
        ...validatedData,
        userId,
      });

      const response: ApiResponse<QuoteRequest> = {
        success: true,
        data: quote,
      };

      // Log successful quote creation
      logger.info('Quote request created successfully', {
        quoteId: quote.id,
        cruiseId: quote.cruiseId,
        userId,
      });

      res.status(201).json(response);
    } catch (error) {
      logger.error('Quote request creation failed', { 
        error, 
        body: req.body,
        userId: req.auth?.userId,
      });
      
      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: {
            message: 'Invalid quote request data',
            code: 'VALIDATION_ERROR',
            status: 400,
            details: error.errors,
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        };
        res.status(400).json(response);
        return;
      }

      const response: ApiResponse = {
        success: false,
        error: {
          message: 'Failed to create quote request',
          code: 'QUOTE_CREATION_ERROR',
          status: 500,
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      };
      res.status(500).json(response);
    }
  }

  /**
   * GET /api/v1/quotes
   * List user's quote requests (authenticated users only)
   */
  async listUserQuotes(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.auth?.userId;
      
      if (!userId) {
        const response: ApiResponse = {
          success: false,
          error: {
            message: 'Authentication required to view quote requests',
            code: 'AUTHENTICATION_REQUIRED',
            status: 401,
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        };
        res.status(401).json(response);
        return;
      }

      const validatedParams = paginationSchema.parse({
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      });

      logger.info('Listing user quote requests', {
        userId,
        page: validatedParams.page,
        limit: validatedParams.limit,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      const result = await this.quoteService.listUserQuotes(userId, validatedParams);

      const response: ApiResponse = {
        success: true,
        data: result.quotes,
        meta: result.meta,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('List user quotes failed', { 
        error, 
        userId: req.auth?.userId,
        query: req.query,
      });
      
      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: {
            message: 'Invalid request parameters',
            code: 'VALIDATION_ERROR',
            status: 400,
            details: error.errors,
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        };
        res.status(400).json(response);
        return;
      }

      const response: ApiResponse = {
        success: false,
        error: {
          message: 'Failed to list quote requests',
          code: 'QUOTE_LIST_ERROR',
          status: 500,
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      };
      res.status(500).json(response);
    }
  }

  /**
   * GET /api/v1/quotes/:id
   * Get specific quote request details
   */
  async getQuote(req: Request, res: Response): Promise<void> {
    try {
      const quoteId = req.params.id;
      const userId = req.auth?.userId;

      if (!quoteId) {
        const response: ApiResponse = {
          success: false,
          error: {
            message: 'Quote ID is required',
            code: 'VALIDATION_ERROR',
            status: 400,
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        };
        res.status(400).json(response);
        return;
      }

      logger.info('Getting quote request details', {
        quoteId,
        userId,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      const quote = await this.quoteService.getQuoteById(quoteId, userId);

      if (!quote) {
        const response: ApiResponse = {
          success: false,
          error: {
            message: 'Quote request not found',
            code: 'QUOTE_NOT_FOUND',
            status: 404,
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<QuoteRequest> = {
        success: true,
        data: quote,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Get quote failed', { 
        error, 
        quoteId: req.params.id,
        userId: req.auth?.userId,
      });

      const response: ApiResponse = {
        success: false,
        error: {
          message: 'Failed to get quote request',
          code: 'QUOTE_GET_ERROR',
          status: 500,
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      };
      res.status(500).json(response);
    }
  }

  /**
   * PUT /api/v1/quotes/:id
   * Update quote request (authenticated users only)
   */
  async updateQuote(req: Request, res: Response): Promise<void> {
    try {
      const quoteId = req.params.id;
      const userId = req.auth?.userId;

      if (!userId) {
        const response: ApiResponse = {
          success: false,
          error: {
            message: 'Authentication required to update quote requests',
            code: 'AUTHENTICATION_REQUIRED',
            status: 401,
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        };
        res.status(401).json(response);
        return;
      }

      if (!quoteId) {
        const response: ApiResponse = {
          success: false,
          error: {
            message: 'Quote ID is required',
            code: 'VALIDATION_ERROR',
            status: 400,
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        };
        res.status(400).json(response);
        return;
      }

      const validatedData = quoteUpdateSchema.parse(req.body);

      logger.info('Quote request update started', {
        quoteId,
        userId,
        updateFields: Object.keys(validatedData),
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      const updatedQuote = await this.quoteService.updateQuoteRequest(
        quoteId, 
        userId, 
        validatedData
      );

      if (!updatedQuote) {
        const response: ApiResponse = {
          success: false,
          error: {
            message: 'Quote request not found or access denied',
            code: 'QUOTE_NOT_FOUND',
            status: 404,
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<QuoteRequest> = {
        success: true,
        data: updatedQuote,
      };

      // Log successful quote update
      logger.info('Quote request updated successfully', {
        quoteId: updatedQuote.id,
        userId,
      });

      res.status(200).json(response);
    } catch (error) {
      logger.error('Quote request update failed', { 
        error, 
        quoteId: req.params.id,
        userId: req.auth?.userId,
        body: req.body,
      });
      
      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: {
            message: 'Invalid update data',
            code: 'VALIDATION_ERROR',
            status: 400,
            details: error.errors,
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        };
        res.status(400).json(response);
        return;
      }

      const response: ApiResponse = {
        success: false,
        error: {
          message: 'Failed to update quote request',
          code: 'QUOTE_UPDATE_ERROR',
          status: 500,
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      };
      res.status(500).json(response);
    }
  }

  /**
   * DELETE /api/v1/quotes/:id
   * Cancel/delete quote request (authenticated users only)
   */
  async cancelQuote(req: Request, res: Response): Promise<void> {
    try {
      const quoteId = req.params.id;
      const userId = req.auth?.userId;

      if (!userId) {
        const response: ApiResponse = {
          success: false,
          error: {
            message: 'Authentication required to cancel quote requests',
            code: 'AUTHENTICATION_REQUIRED',
            status: 401,
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        };
        res.status(401).json(response);
        return;
      }

      if (!quoteId) {
        const response: ApiResponse = {
          success: false,
          error: {
            message: 'Quote ID is required',
            code: 'VALIDATION_ERROR',
            status: 400,
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        };
        res.status(400).json(response);
        return;
      }

      logger.info('Quote request cancellation started', {
        quoteId,
        userId,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      const success = await this.quoteService.cancelQuoteRequest(quoteId, userId);

      if (!success) {
        const response: ApiResponse = {
          success: false,
          error: {
            message: 'Quote request not found or access denied',
            code: 'QUOTE_NOT_FOUND',
            status: 404,
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: { message: 'Quote request cancelled successfully' },
      };

      // Log successful quote cancellation
      logger.info('Quote request cancelled successfully', {
        quoteId,
        userId,
      });

      res.status(200).json(response);
    } catch (error) {
      logger.error('Quote request cancellation failed', { 
        error, 
        quoteId: req.params.id,
        userId: req.auth?.userId,
      });

      const response: ApiResponse = {
        success: false,
        error: {
          message: 'Failed to cancel quote request',
          code: 'QUOTE_CANCEL_ERROR',
          status: 500,
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      };
      res.status(500).json(response);
    }
  }

  /**
   * GET /api/v1/quotes/summary
   * Get quote request summary statistics for authenticated user
   */
  async getQuoteSummary(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.auth?.userId;
      
      if (!userId) {
        const response: ApiResponse = {
          success: false,
          error: {
            message: 'Authentication required to view quote summary',
            code: 'AUTHENTICATION_REQUIRED',
            status: 401,
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        };
        res.status(401).json(response);
        return;
      }

      logger.info('Getting quote summary', {
        userId,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      const summary = await this.quoteService.getQuoteSummary(userId);

      const response: ApiResponse = {
        success: true,
        data: summary,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Get quote summary failed', { 
        error, 
        userId: req.auth?.userId,
      });

      const response: ApiResponse = {
        success: false,
        error: {
          message: 'Failed to get quote summary',
          code: 'QUOTE_SUMMARY_ERROR',
          status: 500,
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      };
      res.status(500).json(response);
    }
  }
}

export const quoteController = new QuoteController();
export default quoteController;