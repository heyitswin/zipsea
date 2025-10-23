import { Router } from 'express';
import { db } from '../db/connection';
import { cruiseLines } from '../db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * GET /cruise-lines/:id
 * Get cruise line details by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const cruiseLineId = parseInt(req.params.id);

    if (isNaN(cruiseLineId)) {
      return res.status(400).json({
        error: 'Invalid cruise line ID',
      });
    }

    const cruiseLine = await db.query.cruiseLines.findFirst({
      where: eq(cruiseLines.id, cruiseLineId),
    });

    if (!cruiseLine) {
      return res.status(404).json({
        error: 'Cruise line not found',
      });
    }

    res.json(cruiseLine);
  } catch (error) {
    console.error('[CruiseLinesRoutes] Error fetching cruise line:', error);
    res.status(500).json({
      error: 'Failed to fetch cruise line',
    });
  }
});

/**
 * GET /cruise-lines
 * List all cruise lines
 */
router.get('/', async (req, res) => {
  try {
    const allCruiseLines = await db.query.cruiseLines.findMany({
      where: eq(cruiseLines.isActive, true),
      orderBy: (cruiseLines, { asc }) => [asc(cruiseLines.name)],
    });

    res.json(allCruiseLines);
  } catch (error) {
    console.error('[CruiseLinesRoutes] Error fetching cruise lines:', error);
    res.status(500).json({
      error: 'Failed to fetch cruise lines',
    });
  }
});

export default router;
