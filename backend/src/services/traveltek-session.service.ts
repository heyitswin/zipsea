import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { traveltekApiService } from './traveltek-api.service';
import { db, sql } from '../db/connection';
import { bookingSessions } from '../db/schema/booking-sessions';
import { eq, and, gt, lt } from 'drizzle-orm';

interface PassengerCount {
  adults: number;
  children: number;
  childAges: number[];
}

interface SessionData {
  sessionKey: string;
  sid: string;
  expiresAt: Date;
  passengerCount: PassengerCount;
  cruiseId?: string;
  userId?: string;
}

interface CreateSessionParams {
  cruiseId: string;
  passengerCount: PassengerCount;
  userId?: string;
}

interface UpdateSessionParams {
  selectedCabinGrade?: string;
  selectedCabin?: string;
  basketData?: any;
}

/**
 * Session Management Service for Traveltek Bookings
 *
 * Manages booking sessions with 2-hour TTL that mirror Traveltek's session lifecycle.
 * Stores session data in both Redis (for fast access) and PostgreSQL (for persistence).
 *
 * Session Lifecycle:
 * 1. Create session -> Get Traveltek sessionkey and sid
 * 2. Store in Redis with 2hr TTL and in database
 * 3. Validate session before each booking operation
 * 4. Auto-expire after 2 hours or when booking completes
 */
class TraveltekSessionService {
  private redis: Redis;
  private readonly SESSION_TTL = 7200; // 2 hours in seconds (matches Traveltek)
  private readonly REDIS_KEY_PREFIX = 'booking_session:';

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  /**
   * Create a new booking session
   *
   * This creates both a Traveltek session and our local tracking session.
   * The Traveltek session is required for all subsequent API calls.
   *
   * @param params - Session creation parameters
   * @returns Session ID and session data
   */
  async createSession(params: CreateSessionParams): Promise<{
    sessionId: string;
    sessionData: SessionData;
  }> {
    try {
      // Step 0: Get cruise sailing date to create proper session
      const cruiseResult = await sql`
        SELECT sailing_date FROM cruises WHERE id = ${params.cruiseId} LIMIT 1
      `;

      if (cruiseResult.length === 0) {
        throw new Error(`Cruise ${params.cruiseId} not found`);
      }

      const sailingDate = new Date(cruiseResult[0].sailing_date);

      // Step 1: Create Traveltek session with date range including the cruise
      const traveltekSession = await traveltekApiService.createSession(sailingDate);

      if (!traveltekSession.sessionkey) {
        throw new Error('Failed to create Traveltek session: missing sessionkey');
      }

      // Step 2: Calculate expiry time (2 hours from now)
      const expiresAt = new Date(Date.now() + this.SESSION_TTL * 1000);

      // Step 3: Generate our session ID
      const sessionId = uuidv4();

      // FIXED: Use Traveltek-provided fixed SID value (52471) for cruisepassjson account
      // as specified in Traveltek credentials, not the dynamic sid from API response
      const sessionData: SessionData = {
        sessionKey: traveltekSession.sessionkey,
        sid: '52471',
        expiresAt,
        passengerCount: params.passengerCount,
        cruiseId: params.cruiseId,
        userId: params.userId,
      };

      // Step 4: Store in Redis for fast access
      await this.redis.setex(
        `${this.REDIS_KEY_PREFIX}${sessionId}`,
        this.SESSION_TTL,
        JSON.stringify(sessionData)
      );

      // DEBUG: Log values before database insert
      console.log('[TraveltekSession] About to insert into database:');
      console.log('  sessionId:', sessionId);
      console.log('  cruiseId:', params.cruiseId, 'Type:', typeof params.cruiseId);
      console.log('  userId:', params.userId || null);
      console.log('  passengerCount:', JSON.stringify(params.passengerCount));

      // Step 5: Store in database for persistence
      await db.insert(bookingSessions).values({
        id: sessionId,
        userId: params.userId || null,
        cruiseId: params.cruiseId,
        traveltekSessionKey: traveltekSession.sessionkey,
        traveltekSid: '52471', // Fixed SID for cruisepassjson account
        passengerCount: params.passengerCount,
        status: 'active',
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log(
        `[TraveltekSession] ✅ Successfully created session ${sessionId} for cruise ${params.cruiseId}`
      );

      return { sessionId, sessionData };
    } catch (error) {
      console.error('[TraveltekSession] Failed to create session:', error);
      throw error;
    }
  }

  /**
   * Get session data by session ID
   *
   * First checks Redis for performance, falls back to database if needed.
   * Validates that session hasn't expired.
   *
   * @param sessionId - The booking session ID
   * @returns Session data or null if not found/expired
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      // Try Redis first (faster)
      const redisData = await this.redis.get(`${this.REDIS_KEY_PREFIX}${sessionId}`);

      if (redisData) {
        const sessionData = JSON.parse(redisData) as SessionData;

        // Check if expired
        if (new Date(sessionData.expiresAt) < new Date()) {
          await this.expireSession(sessionId);
          return null;
        }

        return sessionData;
      }

      // Fallback to database
      const dbSession = await db.query.bookingSessions.findFirst({
        where: and(
          eq(bookingSessions.id, sessionId),
          eq(bookingSessions.status, 'active'),
          gt(bookingSessions.expiresAt, new Date()) // FIXED: Correct argument order
        ),
      });

      if (!dbSession) {
        return null;
      }

      // Reconstruct session data
      const sessionData: SessionData = {
        sessionKey: dbSession.traveltekSessionKey,
        sid: dbSession.traveltekSid,
        expiresAt: dbSession.expiresAt,
        passengerCount: dbSession.passengerCount as PassengerCount,
        cruiseId: dbSession.cruiseId,
        userId: dbSession.userId || undefined,
      };

      // Restore to Redis
      const ttl = Math.floor((new Date(dbSession.expiresAt).getTime() - Date.now()) / 1000);
      if (ttl > 0) {
        await this.redis.setex(
          `${this.REDIS_KEY_PREFIX}${sessionId}`,
          ttl,
          JSON.stringify(sessionData)
        );
      }

      return sessionData;
    } catch (error) {
      console.error(`[TraveltekSession] Failed to get session ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Validate that a session is active and not expired
   *
   * Use this as middleware or before any booking operation.
   *
   * @param sessionId - The booking session ID
   * @returns true if valid, false otherwise
   */
  async validateSession(sessionId: string): Promise<boolean> {
    const sessionData = await this.getSession(sessionId);
    return sessionData !== null;
  }

  /**
   * Update session with booking selections
   *
   * Updates both Redis and database to keep them in sync.
   *
   * @param sessionId - The booking session ID
   * @param updates - Fields to update
   */
  async updateSession(sessionId: string, updates: UpdateSessionParams): Promise<void> {
    try {
      // Update database
      await db
        .update(bookingSessions)
        .set({
          selectedCabinGrade: updates.selectedCabinGrade,
          selectedCabin: updates.selectedCabin,
          basketData: updates.basketData,
          updatedAt: new Date(),
        })
        .where(eq(bookingSessions.id, sessionId));

      // Update Redis cache
      const sessionData = await this.getSession(sessionId);
      if (sessionData) {
        const ttl = Math.floor((new Date(sessionData.expiresAt).getTime() - Date.now()) / 1000);
        if (ttl > 0) {
          await this.redis.setex(
            `${this.REDIS_KEY_PREFIX}${sessionId}`,
            ttl,
            JSON.stringify(sessionData)
          );
        }
      }

      console.log(`[TraveltekSession] Updated session ${sessionId}`);
    } catch (error) {
      console.error(`[TraveltekSession] Failed to update session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Mark session as expired
   *
   * Called when session expires or booking is completed/abandoned.
   * Removes from Redis and updates database status.
   *
   * @param sessionId - The booking session ID
   */
  async expireSession(sessionId: string): Promise<void> {
    try {
      // Remove from Redis
      await this.redis.del(`${this.REDIS_KEY_PREFIX}${sessionId}`);

      // Update database status
      await db
        .update(bookingSessions)
        .set({
          status: 'expired',
          updatedAt: new Date(),
        })
        .where(eq(bookingSessions.id, sessionId));

      console.log(`[TraveltekSession] Expired session ${sessionId}`);
    } catch (error) {
      console.error(`[TraveltekSession] Failed to expire session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Mark session as completed after successful booking
   *
   * @param sessionId - The booking session ID
   */
  async completeSession(sessionId: string): Promise<void> {
    try {
      // Remove from Redis
      await this.redis.del(`${this.REDIS_KEY_PREFIX}${sessionId}`);

      // Update database status
      await db
        .update(bookingSessions)
        .set({
          status: 'completed',
          updatedAt: new Date(),
        })
        .where(eq(bookingSessions.id, sessionId));

      console.log(`[TraveltekSession] Completed session ${sessionId}`);
    } catch (error) {
      console.error(`[TraveltekSession] Failed to complete session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Mark session as abandoned (user left without completing)
   *
   * @param sessionId - The booking session ID
   */
  async abandonSession(sessionId: string): Promise<void> {
    try {
      // Remove from Redis
      await this.redis.del(`${this.REDIS_KEY_PREFIX}${sessionId}`);

      // Update database status
      await db
        .update(bookingSessions)
        .set({
          status: 'abandoned',
          updatedAt: new Date(),
        })
        .where(eq(bookingSessions.id, sessionId));

      console.log(`[TraveltekSession] Abandoned session ${sessionId}`);
    } catch (error) {
      console.error(`[TraveltekSession] Failed to abandon session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Get Traveltek session key from our session ID
   *
   * Convenience method for API calls that need the Traveltek sessionkey.
   *
   * @param sessionId - The booking session ID
   * @returns Traveltek session key or null if not found
   */
  async getTraveltekSessionKey(sessionId: string): Promise<string | null> {
    const sessionData = await this.getSession(sessionId);
    return sessionData?.sessionKey || null;
  }

  /**
   * Cleanup expired sessions
   *
   * Run this periodically (e.g., via cron job) to clean up expired sessions.
   * Updates database records that have passed their expiry time.
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = await db
        .update(bookingSessions)
        .set({
          status: 'expired',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(bookingSessions.status, 'active'),
            // Check for expired sessions: WHERE expiresAt < NOW (using lt instead of gt)
            lt(bookingSessions.expiresAt, new Date())
          )
        );

      const count = result.rowCount || 0;
      console.log(`[TraveltekSession] Cleaned up ${count} expired sessions`);
      return count;
    } catch (error) {
      console.error('[TraveltekSession] Failed to cleanup expired sessions:', error);
      throw error;
    }
  }

  /**
   * Get all active sessions for a user
   *
   * Useful for admin panel or debugging.
   *
   * @param userId - The user ID
   * @returns Array of active sessions
   */
  async getUserSessions(userId: string): Promise<any[]> {
    try {
      const sessions = await db.query.bookingSessions.findMany({
        where: and(
          eq(bookingSessions.userId, userId),
          eq(bookingSessions.status, 'active'),
          gt(bookingSessions.expiresAt, new Date())
        ),
        orderBy: (bookingSessions, { desc }) => [desc(bookingSessions.createdAt)],
      });

      return sessions;
    } catch (error) {
      console.error(`[TraveltekSession] Failed to get user sessions for ${userId}:`, error);
      return [];
    }
  }
}

// Export singleton instance
export const traveltekSessionService = new TraveltekSessionService();
