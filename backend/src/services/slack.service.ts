import axios from 'axios';
import { logger } from '../config/logger';
import { env } from '../config/environment';
import { db } from '../db/connection';
import { cruises, cruiseLines, ships } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface SlackWebhookData {
  eventType: string;
  lineId?: number;
  cruiseId?: number;
  cruiseIds?: number[];
  timestamp?: string;
  changes?: any;
}

export interface WebhookProcessingResult {
  successful: number;
  failed: number;
  errors: Array<{
    cruiseId?: number;
    filePath?: string;
    error: string;
  }>;
  startTime: Date;
  endTime: Date;
  processingTimeMs: number;
  totalCruises: number;
  priceSnapshotsCreated: number;
}

export class SlackService {
  private webhookUrl: string | undefined;
  private enabled: boolean;

  constructor() {
    this.webhookUrl = env.SLACK_WEBHOOK_URL;
    this.enabled = !!this.webhookUrl;

    if (this.enabled) {
      logger.info('Slack notifications enabled');
    } else {
      logger.info('Slack notifications disabled (no webhook URL)');
    }
  }

  /**
   * Send a formatted message to Slack
   */
  private async sendToSlack(blocks: any): Promise<void> {
    if (!this.enabled || !this.webhookUrl) {
      return;
    }

    try {
      await axios.post(this.webhookUrl, {
        blocks,
        unfurl_links: false,
        unfurl_media: false,
      });
    } catch (error) {
      logger.error('Failed to send Slack notification:', error);
    }
  }

  /**
   * Format cruise details for Slack
   */
  private async getCruiseDetails(cruiseId: number): Promise<string> {
    try {
      const cruise = await db
        .select({
          name: cruises.name,
          nights: cruises.nights,
          sailingDate: cruises.sailingDate,
          lineName: cruiseLines.name,
          shipName: ships.name,
        })
        .from(cruises)
        .leftJoin(cruiseLines, eq(cruises.cruiseLineId, cruiseLines.id))
        .leftJoin(ships, eq(cruises.shipId, ships.id))
        .where(eq(cruises.id, String(cruiseId)))
        .limit(1);

      if (cruise.length > 0) {
        const c = cruise[0];
        return (
          `*${c.name}*\n` +
          `${c.lineName || 'Unknown Line'} - ${c.shipName || 'Unknown Ship'}\n` +
          `${c.nights} nights departing ${c.sailingDate}`
        );
      }
      return `Cruise ID: ${cruiseId}`;
    } catch (error) {
      return `Cruise ID: ${cruiseId}`;
    }
  }

  /**
   * Format cruise line details
   */
  private async getCruiseLineDetails(lineId: number): Promise<string> {
    try {
      const line = await db
        .select({
          name: cruiseLines.name,
          cruiseCount: db.count(cruises.id),
        })
        .from(cruiseLines)
        .leftJoin(cruises, eq(cruises.cruiseLineId, cruiseLines.id))
        .where(eq(cruiseLines.id, lineId))
        .groupBy(cruiseLines.name)
        .limit(1);

      if (line.length > 0) {
        return `*${line[0].name}* (${line[0].cruiseCount} cruises)`;
      }
      return `Cruise Line ID: ${lineId}`;
    } catch (error) {
      return `Cruise Line ID: ${lineId}`;
    }
  }

  /**
   * Send notification for cruise line pricing update
   */
  async notifyCruiseLinePricingUpdate(
    data: SlackWebhookData,
    results: { successful: number; failed: number }
  ): Promise<void> {
    if (!this.enabled) return;

    const lineDetails = data.lineId ? await this.getCruiseLineDetails(data.lineId) : 'Unknown';
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📊 Cruise Line Pricing Update',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Cruise Line:*\n${lineDetails}`,
          },
          {
            type: 'mrkdwn',
            text: `*Update Status:*\n✅ ${results.successful} successful\n❌ ${results.failed} failed`,
          },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `🕒 ${timestamp} ET | Event: ${data.eventType}`,
          },
        ],
      },
    ];

    await this.sendToSlack(blocks);
  }

  /**
   * Send notification for cruise pricing updates
   */
  async notifyCruisePricingUpdate(
    data: SlackWebhookData,
    results: { successful: number; failed: number }
  ): Promise<void> {
    if (!this.enabled) return;

    const cruiseIds = data.cruiseId ? [data.cruiseId] : data.cruiseIds || [];
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });

    // Get details for first few cruises
    const cruiseDetailsList: string[] = [];
    for (const id of cruiseIds.slice(0, 3)) {
      const details = await this.getCruiseDetails(id);
      cruiseDetailsList.push(details);
    }

    const blocks: any = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '💰 Cruise Pricing Update',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${cruiseIds.length} cruise${cruiseIds.length > 1 ? 's' : ''} updated*`,
        },
      },
    ];

    // Add cruise details if we have them
    if (cruiseDetailsList.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: cruiseDetailsList.join('\n\n'),
        },
      });

      if (cruiseIds.length > 3) {
        blocks.push({
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `_...and ${cruiseIds.length - 3} more cruises_`,
            },
          ],
        });
      }
    }

    blocks.push({
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Update Status:*\n✅ ${results.successful} successful\n❌ ${results.failed} failed`,
        },
      ],
    });

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `🕒 ${timestamp} ET | Event: ${data.eventType}`,
        },
      ],
    });

    await this.sendToSlack(blocks);
  }

  /**
   * Send notification for availability changes
   */
  async notifyAvailabilityChange(data: SlackWebhookData): Promise<void> {
    if (!this.enabled) return;

    const cruiseDetails = data.cruiseId ? await this.getCruiseDetails(data.cruiseId) : 'Unknown';
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🛏️ Availability Change',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: cruiseDetails,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `🕒 ${timestamp} ET | Event: availability_change`,
          },
        ],
      },
    ];

    await this.sendToSlack(blocks);
  }

  /**
   * Send daily summary of updates
   */
  async sendDailySummary(stats: {
    totalUpdates: number;
    pricingUpdates: number;
    availabilityChanges: number;
    newCruises: number;
    topCruiseLines: Array<{ name: string; updates: number }>;
  }): Promise<void> {
    if (!this.enabled) return;

    const blocks: any = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📈 Daily Traveltek Update Summary',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Total Updates:*\n${stats.totalUpdates}`,
          },
          {
            type: 'mrkdwn',
            text: `*New Cruises:*\n${stats.newCruises}`,
          },
          {
            type: 'mrkdwn',
            text: `*Pricing Updates:*\n${stats.pricingUpdates}`,
          },
          {
            type: 'mrkdwn',
            text: `*Availability Changes:*\n${stats.availabilityChanges}`,
          },
        ],
      },
    ];

    if (stats.topCruiseLines.length > 0) {
      const topLines = stats.topCruiseLines
        .slice(0, 5)
        .map(line => `• ${line.name}: ${line.updates} updates`)
        .join('\n');

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Most Active Cruise Lines:*\n${topLines}`,
        },
      });
    }

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Generated at ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET`,
        },
      ],
    });

    await this.sendToSlack(blocks);
  }

  /**
   * Notify webhook processing started
   */
  async notifyWebhookProcessingStarted(data: SlackWebhookData): Promise<void> {
    if (!this.enabled) return;

    const lineDetails = data.lineId ? await this.getCruiseLineDetails(data.lineId) : 'Unknown';
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚀 Traveltek Webhook Processing Started',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Cruise Line:*\n${lineDetails}`,
          },
          {
            type: 'mrkdwn',
            text: `*Event Type:*\n${data.eventType}`,
          },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `🕒 ${timestamp} ET | Status: Processing...`,
          },
        ],
      },
    ];

    await this.sendToSlack(blocks);
  }

  /**
   * Notify comprehensive webhook processing completed
   */
  async notifyWebhookProcessingCompleted(
    data: SlackWebhookData,
    result: WebhookProcessingResult
  ): Promise<void> {
    if (!this.enabled) return;

    const lineDetails = data.lineId ? await this.getCruiseLineDetails(data.lineId) : 'Unknown';
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
    const processingTimeSeconds = Math.round(result.processingTimeMs / 1000);

    // Determine status and emoji
    const successRate =
      result.totalCruises > 0 ? Math.round((result.successful / result.totalCruises) * 100) : 0;
    let statusEmoji = '✅';
    let statusText = 'Completed Successfully';

    if (result.failed > 0) {
      if (successRate < 50) {
        statusEmoji = '❌';
        statusText = 'Completed with Major Issues';
      } else if (successRate < 90) {
        statusEmoji = '⚠️';
        statusText = 'Completed with Minor Issues';
      } else {
        statusEmoji = '✅';
        statusText = 'Completed with Some Issues';
      }
    }

    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${statusEmoji} Traveltek Webhook Processing Complete`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Cruise Line:*\n${lineDetails}`,
          },
          {
            type: 'mrkdwn',
            text: `*Status:*\n${statusText}`,
          },
          {
            type: 'mrkdwn',
            text: `*Total Cruises:*\n${result.totalCruises}`,
          },
          {
            type: 'mrkdwn',
            text: `*Processing Time:*\n${processingTimeSeconds}s`,
          },
        ],
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*✅ Successful:*\n${result.successful} (${successRate}%)`,
          },
          {
            type: 'mrkdwn',
            text: `*❌ Failed:*\n${result.failed}`,
          },
          {
            type: 'mrkdwn',
            text: `*📸 Price Snapshots:*\n${result.priceSnapshotsCreated}`,
          },
          {
            type: 'mrkdwn',
            text: `*📊 Success Rate:*\n${successRate}%`,
          },
        ],
      },
    ];

    // Add error details if there are failures
    if (result.errors.length > 0) {
      const errorSummary = result.errors
        .slice(0, 5)
        .map(error => {
          const cruiseInfo = error.cruiseId
            ? `Cruise ${error.cruiseId}`
            : error.filePath || 'Unknown';
          return `• ${cruiseInfo}: ${error.error.substring(0, 100)}${error.error.length > 100 ? '...' : ''}`;
        })
        .join('\n');

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*🔍 Error Details (${Math.min(result.errors.length, 5)} of ${result.errors.length}):*\n${errorSummary}`,
        },
      });

      if (result.errors.length > 5) {
        blocks.push({
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `_...and ${result.errors.length - 5} more errors. Check logs for full details._`,
            },
          ],
        });
      }
    }

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `🕒 ${timestamp} ET | Event: ${data.eventType} | Batch ID: ${result.startTime.getTime()}`,
        },
      ],
    });

    await this.sendToSlack(blocks);
  }

  /**
   * Send alert for sync errors
   */
  async notifySyncError(error: string, context: string): Promise<void> {
    if (!this.enabled) return;

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '⚠️ Traveltek Sync Error',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Context:* ${context}\n*Error:* ${error}`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `🕒 ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET`,
          },
        ],
      },
    ];

    await this.sendToSlack(blocks);
  }

  /**
   * Send webhook health status notifications
   */
  async notifyWebhookHealth(status: {
    healthy: boolean;
    lastProcessed?: Date;
    pendingWebhooks: number;
    avgProcessingTime?: number;
    recentErrors?: string[];
  }): Promise<void> {
    if (!this.enabled) return;

    const statusEmoji = status.healthy ? '✅' : '🚨';
    const statusText = status.healthy ? 'Healthy' : 'Unhealthy';

    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${statusEmoji} Webhook Health Check`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Status:*\n${statusText}`,
          },
          {
            type: 'mrkdwn',
            text: `*Pending Webhooks:*\n${status.pendingWebhooks}`,
          },
        ],
      },
    ];

    if (status.lastProcessed) {
      const timeSinceLastProcessed = Math.round(
        (Date.now() - status.lastProcessed.getTime()) / 1000 / 60
      );
      blocks[1].fields.push({
        type: 'mrkdwn',
        text: `*Last Processed:*\n${timeSinceLastProcessed} minutes ago`,
      });
    }

    if (status.avgProcessingTime) {
      blocks[1].fields.push({
        type: 'mrkdwn',
        text: `*Avg Processing Time:*\n${Math.round(status.avgProcessingTime / 1000)}s`,
      });
    }

    if (status.recentErrors && status.recentErrors.length > 0) {
      const errorList = status.recentErrors
        .slice(0, 3)
        .map(error => `• ${error.substring(0, 100)}${error.length > 100 ? '...' : ''}`)
        .join('\n');

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Recent Errors:*\n${errorList}`,
        },
      });
    }

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `🕒 ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET`,
        },
      ],
    });

    await this.sendToSlack(blocks);
  }

  /**
   * Test Slack connection
   */
  async testConnection(): Promise<boolean> {
    if (!this.enabled) {
      logger.warn('Slack notifications not configured');
      return false;
    }

    try {
      await this.sendToSlack([
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '✅ Slack integration test successful! Traveltek webhook notifications are configured.',
          },
        },
      ]);
      return true;
    } catch (error) {
      logger.error('Slack test failed:', error);
      return false;
    }
  }

  /**
   * Send error notification
   */
  async sendError(message: string, error: Error): Promise<void> {
    if (!this.enabled) return;

    await this.notifySyncError(error.message, message);
  }

  /**
   * Send notification with fields
   */
  async sendNotification(notification: {
    text: string;
    fields?: Array<{ title: string; value: string; short?: boolean }>;
  }): Promise<void> {
    if (!this.enabled) return;

    const blocks: any[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: notification.text,
        },
      },
    ];

    if (notification.fields && notification.fields.length > 0) {
      blocks.push({
        type: 'section',
        fields: notification.fields.map(field => ({
          type: 'mrkdwn',
          text: `*${field.title}:*\n${field.value}`,
        })),
      });
    }

    await this.sendToSlack(blocks);
  }

  /**
   * Send custom notification message
   */
  async notifyCustomMessage(data: {
    title: string;
    message: string;
    details?: any;
    color?: string;
  }): Promise<void> {
    if (!this.enabled) return;

    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });

    const blocks: any = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: data.title,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: data.message,
        },
      },
    ];

    // Add details if provided
    if (data.details) {
      const fields = Object.entries(data.details).map(([key, value]) => ({
        type: 'mrkdwn',
        text: `*${key}:* ${value}`,
      }));

      blocks.push({
        type: 'section',
        fields: fields.slice(0, 10), // Slack limits to 10 fields
      });
    }

    // Add timestamp
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `🕒 ${timestamp} ET`,
        },
      ],
    });

    await this.sendToSlack(blocks);
  }
}

// Export singleton instance
export const slackService = new SlackService();
