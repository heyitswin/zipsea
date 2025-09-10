import { db } from '../db/connection';
import { syncLocks } from '../db/schema/webhook-events';
import { eq } from 'drizzle-orm';
import { ftpConnectionPool } from './ftp-connection-pool.service';

export class WebhookProcessorDiscovery {
  async testDiscovery(lineId: number): Promise<{ success: boolean; files: any[]; error?: string }> {
    const lockKey = `webhook-sync-${lineId}`;
    let lock: any = null;

    try {
      console.log(`[DISCOVERY] Starting file discovery for line ${lineId}`);

      // Acquire lock
      const locks = await db
        .insert(syncLocks)
        .values({
          lockKey,
          isActive: true,
          acquiredAt: new Date(),
          releasedAt: null,
          metadata: { lineId, processor: 'discovery' },
        })
        .onConflictDoUpdate({
          target: syncLocks.lockKey,
          set: {
            isActive: true,
            acquiredAt: new Date(),
            releasedAt: null,
            metadata: { lineId, processor: 'discovery' },
          },
        })
        .returning();

      lock = locks[0];
      console.log(`[DISCOVERY] Lock acquired: ${lock.id}`);

      // Try to discover files
      const files = await this.discoverFiles(lineId);
      console.log(`[DISCOVERY] Found ${files.length} files`);

      // Release lock
      await db
        .update(syncLocks)
        .set({
          isActive: false,
          releasedAt: new Date()
        })
        .where(eq(syncLocks.id, lock.id));

      console.log(`[DISCOVERY] Lock released: ${lock.id}`);

      return {
        success: true,
        files: files.slice(0, 5) // Return first 5 files only
      };

    } catch (error) {
      console.error(`[DISCOVERY] Error:`, error);

      // Always try to release the lock on error
      if (lock) {
        try {
          await db
            .update(syncLocks)
            .set({
              isActive: false,
              releasedAt: new Date()
            })
            .where(eq(syncLocks.id, lock.id));
          console.log(`[DISCOVERY] Lock released on error: ${lock.id}`);
        } catch (releaseError) {
          console.error(`[DISCOVERY] Failed to release lock:`, releaseError);
        }
      }

      return {
        success: false,
        files: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async discoverFiles(lineId: number): Promise<any[]> {
    const files: any[] = [];

    console.log(`[DISCOVERY] Getting FTP connection...`);
    const conn = await ftpConnectionPool.getConnection();

    try {
      console.log(`[DISCOVERY] Got connection: ${conn.id}`);

      // Just check current month
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
      const basePath = `/${year}/${month}`;

      console.log(`[DISCOVERY] Checking path: ${basePath}`);

      try {
        const dayDirs = await conn.client.list(basePath);
        console.log(`[DISCOVERY] Found ${dayDirs.length} day directories`);

        // Just check first day directory
        for (const dayDir of dayDirs.slice(0, 1)) {
          if (dayDir.type === 2) { // Directory
            const dayPath = `${basePath}/${dayDir.name}`;
            console.log(`[DISCOVERY] Checking day: ${dayPath}`);

            const dayFiles = await conn.client.list(dayPath);

            for (const file of dayFiles) {
              if (file.type === 1 && file.name.endsWith('.jsonl')) {
                // Extract line ID from filename
                const match = file.name.match(/line_(\d+)_/);
                if (match) {
                  const fileLineId = parseInt(match[1]);
                  if (fileLineId === lineId) {
                    files.push({
                      path: `${dayPath}/${file.name}`,
                      size: file.size,
                      lineId: fileLineId,
                    });
                    console.log(`[DISCOVERY] Found file for line ${lineId}: ${file.name}`);
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.log(`[DISCOVERY] No data for ${basePath}:`, error);
      }

    } finally {
      console.log(`[DISCOVERY] Releasing FTP connection...`);
      ftpConnectionPool.releaseConnection(conn.id);
    }

    return files;
  }
}
