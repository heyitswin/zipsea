import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        sessionId?: string;
        claims?: Record<string, any>;
      };
    }
  }
}

export {};