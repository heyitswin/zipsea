import axios from 'axios';
import logger from '../config/logger';
import { env } from '../config/environment';

interface WebhookPayload {
  event?: string;
  lineid?: number;
  lineId?: number;
  currency?: string;
  marketid?: number;
  source?: string;
  description?: string;
  timestamp?: number;
}

interface ProcessingStats {
  startTime: Date;
  endTime?: Date;
  totalFiles?: number;
  processedFiles?: number;
  updatedCruises?: number;
  createdCruises?: number;
  failedFiles?: number;
  snapshotsCreated?: number;
  errors?: string[];
}

interface ProcessingResult {
  successful: number;
  failed: number;
  errors: string[];
  startTime: Date;
  endTime: Date;
  processingTimeMs: number;
  totalCruises: number;
  priceSnapshotsCreated: number;
}

/**
 * Enhanced Slack Service
 * Provides comprehensive notifications for webhook processing
 */
class SlackEnhancedService {
  private webhookUrl: string | undefined;
  private enabled: boolean;

  constructor() {
    this.webhookUrl = env.SLACK_WEBHOOK_URL;
    this.enabled = !!this.webhookUrl;

    if (!this.enabled) {
      logger.warn('Slack notifications disabled - no webhook URL configured');
    }
  }

  /**
   * Send a message to Slack
   */
  private async sendMessage(message: any): Promise<void> {
    if (!this.enabled || !this.webhookUrl) {
      logger.debug('Slack message not sent (disabled):', message);
      return;
    }

    try {
      await axios.post(this.webhookUrl, message, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000,
      });
    } catch (error) {
      logger.error('Failed to send Slack message:', error);
    }
  }

  /**
   * Notify when a webhook is received
   */
  async notifyWebhookReceived(payload: WebhookPayload): Promise<void> {
    const lineId = payload.lineid || payload.lineId;
    const message = {
      text: `🔔 Webhook Received`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🔔 Webhook Received',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Event:*\n${payload.event || 'Unknown'}`,
            },
            {
              type: 'mrkdwn',
              text: `*Line ID:*\n${lineId || 'N/A'}`,
            },
            {
              type: 'mrkdwn',
              text: `*Currency:*\n${payload.currency || 'N/A'}`,
            },
            {
              type: 'mrkdwn',
              text: `*Market ID:*\n${payload.marketid || 'N/A'}`,
            },
            {
              type: 'mrkdwn',
              text: `*Source:*\n${payload.source || 'N/A'}`,
            },
            {
              type: 'mrkdwn',
              text: `*Time:*\n${new Date().toISOString()}`,
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: payload.description || 'Processing started...',
            },
          ],
        },
      ],
    };

    await this.sendMessage(message);
  }

  /**
   * Notify processing progress
   */
  async notifyProcessingProgress(lineId: number, stats: ProcessingStats): Promise<void> {
    const progress = stats.totalFiles
      ? Math.round(((stats.processedFiles || 0) / stats.totalFiles) * 100)
      : 0;

    const message = {
      text: `⏳ Processing Update - Line ${lineId}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*⏳ Processing Update - Line ${lineId}*`,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Progress:*\n${progress}% (${stats.processedFiles}/${stats.totalFiles})`,
            },
            {
              type: 'mrkdwn',
              text: `*Updated:*\n${stats.updatedCruises || 0} cruises`,
            },
            {
              type: 'mrkdwn',
              text: `*Created:*\n${stats.createdCruises || 0} cruises`,
            },
            {
              type: 'mrkdwn',
              text: `*Failed:*\n${stats.failedFiles || 0} files`,
            },
            {
              type: 'mrkdwn',
              text: `*Snapshots:*\n${stats.snapshotsCreated || 0} created`,
            },
            {
              type: 'mrkdwn',
              text: `*Duration:*\n${this.formatDuration(stats.startTime, new Date())}`,
            },
          ],
        },
      ],
    };

    await this.sendMessage(message);
  }

  /**
   * Notify when processing is completed
   */
  async notifyWebhookProcessingCompleted(
    webhook: { lineId?: number; eventType?: string },
    result: ProcessingResult
  ): Promise<void> {
    const success = result.failed === 0;
    const emoji = success ? '✅' : '⚠️';
    const status = success ? 'Completed Successfully' : 'Completed with Errors';

    const message = {
      text: `${emoji} Webhook Processing ${status}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${emoji} Webhook Processing ${status}`,
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Line ID:*\n${webhook.lineId || 'N/A'}`,
            },
            {
              type: 'mrkdwn',
              text: `*Total Cruises:*\n${result.totalCruises}`,
            },
            {
              type: 'mrkdwn',
              text: `*Successfully Processed:*\n${result.successful}`,
            },
            {
              type: 'mrkdwn',
              text: `*Failed:*\n${result.failed}`,
            },
            {
              type: 'mrkdwn',
              text: `*Price Snapshots:*\n${result.priceSnapshotsCreated}`,
            },
            {
              type: 'mrkdwn',
              text: `*Processing Time:*\n${this.formatMilliseconds(result.processingTimeMs)}`,
            },
          ],
        },
      ],
    };

    // Add error details if any
    if (result.errors && result.errors.length > 0) {
      message.blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Errors:*\n\`\`\`${result.errors.slice(0, 5).join('\n')}\`\`\`${
            result.errors.length > 5 ? `\n_...and ${result.errors.length - 5} more_` : ''
          }`,
        },
      });
    }

    // Add summary
    message.blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Completed at ${result.endTime.toISOString()}`,
        },
      ],
    });

    await this.sendMessage(message);
  }

  /**
   * Notify sync errors
   */
  async notifySyncError(error: string, context?: string): Promise<void> {
    const message = {
      text: '❌ Webhook Processing Error',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '❌ Webhook Processing Error',
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Error:*\n\`\`\`${error}\`\`\``,
          },
        },
      ],
    };

    if (context) {
      message.blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: context,
          },
        ],
      });
    }

    await this.sendMessage(message);
  }

  /**
   * Notify FTP connection pool status
   */
  async notifyConnectionPoolStatus(stats: any): Promise<void> {
    const message = {
      text: '🔌 FTP Connection Pool Status',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*🔌 FTP Connection Pool Status*',
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Total Connections:*\n${stats.total}`,
            },
            {
              type: 'mrkdwn',
              text: `*In Use:*\n${stats.inUse}`,
            },
            {
              type: 'mrkdwn',
              text: `*Idle:*\n${stats.idle}`,
            },
            {
              type: 'mrkdwn',
              text: `*Waiting Queue:*\n${stats.waiting}`,
            },
          ],
        },
      ],
    };

    await this.sendMessage(message);
  }

  /**
   * Notify batch processing start
   */
  async notifyBatchProcessingStart(lineId: number, batchSize: number): Promise<void> {
    const message = {
      text: `🚀 Starting batch processing for Line ${lineId}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*🚀 Batch Processing Started*\nLine ${lineId} - ${batchSize} files`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Started at ${new Date().toISOString()}`,
            },
          ],
        },
      ],
    };

    await this.sendMessage(message);
  }

  /**
   * Format duration between two dates
   */
  private formatDuration(start: Date, end: Date): string {
    const ms = end.getTime() - start.getTime();
    return this.formatMilliseconds(ms);
  }

  /**
   * Format milliseconds to human readable
   */
  private formatMilliseconds(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

// Export singleton instance
export const slackService = new SlackEnhancedService();
