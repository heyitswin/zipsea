import { db } from '../db/connection';
import { promotions, type Promotion } from '../db/schema';
import { eq, and, or, isNull, lte, gte, sql } from 'drizzle-orm';

export class PromotionService {
  /**
   * Get all active promotions sorted by priority
   */
  async getActivePromotions(): Promise<Promotion[]> {
    const now = new Date();

    return await db
      .select()
      .from(promotions)
      .where(
        and(
          eq(promotions.isActive, true),
          or(
            isNull(promotions.startDate),
            lte(promotions.startDate, now)
          ),
          or(
            isNull(promotions.endDate),
            gte(promotions.endDate, now)
          )
        )
      )
      .orderBy(sql`${promotions.priority} DESC`);
  }

  /**
   * Find the best matching promotion for a cruise
   */
  async getBestPromotionForCruise(
    price: number,
    cruiseLineId?: number,
    regionId?: number
  ): Promise<{ promotion: Promotion; calculatedValue: number; displayMessage: string } | null> {
    const activePromotions = await this.getActivePromotions();

    for (const promotion of activePromotions) {
      // Check price range
      if (promotion.minPrice && price < promotion.minPrice) continue;
      if (promotion.maxPrice && price > promotion.maxPrice) continue;

      // Check cruise line filter
      if (
        promotion.applicableCruiseLineIds &&
        promotion.applicableCruiseLineIds.length > 0 &&
        cruiseLineId &&
        !promotion.applicableCruiseLineIds.includes(cruiseLineId)
      ) {
        continue;
      }

      // Check region filter
      if (
        promotion.applicableRegionIds &&
        promotion.applicableRegionIds.length > 0 &&
        regionId &&
        !promotion.applicableRegionIds.includes(regionId)
      ) {
        continue;
      }

      // Calculate the promotional value
      const calculatedValue = this.calculatePromotionValue(promotion, price);

      // Generate display message
      const displayMessage = this.formatPromotionMessage(promotion, calculatedValue);

      return { promotion, calculatedValue, displayMessage };
    }

    return null;
  }

  /**
   * Calculate the promotional value based on the promotion type
   */
  private calculatePromotionValue(promotion: Promotion, price: number): number {
    switch (promotion.calculationType) {
      case 'percentage':
        if (!promotion.calculationValue) return 0;
        return Math.floor((price * promotion.calculationValue) / 100);

      case 'fixed':
        return promotion.calculationValue || 0;

      case 'formula':
        if (!promotion.formula) return 0;
        try {
          // Create a safe evaluation context with only Math and price
          const evalContext = { price, Math };
          const result = new Function('price', 'Math', `return ${promotion.formula}`)(price, Math);
          return Math.floor(result);
        } catch (error) {
          console.error('Error evaluating promotion formula:', error);
          return 0;
        }

      default:
        return 0;
    }
  }

  /**
   * Format the promotion message with the calculated value
   */
  private formatPromotionMessage(promotion: Promotion, calculatedValue: number): string {
    // Replace XXX with the calculated value
    return promotion.message.replace(/XXX/g, calculatedValue.toLocaleString('en-US'));
  }

  /**
   * Get all promotions (admin only)
   */
  async getAllPromotions(): Promise<Promotion[]> {
    return await db
      .select()
      .from(promotions)
      .orderBy(sql`${promotions.priority} DESC, ${promotions.createdAt} DESC`);
  }

  /**
   * Get a single promotion by ID
   */
  async getPromotionById(id: number): Promise<Promotion | null> {
    const result = await db
      .select()
      .from(promotions)
      .where(eq(promotions.id, id))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Create a new promotion
   */
  async createPromotion(data: Omit<Promotion, 'id' | 'createdAt' | 'updatedAt'>): Promise<Promotion> {
    const result = await db
      .insert(promotions)
      .values({
        ...data,
        updatedAt: new Date(),
      })
      .returning();

    return result[0];
  }

  /**
   * Update an existing promotion
   */
  async updatePromotion(
    id: number,
    data: Partial<Omit<Promotion, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Promotion | null> {
    const result = await db
      .update(promotions)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(promotions.id, id))
      .returning();

    return result[0] || null;
  }

  /**
   * Delete a promotion
   */
  async deletePromotion(id: number): Promise<boolean> {
    const result = await db
      .delete(promotions)
      .where(eq(promotions.id, id))
      .returning();

    return result.length > 0;
  }

  /**
   * Toggle promotion active status
   */
  async togglePromotionStatus(id: number): Promise<Promotion | null> {
    const promotion = await this.getPromotionById(id);
    if (!promotion) return null;

    return await this.updatePromotion(id, {
      isActive: !promotion.isActive,
    });
  }
}

export const promotionService = new PromotionService();
