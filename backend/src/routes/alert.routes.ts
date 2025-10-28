import { Router } from 'express';
import { alertController } from '../controllers/alert.controller';
import { validate } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createAlertSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(255),
    searchCriteria: z.object({
      cruiseLineId: z.union([z.number(), z.array(z.number())]).optional(),
      departureMonth: z.union([z.string(), z.array(z.string())]).optional(),
      regionId: z.union([z.number(), z.array(z.number())]).optional(),
      minNights: z.number().optional(),
      maxNights: z.number().optional(),
    }),
    maxBudget: z.number().positive(),
    cabinTypes: z.array(z.enum(['interior', 'oceanview', 'balcony', 'suite'])).min(1),
    alertEnabled: z.boolean().optional(),
  }),
});

const updateAlertSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    searchCriteria: z
      .object({
        cruiseLineId: z.union([z.number(), z.array(z.number())]).optional(),
        departureMonth: z.union([z.string(), z.array(z.string())]).optional(),
        regionId: z.union([z.number(), z.array(z.number())]).optional(),
        minNights: z.number().optional(),
        maxNights: z.number().optional(),
      })
      .optional(),
    maxBudget: z.number().positive().optional(),
    cabinTypes: z.array(z.enum(['interior', 'oceanview', 'balcony', 'suite'])).optional(),
    alertEnabled: z.boolean().optional(),
    isActive: z.boolean().optional(),
  }),
});

const alertIdParam = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

/**
 * @route   POST /api/v1/alerts
 * @desc    Create a new price alert
 * @access  Private (requires authentication)
 */
router.post(
  '/',
  authenticateToken,
  validate({ body: createAlertSchema.shape.body }),
  alertController.createAlert
);

/**
 * @route   GET /api/v1/alerts
 * @desc    Get all alerts for authenticated user
 * @access  Private
 */
router.get('/', authenticateToken, alertController.getUserAlerts);

/**
 * @route   GET /api/v1/alerts/:id/matches
 * @desc    Get matching cruises for an alert
 * @access  Private
 */
router.get(
  '/:id/matches',
  authenticateToken,
  validate({ params: alertIdParam.shape.params }),
  alertController.getAlertMatches
);

/**
 * @route   PUT /api/v1/alerts/:id
 * @desc    Update an alert
 * @access  Private
 */
router.put(
  '/:id',
  authenticateToken,
  validate({
    params: alertIdParam.shape.params,
    body: updateAlertSchema.shape.body,
  }),
  alertController.updateAlert
);

/**
 * @route   DELETE /api/v1/alerts/:id
 * @desc    Delete an alert
 * @access  Private
 */
router.delete(
  '/:id',
  authenticateToken,
  validate({ params: alertIdParam.shape.params }),
  alertController.deleteAlert
);

/**
 * @route   POST /api/v1/alerts/:id/process
 * @desc    Manually trigger alert processing (for testing)
 * @access  Private
 */
router.post(
  '/:id/process',
  authenticateToken,
  validate({ params: alertIdParam.shape.params }),
  alertController.processAlert
);

export default router;
