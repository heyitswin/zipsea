import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logRequest } from '../config/logger';
import { isDevelopment } from '../config/environment';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();

  // Override res.end to log after response
  const originalEnd = res.end;
  res.end = function (chunk?: any, encoding?: any, cb?: any) {
    const duration = Date.now() - startTime;
    
    // Log the request
    logRequest(req, res, duration);
    
    // Call original end method
    originalEnd.call(this, chunk, encoding, cb);
  };

  // Add request ID for tracing
  req.requestId = generateRequestId();
  res.setHeader('X-Request-ID', req.requestId);

  // Log request start in development
  if (isDevelopment) {
    console.log(`→ ${req.method} ${req.path} [${req.requestId}]`);
  }

  next();
};

function generateRequestId(): string {
  return uuidv4();
}

// Extend Request interface to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}