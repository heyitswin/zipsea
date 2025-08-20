import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { db } from '../db/connection';
import { priceHistoryService } from '../services/price-history.service';
import { 
  pricing, 
  cheapestPricing, 
  priceHistory, 
  priceTrends,
  cruises,
  cruiseLines,
  ships,
  type NewCruise,
  type NewCruiseLine,
  type NewShip,
  type NewPricing,
  type NewCheapestPricing
} from '../db/schema';
import { eq } from 'drizzle-orm';

// Test data
const testCruiseLine: NewCruiseLine = {
  id: 999,
  name: 'Test Cruise Line',
  code: 'TEST',
  description: 'Test cruise line for price history testing',
  isActive: true,
};

const testShip: NewShip = {
  id: 999,
  cruiseLineId: 999,
  name: 'Test Ship',
  code: 'TESTSHIP',
  isActive: true,
};

const testCruise: NewCruise = {
  id: 999,
  codeToCruiseId: 'TEST999',
  cruiseLineId: 999,
  shipId: 999,
  name: 'Test Cruise',
  sailingDate: '2024-06-01',
  returnDate: '2024-06-08',
  nights: 7,
  currency: 'USD',
  isActive: true,
};

const testPricing: NewPricing = {
  cruiseId: 999,
  rateCode: 'TESTRATE',
  cabinCode: 'IB',
  occupancyCode: '101',
  cabinType: 'inside',
  basePrice: '1000.00',
  adultPrice: '1000.00',
  taxes: '100.00',
  isAvailable: true,
  priceType: 'static',
  currency: 'USD',
};

const testCheapestPricing: NewCheapestPricing = {
  cruiseId: 999,
  cheapestPrice: '1000.00',
  cheapestCabinType: 'inside',
  interiorPrice: '1000.00',
  currency: 'USD',
};

describe('PriceHistoryService', () => {
  beforeAll(async () => {
    // Setup test data
    await db.insert(cruiseLines).values(testCruiseLine);
    await db.insert(ships).values(testShip);
    await db.insert(cruises).values(testCruise);
  });

  afterAll(async () => {
    // Cleanup test data
    await db.delete(priceHistory).where(eq(priceHistory.cruiseId, 999));
    await db.delete(priceTrends).where(eq(priceTrends.cruiseId, 999));
    await db.delete(pricing).where(eq(pricing.cruiseId, 999));
    await db.delete(cheapestPricing).where(eq(cheapestPricing.cruiseId, 999));
    await db.delete(cruises).where(eq(cruises.id, 999));
    await db.delete(ships).where(eq(ships.id, 999));
    await db.delete(cruiseLines).where(eq(cruiseLines.id, 999));
  });

  beforeEach(async () => {
    // Clean up price history and trends before each test
    await db.delete(priceHistory).where(eq(priceHistory.cruiseId, 999));
    await db.delete(priceTrends).where(eq(priceTrends.cruiseId, 999));
    await db.delete(pricing).where(eq(pricing.cruiseId, 999));
    await db.delete(cheapestPricing).where(eq(cheapestPricing.cruiseId, 999));
  });

  describe('captureSnapshot', () => {
    test('should capture price snapshot when pricing data exists', async () => {
      // Setup: Insert pricing data
      await db.insert(pricing).values(testPricing);
      await db.insert(cheapestPricing).values(testCheapestPricing);

      // Execute
      const batchId = await priceHistoryService.captureSnapshot(999, 'test_capture');

      // Verify
      expect(batchId).toBeTruthy();
      
      const snapshots = await db
        .select()
        .from(priceHistory)
        .where(eq(priceHistory.cruiseId, 999));

      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].cruiseId).toBe(999);
      expect(snapshots[0].rateCode).toBe('TESTRATE');
      expect(snapshots[0].cabinCode).toBe('IB');
      expect(snapshots[0].basePrice).toBe('1000.00');
      expect(snapshots[0].changeReason).toBe('test_capture');
      expect(snapshots[0].batchId).toBe(batchId);
    });

    test('should handle empty pricing data gracefully', async () => {
      // Execute with no pricing data
      const batchId = await priceHistoryService.captureSnapshot(999, 'empty_test');

      // Verify
      expect(batchId).toBeTruthy();
      
      const snapshots = await db
        .select()
        .from(priceHistory)
        .where(eq(priceHistory.cruiseId, 999));

      expect(snapshots).toHaveLength(0);
    });
  });

  describe('calculatePriceChanges', () => {
    test('should calculate price changes correctly', async () => {
      // Setup: Create initial pricing
      await db.insert(pricing).values(testPricing);
      const batchId1 = await priceHistoryService.captureSnapshot(999, 'initial');

      // Update pricing
      await db
        .update(pricing)
        .set({ basePrice: '1200.00' })
        .where(eq(pricing.cruiseId, 999));

      const batchId2 = await priceHistoryService.captureSnapshot(999, 'update');

      // Execute
      await priceHistoryService.calculatePriceChanges(batchId2);

      // Verify
      const snapshots = await db
        .select()
        .from(priceHistory)
        .where(eq(priceHistory.batchId, batchId2));

      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].priceChange).toBe('200');
      expect(parseFloat(snapshots[0].priceChangePercent || '0')).toBeCloseTo(20, 1);
    });

    test('should mark first price as insert', async () => {
      // Setup: Create first pricing snapshot
      await db.insert(pricing).values(testPricing);
      const batchId = await priceHistoryService.captureSnapshot(999, 'first');

      // Execute
      await priceHistoryService.calculatePriceChanges(batchId);

      // Verify
      const snapshots = await db
        .select()
        .from(priceHistory)
        .where(eq(priceHistory.batchId, batchId));

      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].changeType).toBe('insert');
    });
  });

  describe('getHistoricalPrices', () => {
    test('should filter historical prices by cruise ID', async () => {
      // Setup: Create price history
      await db.insert(pricing).values(testPricing);
      await priceHistoryService.captureSnapshot(999, 'test');

      // Execute
      const result = await priceHistoryService.getHistoricalPrices({
        cruiseId: 999
      });

      // Verify
      expect(result).toHaveLength(1);
      expect(result[0].cruiseId).toBe(999);
    });

    test('should filter by date range', async () => {
      // Setup: Create price history
      await db.insert(pricing).values(testPricing);
      await priceHistoryService.captureSnapshot(999, 'test');

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Execute
      const result = await priceHistoryService.getHistoricalPrices({
        cruiseId: 999,
        startDate: yesterday,
        endDate: tomorrow
      });

      // Verify
      expect(result).toHaveLength(1);
    });

    test('should apply limit and offset', async () => {
      // Setup: Create multiple price records
      await db.insert(pricing).values([
        { ...testPricing, rateCode: 'RATE1' },
        { ...testPricing, rateCode: 'RATE2' },
        { ...testPricing, rateCode: 'RATE3' }
      ]);
      await priceHistoryService.captureSnapshot(999, 'test');

      // Execute
      const result = await priceHistoryService.getHistoricalPrices({
        cruiseId: 999,
        limit: 2,
        offset: 1
      });

      // Verify
      expect(result).toHaveLength(2);
    });
  });

  describe('generateTrendAnalysis', () => {
    test('should generate trend analysis for price data', async () => {
      // Setup: Create price history with different prices
      const prices = ['1000.00', '1100.00', '1050.00', '1200.00'];
      
      for (let i = 0; i < prices.length; i++) {
        await db.delete(pricing).where(eq(pricing.cruiseId, 999));
        await db.insert(pricing).values({
          ...testPricing,
          basePrice: prices[i]
        });
        
        const batchId = await priceHistoryService.captureSnapshot(999, `test_${i}`);
        await priceHistoryService.calculatePriceChanges(batchId);
        
        // Add delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Execute
      const analysis = await priceHistoryService.generateTrendAnalysis(
        999,
        'IB',
        'TESTRATE',
        'daily',
        7
      );

      // Verify
      expect(analysis).toBeTruthy();
      expect(analysis!.cruiseId).toBe(999);
      expect(analysis!.cabinCode).toBe('IB');
      expect(analysis!.rateCode).toBe('TESTRATE');
      expect(analysis!.totalChange).toBe(200); // 1200 - 1000
      expect(analysis!.totalChangePercent).toBe(20);
      expect(analysis!.trendDirection).toMatch(/increasing|volatile/);
    });

    test('should return null for no price history', async () => {
      // Execute
      const analysis = await priceHistoryService.generateTrendAnalysis(
        999,
        'IB',
        'TESTRATE',
        'daily',
        7
      );

      // Verify
      expect(analysis).toBeNull();
    });
  });

  describe('storePriceTrends', () => {
    test('should store price trend analysis', async () => {
      // Setup: Create sample trend analysis
      const mockAnalysis = {
        cruiseId: 999,
        cabinCode: 'IB',
        rateCode: 'TESTRATE',
        period: 'daily' as const,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
        priceHistory: [
          { basePrice: '1000.00' } as any,
          { basePrice: '1100.00' } as any,
          { basePrice: '1200.00' } as any
        ],
        trendDirection: 'increasing' as const,
        totalChange: 200,
        totalChangePercent: 20,
        volatility: 100
      };

      // Execute
      await priceHistoryService.storePriceTrends(mockAnalysis);

      // Verify
      const trends = await db
        .select()
        .from(priceTrends)
        .where(eq(priceTrends.cruiseId, 999));

      expect(trends).toHaveLength(1);
      expect(trends[0].cruiseId).toBe(999);
      expect(trends[0].cabinCode).toBe('IB');
      expect(trends[0].rateCode).toBe('TESTRATE');
      expect(trends[0].trendDirection).toBe('increasing');
      expect(trends[0].totalChange).toBe('200');
      expect(trends[0].totalChangePercent).toBe('20');
    });
  });

  describe('cleanupOldHistory', () => {
    test('should clean up old price history records', async () => {
      // Setup: Create old and new price history
      await db.insert(pricing).values(testPricing);
      
      // Create old snapshot (100 days ago)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);
      
      await db.insert(priceHistory).values({
        cruiseId: 999,
        rateCode: 'TESTRATE',
        cabinCode: 'IB',
        occupancyCode: '101',
        basePrice: '1000.00',
        changeType: 'insert',
        changeReason: 'old_test',
        snapshotDate: oldDate
      });

      // Create recent snapshot
      await priceHistoryService.captureSnapshot(999, 'recent_test');

      // Execute
      const deletedCount = await priceHistoryService.cleanupOldHistory(90);

      // Verify
      expect(deletedCount).toBe(1);
      
      const remainingHistory = await db
        .select()
        .from(priceHistory)
        .where(eq(priceHistory.cruiseId, 999));

      expect(remainingHistory).toHaveLength(1);
      expect(remainingHistory[0].changeReason).toBe('recent_test');
    });
  });

  describe('getPriceTrendSummary', () => {
    test('should generate price trend summary', async () => {
      // Setup: Create price trends
      await db.insert(priceTrends).values([
        {
          cruiseId: 999,
          cabinCode: 'IB',
          rateCode: 'TESTRATE',
          trendPeriod: 'daily',
          periodStart: new Date('2024-01-01'),
          periodEnd: new Date('2024-01-02'),
          trendDirection: 'increasing',
          totalChangePercent: '10',
          changeCount: 2
        },
        {
          cruiseId: 999,
          cabinCode: 'OV',
          rateCode: 'TESTRATE',
          trendPeriod: 'daily',
          periodStart: new Date('2024-01-01'),
          periodEnd: new Date('2024-01-02'),
          trendDirection: 'decreasing',
          totalChangePercent: '-5',
          changeCount: 1
        }
      ]);

      // Execute
      const summary = await priceHistoryService.getPriceTrendSummary(999, 30);

      // Verify
      expect(summary.cruiseId).toBe(999);
      expect(summary.totalTrends).toBe(2);
      expect(summary.increasing).toBe(1);
      expect(summary.decreasing).toBe(1);
      expect(summary.stable).toBe(0);
      expect(summary.volatile).toBe(0);
      expect(summary.averageChange).toBe(2.5); // (10 + -5) / 2
      expect(summary.recentTrends).toHaveLength(2);
    });
  });

  describe('batchCaptureSnapshots', () => {
    test('should capture snapshots for multiple cruises', async () => {
      // Setup: Create pricing for test cruise
      await db.insert(pricing).values(testPricing);

      // Execute
      const batchId = await priceHistoryService.batchCaptureSnapshots([999], 'batch_test');

      // Verify
      expect(batchId).toBeTruthy();
      
      const snapshots = await db
        .select()
        .from(priceHistory)
        .where(eq(priceHistory.batchId, batchId));

      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].changeReason).toBe('batch_test');
    });
  });
});