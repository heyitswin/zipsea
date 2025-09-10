import { db } from '../db/connection';
import { webhookEvents, systemFlags, syncLocks } from '../db/schema/webhook-events';
import { cruises, pricing } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { slackService } from './slack.service';
import * as ftp from 'basic-ftp';
import * as fs from 'fs/promises';

export class WebhookProcessorSimpleFTP {
  async processWebhooks(lineId?: number) {
    let lock: any = null;

    try {
      console.log(`[SIMPLE-FTP] Starting webhook processing for line ${lineId || 'all'}`);

      // Send initial notification
      await this.sendSlackNotification({
        text: `🚀 Processing webhook for line ${lineId || 'all'}`,
        fields: [
          { title: 'Status', value: 'Starting', short: true },
          { title: 'Mode', value: 'Simple FTP', short: true },
        ],
      });

      // Acquire lock
      const lockKey = `webhook-sync-${lineId || 'all'}`;

      const existingLock = await db
        .select()
        .from(syncLocks)
        .where(eq(syncLocks.lockKey, lockKey))
        .limit(1);

      if (existingLock.length > 0 && existingLock[0].isActive) {
        const lockAge = Date.now() - new Date(existingLock[0].acquiredAt).getTime();
        if (lockAge < 30 * 60 * 1000) {
          throw new Error('Another sync process is already running');
        }
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

      lock = locks[0];
      console.log(`[SIMPLE-FTP] Acquired lock ${lock.id}`);

      // Process a single recent file as a test
      const processed = await this.processSingleRecentFile(lineId);

      if (processed) {
        await this.sendSlackNotification({
          text: `✅ Webhook processed successfully`,
          fields: [
            { title: 'Line ID', value: lineId ? lineId.toString() : 'All', short: true },
            { title: 'Status', value: 'Success', short: true },
          ],
        });
      } else {
        await this.sendSlackNotification({
          text: `⚠️ No recent files found`,
          fields: [
            { title: 'Line ID', value: lineId ? lineId.toString() : 'All', short: true },
            { title: 'Status', value: 'No files', short: true },
          ],
        });
      }

    } catch (error) {
      console.error('[SIMPLE-FTP] Processing failed:', error);
      await this.sendSlackError('Webhook processing failed', error as Error);
      throw error;
    } finally {
      if (lock) {
        try {
          await db
            .update(syncLocks)
            .set({ isActive: false, releasedAt: new Date() })
            .where(eq(syncLocks.id, lock.id));
          console.log(`[SIMPLE-FTP] Released lock ${lock.id}`);
        } catch (error) {
          console.error(`[SIMPLE-FTP] Failed to release lock:`, error);
        }
      }
    }
  }

  private async processSingleRecentFile(lineId?: number): Promise<boolean> {
    const client = new ftp.Client();
    client.ftp.verbose = false;

    try {
      // Connect using working config
      const ftpConfig = {
        host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
        user: process.env.TRAVELTEK_FTP_USER || '',
        password: process.env.TRAVELTEK_FTP_PASSWORD || '',
        secure: false,
        timeout: 30000,
        verbose: false,
      };

      await client.access(ftpConfig);
      console.log('[SIMPLE-FTP] Connected to FTP');

      // Check current month, current day
      const now = new Date();
      const year = now.getFullYear();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const day = now.getDate().toString().padStart(2, '0');
      const dayPath = `/${year}/${month}/${day}`;

      console.log(`[SIMPLE-FTP] Checking ${dayPath}...`);

      try {
        const files = await client.list(dayPath);
        console.log(`[SIMPLE-FTP] Found ${files.length} files in ${dayPath}`);

        // Find a file for this line
        const targetFile = files.find(f => {
          if (f.type !== 1 || !f.name.endsWith('.jsonl')) return false;
          if (!lineId) return true;
          const match = f.name.match(/line_(\d+)_/);
          return match && parseInt(match[1]) === lineId;
        });

        if (!targetFile) {
          console.log('[SIMPLE-FTP] No matching files found for today');
          return false;
        }

        // Process this one file
        const filePath = `${dayPath}/${targetFile.name}`;
        console.log(`[SIMPLE-FTP] Processing ${filePath}...`);

        const tempFile = `/tmp/webhook-${Date.now()}.jsonl`;
        await client.downloadTo(tempFile, filePath);

        // Read and process
        const content = await fs.readFile(tempFile, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());

        console.log(`[SIMPLE-FTP] Processing ${lines.length} lines from file`);

        let cruisesProcessed = 0;
        for (const line of lines.slice(0, 10)) { // Process only first 10 lines as test
          try {
            const data = JSON.parse(line);
            if (data.id) {
              await this.updateCruise(data);
              cruisesProcessed++;
            }
          } catch (error) {
            console.error('[SIMPLE-FTP] Error processing line:', error);
          }
        }

        await fs.unlink(tempFile).catch(() => {});

        console.log(`[SIMPLE-FTP] Processed ${cruisesProcessed} cruises from ${targetFile.name}`);
        return true;

      } catch (error) {
        console.log(`[SIMPLE-FTP] Could not access ${dayPath}:`, error);
        return false;
      }

    } catch (error) {
      console.error('[SIMPLE-FTP] FTP error:', error);
      throw error;
    } finally {
      try {
        client.close();
      } catch (error) {
        console.error('[SIMPLE-FTP] Error closing client:', error);
      }
    }
  }

  private async updateCruise(cruiseData: any) {
    try {
      await db
        .insert(cruises)
        .values({
          id: cruiseData.id,
          name: cruiseData.name || 'Unknown',
          cruiseLineId: cruiseData.lineId || cruiseData.cruiselineid || 0,
          shipId: cruiseData.shipId || cruiseData.shipid || 0,
          nights: cruiseData.nights || 0,
          sailingDate: cruiseData.embarkDate || cruiseData.embarkdate || new Date().toISOString().split('T')[0],
          embarkationPortId: cruiseData.embarkPortId || cruiseData.embarkportid || 0,
          disembarkationPortId: cruiseData.disembarkPortId || cruiseData.disembarkportid || 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: cruises.id,
          set: {
            name: cruiseData.name,
            nights: cruiseData.nights,
            sailingDate: cruiseData.embarkDate || cruiseData.embarkdate,
            updatedAt: new Date(),
          },
        });
    } catch (error) {
      console.error(`[SIMPLE-FTP] Failed to update cruise ${cruiseData.id}:`, error);
    }
  }

  private async sendSlackNotification(notification: any) {
    try {
      await slackService.sendNotification(notification);
    } catch (error) {
      console.error('[SIMPLE-FTP] Failed to send Slack notification');
    }
  }

  private async sendSlackError(message: string, error: Error) {
    try {
      await slackService.sendError(message, error);
    } catch (error) {
      console.error('[SIMPLE-FTP] Failed to send Slack error');
    }
  }
}
