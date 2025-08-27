#!/usr/bin/env ts-node

import { db } from '../db/connection';
import { sql } from 'drizzle-orm';
import { traveltekWebhookService } from '../services/traveltek-webhook.service';
import { priceSyncBatchServiceV2 } from '../services/price-sync-batch-v2.service';
import { slackService } from '../services/slack.service';
import logger from '../config/logger';
import { getDatabaseLineId, CRUISE_LINE_ID_MAPPING } from '../config/cruise-line-mapping';

interface TestResult {
  step: string;
  success: boolean;
  details: any;
  error?: string;
}

/**
 * Comprehensive test script for webhook and batch processing flow
 * Tests the complete flow: Webhook → Mark Cruises → Batch Sync → FTP Download → Update Prices
 */
class WebhookBatchFlowTester {
  private results: TestResult[] = [];
  
  constructor() {
    logger.info('🧪 Starting comprehensive webhook and batch flow test');
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<void> {
    await this.testDatabaseConnection();
    await this.analyzeLine643();
    await this.testCruiseLineMapping();
    await this.testWebhookMarking();
    await this.testBatchSync();
    await this.testPriceHistory();
    await this.testErrorHandling();
    await this.generateReport();
  }

  /**
   * Test 1: Database Connection
   */
  private async testDatabaseConnection(): Promise<void> {
    try {
      const result = await db.execute(sql`SELECT COUNT(*) as count FROM cruises`);
      const cruiseCount = result.rows[0]?.count || 0;
      
      this.results.push({
        step: 'Database Connection',
        success: true,
        details: { cruiseCount }
      });
      
      logger.info(`✅ Database connected - ${cruiseCount} cruises in database`);
    } catch (error) {
      this.results.push({
        step: 'Database Connection',
        success: false,
        details: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      logger.error('❌ Database connection failed:', error);
    }
  }

  /**
   * Test 2: Analyze Line 643 specifically
   */
  private async analyzeLine643(): Promise<void> {
    try {
      const lineId = 643;
      const mappedId = getDatabaseLineId(lineId);
      
      // Check if line exists in database
      const lineCheck = await db.execute(sql`
        SELECT id, name, code FROM cruise_lines WHERE id = ${lineId} OR id = ${mappedId}
      `);
      
      // Check cruises for this line
      const cruiseCheck = await db.execute(sql`
        SELECT COUNT(*) as count, 
               COUNT(*) FILTER (WHERE needs_price_update = true) as marked_count
        FROM cruises 
        WHERE cruise_line_id = ${lineId} OR cruise_line_id = ${mappedId}
      `);
      
      // Check if line 643 has any cruises marked for update
      const markedCruises = await db.execute(sql`
        SELECT id, cruise_id, name, sailing_date, needs_price_update, price_update_requested_at
        FROM cruises
        WHERE cruise_line_id = ${lineId}
          AND needs_price_update = true
        ORDER BY price_update_requested_at DESC
        LIMIT 10
      `);
      
      this.results.push({
        step: 'Line 643 Analysis',
        success: true,
        details: {
          lineId,
          mappedId,
          exists: lineCheck.rows.length > 0,
          lineInfo: lineCheck.rows,
          totalCruises: cruiseCheck.rows[0]?.count || 0,
          markedCruises: cruiseCheck.rows[0]?.marked_count || 0,
          recentMarked: markedCruises.rows.slice(0, 5)
        }
      });
      
      logger.info(`✅ Line 643 Analysis:`, {
        exists: lineCheck.rows.length > 0,
        mappedTo: mappedId,
        cruises: cruiseCheck.rows[0]?.count || 0,
        marked: cruiseCheck.rows[0]?.marked_count || 0
      });
    } catch (error) {
      this.results.push({
        step: 'Line 643 Analysis',
        success: false,
        details: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      logger.error('❌ Line 643 analysis failed:', error);
    }
  }

  /**
   * Test 3: Cruise Line Mapping
   */
  private async testCruiseLineMapping(): Promise<void> {
    try {
      const mappingTests = [
        { webhookId: 3, expectedDb: 22 }, // Royal Caribbean
        { webhookId: 643, expectedDb: 643 }, // Line 643 (unmapped)
        { webhookId: 1, expectedDb: 1 }, // P&O
      ];
      
      const results = [];
      for (const test of mappingTests) {
        const mapped = getDatabaseLineId(test.webhookId);
        const isCorrect = mapped === test.expectedDb;
        
        results.push({
          webhookId: test.webhookId,
          expectedDb: test.expectedDb,
          actualDb: mapped,
          correct: isCorrect
        });
      }
      
      this.results.push({
        step: 'Cruise Line Mapping',
        success: results.every(r => r.correct),
        details: { mappingTests: results, fullMapping: CRUISE_LINE_ID_MAPPING }
      });
      
      logger.info('✅ Cruise line mapping test completed');
    } catch (error) {
      this.results.push({
        step: 'Cruise Line Mapping',
        success: false,
        details: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Test 4: Webhook Marking Process
   */
  private async testWebhookMarking(): Promise<void> {
    try {
      // Simulate a webhook for line 643 (like the one mentioned in Slack)
      const testPayload = {
        event: 'cruiseline_pricing_updated',
        lineid: 643,
        marketid: 1,
        currency: 'USD',
        description: 'Test webhook for line 643',
        source: 'test_webhook',
        timestamp: Date.now()
      };
      
      logger.info('🧪 Simulating webhook for line 643...');
      
      // Count marked cruises before
      const beforeCount = await db.execute(sql`
        SELECT COUNT(*) as count FROM cruises 
        WHERE cruise_line_id = 643 AND needs_price_update = true
      `);
      
      // Process the webhook
      const result = await traveltekWebhookService.handleStaticPricingUpdate(testPayload);
      
      // Count marked cruises after
      const afterCount = await db.execute(sql`
        SELECT COUNT(*) as count FROM cruises 
        WHERE cruise_line_id = 643 AND needs_price_update = true
      `);
      
      this.results.push({
        step: 'Webhook Marking',
        success: result.successful >= 0 && result.errors.length === 0,
        details: {
          payload: testPayload,
          result,
          beforeCount: beforeCount.rows[0]?.count || 0,
          afterCount: afterCount.rows[0]?.count || 0
        }
      });
      
      logger.info(`✅ Webhook marking test: ${result.successful} successful, ${result.failed} failed`);
    } catch (error) {
      this.results.push({
        step: 'Webhook Marking',
        success: false,
        details: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      logger.error('❌ Webhook marking test failed:', error);
    }
  }

  /**
   * Test 5: Batch Sync V2 Service
   */
  private async testBatchSync(): Promise<void> {
    try {
      // Check if any lines need updates before sync
      const linesNeedingUpdates = await db.execute(sql`
        SELECT DISTINCT cruise_line_id, COUNT(*) as cruise_count
        FROM cruises
        WHERE needs_price_update = true
        GROUP BY cruise_line_id
        ORDER BY cruise_line_id
      `);
      
      logger.info('🧪 Testing batch sync V2 service...');
      
      // Run the batch sync
      const syncResult = await priceSyncBatchServiceV2.syncPendingPriceUpdates();
      
      // Check lines needing updates after sync
      const linesAfterSync = await db.execute(sql`
        SELECT DISTINCT cruise_line_id, COUNT(*) as cruise_count
        FROM cruises
        WHERE needs_price_update = true
        GROUP BY cruise_line_id
        ORDER BY cruise_line_id
      `);
      
      this.results.push({
        step: 'Batch Sync V2',
        success: syncResult.errors === 0 || syncResult.cruisesUpdated > 0,
        details: {
          syncResult,
          linesBeforeSync: linesNeedingUpdates.rows,
          linesAfterSync: linesAfterSync.rows
        }
      });
      
      logger.info(`✅ Batch sync test: ${syncResult.cruisesUpdated} updated, ${syncResult.errors} errors`);
    } catch (error) {
      this.results.push({
        step: 'Batch Sync V2',
        success: false,
        details: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      logger.error('❌ Batch sync test failed:', error);
    }
  }

  /**
   * Test 6: Price History Creation
   */
  private async testPriceHistory(): Promise<void> {
    try {
      // Check recent price history entries
      const recentHistory = await db.execute(sql`
        SELECT COUNT(*) as count,
               MAX(created_at) as latest_entry
        FROM price_history
        WHERE created_at >= CURRENT_DATE - INTERVAL '1 day'
      `);
      
      // Check if price_history table exists and has correct structure
      const tableCheck = await db.execute(sql`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'price_history'
        ORDER BY ordinal_position
      `);
      
      this.results.push({
        step: 'Price History',
        success: tableCheck.rows.length > 0,
        details: {
          tableExists: tableCheck.rows.length > 0,
          columns: tableCheck.rows,
          recentEntries: recentHistory.rows[0]?.count || 0,
          latestEntry: recentHistory.rows[0]?.latest_entry
        }
      });
      
      logger.info(`✅ Price history test: ${tableCheck.rows.length} columns, ${recentHistory.rows[0]?.count || 0} recent entries`);
    } catch (error) {
      this.results.push({
        step: 'Price History',
        success: false,
        details: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Test 7: Error Handling
   */
  private async testErrorHandling(): Promise<void> {
    try {
      // Test invalid webhook payload
      const invalidPayload = {
        event: 'invalid_event',
        lineid: 99999, // Non-existent line
        marketid: 1,
        currency: 'USD',
        timestamp: Date.now()
      };
      
      // This should handle gracefully
      const result = await traveltekWebhookService.handleGenericWebhook(invalidPayload);
      
      this.results.push({
        step: 'Error Handling',
        success: true, // Success means it handled the error gracefully
        details: {
          invalidPayload,
          result
        }
      });
      
      logger.info('✅ Error handling test passed');
    } catch (error) {
      this.results.push({
        step: 'Error Handling',
        success: false,
        details: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Generate comprehensive report
   */
  private async generateReport(): Promise<void> {
    const successful = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    
    const report = {
      summary: {
        total: this.results.length,
        successful,
        failed,
        successRate: `${Math.round((successful / this.results.length) * 100)}%`
      },
      results: this.results,
      recommendations: this.generateRecommendations(),
      timestamp: new Date().toISOString()
    };
    
    // Log summary
    logger.info(`\n📊 WEBHOOK & BATCH FLOW TEST REPORT`);
    logger.info(`${'='.repeat(50)}`);
    logger.info(`✅ Successful: ${successful}/${this.results.length}`);
    logger.info(`❌ Failed: ${failed}/${this.results.length}`);
    logger.info(`📈 Success Rate: ${report.summary.successRate}`);
    logger.info(`${'='.repeat(50)}`);
    
    // Log each result
    this.results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      logger.info(`${status} ${result.step}: ${result.success ? 'PASSED' : 'FAILED'}`);
      if (!result.success && result.error) {
        logger.error(`   Error: ${result.error}`);
      }
    });
    
    // Send Slack notification with summary
    await slackService.notifyCustomMessage({
      title: `🧪 Webhook & Batch Flow Test Report`,
      message: `${successful}/${this.results.length} tests passed (${report.summary.successRate})`,
      details: {
        summary: report.summary,
        failedTests: this.results.filter(r => !r.success).map(r => ({ step: r.step, error: r.error })),
        recommendations: report.recommendations
      }
    });
    
    logger.info(`\n📋 RECOMMENDATIONS:`);
    report.recommendations.forEach((rec, i) => {
      logger.info(`${i + 1}. ${rec}`);
    });
  }

  /**
   * Generate recommendations based on test results
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const failedSteps = this.results.filter(r => !r.success).map(r => r.step);
    
    if (failedSteps.includes('Database Connection')) {
      recommendations.push('Fix database connection issues before proceeding');
    }
    
    if (failedSteps.includes('Line 643 Analysis')) {
      recommendations.push('Investigate line 643 - determine the cruise line name and add proper mapping');
    }
    
    if (failedSteps.includes('Webhook Marking')) {
      recommendations.push('Review webhook marking logic and database schema');
    }
    
    if (failedSteps.includes('Batch Sync V2')) {
      recommendations.push('Check FTP connection and V2 batch sync service implementation');
    }
    
    if (failedSteps.includes('Price History')) {
      recommendations.push('Verify price_history table schema and creation logic');
    }
    
    // Always include these general recommendations
    recommendations.push('Monitor webhook events table for processing statistics');
    recommendations.push('Set up automated monitoring for the complete flow');
    recommendations.push('Consider adding more granular error reporting');
    
    return recommendations;
  }

  /**
   * Test specific line ID to see what happens
   */
  async testSpecificLine(lineId: number): Promise<void> {
    logger.info(`🔍 Testing specific line ${lineId}...`);
    
    // Check line existence
    const lineExists = await db.execute(sql`
      SELECT id, name, code FROM cruise_lines WHERE id = ${lineId}
    `);
    
    // Check cruises for this line
    const cruises = await db.execute(sql`
      SELECT COUNT(*) as total,
             COUNT(*) FILTER (WHERE needs_price_update = true) as marked,
             COUNT(*) FILTER (WHERE sailing_date >= CURRENT_DATE) as future
      FROM cruises
      WHERE cruise_line_id = ${lineId}
    `);
    
    logger.info(`Line ${lineId} status:`, {
      exists: lineExists.rows.length > 0,
      lineInfo: lineExists.rows[0],
      cruises: cruises.rows[0]
    });
  }
}

/**
 * Main execution
 */
async function main() {
  const tester = new WebhookBatchFlowTester();
  
  try {
    // Check for specific line if provided as argument
    const specificLine = process.argv[2];
    if (specificLine) {
      await tester.testSpecificLine(parseInt(specificLine));
      return;
    }
    
    // Run all tests
    await tester.runAllTests();
    
  } catch (error) {
    logger.error('❌ Test execution failed:', error);
    process.exit(1);
  } finally {
    // Close database connection
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { WebhookBatchFlowTester };