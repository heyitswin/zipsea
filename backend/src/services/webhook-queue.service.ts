import Bull, { Queue, Job, JobOptions } from 'bull';
import { Redis } from 'ioredis';
import logger from '../config/logger';
import { traveltekWebhookService, WebhookProcessingResult, WebhookPayload } from './traveltek-webhook.service';
import { slackService } from './slack.service';

export interface WebhookJobData {
  payload: WebhookPayload;
  webhookId: string;
  timestamp: string;
  retryAttempt?: number;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

/**
 * Webhook Job Queue Service
 * Handles parallel processing of webhook notifications using Bull queue
 * Allows multiple cruise lines to be processed simultaneously
 */
export class WebhookQueueService {
  private webhookQueue: Queue<WebhookJobData>;
  private redis: Redis;
  
  private readonly QUEUE_NAME = 'webhook-processing';
  private readonly MAX_CONCURRENT_JOBS = 3; // Process up to 3 cruise lines simultaneously
  private readonly JOB_ATTEMPTS = 3;
  private readonly JOB_BACKOFF = {
    type: 'exponential',
    delay: 5000, // Start with 5 second delay
  };
  
  constructor() {
    // Initialize Redis connection
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      lazyConnect: true,
    });
    
    // Initialize Bull queue
    this.webhookQueue = new Bull<WebhookJobData>(this.QUEUE_NAME, {
      redis: {
        port: this.getRedisPort(),
        host: this.getRedisHost(),
        password: this.getRedisPassword(),
      },
      defaultJobOptions: {
        attempts: this.JOB_ATTEMPTS,
        backoff: this.JOB_BACKOFF,
        removeOnComplete: 50, // Keep last 50 completed jobs for monitoring
        removeOnFail: 100,    // Keep last 100 failed jobs for debugging
      },
      settings: {
        stalledInterval: 30 * 1000, // 30 seconds
        maxStalledCount: 1,
      },
    });
    
    this.initializeQueueProcessing();
    this.setupEventHandlers();
  }
  
  /**
   * Initialize queue processing with concurrency control
   */
  private initializeQueueProcessing(): void {
    this.webhookQueue.process(
      'cruise-line-pricing-update',
      this.MAX_CONCURRENT_JOBS,
      this.processCruiseLinePricingJob.bind(this)
    );
    
    logger.info(`🚀 Webhook queue initialized with ${this.MAX_CONCURRENT_JOBS} concurrent workers`);
  }
  
  /**
   * Setup event handlers for monitoring and logging
   */
  private setupEventHandlers(): void {
    this.webhookQueue.on('completed', (job: Job<WebhookJobData>, result: WebhookProcessingResult) => {
      logger.info('✅ Webhook job completed successfully', {
        jobId: job.id,
        webhookId: job.data.webhookId,
        lineId: job.data.payload.lineid,
        processingTimeMs: result.processingTimeMs,
        successful: result.successful,
        failed: result.failed,
        attempts: job.attemptsMade,
      });
    });
    
    this.webhookQueue.on('failed', (job: Job<WebhookJobData>, error: Error) => {
      logger.error('❌ Webhook job failed', {
        jobId: job.id,
        webhookId: job.data.webhookId,
        lineId: job.data.payload.lineid,
        error: error.message,
        attempts: job.attemptsMade,
        maxAttempts: job.opts.attempts,
        stack: error.stack,
      });
      
      // Notify Slack on final failure
      if (job.attemptsMade >= (job.opts.attempts || this.JOB_ATTEMPTS)) {
        slackService.notifySyncError(
          `Final webhook job failure: ${error.message}`,
          `Cruise line ${job.data.payload.lineid} webhook processing after ${job.attemptsMade} attempts`
        );
      }
    });
    
    this.webhookQueue.on('stalled', (job: Job<WebhookJobData>) => {
      logger.warn('⏸️ Webhook job stalled', {
        jobId: job.id,
        webhookId: job.data.webhookId,
        lineId: job.data.payload.lineid,
      });
    });
    
    this.webhookQueue.on('error', (error: Error) => {
      logger.error('❌ Queue error:', error);
    });
    
    this.webhookQueue.on('waiting', (jobId: string) => {
      logger.debug('⏳ Job waiting in queue', { jobId });
    });
    
    this.webhookQueue.on('active', (job: Job<WebhookJobData>) => {
      logger.info('🔄 Job started processing', {
        jobId: job.id,
        webhookId: job.data.webhookId,
        lineId: job.data.payload.lineid,
      });
    });
  }
  
  /**
   * Add webhook processing job to queue
   */
  async addWebhookJob(
    payload: WebhookPayload,
    webhookId: string,
    options?: JobOptions
  ): Promise<Job<WebhookJobData>> {
    const jobData: WebhookJobData = {
      payload,
      webhookId,
      timestamp: new Date().toISOString(),
    };
    
    const jobOptions: JobOptions = {
      priority: this.getJobPriority(payload.lineid),
      delay: options?.delay || 0,
      ...options,
    };
    
    const job = await this.webhookQueue.add(
      'cruise-line-pricing-update',
      jobData,
      jobOptions
    );
    
    logger.info('📦 Webhook job added to queue', {
      jobId: job.id,
      webhookId,
      lineId: payload.lineid,
      priority: jobOptions.priority,
      queueName: this.QUEUE_NAME,
    });
    
    return job;
  }
  
  /**
   * Process cruise line pricing update job
   */
  private async processCruiseLinePricingJob(
    job: Job<WebhookJobData>
  ): Promise<WebhookProcessingResult> {
    const { payload, webhookId } = job.data;
    
    logger.info('🚀 Processing cruise line pricing job', {
      jobId: job.id,
      webhookId,
      lineId: payload.lineid,
      attempt: job.attemptsMade + 1,
      maxAttempts: job.opts.attempts,
    });
    
    try {
      // Update job progress
      await job.progress(10);
      
      // Process the webhook using existing service
      const result = await traveltekWebhookService.handleStaticPricingUpdate(payload);
      
      await job.progress(100);
      
      return result;
      
    } catch (error) {
      logger.error('❌ Error in webhook job processing', {
        jobId: job.id,
        webhookId,
        lineId: payload.lineid,
        error: error instanceof Error ? error.message : 'Unknown error',
        attempt: job.attemptsMade + 1,
      });
      
      throw error;
    }
  }
  
  /**
   * Get job priority based on cruise line
   * Higher priority for major cruise lines
   */
  private getJobPriority(lineId: number): number {
    // Major cruise lines get higher priority (lower number = higher priority)
    const priorityMap: Record<number, number> = {
      1: 1,    // Royal Caribbean
      2: 2,    // Celebrity
      3: 3,    // NCL
      4: 4,    // MSC
      5: 5,    // Princess
      6: 6,    // Holland America
      7: 7,    // Carnival
      8: 8,    // Disney
      // Default priority for other lines
    };
    
    return priorityMap[lineId] || 10;
  }
  
  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<QueueStats> {
    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      this.webhookQueue.getWaiting(),
      this.webhookQueue.getActive(),
      this.webhookQueue.getCompleted(),
      this.webhookQueue.getFailed(),
      this.webhookQueue.getDelayed(),
      this.webhookQueue.isPaused(),
    ]);
    
    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      paused,
    };
  }
  
  /**
   * Get active jobs with details
   */
  async getActiveJobs(): Promise<Array<{
    id: string;
    webhookId: string;
    lineId: number;
    progress: number;
    attemptsMade: number;
    processedOn: number;
  }>> {
    const activeJobs = await this.webhookQueue.getActive();
    
    return activeJobs.map(job => ({
      id: job.id?.toString() || 'unknown',
      webhookId: job.data.webhookId,
      lineId: job.data.payload.lineid,
      progress: job.progress(),
      attemptsMade: job.attemptsMade,
      processedOn: job.processedOn || 0,
    }));
  }
  
  /**
   * Get recent completed jobs
   */
  async getRecentJobs(limit: number = 20): Promise<Array<{
    id: string;
    webhookId: string;
    lineId: number;
    finishedOn: number;
    processedOn: number;
    attemptsMade: number;
    failed: boolean;
    returnValue?: WebhookProcessingResult;
    failedReason?: string;
  }>> {
    const [completed, failed] = await Promise.all([
      this.webhookQueue.getCompleted(0, limit / 2),
      this.webhookQueue.getFailed(0, limit / 2),
    ]);
    
    const allJobs = [
      ...completed.map(job => ({ ...job, failed: false })),
      ...failed.map(job => ({ ...job, failed: true })),
    ].sort((a, b) => (b.finishedOn || 0) - (a.finishedOn || 0));
    
    return allJobs.slice(0, limit).map(job => ({
      id: job.id?.toString() || 'unknown',
      webhookId: job.data.webhookId,
      lineId: job.data.payload.lineid,
      finishedOn: job.finishedOn || 0,
      processedOn: job.processedOn || 0,
      attemptsMade: job.attemptsMade,
      failed: job.failed,
      returnValue: job.failed ? undefined : job.returnvalue,
      failedReason: job.failed ? job.failedReason : undefined,
    }));
  }
  
  /**
   * Pause queue processing
   */
  async pauseQueue(): Promise<void> {
    await this.webhookQueue.pause();
    logger.info('⏸️ Webhook queue paused');
  }
  
  /**
   * Resume queue processing
   */
  async resumeQueue(): Promise<void> {
    await this.webhookQueue.resume();
    logger.info('▶️ Webhook queue resumed');
  }
  
  /**
   * Clean old jobs from queue
   */
  async cleanQueue(): Promise<void> {
    const grace = 24 * 60 * 60 * 1000; // 24 hours
    
    await Promise.all([
      this.webhookQueue.clean(grace, 'completed'),
      this.webhookQueue.clean(grace, 'failed'),
      this.webhookQueue.clean(grace, 'active'), // Clean stalled jobs
    ]);
    
    logger.info('🧹 Queue cleaned of old jobs');
  }
  
  /**
   * Close queue connections
   */
  async close(): Promise<void> {
    await this.webhookQueue.close();
    await this.redis.disconnect();
    logger.info('🔒 Webhook queue service closed');
  }
  
  /**
   * Health check for queue service
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    redis: boolean;
    queue: boolean;
    message?: string;
  }> {
    try {
      // Check Redis connection
      await this.redis.ping();
      
      // Check queue health
      const stats = await this.getQueueStats();
      
      const healthy = !stats.paused && stats.active <= this.MAX_CONCURRENT_JOBS * 2;
      
      return {
        healthy,
        redis: true,
        queue: true,
        message: healthy ? 'All systems operational' : 'Queue may be overloaded or stalled',
      };
    } catch (error) {
      return {
        healthy: false,
        redis: false,
        queue: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  // Helper methods for Redis configuration
  private getRedisHost(): string {
    if (process.env.REDIS_URL) {
      const url = new URL(process.env.REDIS_URL);
      return url.hostname;
    }
    return 'localhost';
  }
  
  private getRedisPort(): number {
    if (process.env.REDIS_URL) {
      const url = new URL(process.env.REDIS_URL);
      return parseInt(url.port) || 6379;
    }
    return 6379;
  }
  
  private getRedisPassword(): string | undefined {
    if (process.env.REDIS_URL) {
      const url = new URL(process.env.REDIS_URL);
      return url.password || undefined;
    }
    return undefined;
  }
}

export const webhookQueueService = new WebhookQueueService();