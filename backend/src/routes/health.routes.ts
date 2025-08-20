import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler';
import { healthController } from '../controllers/health.controller';

const router = Router();

// Basic health check
router.get('/', asyncHandler(healthController.basic));

// Main health check with Redis and DB status
router.get('/health', asyncHandler(healthController.getHealth));

// Detailed health check
router.get('/detailed', asyncHandler(healthController.detailed));

// Readiness probe (Kubernetes)
router.get('/ready', asyncHandler(healthController.ready));
router.get('/readiness', asyncHandler(healthController.getReadiness));

// Liveness probe (Kubernetes)
router.get('/live', asyncHandler(healthController.live));
router.get('/liveness', asyncHandler(healthController.getLiveness));

// Cache metrics and management
router.get('/cache/metrics', asyncHandler(healthController.getCacheMetrics));
router.post('/cache/metrics/reset', asyncHandler(healthController.resetCacheMetrics));
router.get('/cache/stats', asyncHandler(healthController.getCacheStats));

// Cache warming management
router.get('/cache/warming/status', asyncHandler(healthController.getCacheWarmingStatus));
router.post('/cache/warming/trigger', asyncHandler(healthController.triggerCacheWarming));
router.post('/cache/clear', asyncHandler(healthController.clearAllCaches));

export default router;