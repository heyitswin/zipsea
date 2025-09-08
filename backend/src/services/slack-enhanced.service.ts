import { env } from '../config/environment';
import { logger } from '../config/logger';
import axios from 'axios';
import { db } from '../db/connection';
import { eq, sql } from 'drizzle-orm';
import { cruises, cruiseLines } from '../db/schema';

export interface SlackWebhookData {
  lineId?: number;
  cruiseId?: number;
  cruiseIds?: number[];
  eventType: string;
  timestamp?: string;
}

export interface SlackNotificationOptions {
  title: string;
  message: string;
  color?: 'good' | 'warning' | 'danger';
  details?: Record<string, any>;
  fields?: Array<{ title: string; value: string; short?: boolean }>;
}

/**
 * Enhanced Slack Service with updated messages reflecting webhook improvements
 */
export class EnhancedSlackService {
  private webhookUrl: string | undefined;
  private enabled: boolean;

  constructor() {
    this.webhookUrl = env.SLACK_WEBHOOK_URL;
    this.enabled = !!this.webhookUrl;

    if (!this.enabled) {
      logger.debug('Slack notifications disabled - no webhook URL configured');
    }
  }

  /**
   * Send enhanced notification for cruise line pricing update
   * Reflects all the new improvements
   */
  async notifyCruiseLinePricingUpdate(
    data: SlackWebhookData,
    results: {
      successful: number;
      failed: number;
      created?: number;
      actuallyUpdated?: number;
    }
  ): Promise<void> {
    if (!this.enabled) return;

    const lineDetails = data.lineId ? await this.getCruiseLineDetails(data.lineId) : 'Unknown';
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
    const successRate =
      results.successful > 0
        ? Math.round((results.successful / (results.successful + results.failed)) * 100)
        : 0;

    const emoji = successRate >= 90 ? '✅' : successRate >= 70 ? '⚠️' : '❌';

    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} Enhanced Webhook Processing Complete`,
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
            text: `*Success Rate:*\n${successRate}%`,
          },
          {
            type: 'mrkdwn',
            text: `*Updated:*\n${results.actuallyUpdated || results.successful} cruises`,
          },
          {
            type: 'mrkdwn',
            text: `*Created:*\n${results.created || 0} new cruises`,
          },
          {
            type: 'mrkdwn',
            text: `*Failed:*\n${results.failed} cruises`,
          },
          {
            type: 'mrkdwn',
            text: `*Timestamp:*\n${timestamp}`,
          },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '🔧 *Improvements Active:* Price snapshots captured | ALL future sailings processed | Line-level locking | Complete data updates',
          },
        ],
      },
    ];

    await this.sendMessage({ blocks });
  }

  /**
   * Send notification for specific cruise pricing updates
   */
  async notifyCruisePricingUpdate(
    data: SlackWebhookData,
    results: {
      successful: number;
      failed: number;
    }
  ): Promise<void> {
    if (!this.enabled) return;

    const cruiseIds = data.cruiseId ? [data.cruiseId] : data.cruiseIds || [];
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
    const successRate =
      results.successful > 0
        ? Math.round((results.successful / (results.successful + results.failed)) * 100)
        : 0;

    const emoji = successRate >= 90 ? '✅' : successRate >= 70 ? '⚠️' : '❌';

    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} Cruise Pricing Update`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Cruises Updated:*\n${results.successful}/${cruiseIds.length}`,
          },
          {
            type: 'mrkdwn',
            text: `*Success Rate:*\n${successRate}%`,
          },
          {
            type: 'mrkdwn',
            text: `*Failed:*\n${results.failed}`,
          },
          {
            type: 'mrkdwn',
            text: `*Timestamp:*\n${timestamp}`,
          },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Cruise IDs: ${cruiseIds.slice(0, 5).join(', ')}${cruiseIds.length > 5 ? '...' : ''}`,
          },
        ],
      },
    ];

    await this.sendMessage({ blocks });
  }

  /**
   * Send notification for sync operations
   */
  async notifySyncStatus(
    operation: string,
    status: 'started' | 'completed' | 'failed',
    details?: Record<string, any>
  ): Promise<void> {
    if (!this.enabled) return;

    const emoji = status === 'started' ? '🚀' : status === 'completed' ? '✅' : '❌';
    const color = status === 'started' ? undefined : status === 'completed' ? 'good' : 'danger';

    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} ${operation}`,
          emoji: true,
        },
      },
    ];

    if (details) {
      const fields = Object.entries(details).map(([key, value]) => ({
        type: 'mrkdwn',
        text: `*${key}:*\n${value}`,
      }));

      const sectionBlock: any = {
        type: 'section',
        fields: fields.slice(0, 10), // Slack limits to 10 fields
      };
      blocks.push(sectionBlock);
    }

    if (status === 'started') {
      const contextBlock: any = {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '⏸️ *Note:* Webhooks are automatically paused during sync operations',
          },
        ],
      };
      blocks.push(contextBlock);
    }

    await this.sendMessage({ blocks });
  }

  /**
   * Send notification for sync errors
   */
  async notifySyncError(error: string, context: string): Promise<void> {
    if (!this.enabled) return;

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚨 Sync Error',
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
            text: `Timestamp: ${new Date().toISOString()}`,
          },
        ],
      },
    ];

    await this.sendMessage({ blocks });
  }

  /**
   * Send custom notification with flexible formatting
   */
  async notifyCustomMessage(options: SlackNotificationOptions): Promise<void> {
    if (!this.enabled) return;

    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: options.title,
          emoji: true,
        },
      },
    ];

    if (options.message) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: options.message,
        },
      });
    }

    if (options.fields && options.fields.length > 0) {
      const sectionBlock: any = {
        type: 'section',
        fields: options.fields.map(f => ({
          type: 'mrkdwn',
          text: `*${f.title}:*\n${f.value}`,
        })),
      };
      blocks.push(sectionBlock);
    }

    if (options.details) {
      const detailsText = Object.entries(options.details)
        .map(([key, value]) => `• *${key}:* ${value}`)
        .join('\n');

      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: detailsText,
          },
        ],
      });
    }

    await this.sendMessage({ blocks });
  }

  /**
   * Send notification for batch sync operations
   */
  async notifyBatchSyncUpdate(
    processedCount: number,
    pendingCount: number,
    duration: number
  ): Promise<void> {
    if (!this.enabled) return;

    const emoji = pendingCount === 0 ? '✅' : '🔄';

    await this.notifyCustomMessage({
      title: `${emoji} Batch Sync Update`,
      message: `Processed ${processedCount} cruises in ${(duration / 1000).toFixed(1)}s`,
      fields: [
        { title: 'Remaining', value: String(pendingCount), short: true },
        {
          title: 'Rate',
          value: `${(processedCount / (duration / 1000)).toFixed(1)}/sec`,
          short: true,
        },
      ],
      details: {
        'Flag Clearing': 'Only processed cruises cleared (bug fixed)',
        'Price History': 'Captured before all updates',
        'Date Range': 'ALL future sailings (no 2-year limit)',
      },
    });
  }

  /**
   * Helper to get cruise line details
   */
  private async getCruiseLineDetails(lineId: number): Promise<string> {
    try {
      const result = await db
        .select({ name: cruiseLines.name })
        .from(cruiseLines)
        .where(eq(cruiseLines.id, lineId))
        .limit(1);

      return result[0]?.name || `Line ID: ${lineId}`;
    } catch (error) {
      logger.error('Failed to get cruise line details:', error);
      return `Line ID: ${lineId}`;
    }
  }

  /**
   * Helper to get cruise details
   */
  private async getCruiseDetails(cruiseId: number): Promise<string> {
    try {
      const result = await db
        .select({
          name: cruises.name,
          sailingDate: cruises.sailingDate,
        })
        .from(cruises)
        .where(eq(cruises.id, String(cruiseId)))
        .limit(1);

      if (result[0]) {
        const date = new Date(result[0].sailingDate).toLocaleDateString();
        return `${result[0].name} (${date})`;
      }
      return `Cruise ID: ${cruiseId}`;
    } catch (error) {
      logger.error('Failed to get cruise details:', error);
      return `Cruise ID: ${cruiseId}`;
    }
  }

  /**
   * Send message to Slack
   */
  private async sendMessage(payload: any): Promise<void> {
    if (!this.webhookUrl) return;

    try {
      await axios.post(this.webhookUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000,
      });
    } catch (error) {
      logger.error('Failed to send Slack notification:', error);
    }
  }
}

// Export singleton instance
export const enhancedSlackService = new EnhancedSlackService();
