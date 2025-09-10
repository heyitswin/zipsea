import { db } from '../db/connection';
import { webhookEvents, systemFlags, syncLocks } from '../db/schema/webhook-events';
import { cruises, pricing } from '../db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { slackService } from './slack.service';
import * as ftp from 'basic-ftp';
import * as fs from 'fs/promises';

interface WebhookFile {
  path: string;
  size: number;
  modifiedAt: Date;
  lineId: number;
  shipId?: number;
  cruiseId?: string;
}

interface ProcessingStats {
  filesDiscovered: number;
  filesProcessed: number;
  filesSkipped: number;
  filesFailed: number;
  cruisesUpdated: number;
  pricesUpdated: number;
  startTime: Date;
  endTime?: Date;
  errors: string[];
}

export class WebhookProcessorCorrectFTP {
  private stats: ProcessingStats = {
    filesDiscovered: 0,
    filesProcessed: 0,
    filesSkipped: 0,
    filesFailed: 0,
    cruisesUpdated: 0,
    pricesUpdated: 0,
    startTime: new Date(),
    errors: [],
  };

  // Configuration
  private readonly MAX_FILES_PER_WEBHOOK = 100; // Process max 100 files per webhook
  private readonly MAX_MONTHS_TO_SCAN = 6; // Scan 6 months into the future
  private readonly LOCK_TIMEOUT = 30 * 60 * 1000; // 30 minutes max lock time

  async processWebhooks(lineId?: number) {
    let lock: any = null;

    try {
      console.log(`[CORRECT-FTP] Starting webhook processing for line ${lineId || 'all'}`);

      // Send initial notification
      await this.sendSlackNotification({
        text: `🚀 Starting webhook processing with correct FTP structure`,
        fields: [
          { title: 'Line ID', value: lineId ? lineId.toString() : 'All lines', short: true },
          { title: 'Max Files', value: this.MAX_FILES_PER_WEBHOOK.toString(), short: true },
        ],
      });

      // Acquire lock
      lock = await this.acquireLock(lineId);

      if (!lineId) {
        throw new Error('Line ID is required for webhook processing');
      }

      // Discover files using correct structure: /year/month/lineId/shipId/cruiseId.json
      const files = await this.discoverFiles(lineId);
      this.stats.filesDiscovered = files.length;

      if (files.length === 0) {
        console.log('[CORRECT-FTP] No files found');
        await this.sendSlackNotification({
          text: `📁 No files found for line ${lineId}`,
        });
        return;
      }

      // Limit files to process
      const filesToProcess = files.slice(0, this.MAX_FILES_PER_WEBHOOK);
      console.log(`[CORRECT-FTP] Processing ${filesToProcess.length} of ${files.length} files`);

      await this.sendSlackNotification({
        text: `📁 Processing ${filesToProcess.length} files`,
        fields: [
          { title: 'Total Found', value: files.length.toString(), short: true },
          { title: 'Processing', value: filesToProcess.length.toString(), short: true },
        ],
      });

      // Process files
      for (const file of filesToProcess) {
        await this.processFile(file);
      }

      // Generate final report
      await this.generateReport();

    } catch (error) {
      console.error('[CORRECT-FTP] Processing failed:', error);
      this.stats.errors.push(error instanceof Error ? error.message : 'Unknown error');
      await this.sendSlackError('Webhook processing failed', error as Error);
      throw error;
    } finally {
      if (lock) {
        await this.releaseLock(lock);
      }
    }
  }

  private async discoverFiles(lineId: number): Promise<WebhookFile[]> {
    const files: WebhookFile[] = [];
    const client = new ftp.Client();
    client.ftp.verbose = false;

    try {
      // Use the working FTP config
      const ftpConfig = {
        host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
        user: process.env.TRAVELTEK_FTP_USER || '',
        password: process.env.TRAVELTEK_FTP_PASSWORD || '',
        secure: false,
        timeout: 30000,
        verbose: false,
      };

      await client.access(ftpConfig);
      console.log('[CORRECT-FTP] FTP connected successfully');

      // Start from current month and scan forward
      const currentDate = new Date();

      for (let monthOffset = 0; monthOffset < this.MAX_MONTHS_TO_SCAN; monthOffset++) {
        const scanDate = new Date(currentDate);
        scanDate.setMonth(scanDate.getMonth() + monthOffset);

        const year = scanDate.getFullYear();
        const month = (scanDate.getMonth() + 1).toString().padStart(2, '0');

        // Correct path structure: /year/month/lineId/
        const linePath = `/${year}/${month}/${lineId}`;

        console.log(`[CORRECT-FTP] Checking ${linePath}...`);

        try {
          // List all ship directories for this line
          const shipDirs = await client.list(linePath);
          console.log(`[CORRECT-FTP] Found ${shipDirs.length} ship directories in ${linePath}`);

          for (const shipDir of shipDirs) {
            if (shipDir.type !== 2) continue; // Skip non-directories
            if (files.length >= this.MAX_FILES_PER_WEBHOOK) break;

            const shipId = parseInt(shipDir.name);
            if (isNaN(shipId)) continue; // Skip invalid ship IDs

            const shipPath = `${linePath}/${shipDir.name}`;

            try {
              // List all cruise JSON files in ship directory
              const cruiseFiles = await client.list(shipPath);

              for (const file of cruiseFiles) {
                if (files.length >= this.MAX_FILES_PER_WEBHOOK) break;
                if (file.type !== 1 || !file.name.endsWith('.json')) continue;

                // Extract cruise ID from filename (remove .json extension)
                const cruiseId = file.name.replace('.json', '');

                files.push({
                  path: `${shipPath}/${file.name}`,
                  size: file.size,
                  modifiedAt: file.modifiedAt || new Date(),
                  lineId: lineId,
                  shipId: shipId,
                  cruiseId: cruiseId,
                });

                console.log(`[CORRECT-FTP] Found file: ${shipPath}/${file.name}`);
              }
            } catch (error) {
              console.log(`[CORRECT-FTP] Could not list ${shipPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }
        } catch (error) {
          console.log(`[CORRECT-FTP] No data for ${linePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          // This is normal for future months that don't exist yet
        }
      }

      console.log(`[CORRECT-FTP] Discovery complete. Found ${files.length} files`);
    } catch (error) {
      console.error('[CORRECT-FTP] FTP connection error:', error);
      throw error;
    } finally {
      try {
        client.close();
      } catch (closeError) {
        console.error('[CORRECT-FTP] Error closing FTP client:', closeError);
      }
    }

    return files;
  }

  private async processFile(file: WebhookFile) {
    const client = new ftp.Client();
    client.ftp.verbose = false;

    try {
      // Connect to FTP
      const ftpConfig = {
        host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
        user: process.env.TRAVELTEK_FTP_USER || '',
        password: process.env.TRAVELTEK_FTP_PASSWORD || '',
        secure: false,
        timeout: 30000,
        verbose: false,
      };

      await client.access(ftpConfig);

      // Download file
      const tempFile = `/tmp/webhook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.json`;
      await client.downloadTo(tempFile, file.path);

      // Read and parse JSON file
      const content = await fs.readFile(tempFile, 'utf-8');
      const data = JSON.parse(content);

      // Process cruise data
      if (data && data.id) {
        await this.updateCruise(data, file.lineId, file.shipId);
        this.stats.cruisesUpdated++;

        // Process pricing if available
        if (data.prices || data.pricing) {
          await this.updatePricing(data.id, data.prices || data.pricing);
          this.stats.pricesUpdated++;
        }
      }

      this.stats.filesProcessed++;

      // Clean up temp file
      await fs.unlink(tempFile).catch(() => {});

      console.log(`[CORRECT-FTP] Processed ${file.path}`);
    } catch (error) {
      console.error(`[CORRECT-FTP] Failed to process ${file.path}:`, error);
      this.stats.filesFailed++;
      this.stats.errors.push(`${file.path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      client.close();
    }
  }

  private async updateCruise(cruiseData: any, lineId: number, shipId?: number) {
    try {
      // Extract the sailing date properly
      let sailingDate = cruiseData.embarkDate || cruiseData.embarkdate || cruiseData.sailingdate;
      if (sailingDate && typeof sailingDate === 'string' && sailingDate.includes('T')) {
        sailingDate = sailingDate.split('T')[0];
      }

      await db
        .insert(cruises)
        .values({
          id: cruiseData.id,
          name: cruiseData.name || cruiseData.title || 'Unknown',
          cruiseLineId: lineId,
          shipId: shipId || cruiseData.shipid || cruiseData.shipId || 0,
          nights: parseInt(cruiseData.nights) || 0,
          sailingDate: sailingDate || new Date().toISOString().split('T')[0],
          embarkationPortId: cruiseData.embarkportid || cruiseData.embarkPortId || 0,
          disembarkationPortId: cruiseData.disembarkportid || cruiseData.disembarkPortId || 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          rawData: cruiseData, // Store complete JSON
        })
        .onConflictDoUpdate({
          target: cruises.id,
          set: {
            name: cruiseData.name || cruiseData.title,
            nights: parseInt(cruiseData.nights) || 0,
            sailingDate: sailingDate,
            updatedAt: new Date(),
            rawData: cruiseData,
          },
        });

      console.log(`[CORRECT-FTP] Updated cruise ${cruiseData.id}`);
    } catch (error) {
      console.error(`[CORRECT-FTP] Failed to update cruise ${cruiseData.id}:`, error);
    }
  }

  private async updatePricing(cruiseId: string, pricingData: any) {
    try {
      // Handle various pricing structures
      if (Array.isArray(pricingData)) {
        for (const price of pricingData) {
          await this.insertPricing(cruiseId, price);
        }
      } else if (typeof pricingData === 'object') {
        // Could be nested by cabin type
        for (const [cabinCode, price] of Object.entries(pricingData)) {
          await this.insertPricing(cruiseId, price, cabinCode);
        }
      }
    } catch (error) {
      console.error(`[CORRECT-FTP] Failed to update pricing for cruise ${cruiseId}:`, error);
    }
  }

  private async insertPricing(cruiseId: string, priceData: any, cabinCode?: string) {
    try {
      const basePrice = priceData.price || priceData.basePrice || priceData.total || 0;
      const taxes = priceData.taxes || priceData.tax || 0;

      await db
        .insert(pricing)
        .values({
          cruiseId: cruiseId,
          cabinCode: cabinCode || priceData.cabinCode || priceData.cabin || 'DEFAULT',
          rateCode: priceData.rateCode || priceData.rate || 'STANDARD',
          basePrice: parseFloat(basePrice) || 0,
          taxes: parseFloat(taxes) || 0,
          totalPrice: parseFloat(basePrice) + parseFloat(taxes),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [pricing.cruiseId, pricing.cabinCode],
          set: {
            basePrice: parseFloat(basePrice) || 0,
            taxes: parseFloat(taxes) || 0,
            totalPrice: parseFloat(basePrice) + parseFloat(taxes),
            updatedAt: new Date(),
          },
        });
    } catch (error) {
      // Silently skip pricing errors as they're not critical
    }
  }

  private async acquireLock(lineId?: number) {
    const lockKey = `webhook-sync-${lineId || 'all'}`;

    const existingLock = await db
      .select()
      .from(syncLocks)
      .where(eq(syncLocks.lockKey, lockKey))
      .limit(1);

    if (existingLock.length > 0 && existingLock[0].isActive) {
      const lockAge = Date.now() - new Date(existingLock[0].acquiredAt).getTime();
      if (lockAge < this.LOCK_TIMEOUT) {
        throw new Error(`Another webhook is processing line ${lineId}`);
      }
      console.log(`[CORRECT-FTP] Taking over stale lock (age: ${Math.floor(lockAge / 60000)} min)`);
    }

    const locks = await db
      .insert(syncLocks)
      .values({
        lockKey,
        isActive: true,
        acquiredAt: new Date(),
        releasedAt: null,
        metadata: { lineId, processId: process.pid },
      })
      .onConflictDoUpdate({
        target: syncLocks.lockKey,
        set: {
          isActive: true,
          acquiredAt: new Date(),
          releasedAt: null,
          metadata: { lineId, processId: process.pid },
        },
      })
      .returning();

    console.log(`[CORRECT-FTP] Acquired lock ${locks[0].id}`);
    return locks[0];
  }

  private async releaseLock(lock: any) {
    try {
      await db
        .update(syncLocks)
        .set({ isActive: false, releasedAt: new Date() })
        .where(eq(syncLocks.id, lock.id));
      console.log(`[CORRECT-FTP] Released lock ${lock.id}`);
    } catch (error) {
      console.error(`[CORRECT-FTP] Failed to release lock ${lock.id}:`, error);
    }
  }

  private async generateReport() {
    this.stats.endTime = new Date();
    const duration = this.stats.endTime.getTime() - this.stats.startTime.getTime();
    const durationMinutes = Math.floor(duration / 60000);
    const durationSeconds = Math.floor((duration % 60000) / 1000);

    await this.sendSlackNotification({
      text: this.stats.filesFailed > 0 ? '⚠️ Webhook processing completed with errors' : '✅ Webhook processing completed',
      fields: [
        { title: 'Duration', value: `${durationMinutes}m ${durationSeconds}s`, short: true },
        { title: 'Files Processed', value: `${this.stats.filesProcessed}/${this.stats.filesDiscovered}`, short: true },
        { title: 'Cruises Updated', value: this.stats.cruisesUpdated.toString(), short: true },
        { title: 'Prices Updated', value: this.stats.pricesUpdated.toString(), short: true },
        { title: 'Errors', value: this.stats.errors.length.toString(), short: true },
        { title: 'Status', value: this.stats.filesFailed > 0 ? 'Partial Success' : 'Success', short: true },
      ],
    });

    // Update system flags
    await db
      .insert(systemFlags)
      .values({
        flagKey: 'last_webhook_sync',
        flagValue: new Date().toISOString(),
        metadata: this.stats,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: systemFlags.flagKey,
        set: {
          flagValue: new Date().toISOString(),
          metadata: this.stats,
          updatedAt: new Date(),
        },
      });
  }

  private async sendSlackNotification(notification: any) {
    try {
      await slackService.sendNotification(notification);
    } catch (error) {
      console.error('[CORRECT-FTP] Failed to send Slack notification');
    }
  }

  private async sendSlackError(message: string, error: Error) {
    try {
      await slackService.sendError(message, error);
    } catch (error) {
      console.error('[CORRECT-FTP] Failed to send Slack error');
    }
  }
}
