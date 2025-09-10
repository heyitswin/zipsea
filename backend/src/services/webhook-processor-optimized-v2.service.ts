import * as ftp from 'basic-ftp';
import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { db } from '../db/connection';
import { cruises } from '../db/schema/cruises';
import { cheapestPricing } from '../db/schema';
import { priceSnapshots } from '../db/schema/webhook-events';
import { eq } from 'drizzle-orm';
import logger from '../config/logger';
import { Writable } from 'stream';

interface FtpConnection {
  client: ftp.Client;
  inUse: boolean;
  lastUsed: number;
}

export class WebhookProcessorOptimizedV2 {
  private static ftpPool: FtpConnection[] = [];
  private static poolInitialized = false;
  private static MAX_CONNECTIONS = 3;
  private static KEEP_ALIVE_INTERVAL = 30000;

  // BullMQ configuration
  private static webhookQueue: Queue | null = null;
  private static webhookWorker: Worker | null = null;
  private static redisConnection: Redis | null = null;

  private stats = {
    filesProcessed: 0,
    cruisesUpdated: 0,
    errors: [] as string[],
  };

  constructor() {
    this.initializeFtpPool();
    this.initializeQueue();
  }

  private async initializeQueue() {
    // Only initialize once
    if (WebhookProcessorOptimizedV2.webhookQueue) {
      return;
    }

    // Create Redis connection for BullMQ
    WebhookProcessorOptimizedV2.redisConnection = new Redis(
      process.env.REDIS_URL || 'redis://localhost:6379',
      {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      }
    );

    // Create the queue for webhook processing
    WebhookProcessorOptimizedV2.webhookQueue = new Queue('webhook-v2-processing', {
      connection: WebhookProcessorOptimizedV2.redisConnection,
      defaultJobOptions: {
        removeOnComplete: { count: 100, age: 3600 }, // Keep last 100 completed jobs for 1 hour
        removeOnFail: { count: 50, age: 86400 }, // Keep last 50 failed jobs for 24 hours
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    // Create worker to process jobs
    WebhookProcessorOptimizedV2.webhookWorker = new Worker(
      'webhook-v2-processing',
      async (job: Job) => {
        const { lineId, files } = job.data;
        console.log(
          `[WORKER-V2] Processing job ${job.id} for line ${lineId} with ${files.length} files`
        );

        // Process files in batches
        const BATCH_SIZE = 5;
        const results = { processed: 0, failed: 0, updated: 0 };

        for (let i = 0; i < files.length; i += BATCH_SIZE) {
          const batch = files.slice(i, i + BATCH_SIZE);

          // Update job progress
          await job.updateProgress((i / files.length) * 100);

          // Process batch in parallel
          const batchResults = await Promise.allSettled(
            batch.map(file => WebhookProcessorOptimizedV2.processFileStatic(file))
          );

          batchResults.forEach(result => {
            if (result.status === 'fulfilled') {
              results.processed++;
              if (result.value) results.updated++;
            } else {
              results.failed++;
              console.error(`[WORKER-V2] File processing failed:`, result.reason);
            }
          });
        }

        console.log(
          `[WORKER-V2] Job ${job.id} completed: ${results.processed} processed, ${results.updated} updated, ${results.failed} failed`
        );
        return results;
      },
      {
        connection: WebhookProcessorOptimizedV2.redisConnection!,
        concurrency: 3, // Process 3 jobs concurrently
        stalledInterval: 30000,
      }
    );

    // Set up event listeners
    WebhookProcessorOptimizedV2.webhookWorker.on('completed', job => {
      console.log(`[QUEUE-V2] Job ${job.id} completed successfully`);
    });

    WebhookProcessorOptimizedV2.webhookWorker.on('failed', (job, err) => {
      console.error(`[QUEUE-V2] Job ${job?.id} failed:`, err.message);
    });

    console.log('[OPTIMIZED-V2] BullMQ queue and worker initialized');
  }

  private async initializeFtpPool() {
    if (WebhookProcessorOptimizedV2.poolInitialized) {
      return;
    }

    console.log('[OPTIMIZED-V2] Initializing FTP connection pool...');

    const ftpConfig = {
      host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
      user: process.env.TRAVELTEK_FTP_USER || process.env.FTP_USER,
      password: process.env.TRAVELTEK_FTP_PASSWORD || process.env.FTP_PASSWORD,
      secure: false,
      timeout: 30000,
      verbose: false,
    };

    // Create connection pool
    for (let i = 0; i < WebhookProcessorOptimizedV2.MAX_CONNECTIONS; i++) {
      const client = new ftp.Client();
      client.ftp.verbose = false;

      try {
        await client.access(ftpConfig);
        WebhookProcessorOptimizedV2.ftpPool.push({
          client,
          inUse: false,
          lastUsed: Date.now(),
        });
        console.log(
          `[OPTIMIZED-V2] Connection ${i + 1}/${WebhookProcessorOptimizedV2.MAX_CONNECTIONS} established`
        );
      } catch (error) {
        console.error(`[OPTIMIZED-V2] Failed to create connection ${i + 1}:`, error);
      }
    }

    // Set up keep-alive
    setInterval(async () => {
      for (const conn of WebhookProcessorOptimizedV2.ftpPool) {
        if (
          !conn.inUse &&
          Date.now() - conn.lastUsed > WebhookProcessorOptimizedV2.KEEP_ALIVE_INTERVAL
        ) {
          try {
            await conn.client.send('NOOP');
            conn.lastUsed = Date.now();
          } catch (error) {
            // Connection dead, will need to recreate on next use
          }
        }
      }
    }, WebhookProcessorOptimizedV2.KEEP_ALIVE_INTERVAL);

    WebhookProcessorOptimizedV2.poolInitialized = true;
    console.log(
      `[OPTIMIZED-V2] FTP pool ready with ${WebhookProcessorOptimizedV2.ftpPool.length} connections`
    );
  }

  private async getFtpConnection(): Promise<FtpConnection> {
    // Wait for pool to be initialized
    while (!WebhookProcessorOptimizedV2.poolInitialized) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Find available connection
    let availableConn = WebhookProcessorOptimizedV2.ftpPool.find(conn => !conn.inUse);

    if (availableConn) {
      availableConn.inUse = true;
      availableConn.lastUsed = Date.now();

      // Test if connection is still alive
      try {
        await availableConn.client.pwd();
        return availableConn;
      } catch (error) {
        // Connection dead, recreate it
        console.log('[OPTIMIZED-V2] Recreating dead connection...');
        const ftpConfig = {
          host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
          user: process.env.TRAVELTEK_FTP_USER || process.env.FTP_USER,
          password: process.env.TRAVELTEK_FTP_PASSWORD || process.env.FTP_PASSWORD,
          secure: false,
          timeout: 30000,
          verbose: false,
        };

        availableConn.client = new ftp.Client();
        availableConn.client.ftp.verbose = false;
        await availableConn.client.access(ftpConfig);
        return availableConn;
      }
    }

    // Wait for connection to become available
    await new Promise(resolve => setTimeout(resolve, 100));
    return this.getFtpConnection();
  }

  private releaseFtpConnection(conn: FtpConnection) {
    conn.inUse = false;
    conn.lastUsed = Date.now();
  }

  async processWebhooks(
    lineId: number
  ): Promise<{ status: string; jobId?: string; message: string }> {
    const startTime = Date.now();
    console.log(`[OPTIMIZED-V2] Starting webhook processing for line ${lineId}`);

    try {
      // Initialize queue if not already done
      await this.initializeQueue();

      // Skip snapshot for now - database schema mismatch
      // await this.takeSnapshot(lineId);

      // Discover files efficiently
      const files = await this.discoverFiles(lineId);
      console.log(`[OPTIMIZED-V2] Found ${files.length} files to process`);

      if (files.length === 0) {
        return {
          status: 'completed',
          message: `No files found for line ${lineId}`,
        };
      }

      // Create batches of files for queue processing
      const MAX_FILES_PER_JOB = 50; // Process up to 50 files per job
      const batches = [];

      for (let i = 0; i < files.length; i += MAX_FILES_PER_JOB) {
        batches.push(files.slice(i, i + MAX_FILES_PER_JOB));
      }

      console.log(`[OPTIMIZED-V2] Creating ${batches.length} jobs for line ${lineId}`);

      // Queue jobs for processing
      const jobIds = [];
      for (let i = 0; i < batches.length; i++) {
        const job = await WebhookProcessorOptimizedV2.webhookQueue!.add(
          `line-${lineId}-batch-${i + 1}`,
          {
            lineId,
            files: batches[i],
            batchNumber: i + 1,
            totalBatches: batches.length,
          },
          {
            priority: batches.length - i, // Process earlier batches first
            delay: i * 2000, // Stagger job starts by 2 seconds
          }
        );
        jobIds.push(job.id);
      }

      const duration = Date.now() - startTime;
      console.log(`[OPTIMIZED-V2] Queued ${batches.length} jobs in ${duration}ms`);

      return {
        status: 'queued',
        jobId: jobIds[0], // Return first job ID
        message: `Queued ${batches.length} jobs to process ${files.length} files for line ${lineId}`,
      };
    } catch (error) {
      console.error('[OPTIMIZED-V2] Processing failed:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async discoverFiles(lineId: number): Promise<any[]> {
    const conn = await this.getFtpConnection();
    const files: any[] = [];

    try {
      // Get current date
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      // First, discover what years are available on FTP
      const availableYears: number[] = [];
      try {
        const yearDirs = await conn.client.list('/');
        for (const dir of yearDirs) {
          if (dir.type === 2) {
            // Directory
            const year = parseInt(dir.name);
            if (!isNaN(year) && year >= currentYear && year <= currentYear + 2) {
              availableYears.push(year);
            }
          }
        }
      } catch (error) {
        console.log('[OPTIMIZED-V2] Error listing years, using default range');
        availableYears.push(currentYear, currentYear + 1);
      }

      console.log(`[OPTIMIZED-V2] Scanning years: ${availableYears.join(', ')}`);

      // For each available year, scan all months from current month onwards
      for (const year of availableYears) {
        const startMonth = year === currentYear ? currentMonth : 1;
        const endMonth = 12;

        for (let month = startMonth; month <= endMonth; month++) {
          const monthStr = month.toString().padStart(2, '0');
          const linePath = `/${year}/${monthStr}/${lineId}`;

          try {
            const shipDirs = await conn.client.list(linePath);

            for (const shipDir of shipDirs) {
              if (shipDir.type === 2) {
                // Directory
                const shipPath = `${linePath}/${shipDir.name}`;
                const cruiseFiles = await conn.client.list(shipPath);

                for (const file of cruiseFiles) {
                  if (file.type === 1 && file.name.endsWith('.json')) {
                    files.push({
                      path: `${shipPath}/${file.name}`,
                      name: file.name,
                      lineId: lineId,
                      shipId: parseInt(shipDir.name) || 0,
                      cruiseId: file.name.replace('.json', ''),
                      size: file.size,
                      year: year,
                      month: month,
                    });
                  }
                }
              }
            }

            if (files.length > 0) {
              console.log(`[OPTIMIZED-V2] Found ${files.length} files in ${year}/${monthStr}`);
            }
          } catch (error) {
            // No data for this month, continue silently
          }
        }
      }

      // Sort files by date (year/month) to process most recent first
      files.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });
    } finally {
      this.releaseFtpConnection(conn);
    }

    return files;
  }

  // Static version of processFile that can be called from worker
  public static async processFileStatic(file: any): Promise<boolean> {
    const processor = new WebhookProcessorOptimizedV2();
    return processor.processFile(file);
  }

  private async processFile(file: any): Promise<boolean> {
    const conn = await this.getFtpConnection();

    try {
      // Download file to memory (like sync-complete-enhanced.js)
      const chunks: Buffer[] = [];
      const writeStream = new Writable({
        write(chunk, encoding, callback) {
          chunks.push(chunk);
          callback();
        },
      });

      await conn.client.downloadTo(writeStream, file.path);

      if (chunks.length === 0) {
        console.log(`[OPTIMIZED-V2] Empty file: ${file.path}`);
        return;
      }

      const data = JSON.parse(Buffer.concat(chunks).toString());

      // According to TRAVELTEK-COMPLETE-FIELD-REFERENCE.md, the primary ID is codetocruiseid
      const cruiseId = data.codetocruiseid || data.id || file.cruiseId;

      if (!cruiseId) {
        console.log(`[OPTIMIZED-V2] No cruise ID found in ${file.path}`);
        return;
      }

      // Extract sailing date (from startdate or saildate field)
      let sailingDate = data.startdate || data.saildate;
      if (!sailingDate) {
        // Fallback to other possible date fields
        sailingDate = data.embarkDate || data.embarkdate || data.sailingdate || data.sailing_date;
      }
      if (sailingDate && sailingDate.includes('T')) {
        sailingDate = sailingDate.split('T')[0];
      }

      // Calculate return date if we have sailing date and nights
      let returnDate = null;
      if (sailingDate && data.nights) {
        const sailDate = new Date(sailingDate);
        sailDate.setDate(sailDate.getDate() + parseInt(data.nights));
        returnDate = sailDate.toISOString().split('T')[0];
      }

      // Extract port and region information (handle both array and string formats)
      let portIds = '';
      if (data.portids) {
        if (Array.isArray(data.portids)) {
          portIds = data.portids.join(',');
        } else if (typeof data.portids === 'string') {
          portIds = data.portids;
        }
      }

      let regionIds = '';
      if (data.regionids) {
        if (Array.isArray(data.regionids)) {
          regionIds = data.regionids.join(',');
        } else if (typeof data.regionids === 'string') {
          regionIds = data.regionids;
        }
      }

      // Helper function to safely parse integer, returning 0 for invalid values
      const safeParseInt = (value: any, defaultValue: number = 0): number => {
        if (value === null || value === undefined || value === '') {
          return defaultValue;
        }
        // Handle strings like "system" that can't be parsed as integers
        const parsed = parseInt(value);
        return isNaN(parsed) ? defaultValue : parsed;
      };

      // Prepare comprehensive cruise data based on Traveltek fields
      const cruiseData = {
        id: cruiseId,
        cruiseId: data.cruiseid ? data.cruiseid.toString() : cruiseId,
        cruiseLineId: file.lineId,
        shipId: safeParseInt(data.shipid || file.shipId, 0),
        name: data.name || data.title || 'Unknown Cruise',
        voyageCode: data.voyagecode || null,
        itineraryCode: data.itinerarycode || null,
        sailingDate: sailingDate || new Date().toISOString().split('T')[0],
        returnDate: returnDate,
        nights: safeParseInt(data.nights || data.sailnights, 0),
        seaDays: safeParseInt(data.seadays, 0),
        embarkPortId: safeParseInt(data.startportid || data.embarkportid, 0),
        disembarkPortId: safeParseInt(data.endportid || data.disembarkportid, 0),
        portIds: portIds,
        regionIds: regionIds,
        marketId: data.marketid ? data.marketid.toString() : null,
        ownerId: data.ownerid ? data.ownerid.toString() : null,
        noFly: data.nofly === 'Y' || data.nofly === true,
        departUk: data.departuk === true,
        showCruise: data.showcruise !== false, // Default to true unless explicitly false
        lastCached: safeParseInt(data.lastcached, null),
        cachedDate: data.cacheddate || null,
        rawData: data,
        updatedAt: new Date(),
      };

      // Upsert cruise (insert if new, update if exists)
      await db
        .insert(cruises)
        .values(cruiseData)
        .onConflictDoUpdate({
          target: cruises.id,
          set: {
            name: cruiseData.name,
            voyageCode: cruiseData.voyageCode,
            itineraryCode: cruiseData.itineraryCode,
            sailingDate: cruiseData.sailingDate,
            returnDate: cruiseData.returnDate,
            nights: cruiseData.nights,
            seaDays: cruiseData.seaDays,
            embarkPortId: cruiseData.embarkPortId,
            disembarkPortId: cruiseData.disembarkPortId,
            portIds: cruiseData.portIds,
            regionIds: cruiseData.regionIds,
            marketId: cruiseData.marketId,
            ownerId: cruiseData.ownerId,
            noFly: cruiseData.noFly,
            departUk: cruiseData.departUk,
            showCruise: cruiseData.showCruise,
            lastCached: cruiseData.lastCached,
            cachedDate: cruiseData.cachedDate,
            rawData: cruiseData.rawData,
            updatedAt: new Date(),
          },
        });

      this.stats.cruisesUpdated++;
      console.log(`[OPTIMIZED-V2] Upserted cruise ${cruiseId} (${file.size} bytes)`);

      // Update pricing if available
      await this.updatePricing(cruiseId, data);

      this.stats.filesProcessed++;
      return true; // Successfully processed
    } catch (error) {
      console.error(`[OPTIMIZED-V2] Failed to process ${file.path}:`, error);
      this.stats.errors.push(`${file.path}: ${error}`);
      return false; // Failed to process
    } finally {
      this.releaseFtpConnection(conn);
    }
  }

  private async updatePricing(cruiseId: string, data: any): Promise<void> {
    try {
      // Extract pricing from Traveltek's structure
      let cheapestData: any = {};

      // According to TRAVELTEK-COMPLETE-FIELD-REFERENCE.md, pricing is in:
      // 1. data.cheapest object with combined field (preferred)
      // 2. data.cheapest.prices for separated cabin types
      // 3. data.cheapestinside, cheapestoutside, cheapestbalcony, cheapestsuite objects

      // First priority: cheapest.combined (most reliable aggregated pricing)
      if (data.cheapest && data.cheapest.combined) {
        cheapestData = {
          cheapestPrice: parseFloat(
            data.cheapest.combined.price || data.cheapest.combined.total || 0
          ),
          interiorPrice: parseFloat(data.cheapest.combined.inside || 0),
          oceanviewPrice: parseFloat(data.cheapest.combined.outside || 0),
          balconyPrice: parseFloat(data.cheapest.combined.balcony || 0),
          suitePrice: parseFloat(data.cheapest.combined.suite || 0),
        };
      }
      // Second priority: cheapest.prices
      else if (data.cheapest && data.cheapest.prices) {
        cheapestData = {
          interiorPrice: parseFloat(data.cheapest.prices.inside || 0),
          oceanviewPrice: parseFloat(data.cheapest.prices.outside || 0),
          balconyPrice: parseFloat(data.cheapest.prices.balcony || 0),
          suitePrice: parseFloat(data.cheapest.prices.suite || 0),
        };
        // Calculate cheapest overall
        const prices = [
          cheapestData.interiorPrice,
          cheapestData.oceanviewPrice,
          cheapestData.balconyPrice,
          cheapestData.suitePrice,
        ].filter(p => p > 0);
        cheapestData.cheapestPrice = prices.length > 0 ? Math.min(...prices) : null;
      }
      // Third priority: Individual cheapest objects
      else if (
        data.cheapestinside ||
        data.cheapestoutside ||
        data.cheapestbalcony ||
        data.cheapestsuite
      ) {
        cheapestData = {
          interiorPrice: data.cheapestinside ? parseFloat(data.cheapestinside.price || 0) : null,
          oceanviewPrice: data.cheapestoutside ? parseFloat(data.cheapestoutside.price || 0) : null,
          balconyPrice: data.cheapestbalcony ? parseFloat(data.cheapestbalcony.price || 0) : null,
          suitePrice: data.cheapestsuite ? parseFloat(data.cheapestsuite.price || 0) : null,
        };
        // Calculate cheapest overall
        const prices = [
          cheapestData.interiorPrice,
          cheapestData.oceanviewPrice,
          cheapestData.balconyPrice,
          cheapestData.suitePrice,
        ].filter(p => p > 0);
        cheapestData.cheapestPrice = prices.length > 0 ? Math.min(...prices) : null;
      }
      // Fallback: Try to extract from prices/cachedprices structure
      else if (data.prices || data.cachedprices) {
        const priceSource = data.cachedprices || data.prices;
        cheapestData = await this.extractPricesFromNestedStructure(priceSource);
      }

      // Clean up zero values
      Object.keys(cheapestData).forEach(key => {
        if (cheapestData[key] === 0 || cheapestData[key] === null) {
          cheapestData[key] = null;
        }
      });

      // Update cruises table with basic pricing
      if (
        cheapestData.interiorPrice ||
        cheapestData.oceanviewPrice ||
        cheapestData.balconyPrice ||
        cheapestData.suitePrice
      ) {
        await db
          .update(cruises)
          .set({
            interiorPrice: cheapestData.interiorPrice?.toString(),
            oceanviewPrice: cheapestData.oceanviewPrice?.toString(),
            balconyPrice: cheapestData.balconyPrice?.toString(),
            suitePrice: cheapestData.suitePrice?.toString(),
            updatedAt: new Date(),
          })
          .where(eq(cruises.id, cruiseId));

        console.log(`[OPTIMIZED-V2] Updated cruise pricing for ${cruiseId}`);
      }

      // Now update the cheapest_pricing table with full details
      if (
        cheapestData.cheapestPrice ||
        cheapestData.interiorPrice ||
        cheapestData.oceanviewPrice ||
        cheapestData.balconyPrice ||
        cheapestData.suitePrice
      ) {
        // Prepare full cheapest pricing data
        const cheapestPricingData = {
          cruiseId: cruiseId,
          cheapestPrice: cheapestData.cheapestPrice,

          // Interior details
          interiorPrice: cheapestData.interiorPrice,
          interiorTaxes: data.cheapestinside?.taxes || null,
          interiorNcf: data.cheapestinside?.ncf || null,
          interiorGratuity: data.cheapestinside?.gratuity || null,
          interiorFuel: data.cheapestinside?.fuel || null,
          interiorNonComm: data.cheapestinside?.noncomm || null,
          interiorPriceCode: data.cheapestinsidepricecode || null,

          // Oceanview details
          oceanviewPrice: cheapestData.oceanviewPrice,
          oceanviewTaxes: data.cheapestoutside?.taxes || null,
          oceanviewNcf: data.cheapestoutside?.ncf || null,
          oceanviewGratuity: data.cheapestoutside?.gratuity || null,
          oceanviewFuel: data.cheapestoutside?.fuel || null,
          oceanviewNonComm: data.cheapestoutside?.noncomm || null,
          oceanviewPriceCode: data.cheapestoutsidepricecode || null,

          // Balcony details
          balconyPrice: cheapestData.balconyPrice,
          balconyTaxes: data.cheapestbalcony?.taxes || null,
          balconyNcf: data.cheapestbalcony?.ncf || null,
          balconyGratuity: data.cheapestbalcony?.gratuity || null,
          balconyFuel: data.cheapestbalcony?.fuel || null,
          balconyNonComm: data.cheapestbalcony?.noncomm || null,
          balconyPriceCode: data.cheapestbalconypricecode || null,

          // Suite details
          suitePrice: cheapestData.suitePrice,
          suiteTaxes: data.cheapestsuite?.taxes || null,
          suiteNcf: data.cheapestsuite?.ncf || null,
          suiteGratuity: data.cheapestsuite?.gratuity || null,
          suiteFuel: data.cheapestsuite?.fuel || null,
          suiteNonComm: data.cheapestsuite?.noncomm || null,
          suitePriceCode: data.cheapestsuitepricecode || null,

          currency: data.currency || 'USD',
          lastUpdated: new Date(),
        };

        // Upsert into cheapest_pricing table
        await db
          .insert(cheapestPricing)
          .values(cheapestPricingData)
          .onConflictDoUpdate({
            target: cheapestPricing.cruiseId,
            set: {
              ...cheapestPricingData,
              lastUpdated: new Date(),
            },
          });

        console.log(`[OPTIMIZED-V2] Updated cheapest_pricing for cruise ${cruiseId}`);
      }
    } catch (error) {
      console.error(`[OPTIMIZED-V2] Failed to update pricing for ${cruiseId}:`, error);
    }
  }

  // Helper function to extract prices from nested rate/cabin/occupancy structure
  private async extractPricesFromNestedStructure(priceData: any): Promise<any> {
    const result = {
      interiorPrice: null as number | null,
      oceanviewPrice: null as number | null,
      balconyPrice: null as number | null,
      suitePrice: null as number | null,
      cheapestPrice: null as number | null,
    };

    if (!priceData || typeof priceData !== 'object') {
      return result;
    }

    // Iterate through rate codes
    for (const rateCode in priceData) {
      const cabins = priceData[rateCode];
      if (!cabins || typeof cabins !== 'object') continue;

      // Iterate through cabin codes
      for (const cabinCode in cabins) {
        const occupancies = cabins[cabinCode];
        if (!occupancies || typeof occupancies !== 'object') continue;

        // Find the cheapest price for this cabin
        let cabinPrice = null;
        for (const occupancy in occupancies) {
          const priceInfo = occupancies[occupancy];
          if (priceInfo && priceInfo.price) {
            const price = parseFloat(priceInfo.price);
            if (price > 0 && (!cabinPrice || price < cabinPrice)) {
              cabinPrice = price;
            }
          }
        }

        if (!cabinPrice) continue;

        // Categorize cabin based on code or type
        const cabinUpper = cabinCode.toUpperCase();
        const cabinType = occupancies['101']?.cabintype?.toLowerCase() || '';

        if (
          cabinUpper.startsWith('I') ||
          cabinType.includes('interior') ||
          cabinType.includes('inside')
        ) {
          if (!result.interiorPrice || cabinPrice < result.interiorPrice) {
            result.interiorPrice = cabinPrice;
          }
        } else if (
          cabinUpper.startsWith('O') ||
          cabinType.includes('ocean') ||
          cabinType.includes('outside')
        ) {
          if (!result.oceanviewPrice || cabinPrice < result.oceanviewPrice) {
            result.oceanviewPrice = cabinPrice;
          }
        } else if (
          cabinUpper.startsWith('B') ||
          cabinType.includes('balcony') ||
          cabinType.includes('verandah')
        ) {
          if (!result.balconyPrice || cabinPrice < result.balconyPrice) {
            result.balconyPrice = cabinPrice;
          }
        } else if (
          cabinUpper.startsWith('S') ||
          cabinType.includes('suite') ||
          cabinType.includes('penthouse')
        ) {
          if (!result.suitePrice || cabinPrice < result.suitePrice) {
            result.suitePrice = cabinPrice;
          }
        }
      }
    }

    // Calculate overall cheapest
    const allPrices = [
      result.interiorPrice,
      result.oceanviewPrice,
      result.balconyPrice,
      result.suitePrice,
    ].filter(p => p !== null && p > 0) as number[];

    if (allPrices.length > 0) {
      result.cheapestPrice = Math.min(...allPrices);
    }

    return result;
  }

  private async takeSnapshot(lineId: number) {
    try {
      console.log(`[OPTIMIZED-V2] Taking price snapshot for line ${lineId}`);

      // Take snapshots of cheapest pricing for all cruises in this line
      const cruisesWithPricing = await db
        .select({
          cruiseId: cruises.id,
          cheapestPrice: cheapestPricing.cheapestPrice,
          interiorPrice: cheapestPricing.interiorPrice,
          oceanviewPrice: cheapestPricing.oceanviewPrice,
          balconyPrice: cheapestPricing.balconyPrice,
          suitePrice: cheapestPricing.suitePrice,
        })
        .from(cruises)
        .leftJoin(cheapestPricing, eq(cruises.id, cheapestPricing.cruiseId))
        .where(eq(cruises.cruiseLineId, lineId))
        .limit(1000);

      let snapshotCount = 0;

      // Create snapshots for each cruise with pricing
      for (const cruise of cruisesWithPricing) {
        if (cruise.cruiseId && cruise.cheapestPrice) {
          try {
            // Cast cruise ID to integer for the database
            const cruiseIdInt = parseInt(cruise.cruiseId as string, 10);
            if (isNaN(cruiseIdInt)) {
              console.warn(
                `[OPTIMIZED-V2] Skipping snapshot for non-numeric cruise ID: ${cruise.cruiseId}`
              );
              continue;
            }

            await db.insert(priceSnapshots).values({
              lineId: lineId,
              cruiseId: cruise.cruiseId as string,
              snapshotData: {
                // Store all pricing data in the JSONB column
                snapshotType: 'before',
                staticPrice: cruise.cheapestPrice,
                cachedPrice: cruise.cheapestPrice,
                cheapestCabinPrice: cruise.cheapestPrice,
                // Granular cabin type pricing
                interiorPrice: cruise.interiorPrice,
                oceanviewPrice: cruise.oceanviewPrice,
                balconyPrice: cruise.balconyPrice,
                suitePrice: cruise.suitePrice,
                // Also store the cheapest overall
                cheapestPrice: cruise.cheapestPrice,
                // Meta information
                timestamp: new Date().toISOString(),
                source: 'webhook_processor_v2',
              },
              metadata: {
                lineId: lineId,
                source: 'webhook_processor_v2',
              },
              priceChangeDetected: false,
            });
            snapshotCount++;
          } catch (error) {
            console.error(
              `[OPTIMIZED-V2] Failed to create snapshot for cruise ${cruise.cruiseId}:`,
              error
            );
          }
        }
      }

      console.log(`[OPTIMIZED-V2] Created ${snapshotCount} price snapshots for line ${lineId}`);
    } catch (error) {
      console.error(`[OPTIMIZED-V2] Failed to take snapshots for line ${lineId}:`, error);
      // Don't throw - snapshots are not critical to webhook processing
    }
  }
}
