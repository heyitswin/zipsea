import { eq, and, gte, lte, desc, asc, sql, inArray } from 'drizzle-orm';
import { db } from '../db/connection';
import { logger } from '../config/logger';
import { 
  pricing, 
  cheapestPricing, 
  priceHistory, 
  priceTrends,
  type Pricing,
  type CheapestPricing,
  type NewPriceHistory,
  type NewPriceTrends,
  type PriceHistory,
  type PriceTrends
} from '../db/schema';
import { v4 as uuidv4 } from 'uuid';

export interface PriceSnapshot {
  cruiseId: number | string;
  rateCode: string;
  cabinCode: string;
  occupancyCode: string;
  currentPrice: string | null;
  newPrice: string | null;
  changeType: 'insert' | 'update' | 'delete';
  changeReason: string;
  batchId?: string;
}

export interface PriceTrendAnalysis {
  cruiseId: number | string;
  cabinCode: string;
  rateCode: string;
  period: 'daily' | 'weekly' | 'monthly';
  startDate: Date;
  endDate: Date;
  priceHistory: PriceHistory[];
  trendDirection: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  totalChange: number;
  totalChangePercent: number;
  volatility: number;
}

export interface HistoricalPriceQuery {
  cruiseId?: number | string;
  cruiseIds?: (number | string)[];
  cabinCode?: string;
  cabinCodes?: string[];
  rateCode?: string;
  rateCodes?: string[];
  startDate?: Date;
  endDate?: Date;
  changeType?: string;
  limit?: number;
  offset?: number;
}

export class PriceHistoryService {
  
  /**
   * Capture price snapshots before updating pricing data
   */
  async captureSnapshot(
    cruiseId: number | string, 
    changeReason: string = 'data_sync',
    batchId?: string
  ): Promise<string> {
    try {
      const snapshots: NewPriceHistory[] = [];
      const currentBatchId = batchId || uuidv4();

      // Get current pricing data for the cruise
      const currentPricing = await db
        .select()
        .from(pricing)
        .where(eq(pricing.cruiseId, String(cruiseId)));

      // Get current cheapest pricing
      const currentCheapest = await db
        .select()
        .from(cheapestPricing)
        .where(eq(cheapestPricing.cruiseId, String(cruiseId)))
        .limit(1);

      logger.info(`Capturing price snapshot for cruise ${cruiseId}, found ${currentPricing.length} pricing records`);

      // Create snapshots for all current pricing records
      for (const priceRecord of currentPricing) {
        const snapshot: NewPriceHistory = {
          cruiseId: String(cruiseId),
          rateCode: priceRecord.rateCode,
          cabinCode: priceRecord.cabinCode,
          occupancyCode: priceRecord.occupancyCode,
          cabinType: priceRecord.cabinType,
          basePrice: priceRecord.basePrice,
          adultPrice: priceRecord.adultPrice,
          childPrice: priceRecord.childPrice,
          infantPrice: priceRecord.infantPrice,
          singlePrice: priceRecord.singlePrice,
          thirdAdultPrice: priceRecord.thirdAdultPrice,
          fourthAdultPrice: priceRecord.fourthAdultPrice,
          taxes: priceRecord.taxes,
          ncf: priceRecord.ncf,
          gratuity: priceRecord.gratuity,
          fuel: priceRecord.fuel,
          nonComm: priceRecord.nonComm,
          portCharges: priceRecord.portCharges,
          governmentFees: priceRecord.governmentFees,
          totalPrice: priceRecord.totalPrice,
          commission: priceRecord.commission,
          isAvailable: priceRecord.isAvailable,
          inventory: priceRecord.inventory,
          waitlist: priceRecord.waitlist,
          guarantee: priceRecord.guarantee,
          priceType: priceRecord.priceType,
          currency: priceRecord.currency,
          changeType: 'update', // Will be updated after comparison
          changeReason,
          originalPricingId: priceRecord.id,
          batchId: currentBatchId,
        };

        snapshots.push(snapshot);
      }

      if (snapshots.length > 0) {
        await db.insert(priceHistory).values(snapshots);
        logger.info(`Created ${snapshots.length} price history snapshots for cruise ${cruiseId}`);
      }

      return currentBatchId;
    } catch (error) {
      logger.error(`Failed to capture price snapshot for cruise ${cruiseId}:`, error);
      throw error;
    }
  }

  /**
   * Capture snapshots for multiple cruises in batch
   */
  async batchCaptureSnapshots(
    cruiseIds: number[], 
    changeReason: string = 'batch_sync'
  ): Promise<string> {
    const batchId = uuidv4();
    
    try {
      logger.info(`Starting batch price snapshot capture for ${cruiseIds.length} cruises`);
      
      for (const cruiseId of cruiseIds) {
        await this.captureSnapshot(cruiseId, changeReason, batchId);
      }
      
      logger.info(`Completed batch price snapshot capture with batch ID: ${batchId}`);
      return batchId;
    } catch (error) {
      logger.error(`Failed to capture batch price snapshots:`, error);
      throw error;
    }
  }

  /**
   * Calculate price changes and update existing history records
   */
  async calculatePriceChanges(batchId: string): Promise<void> {
    try {
      // Get all snapshots for this batch
      const snapshots = await db
        .select()
        .from(priceHistory)
        .where(eq(priceHistory.batchId, batchId))
        .orderBy(priceHistory.snapshotDate);

      for (const snapshot of snapshots) {
        // Find previous price for the same cruise/cabin/rate combination
        const previousPrice = await db
          .select()
          .from(priceHistory)
          .where(
            and(
              eq(priceHistory.cruiseId, snapshot.cruiseId),
              eq(priceHistory.cabinCode, snapshot.cabinCode),
              eq(priceHistory.rateCode, snapshot.rateCode),
              eq(priceHistory.occupancyCode, snapshot.occupancyCode),
              sql`${priceHistory.snapshotDate} < ${snapshot.snapshotDate}`
            )
          )
          .orderBy(desc(priceHistory.snapshotDate))
          .limit(1);

        if (previousPrice.length > 0) {
          const prev = previousPrice[0];
          const currentPrice = parseFloat(snapshot.basePrice || '0');
          const prevPriceValue = parseFloat(prev.basePrice || '0');
          
          if (currentPrice !== prevPriceValue) {
            const priceChange = currentPrice - prevPriceValue;
            const priceChangePercent = prevPriceValue !== 0 
              ? (priceChange / prevPriceValue) * 100 
              : 0;

            // Update the snapshot with change information
            await db
              .update(priceHistory)
              .set({
                priceChange: priceChange.toString(),
                priceChangePercent: priceChangePercent.toString(),
                changeType: priceChange === 0 ? 'update' : 'update'
              })
              .where(eq(priceHistory.id, snapshot.id));
          }
        } else {
          // First price record for this combination
          await db
            .update(priceHistory)
            .set({
              changeType: 'insert'
            })
            .where(eq(priceHistory.id, snapshot.id));
        }
      }

      logger.info(`Calculated price changes for batch ${batchId}`);
    } catch (error) {
      logger.error(`Failed to calculate price changes for batch ${batchId}:`, error);
      throw error;
    }
  }

  /**
   * Get historical price data with filtering
   */
  async getHistoricalPrices(query: HistoricalPriceQuery): Promise<PriceHistory[]> {
    try {
      let whereConditions = [];

      if (query.cruiseId) {
        whereConditions.push(eq(priceHistory.cruiseId, String(query.cruiseId)));
      }

      if (query.cruiseIds && query.cruiseIds.length > 0) {
        whereConditions.push(inArray(priceHistory.cruiseId, query.cruiseIds.map(String)));
      }

      if (query.cabinCode) {
        whereConditions.push(eq(priceHistory.cabinCode, query.cabinCode));
      }

      if (query.cabinCodes && query.cabinCodes.length > 0) {
        whereConditions.push(inArray(priceHistory.cabinCode, query.cabinCodes));
      }

      if (query.rateCode) {
        whereConditions.push(eq(priceHistory.rateCode, query.rateCode));
      }

      if (query.rateCodes && query.rateCodes.length > 0) {
        whereConditions.push(inArray(priceHistory.rateCode, query.rateCodes));
      }

      if (query.startDate) {
        whereConditions.push(gte(priceHistory.snapshotDate, query.startDate));
      }

      if (query.endDate) {
        whereConditions.push(lte(priceHistory.snapshotDate, query.endDate));
      }

      if (query.changeType) {
        whereConditions.push(eq(priceHistory.changeType, query.changeType));
      }

      const dbQuery = db
        .select()
        .from(priceHistory)
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
        .orderBy(desc(priceHistory.snapshotDate));

      if (query.limit) {
        dbQuery.limit(query.limit);
      }

      if (query.offset) {
        dbQuery.offset(query.offset);
      }

      return await dbQuery;
    } catch (error) {
      logger.error('Failed to get historical prices:', error);
      throw error;
    }
  }

  /**
   * Generate price trend analysis
   */
  async generateTrendAnalysis(
    cruiseId: number | string,
    cabinCode: string,
    rateCode: string,
    period: 'daily' | 'weekly' | 'monthly' = 'daily',
    days: number = 30
  ): Promise<PriceTrendAnalysis | null> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const priceHistoryData = await this.getHistoricalPrices({
        cruiseId,
        cabinCode,
        rateCode,
        startDate,
        endDate
      });

      if (priceHistoryData.length === 0) {
        return null;
      }

      // Sort by date ascending
      priceHistoryData.sort((a, b) => new Date(a.snapshotDate).getTime() - new Date(b.snapshotDate).getTime());

      const prices = priceHistoryData
        .map(p => parseFloat(p.basePrice || '0'))
        .filter(p => p > 0);

      if (prices.length === 0) {
        return null;
      }

      const startPrice = prices[0];
      const endPrice = prices[prices.length - 1];
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;

      const totalChange = endPrice - startPrice;
      const totalChangePercent = startPrice !== 0 ? (totalChange / startPrice) * 100 : 0;

      // Calculate volatility (standard deviation)
      const variance = prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length;
      const volatility = Math.sqrt(variance);

      // Determine trend direction
      let trendDirection: 'increasing' | 'decreasing' | 'stable' | 'volatile';
      if (Math.abs(totalChangePercent) < 2) {
        trendDirection = 'stable';
      } else if (volatility > avgPrice * 0.1) {
        trendDirection = 'volatile';
      } else if (totalChangePercent > 0) {
        trendDirection = 'increasing';
      } else {
        trendDirection = 'decreasing';
      }

      return {
        cruiseId,
        cabinCode,
        rateCode,
        period,
        startDate,
        endDate,
        priceHistory: priceHistoryData,
        trendDirection,
        totalChange,
        totalChangePercent,
        volatility
      };
    } catch (error) {
      logger.error('Failed to generate trend analysis:', error);
      throw error;
    }
  }

  /**
   * Store aggregated price trends
   */
  async storePriceTrends(analysis: PriceTrendAnalysis): Promise<void> {
    try {
      const trendRecord: NewPriceTrends = {
        cruiseId: String(analysis.cruiseId),
        cabinCode: analysis.cabinCode,
        rateCode: analysis.rateCode,
        trendPeriod: analysis.period,
        periodStart: analysis.startDate,
        periodEnd: analysis.endDate,
        startPrice: analysis.priceHistory[0]?.basePrice || null,
        endPrice: analysis.priceHistory[analysis.priceHistory.length - 1]?.basePrice || null,
        minPrice: Math.min(...analysis.priceHistory.map(p => parseFloat(p.basePrice || '0'))).toString(),
        maxPrice: Math.max(...analysis.priceHistory.map(p => parseFloat(p.basePrice || '0'))).toString(),
        avgPrice: (analysis.priceHistory.reduce((sum, p) => sum + parseFloat(p.basePrice || '0'), 0) / analysis.priceHistory.length).toString(),
        totalChange: analysis.totalChange.toString(),
        totalChangePercent: analysis.totalChangePercent.toString(),
        priceVolatility: analysis.volatility.toString(),
        trendDirection: analysis.trendDirection,
        changeCount: analysis.priceHistory.filter(p => p.changeType === 'update').length,
      };

      await db.insert(priceTrends).values(trendRecord);
      logger.info(`Stored price trend for cruise ${analysis.cruiseId}, cabin ${analysis.cabinCode}`);
    } catch (error) {
      logger.error('Failed to store price trends:', error);
      throw error;
    }
  }

  /**
   * Clean up old price history records (data retention)
   */
  async cleanupOldHistory(retentionDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await db
        .delete(priceHistory)
        .where(lte(priceHistory.snapshotDate, cutoffDate));

      const deletedCount = result.rowCount || 0;
      logger.info(`Cleaned up ${deletedCount} old price history records older than ${retentionDays} days`);
      
      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup old price history:', error);
      throw error;
    }
  }

  /**
   * Get price trend summary for a cruise
   */
  async getPriceTrendSummary(cruiseId: number | string, days: number = 30) {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const trends = await db
        .select()
        .from(priceTrends)
        .where(
          and(
            eq(priceTrends.cruiseId, String(cruiseId)),
            gte(priceTrends.periodStart, startDate),
            lte(priceTrends.periodEnd, endDate)
          )
        )
        .orderBy(desc(priceTrends.periodStart));

      const summary = {
        cruiseId,
        totalTrends: trends.length,
        increasing: trends.filter(t => t.trendDirection === 'increasing').length,
        decreasing: trends.filter(t => t.trendDirection === 'decreasing').length,
        stable: trends.filter(t => t.trendDirection === 'stable').length,
        volatile: trends.filter(t => t.trendDirection === 'volatile').length,
        averageChange: trends.reduce((sum, t) => sum + parseFloat(t.totalChangePercent || '0'), 0) / trends.length,
        recentTrends: trends.slice(0, 10)
      };

      return summary;
    } catch (error) {
      logger.error('Failed to get price trend summary:', error);
      throw error;
    }
  }
}

// Singleton instance
export const priceHistoryService = new PriceHistoryService();