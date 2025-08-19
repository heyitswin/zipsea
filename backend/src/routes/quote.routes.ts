import { Router } from 'express';
import { quoteController } from '../controllers/quote.controller';
// Note: Add actual Clerk auth middleware when available
// import { ClerkExpressWithAuth } from '@clerk/clerk-sdk-node';

const router = Router();

/**
 * POST /api/v1/quotes
 * Create a new quote request (guest or authenticated)
 */
router.post('/', quoteController.createQuote.bind(quoteController));

/**
 * GET /api/v1/quotes
 * List user's quote requests (authenticated users only)
 */
router.get('/', quoteController.listUserQuotes.bind(quoteController));

/**
 * GET /api/v1/quotes/summary
 * Get quote request summary statistics for authenticated user
 */
router.get('/summary', quoteController.getQuoteSummary.bind(quoteController));

/**
 * GET /api/v1/quotes/:id
 * Get specific quote request details
 */
router.get('/:id', quoteController.getQuote.bind(quoteController));

/**
 * PUT /api/v1/quotes/:id
 * Update quote request (authenticated users only)
 */
router.put('/:id', quoteController.updateQuote.bind(quoteController));

/**
 * DELETE /api/v1/quotes/:id
 * Cancel/delete quote request (authenticated users only)
 */
router.delete('/:id', quoteController.cancelQuote.bind(quoteController));

export default router;