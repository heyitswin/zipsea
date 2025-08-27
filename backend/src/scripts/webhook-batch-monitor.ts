#!/usr/bin/env ts-node

import { db } from '../db/connection';
import { sql } from 'drizzle-orm';
import { slackService } from '../services/slack.service';
import logger from '../config/logger';

/**
 * Production monitoring tool for webhook and batch processing flow
 * Tracks the complete pipeline and identifies bottlenecks
 */
class WebhookBatchMonitor {

  /**
   * Run comprehensive monitoring check
   */
  async runMonitoring(): Promise<void> {
    logger.info('📊 Starting webhook & batch processing monitoring...');
    
    const report = {
      timestamp: new Date().toISOString(),
      webhookStatus: await this.checkWebhookStatus(),
      batchStatus: await this.checkBatchStatus(),
      cruiseStatus: await this.checkCruiseStatus(),
      priceHistoryStatus: await this.checkPriceHistoryStatus(),
      systemHealth: await this.checkSystemHealth(),
      alerts: [] as string[]
    };
    
    // Generate alerts based on findings
    report.alerts = this.generateAlerts(report);
    
    // Send report
    await this.sendMonitoringReport(report);
    
    logger.info('✅ Monitoring check complete');
  }

  /**
   * Check webhook processing status
   */
  private async checkWebhookStatus(): Promise<any> {
    try {
      // Recent webhook events (last 24 hours)
      const recentWebhooks = await db.execute(sql`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE processed = true) as processed,
          COUNT(*) FILTER (WHERE processed = false) as pending,
          AVG(processing_time_ms) as avg_processing_time,
          MAX(processing_time_ms) as max_processing_time,
          SUM(successful_count) as total_successful,
          SUM(failed_count) as total_failed
        FROM webhook_events
        WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
      `);
      
      // Webhook events by line ID (last 24 hours)
      const webhooksByLine = await db.execute(sql`
        SELECT 
          line_id,
          COUNT(*) as webhook_count,
          SUM(successful_count) as successful_cruises,
          SUM(failed_count) as failed_cruises,
          MAX(created_at) as latest_webhook
        FROM webhook_events
        WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
        GROUP BY line_id
        ORDER BY webhook_count DESC
      `);
      
      // Failed webhooks
      const failedWebhooks = await db.execute(sql`
        SELECT id, line_id, event_type, description, created_at, failed_count
        FROM webhook_events
        WHERE failed_count > 0
          AND created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
        ORDER BY created_at DESC
        LIMIT 10
      `);
      
      return {
        summary: recentWebhooks.rows[0],
        byLine: webhooksByLine.rows,
        failed: failedWebhooks.rows
      };
      
    } catch (error) {
      logger.error('Error checking webhook status:', error);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Check batch processing status
   */
  private async checkBatchStatus(): Promise<any> {
    try {
      // Cruise lines needing batch updates
      const linesNeedingUpdates = await db.execute(sql`
        SELECT 
          cruise_line_id,
          COUNT(*) as cruise_count,
          MIN(price_update_requested_at) as oldest_request,
          MAX(price_update_requested_at) as newest_request
        FROM cruises
        WHERE needs_price_update = true
        GROUP BY cruise_line_id
        ORDER BY cruise_count DESC
      `);
      
      // Overall update status
      const updateStatus = await db.execute(sql`
        SELECT 
          COUNT(*) FILTER (WHERE needs_price_update = true) as pending_updates,
          COUNT(*) FILTER (WHERE needs_price_update = false) as up_to_date,
          COUNT(*) as total_cruises,
          COUNT(*) FILTER (WHERE needs_price_update = true AND sailing_date >= CURRENT_DATE) as future_pending
        FROM cruises
      `);
      
      // Recent batch activity (based on price updates)
      const recentBatchActivity = await db.execute(sql`
        SELECT 
          DATE(updated_at) as update_date,
          COUNT(*) as cruises_updated
        FROM cruises
        WHERE updated_at >= CURRENT_DATE - INTERVAL '7 days'
          AND NOT needs_price_update
        GROUP BY DATE(updated_at)
        ORDER BY update_date DESC
      `);
      
      return {
        linesNeedingUpdates: linesNeedingUpdates.rows,
        updateStatus: updateStatus.rows[0],
        recentActivity: recentBatchActivity.rows
      };
      
    } catch (error) {
      logger.error('Error checking batch status:', error);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Check cruise status and health
   */
  private async checkCruiseStatus(): Promise<any> {
    try {
      // Cruise counts by line
      const cruisesByLine = await db.execute(sql`
        SELECT 
          cl.id as line_id,
          cl.name as line_name,
          COUNT(c.id) as total_cruises,
          COUNT(*) FILTER (WHERE c.sailing_date >= CURRENT_DATE) as future_cruises,
          COUNT(*) FILTER (WHERE c.needs_price_update = true) as pending_updates,
          MIN(c.sailing_date) as earliest_sailing,
          MAX(c.sailing_date) as latest_sailing
        FROM cruise_lines cl
        LEFT JOIN cruises c ON cl.id = c.cruise_line_id
        GROUP BY cl.id, cl.name
        HAVING COUNT(c.id) > 0
        ORDER BY total_cruises DESC
      `);
      
      // Recent cruise creation activity
      const recentCreations = await db.execute(sql`
        SELECT 
          DATE(created_at) as creation_date,
          COUNT(*) as cruises_created
        FROM cruises
        WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        ORDER BY creation_date DESC
      `);
      
      // Cruises with pricing issues
      const pricingIssues = await db.execute(sql`
        SELECT 
          COUNT(*) FILTER (WHERE interior_cheapest_price IS NULL AND oceanview_cheapest_price IS NULL 
                          AND balcony_cheapest_price IS NULL AND suite_cheapest_price IS NULL) as no_pricing,
          COUNT(*) FILTER (WHERE sailing_date >= CURRENT_DATE 
                          AND interior_cheapest_price IS NULL AND oceanview_cheapest_price IS NULL 
                          AND balcony_cheapest_price IS NULL AND suite_cheapest_price IS NULL) as future_no_pricing
        FROM cruises
      `);
      
      return {
        byLine: cruisesByLine.rows,
        recentCreations: recentCreations.rows,
        pricingIssues: pricingIssues.rows[0]
      };
      
    } catch (error) {
      logger.error('Error checking cruise status:', error);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Check price history tracking
   */
  private async checkPriceHistoryStatus(): Promise<any> {
    try {
      // Check if price_history table exists
      const tableExists = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'price_history'
        )
      `);
      
      if (!tableExists.rows[0]?.exists) {
        return { error: 'price_history table does not exist' };
      }
      
      // Price history statistics
      const historyStats = await db.execute(sql`
        SELECT 
          COUNT(*) as total_entries,
          COUNT(DISTINCT cruise_id) as cruises_tracked,
          MIN(created_at) as oldest_entry,
          MAX(created_at) as latest_entry,
          COUNT(*) FILTER (WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours') as entries_24h,
          COUNT(*) FILTER (WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days') as entries_7d
        FROM price_history
      `);
      
      // Recent price history activity
      const recentActivity = await db.execute(sql`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as entries_created
        FROM price_history
        WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `);
      
      return {
        exists: true,
        stats: historyStats.rows[0],
        recentActivity: recentActivity.rows
      };
      
    } catch (error) {
      logger.error('Error checking price history status:', error);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Check overall system health
   */
  private async checkSystemHealth(): Promise<any> {
    try {
      // Database connection health
      const dbHealth = await db.execute(sql`SELECT 1 as healthy`);
      
      // Table existence check
      const tables = ['cruises', 'cruise_lines', 'ships', 'webhook_events', 'price_history'];
      const tableCheck = await Promise.all(
        tables.map(async (table) => {
          const exists = await db.execute(sql`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = ${table}
            )
          `);
          return { table, exists: exists.rows[0]?.exists || false };
        })
      );
      
      // Recent system activity
      const systemActivity = await db.execute(sql`
        SELECT 
          'webhook_events' as source,
          COUNT(*) as count,
          MAX(created_at) as latest_activity
        FROM webhook_events
        WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour'
        
        UNION ALL
        
        SELECT 
          'cruise_updates' as source,
          COUNT(*) as count,
          MAX(updated_at) as latest_activity
        FROM cruises
        WHERE updated_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour'
      `);
      
      return {
        database: dbHealth.rows.length > 0,
        tables: tableCheck,
        recentActivity: systemActivity.rows
      };
      
    } catch (error) {
      logger.error('Error checking system health:', error);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Generate alerts based on monitoring data
   */
  private generateAlerts(report: any): string[] {
    const alerts: string[] = [];
    
    // Webhook alerts
    if (report.webhookStatus.summary) {
      const webhook = report.webhookStatus.summary;
      
      if (webhook.pending > 5) {
        alerts.push(`⚠️ ${webhook.pending} webhooks pending processing`);
      }
      
      if (webhook.total_failed > webhook.total_successful * 0.1) {
        alerts.push(`❌ High webhook failure rate: ${webhook.total_failed}/${webhook.total} failed`);
      }
      
      if (webhook.max_processing_time > 60000) {
        alerts.push(`🐌 Slow webhook processing: ${Math.round(webhook.max_processing_time/1000)}s max time`);
      }
    }
    
    // Batch processing alerts
    if (report.batchStatus.updateStatus) {
      const batch = report.batchStatus.updateStatus;
      
      if (batch.pending_updates > 1000) {
        alerts.push(`📋 Large backlog: ${batch.pending_updates} cruises need price updates`);
      }
      
      if (batch.future_pending > 500) {
        alerts.push(`🚢 ${batch.future_pending} future cruises awaiting price updates`);
      }
    }
    
    // Cruise data alerts
    if (report.cruiseStatus.pricingIssues) {
      const pricing = report.cruiseStatus.pricingIssues;
      
      if (pricing.future_no_pricing > 100) {
        alerts.push(`💰 ${pricing.future_no_pricing} future cruises have no pricing data`);
      }
    }
    
    // System health alerts
    if (report.systemHealth.error) {
      alerts.push(`🚨 System health check failed: ${report.systemHealth.error}`);
    }
    
    if (report.priceHistoryStatus.error) {
      alerts.push(`📊 Price history tracking issue: ${report.priceHistoryStatus.error}`);
    }
    
    return alerts;
  }

  /**
   * Send monitoring report via Slack
   */
  private async sendMonitoringReport(report: any): Promise<void> {
    try {
      const alertEmoji = report.alerts.length === 0 ? '✅' : '⚠️';
      const title = `${alertEmoji} Webhook & Batch Processing Report`;
      
      // Create summary message
      const webhookSummary = report.webhookStatus.summary ? 
        `${report.webhookStatus.summary.processed}/${report.webhookStatus.summary.total} webhooks processed` :
        'Webhook data unavailable';
        
      const batchSummary = report.batchStatus.updateStatus ?
        `${report.batchStatus.updateStatus.pending_updates} cruises need updates` :
        'Batch data unavailable';
      
      await slackService.notifyCustomMessage({
        title,
        message: `${webhookSummary} | ${batchSummary}`,
        details: {
          alerts: report.alerts,
          webhook: report.webhookStatus,
          batch: report.batchStatus,
          cruises: report.cruiseStatus,
          priceHistory: report.priceHistoryStatus,
          systemHealth: report.systemHealth,
          timestamp: report.timestamp
        }
      });
      
      // Send alerts as separate message if any exist
      if (report.alerts.length > 0) {
        await slackService.notifyCustomMessage({
          title: '🚨 System Alerts',
          message: `${report.alerts.length} issues detected`,
          details: {
            alerts: report.alerts,
            action: 'Review monitoring report and take corrective action'
          }
        });
      }
      
    } catch (error) {
      logger.error('Failed to send monitoring report:', error);
    }
  }

  /**
   * Monitor specific line (like line 643)
   */
  async monitorSpecificLine(lineId: number): Promise<void> {
    logger.info(`🔍 Monitoring line ${lineId} specifically...`);
    
    try {
      // Line-specific webhook activity
      const webhooks = await db.execute(sql`
        SELECT 
          COUNT(*) as total_webhooks,
          MAX(created_at) as latest_webhook,
          SUM(successful_count) as total_successful,
          SUM(failed_count) as total_failed
        FROM webhook_events
        WHERE line_id = ${lineId}
          AND created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
      `);
      
      // Line-specific cruise status
      const cruises = await db.execute(sql`
        SELECT 
          COUNT(*) as total_cruises,
          COUNT(*) FILTER (WHERE needs_price_update = true) as pending_updates,
          COUNT(*) FILTER (WHERE sailing_date >= CURRENT_DATE) as future_cruises,
          MAX(updated_at) as last_update
        FROM cruises
        WHERE cruise_line_id = ${lineId}
      `);
      
      // Line information
      const lineInfo = await db.execute(sql`
        SELECT id, name, code FROM cruise_lines WHERE id = ${lineId}
      `);
      
      const report = {
        lineId,
        lineInfo: lineInfo.rows[0],
        webhooks: webhooks.rows[0],
        cruises: cruises.rows[0],
        timestamp: new Date().toISOString()
      };
      
      logger.info(`Line ${lineId} status:`, report);
      
      await slackService.notifyCustomMessage({
        title: `🔍 Line ${lineId} Monitoring Report`,
        message: `${report.cruises?.total_cruises || 0} cruises, ${report.cruises?.pending_updates || 0} pending updates`,
        details: report
      });
      
    } catch (error) {
      logger.error(`Error monitoring line ${lineId}:`, error);
    }
  }
}

/**
 * Main execution
 */
async function main() {
  const monitor = new WebhookBatchMonitor();
  
  try {
    // Check for specific line monitoring
    const specificLine = process.argv[2];
    if (specificLine) {
      await monitor.monitorSpecificLine(parseInt(specificLine));
      return;
    }
    
    // Run full monitoring
    await monitor.runMonitoring();
    
  } catch (error) {
    logger.error('❌ Monitoring failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { WebhookBatchMonitor };