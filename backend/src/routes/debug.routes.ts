import { Router, Request, Response } from 'express';
import { sql } from '../db/connection';

const router = Router();

/**
 * DEBUG: Test raw SQL insert into booking_sessions
 * This bypasses Drizzle to test if the issue is with Drizzle or the database
 */
router.post('/test-booking-session-raw', async (req: Request, res: Response) => {
  try {
    const { cruiseId } = req.body;

    if (!cruiseId) {
      res.status(400).json({ error: 'cruiseId is required' });
      return;
    }

    console.log('[DEBUG] Testing raw SQL insert with cruiseId:', cruiseId, 'Type:', typeof cruiseId);

    // First, verify cruise exists
    const cruiseCheck = await sql`
      SELECT id, cruise_line_id, ship_id FROM cruises WHERE id = ${cruiseId}
    `;

    console.log('[DEBUG] Cruise check result:', cruiseCheck);

    if (cruiseCheck.length === 0) {
      res.status(404).json({ error: 'Cruise not found', cruiseId });
      return;
    }

    // Now try the insert
    const result = await sql`
      INSERT INTO booking_sessions (
        id, user_id, cruise_id, traveltek_session_key, traveltek_sid,
        passenger_count, status, expires_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        NULL,
        ${cruiseId},
        'debug-test-key',
        'debug-test-sid',
        '{"adults": 2, "children": 0, "childAges": []}'::jsonb,
        'active',
        NOW() + INTERVAL '2 hours',
        NOW(),
        NOW()
      ) RETURNING id, cruise_id
    `;

    console.log('[DEBUG] Insert result:', result);

    res.json({
      success: true,
      message: 'Raw SQL insert succeeded',
      result: result[0],
      cruiseCheck: cruiseCheck[0],
    });
  } catch (error: any) {
    console.error('[DEBUG] Raw SQL insert failed:', error);
    res.status(500).json({
      error: 'Raw SQL insert failed',
      message: error.message,
      detail: error.detail,
      constraint: error.constraint,
    });
  }
});

/**
 * DEBUG: Check database connection info
 */
router.get('/db-info', async (req: Request, res: Response) => {
  try {
    const dbInfo = await sql`
      SELECT
        current_database() as database_name,
        current_user as user_name,
        version() as pg_version
    `;

    const cruiseCount = await sql`SELECT COUNT(*) as count FROM cruises WHERE cruise_line_id IN (22, 3)`;
    const sessionCount = await sql`SELECT COUNT(*) as count FROM booking_sessions`;

    res.json({
      database: dbInfo[0],
      counts: {
        liveBookableCruises: cruiseCount[0].count,
        bookingSessions: sessionCount[0].count,
      },
    });
  } catch (error: any) {
    console.error('[DEBUG] DB info failed:', error);
    res.status(500).json({
      error: 'Failed to get DB info',
      message: error.message,
    });
  }
});

export default router;
