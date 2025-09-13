#!/usr/bin/env node

/**
 * Webhook Health Monitoring Script
 * Monitors webhook processing health and alerts on issues
 */

const { Queue } = require('bullmq');
const Redis = require('ioredis');
const { db } = require('../dist/db/connection.js');
const { webhookEvents } = require('../dist/db/schema/webhook-events.js');
const { eq, sql, gte, and, isNull } = require('drizzle-orm');
const axios = require('axios');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const BACKEND_URL = process.env.BACKEND_URL || 'https://zipsea-production.onrender.com';

// Thresholds for alerts
const THRESHOLDS = {
  MAX_QUEUE_SIZE: 50,
  MAX_ACTIVE_JOBS: 10,
  MAX_FAILED_JOBS: 20,
  MAX_PROCESSING_TIME_MINUTES: 10,
  MAX_MEMORY_PERCENT: 70,
  MIN_SUCCESS_RATE: 0.8,
};

class WebhookHealthMonitor {
  constructor() {
    this.redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    this.queue = new Queue('webhook-v2-processing', {
      connection: this.redis,
    });

    this.alerts = [];
  }

  async checkQueueHealth() {
    const waiting = await this.queue.getWaitingCount();
    const active = await this.queue.getActiveCount();
    const failed = await this.queue.getFailedCount();
    const delayed = await this.queue.getDelayedCount();

    // Check thresholds
    if (waiting > THRESHOLDS.MAX_QUEUE_SIZE) {
      this.alerts.push(
        `⚠️ Queue backlog high: ${waiting} waiting jobs (threshold: ${THRESHOLDS.MAX_QUEUE_SIZE})`
      );
    }

    if (active > THRESHOLDS.MAX_ACTIVE_JOBS) {
      this.alerts.push(
        `⚠️ Too many active jobs: ${active} (threshold: ${THRESHOLDS.MAX_ACTIVE_JOBS})`
      );
    }

    if (failed > THRESHOLDS.MAX_FAILED_JOBS) {
      this.alerts.push(
        `❌ High failure count: ${failed} failed jobs (threshold: ${THRESHOLDS.MAX_FAILED_JOBS})`
      );
    }

    return {
      waiting,
      active,
      failed,
      delayed,
      total: waiting + active + failed + delayed,
    };
  }

  async checkWebhookEvents() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Get stuck processing events
    const stuckProcessing = await db
      .select({
        count: sql`count(*)::int`,
        oldest: sql`min(received_at)`,
      })
      .from(webhookEvents)
      .where(and(eq(webhookEvents.status, 'processing'), sql`received_at < ${oneHourAgo}`));

    if (stuckProcessing[0]?.count > 0) {
      const ageMinutes = Math.floor(
        (Date.now() - new Date(stuckProcessing[0].oldest).getTime()) / 60000
      );
      this.alerts.push(
        `🔴 ${stuckProcessing[0].count} webhooks stuck in processing for ${ageMinutes} minutes`
      );
    }

    // Get recent success rate
    const recentStats = await db
      .select({
        total: sql`count(*)::int`,
        successful: sql`count(*) filter (where status = 'completed')::int`,
        failed: sql`count(*) filter (where status = 'failed')::int`,
        processing: sql`count(*) filter (where status = 'processing')::int`,
      })
      .from(webhookEvents)
      .where(gte(webhookEvents.receivedAt, oneHourAgo));

    const stats = recentStats[0];
    if (stats.total > 0) {
      const successRate = stats.successful / stats.total;
      if (successRate < THRESHOLDS.MIN_SUCCESS_RATE) {
        this.alerts.push(
          `📉 Low success rate: ${(successRate * 100).toFixed(1)}% (threshold: ${THRESHOLDS.MIN_SUCCESS_RATE * 100}%)`
        );
      }
    }

    return stats;
  }

  async checkMemoryUsage() {
    try {
      const response = await axios.get(`${BACKEND_URL}/health`, { timeout: 5000 });
      if (response.data.memory) {
        const memoryPercent =
          (response.data.memory.heapUsed / response.data.memory.heapTotal) * 100;
        if (memoryPercent > THRESHOLDS.MAX_MEMORY_PERCENT) {
          this.alerts.push(
            `💾 High memory usage: ${memoryPercent.toFixed(1)}% (threshold: ${THRESHOLDS.MAX_MEMORY_PERCENT}%)`
          );
        }
        return memoryPercent;
      }
    } catch (error) {
      this.alerts.push(`❌ Failed to check service health: ${error.message}`);
    }
    return null;
  }

  async sendAlerts() {
    if (this.alerts.length === 0) {
      return;
    }

    const message = {
      text: '🚨 Webhook Processing Alert',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🚨 Webhook Processing Issues Detected',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: this.alerts.join('\n'),
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `_Checked at ${new Date().toISOString()}_`,
          },
        },
      ],
    };

    // Send to Slack if configured
    if (SLACK_WEBHOOK_URL) {
      try {
        await axios.post(SLACK_WEBHOOK_URL, message);
        console.log('✅ Alerts sent to Slack');
      } catch (error) {
        console.error('Failed to send Slack alert:', error.message);
      }
    }

    // Always log to console
    console.log('\n🚨 ALERTS:');
    this.alerts.forEach(alert => console.log(alert));
  }

  async generateReport() {
    console.log('📊 Webhook Health Report');
    console.log('========================\n');

    // Queue status
    console.log('📬 Queue Status:');
    const queueStats = await this.checkQueueHealth();
    console.log(`  Waiting: ${queueStats.waiting}`);
    console.log(`  Active: ${queueStats.active}`);
    console.log(`  Failed: ${queueStats.failed}`);
    console.log(`  Delayed: ${queueStats.delayed}`);
    console.log(`  Total: ${queueStats.total}\n`);

    // Webhook events
    console.log('📈 Recent Webhook Events (last hour):');
    const eventStats = await this.checkWebhookEvents();
    if (eventStats) {
      console.log(`  Total: ${eventStats.total}`);
      console.log(`  Successful: ${eventStats.successful}`);
      console.log(`  Failed: ${eventStats.failed}`);
      console.log(`  Processing: ${eventStats.processing}`);
      if (eventStats.total > 0) {
        const successRate = ((eventStats.successful / eventStats.total) * 100).toFixed(1);
        console.log(`  Success Rate: ${successRate}%\n`);
      }
    }

    // Memory usage
    const memoryPercent = await this.checkMemoryUsage();
    if (memoryPercent !== null) {
      console.log(`💾 Memory Usage: ${memoryPercent.toFixed(1)}%\n`);
    }

    // Send alerts if any
    await this.sendAlerts();

    if (this.alerts.length === 0) {
      console.log('✅ All systems healthy\n');
    } else {
      console.log(`\n⚠️ ${this.alerts.length} issues detected\n`);
    }
  }

  async cleanup() {
    await this.queue.close();
    await this.redis.quit();
  }
}

// Main execution
async function main() {
  const monitor = new WebhookHealthMonitor();

  try {
    await monitor.generateReport();

    // If running in continuous mode
    if (process.argv.includes('--watch')) {
      console.log('Running in watch mode. Checking every 5 minutes...\n');
      setInterval(
        async () => {
          monitor.alerts = []; // Reset alerts
          await monitor.generateReport();
        },
        5 * 60 * 1000
      ); // Check every 5 minutes
    } else {
      await monitor.cleanup();
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Error running health check:', error);
    await monitor.cleanup();
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down monitoring...');
  process.exit(0);
});

main().catch(console.error);
