/**
 * Alert Cron Service
 * Processes all active price alerts and sends daily email notifications
 */

import { logger } from '../config/logger';
import { db } from '../db/connection';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { alertMatchingService } from './alert-matching.service';
import { alertEmailService } from './alert-email.service';

export class AlertCronService {
  /**
   * Process all active alerts and send emails
   * Called by cron job daily at 9 AM UTC (2 AM PST)
   */
  async processAllAlerts(): Promise<void> {
    const startTime = Date.now();

    try {
      logger.info('[AlertCron] 🔔 Starting daily alert processing...');

      // Get all active alerts
      const activeAlerts = await alertMatchingService.getActiveAlerts();

      if (activeAlerts.length === 0) {
        logger.info('[AlertCron] No active alerts to process');
        return;
      }

      logger.info(`[AlertCron] Processing ${activeAlerts.length} active alerts`);

      // Group alerts by user for consolidated emails
      const alertsByUser = new Map<string, any[]>();

      for (const alert of activeAlerts) {
        if (!alertsByUser.has(alert.userId)) {
          alertsByUser.set(alert.userId, []);
        }
        alertsByUser.get(alert.userId)!.push(alert);
      }

      logger.info(`[AlertCron] Grouped alerts for ${alertsByUser.size} users`);

      // Process each user's alerts
      let totalMatches = 0;
      let emailsSent = 0;
      let errors = 0;

      for (const [userId, userAlerts] of alertsByUser) {
        try {
          await this.processUserAlerts(userId, userAlerts);
          emailsSent++;
        } catch (error) {
          logger.error(`[AlertCron] Error processing alerts for user ${userId}:`, error);
          errors++;
        }
      }

      const duration = Date.now() - startTime;

      logger.info('[AlertCron] ✅ Alert processing complete', {
        duration: `${duration}ms`,
        alertsProcessed: activeAlerts.length,
        usersProcessed: alertsByUser.size,
        emailsSent,
        errors,
      });
    } catch (error) {
      logger.error('[AlertCron] ❌ Fatal error during alert processing:', error);
      throw error;
    }
  }

  /**
   * Process all alerts for a single user
   */
  private async processUserAlerts(userId: string, alerts: any[]): Promise<void> {
    try {
      logger.info(`[AlertCron] Processing ${alerts.length} alerts for user ${userId}`);

      // Get user details
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user || !user.email) {
        logger.warn(`[AlertCron] User ${userId} not found or has no email`);
        return;
      }

      // Find new matches for each alert
      const alertsWithMatches: Array<{
        alertId: string;
        alertName: string;
        matches: any[];
      }> = [];

      for (const alert of alerts) {
        try {
          // Update last checked timestamp
          await alertMatchingService.updateLastChecked(alert.id);

          // Find new matches
          const newMatches = await alertMatchingService.findNewMatches(alert.id);

          if (newMatches.length > 0) {
            alertsWithMatches.push({
              alertId: alert.id,
              alertName: alert.name,
              matches: newMatches,
            });

            // Record each match in the database
            for (const match of newMatches) {
              await alertMatchingService.recordMatch(
                alert.id,
                match.cruiseId,
                match.cabinType,
                match.price
              );
            }

            logger.info(`[AlertCron] Alert "${alert.name}": ${newMatches.length} new matches`);
          } else {
            logger.info(`[AlertCron] Alert "${alert.name}": No new matches`);
          }
        } catch (error) {
          logger.error(`[AlertCron] Error processing alert ${alert.id}:`, error);
          // Continue with other alerts even if one fails
        }
      }

      // Send email if there are any new matches
      if (alertsWithMatches.length > 0) {
        const totalMatches = alertsWithMatches.reduce((sum, a) => sum + a.matches.length, 0);

        logger.info(`[AlertCron] Sending email to ${user.email} with ${totalMatches} matches across ${alertsWithMatches.length} alerts`);

        const success = await alertEmailService.sendDailyAlertEmail({
          userEmail: user.email,
          userName: user.firstName || 'there',
          alerts: alertsWithMatches,
        });

        if (success) {
          // Update last notified timestamp for all alerts with matches
          for (const alertData of alertsWithMatches) {
            await db.query.savedSearches.findFirst({
              where: eq(users.id, alertData.alertId),
            }).then(alert => {
              if (alert) {
                return db
                  .update(users)
                  .set({ lastNotified: new Date() })
                  .where(eq(users.id, alertData.alertId));
              }
            });
          }

          logger.info(`[AlertCron] ✅ Email sent successfully to ${user.email}`);
        } else {
          logger.warn(`[AlertCron] ⚠️ Failed to send email to ${user.email}`);
        }
      } else {
        logger.info(`[AlertCron] No new matches for user ${userId}, skipping email`);
      }
    } catch (error) {
      logger.error(`[AlertCron] Error processing user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Process a single alert (for testing or manual triggering)
   */
  async processAlert(alertId: string): Promise<{
    success: boolean;
    matchesFound: number;
    emailSent: boolean;
  }> {
    try {
      logger.info(`[AlertCron] Processing single alert: ${alertId}`);

      // Update last checked
      await alertMatchingService.updateLastChecked(alertId);

      // Find new matches
      const newMatches = await alertMatchingService.findNewMatches(alertId);

      if (newMatches.length === 0) {
        return {
          success: true,
          matchesFound: 0,
          emailSent: false,
        };
      }

      // Record matches
      for (const match of newMatches) {
        await alertMatchingService.recordMatch(
          alertId,
          match.cruiseId,
          match.cabinType,
          match.price
        );
      }

      // Get alert and user details
      const alert = await db.query.savedSearches.findFirst({
        where: eq(users.id, alertId),
      });

      if (!alert) {
        throw new Error('Alert not found');
      }

      const user = await db.query.users.findFirst({
        where: eq(users.id, alert.userId),
      });

      if (!user || !user.email) {
        throw new Error('User not found or has no email');
      }

      // Send email
      const emailSent = await alertEmailService.sendDailyAlertEmail({
        userEmail: user.email,
        userName: user.firstName || 'there',
        alerts: [
          {
            alertId: alert.id,
            alertName: alert.name,
            matches: newMatches,
          },
        ],
      });

      return {
        success: true,
        matchesFound: newMatches.length,
        emailSent,
      };
    } catch (error) {
      logger.error(`[AlertCron] Error processing alert ${alertId}:`, error);
      throw error;
    }
  }
}

export const alertCronService = new AlertCronService();
