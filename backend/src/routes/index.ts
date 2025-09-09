import { Router } from 'express';
import { apiConfig } from '../config/environment';
import healthRoutes from './health.routes';
// Using minimal webhook routes to fix FTP connection issues
import webhookRoutes from './webhook-minimal.routes';
import searchRoutes from './search.routes';
import searchOptimizedRoutes from './search-optimized.routes';
import cruiseRoutes from './cruise.routes';
import shipRoutes from './ship.routes';
import quoteRoutes from './quote.routes';
import adminRoutes from './admin.routes';
import priceHistoryRoutes from './price-history.routes';
import { userRoutes } from './user.routes';

const router = Router();

// Root path handler (for health checks from load balancers)
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'zipsea-backend',
    timestamp: new Date().toISOString(),
  });
});

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
// Use optimized search routes for better performance
apiRouter.use('/search', searchOptimizedRoutes);
// Keep old search routes as fallback at different path if needed
// apiRouter.use('/search-old', searchRoutes);
apiRouter.use('/cruises', cruiseRoutes);
apiRouter.use('/ships', shipRoutes);
apiRouter.use('/quotes', quoteRoutes);
apiRouter.use('/price-history', priceHistoryRoutes);

// User management routes
apiRouter.use('/users', userRoutes);

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
      ships: `${apiConfig.prefix}/${apiConfig.version}/ships`,
      quotes: `${apiConfig.prefix}/${apiConfig.version}/quotes`,
      priceHistory: `${apiConfig.prefix}/${apiConfig.version}/price-history`,
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
      ships: {
        list: 'GET /ships - List all ships with optional search',
        details: 'GET /ships/:id - Detailed ship information',
        search: 'GET /ships/search?q=term - Search ships by name or cruise line',
      },
      quotes: {
        create: 'POST /quotes - Create quote request',
        list: 'GET /quotes - List user quotes (auth required)',
        get: 'GET /quotes/:id - Get quote details',
        update: 'PUT /quotes/:id - Update quote (auth required)',
        cancel: 'DELETE /quotes/:id - Cancel quote (auth required)',
        summary: 'GET /quotes/summary - Quote summary (auth required)',
      },
      priceHistory: {
        list: 'GET /price-history - Historical price data with filtering',
        trends: 'GET /price-history/trends/:cruiseId/:cabinCode/:rateCode - Price trend analysis',
        summary: 'GET /price-history/summary/:cruiseId - Price trend summary',
        changes: 'GET /price-history/changes/:cruiseId - Price changes over time',
        volatility: 'GET /price-history/volatility/:cruiseId - Price volatility metrics',
        cleanup: 'DELETE /price-history/cleanup - Cleanup old history data (admin)',
      },
    },
  });
});

export default router;
