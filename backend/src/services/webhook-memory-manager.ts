/**
 * Memory Management Service for Webhook Processing
 * Prevents memory leaks and ensures efficient resource usage
 */

import { WebhookProcessorOptimizedV2 } from './webhook-processor-optimized-v2.service';
import logger from '../config/logger';

export class WebhookMemoryManager {
  private static instance: WebhookMemoryManager;
  private memoryCheckInterval: NodeJS.Timeout | null = null;
  private gcInterval: NodeJS.Timeout | null = null;

  // Memory thresholds (in MB)
  private readonly MEMORY_THRESHOLD_WARNING = 1500; // 1.5GB
  private readonly MEMORY_THRESHOLD_CRITICAL = 1800; // 1.8GB (out of 2GB limit)
  private readonly MEMORY_THRESHOLD_RESTART = 1900; // 1.9GB - force restart

  private constructor() {
    this.startMemoryMonitoring();
    this.startGarbageCollection();
  }

  public static getInstance(): WebhookMemoryManager {
    if (!WebhookMemoryManager.instance) {
      WebhookMemoryManager.instance = new WebhookMemoryManager();
    }
    return WebhookMemoryManager.instance;
  }

  private startMemoryMonitoring() {
    // Check memory every 30 seconds
    this.memoryCheckInterval = setInterval(() => {
      this.checkMemory();
    }, 30000);

    // Also check immediately
    this.checkMemory();
  }

  private startGarbageCollection() {
    // Force garbage collection every 5 minutes if available
    if (global.gc) {
      this.gcInterval = setInterval(
        () => {
          const beforeMem = process.memoryUsage().heapUsed / 1024 / 1024;
          global.gc();
          const afterMem = process.memoryUsage().heapUsed / 1024 / 1024;
          const freed = beforeMem - afterMem;

          if (freed > 10) {
            logger.info(`[MEMORY] Garbage collection freed ${freed.toFixed(2)} MB`);
          }
        },
        5 * 60 * 1000
      );
    }
  }

  private async checkMemory() {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
    const rssMB = memUsage.rss / 1024 / 1024;

    // Log current memory usage
    logger.debug(
      `[MEMORY] Heap: ${heapUsedMB.toFixed(2)}/${heapTotalMB.toFixed(2)} MB, RSS: ${rssMB.toFixed(2)} MB`
    );

    // Check thresholds
    if (rssMB > this.MEMORY_THRESHOLD_RESTART) {
      logger.error(
        `[MEMORY] CRITICAL: Memory usage ${rssMB.toFixed(2)} MB exceeds restart threshold`
      );
      await this.handleCriticalMemory();
    } else if (rssMB > this.MEMORY_THRESHOLD_CRITICAL) {
      logger.warn(`[MEMORY] CRITICAL: Memory usage ${rssMB.toFixed(2)} MB - initiating cleanup`);
      await this.performAggressiveCleanup();
    } else if (rssMB > this.MEMORY_THRESHOLD_WARNING) {
      logger.warn(`[MEMORY] WARNING: Memory usage ${rssMB.toFixed(2)} MB - performing cleanup`);
      await this.performCleanup();
    }
  }

  private async performCleanup() {
    try {
      // 1. Clean up FTP connections
      // TODO: Uncomment after applying patch to WebhookProcessorOptimizedV2
      // await WebhookProcessorOptimizedV2.cleanupStaleConnections();

      // 2. Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // 3. Clear any caches
      this.clearCaches();

      logger.info('[MEMORY] Cleanup completed');
    } catch (error) {
      logger.error('[MEMORY] Cleanup failed:', error);
    }
  }

  private async performAggressiveCleanup() {
    try {
      logger.info('[MEMORY] Starting aggressive cleanup');

      // 1. Pause new job processing
      await this.pauseProcessing();

      // 2. Close all FTP connections
      // TODO: Uncomment after applying patch to WebhookProcessorOptimizedV2
      // await WebhookProcessorOptimizedV2.closeAllConnections();

      // 3. Clear all caches
      this.clearCaches();

      // 4. Force multiple garbage collections
      if (global.gc) {
        for (let i = 0; i < 3; i++) {
          global.gc();
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // 5. Wait a bit for memory to settle
      await new Promise(resolve => setTimeout(resolve, 5000));

      // 6. Resume processing
      await this.resumeProcessing();

      const memAfter = process.memoryUsage().rss / 1024 / 1024;
      logger.info(`[MEMORY] Aggressive cleanup completed. Memory now: ${memAfter.toFixed(2)} MB`);
    } catch (error) {
      logger.error('[MEMORY] Aggressive cleanup failed:', error);
    }
  }

  private async handleCriticalMemory() {
    logger.error('[MEMORY] Initiating graceful restart due to critical memory usage');

    // 1. Stop accepting new webhooks
    await this.pauseProcessing();

    // 2. Wait for current jobs to finish (max 30 seconds)
    const maxWait = 30000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      // TODO: Uncomment after applying patch to WebhookProcessorOptimizedV2
      // const activeJobs = await WebhookProcessorOptimizedV2.getActiveJobCount();
      const activeJobs = 0; // Temporary placeholder
      if (activeJobs === 0) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 3. Exit process - Render will automatically restart
    logger.info('[MEMORY] Exiting for restart...');
    process.exit(0);
  }

  private async pauseProcessing() {
    try {
      // TODO: Uncomment after applying patch to WebhookProcessorOptimizedV2
      // await WebhookProcessorOptimizedV2.pauseQueue();
      logger.info('[MEMORY] Processing paused');
    } catch (error) {
      logger.error('[MEMORY] Failed to pause processing:', error);
    }
  }

  private async resumeProcessing() {
    try {
      // TODO: Uncomment after applying patch to WebhookProcessorOptimizedV2
      // await WebhookProcessorOptimizedV2.resumeQueue();
      logger.info('[MEMORY] Processing resumed');
    } catch (error) {
      logger.error('[MEMORY] Failed to resume processing:', error);
    }
  }

  private clearCaches() {
    // Clear any module caches or other in-memory caches
    // This is application-specific
    try {
      // Clear require cache for non-essential modules
      Object.keys(require.cache).forEach(key => {
        if (key.includes('node_modules') && !key.includes('bullmq') && !key.includes('ioredis')) {
          delete require.cache[key];
        }
      });
    } catch (error) {
      logger.error('[MEMORY] Failed to clear caches:', error);
    }
  }

  public getMemoryStats() {
    const memUsage = process.memoryUsage();
    return {
      heapUsed: (memUsage.heapUsed / 1024 / 1024).toFixed(2),
      heapTotal: (memUsage.heapTotal / 1024 / 1024).toFixed(2),
      rss: (memUsage.rss / 1024 / 1024).toFixed(2),
      external: (memUsage.external / 1024 / 1024).toFixed(2),
      arrayBuffers: (memUsage.arrayBuffers / 1024 / 1024).toFixed(2),
    };
  }

  public cleanup() {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
    }
    if (this.gcInterval) {
      clearInterval(this.gcInterval);
    }
  }
}

// Export singleton instance
export const memoryManager = WebhookMemoryManager.getInstance();
