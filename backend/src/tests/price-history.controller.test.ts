import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import priceHistoryRoutes from '../routes/price-history.routes';
import { priceHistoryService } from '../services/price-history.service';

// Mock the price history service
jest.mock('../services/price-history.service');

const app = express();
app.use(express.json());
app.use('/price-history', priceHistoryRoutes);

// Mock data
const mockPriceHistory = [
  {
    id: 'test-id-1',
    cruiseId: 123,
    rateCode: 'TESTRATE',
    cabinCode: 'IB',
    occupancyCode: '101',
    basePrice: '1000.00',
    changeType: 'update',
    changeReason: 'ftp_sync',
    snapshotDate: new Date('2024-01-01T10:00:00Z'),
    priceChange: '50.00',
    priceChangePercent: '5.00'
  }
];

const mockTrendAnalysis = {
  cruiseId: 123,
  cabinCode: 'IB',
  rateCode: 'TESTRATE',
  period: 'daily',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-07'),
  priceHistory: mockPriceHistory,
  trendDirection: 'increasing',
  totalChange: 100,
  totalChangePercent: 10,
  volatility: 50
};

const mockTrendSummary = {
  cruiseId: 123,
  totalTrends: 5,
  increasing: 2,
  decreasing: 1,
  stable: 1,
  volatile: 1,
  averageChange: 5.5,
  recentTrends: [
    {
      id: 'trend-1',
      cruiseId: 123,
      cabinCode: 'IB',
      rateCode: 'TESTRATE',
      trendPeriod: 'daily',
      periodStart: new Date('2024-01-01'),
      periodEnd: new Date('2024-01-02'),
      trendDirection: 'increasing',
      totalChangePercent: '10',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01')
    }
  ]
};

describe('PriceHistoryController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /price-history', () => {
    test('should return historical prices with valid query parameters', async () => {
      // Mock service response
      (priceHistoryService.getHistoricalPrices as jest.MockedFunction<any>)
        .mockResolvedValue(mockPriceHistory);

      const response = await request(app)
        .get('/price-history')
        .query({
          cruiseId: '123',
          cabinCode: 'IB',
          limit: '10'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.prices).toHaveLength(1);
      expect(response.body.data.total).toBe(1);
      expect(priceHistoryService.getHistoricalPrices).toHaveBeenCalledWith({
        cruiseId: 123,
        cabinCode: 'IB',
        cabinCodes: undefined,
        rateCode: undefined,
        rateCodes: undefined,
        startDate: undefined,
        endDate: undefined,
        changeType: undefined,
        limit: 10,
        offset: 0
      });
    });

    test('should handle multiple cruise IDs', async () => {
      (priceHistoryService.getHistoricalPrices as jest.MockedFunction<any>)
        .mockResolvedValue(mockPriceHistory);

      await request(app)
        .get('/price-history')
        .query({
          cruiseIds: '123,456,789',
          cabinCodes: 'IB,OV',
          rateCodes: 'RATE1,RATE2'
        });

      expect(priceHistoryService.getHistoricalPrices).toHaveBeenCalledWith({
        cruiseId: undefined,
        cruiseIds: [123, 456, 789],
        cabinCode: undefined,
        cabinCodes: ['IB', 'OV'],
        rateCode: undefined,
        rateCodes: ['RATE1', 'RATE2'],
        startDate: undefined,
        endDate: undefined,
        changeType: undefined,
        limit: 50,
        offset: 0
      });
    });

    test('should handle date range queries', async () => {
      (priceHistoryService.getHistoricalPrices as jest.MockedFunction<any>)
        .mockResolvedValue(mockPriceHistory);

      await request(app)
        .get('/price-history')
        .query({
          cruiseId: '123',
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          changeType: 'update'
        });

      expect(priceHistoryService.getHistoricalPrices).toHaveBeenCalledWith(
        expect.objectContaining({
          cruiseId: 123,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31'),
          changeType: 'update'
        })
      );
    });

    test('should return 400 for invalid query parameters', async () => {
      const response = await request(app)
        .get('/price-history')
        .query({
          cruiseId: 'invalid',
          limit: 'not-a-number'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid query parameters');
    });

    test('should handle service errors', async () => {
      (priceHistoryService.getHistoricalPrices as jest.MockedFunction<any>)
        .mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/price-history')
        .query({ cruiseId: '123' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });
  });

  describe('GET /price-history/trends/:cruiseId/:cabinCode/:rateCode', () => {
    test('should return trend analysis for valid parameters', async () => {
      (priceHistoryService.generateTrendAnalysis as jest.MockedFunction<any>)
        .mockResolvedValue(mockTrendAnalysis);

      const response = await request(app)
        .get('/price-history/trends/123/IB/TESTRATE')
        .query({
          period: 'daily',
          days: '30'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.cruiseId).toBe(123);
      expect(response.body.data.trendDirection).toBe('increasing');
      expect(priceHistoryService.generateTrendAnalysis).toHaveBeenCalledWith(
        123,
        'IB',
        'TESTRATE',
        'daily',
        30
      );
    });

    test('should return 404 when no trend data found', async () => {
      (priceHistoryService.generateTrendAnalysis as jest.MockedFunction<any>)
        .mockResolvedValue(null);

      const response = await request(app)
        .get('/price-history/trends/123/IB/TESTRATE');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('No price history found for the specified parameters');
    });

    test('should validate parameters', async () => {
      const response = await request(app)
        .get('/price-history/trends/invalid/IB/TESTRATE');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid parameters');
    });

    test('should handle invalid period parameter', async () => {
      const response = await request(app)
        .get('/price-history/trends/123/IB/TESTRATE')
        .query({ period: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid parameters');
    });
  });

  describe('GET /price-history/summary/:cruiseId', () => {
    test('should return price trend summary', async () => {
      (priceHistoryService.getPriceTrendSummary as jest.MockedFunction<any>)
        .mockResolvedValue(mockTrendSummary);

      const response = await request(app)
        .get('/price-history/summary/123')
        .query({ days: '30' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.cruiseId).toBe(123);
      expect(response.body.data.totalTrends).toBe(5);
      expect(priceHistoryService.getPriceTrendSummary).toHaveBeenCalledWith(123, 30);
    });

    test('should use default days when not provided', async () => {
      (priceHistoryService.getPriceTrendSummary as jest.MockedFunction<any>)
        .mockResolvedValue(mockTrendSummary);

      await request(app).get('/price-history/summary/123');

      expect(priceHistoryService.getPriceTrendSummary).toHaveBeenCalledWith(123, 30);
    });

    test('should validate cruise ID parameter', async () => {
      const response = await request(app)
        .get('/price-history/summary/invalid');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid parameters');
    });
  });

  describe('GET /price-history/changes/:cruiseId', () => {
    test('should return price changes for cruise', async () => {
      const mockPriceChanges = [
        {
          ...mockPriceHistory[0],
          changeType: 'update',
          priceChange: '50.00',
          priceChangePercent: '5.00'
        }
      ];

      (priceHistoryService.getHistoricalPrices as jest.MockedFunction<any>)
        .mockResolvedValue(mockPriceChanges);

      const response = await request(app)
        .get('/price-history/changes/123')
        .query({ days: '7' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.cruiseId).toBe(123);
      expect(response.body.data.periodDays).toBe(7);
      expect(response.body.data.changesByCategory).toHaveLength(1);
    });

    test('should handle invalid cruise ID', async () => {
      const response = await request(app)
        .get('/price-history/changes/invalid');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid cruise ID');
    });
  });

  describe('GET /price-history/volatility/:cruiseId', () => {
    test('should return price volatility metrics', async () => {
      const mockVolatilityData = [
        { ...mockPriceHistory[0], basePrice: '1000.00' },
        { ...mockPriceHistory[0], basePrice: '1100.00' },
        { ...mockPriceHistory[0], basePrice: '1050.00' }
      ];

      (priceHistoryService.getHistoricalPrices as jest.MockedFunction<any>)
        .mockResolvedValue(mockVolatilityData);

      const response = await request(app)
        .get('/price-history/volatility/123')
        .query({ days: '30' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.cruiseId).toBe(123);
      expect(response.body.data.periodDays).toBe(30);
      expect(response.body.data.volatilityMetrics).toBeDefined();
    });

    test('should handle invalid cruise ID', async () => {
      const response = await request(app)
        .get('/price-history/volatility/invalid');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid cruise ID');
    });
  });

  describe('DELETE /price-history/cleanup', () => {
    test('should cleanup old price history', async () => {
      (priceHistoryService.cleanupOldHistory as jest.MockedFunction<any>)
        .mockResolvedValue(150);

      const response = await request(app)
        .delete('/price-history/cleanup')
        .query({ retentionDays: '60' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.deletedRecords).toBe(150);
      expect(response.body.data.retentionDays).toBe(60);
      expect(priceHistoryService.cleanupOldHistory).toHaveBeenCalledWith(60);
    });

    test('should use default retention days', async () => {
      (priceHistoryService.cleanupOldHistory as jest.MockedFunction<any>)
        .mockResolvedValue(100);

      await request(app).delete('/price-history/cleanup');

      expect(priceHistoryService.cleanupOldHistory).toHaveBeenCalledWith(90);
    });

    test('should validate retention days range', async () => {
      const response = await request(app)
        .delete('/price-history/cleanup')
        .query({ retentionDays: '500' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Retention days must be between 1 and 365');
    });

    test('should handle negative retention days', async () => {
      const response = await request(app)
        .delete('/price-history/cleanup')
        .query({ retentionDays: '-10' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Retention days must be between 1 and 365');
    });
  });
});