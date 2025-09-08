/**
 * Modern Slack Webhook Service
 * Simple, clear notifications for webhook processing
 */

import axios from 'axios';
import logger from '../config/logger';

class SlackWebhookService {
  private webhookUrl: string | null;

  constructor() {
    this.webhookUrl = process.env.SLACK_WEBHOOK_URL || null;
  }

  /**
   * Send a simple, clear webhook notification
   */
  async sendWebhookNotification(data: {
    lineId: number;
    lineName: string;
    status: 'started' | 'completed' | 'failed';
    cruisesProcessed?: number;
    pricingUpdated?: number;
    duration?: number;
    error?: string;
  }) {
    if (!this.webhookUrl) {
      logger.debug('Slack webhook URL not configured');
      return;
    }

    try {
      let message = '';
      let emoji = '';
      let color = '';

      switch (data.status) {
        case 'started':
          emoji = '🚀';
          color = '#0088cc';
          message = `${emoji} *Webhook Started*\n` +
            `Line: ${data.lineName} (ID: ${data.lineId})\n` +
            `Time: ${new Date().toLocaleTimeString()}`;
          break;

        case 'completed':
          emoji = '✅';
          color = '#00cc00';
          const successRate = data.cruisesProcessed && data.cruisesProcessed > 0
            ? Math.round((data.pricingUpdated! / data.cruisesProcessed) * 100)
            : 0;

          message = `${emoji} *Webhook Completed*\n` +
            `Line: ${data.lineName} (ID: ${data.lineId})\n` +
            `Cruises: ${data.cruisesProcessed || 0}\n` +
            `Pricing Updated: ${data.pricingUpdated || 0} (${successRate}%)\n` +
            `Duration: ${data.duration ? Math.round(data.duration / 1000) + 's' : 'N/A'}`;
          break;

        case 'failed':
          emoji = '❌';
          color = '#cc0000';
          message = `${emoji} *Webhook Failed*\n` +
            `Line: ${data.lineName} (ID: ${data.lineId})\n` +
            `Error: ${data.error || 'Unknown error'}\n` +
            `Time: ${new Date().toLocaleTimeString()}`;
          break;
      }

      const payload = {
        attachments: [{
          color,
          text: message,
          footer: 'Zipsea Webhook Monitor',
          ts: Math.floor(Date.now() / 1000)
        }]
      };

      await axios.post(this.webhookUrl, payload);
      logger.debug('Slack notification sent');

    } catch (error) {
      logger.error('Failed to send Slack notification:', error);
    }
  }

  /**
   * Send a daily summary
   */
  async sendDailySummary(data: {
    totalWebhooks: number;
    totalCruisesUpdated: number;
    totalPricingUpdated: number;
    topLines: Array<{ name: string; cruisesUpdated: number }>;
  }) {
    if (!this.webhookUrl) return;

    try {
      const successRate = data.totalCruisesUpdated > 0
        ? Math.round((data.totalPricingUpdated / data.totalCruisesUpdated) * 100)
        : 0;

      let message = `📊 *Daily Webhook Summary*\n\n` +
        `Total Webhooks: ${data.totalWebhooks}\n` +
        `Cruises Updated: ${data.totalCruisesUpdated}\n` +
        `Pricing Updated: ${data.totalPricingUpdated}\n` +
        `Success Rate: ${successRate}%\n\n` +
        `*Top Cruise Lines:*\n`;

      data.topLines.forEach((line, i) => {
        message += `${i + 1}. ${line.name}: ${line.cruisesUpdated} cruises\n`;
      });

      const payload = {
        attachments: [{
          color: '#0088cc',
          text: message,
          footer: 'Zipsea Daily Report',
          ts: Math.floor(Date.now() / 1000)
        }]
      };

      await axios.post(this.webhookUrl, payload);

    } catch (error) {
      logger.error('Failed to send daily summary:', error);
    }
  }
}

export const slackWebhookService = new SlackWebhookService();
