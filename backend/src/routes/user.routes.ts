import { Router } from 'express';
import { userController } from '../controllers/user.controller';

const router = Router();

// Clerk webhook endpoint (no auth required)
router.post('/webhook/clerk', userController.handleClerkWebhook);

// Manual sync endpoint (for testing)
router.post('/sync', userController.syncUser);

// User endpoints (require authentication)
router.get('/me', userController.getCurrentUser);
router.patch('/preferences', userController.updatePreferences);

export const userRoutes = router;