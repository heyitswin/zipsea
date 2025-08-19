import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import logger, { logError } from '../config/logger';
import { isDevelopment } from '../config/environment';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export class ValidationError extends Error {
  statusCode = 400;
  isOperational = true;

  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  statusCode = 404;
  isOperational = true;

  constructor(resource = 'Resource') {
    super(`${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends Error {
  statusCode = 401;
  isOperational = true;

  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  statusCode = 403;
  isOperational = true;

  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends Error {
  statusCode = 409;
  isOperational = true;

  constructor(message = 'Conflict') {
    super(message);
    this.name = 'ConflictError';
  }
}

export class TooManyRequestsError extends Error {
  statusCode = 429;
  isOperational = true;

  constructor(message = 'Too many requests') {
    super(message);
    this.name = 'TooManyRequestsError';
  }
}

export class InternalServerError extends Error {
  statusCode = 500;
  isOperational = false;

  constructor(message = 'Internal server error') {
    super(message);
    this.name = 'InternalServerError';
  }
}

// Handle Zod validation errors
function handleZodError(error: ZodError): ValidationError {
  const errors = error.issues.map(issue => ({
    field: issue.path.join('.'),
    message: issue.message,
    received: (issue as any).received || undefined,
  }));

  return new ValidationError('Validation failed', errors);
}

// Handle database constraint errors
function handleDatabaseError(error: Error & { code?: string }): AppError {
  if (error.code === '23505') {
    // Unique constraint violation
    return new ConflictError('Resource already exists');
  }
  
  if (error.code === '23503') {
    // Foreign key constraint violation
    return new ValidationError('Referenced resource does not exist');
  }
  
  if (error.code === '23502') {
    // Not null constraint violation
    return new ValidationError('Required field is missing');
  }

  return new InternalServerError('Database error occurred');
}

// Main error handler middleware
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let appError: AppError = error as AppError;

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    appError = handleZodError(error);
  }
  
  // Handle database errors
  else if (error.name === 'QueryFailedError' || (error as any).code) {
    appError = handleDatabaseError(error as any);
  }
  
  // Handle known application errors
  else if (!appError.statusCode) {
    appError = new InternalServerError();
  }

  // Log error
  logError(appError, {
    request: {
      method: req.method,
      url: req.url,
      params: req.params,
      query: req.query,
      body: isDevelopment ? req.body : '[hidden]',
      headers: {
        'user-agent': req.get('user-agent'),
        'content-type': req.get('content-type'),
      },
    },
    statusCode: appError.statusCode,
  });

  // Prepare error response
  const errorResponse: any = {
    error: {
      message: appError.message,
      status: appError.statusCode || 500,
      timestamp: new Date().toISOString(),
      path: req.path,
    },
  };

  // Add error details in development
  if (isDevelopment) {
    errorResponse.error.stack = appError.stack;
    
    if (appError instanceof ValidationError && appError.details) {
      errorResponse.error.details = appError.details;
    }
  }

  // Send error response
  res.status(appError.statusCode || 500).json(errorResponse);
};

// 404 handler for unmatched routes
export const notFoundHandler = (req: Request, res: Response): void => {
  const error = new NotFoundError(`Route ${req.method} ${req.path}`);
  
  res.status(404).json({
    error: {
      message: error.message,
      status: 404,
      timestamp: new Date().toISOString(),
      path: req.path,
    },
  });
};

// Async error wrapper
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default errorHandler;