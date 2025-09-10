import * as ftp from 'basic-ftp';
import { db } from '../db/connection';
import { cruises } from '../db/schema/cruises';
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

  private stats = {
    filesProcessed: 0,
    cruisesUpdated: 0,
    errors: [] as string[],
  };

  constructor() {
    this.initializeFtpPool();
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
        console.log(`[OPTIMIZED-V2] Connection ${i + 1}/${WebhookProcessorOptimizedV2.MAX_CONNECTIONS} established`);
      } catch (error) {
        console.error(`[OPTIMIZED-V2] Failed to create connection ${i + 1}:`, error);
      }
    }

    // Set up keep-alive
    setInterval(async () => {
      for (const conn of WebhookProcessorOptimizedV2.ftpPool) {
        if (!conn.inUse && Date.now() - conn.lastUsed > WebhookProcessorOptimizedV2.KEEP_ALIVE_INTERVAL) {
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
    console.log(`[OPTIMIZED-V2] FTP pool ready with ${WebhookProcessorOptimizedV2.ftpPool.length} connections`);
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

  async processWebhooks(lineId: number): Promise<void> {
    const startTime = Date.now();
    console.log(`[OPTIMIZED-V2] Starting webhook processing for line ${lineId}`);

    try {
      // Discover files efficiently
      const files = await this.discoverFiles(lineId);
      console.log(`[OPTIMIZED-V2] Found ${files.length} files to process`);

      // Process in parallel batches
      const BATCH_SIZE = 5;
      const filesToProcess = files.slice(0, 20); // Limit to 20 files for webhooks

      for (let i = 0; i < filesToProcess.length; i += BATCH_SIZE) {
        const batch = filesToProcess.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(file => this.processFile(file)));
      }

      const duration = Date.now() - startTime;
      console.log(`[OPTIMIZED-V2] Completed in ${duration}ms - Processed: ${this.stats.filesProcessed}, Updated: ${this.stats.cruisesUpdated}`);
    } catch (error) {
      console.error('[OPTIMIZED-V2] Processing failed:', error);
      throw error;
    }
  }

  private async discoverFiles(lineId: number): Promise<any[]> {
    const conn = await this.getFtpConnection();
    const files: any[] = [];

    try {
      // Only check current month and next month
      const now = new Date();

      for (let monthOffset = 0; monthOffset <= 1; monthOffset++) {
        const checkDate = new Date(now);
        checkDate.setMonth(checkDate.getMonth() + monthOffset);

        const year = checkDate.getFullYear();
        const month = (checkDate.getMonth() + 1).toString().padStart(2, '0');
        const linePath = `/${year}/${month}/${lineId}`;

        try {
          const shipDirs = await conn.client.list(linePath);

          for (const shipDir of shipDirs) {
            if (shipDir.type === 2) { // Directory
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
                  });
                }
              }
            }
          }
        } catch (error) {
          // No data for this month, continue
        }
      }
    } finally {
      this.releaseFtpConnection(conn);
    }

    return files;
  }

  private async processFile(file: any): Promise<void> {
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

      // Update cruise in database
      if (data && (data.id || data.codetocruiseid)) {
        const cruiseId = data.id || data.codetocruiseid || file.cruiseId;

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

        this.stats.cruisesUpdated++;
        console.log(`[OPTIMIZED-V2] Updated cruise ${cruiseId} (${file.size} bytes)`);

        // Update pricing if available
        await this.updatePricing(cruiseId, data);
      }

      this.stats.filesProcessed++;
    } catch (error) {
      console.error(`[OPTIMIZED-V2] Failed to process ${file.path}:`, error);
      this.stats.errors.push(`${file.path}: ${error}`);
    } finally {
      this.releaseFtpConnection(conn);
    }
  }

  private async updatePricing(cruiseId: string, data: any): Promise<void> {
    try {
      // Look for pricing in various possible locations
      const pricingData = data.prices || data.pricing || data.cabins || data.categories;

      if (!pricingData) {
        return;
      }

      let interiorPrice = null;
      let oceanviewPrice = null;
      let balconyPrice = null;
      let suitePrice = null;

      // Handle different pricing structures
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
      } else if (typeof pricingData === 'object') {
        // Handle object-based pricing structure
        interiorPrice = parseFloat(pricingData.interior_price || pricingData.inside_price || 0) || null;
        oceanviewPrice = parseFloat(pricingData.oceanview_price || pricingData.outside_price || 0) || null;
        balconyPrice = parseFloat(pricingData.balcony_price || 0) || null;
        suitePrice = parseFloat(pricingData.suite_price || 0) || null;
      }

      // Update cruise with pricing if we found any
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

        console.log(`[OPTIMIZED-V2] Updated pricing for cruise ${cruiseId}`);
      }
    } catch (error) {
      console.error(`[OPTIMIZED-V2] Failed to update pricing for ${cruiseId}:`, error);
    }
  }
}
