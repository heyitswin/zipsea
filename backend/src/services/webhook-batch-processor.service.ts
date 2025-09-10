import * as ftp from 'basic-ftp';
import { db } from '../db/connection';
import { cruises } from '../db/schema/cruises';
import { eq } from 'drizzle-orm';
import logger from '../config/logger';
import { Writable } from 'stream';

// Configuration
const CONFIG = {
  FILES_PER_BATCH: 5, // Process only 5 files per batch
  MAX_CONCURRENT_BATCHES: 3, // Process 3 batches concurrently
  MAX_MONTHS_AHEAD: 2, // Only scan 2 months ahead
  MAX_FILES_TOTAL: 50, // Maximum files to process per webhook
};

// Simple in-memory queue for batch processing
interface ProcessingBatch {
  lineId: number;
  files: any[];
  batchNumber: number;
  totalBatches: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
  results?: any;
}

// Global processing state
const processingState = new Map<number, ProcessingBatch[]>();

export class WebhookBatchProcessor {
  private ftpClient: ftp.Client | null = null;

  private async getFtpClient(): Promise<ftp.Client> {
    if (!this.ftpClient) {
      this.ftpClient = new ftp.Client();
      this.ftpClient.ftp.verbose = false;

      const ftpConfig = {
        host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
        user: process.env.TRAVELTEK_FTP_USER || process.env.FTP_USER,
        password: process.env.TRAVELTEK_FTP_PASSWORD || process.env.FTP_PASSWORD,
        secure: false,
        timeout: 20000,
      };

      await this.ftpClient.access(ftpConfig);
    }

    // Test connection is alive
    try {
      await this.ftpClient.pwd();
    } catch (error) {
      // Reconnect if connection is dead
      console.log('[BATCH] Reconnecting to FTP...');
      this.ftpClient = new ftp.Client();
      this.ftpClient.ftp.verbose = false;

      const ftpConfig = {
        host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
        user: process.env.TRAVELTEK_FTP_USER || process.env.FTP_USER,
        password: process.env.TRAVELTEK_FTP_PASSWORD || process.env.FTP_PASSWORD,
        secure: false,
        timeout: 20000,
      };

      await this.ftpClient.access(ftpConfig);
    }

    return this.ftpClient;
  }

  async processWebhook(lineId: number): Promise<any> {
    console.log(`[BATCH] Starting webhook processing for line ${lineId}`);
    const startTime = Date.now();

    try {
      // Check if already processing
      if (processingState.has(lineId)) {
        const existing = processingState.get(lineId)!;
        const activeCount = existing.filter(b => b.status === 'processing').length;
        if (activeCount > 0) {
          console.log(`[BATCH] Line ${lineId} already has ${activeCount} active batches`);
          return {
            status: 'already_processing',
            message: `Line ${lineId} is already being processed`,
            activeBatches: activeCount,
          };
        }
      }

      // Discover files
      const files = await this.discoverFiles(lineId);
      console.log(`[BATCH] Found ${files.length} files for line ${lineId}`);

      if (files.length === 0) {
        return {
          status: 'no_files',
          message: `No files found for line ${lineId}`,
          filesFound: 0,
        };
      }

      // Limit total files
      const filesToProcess = files.slice(0, CONFIG.MAX_FILES_TOTAL);

      // Create batches
      const batches: ProcessingBatch[] = [];
      for (let i = 0; i < filesToProcess.length; i += CONFIG.FILES_PER_BATCH) {
        batches.push({
          lineId,
          files: filesToProcess.slice(i, i + CONFIG.FILES_PER_BATCH),
          batchNumber: batches.length + 1,
          totalBatches: Math.ceil(filesToProcess.length / CONFIG.FILES_PER_BATCH),
          status: 'pending',
        });
      }

      console.log(`[BATCH] Created ${batches.length} batches for line ${lineId}`);
      processingState.set(lineId, batches);

      // Process batches asynchronously
      this.processBatchesAsync(lineId, batches);

      const duration = Date.now() - startTime;
      return {
        status: 'queued',
        message: `Processing ${filesToProcess.length} files in ${batches.length} batches`,
        filesTotal: files.length,
        filesQueued: filesToProcess.length,
        batchCount: batches.length,
        filesPerBatch: CONFIG.FILES_PER_BATCH,
        discoveryTime: `${duration}ms`,
      };
    } catch (error) {
      console.error(`[BATCH] Failed to process webhook for line ${lineId}:`, error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async processBatchesAsync(lineId: number, batches: ProcessingBatch[]): Promise<void> {
    console.log(`[BATCH] Starting async processing of ${batches.length} batches for line ${lineId}`);

    // Process batches with concurrency limit
    const results = [];
    for (let i = 0; i < batches.length; i += CONFIG.MAX_CONCURRENT_BATCHES) {
      const concurrent = batches.slice(i, i + CONFIG.MAX_CONCURRENT_BATCHES);

      const batchPromises = concurrent.map(batch => this.processSingleBatch(batch));
      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults);

      console.log(`[BATCH] Completed ${Math.min(i + CONFIG.MAX_CONCURRENT_BATCHES, batches.length)}/${batches.length} batches for line ${lineId}`);
    }

    // Summary
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`[BATCH] Completed all batches for line ${lineId}: ${successful} successful, ${failed} failed`);

    // Clear state
    processingState.delete(lineId);
  }

  private async processSingleBatch(batch: ProcessingBatch): Promise<any> {
    console.log(`[BATCH] Processing batch ${batch.batchNumber}/${batch.totalBatches} for line ${batch.lineId} with ${batch.files.length} files`);

    batch.status = 'processing';
    batch.startTime = Date.now();

    const results = {
      processed: 0,
      failed: 0,
      cruisesUpdated: 0,
      errors: [] as string[],
    };

    for (const file of batch.files) {
      try {
        await this.processFile(file);
        results.processed++;
        results.cruisesUpdated++;
      } catch (error) {
        results.failed++;
        results.errors.push(`${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.error(`[BATCH] Failed to process ${file.name}:`, error);
      }
    }

    batch.status = 'completed';
    batch.endTime = Date.now();
    batch.results = results;

    const duration = batch.endTime - batch.startTime;
    console.log(`[BATCH] Batch ${batch.batchNumber} completed in ${duration}ms: ${results.processed} processed, ${results.failed} failed`);

    return results;
  }

  private async processFile(file: any): Promise<void> {
    const client = await this.getFtpClient();

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
      console.log(`[BATCH] Empty file: ${file.path}`);
      return;
    }

    const data = JSON.parse(Buffer.concat(chunks).toString());
    const cruiseId = data.id || data.codetocruiseid || file.cruiseId;

    if (!cruiseId) {
      console.log(`[BATCH] No cruise ID found in ${file.path}`);
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

    console.log(`[BATCH] Updated cruise ${cruiseId}`);

    // Update pricing if available
    await this.updatePricing(cruiseId, data);
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

        console.log(`[BATCH] Updated pricing for cruise ${cruiseId}`);
      }
    } catch (error) {
      console.error(`[BATCH] Failed to update pricing for ${cruiseId}:`, error);
    }
  }

  private async discoverFiles(lineId: number): Promise<any[]> {
    const client = await this.getFtpClient();
    const files: any[] = [];

    const now = new Date();

    // Only check current month and next N months
    for (let monthOffset = 0; monthOffset < CONFIG.MAX_MONTHS_AHEAD; monthOffset++) {
      const checkDate = new Date(now);
      checkDate.setMonth(checkDate.getMonth() + monthOffset);

      const year = checkDate.getFullYear();
      const month = (checkDate.getMonth() + 1).toString().padStart(2, '0');
      const linePath = `/${year}/${month}/${lineId}`;

      try {
        const shipDirs = await client.list(linePath);

        for (const shipDir of shipDirs) {
          if (shipDir.type === 2) { // Directory
            const shipPath = `${linePath}/${shipDir.name}`;
            const cruiseFiles = await client.list(shipPath);

            for (const file of cruiseFiles) {
              if (file.type === 1 && file.name.endsWith('.json')) {
                files.push({
                  path: `${shipPath}/${file.name}`,
                  name: file.name,
                  lineId: lineId,
                  shipId: parseInt(shipDir.name) || 0,
                  cruiseId: file.name.replace('.json', ''),
                  size: file.size,
                });
              }
            }
          }
        }

        console.log(`[BATCH] Found ${files.length} files in ${linePath}`);
      } catch (error) {
        // No data for this month, continue
      }
    }

    return files;
  }

  getProcessingStatus(lineId?: number): any {
    if (lineId) {
      const batches = processingState.get(lineId);
      if (!batches) {
        return { lineId, status: 'not_processing', batches: [] };
      }

      return {
        lineId,
        status: 'processing',
        batches: batches.map(b => ({
          batchNumber: b.batchNumber,
          totalBatches: b.totalBatches,
          filesCount: b.files.length,
          status: b.status,
          duration: b.endTime && b.startTime ? `${b.endTime - b.startTime}ms` : null,
          results: b.results,
        })),
        summary: {
          total: batches.length,
          pending: batches.filter(b => b.status === 'pending').length,
          processing: batches.filter(b => b.status === 'processing').length,
          completed: batches.filter(b => b.status === 'completed').length,
          failed: batches.filter(b => b.status === 'failed').length,
        },
      };
    }

    // Return status for all lines
    const allStatus: any[] = [];
    for (const [lineId, batches] of processingState.entries()) {
      allStatus.push({
        lineId,
        batchCount: batches.length,
        processing: batches.filter(b => b.status === 'processing').length,
        completed: batches.filter(b => b.status === 'completed').length,
      });
    }

    return { lines: allStatus };
  }

  async cleanup(): Promise<void> {
    if (this.ftpClient) {
      this.ftpClient.close();
      this.ftpClient = null;
    }
  }
}

// Export singleton
export const webhookBatchProcessor = new WebhookBatchProcessor();
