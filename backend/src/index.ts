import app from './app';
import { env } from './config/environment';
import logger from './config/logger';
import { WebhookProcessorOptimizedV2 } from './services/webhook-processor-optimized-v2.service';

const PORT = env.PORT || 3001;

// Start server
const server = app.listen(PORT, () => {
  logger.info(`🚀 Zipsea Backend API server started`, {
    port: PORT,
    environment: env.NODE_ENV,
    nodeVersion: process.version,
    platform: process.platform,
  });

  // Log important configuration
  logger.info('Server configuration', {
    database: env.DATABASE_URL ? 'configured' : 'not configured',
    redis: env.REDIS_URL ? 'configured' : 'not configured',
    clerk: env.CLERK_SECRET_KEY ? 'configured' : 'not configured',
    traveltek: env.TRAVELTEK_FTP_HOST ? 'configured' : 'not configured',
    sentry: env.SENTRY_DSN ? 'configured' : 'not configured',
  });

  // Initialize webhook processor worker on startup
  // This ensures the worker is running to process any queued jobs
  if (env.REDIS_URL || env.REDIS_HOST) {
    logger.info('Initializing webhook processor worker...');
    const webhookProcessor = new WebhookProcessorOptimizedV2();
    logger.info('Webhook processor worker initialized and ready to process jobs');
  } else {
    logger.warn('Redis not configured, webhook processor worker not started');
  }
});

// Handle server startup errors
server.on('error', (error: any) => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  switch (error.code) {
    case 'EACCES':
      logger.error(`Port ${PORT} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      logger.error(`Port ${PORT} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
});

export default server; // Force rebuild: Wed Sep 10 15:00:58 EDT 2025
