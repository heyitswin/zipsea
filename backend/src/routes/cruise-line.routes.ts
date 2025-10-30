import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { cruiseLines } from '../db/schema/cruise-lines';
import { eq } from 'drizzle-orm';
import logger from '../config/logger';

const router = Router();

/**
 * GET /api/v1/cruise-lines/:id
 * Get cruise line details by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const lineId = parseInt(req.params.id);

    if (isNaN(lineId)) {
      return res.status(400).json({ error: 'Invalid cruise line ID' });
    }

    const [cruiseLine] = await db
      .select()
      .from(cruiseLines)
      .where(eq(cruiseLines.id, lineId))
      .limit(1);

    if (!cruiseLine) {
      return res.status(404).json({ error: 'Cruise line not found' });
    }

    res.json(cruiseLine);
  } catch (error) {
    logger.error('Error fetching cruise line:', error);
    res.status(500).json({ error: 'Failed to fetch cruise line' });
  }
});

export default router;
