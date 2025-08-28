import { Request, Response } from 'express';
import { quoteService } from '../services/quote.service';
import { userService } from '../services/user.service';
import { logger } from '../config/logger';

class QuoteController {
  async createQuoteRequest(req: Request, res: Response): Promise<void> {
    try {
      const {
        cruiseId,
        cabinType,
        adults,
        children,
        travelInsurance,
        discountQualifiers,
        email,
      } = req.body;

      // Get user ID if authenticated
      const clerkUserId = req.headers['x-clerk-user-id'] as string;
      let userId: string | undefined;
      
      if (clerkUserId) {
        const user = await userService.getByClerkId(clerkUserId);
        userId = user?.id;
      }

      // Create quote request
      const quote = await quoteService.createQuoteRequest({
        userId,
        email: email || req.body.userEmail,
        cruiseId,
        cabinType,
        adults,
        children,
        travelInsurance,
        discountQualifiers,
      });

      res.json({
        success: true,
        data: quote,
      });
    } catch (error) {
      logger.error('Error creating quote request:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create quote request',
      });
    }
  }

  async getQuoteRequests(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string;
      const offset = (page - 1) * limit;

      const result = await quoteService.getAllQuotes(limit, offset, status);

      res.json({
        success: true,
        data: {
          quotes: result.quotes,
          meta: {
            page,
            limit,
            total: result.total,
            totalPages: Math.ceil(result.total / limit),
          },
        },
      });
    } catch (error) {
      logger.error('Error getting quote requests:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get quote requests',
      });
    }
  }

  async getQuoteRequestById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const quote = await quoteService.getQuoteWithDetails(id);

      if (!quote) {
        res.status(404).json({
          success: false,
          error: 'Quote not found',
        });
        return;
      }

      res.json({
        success: true,
        data: quote,
      });
    } catch (error) {
      logger.error('Error getting quote by ID:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get quote',
      });
    }
  }

  async updateQuoteStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;

      const quote = await quoteService.updateQuoteStatus(id, status, notes);

      res.json({
        success: true,
        data: quote,
      });
    } catch (error) {
      logger.error('Error updating quote status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update quote status',
      });
    }
  }

  async createQuote(req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      data: {
        id: 'temp-quote-id',
        status: 'pending',
        message: 'Quote created - implementation pending'
      }
    });
  }

  async listUserQuotes(req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      data: {
        quotes: [],
        meta: {
          page: 1,
          limit: 20,
          total: 0
        }
      }
    });
  }

  async getQuoteSummary(req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      data: {
        id: req.params.id,
        summary: {},
        message: 'Quote summary - implementation pending'
      }
    });
  }

  async getQuote(req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      data: {
        id: req.params.id,
        details: {},
        message: 'Quote details - implementation pending'
      }
    });
  }

  async updateQuote(req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      data: {
        id: req.params.id,
        updated: true,
        message: 'Quote updated - implementation pending'
      }
    });
  }

  async cancelQuote(req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      data: {
        id: req.params.id,
        cancelled: true,
        message: 'Quote cancelled - implementation pending'
      }
    });
  }
}

export const quoteController = new QuoteController();