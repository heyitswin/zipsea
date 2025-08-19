import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler';
import { healthController } from '../controllers/health.controller';

const router = Router();

// Basic health check
router.get('/', asyncHandler(healthController.basic));

// Detailed health check
router.get('/detailed', asyncHandler(healthController.detailed));

// Readiness probe
router.get('/ready', asyncHandler(healthController.ready));

// Liveness probe
router.get('/live', asyncHandler(healthController.live));

export default router;