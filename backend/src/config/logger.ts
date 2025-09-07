import winston from 'winston';
import { Request, Response } from 'express';
import { env, isDevelopment, isTest } from './environment';

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;

    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta, null, 2)}`;
    }

    return log;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  format: logFormat,
  defaultMeta: {
    service: 'zipsea-backend',
    environment: env.NODE_ENV,
  },
  transports: [
    // File transport for all logs
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
  ],
  exceptionHandlers: [new winston.transports.File({ filename: 'logs/exceptions.log' })],
  rejectionHandlers: [new winston.transports.File({ filename: 'logs/rejections.log' })],
});

// Add console transport for all environments (needed for cloud logging)
// In production, cloud providers like Render capture console output
logger.add(
  new winston.transports.Console({
    format: isDevelopment ? consoleFormat : logFormat,
    silent: isTest, // Silent in test environment
  })
);

// Create specialized loggers for different modules
export const traveltekLogger = logger.child({ module: 'traveltek' });
export const dbLogger = logger.child({ module: 'database' });
export const cacheLogger = logger.child({ module: 'cache' });
export const authLogger = logger.child({ module: 'auth' });
export const apiLogger = logger.child({ module: 'api' });

// Helper functions for structured logging
export const logError = (error: Error, context?: Record<string, unknown>) => {
  logger.error('Error occurred', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    ...context,
  });
};

export const logRequest = (req: Request, res: Response, duration: number) => {
  apiLogger.info('HTTP Request', {
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    duration: `${duration}ms`,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
  });
};

export const logDatabaseQuery = (query: string, duration: number, params?: unknown[]) => {
  dbLogger.debug('Database Query', {
    query,
    duration: `${duration}ms`,
    params: params?.length ? params : undefined,
  });
};

export const logCacheOperation = (
  operation: 'hit' | 'miss' | 'set' | 'del',
  key: string,
  ttl?: number
) => {
  cacheLogger.debug('Cache Operation', {
    operation,
    key,
    ttl: ttl ? `${ttl}s` : undefined,
  });
};

export const logTraveltekSync = (
  operation: string,
  result: 'success' | 'error',
  details?: Record<string, unknown>
) => {
  const level = result === 'success' ? 'info' : 'error';
  traveltekLogger[level]('Traveltek Sync', {
    operation,
    result,
    ...details,
  });
};

// Ensure logs directory exists
import { existsSync, mkdirSync } from 'fs';
if (!existsSync('logs')) {
  mkdirSync('logs', { recursive: true });
}

export { logger };
export default logger;
