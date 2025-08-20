import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { corsConfig } from './config/environment';
import { securityHeaders, rateLimiter } from './middleware/security';
import { requestLogger } from './middleware/request-logger';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import routes from './routes';
import logger from './config/logger';
import { cronService } from './services/cron.service';

// Create Express application
const app = express();

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Pre-route middleware
app.use(compression());
app.use(securityHeaders);
app.use(cors(corsConfig));
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

// Initialize scheduled jobs
let cronInitialized = false;
const initializeCronJobs = async () => {
  if (!cronInitialized) {
    try {
      await cronService.init();
      cronInitialized = true;
    } catch (error) {
      logger.error('Failed to initialize cron jobs:', error);
    }
  }
};

// Initialize cron jobs after a short delay to ensure database connections are ready
setTimeout(initializeCronJobs, 5000);

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  if (cronInitialized) {
    await cronService.shutdown();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  if (cronInitialized) {
    await cronService.shutdown();
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