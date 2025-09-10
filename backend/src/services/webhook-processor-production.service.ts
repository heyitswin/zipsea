import * as ftp from 'basic-ftp';
import { db } from '../db/connection';
import { cruises } from '../db/schema/cruises';
import { syncLocks } from '../db/schema/sync-locks';
import { eq, and } from 'drizzle-orm';
import logger from '../config/logger';
import { Writable } from 'stream';

// Configuration
const CONFIG = {
  FILES_PER_BATCH: 10, // Process 10 files per batch
  MAX_CONCURRENT_BATCHES: 2, // Process 2 batches concurrently
  MAX_MONTHS_AHEAD: 3, // Scan 3 months ahead
  MAX_FTP_CONNECTIONS: 5, // FTP connection pool size
  FTP_TIMEOUT: 30000, // 30 second timeout
  DISCOVERY_BATCH_SIZE: 100, // Process discovery in batches to avoid timeout
};

// FTP Connection Pool
class FTPConnectionPool {
  private connections: Array<{
    id: string;
    client: ftp.Client;
    inUse: boolean;
    lastUsed: number;
  }> = [];
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Prevent multiple initialization
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._doInitialize();
    await this.initPromise;
    this.initialized = true;
  }

  private async _doInitialize(): Promise<void> {
    console.log(`[PRODUCTION] Initializing FTP connection pool with ${CONFIG.MAX_FTP_CONNECTIONS} connections...`);

    const ftpConfig = {
      host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
      user: process.env.TRAVELTEK_FTP_USER || process.env.FTP_USER,
      password: process.env.TRAVELTEK_FTP_PASSWORD || process.env.FTP_PASSWORD,
      secure: false,
      timeout: CONFIG.FTP_TIMEOUT,
    };

    // Create connections in parallel
    const promises = [];
    for (let i = 0; i < CONFIG.MAX_FTP_CONNECTIONS; i++) {
      promises.push(this.createConnection(i, ftpConfig));
    }

    await Promise.allSettled(promises);
    console.log(`[PRODUCTION] FTP pool initialized with ${this.connections.length} connections`);
  }

  private async createConnection(index: number, ftpConfig: any): Promise<void> {
    try {
      const client = new ftp.Client();
      client.ftp.verbose = false;
      await client.access(ftpConfig);

      this.connections.push({
        id: `conn-${index}`,
        client,
        inUse: false,
        lastUsed: Date.now(),
      });

      console.log(`[PRODUCTION] FTP connection ${index + 1} established`);
    } catch (error) {
      console.error(`[PRODUCTION] Failed to create FTP connection ${index + 1}:`, error);
    }
  }

  async getConnection(): Promise<ftp.Client> {
    await this.initialize();

    // Try to find an available connection
    for (let attempts = 0; attempts < 100; attempts++) {
      const available = this.connections.find(c => !c.inUse);

      if (available) {
        available.inUse = true;
        available.lastUsed = Date.now();

        // Test if connection is alive
        try {
          await available.client.pwd();
          return available.client;
        } catch (error) {
          // Connection is dead, recreate it
          console.log(`[PRODUCTION] Recreating dead connection ${available.id}`);
          available.client = new ftp.Client();
          available.client.ftp.verbose = false;

          const ftpConfig = {
            host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
            user: process.env.TRAVELTEK_FTP_USER || process.env.FTP_USER,
            password: process.env.TRAVELTEK_FTP_PASSWORD || process.env.FTP_PASSWORD,
            secure: false,
            timeout: CONFIG.FTP_TIMEOUT,
          };

          await available.client.access(ftpConfig);
          return available.client;
        }
      }

      // Wait a bit before trying again
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error('Unable to get FTP connection after 100 attempts');
  }

  releaseConnection(client: ftp.Client): void {
    const conn = this.connections.find(c => c.client === client);
    if (conn) {
      conn.inUse = false;
      conn.lastUsed = Date.now();
    }
  }

  async closeAll(): Promise<void> {
    for (const conn of this.connections) {
      try {
        conn.client.close();
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
    this.connections = [];
    this.initialized = false;
    this.initPromise = null;
  }
}

// Singleton FTP pool
const ftpPool = new FTPConnectionPool();

// Processing state tracking
interface ProcessingState {
  lineId: number;
  totalFiles: number;
  processedFiles: number;
  startTime: number;
  status: 'discovering' | 'processing' | 'completed' | 'failed';
  error?: string;
}

const activeProcessing = new Map<number, ProcessingState>();

export class WebhookProcessorProduction {
  async processWebhook(lineId: number): Promise<any> {
    console.log(`[PRODUCTION] Starting webhook processing for line ${lineId}`);
    const startTime = Date.now();

    try {
      // Check if already processing using database lock
      const lockKey = `webhook-line-${lineId}`;
      const existingLock = await db
        .select()
        .from(syncLocks)
        .where(and(eq(syncLocks.lockKey, lockKey), eq(syncLocks.isActive, true)))
        .limit(1);

      if (existingLock.length > 0) {
        const lockAge = Date.now() - new Date(existingLock[0].acquiredAt).getTime();

        // If lock is older than 5 minutes, consider it stale and override
        if (lockAge > 300000) {
          console.log(`[PRODUCTION] Overriding stale lock for line ${lineId} (age: ${lockAge}ms)`);
          await db
            .update(syncLocks)
            .set({ isActive: false, releasedAt: new Date() })
            .where(eq(syncLocks.id, existingLock[0].id));
        } else {
          console.log(`[PRODUCTION] Line ${lineId} is already being processed (lock age: ${lockAge}ms)`);
          return {
            status: 'already_processing',
            message: `Line ${lineId} is already being processed`,
            lockAge: `${Math.round(lockAge / 1000)}s`,
          };
        }
      }

      // Acquire lock
      const [lock] = await db
        .insert(syncLocks)
        .values({
          lockKey,
          isActive: true,
          acquiredAt: new Date(),
          metadata: { lineId, type: 'webhook' },
        })
        .returning();

      // Track processing state
      activeProcessing.set(lineId, {
        lineId,
        totalFiles: 0,
        processedFiles: 0,
        startTime,
        status: 'discovering',
      });

      try {
        // Discover ALL files (not just first 50)
        const allFiles = await this.discoverAllFiles(lineId);
        console.log(`[PRODUCTION] Found ${allFiles.length} total files for line ${lineId}`);

        if (allFiles.length === 0) {
          activeProcessing.delete(lineId);
          await this.releaseLock(lock.id);
          return {
            status: 'no_files',
            message: `No files found for line ${lineId}`,
            filesFound: 0,
          };
        }

        // Update state
        const state = activeProcessing.get(lineId)!;
        state.totalFiles = allFiles.length;
        state.status = 'processing';

        // Process files in batches asynchronously
        this.processFilesAsync(lineId, allFiles, lock.id);

        return {
          status: 'queued',
          message: `Processing ${allFiles.length} files for line ${lineId}`,
          filesTotal: allFiles.length,
          estimatedBatches: Math.ceil(allFiles.length / CONFIG.FILES_PER_BATCH),
          discoveryTime: `${Date.now() - startTime}ms`,
        };
      } catch (error) {
        // Release lock on error
        await this.releaseLock(lock.id);
        activeProcessing.delete(lineId);
        throw error;
      }
    } catch (error) {
      console.error(`[PRODUCTION] Failed to process webhook for line ${lineId}:`, error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async processFilesAsync(lineId: number, files: any[], lockId: number): Promise<void> {
    console.log(`[PRODUCTION] Starting async processing of ${files.length} files for line ${lineId}`);
    const state = activeProcessing.get(lineId)!;

    try {
      // Process files in batches
      for (let i = 0; i < files.length; i += CONFIG.FILES_PER_BATCH) {
        const batch = files.slice(i, i + CONFIG.FILES_PER_BATCH);

        // Process batch with limited concurrency
        const batchPromises = batch.map(file => this.processFile(file));
        const results = await Promise.allSettled(batchPromises);

        // Update progress
        state.processedFiles += batch.length;
        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const failCount = results.filter(r => r.status === 'rejected').length;

        console.log(`[PRODUCTION] Batch complete for line ${lineId}: ${state.processedFiles}/${state.totalFiles} files (${successCount} success, ${failCount} failed)`);

        // Small delay between batches to prevent overwhelming the system
        if (i + CONFIG.FILES_PER_BATCH < files.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      state.status = 'completed';
      console.log(`[PRODUCTION] Completed processing ${state.processedFiles} files for line ${lineId} in ${Date.now() - state.startTime}ms`);
    } catch (error) {
      state.status = 'failed';
      state.error = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[PRODUCTION] Failed processing for line ${lineId}:`, error);
    } finally {
      // Release lock and clean up state
      await this.releaseLock(lockId);
      activeProcessing.delete(lineId);
    }
  }

  private async processFile(file: any): Promise<void> {
    const client = await ftpPool.getConnection();

    try {
      // Download file to memory
      const chunks: Buffer[] = [];
      const writeStream = new Writable({
        write(chunk, encoding, callback) {
          chunks.push(chunk);
          callback();
        },
      });

      await client.downloadTo(writeStream, file.path);

      if (chunks.length === 0) {
        console.log(`[PRODUCTION] Empty file: ${file.path}`);
        return;
      }

      const data = JSON.parse(Buffer.concat(chunks).toString());
      const cruiseId = data.id || data.codetocruiseid || file.cruiseId;

      if (!cruiseId) {
        console.log(`[PRODUCTION] No cruise ID found in ${file.path}`);
        return;
      }

      // Extract sailing date
      let sailingDate = data.embarkDate || data.embarkdate || data.sailingdate || data.sailing_date;
      if (sailingDate && sailingDate.includes('T')) {
        sailingDate = sailingDate.split('T')[0];
      }

      // Prepare cruise data
      const cruiseData = {
        id: cruiseId,
        cruiseId: data.cruiseid || data.cruise_id,
        name: data.name || data.title || data.cruisename || 'Unknown Cruise',
        cruiseLineId: file.lineId,
        shipId: file.shipId || data.shipid || 0,
        nights: parseInt(data.nights || data.duration || 0),
        sailingDate: sailingDate || new Date().toISOString().split('T')[0],
        embarkPortId: data.embarkportid || data.embarkation_port_id || 0,
        disembarkPortId: data.disembarkportid || data.disembarkation_port_id || 0,
        rawData: data,
        updatedAt: new Date(),
      };

      // Upsert cruise
      await db
        .insert(cruises)
        .values(cruiseData)
        .onConflictDoUpdate({
          target: cruises.id,
          set: {
            name: cruiseData.name,
            nights: cruiseData.nights,
            sailingDate: cruiseData.sailingDate,
            rawData: cruiseData.rawData,
            updatedAt: new Date(),
          },
        });

      // Update pricing if available
      await this.updatePricing(cruiseId, data);
    } catch (error) {
      console.error(`[PRODUCTION] Failed to process ${file.path}:`, error);
      throw error;
    } finally {
      ftpPool.releaseConnection(client);
    }
  }

  private async updatePricing(cruiseId: string, data: any): Promise<void> {
    try {
      const pricingData = data.prices || data.pricing || data.cabins || data.categories;

      if (!pricingData) {
        return;
      }

      let interiorPrice = null;
      let oceanviewPrice = null;
      let balconyPrice = null;
      let suitePrice = null;

      if (Array.isArray(pricingData)) {
        for (const cabin of pricingData) {
          const price = parseFloat(
            cabin.price ||
            cabin.adult_price ||
            cabin.adultprice ||
            cabin.cheapest_price ||
            cabin.from_price ||
            0
          );

          if (!price || price === 0) continue;

          const category = (
            cabin.category ||
            cabin.cabin_type ||
            cabin.cabintype ||
            cabin.type ||
            ''
          ).toLowerCase();

          if (category.includes('interior') || category.includes('inside')) {
            if (!interiorPrice || price < interiorPrice) {
              interiorPrice = price;
            }
          } else if (category.includes('ocean') || category.includes('outside')) {
            if (!oceanviewPrice || price < oceanviewPrice) {
              oceanviewPrice = price;
            }
          } else if (category.includes('balcony') || category.includes('verandah')) {
            if (!balconyPrice || price < balconyPrice) {
              balconyPrice = price;
            }
          } else if (category.includes('suite') || category.includes('penthouse')) {
            if (!suitePrice || price < suitePrice) {
              suitePrice = price;
            }
          }
        }
      }

      if (interiorPrice || oceanviewPrice || balconyPrice || suitePrice) {
        await db
          .update(cruises)
          .set({
            interiorPrice: interiorPrice?.toString(),
            oceanviewPrice: oceanviewPrice?.toString(),
            balconyPrice: balconyPrice?.toString(),
            suitePrice: suitePrice?.toString(),
            updatedAt: new Date(),
          })
          .where(eq(cruises.id, cruiseId));
      }
    } catch (error) {
      console.error(`[PRODUCTION] Failed to update pricing for ${cruiseId}:`, error);
    }
  }

  private async discoverAllFiles(lineId: number): Promise<any[]> {
    const client = await ftpPool.getConnection();
    const allFiles: any[] = [];

    try {
      const now = new Date();

      // Check current month and next N months
      for (let monthOffset = 0; monthOffset < CONFIG.MAX_MONTHS_AHEAD; monthOffset++) {
        const checkDate = new Date(now);
        checkDate.setMonth(checkDate.getMonth() + monthOffset);

        const year = checkDate.getFullYear();
        const month = (checkDate.getMonth() + 1).toString().padStart(2, '0');
        const linePath = `/${year}/${month}/${lineId}`;

        try {
          console.log(`[PRODUCTION] Discovering files in ${linePath}...`);
          const shipDirs = await client.list(linePath);

          // Process ships in batches to avoid timeout
          for (const shipDir of shipDirs) {
            if (shipDir.type === 2) { // Directory
              const shipPath = `${linePath}/${shipDir.name}`;

              try {
                const cruiseFiles = await client.list(shipPath);

                for (const file of cruiseFiles) {
                  if (file.type === 1 && file.name.endsWith('.json')) {
                    allFiles.push({
                      path: `${shipPath}/${file.name}`,
                      name: file.name,
                      lineId: lineId,
                      shipId: parseInt(shipDir.name) || 0,
                      cruiseId: file.name.replace('.json', ''),
                      size: file.size,
                    });
                  }
                }
              } catch (error) {
                console.error(`[PRODUCTION] Error listing ${shipPath}:`, error);
                // Continue with other ships even if one fails
              }
            }
          }

          console.log(`[PRODUCTION] Found ${allFiles.length} files so far in ${linePath}`);
        } catch (error) {
          // No data for this month, continue
          console.log(`[PRODUCTION] No data in ${linePath}`);
        }
      }
    } finally {
      ftpPool.releaseConnection(client);
    }

    return allFiles;
  }

  private async releaseLock(lockId: number): Promise<void> {
    try {
      await db
        .update(syncLocks)
        .set({ isActive: false, releasedAt: new Date() })
        .where(eq(syncLocks.id, lockId));
    } catch (error) {
      console.error(`[PRODUCTION] Failed to release lock ${lockId}:`, error);
    }
  }

  getProcessingStatus(lineId?: number): any {
    if (lineId) {
      const state = activeProcessing.get(lineId);
      if (!state) {
        return { lineId, status: 'not_processing' };
      }

      return {
        lineId,
        status: state.status,
        totalFiles: state.totalFiles,
        processedFiles: state.processedFiles,
        progress: state.totalFiles > 0 ? `${Math.round((state.processedFiles / state.totalFiles) * 100)}%` : '0%',
        duration: `${Math.round((Date.now() - state.startTime) / 1000)}s`,
        error: state.error,
      };
    }

    // Return status for all lines
    const allStatus: any[] = [];
    for (const [lineId, state] of activeProcessing.entries()) {
      allStatus.push({
        lineId,
        status: state.status,
        progress: `${state.processedFiles}/${state.totalFiles}`,
        duration: `${Math.round((Date.now() - state.startTime) / 1000)}s`,
      });
    }

    return { activeProcessing: allStatus };
  }

  async cleanup(): Promise<void> {
    await ftpPool.closeAll();
  }
}

// Export singleton
export const webhookProcessorProduction = new WebhookProcessorProduction();
