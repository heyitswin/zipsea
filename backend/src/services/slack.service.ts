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
        unfurl_media: false
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
          shipName: ships.name
        })
        .from(cruises)
        .leftJoin(cruiseLines, eq(cruises.cruiseLineId, cruiseLines.id))
        .leftJoin(ships, eq(cruises.shipId, ships.id))
        .where(eq(cruises.id, cruiseId))
        .limit(1);

      if (cruise.length > 0) {
        const c = cruise[0];
        return `*${c.name}*\n` +
               `${c.lineName || 'Unknown Line'} - ${c.shipName || 'Unknown Ship'}\n` +
               `${c.nights} nights departing ${c.sailingDate}`;
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
          cruiseCount: db.count(cruises.id)
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
  async notifyCruiseLinePricingUpdate(data: SlackWebhookData, results: { successful: number; failed: number }): Promise<void> {
    if (!this.enabled) return;

    const lineDetails = data.lineId ? await this.getCruiseLineDetails(data.lineId) : 'Unknown';
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });

    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "📊 Cruise Line Pricing Update",
          emoji: true
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Cruise Line:*\n${lineDetails}`
          },
          {
            type: "mrkdwn",
            text: `*Update Status:*\n✅ ${results.successful} successful\n❌ ${results.failed} failed`
          }
        ]
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `🕒 ${timestamp} ET | Event: ${data.eventType}`
          }
        ]
      }
    ];

    await this.sendToSlack(blocks);
  }

  /**
   * Send notification for live pricing updates
   */
  async notifyLivePricingUpdate(data: SlackWebhookData, results: { successful: number; failed: number }): Promise<void> {
    if (!this.enabled) return;

    const cruiseIds = data.cruiseId ? [data.cruiseId] : (data.cruiseIds || []);
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });

    // Get details for first few cruises
    const cruiseDetailsList: string[] = [];
    for (const id of cruiseIds.slice(0, 3)) {
      const details = await this.getCruiseDetails(id);
      cruiseDetailsList.push(details);
    }

    const blocks: any = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "💰 Live Pricing Update",
          emoji: true
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${cruiseIds.length} cruise${cruiseIds.length > 1 ? 's' : ''} updated*`
        }
      }
    ];

    // Add cruise details if we have them
    if (cruiseDetailsList.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: cruiseDetailsList.join('\n\n')
        }
      });

      if (cruiseIds.length > 3) {
        blocks.push({
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `_...and ${cruiseIds.length - 3} more cruises_`
            }
          ]
        });
      }
    }

    blocks.push({
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Update Status:*\n✅ ${results.successful} successful\n❌ ${results.failed} failed`
        }
      ]
    });

    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `🕒 ${timestamp} ET | Event: ${data.eventType}`
        }
      ]
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
        type: "header",
        text: {
          type: "plain_text",
          text: "🛏️ Availability Change",
          emoji: true
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: cruiseDetails
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `🕒 ${timestamp} ET | Event: availability_change`
          }
        ]
      }
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
        type: "header",
        text: {
          type: "plain_text",
          text: "📈 Daily Traveltek Update Summary",
          emoji: true
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Total Updates:*\n${stats.totalUpdates}`
          },
          {
            type: "mrkdwn",
            text: `*New Cruises:*\n${stats.newCruises}`
          },
          {
            type: "mrkdwn",
            text: `*Pricing Updates:*\n${stats.pricingUpdates}`
          },
          {
            type: "mrkdwn",
            text: `*Availability Changes:*\n${stats.availabilityChanges}`
          }
        ]
      }
    ];

    if (stats.topCruiseLines.length > 0) {
      const topLines = stats.topCruiseLines
        .slice(0, 5)
        .map(line => `• ${line.name}: ${line.updates} updates`)
        .join('\n');

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Most Active Cruise Lines:*\n${topLines}`
        }
      });
    }

    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Generated at ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET`
        }
      ]
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
        type: "header",
        text: {
          type: "plain_text",
          text: "⚠️ Traveltek Sync Error",
          emoji: true
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Context:* ${context}\n*Error:* ${error}`
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `🕒 ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET`
          }
        ]
      }
    ];

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
          type: "section",
          text: {
            type: "mrkdwn",
            text: "✅ Slack integration test successful! Traveltek webhook notifications are configured."
          }
        }
      ]);
      return true;
    } catch (error) {
      logger.error('Slack test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const slackService = new SlackService();