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
  cruiseResultNo?: string; // Cruise result number from getCabinGrades for addToBasket API
  basketData?: any; // Cached basket data from addToBasket response
  itemkey?: string; // Item key from basket response, required for booking creation
  isHoldBooking?: boolean; // Flag for hold booking vs full payment
  pricingBreakdown?: any[]; // Detailed pricing breakdown from cruisecabingradebreakdown.pl
  selectedCabinGrade?: {
    resultno: string;
    gradeno: string;
    ratecode: string;
    cabinCode: string;
    cabinType: string;
    description: string;
    totalPrice: number;
    obcAmount?: number;
    roomNumber?: string;
    deckNumber?: string;
  };
}

interface CreateSessionParams {
  cruiseId: string;
  passengerCount: PassengerCount;
  userId?: string;
}

interface UpdateSessionParams {
  selectedCabinGrade?: {
    resultno: string;
    gradeno: string;
    ratecode: string;
    cabinCode: string;
    cabinType: string;
    description: string;
    totalPrice: number;
    obcAmount?: number;
    roomNumber?: string;
    deckNumber?: string;
  };
  selectedCabin?: string;
  basketData?: any;
  cruiseResultNo?: string; // Allow updating cruise result number
  itemkey?: string; // Item key from basket response
  isHoldBooking?: boolean; // Flag for hold booking vs full payment
  pricingBreakdown?: any[]; // Detailed pricing breakdown from cruisecabingradebreakdown.pl
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
   * OPTIMIZATION: Checks for existing active sessions first to avoid unnecessary
   * Traveltek API calls and speed up session creation.
   *
   * @param params - Session creation parameters
   * @returns Session ID and session data
   */
  async createSession(params: CreateSessionParams): Promise<{
    sessionId: string;
    sessionData: SessionData;
  }> {
    try {
      // OPTIMIZATION: Check if we have an existing active session for this cruise/passenger combo
      // This can reuse Traveltek sessions and avoid the slow session creation call
      //
      // SESSION VERSION: v2 - Fixed adult count bug (adults now passed to Traveltek createSession)
      // Old v1 sessions had hardcoded adults=2 in Traveltek, causing context mismatch
      const SESSION_VERSION = 'v2';
      const passengerKey = `${params.passengerCount.adults}:${params.passengerCount.children}:${params.passengerCount.childAges.join(',')}`;
      const existingSessionKey = `existing_session:${SESSION_VERSION}:${params.cruiseId}:${passengerKey}`;

      try {
        const existingSessionId = await this.redis.get(existingSessionKey);
        if (existingSessionId) {
          const existingSession = await this.getSession(existingSessionId);
          if (existingSession) {
            console.log(
              `[TraveltekSession] 🚀 Reusing existing session ${existingSessionId} (${SESSION_VERSION}) for cruise ${params.cruiseId} with ${params.passengerCount.adults} adults`
            );
            return {
              sessionId: existingSessionId,
              sessionData: existingSession,
            };
          }
        }
      } catch (err) {
        console.log('[TraveltekSession] Could not check for existing session:', err);
      }

      // Step 0: Get cruise sailing date to create proper session
      const cruiseResult = await sql`
        SELECT sailing_date FROM cruises WHERE id = ${params.cruiseId} LIMIT 1
      `;

      if (cruiseResult.length === 0) {
        throw new Error(`Cruise ${params.cruiseId} not found`);
      }

      const sailingDate = new Date(cruiseResult[0].sailing_date);

      // Step 1: Create Traveltek session with date range including the cruise
      // IMPORTANT: Pass the actual passenger counts (adults, children, ages) so Traveltek
      // session context matches getCabinGrades calls. This is critical for accurate pricing
      // as cruise lines charge different rates for children and infants.
      const traveltekSession = await traveltekApiService.createSession(
        sailingDate,
        params.passengerCount.adults,
        params.passengerCount.children,
        params.passengerCount.childAges || []
      );

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

      // OPTIMIZATION: Store mapping for session reuse (expires with session)
      try {
        await this.redis.setex(existingSessionKey, this.SESSION_TTL, sessionId);
      } catch (err) {
        console.warn('[TraveltekSession] Failed to store session mapping:', err);
      }

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
        itemkey: dbSession.itemkey || undefined,
        cruiseResultNo: dbSession.selectedCabinGrade || undefined, // Store cruise result number
        isHoldBooking: dbSession.isHoldBooking || false,
        basketData: dbSession.basketData || undefined, // Include basket data for fallback pricing
        pricingBreakdown: dbSession.pricingBreakdown || undefined, // Include pricing breakdown from cruisecabingradebreakdown.pl
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
  async updateSession(
    sessionId: string,
    updates: UpdateSessionParams
  ): Promise<SessionData | null> {
    try {
      // Prepare update data - only include defined values
      const updateData: any = {
        updatedAt: new Date(),
      };

      if (updates.selectedCabinGrade !== undefined) {
        updateData.selectedCabinGrade = updates.selectedCabinGrade;
      }

      if (updates.selectedCabin !== undefined) {
        updateData.selectedCabin = updates.selectedCabin;
      }

      if (updates.basketData !== undefined) {
        // Safely serialize basketData as JSON - handle circular references
        try {
          updateData.basketData = JSON.parse(JSON.stringify(updates.basketData));
        } catch (serializeError) {
          console.warn(
            '[TraveltekSession] Failed to serialize basketData, skipping:',
            serializeError
          );
        }
      }

      if (updates.itemkey !== undefined) {
        updateData.itemkey = updates.itemkey;
      }

      if (updates.isHoldBooking !== undefined) {
        updateData.isHoldBooking = updates.isHoldBooking;
      }

      if (updates.pricingBreakdown !== undefined) {
        // Store pricing breakdown array
        try {
          updateData.pricingBreakdown = JSON.parse(JSON.stringify(updates.pricingBreakdown));
        } catch (serializeError) {
          console.warn(
            '[TraveltekSession] Failed to serialize pricingBreakdown, skipping:',
            serializeError
          );
        }
      }

      // Update database
      await db.update(bookingSessions).set(updateData).where(eq(bookingSessions.id, sessionId));

      // Invalidate Redis cache so next getSession will fetch fresh data from database
      // This ensures the updated itemkey and other fields are included
      await this.redis.del(`${this.REDIS_KEY_PREFIX}${sessionId}`);

      console.log(`[TraveltekSession] Updated session ${sessionId}`);

      // Return updated session data
      return await this.getSession(sessionId);
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
