import { Router, Request, Response } from 'express';
import { promotionService } from '../services/promotion.service';
import { logger } from '../config/logger';

const router = Router();

/**
 * Public endpoint: Get best promotion for a cruise
 * Used by frontend to display promotional messages
 */
router.get('/best', async (req: Request, res: Response) => {
  try {
    const { price, cruiseLineId, regionId } = req.query;

    if (!price) {
      return res.status(400).json({ error: 'Price is required' });
    }

    const numPrice = parseFloat(price as string);
    const numCruiseLineId = cruiseLineId ? parseInt(cruiseLineId as string) : undefined;
    const numRegionId = regionId ? parseInt(regionId as string) : undefined;

    const result = await promotionService.getBestPromotionForCruise(
      numPrice,
      numCruiseLineId,
      numRegionId
    );

    if (!result) {
      return res.json({ promotion: null });
    }

    res.json({
      promotion: {
        id: result.promotion.id,
        type: result.promotion.type,
        message: result.displayMessage,
        calculatedValue: result.calculatedValue,
      },
    });
  } catch (error: any) {
    logger.error('[PROMOTIONS] Error fetching best promotion:', error);
    res.status(500).json({
      error: 'Failed to fetch promotion',
      message: error.message,
    });
  }
});

/**
 * Admin endpoints - require admin authentication
 */

// Simple admin auth middleware
const requireAdmin = (req: Request, res: Response, next: Function) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Get all promotions (admin only)
router.get('/admin/all', requireAdmin, async (req: Request, res: Response) => {
  try {
    const promotions = await promotionService.getAllPromotions();
    res.json({ promotions });
  } catch (error: any) {
    logger.error('[PROMOTIONS] Error fetching all promotions:', error);
    res.status(500).json({
      error: 'Failed to fetch promotions',
      message: error.message,
    });
  }
});

// Get single promotion (admin only)
router.get('/admin/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const promotion = await promotionService.getPromotionById(id);

    if (!promotion) {
      return res.status(404).json({ error: 'Promotion not found' });
    }

    res.json({ promotion });
  } catch (error: any) {
    logger.error('[PROMOTIONS] Error fetching promotion:', error);
    res.status(500).json({
      error: 'Failed to fetch promotion',
      message: error.message,
    });
  }
});

// Create promotion (admin only)
router.post('/admin', requireAdmin, async (req: Request, res: Response) => {
  try {
    const promotion = await promotionService.createPromotion(req.body);
    res.status(201).json({ promotion });
  } catch (error: any) {
    logger.error('[PROMOTIONS] Error creating promotion:', error);
    res.status(500).json({
      error: 'Failed to create promotion',
      message: error.message,
    });
  }
});

// Update promotion (admin only)
router.put('/admin/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const promotion = await promotionService.updatePromotion(id, req.body);

    if (!promotion) {
      return res.status(404).json({ error: 'Promotion not found' });
    }

    res.json({ promotion });
  } catch (error: any) {
    logger.error('[PROMOTIONS] Error updating promotion:', error);
    res.status(500).json({
      error: 'Failed to update promotion',
      message: error.message,
    });
  }
});

// Toggle promotion status (admin only)
router.post('/admin/:id/toggle', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const promotion = await promotionService.togglePromotionStatus(id);

    if (!promotion) {
      return res.status(404).json({ error: 'Promotion not found' });
    }

    res.json({ promotion });
  } catch (error: any) {
    logger.error('[PROMOTIONS] Error toggling promotion status:', error);
    res.status(500).json({
      error: 'Failed to toggle promotion status',
      message: error.message,
    });
  }
});

// Delete promotion (admin only)
router.delete('/admin/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const success = await promotionService.deletePromotion(id);

    if (!success) {
      return res.status(404).json({ error: 'Promotion not found' });
    }

    res.json({ message: 'Promotion deleted successfully' });
  } catch (error: any) {
    logger.error('[PROMOTIONS] Error deleting promotion:', error);
    res.status(500).json({
      error: 'Failed to delete promotion',
      message: error.message,
    });
  }
});

export default router;
