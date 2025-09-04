#!/usr/bin/env tsx

/**
 * Comprehensive bulk FTP processing monitor
 * 
 * This script provides real-time monitoring of:
 * - Webhook reception and processing
 * - Redis queue status
 * - Database updates in real-time
 * - FTP download progress
 * - Error tracking and alerts
 * 
 * Usage:
 *   # Monitor specific line
 *   npm run tsx scripts/monitor-bulk-ftp-progress.ts -- --line 643
 * 
 *   # Monitor all lines with live updates
 *   npm run tsx scripts/monitor-bulk-ftp-progress.ts -- --live
 * 
 *   # Monitor with specific refresh interval
 *   npm run tsx scripts/monitor-bulk-ftp-progress.ts -- --live --interval 5
 */

import { db } from '../src/db/connection';
import { sql } from 'drizzle-orm';
import { logger } from '../src/config/logger';
import { createClient } from 'redis';
import chalk from 'chalk';

interface MonitoringOptions {
  lineId?: number;
  live: boolean;
  interval: number;
  showErrors: boolean;
  showSuccess: boolean;
}

class BulkFTPMonitor {
  private options: MonitoringOptions;
  private redisClient: any;
  private isRunning = false;
  private lastUpdate: Date = new Date();

  constructor(options: MonitoringOptions) {
    this.options = options;
  }

  async initialize(): Promise<void> {
    try {
      // Initialize Redis connection for queue monitoring
      this.redisClient = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });
      
      this.redisClient.on('error', (err: any) => {
        logger.warn('Redis connection error (queue monitoring disabled):', err.message);
      });

      await this.redisClient.connect();
      logger.info('✅ Connected to Redis for queue monitoring');
    } catch (error) {
      logger.warn('⚠️ Redis connection failed, queue monitoring disabled:', error);
    }
  }

  async startMonitoring(): Promise<void> {
    await this.initialize();
    this.isRunning = true;

    console.log(chalk.cyan('🚀 Starting Bulk FTP Processing Monitor'));
    console.log(chalk.gray(`Options: ${JSON.stringify(this.options, null, 2)}`));
    console.log(chalk.gray('='.repeat(80)));

    if (this.options.live) {
      await this.runLiveMonitoring();
    } else {
      await this.runSingleCheck();
    }
  }

  async runLiveMonitoring(): Promise<void> {
    console.log(chalk.yellow(`🔄 Live monitoring every ${this.options.interval} seconds (Ctrl+C to stop)`));
    
    while (this.isRunning) {
      try {
        await this.clearScreen();
        await this.displayStatus();
        
        // Wait for specified interval
        await new Promise(resolve => setTimeout(resolve, this.options.interval * 1000));
      } catch (error) {
        logger.error('Error in live monitoring:', error);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s on error
      }
    }
  }

  async runSingleCheck(): Promise<void> {
    await this.displayStatus();
    process.exit(0);
  }

  async displayStatus(): Promise<void> {
    console.log(chalk.cyan(`📊 Bulk FTP Processing Status - ${new Date().toISOString()}`));
    console.log(chalk.gray('='.repeat(80)));

    const [webhookStatus, redisStatus, cruiseStatus, recentActivity] = await Promise.all([
      this.getWebhookStatus(),
      this.getRedisQueueStatus(),
      this.getCruiseUpdateStatus(),
      this.getRecentActivity()
    ]);

    // Display sections
    this.displayWebhookStatus(webhookStatus);
    this.displayRedisStatus(redisStatus);
    this.displayCruiseStatus(cruiseStatus);
    this.displayRecentActivity(recentActivity);
    
    // Display summary
    await this.displaySummary();
  }

  async getWebhookStatus(): Promise<any> {
    try {
      const query = this.options.lineId 
        ? sql`
            SELECT 
              COUNT(*) as total,
              COUNT(*) FILTER (WHERE processed = true) as processed,
              COUNT(*) FILTER (WHERE processed = false) as pending,
              SUM(successful_count) as successful_cruises,
              SUM(failed_count) as failed_cruises,
              AVG(processing_time_ms) as avg_time,
              MAX(processing_time_ms) as max_time,
              MAX(created_at) as latest_webhook
            FROM webhook_events 
            WHERE line_id = ${this.options.lineId} 
              AND created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
          `
        : sql`
            SELECT 
              COUNT(*) as total,
              COUNT(*) FILTER (WHERE processed = true) as processed,
              COUNT(*) FILTER (WHERE processed = false) as pending,
              SUM(successful_count) as successful_cruises,
              SUM(failed_count) as failed_cruises,
              AVG(processing_time_ms) as avg_time,
              MAX(processing_time_ms) as max_time,
              MAX(created_at) as latest_webhook
            FROM webhook_events 
            WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
          `;

      const result = await db.execute(query);
      return result.rows[0] || {};
    } catch (error) {
      logger.error('Error getting webhook status:', error);
      return { error: error.message };
    }
  }

  async getRedisQueueStatus(): Promise<any> {
    if (!this.redisClient) {
      return { error: 'Redis not connected' };
    }

    try {
      const [
        bulkProcessingWaiting,
        bulkProcessingActive,
        bulkProcessingCompleted,
        bulkProcessingFailed,
        webhookWaiting,
        webhookActive
      ] = await Promise.all([
        this.redisClient.lLen('bull:BulkCruiseProcessingQueue:waiting'),
        this.redisClient.lLen('bull:BulkCruiseProcessingQueue:active'),
        this.redisClient.lLen('bull:BulkCruiseProcessingQueue:completed'),
        this.redisClient.lLen('bull:BulkCruiseProcessingQueue:failed'),
        this.redisClient.lLen('bull:WebhookQueue:waiting'),
        this.redisClient.lLen('bull:WebhookQueue:active')
      ]);

      return {
        bulk: {
          waiting: bulkProcessingWaiting,
          active: bulkProcessingActive,
          completed: bulkProcessingCompleted,
          failed: bulkProcessingFailed
        },
        webhook: {
          waiting: webhookWaiting,
          active: webhookActive
        }
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  async getCruiseUpdateStatus(): Promise<any> {
    try {
      const query = this.options.lineId
        ? sql`
            SELECT 
              COUNT(*) as total_cruises,
              COUNT(*) FILTER (WHERE needs_price_update = true) as pending_updates,
              COUNT(*) FILTER (WHERE sailing_date >= CURRENT_DATE) as future_cruises,
              COUNT(*) FILTER (WHERE updated_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour') as updated_last_hour,
              COUNT(*) FILTER (WHERE updated_at >= CURRENT_TIMESTAMP - INTERVAL '10 minutes') as updated_last_10min,
              MAX(updated_at) as last_update
            FROM cruises 
            WHERE cruise_line_id = ${this.options.lineId}
          `
        : sql`
            SELECT 
              COUNT(*) as total_cruises,
              COUNT(*) FILTER (WHERE needs_price_update = true) as pending_updates,
              COUNT(*) FILTER (WHERE sailing_date >= CURRENT_DATE) as future_cruises,
              COUNT(*) FILTER (WHERE updated_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour') as updated_last_hour,
              COUNT(*) FILTER (WHERE updated_at >= CURRENT_TIMESTAMP - INTERVAL '10 minutes') as updated_last_10min,
              MAX(updated_at) as last_update
            FROM cruises
          `;

      const result = await db.execute(query);
      return result.rows[0] || {};
    } catch (error) {
      return { error: error.message };
    }
  }

  async getRecentActivity(): Promise<any> {
    try {
      const recentWebhooks = await db.execute(sql`
        SELECT 
          id, event_type, line_id, processed, successful_count, failed_count,
          processing_time_ms, created_at, processed_at, description
        FROM webhook_events 
        WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '2 hours'
        ${this.options.lineId ? sql`AND line_id = ${this.options.lineId}` : sql``}
        ORDER BY created_at DESC 
        LIMIT 10
      `);

      const recentUpdates = await db.execute(sql`
        SELECT 
          id, cruise_id, name, sailing_date, updated_at,
          interior_cheapest_price, oceanview_cheapest_price, 
          balcony_cheapest_price, suite_cheapest_price
        FROM cruises 
        WHERE updated_at >= CURRENT_TIMESTAMP - INTERVAL '30 minutes'
        ${this.options.lineId ? sql`AND cruise_line_id = ${this.options.lineId}` : sql``}
        ORDER BY updated_at DESC 
        LIMIT 15
      `);

      return {
        webhooks: recentWebhooks.rows || [],
        updates: recentUpdates.rows || []
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  displayWebhookStatus(status: any): void {
    console.log(chalk.blue('📡 WEBHOOK STATUS'));
    console.log(chalk.gray('-'.repeat(50)));
    
    if (status.error) {
      console.log(chalk.red(`❌ Error: ${status.error}`));
      return;
    }

    const successRate = status.total > 0 
      ? ((status.successful_cruises / (status.successful_cruises + status.failed_cruises)) * 100).toFixed(1)
      : '0';

    console.log(`📊 Total webhooks (24h): ${chalk.white(status.total || 0)}`);
    console.log(`✅ Processed: ${chalk.green(status.processed || 0)}`);
    console.log(`⏳ Pending: ${chalk.yellow(status.pending || 0)}`);
    console.log(`🎯 Successful cruises: ${chalk.green(status.successful_cruises || 0)}`);
    console.log(`❌ Failed cruises: ${chalk.red(status.failed_cruises || 0)}`);
    console.log(`📈 Success rate: ${successRate}%`);
    
    if (status.avg_time) {
      console.log(`⚡ Avg processing time: ${Math.round(status.avg_time)}ms`);
    }
    
    if (status.latest_webhook) {
      const timeSince = Date.now() - new Date(status.latest_webhook).getTime();
      console.log(`🕐 Last webhook: ${this.formatTimeSince(timeSince)} ago`);
    }
    
    console.log('');
  }

  displayRedisStatus(status: any): void {
    console.log(chalk.magenta('🔄 REDIS QUEUE STATUS'));
    console.log(chalk.gray('-'.repeat(50)));
    
    if (status.error) {
      console.log(chalk.red(`❌ Error: ${status.error}`));
      console.log('');
      return;
    }

    console.log(chalk.cyan('Bulk Processing Queue:'));
    console.log(`  ⏳ Waiting: ${chalk.yellow(status.bulk.waiting)}`);
    console.log(`  🏃 Active: ${chalk.green(status.bulk.active)}`);
    console.log(`  ✅ Completed: ${chalk.blue(status.bulk.completed)}`);
    console.log(`  ❌ Failed: ${chalk.red(status.bulk.failed)}`);
    
    console.log(chalk.cyan('Webhook Queue:'));
    console.log(`  ⏳ Waiting: ${chalk.yellow(status.webhook.waiting)}`);
    console.log(`  🏃 Active: ${chalk.green(status.webhook.active)}`);
    
    console.log('');
  }

  displayCruiseStatus(status: any): void {
    console.log(chalk.green('🚢 CRUISE UPDATE STATUS'));
    console.log(chalk.gray('-'.repeat(50)));
    
    if (status.error) {
      console.log(chalk.red(`❌ Error: ${status.error}`));
      console.log('');
      return;
    }

    console.log(`🚢 Total cruises: ${chalk.white(status.total_cruises || 0)}`);
    console.log(`🎯 Future cruises: ${chalk.blue(status.future_cruises || 0)}`);
    console.log(`⏳ Pending updates: ${chalk.yellow(status.pending_updates || 0)}`);
    console.log(`🔥 Updated last hour: ${chalk.green(status.updated_last_hour || 0)}`);
    console.log(`⚡ Updated last 10min: ${chalk.greenBright(status.updated_last_10min || 0)}`);
    
    if (status.last_update) {
      const timeSince = Date.now() - new Date(status.last_update).getTime();
      console.log(`🕐 Last update: ${this.formatTimeSince(timeSince)} ago`);
    }
    
    console.log('');
  }

  displayRecentActivity(activity: any): void {
    if (activity.error) {
      console.log(chalk.red(`❌ Activity Error: ${activity.error}`));
      return;
    }

    // Recent webhooks
    if (activity.webhooks.length > 0) {
      console.log(chalk.cyan('🎯 RECENT WEBHOOKS (last 2 hours)'));
      console.log(chalk.gray('-'.repeat(50)));
      
      for (const webhook of activity.webhooks.slice(0, 5)) {
        const status = webhook.processed ? '✅' : '⏳';
        const timeSince = this.formatTimeSince(Date.now() - new Date(webhook.created_at).getTime());
        console.log(`${status} Line ${webhook.line_id} | ${webhook.successful_count || 0}/${webhook.failed_count || 0} | ${timeSince} ago`);
      }
      console.log('');
    }

    // Recent cruise updates
    if (activity.updates.length > 0) {
      console.log(chalk.green('📊 RECENT CRUISE UPDATES (last 30 min)'));
      console.log(chalk.gray('-'.repeat(50)));
      
      for (const update of activity.updates.slice(0, 8)) {
        const timeSince = this.formatTimeSince(Date.now() - new Date(update.updated_at).getTime());
        const hasPricing = !!(update.interior_cheapest_price || update.oceanview_cheapest_price || 
                            update.balcony_cheapest_price || update.suite_cheapest_price);
        const pricingIcon = hasPricing ? '💰' : '⚪';
        
        console.log(`${pricingIcon} ${update.name?.substring(0, 40) || 'Unknown'} | ${timeSince} ago`);
      }
      console.log('');
    }
  }

  async displaySummary(): Promise<void> {
    console.log(chalk.cyan('📋 MONITORING SUMMARY'));
    console.log(chalk.gray('-'.repeat(50)));
    
    if (this.options.lineId) {
      console.log(`🎯 Monitoring Line: ${chalk.white(this.options.lineId)}`);
    } else {
      console.log('🌐 Monitoring: All Lines');
    }
    
    console.log(`⏰ Current Time: ${chalk.white(new Date().toLocaleString())}`);
    console.log(`🔄 Refresh Rate: ${chalk.white(this.options.interval)}s`);
    
    // Quick health check
    const webhookStatus = await this.getWebhookStatus();
    const redisStatus = await this.getRedisQueueStatus();
    
    const healthIssues: string[] = [];
    
    if (webhookStatus.pending > 5) {
      healthIssues.push(`${webhookStatus.pending} webhooks pending`);
    }
    
    if (redisStatus.bulk?.failed > 10) {
      healthIssues.push(`${redisStatus.bulk.failed} bulk jobs failed`);
    }
    
    if (redisStatus.bulk?.waiting > 20) {
      healthIssues.push(`${redisStatus.bulk.waiting} jobs waiting`);
    }
    
    if (healthIssues.length === 0) {
      console.log(`💚 System Health: ${chalk.green('HEALTHY')}`);
    } else {
      console.log(`⚠️  System Health: ${chalk.yellow('ATTENTION NEEDED')}`);
      healthIssues.forEach(issue => {
        console.log(`   - ${chalk.yellow(issue)}`);
      });
    }
    
    console.log(chalk.gray('-'.repeat(80)));
  }

  formatTimeSince(ms: number): string {
    if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m`;
    return `${Math.floor(ms / 3600000)}h`;
  }

  async clearScreen(): Promise<void> {
    if (this.options.live) {
      process.stdout.write('\x1Bc'); // Clear screen
    }
  }

  async cleanup(): Promise<void> {
    this.isRunning = false;
    if (this.redisClient) {
      await this.redisClient.quit();
    }
    console.log(chalk.yellow('\n👋 Monitoring stopped'));
    process.exit(0);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  const options: MonitoringOptions = {
    live: args.includes('--live'),
    interval: 10,
    showErrors: true,
    showSuccess: true
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

  const monitor = new BulkFTPMonitor(options);
  
  // Handle graceful shutdown
  process.on('SIGINT', () => monitor.cleanup());
  process.on('SIGTERM', () => monitor.cleanup());
  
  try {
    await monitor.startMonitoring();
  } catch (error) {
    console.error(chalk.red('❌ Monitor failed:', error));
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { BulkFTPMonitor };