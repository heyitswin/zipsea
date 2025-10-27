import { Request, Response } from 'express';
import { db } from '../db/connection';
import { savedSearches } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../config/logger';
import { userService } from '../services/user.service';
import { alertMatchingService } from '../services/alert-matching.service';
import { alertCronService } from '../services/alert-cron.service';

class AlertController {
  /**
   * Create a new price alert
   * POST /api/v1/alerts
   */
  async createAlert(req: Request, res: Response): Promise<void> {
    try {
      const {
        name,
        searchCriteria,
        maxBudget,
        cabinTypes,
        alertEnabled = true,
      } = req.body;

      // Get user ID from Clerk
      const clerkUserId = req.headers['x-clerk-user-id'] as string;

      if (!clerkUserId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const user = await userService.getByClerkId(clerkUserId);

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      // Validate required fields
      if (!name || !maxBudget || !cabinTypes || cabinTypes.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: name, maxBudget, cabinTypes',
        });
        return;
      }

      // Create alert
      const [alert] = await db
        .insert(savedSearches)
        .values({
          userId: user.id,
          name,
          searchCriteria,
          maxBudget: maxBudget.toString(),
          cabinTypes,
          alertEnabled,
          alertFrequency: 'daily',
          isActive: true,
        })
        .returning();

      logger.info(`[AlertController] Created alert ${alert.id} for user ${user.id}`);

      res.json({
        success: true,
        data: alert,
      });
    } catch (error) {
      logger.error('[AlertController] Error creating alert:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create alert',
      });
    }
  }

  /**
   * Get all alerts for authenticated user
   * GET /api/v1/alerts
   */
  async getUserAlerts(req: Request, res: Response): Promise<void> {
    try {
      const clerkUserId = req.headers['x-clerk-user-id'] as string;

      if (!clerkUserId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const user = await userService.getByClerkId(clerkUserId);

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      const alerts = await db.query.savedSearches.findMany({
        where: eq(savedSearches.userId, user.id),
        orderBy: (savedSearches, { desc }) => [desc(savedSearches.createdAt)],
      });

      res.json({
        success: true,
        data: alerts,
      });
    } catch (error) {
      logger.error('[AlertController] Error getting user alerts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get alerts',
      });
    }
  }

  /**
   * Get matching cruises for an alert
   * GET /api/v1/alerts/:id/matches
   */
  async getAlertMatches(req: Request, res: Response): Promise<void> {
    try {
      const { id: alertId } = req.params;
      const clerkUserId = req.headers['x-clerk-user-id'] as string;

      if (!clerkUserId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const user = await userService.getByClerkId(clerkUserId);

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      // Verify alert belongs to user
      const alert = await db.query.savedSearches.findFirst({
        where: and(
          eq(savedSearches.id, alertId),
          eq(savedSearches.userId, user.id)
        ),
      });

      if (!alert) {
        res.status(404).json({
          success: false,
          error: 'Alert not found',
        });
        return;
      }

      // Get all matching cruises (not just new ones)
      const matches = await alertMatchingService.getAllMatches(alertId);

      res.json({
        success: true,
        data: {
          alert,
          matches,
        },
      });
    } catch (error) {
      logger.error('[AlertController] Error getting alert matches:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get alert matches',
      });
    }
  }

  /**
   * Update an alert
   * PUT /api/v1/alerts/:id
   */
  async updateAlert(req: Request, res: Response): Promise<void> {
    try {
      const { id: alertId } = req.params;
      const {
        name,
        searchCriteria,
        maxBudget,
        cabinTypes,
        alertEnabled,
        isActive,
      } = req.body;

      const clerkUserId = req.headers['x-clerk-user-id'] as string;

      if (!clerkUserId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const user = await userService.getByClerkId(clerkUserId);

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      // Verify alert belongs to user
      const existingAlert = await db.query.savedSearches.findFirst({
        where: and(
          eq(savedSearches.id, alertId),
          eq(savedSearches.userId, user.id)
        ),
      });

      if (!existingAlert) {
        res.status(404).json({
          success: false,
          error: 'Alert not found',
        });
        return;
      }

      // Update alert
      const updateData: any = {
        updatedAt: new Date(),
      };

      if (name !== undefined) updateData.name = name;
      if (searchCriteria !== undefined) updateData.searchCriteria = searchCriteria;
      if (maxBudget !== undefined) updateData.maxBudget = maxBudget.toString();
      if (cabinTypes !== undefined) updateData.cabinTypes = cabinTypes;
      if (alertEnabled !== undefined) updateData.alertEnabled = alertEnabled;
      if (isActive !== undefined) updateData.isActive = isActive;

      const [updatedAlert] = await db
        .update(savedSearches)
        .set(updateData)
        .where(eq(savedSearches.id, alertId))
        .returning();

      logger.info(`[AlertController] Updated alert ${alertId}`);

      res.json({
        success: true,
        data: updatedAlert,
      });
    } catch (error) {
      logger.error('[AlertController] Error updating alert:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update alert',
      });
    }
  }

  /**
   * Delete an alert
   * DELETE /api/v1/alerts/:id
   */
  async deleteAlert(req: Request, res: Response): Promise<void> {
    try {
      const { id: alertId } = req.params;
      const clerkUserId = req.headers['x-clerk-user-id'] as string;

      if (!clerkUserId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const user = await userService.getByClerkId(clerkUserId);

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      // Verify alert belongs to user
      const alert = await db.query.savedSearches.findFirst({
        where: and(
          eq(savedSearches.id, alertId),
          eq(savedSearches.userId, user.id)
        ),
      });

      if (!alert) {
        res.status(404).json({
          success: false,
          error: 'Alert not found',
        });
        return;
      }

      // Delete alert (cascade will delete alert_matches)
      await db
        .delete(savedSearches)
        .where(eq(savedSearches.id, alertId));

      logger.info(`[AlertController] Deleted alert ${alertId}`);

      res.json({
        success: true,
        message: 'Alert deleted successfully',
      });
    } catch (error) {
      logger.error('[AlertController] Error deleting alert:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete alert',
      });
    }
  }

  /**
   * Manually trigger alert processing (for testing)
   * POST /api/v1/alerts/:id/process
   */
  async processAlert(req: Request, res: Response): Promise<void> {
    try {
      const { id: alertId } = req.params;
      const clerkUserId = req.headers['x-clerk-user-id'] as string;

      if (!clerkUserId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const user = await userService.getByClerkId(clerkUserId);

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      // Verify alert belongs to user
      const alert = await db.query.savedSearches.findFirst({
        where: and(
          eq(savedSearches.id, alertId),
          eq(savedSearches.userId, user.id)
        ),
      });

      if (!alert) {
        res.status(404).json({
          success: false,
          error: 'Alert not found',
        });
        return;
      }

      // Process alert
      const result = await alertCronService.processAlert(alertId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('[AlertController] Error processing alert:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process alert',
      });
    }
  }
}

export const alertController = new AlertController();
