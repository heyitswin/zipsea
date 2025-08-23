import { Router } from 'express';
import { shipController } from '../controllers/ship.controller';

const router = Router();

/**
 * GET /api/v1/ships
 * Get all ships, optionally filtered by search term
 * Query parameters:
 * - search: string (optional) - Search term to filter ships by name or cruise line
 */
router.get('/', shipController.getShips.bind(shipController));

/**
 * GET /api/v1/ships/search
 * Search ships by name or cruise line
 * Query parameters:
 * - q: string (required) - Search term
 */
router.get('/search', shipController.searchShips.bind(shipController));

/**
 * GET /api/v1/ships/:id
 * Get detailed ship information by ID
 */
router.get('/:id', shipController.getShipById.bind(shipController));

export default router;