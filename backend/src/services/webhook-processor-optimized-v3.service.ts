import { Injectable } from '@nestjs/common';
import * as ftp from 'basic-ftp';
import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { db } from '../db';
import { cruises, ships, pricing, itinerary } from '../db/schema';
import { eq, sql, and, inArray } from 'drizzle-orm';
import { Writable } from 'stream';
import * as crypto from 'crypto';

interface ProcessingStats {
  filesProcessed: number;
  cruisesUpdated: number;
  skippedUnchanged: number;
  errors: string[];
  startTime: Date;
  endTime?: Date;
}

interface BatchOperation {
  type: 'cruise' | 'pricing' | 'itinerary';
  data: any;
}

export class WebhookProcessorOptimizedV3 {
  private static redisConnection: Redis | null = null;
  private static webhookQueue: Queue | null = null;
  private static webhookWorker: Worker | null = null;
  private static ftpPool: any[] = [];
  private static shipCache: Map<number, any> = new Map();
  private static changeCache: Map<string, string> = new Map(); // cruise_id -> checksum

  private stats: ProcessingStats = {
    filesProcessed: 0,
    cruisesUpdated: 0,
    skippedUnchanged: 0,
    errors: [],
    startTime: new Date(),
  };

  constructor() {
    this.initializeServices();
  }

  private async initializeServices() {
    // Initialize Redis with optimized settings
    if (!WebhookProcessorOptimizedV3.redisConnection) {
      WebhookProcessorOptimizedV3.redisConnection = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        maxRetriesPerRequest: 3,
        enableOfflineQueue: false,
      });
    }

    // Initialize Queue
    if (!WebhookProcessorOptimizedV3.webhookQueue) {
      WebhookProcessorOptimizedV3.webhookQueue = new Queue('webhook-v3-processing', {
        connection: WebhookProcessorOptimizedV3.redisConnection,
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      });
    }

    // Initialize Worker with lower concurrency
    if (!WebhookProcessorOptimizedV3.webhookWorker) {
      WebhookProcessorOptimizedV3.webhookWorker = new Worker(
        'webhook-v3-processing',
        async (job: Job) => {
          return this.processBatch(job);
        },
        {
          connection: WebhookProcessorOptimizedV3.redisConnection,
          concurrency: 1, // Process one batch at a time to avoid memory issues
        }
      );
    }
  }

  /**
   * Process a batch of files with optimized database operations
   */
  private async processBatch(job: Job): Promise<any> {
    const { files, lineId, batchNumber, totalBatches } = job.data;
    console.log(`[V3] Processing batch ${batchNumber}/${totalBatches} for line ${lineId}`);

    const batchOps: BatchOperation[] = [];
    const processedFiles: string[] = [];

    // Process files and collect operations
    for (const file of files) {
      try {
        const ops = await this.analyzeFile(file, lineId);
        if (ops) {
          batchOps.push(...ops);
          processedFiles.push(file.path);
        }
      } catch (error) {
        console.error(`[V3] Error analyzing ${file.path}:`, error);
      }
    }

    // Execute batch operations
    if (batchOps.length > 0) {
      await this.executeBatchOperations(batchOps);
    }

    // Clean up every 10 batches
    if (batchNumber % 10 === 0) {
      await this.runQuickCleanup();
    }

    return {
      processed: processedFiles.length,
      total: files.length,
      batchNumber,
    };
  }

  /**
   * Analyze file and return operations to be batched
   */
  private async analyzeFile(file: any, lineId: number): Promise<BatchOperation[] | null> {
    const conn = await this.getFtpConnection();
    try {
      // Download file
      const chunks: Buffer[] = [];
      const writeStream = new Writable({
        write(chunk, encoding, callback) {
          chunks.push(chunk);
          callback();
        },
      });

      await conn.client.downloadTo(writeStream, file.path);

      if (chunks.length === 0) {
        return null;
      }

      const data = JSON.parse(Buffer.concat(chunks).toString());
      const cruiseId = data.codetocruiseid || data.id;

      if (!cruiseId) {
        return null;
      }

      // Quick change detection using checksum
      const checksum = this.calculateChecksum(data);
      const cachedChecksum = WebhookProcessorOptimizedV3.changeCache.get(cruiseId);

      if (cachedChecksum === checksum) {
        this.stats.skippedUnchanged++;
        return null;
      }

      // Update cache
      WebhookProcessorOptimizedV3.changeCache.set(cruiseId, checksum);

      // Prepare operations
      const ops: BatchOperation[] = [];

      // Ship operation (only if not cached)
      const shipId = parseInt(data.shipid) || 0;
      if (shipId && !WebhookProcessorOptimizedV3.shipCache.has(shipId)) {
        ops.push({
          type: 'cruise',
          data: {
            shipId,
            shipData: this.extractShipData(data),
          },
        });
        WebhookProcessorOptimizedV3.shipCache.set(shipId, true);
      }

      // Cruise operation
      ops.push({
        type: 'cruise',
        data: {
          cruiseId,
          lineId,
          cruiseData: this.extractCruiseData(data, cruiseId, lineId),
        },
      });

      // Pricing operation
      if (data.cheapest || data.prices) {
        ops.push({
          type: 'pricing',
          data: {
            cruiseId,
            pricingData: this.extractPricingData(data),
          },
        });
      }

      return ops;
    } finally {
      this.releaseFtpConnection(conn);
    }
  }

  /**
   * Calculate checksum for change detection
   */
  private calculateChecksum(data: any): string {
    // Only hash the important fields that we care about changes in
    const relevantData = {
      prices: data.prices,
      cheapest: data.cheapest,
      cabins: data.cabins,
      availabilitystatus: data.availabilitystatus,
      soldout: data.soldout,
    };

    return crypto
      .createHash('md5')
      .update(JSON.stringify(relevantData))
      .digest('hex');
  }

  /**
   * Execute batched database operations
   */
  private async executeBatchOperations(ops: BatchOperation[]): Promise<void> {
    // Group operations by type
    const cruiseOps = ops.filter(op => op.type === 'cruise');
    const pricingOps = ops.filter(op => op.type === 'pricing');

    // Batch cruise updates
    if (cruiseOps.length > 0) {
      const cruiseData = cruiseOps.map(op => op.data.cruiseData).filter(Boolean);
      if (cruiseData.length > 0) {
        // Use PostgreSQL's INSERT ... ON CONFLICT for bulk upsert
        const values = cruiseData.map(d => `(
          '${d.id}', '${d.cruiseId}', ${d.cruiseLineId}, ${d.shipId},
          '${d.name}', '${d.sailingDate}', ${d.nights}, '${JSON.stringify(d.rawData).replace(/'/g, "''")}'::jsonb,
          NOW()
        )`).join(',');

        await db.execute(sql`
          INSERT INTO cruises (id, cruise_id, cruise_line_id, ship_id, name, sailing_date, nights, raw_data, updated_at)
          VALUES ${sql.raw(values)}
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            sailing_date = EXCLUDED.sailing_date,
            nights = EXCLUDED.nights,
            raw_data = EXCLUDED.raw_data,
            updated_at = EXCLUDED.updated_at
        `);
      }
    }

    // Batch pricing updates
    if (pricingOps.length > 0) {
      const pricingData = pricingOps.map(op => op.data.pricingData).filter(Boolean);
      if (pricingData.length > 0) {
        // Bulk update pricing
        for (const pricing of pricingData) {
          await db
            .update(cruises)
            .set({
              interiorPrice: pricing.interiorPrice,
              oceanviewPrice: pricing.oceanviewPrice,
              balconyPrice: pricing.balconyPrice,
              suitePrice: pricing.suitePrice,
              updatedAt: new Date(),
            })
            .where(eq(cruises.id, pricing.cruiseId));
        }
      }
    }

    console.log(`[V3] Executed ${ops.length} operations in batch`);
  }

  /**
   * Extract only essential cruise data
   */
  private extractCruiseData(data: any, cruiseId: string, lineId: number): any {
    return {
      id: cruiseId,
      cruiseId: data.cruiseid?.toString() || cruiseId,
      cruiseLineId: lineId,
      shipId: parseInt(data.shipid) || 0,
      name: data.name || data.cruisename || 'Unknown Cruise',
      sailingDate: data.startdate || data.saildate,
      nights: parseInt(data.nights) || 0,
      // Store minimal raw data
      rawData: {
        cheapest: data.cheapest,
        prices: data.prices,
        availabilitystatus: data.availabilitystatus,
        soldout: data.soldout,
      },
    };
  }

  /**
   * Extract pricing data
   */
  private extractPricingData(data: any): any {
    const pricing: any = {
      cruiseId: data.codetocruiseid || data.id,
    };

    if (data.cheapest?.combined) {
      pricing.interiorPrice = data.cheapest.combined.inside;
      pricing.oceanviewPrice = data.cheapest.combined.outside;
      pricing.balconyPrice = data.cheapest.combined.balcony;
      pricing.suitePrice = data.cheapest.combined.suite;
    } else {
      pricing.interiorPrice = data.cheapestinside?.price;
      pricing.oceanviewPrice = data.cheapestoutside?.price;
      pricing.balconyPrice = data.cheapestbalcony?.price;
      pricing.suitePrice = data.cheapestsuite?.price;
    }

    return pricing;
  }

  /**
   * Extract ship data
   */
  private extractShipData(data: any): any {
    return {
      id: parseInt(data.shipid),
      name: data.shipcontent?.shipname || 'Unknown Ship',
      code: data.shipcontent?.shipcode,
      cruiseLineId: data.lineid,
    };
  }

  /**
   * Quick cleanup without VACUUM
   */
  private async runQuickCleanup(): Promise<void> {
    try {
      // Only delete very old data
      await db.execute(sql`
        DELETE FROM cruises
        WHERE sailing_date < NOW() - INTERVAL '7 days'
        AND updated_at < NOW() - INTERVAL '3 days'
        LIMIT 1000
      `);

      console.log('[V3] Quick cleanup completed');
    } catch (error) {
      console.error('[V3] Cleanup error:', error);
    }
  }

  /**
   * Get FTP connection from pool
   */
  private async getFtpConnection(): Promise<any> {
    // Simplified FTP connection management
    const client = new ftp.Client();
    client.ftp.verbose = false;

    await client.access({
      host: process.env.FTP_HOST,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASSWORD,
      secure: false,
    });

    return { client };
  }

  /**
   * Release FTP connection
   */
  private releaseFtpConnection(conn: any): void {
    if (conn?.client) {
      conn.client.close();
    }
  }
}
