import app from './app';
import { env } from './config/environment';
import logger from './config/logger';

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

export default server;