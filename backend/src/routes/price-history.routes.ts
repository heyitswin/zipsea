import { Router } from 'express';
import { priceHistoryController } from '../controllers/price-history.controller';

const router = Router();

/**
 * Price History API Routes
 */

// Get historical price data with filtering
router.get('/', priceHistoryController.getHistoricalPrices.bind(priceHistoryController));

// Get price trend analysis for specific cruise/cabin/rate
router.get('/trends/:cruiseId/:cabinCode/:rateCode', priceHistoryController.getTrendAnalysis.bind(priceHistoryController));

// Get price trend summary for a cruise
router.get('/summary/:cruiseId', priceHistoryController.getPriceTrendSummary.bind(priceHistoryController));

// Get price changes for a specific cruise
router.get('/changes/:cruiseId', priceHistoryController.getPriceChanges.bind(priceHistoryController));

// Get price volatility metrics for a cruise
router.get('/volatility/:cruiseId', priceHistoryController.getPriceVolatility.bind(priceHistoryController));

// Cleanup old price history data (admin endpoint)
router.delete('/cleanup', priceHistoryController.cleanupOldHistory.bind(priceHistoryController));

export default router;