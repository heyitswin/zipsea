import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { rateLimitConfig } from '../config/environment';
import logger from '../config/logger';

// Security headers middleware
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
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
  skip: req => {
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

// Known malicious IP addresses and patterns
const BLOCKED_IPS = [
  '54.252.154.143', // IP trying to access .env files
];

const BLOCKED_PATHS = [
  /\.env$/i,
  /\.env\./i,
  /env\.txt$/i,
  /\.git/i,
  /\.ssh/i,
  /config\.json$/i,
  /wp-admin/i,
  /wp-config/i,
  /phpmyadmin/i,
  /admin\.php$/i,
  /setup\.php$/i,
];

const BLOCKED_USER_AGENTS = [
  // Temporarily comment out common tools for testing
  // /python-requests/i,
  // /curl/i,
  // /wget/i,
  /nikto/i,
  /sqlmap/i,
  /nmap/i,
  /masscan/i,
  /zmap/i,
];

/**
 * Get client IP address from various headers
 */
function getClientIP(req: Request): string {
  return (
    req.ip ||
    req.connection.remoteAddress ||
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    (req.headers['x-real-ip'] as string) ||
    (req.headers['x-client-ip'] as string) ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

/**
 * Security middleware to block malicious requests
 */
export const maliciousRequestBlocker = (req: Request, res: Response, next: NextFunction) => {
  const clientIP = getClientIP(req);
  const userAgent = req.get('User-Agent') || '';
  const path = req.path;

  // Check blocked IPs
  if (BLOCKED_IPS.includes(clientIP)) {
    logger.warn('🔒 BLOCKED IP ACCESS ATTEMPT', {
      ip: clientIP,
      path,
      method: req.method,
      userAgent,
      headers: req.headers,
      timestamp: new Date().toISOString(),
    });

    return res.status(403).json({
      error: 'Access denied',
      timestamp: new Date().toISOString(),
    });
  }

  // Check blocked paths (including .env files)
  for (const blockedPattern of BLOCKED_PATHS) {
    if (blockedPattern.test(path)) {
      logger.warn('🔒 BLOCKED PATH ACCESS ATTEMPT', {
        ip: clientIP,
        path,
        method: req.method,
        userAgent,
        pattern: blockedPattern.toString(),
        headers: req.headers,
        timestamp: new Date().toISOString(),
      });

      return res.status(404).json({
        error: 'Not found',
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Check blocked user agents (but allow webhook endpoints)
  const isWebhookEndpoint = path.includes('/webhook') || path.includes('/webhooks');
  if (!isWebhookEndpoint) {
    for (const blockedAgent of BLOCKED_USER_AGENTS) {
      if (blockedAgent.test(userAgent)) {
        logger.warn('🔒 BLOCKED USER AGENT ACCESS ATTEMPT', {
          ip: clientIP,
          path,
          method: req.method,
          userAgent,
          pattern: blockedAgent.toString(),
          headers: req.headers,
          timestamp: new Date().toISOString(),
        });

        return res.status(403).json({
          error: 'Access denied',
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  // Check for suspicious query parameters
  const suspiciousParams = Object.keys(req.query).filter(param => {
    const value = req.query[param] as string;
    return (
      param.toLowerCase().includes('env') ||
      param.toLowerCase().includes('config') ||
      (typeof value === 'string' &&
        (value.includes('../') ||
          value.includes('..\\') ||
          value.includes('/etc/') ||
          value.includes('passwd') ||
          value.includes('.env')))
    );
  });

  if (suspiciousParams.length > 0) {
    logger.warn('🔒 BLOCKED SUSPICIOUS PARAMETERS', {
      ip: clientIP,
      path,
      method: req.method,
      userAgent,
      suspiciousParams,
      query: req.query,
      headers: req.headers,
      timestamp: new Date().toISOString(),
    });

    return res.status(400).json({
      error: 'Bad request',
      timestamp: new Date().toISOString(),
    });
  }

  next();
};

export default {
  securityHeaders,
  rateLimiter,
  sensitiveRateLimiter,
  maliciousRequestBlocker,
};
