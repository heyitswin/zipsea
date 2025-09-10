import { db } from '../db/connection';
import { webhookEvents, systemFlags, syncLocks } from '../db/schema/webhook-events';
import { eq } from 'drizzle-orm';

export class WebhookProcessorMinimal {
  async processWebhooks(lineId?: number) {
    let lock: any = null;

    try {
      console.log(`[MINIMAL] Starting minimal webhook processing for line ${lineId || 'all'}`);

      // Check for existing lock
      const lockKey = `webhook-sync-${lineId || 'all'}`;

      const existingLock = await db
        .select()
        .from(syncLocks)
        .where(eq(syncLocks.lockKey, lockKey))
        .limit(1);

      if (existingLock.length > 0 && existingLock[0].isActive) {
        const lockAge = Date.now() - new Date(existingLock[0].acquiredAt).getTime();
        if (lockAge < 30 * 60 * 1000) {
          console.log(`Lock ${lockKey} is still active (age: ${Math.floor(lockAge / 60000)} minutes)`);
          throw new Error('Another sync process is already running');
        }
        console.log(`Taking over stale lock ${lockKey} (age: ${Math.floor(lockAge / 60000)} minutes)`);
      }

      // Acquire lock
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
      console.log(`[MINIMAL] Acquired lock ${lock.id} for ${lockKey}`);

      // Simulate some processing
      console.log(`[MINIMAL] Processing line ${lineId}...`);
      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log(`[MINIMAL] Processing completed for line ${lineId}`);

      // Update system flags
      await db
        .insert(systemFlags)
        .values({
          flagKey: 'last_minimal_webhook_sync',
          flagValue: new Date().toISOString(),
          metadata: { lineId, processor: 'minimal' },
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: systemFlags.flagKey,
          set: {
            flagValue: new Date().toISOString(),
            metadata: { lineId, processor: 'minimal' },
            updatedAt: new Date(),
          },
        });

      return { success: true, message: 'Minimal processing completed' };
    } catch (error) {
      console.error('[MINIMAL] Processing failed:', error);
      throw error;
    } finally {
      // Always release lock
      if (lock) {
        try {
          await db
            .update(syncLocks)
            .set({ isActive: false, releasedAt: new Date() })
            .where(eq(syncLocks.id, lock.id));
          console.log(`[MINIMAL] Released lock ${lock.id}`);
        } catch (releaseError) {
          console.error(`[MINIMAL] Failed to release lock ${lock.id}:`, releaseError);
        }
      }
    }
  }
}
