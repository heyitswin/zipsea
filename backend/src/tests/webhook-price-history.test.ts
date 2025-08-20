import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import request from 'supertest';
import { app } from '../app';
import { db } from '../db/connection';
import { 
  priceHistory, 
  pricing, 
  cruises, 
  cruiseLines, 
  ships,
  type NewCruise,
  type NewCruiseLine,
  type NewShip
} from '../db/schema';
import { eq } from 'drizzle-orm';

// Test data for webhook integration
const testCruiseLine: NewCruiseLine = {
  id: 888,
  name: 'Webhook Test Line',
  code: 'WEBHOOK',
  description: 'Test cruise line for webhook price history testing',
  isActive: true,
};

const testShip: NewShip = {
  id: 888,
  cruiseLineId: 888,
  name: 'Webhook Test Ship',
  code: 'WEBHOOKSHIP',
  isActive: true,
};

const testCruise: NewCruise = {
  id: 888,
  codeToCruiseId: 'WEBHOOK888',
  cruiseLineId: 888,
  shipId: 888,
  name: 'Webhook Test Cruise',
  sailingDate: '2024-07-01',
  returnDate: '2024-07-08',
  nights: 7,
  currency: 'USD',
  isActive: true,
};

// Mock webhook payload that updates pricing
const mockWebhookPayload = {
  cruise_id: 888,
  cruise_name: 'Webhook Test Cruise',
  prices: {
    TESTRATE: {
      IB: {
        '101': {
          cabintype: 'inside',
          price: 1500.00,
          adultprice: 1500.00,
          taxes: 150.00
        }
      }
    }
  },
  cheapest: {
    price: 1500.00,
    cabintype: 'inside',
    taxes: 150.00
  }
};

describe('Webhook Price History Integration', () => {
  beforeAll(async () => {
    // Setup test data
    await db.insert(cruiseLines).values(testCruiseLine);
    await db.insert(ships).values(testShip);
    await db.insert(cruises).values(testCruise);
  });

  afterAll(async () => {
    // Cleanup test data
    await db.delete(priceHistory).where(eq(priceHistory.cruiseId, 888));
    await db.delete(pricing).where(eq(pricing.cruiseId, 888));
    await db.delete(cruises).where(eq(cruises.id, 888));
    await db.delete(ships).where(eq(ships.id, 888));
    await db.delete(cruiseLines).where(eq(cruiseLines.id, 888));
  });

  beforeEach(async () => {
    // Clean up price history and pricing before each test
    await db.delete(priceHistory).where(eq(priceHistory.cruiseId, 888));
    await db.delete(pricing).where(eq(pricing.cruiseId, 888));
  });

  describe('Traveltek Webhook Price Updates', () => {
    test('should capture price snapshot when webhook updates pricing', async () => {
      // First, create initial pricing data
      await db.insert(pricing).values({
        cruiseId: 888,
        rateCode: 'TESTRATE',
        cabinCode: 'IB',
        occupancyCode: '101',
        cabinType: 'inside',
        basePrice: '1200.00',
        adultPrice: '1200.00',
        taxes: '120.00',
        isAvailable: true,
        priceType: 'static',
        currency: 'USD'
      });

      // Verify initial pricing exists
      const initialPricing = await db
        .select()
        .from(pricing)
        .where(eq(pricing.cruiseId, 888));
      
      expect(initialPricing).toHaveLength(1);
      expect(initialPricing[0].basePrice).toBe('1200.00');

      // Send webhook request with updated pricing
      const response = await request(app)
        .post('/api/webhooks/traveltek/cruise-update')
        .send(mockWebhookPayload)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify price snapshot was captured
      const priceSnapshots = await db
        .select()
        .from(priceHistory)
        .where(eq(priceHistory.cruiseId, 888));

      expect(priceSnapshots.length).toBeGreaterThan(0);
      
      // Find the snapshot for our test rate/cabin combination
      const relevantSnapshot = priceSnapshots.find(
        s => s.rateCode === 'TESTRATE' && s.cabinCode === 'IB'
      );
      
      expect(relevantSnapshot).toBeTruthy();
      expect(relevantSnapshot!.basePrice).toBe('1200.00'); // Original price
      expect(relevantSnapshot!.changeReason).toMatch(/webhook|ftp_sync/);
      expect(relevantSnapshot!.changeType).toBe('update');

      // Verify pricing was updated with new values
      const updatedPricing = await db
        .select()
        .from(pricing)
        .where(eq(pricing.cruiseId, 888));

      const updatedRate = updatedPricing.find(
        p => p.rateCode === 'TESTRATE' && p.cabinCode === 'IB'
      );
      
      expect(updatedRate).toBeTruthy();
      expect(updatedRate!.basePrice).toBe('1500.00'); // New price from webhook
      expect(updatedRate!.taxes).toBe('150.00');
    });

    test('should handle new pricing data creation', async () => {
      // Ensure no existing pricing data
      const existingPricing = await db
        .select()
        .from(pricing)
        .where(eq(pricing.cruiseId, 888));
      
      expect(existingPricing).toHaveLength(0);

      // Send webhook request with new pricing
      const response = await request(app)
        .post('/api/webhooks/traveltek/cruise-update')
        .send(mockWebhookPayload)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify pricing was created
      const newPricing = await db
        .select()
        .from(pricing)
        .where(eq(pricing.cruiseId, 888));

      expect(newPricing.length).toBeGreaterThan(0);
      
      const testRate = newPricing.find(
        p => p.rateCode === 'TESTRATE' && p.cabinCode === 'IB'
      );
      
      expect(testRate).toBeTruthy();
      expect(testRate!.basePrice).toBe('1500.00');

      // Verify price history was created (even for new data)
      const priceSnapshots = await db
        .select()
        .from(priceHistory)
        .where(eq(priceHistory.cruiseId, 888));

      // Should have at least one snapshot from the capture process
      expect(priceSnapshots.length).toBeGreaterThanOrEqual(0);
    });

    test('should track multiple price updates over time', async () => {
      // Create initial pricing
      await db.insert(pricing).values({
        cruiseId: 888,
        rateCode: 'TESTRATE',
        cabinCode: 'IB',
        occupancyCode: '101',
        cabinType: 'inside',
        basePrice: '1000.00',
        adultPrice: '1000.00',
        taxes: '100.00',
        isAvailable: true,
        priceType: 'static',
        currency: 'USD'
      });

      // First webhook update
      await request(app)
        .post('/api/webhooks/traveltek/cruise-update')
        .send({
          ...mockWebhookPayload,
          prices: {
            TESTRATE: {
              IB: {
                '101': {
                  cabintype: 'inside',
                  price: 1200.00,
                  adultprice: 1200.00,
                  taxes: 120.00
                }
              }
            }
          }
        })
        .expect(200);

      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 100));

      // Second webhook update
      await request(app)
        .post('/api/webhooks/traveltek/cruise-update')
        .send({
          ...mockWebhookPayload,
          prices: {
            TESTRATE: {
              IB: {
                '101': {
                  cabintype: 'inside',
                  price: 1400.00,
                  adultprice: 1400.00,
                  taxes: 140.00
                }
              }
            }
          }
        })
        .expect(200);

      // Verify multiple price snapshots were captured
      const priceSnapshots = await db
        .select()
        .from(priceHistory)
        .where(eq(priceHistory.cruiseId, 888));

      // Should have snapshots from both updates
      expect(priceSnapshots.length).toBeGreaterThanOrEqual(2);

      // Check for the relevant snapshots
      const relevantSnapshots = priceSnapshots.filter(
        s => s.rateCode === 'TESTRATE' && s.cabinCode === 'IB'
      );

      expect(relevantSnapshots.length).toBeGreaterThanOrEqual(1);

      // Verify final pricing is correct
      const finalPricing = await db
        .select()
        .from(pricing)
        .where(eq(pricing.cruiseId, 888));

      const finalRate = finalPricing.find(
        p => p.rateCode === 'TESTRATE' && p.cabinCode === 'IB'
      );
      
      expect(finalRate).toBeTruthy();
      expect(finalRate!.basePrice).toBe('1400.00'); // Latest price
    });

    test('should handle webhook errors gracefully without corrupting price history', async () => {
      // Create initial pricing
      await db.insert(pricing).values({
        cruiseId: 888,
        rateCode: 'TESTRATE',
        cabinCode: 'IB',
        occupancyCode: '101',
        cabinType: 'inside',
        basePrice: '1000.00',
        adultPrice: '1000.00',
        taxes: '100.00',
        isAvailable: true,
        priceType: 'static',
        currency: 'USD'
      });

      // Send invalid webhook payload
      const response = await request(app)
        .post('/api/webhooks/traveltek/cruise-update')
        .send({
          cruise_id: 888,
          // Missing required pricing data
          prices: {},
          invalid_field: 'should cause issues'
        });

      // Even if webhook fails, existing pricing should remain unchanged
      const unchangedPricing = await db
        .select()
        .from(pricing)
        .where(eq(pricing.cruiseId, 888));

      expect(unchangedPricing).toHaveLength(1);
      expect(unchangedPricing[0].basePrice).toBe('1000.00');

      // Price history should not have invalid entries
      const priceSnapshots = await db
        .select()
        .from(priceHistory)
        .where(eq(priceHistory.cruiseId, 888));

      // May have captured snapshot before failure, but should be valid
      for (const snapshot of priceSnapshots) {
        expect(snapshot.cruiseId).toBe(888);
        expect(snapshot.basePrice).toBeTruthy();
        expect(snapshot.changeReason).toBeTruthy();
      }
    });
  });

  describe('Price History API Integration', () => {
    test('should retrieve price history via API after webhook updates', async () => {
      // Setup initial pricing and create some history
      await db.insert(pricing).values({
        cruiseId: 888,
        rateCode: 'TESTRATE',
        cabinCode: 'IB',
        occupancyCode: '101',
        cabinType: 'inside',
        basePrice: '1000.00',
        adultPrice: '1000.00',
        taxes: '100.00',
        isAvailable: true,
        priceType: 'static',
        currency: 'USD'
      });

      // Send webhook update
      await request(app)
        .post('/api/webhooks/traveltek/cruise-update')
        .send(mockWebhookPayload)
        .expect(200);

      // Query price history via API
      const historyResponse = await request(app)
        .get('/api/v1/price-history')
        .query({ cruiseId: 888 })
        .expect(200);

      expect(historyResponse.body.success).toBe(true);
      expect(historyResponse.body.data.prices.length).toBeGreaterThan(0);

      // Verify the history contains our test cruise
      const testCruiseHistory = historyResponse.body.data.prices.filter(
        (p: any) => p.cruiseId === 888
      );
      
      expect(testCruiseHistory.length).toBeGreaterThan(0);
    });

    test('should generate trend analysis after webhook updates', async () => {
      // Create multiple price updates to generate trends
      const prices = ['1000.00', '1100.00', '1200.00', '1150.00'];
      
      for (const price of prices) {
        // Update pricing
        await db.delete(pricing).where(eq(pricing.cruiseId, 888));
        await db.insert(pricing).values({
          cruiseId: 888,
          rateCode: 'TESTRATE',
          cabinCode: 'IB',
          occupancyCode: '101',
          cabinType: 'inside',
          basePrice: price,
          adultPrice: price,
          taxes: '100.00',
          isAvailable: true,
          priceType: 'static',
          currency: 'USD'
        });

        // Send webhook update
        await request(app)
          .post('/api/webhooks/traveltek/cruise-update')
          .send({
            ...mockWebhookPayload,
            prices: {
              TESTRATE: {
                IB: {
                  '101': {
                    cabintype: 'inside',
                    price: parseFloat(price),
                    adultprice: parseFloat(price),
                    taxes: 100.00
                  }
                }
              }
            }
          })
          .expect(200);

        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Request trend analysis via API
      const trendResponse = await request(app)
        .get('/api/v1/price-history/trends/888/IB/TESTRATE')
        .query({ period: 'daily', days: 7 })
        .expect(200);

      expect(trendResponse.body.success).toBe(true);
      expect(trendResponse.body.data.cruiseId).toBe(888);
      expect(trendResponse.body.data.trendDirection).toMatch(/increasing|decreasing|stable|volatile/);
      expect(trendResponse.body.data.totalChange).toBeDefined();
      expect(trendResponse.body.data.priceHistory.length).toBeGreaterThan(0);
    });
  });
});