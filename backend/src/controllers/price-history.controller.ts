import { Request, Response } from 'express';
import { logger } from '../config/logger';
import { priceHistoryService } from '../services/price-history.service';
import { z } from 'zod';

// Validation schemas
const historicalPriceQuerySchema = z.object({
  cruiseId: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
  cruiseIds: z.string().optional().transform(val => val ? val.split(',').map(id => parseInt(id, 10)) : undefined),
  cabinCode: z.string().optional(),
  cabinCodes: z.string().optional().transform(val => val ? val.split(',') : undefined),
  rateCode: z.string().optional(),
  rateCodes: z.string().optional().transform(val => val ? val.split(',') : undefined),
  startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  changeType: z.string().optional(),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 50),
  offset: z.string().optional().transform(val => val ? parseInt(val, 10) : 0),
});

const trendAnalysisSchema = z.object({
  cruiseId: z.string().transform(val => parseInt(val, 10)),
  cabinCode: z.string(),
  rateCode: z.string(),
  period: z.enum(['daily', 'weekly', 'monthly']).optional().default('daily'),
  days: z.string().optional().transform(val => val ? parseInt(val, 10) : 30),
});

const priceTrendSummarySchema = z.object({
  cruiseId: z.string().transform(val => parseInt(val, 10)),
  days: z.string().optional().transform(val => val ? parseInt(val, 10) : 30),
});

export class PriceHistoryController {
  
  /**
   * Get historical price data with filtering
   * GET /api/price-history
   */
  async getHistoricalPrices(req: Request, res: Response): Promise<void> {
    try {
      const validation = historicalPriceQuerySchema.safeParse(req.query);
      
      if (!validation.success) {
        res.status(400).json({
          error: 'Invalid query parameters',
          details: validation.error.errors
        });
        return;
      }

      const query = validation.data;
      const historicalPrices = await priceHistoryService.getHistoricalPrices(query);

      res.json({
        success: true,
        data: {
          prices: historicalPrices,
          total: historicalPrices.length,
          query: {
            ...query,
            startDate: query.startDate?.toISOString(),
            endDate: query.endDate?.toISOString()
          }
        }
      });
    } catch (error) {
      logger.error('Failed to get historical prices:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get price trend analysis for a specific cruise/cabin/rate combination
   * GET /api/price-history/trends/:cruiseId/:cabinCode/:rateCode
   */
  async getTrendAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const params = {
        cruiseId: req.params.cruiseId,
        cabinCode: req.params.cabinCode,
        rateCode: req.params.rateCode,
        ...req.query
      };

      const validation = trendAnalysisSchema.safeParse(params);
      
      if (!validation.success) {
        res.status(400).json({
          error: 'Invalid parameters',
          details: validation.error.errors
        });
        return;
      }

      const { cruiseId, cabinCode, rateCode, period, days } = validation.data;
      
      const trendAnalysis = await priceHistoryService.generateTrendAnalysis(
        cruiseId,
        cabinCode,
        rateCode,
        period,
        days
      );

      if (!trendAnalysis) {
        res.status(404).json({
          error: 'No price history found for the specified parameters'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          ...trendAnalysis,
          startDate: trendAnalysis.startDate.toISOString(),
          endDate: trendAnalysis.endDate.toISOString(),
          priceHistory: trendAnalysis.priceHistory.map(p => ({
            ...p,
            snapshotDate: p.snapshotDate.toISOString()
          }))
        }
      });
    } catch (error) {
      logger.error('Failed to get trend analysis:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get price trend summary for a cruise
   * GET /api/price-history/summary/:cruiseId
   */
  async getPriceTrendSummary(req: Request, res: Response): Promise<void> {
    try {
      const params = {
        cruiseId: req.params.cruiseId,
        ...req.query
      };

      const validation = priceTrendSummarySchema.safeParse(params);
      
      if (!validation.success) {
        res.status(400).json({
          error: 'Invalid parameters',
          details: validation.error.errors
        });
        return;
      }

      const { cruiseId, days } = validation.data;
      
      const summary = await priceHistoryService.getPriceTrendSummary(cruiseId, days);

      res.json({
        success: true,
        data: {
          ...summary,
          recentTrends: summary.recentTrends.map(trend => ({
            ...trend,
            periodStart: trend.periodStart.toISOString(),
            periodEnd: trend.periodEnd.toISOString(),
            createdAt: trend.createdAt.toISOString(),
            updatedAt: trend.updatedAt.toISOString()
          }))
        }
      });
    } catch (error) {
      logger.error('Failed to get price trend summary:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get price changes for a specific cruise over time
   * GET /api/price-history/changes/:cruiseId
   */
  async getPriceChanges(req: Request, res: Response): Promise<void> {
    try {
      const cruiseId = parseInt(req.params.cruiseId, 10);
      const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
      
      if (isNaN(cruiseId)) {
        res.status(400).json({
          error: 'Invalid cruise ID'
        });
        return;
      }

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const priceChanges = await priceHistoryService.getHistoricalPrices({
        cruiseId,
        startDate,
        endDate,
        changeType: 'update'
      });

      // Group changes by cabin/rate combination
      const changesByCategory = priceChanges.reduce((acc, change) => {
        const key = `${change.cabinCode}-${change.rateCode}`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(change);
        return acc;
      }, {} as Record<string, typeof priceChanges>);

      // Calculate statistics for each category
      const changeStats = Object.entries(changesByCategory).map(([key, changes]) => {
        const priceChanges = changes
          .map(c => parseFloat(c.priceChange || '0'))
          .filter(c => c !== 0);

        const totalChanges = priceChanges.length;
        const averageChange = totalChanges > 0 
          ? priceChanges.reduce((sum, c) => sum + c, 0) / totalChanges 
          : 0;
        const maxIncrease = totalChanges > 0 ? Math.max(...priceChanges) : 0;
        const maxDecrease = totalChanges > 0 ? Math.min(...priceChanges) : 0;

        const [cabinCode, rateCode] = key.split('-');
        
        return {
          cabinCode,
          rateCode,
          totalChanges,
          averageChange,
          maxIncrease,
          maxDecrease,
          recentChanges: changes.slice(0, 5).map(c => ({
            snapshotDate: c.snapshotDate.toISOString(),
            basePrice: c.basePrice,
            priceChange: c.priceChange,
            priceChangePercent: c.priceChangePercent,
            changeReason: c.changeReason
          }))
        };
      });

      res.json({
        success: true,
        data: {
          cruiseId,
          periodDays: days,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          totalChangeEvents: priceChanges.length,
          changesByCategory: changeStats
        }
      });
    } catch (error) {
      logger.error('Failed to get price changes:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get price volatility metrics
   * GET /api/price-history/volatility/:cruiseId
   */
  async getPriceVolatility(req: Request, res: Response): Promise<void> {
    try {
      const cruiseId = parseInt(req.params.cruiseId, 10);
      const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
      
      if (isNaN(cruiseId)) {
        res.status(400).json({
          error: 'Invalid cruise ID'
        });
        return;
      }

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const historicalPrices = await priceHistoryService.getHistoricalPrices({
        cruiseId,
        startDate,
        endDate
      });

      // Group by cabin/rate combination
      const pricesByCategory = historicalPrices.reduce((acc, price) => {
        const key = `${price.cabinCode}-${price.rateCode}`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(parseFloat(price.basePrice || '0'));
        return acc;
      }, {} as Record<string, number[]>);

      // Calculate volatility metrics
      const volatilityMetrics = Object.entries(pricesByCategory).map(([key, prices]) => {
        const validPrices = prices.filter(p => p > 0);
        
        if (validPrices.length < 2) {
          return null;
        }

        const mean = validPrices.reduce((sum, p) => sum + p, 0) / validPrices.length;
        const variance = validPrices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / validPrices.length;
        const standardDeviation = Math.sqrt(variance);
        const coefficientOfVariation = mean !== 0 ? (standardDeviation / mean) * 100 : 0;

        const minPrice = Math.min(...validPrices);
        const maxPrice = Math.max(...validPrices);
        const priceRange = maxPrice - minPrice;
        const rangePercent = minPrice !== 0 ? (priceRange / minPrice) * 100 : 0;

        const [cabinCode, rateCode] = key.split('-');

        return {
          cabinCode,
          rateCode,
          priceCount: validPrices.length,
          meanPrice: mean,
          standardDeviation,
          coefficientOfVariation,
          minPrice,
          maxPrice,
          priceRange,
          rangePercent,
          volatilityLevel: coefficientOfVariation > 10 ? 'high' : 
                          coefficientOfVariation > 5 ? 'medium' : 'low'
        };
      }).filter(Boolean);

      res.json({
        success: true,
        data: {
          cruiseId,
          periodDays: days,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          volatilityMetrics
        }
      });
    } catch (error) {
      logger.error('Failed to get price volatility:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Cleanup old price history data
   * DELETE /api/price-history/cleanup
   */
  async cleanupOldHistory(req: Request, res: Response): Promise<void> {
    try {
      const retentionDays = req.query.retentionDays 
        ? parseInt(req.query.retentionDays as string, 10) 
        : 90;

      if (retentionDays < 1 || retentionDays > 365) {
        res.status(400).json({
          error: 'Retention days must be between 1 and 365'
        });
        return;
      }

      const deletedCount = await priceHistoryService.cleanupOldHistory(retentionDays);

      res.json({
        success: true,
        data: {
          deletedRecords: deletedCount,
          retentionDays
        }
      });
    } catch (error) {
      logger.error('Failed to cleanup old history:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export const priceHistoryController = new PriceHistoryController();