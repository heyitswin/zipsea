import { Router } from 'express';
import { apiConfig } from '../config/environment';
import healthRoutes from './health.routes';
import webhookRoutes from './webhook.routes';
import searchRoutes from './search.routes';
import cruiseRoutes from './cruise.routes';
import quoteRoutes from './quote.routes';
import adminRoutes from './admin.routes';

const router = Router();

// Health check routes (outside API versioning)
router.use('/health', healthRoutes);

// API versioning
const apiRouter = Router();

// Mount versioned API routes
router.use(apiConfig.prefix, apiRouter);
router.use(`${apiConfig.prefix}/${apiConfig.version}`, apiRouter);

// Webhook routes (outside API versioning)
apiRouter.use('/webhooks', webhookRoutes);

// Admin routes (for debugging and management)
apiRouter.use('/admin', adminRoutes);

// Core API routes
apiRouter.use('/search', searchRoutes);
apiRouter.use('/cruises', cruiseRoutes);
apiRouter.use('/quotes', quoteRoutes);

// Additional API routes will be added here as we implement them
// apiRouter.use('/auth', authRoutes);
// apiRouter.use('/users', userRoutes);

// API info endpoint
apiRouter.get('/', (req, res) => {
  res.json({
    service: 'Zipsea Backend API',
    version: apiConfig.version,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    endpoints: {
      health: '/health',
      api: `${apiConfig.prefix}/${apiConfig.version}`,
      webhooks: `${apiConfig.prefix}/webhooks`,
      admin: `${apiConfig.prefix}/${apiConfig.version}/admin`,
      search: `${apiConfig.prefix}/${apiConfig.version}/search`,
      cruises: `${apiConfig.prefix}/${apiConfig.version}/cruises`,
      quotes: `${apiConfig.prefix}/${apiConfig.version}/quotes`,
    },
    features: {
      search: {
        post_search: 'POST /search - Advanced cruise search with filters',
        get_filters: 'GET /search/filters - Available filter options',
        get_popular: 'GET /search/popular - Popular destinations',
        get_suggestions: 'GET /search/suggestions - Search suggestions',
      },
      cruises: {
        list: 'GET /cruises - List cruises with pagination',
        details: 'GET /cruises/:id - Detailed cruise information',
        pricing: 'GET /cruises/:id/pricing - Cruise pricing options',
        cabin_pricing: 'GET /cruises/:id/pricing/:cabinCode - Specific cabin pricing',
        itinerary: 'GET /cruises/:id/itinerary - Cruise itinerary',
        ship: 'GET /cruises/:id/ship - Ship details',
        alternatives: 'GET /cruises/:id/alternatives - Alternative sailings',
      },
      quotes: {
        create: 'POST /quotes - Create quote request',
        list: 'GET /quotes - List user quotes (auth required)',
        get: 'GET /quotes/:id - Get quote details',
        update: 'PUT /quotes/:id - Update quote (auth required)',
        cancel: 'DELETE /quotes/:id - Cancel quote (auth required)',
        summary: 'GET /quotes/summary - Quote summary (auth required)',
      },
    },
  });
});

export default router;