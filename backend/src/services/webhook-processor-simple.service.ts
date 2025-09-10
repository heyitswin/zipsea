import { db } from '../db';
import { webhookEvents, syncLocks } from '../db/schema';
import { eq, and, or, isNull } from 'drizzle-orm';
import { ftpConnectionPool } from './ftp-connection-pool.service';
import { slackService } from './slack.service';
import { getCruiseDataProcessor } from './cruise-data-processor.service';

interface CruiseFile {
  path: string;
  name: string;
  cruiseId: string;
  shipId: string;
  lineId: string;
  year: string;
  month: string;
  size: number;
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
}

export class WebhookProcessorSimple {
  private stats: ProcessingStats;
  private dataProcessor = getCruiseDataProcessor();

  constructor() {
    this.stats = this.initializeStats();
  }

  private initializeStats(): ProcessingStats {
    return {
      filesDiscovered: 0,
      filesProcessed: 0,
      filesSkipped: 0,
      filesFailed: 0,
      cruisesUpdated: 0,
      pricesUpdated: 0,
      startTime: new Date(),
    };
  }

  async processWebhooks(lineId?: number) {
    let lock: any = null;

    try {
      console.log(`[SIMPLE] Starting webhook processing for line ${lineId || 'all'}`);

      // Reset stats for this processing run
      this.stats = this.initializeStats();

      // Send initial notification
      await slackService.sendNotification({
        text: `🚀 Webhook received for Line ${lineId || 'All'}`,
        fields: [
          { title: 'Line ID', value: lineId ? lineId.toString() : 'All lines', short: true },
          { title: 'Start Time', value: new Date().toISOString(), short: true },
          { title: 'Process ID', value: process.pid.toString(), short: true },
        ],
      });

      // Acquire lock
      const lockKey = `webhook-sync-${lineId || 'all'}`;

      // Check for existing lock
      const existingLock = await db
        .select()
        .from(syncLocks)
        .where(eq(syncLocks.lockKey, lockKey))
        .limit(1);

      if (existingLock.length > 0 && existingLock[0].isActive) {
        const lockAge = Date.now() - new Date(existingLock[0].acquiredAt).getTime();
        if (lockAge < 30 * 60 * 1000) {
          console.log(
            `Lock ${lockKey} is still active (age: ${Math.floor(lockAge / 60000)} minutes)`
          );

          // Notify about queued webhook
          await slackService.sendNotification({
            text: `⏳ Webhook queued - Line ${lineId || 'All'} is already being processed`,
            fields: [
              { title: 'Status', value: 'Queued', short: true },
              { title: 'Lock Age', value: `${Math.floor(lockAge / 60000)} minutes`, short: true },
              {
                title: 'Action',
                value: 'Will retry after current processing completes',
                short: true,
              },
            ],
          });

          throw new Error('Another sync process is already running');
        }
        console.log(
          `Taking over stale lock ${lockKey} (age: ${Math.floor(lockAge / 60000)} minutes)`
        );

        await slackService.sendNotification({
          text: `⚠️ Taking over stale lock for Line ${lineId || 'All'}`,
          fields: [
            { title: 'Lock Age', value: `${Math.floor(lockAge / 60000)} minutes`, short: true },
            { title: 'Action', value: 'Proceeding with processing', short: true },
          ],
        });
      }

      // Acquire or update lock
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

      lock = locks[0];
      console.log(`[SIMPLE] Acquired lock ${lock.id} for ${lockKey}`);

      // Discover files using correct FTP structure
      const files = await this.discoverFiles(lineId);
      this.stats.filesDiscovered = files.length;

      console.log(`[SIMPLE] Discovered ${files.length} cruise files`);

      // More informative discovery notification
      const totalSize = files.reduce((sum, f) => sum + f.size, 0);
      const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);

      // Calculate actual date range from discovered files
      const months = [...new Set(files.map(f => `${f.year}/${f.month}`))].sort();
      const dateRange =
        months.length > 0 ? `${months[0]} to ${months[months.length - 1]}` : 'No files';

      await slackService.sendNotification({
        text: `📁 File discovery complete for Line ${lineId || 'All'}`,
        fields: [
          { title: 'Files Found', value: files.length.toString(), short: true },
          { title: 'Total Size', value: `${sizeMB} MB`, short: true },
          { title: 'Date Range', value: dateRange, short: true },
          { title: 'Months Scanned', value: months.length.toString(), short: true },
        ],
      });

      if (files.length === 0) {
        console.log('[SIMPLE] No files to process');
        await slackService.sendNotification({
          text: '✅ No files found to process',
          fields: [
            { title: 'Line ID', value: lineId ? lineId.toString() : 'All', short: true },
            { title: 'Result', value: 'No updates needed', short: true },
          ],
        });
        return;
      }

      // Process ALL files, not just first 20
      const filesToProcess = files; // Process ALL files
      console.log(`[SIMPLE] Processing ${filesToProcess.length} files with concurrency of 3`);

      // Send processing start notification
      await slackService.sendNotification({
        text: `⚙️ Starting to process ${filesToProcess.length} files for Line ${lineId || 'All'}`,
        fields: [
          { title: 'Total Files', value: filesToProcess.length.toString(), short: true },
          { title: 'Batch Size', value: '3', short: true },
          {
            title: 'Estimated Time',
            value: `${Math.ceil((filesToProcess.length / 3) * 2)} seconds`,
            short: true,
          },
        ],
      });

      // Process in batches of 3 for controlled concurrency
      const batchSize = 3;
      for (let i = 0; i < filesToProcess.length; i += batchSize) {
        const batch = filesToProcess.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(filesToProcess.length / batchSize);

        console.log(
          `[SIMPLE] Starting batch ${batchNum} of ${totalBatches} (files ${i + 1}-${Math.min(i + batchSize, filesToProcess.length)})`
        );

        const batchStart = Date.now();
        await Promise.all(
          batch.map(async file => {
            const fileStart = Date.now();
            try {
              console.log(`[SIMPLE] Starting file: ${file.path}`);
              await this.processFile(file);
              this.stats.filesProcessed++;
              console.log(`[SIMPLE] Completed file: ${file.path} (${Date.now() - fileStart}ms)`);
            } catch (error) {
              console.error(
                `[SIMPLE] Failed to process ${file.path} after ${Date.now() - fileStart}ms:`,
                error
              );
              this.stats.filesFailed++;
            }
          })
        );

        console.log(`[SIMPLE] Batch ${batchNum} completed in ${Date.now() - batchStart}ms`);

        // Progress update every 10 files
        if ((i + batchSize) % 10 === 0 || i + batchSize >= filesToProcess.length) {
          const processed = Math.min(i + batchSize, filesToProcess.length);
          const percentage = Math.round((processed / filesToProcess.length) * 100);

          console.log(
            `[SIMPLE] Progress: ${processed}/${filesToProcess.length} files processed (${percentage}%)`
          );

          // Send progress update to Slack every 25%
          if (percentage % 25 === 0 || processed === filesToProcess.length) {
            await slackService.sendNotification({
              text: `📊 Processing progress: ${percentage}% complete`,
              fields: [
                {
                  title: 'Files Processed',
                  value: `${processed}/${filesToProcess.length}`,
                  short: true,
                },
                {
                  title: 'Success Rate',
                  value: `${Math.round((this.stats.filesProcessed / processed) * 100)}%`,
                  short: true,
                },
                { title: 'Failed', value: this.stats.filesFailed.toString(), short: true },
              ],
            });
          }
        }
      }

      // Generate final report
      await this.generateReport();
    } catch (error) {
      console.error('[SIMPLE] Webhook processing failed:', error);

      // Send more detailed error notification
      const errorMessage = error instanceof Error ? error.message : String(error);
      await slackService.sendNotification({
        text: `❌ Webhook processing failed for Line ${lineId || 'All'}`,
        fields: [
          { title: 'Error', value: errorMessage, short: false },
          {
            title: 'Files Processed',
            value: `${this.stats.filesProcessed}/${this.stats.filesDiscovered}`,
            short: true,
          },
          { title: 'Time Failed', value: new Date().toISOString(), short: true },
        ],
      });

      throw error;
    } finally {
      // Always release lock if we acquired one
      if (lock) {
        try {
          await db
            .update(syncLocks)
            .set({ isActive: false, releasedAt: new Date() })
            .where(eq(syncLocks.id, lock.id));
          console.log(`[SIMPLE] Released lock ${lock.id}`);
        } catch (releaseError) {
          console.error(`[SIMPLE] Failed to release lock ${lock?.id}:`, releaseError);
        }
      }
    }
  }

  public async discoverFiles(lineId?: number): Promise<CruiseFile[]> {
    const files: CruiseFile[] = [];
    console.log(`[SIMPLE-DISCOVERY] Starting file discovery for lineId: ${lineId}`);

    const conn = await ftpConnectionPool.getConnection();
    console.log(`[SIMPLE-DISCOVERY] Got FTP connection`);

    try {
      const currentDate = new Date();
      const startYear = currentDate.getFullYear();
      const startMonth = currentDate.getMonth() + 1;

      // Dynamically discover available months on FTP server
      console.log(`[SIMPLE-DISCOVERY] Starting dynamic scan from ${startYear}/${startMonth}`);

      // FTP structure: /year/month/lineid/shipid/cruiseid.json
      const monthsToCheck = [];

      // Scan up to 3 years ahead but stop if no data found
      const maxYearsAhead = 3;
      let consecutiveEmptyMonths = 0;
      const maxConsecutiveEmpty = 6; // Stop after 6 consecutive empty months

      for (let yearOffset = 0; yearOffset <= maxYearsAhead; yearOffset++) {
        const checkYear = startYear + yearOffset;
        const monthStart = checkYear === startYear ? startMonth : 1;

        for (let month = monthStart; month <= 12; month++) {
          const monthStr = month.toString().padStart(2, '0');

          // Check if this month has data for our line
          let hasData = false;

          if (lineId) {
            const linePath = `/${checkYear}/${monthStr}/${lineId}`;
            try {
              const items = await conn.client.list(linePath);
              // Check if there are actual ship directories (not just . and ..)
              hasData = items.some(
                item => item.type === 2 && item.name !== '.' && item.name !== '..'
              );
            } catch (error) {
              // Directory doesn't exist
              hasData = false;
            }
          } else {
            // Check if month directory exists and has any line folders
            const monthPath = `/${checkYear}/${monthStr}`;
            try {
              const items = await conn.client.list(monthPath);
              hasData = items.some(item => item.type === 2 && item.name.match(/^\d+$/));
            } catch (error) {
              hasData = false;
            }
          }

          if (hasData) {
            monthsToCheck.push({ year: checkYear, month });
            consecutiveEmptyMonths = 0;
            console.log(`[SIMPLE-DISCOVERY] Found data for ${checkYear}/${monthStr}`);
          } else {
            consecutiveEmptyMonths++;
            // Don't break immediately - there might be gaps in the data
            if (consecutiveEmptyMonths >= maxConsecutiveEmpty) {
              console.log(
                `[SIMPLE-DISCOVERY] No data found for ${maxConsecutiveEmpty} consecutive months, stopping scan`
              );
              break;
            }
          }
        }

        // If we've seen too many empty months, stop scanning years
        if (consecutiveEmptyMonths >= maxConsecutiveEmpty) {
          break;
        }
      }

      console.log(
        `[SIMPLE-DISCOVERY] Will check: ${monthsToCheck.map(m => `${m.year}/${m.month}`).join(', ')}`
      );

      for (const { year, month } of monthsToCheck) {
        const monthStr = month.toString().padStart(2, '0');

        if (lineId) {
          // Specific line: /year/month/lineid/
          const linePath = `/${year}/${monthStr}/${lineId}`;
          console.log(`[SIMPLE-DISCOVERY] Checking path: ${linePath}`);

          try {
            const shipDirs = await conn.client.list(linePath);
            console.log(`[SIMPLE-DISCOVERY] Listed ${linePath}, found ${shipDirs.length} items`);

            if (shipDirs.length > 0) {
              console.log(
                `[SIMPLE-DISCOVERY] Found ${shipDirs.length} ships for line ${lineId} in ${year}/${monthStr}`
              );
            }

            // For each ship directory
            for (const shipDir of shipDirs) {
              if (shipDir.type === 2 && shipDir.name !== '.' && shipDir.name !== '..') {
                const shipPath = `${linePath}/${shipDir.name}`;

                try {
                  const cruiseFiles = await conn.client.list(shipPath);

                  for (const cruiseFile of cruiseFiles) {
                    if (cruiseFile.name.endsWith('.json')) {
                      const cruiseId = cruiseFile.name.replace('.json', '');
                      files.push({
                        path: `${shipPath}/${cruiseFile.name}`,
                        name: cruiseFile.name,
                        cruiseId,
                        shipId: shipDir.name,
                        lineId: lineId.toString(),
                        year: year.toString(),
                        month: monthStr,
                        size: cruiseFile.size,
                      });
                    }
                  }
                } catch (error) {
                  console.log(`[SIMPLE-DISCOVERY] No cruise files in ${shipPath}`);
                }
              }
            }
          } catch (error) {
            // Directory doesn't exist for this month/line combination
            console.log(`[SIMPLE-DISCOVERY] Path ${linePath} not found, skipping`);
          }
        } else {
          // All lines: /year/month/
          const monthPath = `/${year}/${monthStr}`;

          try {
            const lineDirs = await conn.client.list(monthPath);

            for (const lineDir of lineDirs) {
              if (lineDir.type === 2 && lineDir.name !== '.' && lineDir.name !== '..') {
                const linePath = `${monthPath}/${lineDir.name}`;

                try {
                  const shipDirs = await conn.client.list(linePath);

                  for (const shipDir of shipDirs) {
                    if (shipDir.type === 2 && shipDir.name !== '.' && shipDir.name !== '..') {
                      const shipPath = `${linePath}/${shipDir.name}`;

                      try {
                        const cruiseFiles = await conn.client.list(shipPath);

                        for (const cruiseFile of cruiseFiles) {
                          if (cruiseFile.name.endsWith('.json')) {
                            const cruiseId = cruiseFile.name.replace('.json', '');
                            files.push({
                              path: `${shipPath}/${cruiseFile.name}`,
                              name: cruiseFile.name,
                              cruiseId,
                              shipId: shipDir.name,
                              lineId: lineDir.name,
                              year: year.toString(),
                              month: monthStr,
                              size: cruiseFile.size,
                            });
                          }
                        }
                      } catch (error) {
                        console.log(`[SIMPLE-DISCOVERY] No cruise files in ${shipPath}`);
                      }
                    }
                  }
                } catch (error) {
                  console.log(`[SIMPLE-DISCOVERY] No ships in ${linePath}`);
                }
              }
            }
          } catch (error) {
            console.log(`[SIMPLE-DISCOVERY] Path ${monthPath} not found, skipping`);
          }
        }
      }

      console.log(`[SIMPLE-DISCOVERY] Total discovered: ${files.length} cruise files`);
      // No need to limit if we're only scanning 3 months
      return files;
    } finally {
      ftpConnectionPool.releaseConnection(conn.id);
    }
  }

  public async processFile(file: CruiseFile) {
    const conn = await ftpConnectionPool.getConnection();

    try {
      // Download and parse the JSON file
      const tempFile = `/tmp/webhook-simple-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.json`;
      await conn.client.downloadTo(tempFile, file.path);
      const fs = await import('fs');
      const content = await fs.promises.readFile(tempFile, 'utf-8');
      const cruiseData = JSON.parse(content);

      // Clean up temp file
      await fs.promises.unlink(tempFile).catch(() => {});

      // Process the cruise data
      await this.updateCruise(cruiseData);

      this.stats.cruisesUpdated++;
    } catch (error) {
      console.error(`[SIMPLE] Failed to process ${file.path}:`, error);
      throw error;
    } finally {
      ftpConnectionPool.releaseConnection(conn.id);
    }
  }

  private async updateCruise(cruiseData: any) {
    try {
      // Store raw JSON data in database
      // Traveltek uses 'codetocruiseid' as the unique cruise identifier
      const cruiseId = cruiseData.codetocruiseid || cruiseData.cruise_id || cruiseData.id;
      console.log(`[SIMPLE] Updating cruise ${cruiseId} in database`);

      const lineId = parseInt(cruiseData.line_id || cruiseData.lineId || '0');

      // Use the data processor to extract and populate all tables
      const result = await this.dataProcessor.processCruiseData(cruiseData);

      if (result.success) {
        if (result.action === 'created') {
          console.log(`[SIMPLE] 🆕 Created new cruise ${cruiseId}`);
          this.stats.cruisesUpdated++;
        } else if (result.action === 'updated') {
          console.log(`[SIMPLE] ✅ Updated existing cruise ${cruiseId}`);
          this.stats.cruisesUpdated++;
        }

        // Store webhook event for audit trail
        await db.insert(webhookEvents).values({
          lineId: lineId,
          webhookType: result.action === 'created' ? 'cruise_created' : 'cruise_updated',
          status: 'processed',
          processedAt: new Date(),
          metadata: {
            cruiseId: result.cruiseId,
            action: result.action,
            shipId: cruiseData.ship_id || cruiseData.shipId,
          },
        });

        this.stats.pricesUpdated += 1;
      } else {
        console.error(`[SIMPLE] ❌ Failed to process cruise ${cruiseId}: ${result.error}`);

        // Store failure in webhook events
        await db.insert(webhookEvents).values({
          lineId: lineId,
          webhookType: 'cruise_processing_failed',
          status: 'failed',
          processedAt: new Date(),
          errorMessage: result.error,
          metadata: {
            cruiseCode: cruiseId,
            error: result.error,
          },
        });

        throw new Error(result.error);
      }

      console.log(`[SIMPLE] Successfully processed cruise ${cruiseId}`);
    } catch (error) {
      console.error('[SIMPLE] Failed to update cruise:', error);
      throw error;
    }
  }

  private async generateReport() {
    this.stats.endTime = new Date();
    const duration = this.stats.endTime.getTime() - this.stats.startTime.getTime();
    const durationMinutes = Math.floor(duration / 60000);
    const durationSeconds = Math.floor((duration % 60000) / 1000);

    const successRate =
      this.stats.filesDiscovered > 0
        ? Math.round((this.stats.filesProcessed / this.stats.filesDiscovered) * 100)
        : 0;

    // Determine status emoji and message
    const statusEmoji = this.stats.filesFailed === 0 ? '✅' : '⚠️';
    const statusText =
      this.stats.filesFailed === 0
        ? 'Webhook processing completed successfully'
        : `Webhook processing completed with ${this.stats.filesFailed} errors`;

    await slackService.sendNotification({
      text: `${statusEmoji} ${statusText}`,
      fields: [
        { title: 'Files Discovered', value: this.stats.filesDiscovered.toString(), short: true },
        { title: 'Files Processed', value: this.stats.filesProcessed.toString(), short: true },
        { title: 'Files Failed', value: this.stats.filesFailed.toString(), short: true },
        { title: 'Success Rate', value: `${successRate}%`, short: true },
        { title: 'Database Updates', value: this.stats.cruisesUpdated.toString(), short: true },
        { title: 'Price Updates', value: this.stats.pricesUpdated.toString(), short: true },
        {
          title: 'Duration',
          value: `${durationMinutes}m ${durationSeconds}s`,
          short: true,
        },
        {
          title: 'Processing Speed',
          value: `${(this.stats.filesProcessed / (duration / 1000)).toFixed(1)} files/sec`,
          short: true,
        },
      ],
    });

    console.log('[SIMPLE] Processing complete:', {
      filesDiscovered: this.stats.filesDiscovered,
      filesProcessed: this.stats.filesProcessed,
      filesFailed: this.stats.filesFailed,
      filesSkipped: this.stats.filesSkipped,
      cruisesUpdated: this.stats.cruisesUpdated,
      pricesUpdated: this.stats.pricesUpdated,
      duration: `${durationMinutes}m ${durationSeconds}s`,
    });
  }
}

// Singleton instance
let processorInstance: WebhookProcessorSimple | null = null;

export const getWebhookProcessorSimple = (): WebhookProcessorSimple => {
  if (!processorInstance) {
    processorInstance = new WebhookProcessorSimple();
  }
  return processorInstance;
};
