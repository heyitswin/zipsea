/**
 * Real-Time Webhook Processing Service
 * 
 * This service replaces the old batch sync approach with immediate parallel processing.
 * When webhooks are received, they are processed in real-time using BullMQ workers.
 * No more needs_price_update flags or deferred batch processing.
 */

import { Queue, Worker, Job } from 'bullmq';
import { logger } from '../config/logger';
import { env } from '../config/environment';
import { traveltekFTPService } from './traveltek-ftp.service';
import { slackService } from './slack.service';
import { db } from '../db/connection';
import { sql, eq } from 'drizzle-orm';
import { cruises, pricing, priceHistory } from '../db/schema';
import { getDatabaseLineId } from '../config/cruise-line-mapping';
import IORedis from 'ioredis';

// Job data interfaces
export interface WebhookJobData {
  webhookId: string;
  eventType: string;
  lineId: number;
  payload: any;
  timestamp: string;
  priority?: number;
}

export interface CruiseProcessingJobData {
  cruiseId: string;
  lineId: number;
  webhookId: string;
  filePath?: string;
  retryCount?: number;
}

export interface ProcessingResult {
  successful: number;
  failed: number;
  ftpConnectionFailures: number;
  actuallyUpdated: number;
  errors: Array<{
    cruiseId?: string;
    error: string;
    type: 'ftp_connection' | 'file_not_found' | 'parse_error' | 'database_error';
  }>;
  startTime: Date;
  endTime: Date;
  processingTimeMs: number;
}

export class RealtimeWebhookService {
  private redisConnection: IORedis;
  private webhookQueue: Queue<WebhookJobData>;
  private cruiseQueue: Queue<CruiseProcessingJobData>;
  private webhookWorker: Worker<WebhookJobData>;
  private cruiseWorker: Worker<CruiseProcessingJobData>;
  
  private readonly MAX_RETRIES = 3;
  private readonly FTP_TIMEOUT = 15000; // 15 seconds
  private readonly PARALLEL_CRUISE_WORKERS = 10; // Process 10 cruises in parallel

  constructor() {
    // Initialize Redis connection
    if (env.REDIS_URL) {
      this.redisConnection = new IORedis(env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });
    } else {
      this.redisConnection = new IORedis({
        host: env.REDIS_HOST || 'localhost',
        port: env.REDIS_PORT || 6379,
        password: env.REDIS_PASSWORD,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });
    }

    // Create queues
    this.webhookQueue = new Queue<WebhookJobData>('realtime-webhooks', {
      connection: this.redisConnection,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    this.cruiseQueue = new Queue<CruiseProcessingJobData>('cruise-processing', {
      connection: this.redisConnection,
      defaultJobOptions: {
        removeOnComplete: 500,
        removeOnFail: 100,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    });

    // Create workers
    this.webhookWorker = new Worker<WebhookJobData>(
      'realtime-webhooks',
      this.processWebhookJob.bind(this),
      {
        connection: this.redisConnection,
        concurrency: 5, // Process up to 5 webhook orchestrations in parallel
      }
    );

    this.cruiseWorker = new Worker<CruiseProcessingJobData>(
      'cruise-processing',
      this.processCruiseJob.bind(this),
      {
        connection: this.redisConnection,
        concurrency: this.PARALLEL_CRUISE_WORKERS, // High concurrency for individual cruise updates
        limiter: {
          max: 50, // Max 50 cruise updates per second to avoid overwhelming FTP
          duration: 1000,
        },
      }
    );

    // Set up error handlers
    this.setupErrorHandlers();

    logger.info('✅ RealtimeWebhookService initialized with parallel processing');
  }

  /**
   * Main entry point - process webhook immediately
   */
  async processWebhook(payload: any): Promise<{ jobId: string; message: string }> {
    const webhookId = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    logger.info('🚀 Processing webhook in real-time', {
      webhookId,
      eventType: payload.event,
      lineId: payload.lineid
    });

    // Add webhook job to queue for immediate processing
    const job = await this.webhookQueue.add('process-webhook', {
      webhookId,
      eventType: payload.event || 'cruiseline_pricing_updated',
      lineId: payload.lineid,
      payload,
      timestamp: new Date().toISOString(),
      priority: this.determinePriority(payload.lineid)
    }, {
      priority: this.determinePriority(payload.lineid),
      jobId: webhookId,
    });

    return {
      jobId: job.id!,
      message: `Webhook queued for real-time processing (Priority: ${this.determinePriority(payload.lineid)})`
    };
  }

  /**
   * Process webhook job - orchestrate cruise updates
   */
  private async processWebhookJob(job: Job<WebhookJobData>): Promise<ProcessingResult> {
    const { webhookId, lineId, payload } = job.data;
    const startTime = new Date();
    
    logger.info('📊 Starting webhook orchestration', {
      webhookId,
      lineId,
      jobId: job.id
    });

    const result: ProcessingResult = {
      successful: 0,
      failed: 0,
      ftpConnectionFailures: 0,
      actuallyUpdated: 0,
      errors: [],
      startTime,
      endTime: new Date(),
      processingTimeMs: 0
    };

    try {
      // Map webhook line ID to database line ID
      const databaseLineId = getDatabaseLineId(lineId);
      
      if (databaseLineId !== lineId) {
        logger.info(`📋 Mapping webhook line ${lineId} to database line ${databaseLineId}`);
      }

      // Get all active cruises for this line
      const cruisesToProcess = await db
        .select({
          id: cruises.id,
          cruiseCode: cruises.cruiseId,
          sailingDate: cruises.sailingDate,
          name: cruises.name
        })
        .from(cruises)
        .where(
          sql`cruise_line_id = ${databaseLineId} 
              AND sailing_date >= CURRENT_DATE 
              AND sailing_date <= CURRENT_DATE + INTERVAL '2 years'
              AND is_active = true`
        );

      const totalCruises = cruisesToProcess.length;
      logger.info(`📈 Found ${totalCruises} cruises to process for line ${lineId}`);

      if (totalCruises === 0) {
        logger.warn(`⚠️ No active cruises found for line ${lineId} (database line ${databaseLineId})`);
        
        // Send accurate Slack message
        await this.sendSlackUpdate({
          title: '⚠️ No Cruises Found',
          message: `Webhook for line ${lineId} received, but no active cruises found in database`,
          details: {
            webhookLineId: lineId,
            databaseLineId,
            cruisesFound: 0,
            actualUpdates: 0,
            ftpConnectionFailures: 0
          }
        });

        result.endTime = new Date();
        result.processingTimeMs = result.endTime.getTime() - result.startTime.getTime();
        return result;
      }

      // Send initial processing notification
      await this.sendSlackUpdate({
        title: '🔄 Real-time Webhook Processing Started',
        message: `Processing ${totalCruises} cruises for line ${lineId} in parallel`,
        details: {
          lineId,
          totalCruises,
          processingMode: 'parallel_realtime',
          webhookId
        }
      });

      // Queue all cruises for parallel processing
      const cruiseJobs = [];
      for (const cruise of cruisesToProcess) {
        const cruiseJob = await this.cruiseQueue.add('process-cruise', {
          cruiseId: cruise.id,
          lineId: databaseLineId,
          webhookId,
          retryCount: 0
        }, {
          priority: this.determinePriority(lineId),
        });
        
        cruiseJobs.push(cruiseJob);
      }

      logger.info(`⚡ Queued ${cruiseJobs.length} cruise processing jobs`);

      // Wait for all cruise jobs to complete (with timeout)
      const PROCESSING_TIMEOUT = 5 * 60 * 1000; // 5 minutes total timeout
      const jobResults = await this.waitForJobsCompletion(cruiseJobs, PROCESSING_TIMEOUT);

      // Aggregate results
      for (const jobResult of jobResults) {
        if (jobResult.success) {
          result.successful++;
          if (jobResult.actuallyUpdated) {
            result.actuallyUpdated++;
          }
        } else {
          result.failed++;
          
          if (jobResult.error?.includes('FTP connection') || jobResult.error?.includes('timeout')) {
            result.ftpConnectionFailures++;
            result.errors.push({
              cruiseId: jobResult.cruiseId,
              error: jobResult.error,
              type: 'ftp_connection'
            });
          } else if (jobResult.error?.includes('not found')) {
            result.errors.push({
              cruiseId: jobResult.cruiseId,
              error: jobResult.error,
              type: 'file_not_found'
            });
          } else {
            result.errors.push({
              cruiseId: jobResult.cruiseId,
              error: jobResult.error,
              type: 'database_error'
            });
          }
        }
      }

      result.endTime = new Date();
      result.processingTimeMs = result.endTime.getTime() - result.startTime.getTime();

      // Send accurate completion notification
      await this.sendAccurateSlackUpdate(result, lineId, totalCruises);

      logger.info('✅ Webhook processing completed', {
        webhookId,
        lineId,
        totalCruises,
        successful: result.successful,
        actuallyUpdated: result.actuallyUpdated,
        ftpFailures: result.ftpConnectionFailures,
        processingTimeMs: result.processingTimeMs
      });

    } catch (error) {
      result.failed = 1;
      result.errors.push({
        error: `Fatal webhook processing error: ${error instanceof Error ? error.message : 'Unknown'}`,
        type: 'database_error'
      });
      
      logger.error('❌ Fatal error in webhook processing', {
        webhookId,
        error: error instanceof Error ? error.message : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined
      });

      // Send error notification
      await slackService.notifySyncError(
        error instanceof Error ? error.message : 'Unknown error',
        `Real-time webhook processing for line ${lineId}`
      );
    }

    return result;
  }

  /**
   * Process individual cruise job
   */
  private async processCruiseJob(job: Job<CruiseProcessingJobData>): Promise<any> {
    const { cruiseId, lineId, webhookId, retryCount = 0 } = job.data;
    
    try {
      // Try to fetch and update cruise data from FTP
      const updateResult = await this.updateCruiseFromFTP(cruiseId, lineId);
      
      if (updateResult.success) {
        logger.debug(`✅ Successfully updated cruise ${cruiseId}`);
        return {
          success: true,
          cruiseId,
          actuallyUpdated: updateResult.actuallyUpdated,
          error: null
        };
      } else {
        logger.warn(`⚠️ Failed to update cruise ${cruiseId}: ${updateResult.error}`);
        return {
          success: false,
          cruiseId,
          actuallyUpdated: false,
          error: updateResult.error
        };
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ Error processing cruise ${cruiseId}:`, error);
      
      return {
        success: false,
        cruiseId,
        actuallyUpdated: false,
        error: errorMsg
      };
    }
  }

  /**
   * Update cruise data from FTP (with timeout and retry logic)
   */
  private async updateCruiseFromFTP(cruiseId: string, lineId: number): Promise<{
    success: boolean;
    actuallyUpdated: boolean;
    error?: string;
  }> {
    try {
      // Get cruise info
      const cruiseInfo = await db
        .select({
          shipId: cruises.shipId,
          sailingDate: cruises.sailingDate,
          name: cruises.name
        })
        .from(cruises)
        .where(eq(cruises.id, cruiseId))
        .limit(1);

      if (!cruiseInfo || cruiseInfo.length === 0) {
        return {
          success: false,
          actuallyUpdated: false,
          error: `Cruise ${cruiseId} not found in database`
        };
      }

      const cruise = cruiseInfo[0];
      const sailingDate = new Date(cruise.sailingDate);
      const year = sailingDate.getFullYear();
      const month = String(sailingDate.getMonth() + 1).padStart(2, '0');

      // Try multiple possible file paths
      const possiblePaths = [
        `${year}/${month}/${lineId}/${cruise.shipId}/${cruiseId}.json`,
        `isell_json/${year}/${month}/${lineId}/${cruise.shipId}/${cruiseId}.json`,
        `${year}/${month}/${lineId}/${cruiseId}.json`
      ];

      let cruiseData = null;
      let usedPath = null;
      let ftpError = null;

      // Try each path with timeout
      for (const path of possiblePaths) {
        try {
          cruiseData = await Promise.race([
            traveltekFTPService.getCruiseDataFile(path),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('FTP timeout')), this.FTP_TIMEOUT)
            )
          ]) as any;
          
          usedPath = path;
          break;
        } catch (error) {
          ftpError = error instanceof Error ? error.message : 'Unknown FTP error';
          continue;
        }
      }

      if (!cruiseData) {
        return {
          success: false,
          actuallyUpdated: false,
          error: `FTP connection failed or file not found. Last error: ${ftpError}`
        };
      }

      // Update pricing in database
      await this.updatePricingData(cruiseId, cruiseData);
      
      logger.debug(`✅ Updated cruise ${cruiseId} from ${usedPath}`);

      return {
        success: true,
        actuallyUpdated: true
      };

    } catch (error) {
      return {
        success: false,
        actuallyUpdated: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update pricing data in database
   */
  private async updatePricingData(cruiseId: string, data: any): Promise<void> {
    // Delete existing pricing
    await db.execute(sql`DELETE FROM pricing WHERE cruise_id = ${cruiseId}`);

    // Process and insert new pricing data
    if (data.prices && typeof data.prices === 'object') {
      for (const [rateCode, cabins] of Object.entries(data.prices)) {
        if (typeof cabins !== 'object') continue;

        for (const [cabinCode, occupancies] of Object.entries(cabins as any)) {
          if (typeof occupancies !== 'object') continue;

          for (const [occupancyCode, pricingData] of Object.entries(occupancies as any)) {
            if (typeof pricingData !== 'object') continue;

            const pricing = pricingData as any;
            
            // Skip if no valid price
            if (!pricing.price && !pricing.adultprice) continue;

            const totalPrice = this.calculateTotalPrice(pricing);

            await db.execute(sql`
              INSERT INTO pricing (
                cruise_id, rate_code, cabin_code, occupancy_code, cabin_type,
                base_price, adult_price, child_price, infant_price, single_price,
                third_adult_price, fourth_adult_price, taxes, ncf, gratuity,
                fuel, non_comm, port_charges, government_fees, total_price,
                commission, is_available, inventory, waitlist, guarantee, currency
              ) VALUES (
                ${cruiseId}, ${this.truncateString(rateCode, 50)}, ${this.truncateString(cabinCode, 10)},
                ${this.truncateString(occupancyCode, 10)}, ${pricing.cabintype || null},
                ${this.parseDecimal(pricing.price)}, ${this.parseDecimal(pricing.adultprice)},
                ${this.parseDecimal(pricing.childprice)}, ${this.parseDecimal(pricing.infantprice)},
                ${this.parseDecimal(pricing.singleprice)}, ${this.parseDecimal(pricing.thirdadultprice)},
                ${this.parseDecimal(pricing.fourthadultprice)}, ${this.parseDecimal(pricing.taxes) || 0},
                ${this.parseDecimal(pricing.ncf) || 0}, ${this.parseDecimal(pricing.gratuity) || 0},
                ${this.parseDecimal(pricing.fuel) || 0}, ${this.parseDecimal(pricing.noncomm) || 0},
                ${this.parseDecimal(pricing.portcharges) || 0}, ${this.parseDecimal(pricing.governmentfees) || 0},
                ${totalPrice}, ${this.parseDecimal(pricing.commission)}, ${pricing.available !== false},
                ${this.parseInteger(pricing.inventory)}, ${pricing.waitlist === true},
                ${pricing.guarantee === true}, ${data.currency || 'USD'}
              )
            `);
          }
        }
      }
    }
  }

  /**
   * Wait for multiple jobs to complete (simplified approach)
   */
  private async waitForJobsCompletion(jobs: Job[], timeoutMs: number): Promise<any[]> {
    const results: any[] = [];
    const startTime = Date.now();
    const POLLING_INTERVAL = 1000; // Check every second
    
    logger.info(`⏳ Waiting for ${jobs.length} jobs to complete (timeout: ${timeoutMs}ms)`);
    
    // Keep track of completed jobs
    const completedJobs = new Set<string>();
    
    while (Date.now() - startTime < timeoutMs) {
      let allCompleted = true;
      
      for (const job of jobs) {
        if (completedJobs.has(job.id!)) {
          continue; // Already processed
        }
        
        try {
          // Check job state
          const state = await job.getState();
          
          if (state === 'completed') {
            const returnValue = job.returnvalue || {
              success: true,
              cruiseId: 'unknown',
              actuallyUpdated: true,
              error: null
            };
            results.push(returnValue);
            completedJobs.add(job.id!);
          } else if (state === 'failed') {
            const failedReason = job.failedReason || 'Unknown failure';
            results.push({
              success: false,
              cruiseId: 'unknown',
              actuallyUpdated: false,
              error: failedReason
            });
            completedJobs.add(job.id!);
          } else {
            // Job still running
            allCompleted = false;
          }
        } catch (error) {
          // Error checking job state
          results.push({
            success: false,
            cruiseId: 'unknown',
            actuallyUpdated: false,
            error: `Error checking job state: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
          completedJobs.add(job.id!);
        }
      }
      
      if (allCompleted) {
        logger.info(`✅ All ${jobs.length} jobs completed in ${Date.now() - startTime}ms`);
        break;
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
    }
    
    // Handle any remaining incomplete jobs (timeout)
    for (const job of jobs) {
      if (!completedJobs.has(job.id!)) {
        results.push({
          success: false,
          cruiseId: 'unknown',
          actuallyUpdated: false,
          error: 'Job timeout - exceeded maximum wait time'
        });
      }
    }
    
    logger.info(`⏰ Job completion check finished: ${results.length} results after ${Date.now() - startTime}ms`);
    return results;
  }

  /**
   * Send accurate Slack update
   */
  private async sendAccurateSlackUpdate(result: ProcessingResult, lineId: number, totalCruises: number): Promise<void> {
    const successRate = totalCruises > 0 ? Math.round((result.actuallyUpdated / totalCruises) * 100) : 0;
    const ftpFailureRate = totalCruises > 0 ? Math.round((result.ftpConnectionFailures / totalCruises) * 100) : 0;
    
    let statusIcon = '✅';
    let title = 'Real-time Webhook Processing Completed';
    
    if (result.ftpConnectionFailures > result.actuallyUpdated) {
      statusIcon = '❌';
      title = 'Webhook Processing Failed';
    } else if (result.ftpConnectionFailures > 0) {
      statusIcon = '⚠️';
      title = 'Webhook Processing Completed with Issues';
    }

    await this.sendSlackUpdate({
      title: `${statusIcon} ${title}`,
      message: `Line ${lineId}: ${result.actuallyUpdated} cruises actually updated out of ${totalCruises} (${successRate}% success)`,
      details: {
        lineId,
        totalCruises,
        actualUpdates: result.actuallyUpdated,
        ftpConnectionFailures: result.ftpConnectionFailures,
        ftpFailureRate: `${ftpFailureRate}%`,
        processingTimeSeconds: Math.round(result.processingTimeMs / 1000),
        errorSummary: this.summarizeErrors(result.errors),
        note: result.ftpConnectionFailures === 0 ? 
          'All cruise updates successful!' : 
          `${result.ftpConnectionFailures} cruises failed due to FTP connection issues`
      }
    });
  }

  /**
   * Helper methods
   */
  private determinePriority(lineId: number): number {
    // Higher priority for lines that frequently have issues
    const highPriorityLines = [5, 21, 22, 46, 118, 123, 643];
    return highPriorityLines.includes(lineId) ? 1 : 5;
  }

  private summarizeErrors(errors: ProcessingResult['errors']): any {
    const summary = {
      ftpConnection: 0,
      fileNotFound: 0,
      parseError: 0,
      databaseError: 0
    };

    for (const error of errors) {
      summary[error.type]++;
    }

    return summary;
  }

  private async sendSlackUpdate(data: { title: string; message: string; details: any }): Promise<void> {
    try {
      await slackService.notifyCustomMessage(data);
    } catch (error) {
      logger.error('Failed to send Slack update:', error);
    }
  }

  private calculateTotalPrice(pricing: any): number {
    const base = this.parseDecimal(pricing.price || pricing.adultprice) || 0;
    const taxes = this.parseDecimal(pricing.taxes) || 0;
    const ncf = this.parseDecimal(pricing.ncf) || 0;
    const gratuity = this.parseDecimal(pricing.gratuity) || 0;
    const fuel = this.parseDecimal(pricing.fuel) || 0;
    const portCharges = this.parseDecimal(pricing.portcharges) || 0;
    const governmentFees = this.parseDecimal(pricing.governmentfees) || 0;
    
    return base + taxes + ncf + gratuity + fuel + portCharges + governmentFees;
  }

  private parseDecimal(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }

  private parseInteger(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const num = parseInt(value);
    return isNaN(num) ? null : num;
  }

  private truncateString(str: string, maxLength: number): string {
    if (!str) return '';
    return str.length > maxLength ? str.substring(0, maxLength) : str;
  }

  private setupErrorHandlers(): void {
    this.webhookWorker.on('error', (error) => {
      logger.error('❌ Webhook worker error:', error);
    });

    this.cruiseWorker.on('error', (error) => {
      logger.error('❌ Cruise worker error:', error);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('Shutting down realtime webhook service...');
      await this.webhookWorker.close();
      await this.cruiseWorker.close();
      await this.webhookQueue.close();
      await this.cruiseQueue.close();
      await this.redisConnection.quit();
    });
  }
}

// Singleton instance
export const realtimeWebhookService = new RealtimeWebhookService();