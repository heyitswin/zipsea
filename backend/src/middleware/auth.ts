import { Request, Response, NextFunction } from 'express';
import { clerkClient } from '@clerk/clerk-sdk-node';

/**
 * Authentication Middleware
 *
 * Verifies Clerk JWT tokens from the Authorization header.
 * Attaches user information to the request object for use in route handlers.
 *
 * Usage:
 * - Required auth: authenticateToken (throws 401 if no token)
 * - Optional auth: authenticateTokenOptional (continues if no token)
 */

// Extend Express Request to include user data
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        firstName?: string;
        lastName?: string;
      };
    }
  }
}

/**
 * Required authentication middleware
 *
 * Verifies the JWT token and attaches user to request.
 * Returns 401 if token is missing or invalid.
 *
 * @example
 * router.get('/bookings', authenticateToken, getBookings);
 */
export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'Please provide a valid authentication token',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token with Clerk
    try {
      const session = await clerkClient.sessions.verifySession(token, token);

      if (!session || !session.userId) {
        res.status(401).json({
          error: 'Invalid token',
          message: 'The provided authentication token is invalid or expired',
        });
        return;
      }

      // Get user details from Clerk
      const user = await clerkClient.users.getUser(session.userId);

      // Attach user to request
      req.user = {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
      };

      next();
    } catch (clerkError) {
      console.error('[Auth] Clerk verification error:', clerkError);
      res.status(401).json({
        error: 'Token verification failed',
        message: 'Unable to verify authentication token',
      });
      return;
    }
  } catch (error) {
    console.error('[Auth] Authentication error:', error);
    res.status(500).json({
      error: 'Authentication error',
      message: 'An error occurred during authentication',
    });
  }
}

/**
 * Optional authentication middleware
 *
 * Verifies the JWT token if present, but continues without error if missing.
 * Useful for routes that work both for authenticated and guest users.
 *
 * @example
 * router.post('/booking/session', authenticateTokenOptional, createSession);
 */
export async function authenticateTokenOptional(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided - continue as guest
      next();
      return;
    }

    const token = authHeader.substring(7);

    // Try to verify token, but don't fail if invalid
    try {
      const session = await clerkClient.sessions.verifySession(token, token);

      if (session && session.userId) {
        // Get user details
        const user = await clerkClient.users.getUser(session.userId);

        // Attach user to request
        req.user = {
          id: user.id,
          email: user.emailAddresses[0]?.emailAddress,
          firstName: user.firstName || undefined,
          lastName: user.lastName || undefined,
        };
      }
    } catch (clerkError) {
      // Token invalid - continue as guest
      console.log('[Auth] Optional auth failed, continuing as guest');
    }

    next();
  } catch (error) {
    // Any other error - continue as guest
    console.error('[Auth] Optional authentication error:', error);
    next();
  }
}

/**
 * Admin authentication middleware
 *
 * Verifies the user is authenticated AND has admin role.
 * Returns 403 if user is not an admin.
 *
 * @example
 * router.post('/admin/cleanup', authenticateAdmin, cleanupSessions);
 */
export async function authenticateAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // First, verify authentication
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'Admin access requires authentication',
      });
      return;
    }

    const token = authHeader.substring(7);

    try {
      const session = await clerkClient.sessions.verifySession(token, token);

      if (!session || !session.userId) {
        res.status(401).json({
          error: 'Invalid token',
          message: 'The provided authentication token is invalid or expired',
        });
        return;
      }

      // Get user details
      const user = await clerkClient.users.getUser(session.userId);

      // Check if user has admin role
      // Note: You'll need to configure this in Clerk dashboard
      // and set publicMetadata.role = 'admin' for admin users
      const isAdmin =
        user.publicMetadata?.role === 'admin' || user.publicMetadata?.isAdmin === true;

      if (!isAdmin) {
        res.status(403).json({
          error: 'Admin access required',
          message: 'You do not have permission to access this resource',
        });
        return;
      }

      // Attach user to request
      req.user = {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
      };

      next();
    } catch (clerkError) {
      console.error('[Auth] Admin verification error:', clerkError);
      res.status(401).json({
        error: 'Token verification failed',
        message: 'Unable to verify authentication token',
      });
      return;
    }
  } catch (error) {
    console.error('[Auth] Admin authentication error:', error);
    res.status(500).json({
      error: 'Authentication error',
      message: 'An error occurred during authentication',
    });
  }
}
