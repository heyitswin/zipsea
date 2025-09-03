import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { corsConfig } from './config/environment';
import { securityHeaders, rateLimiter, maliciousRequestBlocker } from './middleware/security';
import { requestLogger } from './middleware/request-logger';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import routes from './routes';
import logger from './config/logger';
import { cronService } from './services/cron.service';
import { redisInitService } from './cache/redis-init.service';
import { cacheWarmingService } from './cache/cache-warming.service';
import { realtimeWebhookService } from './services/realtime-webhook.service';

// Create Express application
const app = express();

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Pre-route middleware
app.use(compression());
app.use(maliciousRequestBlocker); // Block malicious requests first
app.use(securityHeaders);
app.use(cors(corsConfig));

// Special handling for Clerk webhook - needs raw body for signature verification
app.use('/api/v1/users/webhook/clerk', express.raw({ type: 'application/json' }));

// JSON parsing for all other routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Rate limiting (applied to all routes except health checks)
app.use(rateLimiter);

// Routes
app.use('/', routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize services
let servicesInitialized = false;
const initializeServices = async () => {
  if (!servicesInitialized) {
    try {
      // Initialize Redis first
      logger.info('Initializing Redis connection...');
      await redisInitService.initialize();
      
      // Start cache warming service
      logger.info('Initializing cache warming...');
      cacheWarmingService.scheduleWarming();
      
      // Warm cache with initial data (async - don't block startup)
      setTimeout(async () => {
        try {
          logger.info('Starting initial cache warming...');
          await cacheWarmingService.warmPopularData();
        } catch (error) {
          logger.error('Initial cache warming failed:', error);
        }
      }, 30000); // Wait 30 seconds after startup
      
      // Initialize realtime webhook service (this starts the BullMQ workers)
      logger.info('Initializing realtime webhook service...');
      // The service is already initialized when imported (constructor runs)
      // Just log that the workers are ready
      logger.info('✅ Realtime webhook workers are now running');
      
      // Then initialize cron jobs
      logger.info('Initializing cron jobs...');
      await cronService.init();
      
      servicesInitialized = true;
      logger.info('All services initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize services:', error);
      // Don't exit - some services may still work without Redis
    }
  }
};

// Initialize services after a short delay to ensure database connections are ready
setTimeout(initializeServices, 5000);

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  if (servicesInitialized) {
    await Promise.allSettled([
      cronService.shutdown(),
      redisInitService.shutdown(),
      // The realtimeWebhookService handles its own shutdown via SIGTERM handler
    ]);
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  if (servicesInitialized) {
    await Promise.allSettled([
      cronService.shutdown(),
      redisInitService.shutdown(),
      // The realtimeWebhookService handles its own shutdown via SIGTERM handler
    ]);
  }
  process.exit(0);
});

// Unhandled promise rejection
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
  process.exit(1);
});

// Uncaught exception
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', { error });
  process.exit(1);
});

export default app;