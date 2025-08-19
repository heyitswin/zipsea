import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import { createHmac, timingSafeEqual } from 'crypto';
import { ValidationError } from './error-handler';
import logger from '../config/logger';

/**
 * Validation middleware factory for request body, query, and params
 */
export interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export const validate = (schemas: ValidationSchemas) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Validate request body
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }

      // Validate query parameters
      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }

      // Validate route parameters
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = new ValidationError(
          'Request validation failed',
          error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message,
            received: (issue as any).received || undefined,
          }))
        );
        next(validationError);
      } else {
        next(error);
      }
    }
  };
};

/**
 * Common validation schemas
 */
export const commonSchemas = {
  // Pagination
  pagination: z.object({
    page: z.string().transform(Number).pipe(z.number().int().min(1)).default('1'),
    limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default('20'),
  }),

  // Sorting
  sort: z.object({
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  }),

  // Date range
  dateRange: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }).refine(
    data => !data.startDate || !data.endDate || new Date(data.startDate) <= new Date(data.endDate),
    {
      message: 'Start date must be before or equal to end date',
      path: ['dateRange'],
    }
  ),

  // ID parameter
  idParam: z.object({
    id: z.string().transform(Number).pipe(z.number().int().positive()),
  }),

  // UUID parameter
  uuidParam: z.object({
    id: z.string().uuid(),
  }),

  // Search query
  search: z.object({
    q: z.string().min(1).max(100).optional(),
  }),
};

/**
 * Cruise search validation schemas
 */
export const cruiseSchemas = {
  search: z.object({
    destination: z.string().optional(),
    departurePort: z.string().optional(),
    cruiseLine: z.string().optional(),
    ship: z.string().optional(),
    minNights: z.string().transform(Number).pipe(z.number().int().min(1)).optional(),
    maxNights: z.string().transform(Number).pipe(z.number().int().min(1)).optional(),
    minPrice: z.string().transform(Number).pipe(z.number().min(0)).optional(),
    maxPrice: z.string().transform(Number).pipe(z.number().min(0)).optional(),
    sailingDateFrom: z.string().datetime().optional(),
    sailingDateTo: z.string().datetime().optional(),
    cabinType: z.enum(['interior', 'oceanview', 'balcony', 'suite']).optional(),
  }).merge(commonSchemas.pagination).merge(commonSchemas.sort),

  createQuoteRequest: z.object({
    cruiseId: z.number().int().positive(),
    passengerDetails: z.object({
      adults: z.number().int().min(1).max(8),
      children: z.number().int().min(0).max(6),
      infants: z.number().int().min(0).max(2),
      ages: z.array(z.number().int().min(0).max(100)).optional(),
    }),
    cabinPreference: z.enum(['interior', 'oceanview', 'balcony', 'suite']).optional(),
    specialRequests: z.string().max(1000).optional(),
    contactInfo: z.object({
      email: z.string().email(),
      phone: z.string().min(10).max(15).optional(),
      preferredContactMethod: z.enum(['email', 'phone']).default('email'),
    }),
  }),
};

/**
 * User management validation schemas
 */
export const userSchemas = {
  updateProfile: z.object({
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    phone: z.string().min(10).max(15).optional(),
    dateOfBirth: z.string().datetime().optional(),
    preferences: z.object({
      cruiseLines: z.array(z.number().int()).optional(),
      destinations: z.array(z.string()).optional(),
      cabinTypes: z.array(z.enum(['interior', 'oceanview', 'balcony', 'suite'])).optional(),
      budgetRange: z.object({
        min: z.number().min(0).optional(),
        max: z.number().min(0).optional(),
      }).optional(),
      notifications: z.object({
        email: z.boolean().default(true),
        sms: z.boolean().default(false),
        deals: z.boolean().default(true),
        reminders: z.boolean().default(true),
      }).optional(),
    }).optional(),
  }),

  savedSearch: z.object({
    name: z.string().min(1).max(100),
    searchCriteria: cruiseSchemas.search.omit({ page: true, limit: true }),
    alertEnabled: z.boolean().default(false),
    alertFrequency: z.enum(['daily', 'weekly', 'monthly']).default('weekly'),
  }),
};

/**
 * Webhook signature validation middleware
 * Validates webhook signatures for secure webhook processing
 */
export const validateWebhookSignature = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const signature = req.headers['x-webhook-signature'] as string;
    const webhookSecret = process.env.WEBHOOK_SECRET;

    // Skip validation in staging if no secret is set
    if (!webhookSecret) {
      if (process.env.NODE_ENV === 'staging') {
        logger.warn('Webhook secret not configured - skipping signature validation');
        next();
        return;
      } else {
        logger.error('Webhook secret not configured in production');
        res.status(500).json({
          error: 'Webhook configuration error',
          message: 'Server configuration issue',
        });
        return;
      }
    }

    // Skip validation if no signature provided in staging
    if (!signature && process.env.NODE_ENV === 'staging') {
      logger.warn('No webhook signature provided - skipping validation in staging');
      next();
      return;
    }

    if (!signature) {
      logger.warn('No webhook signature provided');
      res.status(400).json({
        error: 'Missing webhook signature',
        message: 'X-Webhook-Signature header is required',
      });
      return;
    }

    // Get raw body for signature verification
    const rawBody = JSON.stringify(req.body);
    const expectedSignature = createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    // Compare signatures using timing-safe comparison
    const providedSignature = signature.replace('sha256=', '');
    const isValid = timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    );

    if (!isValid) {
      logger.warn('Invalid webhook signature', {
        provided: providedSignature.substring(0, 8) + '...',
        expected: expectedSignature.substring(0, 8) + '...',
      });
      res.status(401).json({
        error: 'Invalid webhook signature',
        message: 'Signature verification failed',
      });
      return;
    }

    logger.debug('Webhook signature validated successfully');
    next();

  } catch (error) {
    logger.error('Error validating webhook signature', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(500).json({
      error: 'Signature validation error',
      message: 'Internal server error',
    });
  }
};

export default validate;