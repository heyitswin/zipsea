/**
 * Alert Email Service
 * Sends consolidated daily email notifications for price alerts
 */

import { Resend } from 'resend';
import { env } from '../config/environment';
import { logger } from '../config/logger';
import type { AlertMatchResult } from './alert-matching.service';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

interface AlertEmailData {
  userEmail: string;
  userName: string;
  alerts: Array<{
    alertId: string;
    alertName: string;
    matches: AlertMatchResult[];
  }>;
}

export class AlertEmailService {
  /**
   * Send consolidated daily email with all alerts for a user
   */
  async sendDailyAlertEmail(data: AlertEmailData): Promise<boolean> {
    if (!resend) {
      logger.warn('[AlertEmail] Resend not configured, skipping email');
      return false;
    }

    try {
      logger.info(`[AlertEmail] Sending daily alert email to ${data.userEmail}`);
      logger.info(`[AlertEmail] ${data.alerts.length} alerts, ${data.alerts.reduce((sum, a) => sum + a.matches.length, 0)} total matches`);

      const html = this.generateEmailHTML(data);

      const result = await resend.emails.send({
        from: 'Zipsea <noreply@zipsea.com>',
        to: data.userEmail,
        subject: `🚢 ${data.alerts.reduce((sum, a) => sum + a.matches.length, 0)} New Cruise Price Alert${data.alerts.reduce((sum, a) => sum + a.matches.length, 0) > 1 ? 's' : ''}!`,
        html,
      });

      logger.info(`[AlertEmail] Email sent successfully:`, result);
      return true;
    } catch (error) {
      logger.error('[AlertEmail] Error sending email:', error);
      return false;
    }
  }

  /**
   * Generate HTML email content
   */
  private generateEmailHTML(data: AlertEmailData): string {
    const totalMatches = data.alerts.reduce((sum, a) => sum + a.matches.length, 0);

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Price Alert - Zipsea</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <!-- Main Container -->
        <table cellpadding="0" cellspacing="0" border="0" width="600" style="background-color: #ffffff; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background-color: #2f7ddd; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin: 0; letter-spacing: -0.02em;">
                🚢 Your Cruise Price Alerts
              </h1>
              <p style="color: #ffffff; font-size: 16px; margin: 10px 0 0 0;">
                We found ${totalMatches} new cruise${totalMatches > 1 ? 's' : ''} matching your price alerts!
              </p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 30px;">
              <p style="font-size: 16px; color: #333333; margin: 0 0 20px 0; line-height: 1.6;">
                Hi ${data.userName},
              </p>
              <p style="font-size: 16px; color: #333333; margin: 0 0 20px 0; line-height: 1.6;">
                Great news! We found new cruises that match your price alerts and are now below your budget threshold.
              </p>
            </td>
          </tr>

          ${data.alerts.map(alert => this.generateAlertSection(alert)).join('\n')}

          <!-- View All Button -->
          <tr>
            <td style="padding: 30px; text-align: center;">
              <a href="${env.FRONTEND_URL || 'https://zipsea.com'}/alerts"
                 style="display: inline-block; background-color: #2f7ddd; color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 50px; font-size: 16px; font-weight: bold;">
                View All Your Alerts
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px; background-color: #f9f9f9; border-radius: 0 0 10px 10px;">
              <p style="font-size: 14px; color: #666666; margin: 0 0 10px 0; text-align: center;">
                You're receiving this email because you have active price alerts set up at Zipsea.
              </p>
              <p style="font-size: 14px; color: #666666; margin: 0; text-align: center;">
                <a href="${env.FRONTEND_URL || 'https://zipsea.com'}/alerts" style="color: #2f7ddd; text-decoration: none;">Manage your alerts</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  /**
   * Generate HTML for a single alert's matches
   */
  private generateAlertSection(alert: { alertId: string; alertName: string; matches: AlertMatchResult[] }): string {
    return `
          <!-- Alert Section -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <h2 style="font-size: 20px; color: #2f7ddd; margin: 0 0 20px 0; font-weight: bold; letter-spacing: -0.02em;">
                ${alert.alertName}
              </h2>

              ${alert.matches.slice(0, 5).map(match => this.generateCruiseCard(match, alert.alertId)).join('\n')}

              ${alert.matches.length > 5 ? `
              <p style="font-size: 14px; color: #666666; margin: 20px 0 0 0; text-align: center;">
                + ${alert.matches.length - 5} more cruise${alert.matches.length - 5 > 1 ? 's' : ''}
                <a href="${env.FRONTEND_URL || 'https://zipsea.com'}/alerts/${alert.alertId}/matches" style="color: #2f7ddd; text-decoration: none;">View all →</a>
              </p>
              ` : ''}
            </td>
          </tr>
    `;
  }

  /**
   * Generate HTML for a single cruise card
   */
  private generateCruiseCard(match: AlertMatchResult, alertId: string): string {
    const cruise = match.cruise;
    const cruiseLine = cruise.cruiseLine?.name || cruise.cruiseLineName || 'Cruise Line';
    const cruiseName = cruise.name || 'Cruise';
    const shipName = cruise.ship?.name || cruise.shipName || '';
    const sailingDate = this.formatDate(cruise.sailingDate || cruise.departureDate);
    const nights = cruise.nights || '7';

    // Calculate OBC (20% of price, rounded to nearest $10)
    const obcAmount = Math.floor((match.price * 0.2) / 10) * 10;

    // Format cabin type for display
    const cabinTypeDisplay = match.cabinType.charAt(0).toUpperCase() + match.cabinType.slice(1);

    return `
              <!-- Cruise Card -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f9f9f9; border-radius: 10px; margin-bottom: 15px;">
                <tr>
                  <td style="padding: 20px;">
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td>
                          <p style="font-size: 14px; color: #2f7ddd; margin: 0 0 5px 0; font-weight: bold;">
                            ${cruiseLine}
                          </p>
                          <p style="font-size: 18px; color: #333333; margin: 0 0 5px 0; font-weight: bold; letter-spacing: -0.02em;">
                            ${cruiseName}
                          </p>
                          <p style="font-size: 14px; color: #666666; margin: 0 0 10px 0;">
                            ${shipName} • ${nights} Nights
                          </p>
                          <p style="font-size: 14px; color: #666666; margin: 0;">
                            Sailing: ${sailingDate}
                          </p>
                        </td>
                        <td align="right" valign="top">
                          <p style="font-size: 24px; color: #2f7ddd; margin: 0; font-weight: bold;">
                            $${Math.round(match.price)}
                          </p>
                          <p style="font-size: 12px; color: #666666; margin: 5px 0 0 0;">
                            ${cabinTypeDisplay}
                          </p>
                        </td>
                      </tr>
                    </table>

                    <!-- OBC Box (matching quote emails) -->
                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #1B8F57; border-radius: 10px; margin-top: 15px;">
                      <tr>
                        <td style="padding: 15px; text-align: center;">
                          <span style="color: #FFFFFF; font-family: Arial, sans-serif; font-size: 18px; font-weight: bold; letter-spacing: -0.02em;">+ $${obcAmount} onboard credit</span>
                        </td>
                      </tr>
                    </table>

                    <!-- View Details Button -->
                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 15px;">
                      <tr>
                        <td align="center">
                          <a href="${env.FRONTEND_URL || 'https://zipsea.com'}/cruise/${this.createSlug(cruiseName)}-${cruise.id}"
                             style="display: inline-block; background-color: #2f7ddd; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 50px; font-size: 14px; font-weight: bold;">
                            View Details
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
    `;
  }

  /**
   * Format date for display
   */
  private formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  }

  /**
   * Create URL slug from cruise name
   */
  private createSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}

export const alertEmailService = new AlertEmailService();
