import { db } from '../db/connection';
import { syncLocks } from '../db/schema/webhook-events';
import { eq } from 'drizzle-orm';

export class WebhookProcessorSimple {
  async processSimple(lineId: number): Promise<{ success: boolean; message: string }> {
    const lockKey = `webhook-sync-${lineId}`;
    let lock: any = null;

    try {
      console.log(`[SIMPLE] Processing webhook for line ${lineId}`);

      // Try to acquire lock using upsert
      console.log(`[SIMPLE] Acquiring lock for ${lockKey}`);
      const locks = await db
        .insert(syncLocks)
        .values({
          lockKey,
          isActive: true,
          acquiredAt: new Date(),
          releasedAt: null,
          metadata: { lineId, processor: 'simple' },
        })
        .onConflictDoUpdate({
          target: syncLocks.lockKey,
          set: {
            isActive: true,
            acquiredAt: new Date(),
            releasedAt: null,
            metadata: { lineId, processor: 'simple' },
          },
        })
        .returning();

      lock = locks[0];
      console.log(`[SIMPLE] Lock acquired: ${lock.id}`);

      // Simulate some processing work
      console.log(`[SIMPLE] Simulating processing for line ${lineId}...`);
      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log(`[SIMPLE] Processing completed successfully`);

      // Release lock
      await db
        .update(syncLocks)
        .set({
          isActive: false,
          releasedAt: new Date()
        })
        .where(eq(syncLocks.id, lock.id));

      console.log(`[SIMPLE] Lock released: ${lock.id}`);

      return {
        success: true,
        message: `Successfully processed webhook for line ${lineId}`
      };

    } catch (error) {
      console.error(`[SIMPLE] Error processing webhook:`, error);

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
          console.log(`[SIMPLE] Lock released on error: ${lock.id}`);
        } catch (releaseError) {
          console.error(`[SIMPLE] Failed to release lock:`, releaseError);
        }
      }

      throw error;
    }
  }
}
