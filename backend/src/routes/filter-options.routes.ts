import { Router } from 'express';
import filterOptionsController from '../controllers/filter-options.controller';

const router = Router();

// Get all filter options
router.get('/', filterOptionsController.getFilterOptions);

export default router;
