#!/usr/bin/env tsx

/**
 * Live Monitoring Dashboard
 * 
 * Comprehensive real-time dashboard that combines:
 * - Webhook processing status
 * - Database updates
 * - Redis queue monitoring  
 * - FTP connection status
 * - Error tracking
 * - Performance metrics
 * 
 * Usage:
 *   npm run tsx scripts/live-monitoring-dashboard.ts
 *   npm run tsx scripts/live-monitoring-dashboard.ts -- --line 643
 *   npm run tsx scripts/live-monitoring-dashboard.ts -- --interval 5
 */

import { db } from '../src/db/connection';
import { sql } from 'drizzle-orm';
import { createClient } from 'redis';
import chalk from 'chalk';
import { logger } from '../src/config/logger';

interface DashboardOptions {
  lineId?: number;
  interval: number;
  showDetails: boolean;
}

interface SystemMetrics {
  webhooks: {
    total24h: number;
    processed: number;
    pending: number;
    successfulCruises: number;
    failedCruises: number;
    avgProcessingTime: number;
    lastWebhook?: Date;
  };
  database: {
    totalCruises: number;
    pendingUpdates: number;
    recentUpdates: number;
    lastUpdate?: Date;
    pricingCoverage: number;
  };
  redis: {
    bulkQueueWaiting: number;
    bulkQueueActive: number;
    bulkQueueFailed: number;
    webhookQueueWaiting: number;
    webhookQueueActive: number;
    memoryUsage: string;
    connected: boolean;
  };
  performance: {
    avgWebhookTime: number;
    maxWebhookTime: number;
    updatesPerMinute: number;
    errorRate: number;
  };
}

class LiveMonitoringDashboard {
  private options: DashboardOptions;
  private redisClient: any;
  private isRunning = false;
  private startTime = new Date();
  private metrics: SystemMetrics = this.getEmptyMetrics();
  private previousMetrics: SystemMetrics = this.getEmptyMetrics();

  constructor(options: DashboardOptions) {
    this.options = options;
  }

  getEmptyMetrics(): SystemMetrics {
    return {
      webhooks: {
        total24h: 0,
        processed: 0,
        pending: 0,
        successfulCruises: 0,
        failedCruises: 0,
        avgProcessingTime: 0
      },
      database: {
        totalCruises: 0,
        pendingUpdates: 0,
        recentUpdates: 0,
        pricingCoverage: 0
      },
      redis: {
        bulkQueueWaiting: 0,
        bulkQueueActive: 0,
        bulkQueueFailed: 0,
        webhookQueueWaiting: 0,
        webhookQueueActive: 0,
        memoryUsage: '0MB',
        connected: false
      },
      performance: {
        avgWebhookTime: 0,
        maxWebhookTime: 0,
        updatesPerMinute: 0,
        errorRate: 0
      }
    };
  }

  async initialize(): Promise<void> {
    try {
      this.redisClient = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });

      this.redisClient.on('error', (err: any) => {
        this.metrics.redis.connected = false;
      });

      await this.redisClient.connect();
      this.metrics.redis.connected = true;
    } catch (error) {
      this.metrics.redis.connected = false;
    }
  }

  async startMonitoring(): Promise<void> {
    await this.initialize();
    this.isRunning = true;

    console.log(chalk.cyan('🚀 ZipSea Live Monitoring Dashboard'));
    console.log(chalk.gray(`Started at ${this.startTime.toLocaleString()}`));
    console.log(chalk.gray('='.repeat(100)));

    while (this.isRunning) {
      try {
        this.previousMetrics = { ...this.metrics };
        await this.collectMetrics();
        await this.displayDashboard();
        await this.sleep(this.options.interval * 1000);
      } catch (error) {
        console.error(chalk.red('Dashboard error:'), error);
        await this.sleep(5000);
      }
    }
  }

  async collectMetrics(): Promise<void> {
    const [webhookMetrics, databaseMetrics, redisMetrics, performanceMetrics] = await Promise.all([
      this.collectWebhookMetrics(),
      this.collectDatabaseMetrics(),
      this.collectRedisMetrics(),
      this.collectPerformanceMetrics()
    ]);

    this.metrics = {
      webhooks: webhookMetrics,
      database: databaseMetrics,
      redis: redisMetrics,
      performance: performanceMetrics
    };
  }

  async collectWebhookMetrics(): Promise<any> {
    try {
      const query = this.options.lineId
        ? sql`
            SELECT 
              COUNT(*) as total24h,
              COUNT(*) FILTER (WHERE processed = true) as processed,
              COUNT(*) FILTER (WHERE processed = false) as pending,
              SUM(successful_count) as successful_cruises,
              SUM(failed_count) as failed_cruises,
              AVG(processing_time_ms) as avg_processing_time,
              MAX(created_at) as last_webhook
            FROM webhook_events 
            WHERE line_id = ${this.options.lineId} 
              AND created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
          `
        : sql`
            SELECT 
              COUNT(*) as total24h,
              COUNT(*) FILTER (WHERE processed = true) as processed,
              COUNT(*) FILTER (WHERE processed = false) as pending,
              SUM(successful_count) as successful_cruises,
              SUM(failed_count) as failed_cruises,
              AVG(processing_time_ms) as avg_processing_time,
              MAX(created_at) as last_webhook
            FROM webhook_events 
            WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
          `;

      const result = await db.execute(query);
      const data = result.rows[0] || {};

      return {
        total24h: parseInt(data.total24h) || 0,
        processed: parseInt(data.processed) || 0,
        pending: parseInt(data.pending) || 0,
        successfulCruises: parseInt(data.successful_cruises) || 0,
        failedCruises: parseInt(data.failed_cruises) || 0,
        avgProcessingTime: Math.round(data.avg_processing_time || 0),
        lastWebhook: data.last_webhook ? new Date(data.last_webhook) : undefined
      };
    } catch (error) {
      return this.metrics.webhooks;
    }
  }

  async collectDatabaseMetrics(): Promise<any> {
    try {
      const query = this.options.lineId
        ? sql`
            SELECT 
              COUNT(*) as total_cruises,
              COUNT(*) FILTER (WHERE needs_price_update = true AND sailing_date >= CURRENT_DATE) as pending_updates,
              COUNT(*) FILTER (WHERE updated_at >= CURRENT_TIMESTAMP - INTERVAL '10 minutes') as recent_updates,
              COUNT(*) FILTER (WHERE (interior_cheapest_price IS NOT NULL OR oceanview_cheapest_price IS NOT NULL OR balcony_cheapest_price IS NOT NULL OR suite_cheapest_price IS NOT NULL) AND sailing_date >= CURRENT_DATE) as with_pricing,
              COUNT(*) FILTER (WHERE sailing_date >= CURRENT_DATE) as future_cruises,
              MAX(updated_at) as last_update
            FROM cruises 
            WHERE cruise_line_id = ${this.options.lineId}
          `
        : sql`
            SELECT 
              COUNT(*) as total_cruises,
              COUNT(*) FILTER (WHERE needs_price_update = true AND sailing_date >= CURRENT_DATE) as pending_updates,
              COUNT(*) FILTER (WHERE updated_at >= CURRENT_TIMESTAMP - INTERVAL '10 minutes') as recent_updates,
              COUNT(*) FILTER (WHERE (interior_cheapest_price IS NOT NULL OR oceanview_cheapest_price IS NOT NULL OR balcony_cheapest_price IS NOT NULL OR suite_cheapest_price IS NOT NULL) AND sailing_date >= CURRENT_DATE) as with_pricing,
              COUNT(*) FILTER (WHERE sailing_date >= CURRENT_DATE) as future_cruises,
              MAX(updated_at) as last_update
            FROM cruises
          `;

      const result = await db.execute(query);
      const data = result.rows[0] || {};

      const futureCruises = parseInt(data.future_cruises) || 1;
      const withPricing = parseInt(data.with_pricing) || 0;
      const pricingCoverage = Math.round((withPricing / futureCruises) * 100);

      return {
        totalCruises: parseInt(data.total_cruises) || 0,
        pendingUpdates: parseInt(data.pending_updates) || 0,
        recentUpdates: parseInt(data.recent_updates) || 0,
        pricingCoverage,
        lastUpdate: data.last_update ? new Date(data.last_update) : undefined
      };
    } catch (error) {
      return this.metrics.database;
    }
  }

  async collectRedisMetrics(): Promise<any> {
    if (!this.metrics.redis.connected || !this.redisClient) {
      return { ...this.metrics.redis, connected: false };
    }

    try {
      const [
        bulkQueueWaiting,
        bulkQueueActive,
        bulkQueueFailed,
        webhookQueueWaiting,
        webhookQueueActive,
        redisInfo
      ] = await Promise.all([
        this.redisClient.lLen('bull:BulkCruiseProcessingQueue:waiting'),
        this.redisClient.lLen('bull:BulkCruiseProcessingQueue:active'),
        this.redisClient.lLen('bull:BulkCruiseProcessingQueue:failed'),
        this.redisClient.lLen('bull:WebhookQueue:waiting'),
        this.redisClient.lLen('bull:WebhookQueue:active'),
        this.redisClient.info().catch(() => 'used_memory_human:Unknown')
      ]);

      const memoryMatch = redisInfo.match(/used_memory_human:([^\r\n]+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1] : 'Unknown';

      return {
        bulkQueueWaiting,
        bulkQueueActive,
        bulkQueueFailed,
        webhookQueueWaiting,
        webhookQueueActive,
        memoryUsage,
        connected: true
      };
    } catch (error) {
      return { ...this.metrics.redis, connected: false };
    }
  }

  async collectPerformanceMetrics(): Promise<any> {
    try {
      const perfQuery = sql`
        SELECT 
          AVG(processing_time_ms) as avg_time,
          MAX(processing_time_ms) as max_time,
          COUNT(*) FILTER (WHERE failed_count > 0) as errors,
          COUNT(*) as total
        FROM webhook_events 
        WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour'
        ${this.options.lineId ? sql`AND line_id = ${this.options.lineId}` : sql``}
      `;

      const updatesQuery = sql`
        SELECT COUNT(*) as updates
        FROM cruises 
        WHERE updated_at >= CURRENT_TIMESTAMP - INTERVAL '1 minute'
        ${this.options.lineId ? sql`AND cruise_line_id = ${this.options.lineId}` : sql``}
      `;

      const [perfResult, updatesResult] = await Promise.all([
        db.execute(perfQuery),
        db.execute(updatesQuery)
      ]);

      const perfData = perfResult.rows[0] || {};
      const updatesData = updatesResult.rows[0] || {};

      const total = parseInt(perfData.total) || 1;
      const errors = parseInt(perfData.errors) || 0;
      const errorRate = Math.round((errors / total) * 100);

      return {
        avgWebhookTime: Math.round(perfData.avg_time || 0),
        maxWebhookTime: Math.round(perfData.max_time || 0),
        updatesPerMinute: parseInt(updatesData.updates) || 0,
        errorRate
      };
    } catch (error) {
      return this.metrics.performance;
    }
  }

  async displayDashboard(): Promise<void> {
    this.clearScreen();
    
    // Header
    const uptime = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
    const uptimeString = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`;
    
    console.log(chalk.cyan('🚀 ZipSea Live Monitoring Dashboard'));
    console.log(chalk.gray(`${new Date().toLocaleString()} | Uptime: ${uptimeString} | Refresh: ${this.options.interval}s`));
    if (this.options.lineId) {
      console.log(chalk.yellow(`🎯 Monitoring Line: ${this.options.lineId}`));
    }
    console.log(chalk.gray('='.repeat(100)));

    // System status indicators
    this.displaySystemStatus();
    
    // Main metrics grid
    this.displayMetricsGrid();
    
    // Recent activity
    if (this.options.showDetails) {
      await this.displayRecentActivity();
    }
    
    // Alerts
    await this.displayAlerts();
    
    console.log(chalk.gray('='.repeat(100)));
    console.log(chalk.gray('Press Ctrl+C to stop monitoring'));
  }

  displaySystemStatus(): void {
    const webhookStatus = this.metrics.webhooks.pending === 0 ? '✅' : '⚠️';
    const redisStatus = this.metrics.redis.connected ? '✅' : '❌';
    const dbStatus = this.metrics.database.recentUpdates > 0 ? '✅' : '⏳';
    const queueStatus = this.metrics.redis.bulkQueueActive > 0 ? '🟢' : 
                       this.metrics.redis.bulkQueueWaiting > 0 ? '🟡' : '⚪';

    console.log(chalk.white('🔍 SYSTEM STATUS'));
    console.log(`   ${webhookStatus} Webhooks | ${redisStatus} Redis | ${dbStatus} Database | ${queueStatus} Queue Processing`);
    console.log('');
  }

  displayMetricsGrid(): void {
    // Webhooks section
    console.log(chalk.blue('📡 WEBHOOKS (24h)'));
    console.log(`   Total: ${chalk.white(this.metrics.webhooks.total24h.toString().padStart(4))} | ` +
                `Processed: ${chalk.green(this.metrics.webhooks.processed.toString().padStart(4))} | ` +
                `Pending: ${this.getColoredNumber(this.metrics.webhooks.pending, 'pending').padStart(4)} | ` +
                `Success Rate: ${this.getSuccessRate()}%`);
    
    console.log(`   Successful: ${chalk.green(this.metrics.webhooks.successfulCruises.toString().padStart(4))} cruises | ` +
                `Failed: ${chalk.red(this.metrics.webhooks.failedCruises.toString().padStart(4))} cruises | ` +
                `Avg Time: ${this.metrics.webhooks.avgProcessingTime}ms`);

    if (this.metrics.webhooks.lastWebhook) {
      const timeSince = this.getTimeSince(this.metrics.webhooks.lastWebhook);
      console.log(`   Last webhook: ${chalk.gray(timeSince)} ago`);
    }

    console.log('');

    // Database section
    console.log(chalk.green('🗄️ DATABASE'));
    console.log(`   Total Cruises: ${chalk.white(this.metrics.database.totalCruises.toString().padStart(6))} | ` +
                `Pending Updates: ${this.getColoredNumber(this.metrics.database.pendingUpdates, 'pending').padStart(5)} | ` +
                `Pricing Coverage: ${this.metrics.database.pricingCoverage}%`);
    
    console.log(`   Recent Updates: ${chalk.cyan(this.metrics.database.recentUpdates.toString().padStart(3))} (10min) | ` +
                `Updates/min: ${chalk.yellow(this.metrics.performance.updatesPerMinute.toString().padStart(2))} | ` +
                `Error Rate: ${this.getColoredErrorRate()}%`);

    if (this.metrics.database.lastUpdate) {
      const timeSince = this.getTimeSince(this.metrics.database.lastUpdate);
      console.log(`   Last update: ${chalk.gray(timeSince)} ago`);
    }

    console.log('');

    // Redis queues section
    console.log(chalk.magenta('🔄 REDIS QUEUES'));
    console.log(`   Bulk Processing: ${this.getColoredNumber(this.metrics.redis.bulkQueueWaiting, 'queue').padStart(3)} waiting | ` +
                `${chalk.green(this.metrics.redis.bulkQueueActive.toString().padStart(2))} active | ` +
                `${chalk.red(this.metrics.redis.bulkQueueFailed.toString().padStart(3))} failed`);
    
    console.log(`   Webhook Queue:   ${this.getColoredNumber(this.metrics.redis.webhookQueueWaiting, 'queue').padStart(3)} waiting | ` +
                `${chalk.green(this.metrics.redis.webhookQueueActive.toString().padStart(2))} active | ` +
                `Memory: ${chalk.white(this.metrics.redis.memoryUsage)}`);

    console.log('');

    // Performance section
    console.log(chalk.yellow('⚡ PERFORMANCE'));
    console.log(`   Webhook Processing: Avg ${this.metrics.performance.avgWebhookTime}ms | ` +
                `Max ${this.metrics.performance.maxWebhookTime}ms | ` +
                `${this.getPerformanceIndicator()}`);
  }

  async displayRecentActivity(): Promise<void> {
    try {
      const recentWebhooks = await db.execute(sql`
        SELECT event_type, line_id, processed, successful_count, failed_count, created_at
        FROM webhook_events 
        WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '30 minutes'
        ${this.options.lineId ? sql`AND line_id = ${this.options.lineId}` : sql``}
        ORDER BY created_at DESC 
        LIMIT 8
      `);

      const recentUpdates = await db.execute(sql`
        SELECT id, name, sailing_date, updated_at,
               CASE WHEN interior_cheapest_price IS NOT NULL OR oceanview_cheapest_price IS NOT NULL OR 
                         balcony_cheapest_price IS NOT NULL OR suite_cheapest_price IS NOT NULL 
                    THEN true ELSE false END as has_pricing
        FROM cruises 
        WHERE updated_at >= CURRENT_TIMESTAMP - INTERVAL '15 minutes'
        ${this.options.lineId ? sql`AND cruise_line_id = ${this.options.lineId}` : sql``}
        ORDER BY updated_at DESC 
        LIMIT 6
      `);

      if (recentWebhooks.rows.length > 0 || recentUpdates.rows.length > 0) {
        console.log(chalk.cyan('📊 RECENT ACTIVITY'));

        if (recentWebhooks.rows.length > 0) {
          console.log(chalk.blue('   Webhooks (30min):'));
          recentWebhooks.rows.forEach((webhook: any) => {
            const status = webhook.processed ? '✅' : '⏳';
            const results = `${webhook.successful_count}/${webhook.failed_count}`;
            const time = this.getTimeSince(new Date(webhook.created_at));
            console.log(`     ${status} Line ${webhook.line_id} | ${results} | ${time} ago`);
          });
        }

        if (recentUpdates.rows.length > 0) {
          console.log(chalk.green('   Cruise Updates (15min):'));
          recentUpdates.rows.forEach((cruise: any) => {
            const pricingIcon = cruise.has_pricing ? '💰' : '⚪';
            const time = this.getTimeSince(new Date(cruise.updated_at));
            const name = cruise.name?.substring(0, 30) || 'Unknown';
            console.log(`     ${pricingIcon} ${name} | ${time} ago`);
          });
        }

        console.log('');
      }
    } catch (error) {
      // Skip activity display on error
    }
  }

  async displayAlerts(): Promise<void> {
    const alerts: string[] = [];

    // Check for issues
    if (this.metrics.webhooks.pending > 5) {
      alerts.push(`⚠️ ${this.metrics.webhooks.pending} webhooks pending processing`);
    }

    if (this.metrics.redis.bulkQueueWaiting > 20) {
      alerts.push(`🚨 Large bulk queue: ${this.metrics.redis.bulkQueueWaiting} jobs waiting`);
    }

    if (this.metrics.performance.errorRate > 10) {
      alerts.push(`❌ High error rate: ${this.metrics.performance.errorRate}%`);
    }

    if (!this.metrics.redis.connected) {
      alerts.push(`🔌 Redis connection lost`);
    }

    if (this.metrics.performance.avgWebhookTime > 30000) {
      alerts.push(`🐌 Slow webhook processing: ${Math.round(this.metrics.performance.avgWebhookTime/1000)}s avg`);
    }

    if (alerts.length > 0) {
      console.log(chalk.red('🚨 ALERTS'));
      alerts.forEach(alert => console.log(`   ${alert}`));
      console.log('');
    } else {
      console.log(chalk.green('💚 All systems healthy'));
      console.log('');
    }
  }

  // Helper methods
  getColoredNumber(value: number, type: 'pending' | 'queue'): string {
    if (type === 'pending') {
      if (value === 0) return chalk.green(value.toString());
      if (value < 5) return chalk.yellow(value.toString());
      return chalk.red(value.toString());
    } else if (type === 'queue') {
      if (value === 0) return chalk.gray(value.toString());
      if (value < 10) return chalk.yellow(value.toString());
      return chalk.red(value.toString());
    }
    return value.toString();
  }

  getSuccessRate(): string {
    const total = this.metrics.webhooks.successfulCruises + this.metrics.webhooks.failedCruises;
    if (total === 0) return '100';
    const rate = Math.round((this.metrics.webhooks.successfulCruises / total) * 100);
    if (rate >= 95) return chalk.green(rate.toString());
    if (rate >= 85) return chalk.yellow(rate.toString());
    return chalk.red(rate.toString());
  }

  getColoredErrorRate(): string {
    const rate = this.metrics.performance.errorRate;
    if (rate === 0) return chalk.green('0');
    if (rate < 5) return chalk.yellow(rate.toString());
    return chalk.red(rate.toString());
  }

  getPerformanceIndicator(): string {
    const avgTime = this.metrics.performance.avgWebhookTime;
    if (avgTime < 5000) return chalk.green('Excellent');
    if (avgTime < 15000) return chalk.yellow('Good');
    if (avgTime < 30000) return chalk.yellow('Slow');
    return chalk.red('Very Slow');
  }

  getTimeSince(date: Date): string {
    const ms = Date.now() - date.getTime();
    if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m`;
    return `${Math.floor(ms / 3600000)}h`;
  }

  clearScreen(): void {
    process.stdout.write('\x1Bc');
  }

  async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async cleanup(): Promise<void> {
    this.isRunning = false;
    if (this.redisClient) {
      await this.redisClient.quit();
    }
    console.log(chalk.yellow('\n👋 Dashboard stopped'));
    process.exit(0);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  const options: DashboardOptions = {
    interval: 10,
    showDetails: true
  };
  
  // Parse line ID
  const lineIndex = args.indexOf('--line');
  if (lineIndex !== -1 && args[lineIndex + 1]) {
    options.lineId = parseInt(args[lineIndex + 1]);
  }
  
  // Parse interval
  const intervalIndex = args.indexOf('--interval');
  if (intervalIndex !== -1 && args[intervalIndex + 1]) {
    options.interval = parseInt(args[intervalIndex + 1]) || 10;
  }

  // Parse details flag
  options.showDetails = !args.includes('--no-details');

  const dashboard = new LiveMonitoringDashboard(options);
  
  // Handle graceful shutdown
  process.on('SIGINT', () => dashboard.cleanup());
  process.on('SIGTERM', () => dashboard.cleanup());
  
  try {
    await dashboard.startMonitoring();
  } catch (error) {
    console.error(chalk.red('❌ Dashboard failed:', error));
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { LiveMonitoringDashboard };