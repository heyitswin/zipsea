import { Router } from 'express';
import { apiConfig } from '../config/environment';
import healthRoutes from './health.routes';
// Fixed Drizzle issue - using optimized webhook routes
import webhookRoutes from './webhook.routes';
import webhookPricingRoutes from './webhook-pricing.routes';
import searchRoutes from './search.routes';
import searchOptimizedRoutes from './search-optimized.routes';
import searchComprehensiveRoutes from './search-comprehensive.routes';
import filterOptionsRoutes from './filter-options.routes';
import cruiseRoutes from './cruise.routes';
import shipRoutes from './ship.routes';
import quoteRoutes from './quote.routes';
import adminRoutes from './admin.routes';
import priceHistoryRoutes from './price-history.routes';
import { userRoutes } from './user.routes';
import bookingRoutes from './booking.routes';
import debugRoutes from './debug.routes';
import promotionRoutes from './promotion.routes';
import alertRoutes from './alert.routes';

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
apiRouter.use('/webhooks-pricing', webhookPricingRoutes);

// Admin routes (for debugging and management)
apiRouter.use('/admin', adminRoutes);

// Debug routes (temporary for diagnosing issues)
apiRouter.use('/debug', debugRoutes);

// Core API routes
// Use optimized search routes for better performance
apiRouter.use('/search', searchOptimizedRoutes);
// Comprehensive search with all filtering capabilities
apiRouter.use('/search/comprehensive', searchComprehensiveRoutes);
// Filter options for dropdowns
apiRouter.use('/filter-options', filterOptionsRoutes);
// Keep old search routes as fallback at different path if needed
// apiRouter.use('/search-old', searchRoutes);
apiRouter.use('/cruises', cruiseRoutes);
apiRouter.use('/ships', shipRoutes);
apiRouter.use('/quotes', quoteRoutes);
apiRouter.use('/price-history', priceHistoryRoutes);

// Live booking routes (Traveltek integration)
apiRouter.use('/booking', bookingRoutes);

// User management routes
apiRouter.use('/users', userRoutes);

// Promotions routes
apiRouter.use('/promotions', promotionRoutes);

// Price alert routes
apiRouter.use('/alerts', alertRoutes);

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
      booking: `${apiConfig.prefix}/${apiConfig.version}/booking`,
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
      booking: {
        create_session: 'POST /booking/session - Create booking session',
        get_session: 'GET /booking/session/:sessionId - Get session data',
        get_pricing: 'GET /booking/:sessionId/pricing?cruiseId=xxx - Get live cabin pricing',
        select_cabin: 'POST /booking/:sessionId/select-cabin - Select cabin and add to basket',
        get_basket: 'GET /booking/:sessionId/basket - Get basket contents',
        create_booking: 'POST /booking/:sessionId/create - Create booking with payment',
        get_booking: 'GET /booking/:bookingId - Get booking details (auth)',
        user_bookings: 'GET /booking/user/bookings - List user bookings (auth)',
        cancel_booking: 'POST /booking/:bookingId/cancel - Cancel booking (auth)',
      },
    },
  });
});

export default router;
