/**
 * Security Middleware
 * 
 * Protects against common attacks and blocks malicious requests
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

// Known malicious IP addresses (update this list as needed)
const BLOCKED_IPS = [
  '54.252.154.143', // IP trying to access .env files
];

// Blocked paths/patterns
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

// Blocked user agents (common scanners and bots)
const BLOCKED_USER_AGENTS = [
  /python-requests/i,
  /curl/i,
  /wget/i,
  /nikto/i,
  /sqlmap/i,
  /nmap/i,
  /masscan/i,
  /zmap/i,
];

export interface SecurityMetrics {
  blockedRequests: number;
  blockedIPs: Set<string>;
  blockedPaths: Set<string>;
  lastUpdate: Date;
}

export const securityMetrics: SecurityMetrics = {
  blockedRequests: 0,
  blockedIPs: new Set(),
  blockedPaths: new Set(),
  lastUpdate: new Date()
};

/**
 * Main security middleware
 */
export const securityMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const clientIP = getClientIP(req);
  const userAgent = req.get('User-Agent') || '';
  const path = req.path;
  const method = req.method;

  // Check blocked IPs
  if (BLOCKED_IPS.includes(clientIP)) {
    logSecurityEvent('BLOCKED_IP', {
      ip: clientIP,
      path,
      method,
      userAgent,
      headers: req.headers
    });
    
    securityMetrics.blockedRequests++;
    securityMetrics.blockedIPs.add(clientIP);
    securityMetrics.lastUpdate = new Date();
    
    return res.status(403).json({
      error: 'Access denied',
      timestamp: new Date().toISOString()
    });
  }

  // Check blocked paths
  for (const blockedPattern of BLOCKED_PATHS) {
    if (blockedPattern.test(path)) {
      logSecurityEvent('BLOCKED_PATH', {
        ip: clientIP,
        path,
        method,
        userAgent,
        pattern: blockedPattern.toString(),
        headers: req.headers
      });
      
      securityMetrics.blockedRequests++;
      securityMetrics.blockedPaths.add(path);
      securityMetrics.lastUpdate = new Date();
      
      return res.status(404).json({
        error: 'Not found',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Check blocked user agents
  for (const blockedAgent of BLOCKED_USER_AGENTS) {
    if (blockedAgent.test(userAgent)) {
      logSecurityEvent('BLOCKED_USER_AGENT', {
        ip: clientIP,
        path,
        method,
        userAgent,
        pattern: blockedAgent.toString(),
        headers: req.headers
      });
      
      securityMetrics.blockedRequests++;
      securityMetrics.blockedIPs.add(clientIP);
      securityMetrics.lastUpdate = new Date();
      
      return res.status(403).json({
        error: 'Access denied',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Check for suspicious query parameters
  const suspiciousParams = Object.keys(req.query).filter(param => {
    const value = req.query[param] as string;
    return (
      param.toLowerCase().includes('env') ||
      param.toLowerCase().includes('config') ||
      (typeof value === 'string' && (
        value.includes('../') ||
        value.includes('..\\') ||
        value.includes('/etc/') ||
        value.includes('passwd') ||
        value.includes('.env')
      ))
    );
  });

  if (suspiciousParams.length > 0) {
    logSecurityEvent('SUSPICIOUS_PARAMS', {
      ip: clientIP,
      path,
      method,
      userAgent,
      suspiciousParams,
      query: req.query,
      headers: req.headers
    });
    
    securityMetrics.blockedRequests++;
    securityMetrics.blockedIPs.add(clientIP);
    securityMetrics.lastUpdate = new Date();
    
    return res.status(400).json({
      error: 'Bad request',
      timestamp: new Date().toISOString()
    });
  }

  // Log suspicious but allowed requests for monitoring
  if (isRequestSuspicious(req, clientIP, userAgent)) {
    logSecurityEvent('SUSPICIOUS_REQUEST', {
      ip: clientIP,
      path,
      method,
      userAgent,
      headers: req.headers,
      note: 'Allowed but flagged for monitoring'
    });
  }

  next();
};

/**
 * Rate limiting middleware for API endpoints
 */
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // Max requests per minute per IP

export const rateLimitMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const clientIP = getClientIP(req);
  const now = Date.now();
  
  // Clean old entries
  for (const [ip, data] of requestCounts.entries()) {
    if (now > data.resetTime) {
      requestCounts.delete(ip);
    }
  }
  
  // Check current IP
  const requestData = requestCounts.get(clientIP);
  
  if (!requestData) {
    // First request from this IP
    requestCounts.set(clientIP, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW
    });
  } else if (now > requestData.resetTime) {
    // Reset window
    requestCounts.set(clientIP, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW
    });
  } else {
    // Increment counter
    requestData.count++;
    
    if (requestData.count > RATE_LIMIT_MAX_REQUESTS) {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', {
        ip: clientIP,
        path: req.path,
        method: req.method,
        requestCount: requestData.count,
        windowStart: new Date(requestData.resetTime - RATE_LIMIT_WINDOW).toISOString()
      });
      
      securityMetrics.blockedRequests++;
      securityMetrics.blockedIPs.add(clientIP);
      securityMetrics.lastUpdate = new Date();
      
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil((requestData.resetTime - now) / 1000),
        timestamp: new Date().toISOString()
      });
    }
  }
  
  next();
};

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
 * Check if request is suspicious
 */
function isRequestSuspicious(req: Request, clientIP: string, userAgent: string): boolean {
  // Check for multiple suspicious indicators
  let suspiciousScore = 0;
  
  // No user agent or generic user agent
  if (!userAgent || userAgent === '-' || userAgent.length < 10) {
    suspiciousScore += 1;
  }
  
  // Suspicious paths even if not blocked
  if (req.path.includes('admin') || req.path.includes('config') || req.path.includes('backup')) {
    suspiciousScore += 1;
  }
  
  // Many parameters
  if (Object.keys(req.query).length > 10) {
    suspiciousScore += 1;
  }
  
  // Non-standard ports in host header
  const host = req.get('host') || '';
  if (host.includes(':') && !host.includes(':80') && !host.includes(':443') && !host.includes(':3000')) {
    suspiciousScore += 1;
  }
  
  return suspiciousScore >= 2;
}

/**
 * Log security events
 */
function logSecurityEvent(eventType: string, details: any) {
  logger.warn(`🔒 Security event: ${eventType}`, {
    eventType,
    timestamp: new Date().toISOString(),
    ...details
  });
  
  // Also log to a security-specific logger if needed
  // This makes it easier to analyze security events separately
  logger.info(`SECURITY_EVENT: ${eventType}`, details);
}

/**
 * Security metrics endpoint (for monitoring)
 */
export const getSecurityMetrics = (): SecurityMetrics & { 
  blockedIPsList: string[];
  blockedPathsList: string[];
} => {
  return {
    ...securityMetrics,
    blockedIPsList: Array.from(securityMetrics.blockedIPs),
    blockedPathsList: Array.from(securityMetrics.blockedPaths)
  };
};

/**
 * Reset security metrics (for testing/maintenance)
 */
export const resetSecurityMetrics = (): void => {
  securityMetrics.blockedRequests = 0;
  securityMetrics.blockedIPs.clear();
  securityMetrics.blockedPaths.clear();
  securityMetrics.lastUpdate = new Date();
  
  logger.info('Security metrics reset');
};