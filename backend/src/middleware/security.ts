import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { rateLimitConfig } from '../config/environment';

// Security headers middleware
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
});

// Rate limiting middleware
export const rateLimiter = rateLimit({
  ...rateLimitConfig,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api/health';
  },
  handler: (req, res) => {
    res.status(429).json({
      error: {
        message: 'Too many requests from this IP, please try again later.',
        status: 429,
        timestamp: new Date().toISOString(),
        retryAfter: Math.ceil(rateLimitConfig.windowMs / 1000),
      },
    });
  },
});

// Slow down middleware for sensitive endpoints
export const sensitiveRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many attempts from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export default {
  securityHeaders,
  rateLimiter,
  sensitiveRateLimiter,
};