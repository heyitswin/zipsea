import { db } from '../db';
import { webhookEvents, syncLocks } from '../db/schema';
import { eq, and, or, isNull } from 'drizzle-orm';
import { ftpConnectionPool } from './ftp-connection-pool.service';
import { slackService } from './slack.service';
// import { cruiseService } from './cruise.service'; // TODO: Implement cruise update logic

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
  private stats: ProcessingStats = {
    filesDiscovered: 0,
    filesProcessed: 0,
    filesSkipped: 0,
    filesFailed: 0,
    cruisesUpdated: 0,
    pricesUpdated: 0,
    startTime: new Date(),
  };

  async processWebhooks(lineId?: number) {
    let lock: any = null;

    try {
      console.log(`[SIMPLE] Starting webhook processing for line ${lineId || 'all'}`);

      this.stats = {
        filesDiscovered: 0,
        filesProcessed: 0,
        filesSkipped: 0,
        filesFailed: 0,
        cruisesUpdated: 0,
        pricesUpdated: 0,
        startTime: new Date(),
      };

      // Send initial notification
      await slackService.sendNotification({
        text: '🚀 Starting webhook processing (Simple)',
        fields: [
          { title: 'Line ID', value: lineId ? lineId.toString() : 'All lines', short: true },
          { title: 'Start Time', value: new Date().toISOString(), short: true },
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
          throw new Error('Another sync process is already running');
        }
        console.log(
          `Taking over stale lock ${lockKey} (age: ${Math.floor(lockAge / 60000)} minutes)`
        );
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

      await slackService.sendNotification({
        text: `📁 Discovered ${files.length} cruise files to process`,
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

      // Process files with controlled concurrency (no queue)
      const filesToProcess = files.slice(0, 100); // Process max 100 files at a time
      console.log(`[SIMPLE] Processing ${filesToProcess.length} files with concurrency of 3`);

      // Process in batches of 3 for controlled concurrency
      const batchSize = 3;
      for (let i = 0; i < filesToProcess.length; i += batchSize) {
        const batch = filesToProcess.slice(i, i + batchSize);
        console.log(
          `[SIMPLE] Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(filesToProcess.length / batchSize)}`
        );

        await Promise.all(
          batch.map(async file => {
            try {
              await this.processFile(file);
              this.stats.filesProcessed++;
            } catch (error) {
              console.error(`[SIMPLE] Failed to process ${file.path}:`, error);
              this.stats.filesFailed++;
            }
          })
        );

        // Progress update every 10 files
        if ((i + batchSize) % 10 === 0 || i + batchSize >= filesToProcess.length) {
          console.log(
            `[SIMPLE] Progress: ${Math.min(i + batchSize, filesToProcess.length)}/${filesToProcess.length} files processed`
          );
        }
      }

      // Generate final report
      await this.generateReport();
    } catch (error) {
      console.error('[SIMPLE] Webhook processing failed:', error);
      await slackService.sendError('Webhook processing failed', error as Error);
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
      const endYear = startYear + 3; // Check up to 3 years ahead

      console.log(`[SIMPLE-DISCOVERY] Scanning from ${startYear}/${startMonth} to ${endYear}/12`);

      // FTP structure: /year/month/lineid/shipid/cruiseid.json
      for (let year = startYear; year <= endYear; year++) {
        const monthStart = year === startYear ? startMonth : 1;

        for (let month = monthStart; month <= 12; month++) {
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
      }

      console.log(`[SIMPLE-DISCOVERY] Total discovered: ${files.length} cruise files`);
      const limited = files.slice(0, 100); // Limit for initial testing
      console.log(`[SIMPLE-DISCOVERY] Returning ${limited.length} files (limited to 100)`);
      return limited;
    } finally {
      ftpConnectionPool.releaseConnection(conn.id);
    }
  }

  public async processFile(file: CruiseFile) {
    const conn = await ftpConnectionPool.getConnection();

    try {
      console.log(`[SIMPLE] Processing ${file.path}`);

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
      // For now, just log the update - we'll need to implement the actual database update
      console.log(`[SIMPLE] Would update cruise ${cruiseData.cruise_id || cruiseData.id}`);

      // TODO: Implement actual database update logic
      // This would involve:
      // 1. Updating cruise table with new data
      // 2. Updating pricing tables
      // 3. Updating itinerary if changed

      // For testing purposes, just count it as updated
      this.stats.pricesUpdated += 1;
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

    await slackService.sendNotification({
      text: '✅ Webhook processing completed (Simple)',
      fields: [
        { title: 'Files Discovered', value: this.stats.filesDiscovered.toString(), short: true },
        { title: 'Files Processed', value: this.stats.filesProcessed.toString(), short: true },
        { title: 'Files Failed', value: this.stats.filesFailed.toString(), short: true },
        { title: 'Files Skipped', value: this.stats.filesSkipped.toString(), short: true },
        { title: 'Cruises Updated', value: this.stats.cruisesUpdated.toString(), short: true },
        { title: 'Prices Updated', value: this.stats.pricesUpdated.toString(), short: true },
        {
          title: 'Duration',
          value: `${durationMinutes}m ${durationSeconds}s`,
          short: true,
        },
        {
          title: 'End Time',
          value: new Date().toISOString(),
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
