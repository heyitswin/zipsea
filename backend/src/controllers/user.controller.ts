import { Request, Response } from 'express';
import { userService } from '../services/user.service';
import { logger } from '../config/logger';
import { Webhook } from 'svix';

class UserController {
  /**
   * Handle Clerk webhook events
   */
  async handleClerkWebhook(req: Request, res: Response): Promise<void> {
    try {
      const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
      
      if (!webhookSecret) {
        logger.error('CLERK_WEBHOOK_SECRET not configured');
        res.status(500).json({ error: 'Webhook secret not configured' });
        return;
      }

      // Verify webhook signature
      const svix = new Webhook(webhookSecret);
      const headers = {
        'svix-id': req.headers['svix-id'] as string,
        'svix-timestamp': req.headers['svix-timestamp'] as string,
        'svix-signature': req.headers['svix-signature'] as string,
      };

      let evt: any;
      
      try {
        // req.body is now a Buffer from express.raw()
        const payload = req.body instanceof Buffer ? req.body.toString('utf8') : JSON.stringify(req.body);
        evt = svix.verify(payload, headers);
        // Parse the event data if it's a string
        if (typeof evt === 'string') {
          evt = JSON.parse(evt);
        }
      } catch (err) {
        logger.error('Webhook verification failed:', err);
        res.status(400).json({ error: 'Invalid webhook signature' });
        return;
      }

      // Handle different event types
      const eventType = evt.type;
      
      switch (eventType) {
        case 'user.created':
        case 'user.updated':
          await userService.syncFromClerk(evt.data);
          logger.info(`User ${eventType}:`, { userId: evt.data.id });
          break;
          
        case 'session.created':
          await userService.updateLastLogin(evt.data.user_id);
          logger.info('User logged in:', { userId: evt.data.user_id });
          break;
          
        default:
          logger.info(`Unhandled webhook event: ${eventType}`);
      }

      res.json({ received: true });
    } catch (error) {
      logger.error('Error handling Clerk webhook:', error);
      res.status(500).json({ 
        success: false,
        error: 'Internal server error' 
      });
    }
  }

  /**
   * Sync user from Clerk (manual endpoint for testing)
   */
  async syncUser(req: Request, res: Response): Promise<void> {
    try {
      const { clerkUserId } = req.body;
      
      if (!clerkUserId) {
        res.status(400).json({
          success: false,
          error: 'clerkUserId is required'
        });
        return;
      }

      // In production, fetch user data from Clerk API
      // For now, use the provided data
      const user = await userService.syncFromClerk(req.body);
      
      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      logger.error('Error syncing user:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to sync user'
      });
    }
  }

  /**
   * Get current user profile
   */
  async getCurrentUser(req: Request, res: Response): Promise<void> {
    try {
      // Get clerk user ID from authenticated request
      // This would come from Clerk middleware in production
      const clerkUserId = req.headers['x-clerk-user-id'] as string;
      
      if (!clerkUserId) {
        res.status(401).json({
          success: false,
          error: 'Not authenticated'
        });
        return;
      }

      const user = await userService.getByClerkId(clerkUserId);
      
      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found'
        });
        return;
      }

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      logger.error('Error getting current user:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user'
      });
    }
  }

  /**
   * Update user preferences
   */
  async updatePreferences(req: Request, res: Response): Promise<void> {
    try {
      const clerkUserId = req.headers['x-clerk-user-id'] as string;
      
      if (!clerkUserId) {
        res.status(401).json({
          success: false,
          error: 'Not authenticated'
        });
        return;
      }

      const user = await userService.getByClerkId(clerkUserId);
      
      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found'
        });
        return;
      }

      const updatedUser = await userService.updatePreferences(
        user.id,
        req.body.preferences
      );

      res.json({
        success: true,
        data: updatedUser
      });
    } catch (error) {
      logger.error('Error updating preferences:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update preferences'
      });
    }
  }
}

export const userController = new UserController();