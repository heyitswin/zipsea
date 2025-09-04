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
import { improvedFTPService } from './improved-ftp.service';
import { bulkFtpDownloader } from './bulk-ftp-downloader.service';
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
  batchNumber?: number;
  totalBatches?: number;
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
  
  // Track recent webhooks to prevent duplicates
  private recentWebhooks = new Map<string, Date>();
  private readonly DUPLICATE_PREVENTION_WINDOW = 5 * 60 * 1000; // 5 minutes
  
  private readonly MAX_RETRIES = 3;
  private readonly FTP_TIMEOUT = 30000; // 30 seconds - increased from 15s
  private readonly PARALLEL_CRUISE_WORKERS = 5; // Reduced from 10 to 5 to avoid overwhelming FTP
  private readonly BATCH_SIZE = 50; // Process cruises in batches of 50
  private readonly MAX_CRUISES_PER_WEBHOOK = 0; // Disabled - now we use bulk FTP downloader
  private readonly MAX_CRUISES_PER_MEGA_BATCH = 500; // Process mega batches of 500 to prevent FTP overload
  private readonly USE_BULK_DOWNLOADER = true; // Enable bulk FTP downloader for all cruise lines

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
        concurrency: this.PARALLEL_CRUISE_WORKERS, // Reduced concurrency to avoid FTP overload
        limiter: {
          max: 10, // Max 10 cruise updates per second - significantly reduced
          duration: 1000,
        },
      }
    );

    // Set up error handlers
    this.setupErrorHandlers();

    logger.info('✅ RealtimeWebhookService initialized', {
      useBulkDownloader: this.USE_BULK_DOWNLOADER,
      maxCruisesPerMegaBatch: this.MAX_CRUISES_PER_MEGA_BATCH,
      parallelCruiseWorkers: this.PARALLEL_CRUISE_WORKERS,
      optimization: this.USE_BULK_DOWNLOADER ? 'Bulk FTP Downloader enabled - optimized for large cruise lines' : 'Legacy individual processing'
    });
  }

  /**
   * Main entry point - process webhook immediately
   */
  async processWebhook(payload: any): Promise<{ jobId: string; message: string }> {
    const webhookId = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const duplicateKey = `line_${payload.lineid}`;
    
    // Check for duplicate webhooks
    const now = new Date();
    const lastProcessed = this.recentWebhooks.get(duplicateKey);
    
    if (lastProcessed && (now.getTime() - lastProcessed.getTime()) < this.DUPLICATE_PREVENTION_WINDOW) {
      const timeSinceLastMs = now.getTime() - lastProcessed.getTime();
      const timeSinceLastSec = Math.round(timeSinceLastMs / 1000);
      
      logger.warn('🔄 Duplicate webhook detected - ignoring', {
        webhookId,
        lineId: payload.lineid,
        timeSinceLastProcessing: `${timeSinceLastSec}s`,
        lastProcessedAt: lastProcessed.toISOString()
      });
      
      return {
        jobId: `duplicate_${webhookId}`,
        message: `Duplicate webhook ignored - Line ${payload.lineid} processed ${timeSinceLastSec}s ago`
      };
    }
    
    // Clean up old entries
    this.cleanupOldWebhookEntries();
    
    // Record this webhook
    this.recentWebhooks.set(duplicateKey, now);
    
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

      // Get all active cruises for this line using the bulk downloader
      let cruisesToProcess;
      
      if (this.USE_BULK_DOWNLOADER) {
        // Use bulk FTP downloader to get cruise information (with mega-batch limit)
        cruisesToProcess = await bulkFtpDownloader.getCruiseInfoForLine(databaseLineId, this.MAX_CRUISES_PER_MEGA_BATCH);
        logger.info(`📈 Using bulk FTP downloader for ${cruisesToProcess.length} cruises (line ${lineId})`);
      } else {
        // Legacy individual processing (fallback only)
        const legacyCruises = await db
          .select({
            id: cruises.id,
            cruiseCode: cruises.cruiseId,
            sailingDate: cruises.sailingDate,
            name: cruises.name
          })
          .from(cruises)
          .where(
            sql`${cruises.cruiseLineId} = ${databaseLineId} 
                AND ${cruises.sailingDate} >= CURRENT_DATE 
                AND ${cruises.sailingDate} <= CURRENT_DATE + INTERVAL '2 years'
                AND ${cruises.isActive} = true`
          );
        cruisesToProcess = legacyCruises.map(c => ({
          id: c.id,
          cruiseCode: c.cruiseCode,
          shipName: 'Unknown_Ship',
          sailingDate: new Date(c.sailingDate)
        }));
        logger.warn(`⚠️ Using legacy individual processing for ${cruisesToProcess.length} cruises (line ${lineId})`);
      }

      const totalCruises = cruisesToProcess.length;
      logger.info(`📈 Found ${totalCruises} cruises to process for line ${lineId}`);

      // Handle large cruise lines with mega-batching
      if (totalCruises > this.MAX_CRUISES_PER_MEGA_BATCH) {
        logger.warn(`⚠️ Large cruise line detected: ${totalCruises} cruises for line ${lineId}. Will process in mega-batches of ${this.MAX_CRUISES_PER_MEGA_BATCH}`, {
          webhookId,
          lineId,
          totalCruises,
          megaBatchSize: this.MAX_CRUISES_PER_MEGA_BATCH
        });
        
        const megaBatches = Math.ceil(totalCruises / this.MAX_CRUISES_PER_MEGA_BATCH);
        
        await this.sendSlackUpdate({
          title: '📦 Large Cruise Line Detected - Using Mega-Batching',
          message: `${this.getCruiseLineName(databaseLineId)} (Line ${lineId}): ${totalCruises} cruises will be processed in ${megaBatches} mega-batches to prevent FTP overload`,
          details: {
            cruiseLine: this.getCruiseLineName(databaseLineId),
            webhookLineId: lineId,
            databaseLineId,
            totalCruises,
            megaBatches,
            cruisesPerBatch: this.MAX_CRUISES_PER_MEGA_BATCH,
            ftpConnections: `${megaBatches} (vs ${totalCruises} without batching)`,
            estimatedTime: `${Math.round((totalCruises * 0.3) / 60)}-${Math.round((totalCruises * 0.5) / 60)} minutes`,
            processingStrategy: 'Persistent FTP connections with bulk downloads'
          }
        });
      }

      if (totalCruises === 0) {
        logger.warn(`⚠️ No active cruises found for line ${lineId} (database line ${databaseLineId})`);
        
        // Send accurate Slack message
        await this.sendSlackUpdate({
          title: '⚠️ No Active Cruises to Update',
          message: `${this.getCruiseLineName(databaseLineId)} webhook received but no future departures found`,
          details: {
            cruiseLine: this.getCruiseLineName(databaseLineId),
            webhookLineId: lineId,
            databaseLineId,
            reason: 'All cruises have sailed or are inactive',
            action: 'No processing needed'
          }
        });

        result.endTime = new Date();
        result.processingTimeMs = result.endTime.getTime() - result.startTime.getTime();
        return result;
      }

      // Send initial processing notification
      await this.sendSlackUpdate({
        title: '🚀 Bulk FTP Download Started',
        message: `${this.getCruiseLineName(databaseLineId)}: Bulk downloading ${totalCruises} cruise files using ${this.USE_BULK_DOWNLOADER ? 'optimized' : 'legacy'} method`,
        details: {
          cruiseLine: this.getCruiseLineName(databaseLineId),
          webhookLineId: lineId,
          databaseLineId,
          totalCruises,
          processingMethod: this.USE_BULK_DOWNLOADER ? 'Bulk FTP Downloader (3-5 persistent connections)' : 'Individual FTP connections',
          maxConnectionsUsed: this.USE_BULK_DOWNLOADER ? '3-5 persistent connections' : `${totalCruises} individual connections`,
          estimatedDuration: this.USE_BULK_DOWNLOADER ? 
            `${Math.round((totalCruises * 0.1) / 60)}-${Math.round((totalCruises * 0.2) / 60)} minutes (bulk optimized)` :
            `${Math.round((totalCruises * 0.3) / 60)}-${Math.round((totalCruises * 0.5) / 60)} minutes (individual)`,
          webhookId,
          timestamp: new Date().toISOString(),
          optimization: this.USE_BULK_DOWNLOADER ? '✅ Using bulk download optimization - much faster!' : '⚠️ Using legacy method'
        }
      });

      if (this.USE_BULK_DOWNLOADER) {
        // Use bulk FTP downloader - download ALL files first, then process from memory
        logger.info(`🚀 Starting bulk FTP download for ${totalCruises} cruises (line ${lineId})`);
        
        try {
          // Bulk download all files using persistent FTP connections
          const downloadResult = await bulkFtpDownloader.downloadLineUpdates(databaseLineId, cruisesToProcess);
          
          logger.info(`📊 Bulk download completed`, {
            lineId,
            totalFiles: downloadResult.totalFiles,
            successful: downloadResult.successfulDownloads,
            failed: downloadResult.failedDownloads,
            duration: `${(downloadResult.duration / 1000).toFixed(2)}s`,
            successRate: `${Math.round((downloadResult.successfulDownloads / downloadResult.totalFiles) * 100)}%`,
            ftpConnectionFailures: downloadResult.connectionFailures
          });
          
          // Process all downloaded data from memory (no FTP connections needed)
          const processingResult = await bulkFtpDownloader.processCruiseUpdates(databaseLineId, downloadResult);
          
          // Map bulk results to standard format
          result.successful = processingResult.successful;
          result.failed = processingResult.failed + downloadResult.failedDownloads;
          result.actuallyUpdated = processingResult.actuallyUpdated;
          result.ftpConnectionFailures = downloadResult.connectionFailures;
          
          // Convert download errors to standard format
          for (const error of downloadResult.errors) {
            if (error.includes('FTP connection') || error.includes('timeout') || error.includes('connection')) {
              result.errors.push({
                error,
                type: 'ftp_connection'
              });
            } else if (error.includes('not found') || error.includes('404')) {
              result.errors.push({
                error,
                type: 'file_not_found'
              });
            } else {
              result.errors.push({
                error,
                type: 'parse_error'
              });
            }
          }
          
          // Add processing errors
          for (const error of processingResult.errors) {
            result.errors.push({
              error,
              type: 'database_error'
            });
          }
          
          logger.info(`✅ Bulk processing completed`, {
            lineId,
            totalProcessed: downloadResult.downloadedData.size,
            databaseUpdates: processingResult.actuallyUpdated,
            processingErrors: processingResult.errors.length
          });
          
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown bulk download error';
          logger.error(`❌ Bulk FTP download failed for line ${lineId}:`, error);
          
          result.failed = totalCruises;
          result.errors.push({
            error: `Bulk download failed: ${errorMsg}`,
            type: 'ftp_connection'
          });
          
          // Fallback notification
          await this.sendSlackUpdate({
            title: '🔴 Bulk FTP Download Failed',
            message: `${this.getCruiseLineName(databaseLineId)}: Bulk download failed - ${errorMsg}`,
            details: {
              cruiseLine: this.getCruiseLineName(databaseLineId),
              error: errorMsg,
              fallbackAction: 'Consider using legacy individual processing',
              affectedCruises: totalCruises
            }
          });
        }
        
      } else {
        // Legacy fallback - individual cruise processing (should rarely be used)
        logger.warn(`⚠️ Using legacy individual cruise processing for line ${lineId}`);
        
        const cruiseJobs = [];
        
        // Process cruises individually (old method)
        for (const cruise of cruisesToProcess) {
          const cruiseJob = await this.cruiseQueue.add('process-cruise', {
            cruiseId: cruise.id,
            lineId: databaseLineId,
            webhookId,
            retryCount: 0
          }, {
            priority: this.determinePriority(lineId),
            delay: cruiseJobs.length * 100, // Stagger to avoid FTP overload
          });
          
          cruiseJobs.push(cruiseJob);
        }

        logger.info(`⚡ Queued ${cruiseJobs.length} individual cruise jobs`);

        // Wait for all jobs to complete
        const PROCESSING_TIMEOUT = Math.max(10 * 60 * 1000, cruiseJobs.length * 2000); // Longer timeout for individual processing
        logger.info(`⏱️ Using timeout of ${Math.round(PROCESSING_TIMEOUT / 1000)}s for ${cruiseJobs.length} individual cruise jobs`);
        const jobResults = await this.waitForJobsCompletion(cruiseJobs, PROCESSING_TIMEOUT);

        // Aggregate results from individual jobs
        for (const jobResult of jobResults) {
          if (jobResult.success) {
            result.successful++;
            if (jobResult.actuallyUpdated) {
              result.actuallyUpdated++;
            }
          } else {
            result.failed++;
            
            const errorMessage = this.formatErrorMessage(jobResult.error);
            
            if (errorMessage.includes('FTP connection') || 
                errorMessage.includes('timeout') || 
                errorMessage.includes('ECONNREFUSED') ||
                errorMessage.includes('ENOTFOUND') ||
                errorMessage.includes('connection closed')) {
              result.ftpConnectionFailures++;
              result.errors.push({
                cruiseId: jobResult.cruiseId,
                error: errorMessage,
                type: 'ftp_connection'
              });
            } else if (errorMessage.includes('not found') || errorMessage.includes('404')) {
              result.errors.push({
                cruiseId: jobResult.cruiseId,
                error: errorMessage,
                type: 'file_not_found'
              });
            } else {
              result.errors.push({
                cruiseId: jobResult.cruiseId,
                error: errorMessage,
                type: 'database_error'
              });
            }
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

      // Try each path with improved FTP service (circuit breaker + pooling)
      for (const path of possiblePaths) {
        try {
          cruiseData = await improvedFTPService.getCruiseDataFile(path);
          usedPath = path;
          break;
        } catch (error) {
          const formattedError = this.formatErrorMessage(error);
          ftpError = `Path ${path}: ${formattedError}`;
          logger.debug(`❌ FTP path ${path} failed: ${formattedError}`);
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
   * Send accurate Slack update with bulk processing details
   */
  private async sendAccurateSlackUpdate(result: ProcessingResult, lineId: number, totalCruises: number): Promise<void> {
    const successRate = totalCruises > 0 ? Math.round((result.actuallyUpdated / totalCruises) * 100) : 0;
    const ftpFailureRate = totalCruises > 0 ? Math.round((result.ftpConnectionFailures / totalCruises) * 100) : 0;
    const databaseLineId = getDatabaseLineId(lineId);
    
    let statusIcon = '✅';
    let title = 'Bulk FTP Processing Complete';
    let statusDescription = 'Successfully bulk downloaded and updated pricing';
    
    if (result.ftpConnectionFailures > result.actuallyUpdated) {
      statusIcon = '🔴';
      title = 'Bulk FTP Processing Failed';
      statusDescription = 'Failed to bulk download pricing from FTP';
    } else if (successRate < 50) {
      statusIcon = '🟡';
      title = 'Bulk FTP Processing Partially Complete';
      statusDescription = 'Some pricing updates failed during bulk processing';
    } else if (result.ftpConnectionFailures > 0) {
      statusIcon = '🟢';
      title = 'Bulk FTP Processing Complete';
      statusDescription = 'Most pricing updated successfully via bulk download';
    }

    const processingMinutes = Math.round(result.processingTimeMs / 60000);
    const processingSeconds = Math.round((result.processingTimeMs % 60000) / 1000);
    const timeString = processingMinutes > 0 ? `${processingMinutes}m ${processingSeconds}s` : `${processingSeconds}s`;

    await this.sendSlackUpdate({
      title: `${statusIcon} ${title}`,
      message: `${this.getCruiseLineName(databaseLineId)}: ${statusDescription}. ${result.actuallyUpdated}/${totalCruises} cruises updated (${successRate}%)`,
      details: {
        cruiseLine: this.getCruiseLineName(databaseLineId),
        webhookLineId: lineId,
        databaseLineId,
        totalCruises,
        cruisesUpdated: result.actuallyUpdated,
        cruisesUnchanged: result.successful - result.actuallyUpdated,
        ftpDownloadsFailed: result.ftpConnectionFailures,
        successRate: `${successRate}%`,
        ftpFailureRate: `${ftpFailureRate}%`,
        processingTime: timeString,
        throughput: `${Math.round(totalCruises / (result.processingTimeMs / 1000))} cruises/second`,
        processingMethod: this.USE_BULK_DOWNLOADER ? 'Bulk FTP Downloader' : 'Legacy Individual Processing',
        ftpConnectionsUsed: this.USE_BULK_DOWNLOADER ? '3-5 persistent connections' : `${totalCruises} individual connections`,
        optimization: this.USE_BULK_DOWNLOADER ? '🚀 Bulk download optimization used - much faster and more reliable!' : '⚠️ Legacy method used',
        errorBreakdown: this.summarizeErrors(result.errors),
        timestamp: new Date().toISOString(),
        result: result.ftpConnectionFailures === 0 ? 
          '✅ All pricing data successfully synchronized via bulk download' : 
          result.ftpConnectionFailures > totalCruises * 0.5 ?
          '❌ FTP server issues prevented most bulk downloads' :
          `⚠️ ${result.ftpConnectionFailures} cruises could not be downloaded during bulk operation`
      }
    });
  }

  /**
   * Helper methods
   */
  private getCruiseLineName(lineId: number): string {
    const cruiseLineNames: Record<number, string> = {
      1: 'P&O Cruises',
      3: 'Celebrity Cruises',
      5: 'Cunard',
      8: 'Carnival',
      9: 'Costa Cruises',
      10: 'Crystal Cruises',
      16: 'Holland America',
      21: 'Virgin Voyages',
      22: 'Royal Caribbean',
      41: 'American Cruise Lines',
      46: 'Princess Cruises',
      62: 'MSC Cruises',
      63: 'AmaWaterways',
      66: 'Silversea',
      91: 'Oceania Cruises',
      118: 'Disney Cruise Line',
      123: 'Norwegian Cruise Line',
      186: 'AIDA',
      643: 'Regent Seven Seas',
      848: 'Ambassador Cruise Line'
    };
    return cruiseLineNames[lineId] || `Line ${lineId}`;
  }
  
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

  /**
   * Format error message to avoid [object Object] display
   */
  private formatErrorMessage(error: any): string {
    if (!error) return 'Unknown error';
    
    if (typeof error === 'string') {
      return error;
    }
    
    if (error instanceof Error) {
      return error.message;
    }
    
    if (typeof error === 'object') {
      // Try to extract meaningful information from error object
      if (error.message) return error.message;
      if (error.code) return `Error code: ${error.code}`;
      if (error.name) return `${error.name}: ${error.message || 'Unknown'}`;
      
      // Last resort - stringify but make it readable
      try {
        return JSON.stringify(error);
      } catch {
        return String(error);
      }
    }
    
    return String(error);
  }

  /**
   * Clean up old webhook entries to prevent memory leaks
   */
  /**
   * Configuration and utility methods
   */
  getProcessingStats(): {
    useBulkDownloader: boolean;
    maxCruisesPerMegaBatch: number;
    parallelCruiseWorkers: number;
    bulkDownloaderStats: any;
  } {
    return {
      useBulkDownloader: this.USE_BULK_DOWNLOADER,
      maxCruisesPerMegaBatch: this.MAX_CRUISES_PER_MEGA_BATCH,
      parallelCruiseWorkers: this.PARALLEL_CRUISE_WORKERS,
      bulkDownloaderStats: this.USE_BULK_DOWNLOADER ? bulkFtpDownloader.getStats() : null
    };
  }

  /**
   * Manual circuit breaker reset for bulk FTP downloader
   */
  resetBulkDownloaderCircuitBreaker(): void {
    if (this.USE_BULK_DOWNLOADER) {
      bulkFtpDownloader.resetCircuitBreaker();
      logger.info('🔄 Manually reset bulk FTP downloader circuit breaker via webhook service');
    } else {
      logger.warn('⚠️ Bulk FTP downloader not enabled - cannot reset circuit breaker');
    }
  }

  private cleanupOldWebhookEntries(): void {
    const now = Date.now();
    const entriesToRemove: string[] = [];
    
    for (const [key, timestamp] of this.recentWebhooks.entries()) {
      if (now - timestamp.getTime() > this.DUPLICATE_PREVENTION_WINDOW) {
        entriesToRemove.push(key);
      }
    }
    
    for (const key of entriesToRemove) {
      this.recentWebhooks.delete(key);
    }
    
    if (entriesToRemove.length > 0) {
      logger.debug(`🧹 Cleaned up ${entriesToRemove.length} old webhook entries`);
    }
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