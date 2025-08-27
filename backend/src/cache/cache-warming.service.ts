import { searchCache, cruiseCache } from './cache-manager';
import { searchService } from '../services/search.service';
import { cruiseService } from '../services/cruise.service';
import { cacheLogger } from '../config/logger';
import { eq, desc, asc, sql } from 'drizzle-orm';
import { db } from '../db/connection';
import { cruises, cheapestPricing } from '../db/schema';

export class CacheWarmingService {
  private isWarming = false;
  private lastWarmingTime = 0;
  private warmingInterval = 15 * 60 * 1000; // 15 minutes

  /**
   * Warm cache with popular searches and data
   */
  async warmPopularData(): Promise<{
    successful: number;
    failed: number;
    skipped: boolean;
  }> {
    const now = Date.now();
    
    // Prevent concurrent warming and avoid warming too frequently
    if (this.isWarming || (now - this.lastWarmingTime) < this.warmingInterval) {
      cacheLogger.info('Cache warming skipped - already in progress or too frequent');
      return { successful: 0, failed: 0, skipped: true };
    }

    this.isWarming = true;
    this.lastWarmingTime = now;

    cacheLogger.info('Starting cache warming process');
    
    let successful = 0;
    let failed = 0;

    try {
      // 1. Warm search filters (most important)
      await this.warmSearchFilters().then(() => successful++).catch(() => failed++);

      // 2. Warm popular cruise searches
      const popularSearches = await this.getPopularSearchQueries();
      for (const searchQuery of popularSearches) {
        try {
          await this.warmSearchQuery(searchQuery);
          successful++;
        } catch (error) {
          failed++;
          cacheLogger.warn('Failed to warm search query', { searchQuery, error });
        }
      }

      // 3. Warm popular cruises
      await this.warmPopularCruises().then(() => successful++).catch(() => failed++);

      // 4. Warm cruise details for popular cruises
      const popularCruiseIds = await this.getPopularCruiseIds();
      for (const cruiseId of popularCruiseIds) {
        try {
          await this.warmCruiseDetails(cruiseId);
          successful++;
        } catch (error) {
          failed++;
          cacheLogger.warn('Failed to warm cruise details', { cruiseId, error });
        }
      }

      cacheLogger.info('Cache warming completed', { successful, failed });
    } catch (error) {
      cacheLogger.error('Cache warming process failed', { error });
      failed++;
    } finally {
      this.isWarming = false;
    }

    return { successful, failed, skipped: false };
  }

  /**
   * Warm search filters cache
   */
  private async warmSearchFilters(): Promise<void> {
    try {
      // Check if already cached
      const existing = await searchCache.getSearchFilters();
      if (existing) {
        cacheLogger.debug('Search filters already cached, skipping');
        return;
      }

      // Fetch and cache search filters
      const filters = await searchService.getSearchFilters();
      await searchCache.setSearchFilters(filters);
      
      cacheLogger.debug('Search filters warmed successfully');
    } catch (error) {
      cacheLogger.error('Failed to warm search filters', { error });
      throw error;
    }
  }

  /**
   * Warm popular cruise searches
   */
  private async warmSearchQuery(query: {
    filters: any;
    options: any;
  }): Promise<void> {
    try {
      const results = await searchService.searchCruises(query.filters, query.options);
      cacheLogger.debug('Search query warmed', { 
        filters: query.filters, 
        resultCount: results.cruises.length 
      });
    } catch (error) {
      cacheLogger.error('Failed to warm search query', { query, error });
      throw error;
    }
  }

  /**
   * Warm popular cruises list
   */
  private async warmPopularCruises(): Promise<void> {
    try {
      const limits = [10, 20];
      
      for (const limit of limits) {
        const existing = await searchCache.getPopularCruises(limit);
        if (existing) {
          cacheLogger.debug(`Popular cruises (${limit}) already cached, skipping`);
          continue;
        }

        const popular = await searchService.getPopularCruises(limit);
        await searchCache.setPopularCruises(limit, popular);
        
        cacheLogger.debug(`Popular cruises (${limit}) warmed successfully`);
      }
    } catch (error) {
      cacheLogger.error('Failed to warm popular cruises', { error });
      throw error;
    }
  }

  /**
   * Warm specific cruise details
   */
  private async warmCruiseDetails(cruiseId: number): Promise<void> {
    try {
      const existing = await cruiseCache.getCruiseDetails(cruiseId);
      if (existing) {
        cacheLogger.debug(`Cruise ${cruiseId} already cached, skipping`);
        return;
      }

      // Use the cruise service warm cache functionality
      await cruiseCache.warmCruiseCache(cruiseId, {
        details: () => this.fetchCruiseDetails(cruiseId),
        pricing: () => this.fetchCruisePricing(cruiseId),
        itinerary: () => this.fetchCruiseItinerary(cruiseId),
      });
      
      cacheLogger.debug(`Cruise ${cruiseId} warmed successfully`);
    } catch (error) {
      cacheLogger.error(`Failed to warm cruise ${cruiseId}`, { error });
      throw error;
    }
  }

  /**
   * Get popular search queries (placeholder - would be replaced with analytics data)
   */
  private async getPopularSearchQueries(): Promise<Array<{
    filters: any;
    options: any;
  }>> {
    // In a real implementation, this would fetch from analytics/tracking data
    return [
      // Caribbean cruises
      {
        filters: { destination: 'Caribbean' },
        options: { limit: 20, sortBy: 'price' }
      },
      // Mediterranean cruises
      {
        filters: { destination: 'Mediterranean' },
        options: { limit: 20, sortBy: 'price' }
      },
      // Alaska cruises
      {
        filters: { destination: 'Alaska' },
        options: { limit: 20, sortBy: 'date' }
      },
      // 7-night cruises
      {
        filters: { nights: { min: 6, max: 8 } },
        options: { limit: 20, sortBy: 'price' }
      },
      // Budget cruises under $1000
      {
        filters: { price: { max: 1000 } },
        options: { limit: 20, sortBy: 'price' }
      },
    ];
  }

  /**
   * Get popular cruise IDs from database
   */
  private async getPopularCruiseIds(): Promise<number[]> {
    try {
      // Get cheapest cruises (likely to be popular)
      const popularCruises = await db
        .select({ id: cruises.id })
        .from(cruises)
        .leftJoin(cheapestPricing, eq(cruises.id, cheapestPricing.cruiseId))
        .where(eq(cruises.isActive, true))
        .orderBy(asc(sql`${cheapestPricing.cheapestPrice}::numeric`))
        .limit(20);

      return popularCruises.map(c => c.id);
    } catch (error) {
      cacheLogger.error('Failed to get popular cruise IDs', { error });
      return [];
    }
  }

  /**
   * Fetch cruise details (placeholder - would use actual cruise service)
   */
  private async fetchCruiseDetails(cruiseId: number): Promise<any> {
    // Placeholder - would use the actual cruise service
    const cruise = await db
      .select()
      .from(cruises)
      .where(eq(cruises.id, String(cruiseId)))
      .limit(1);
    
    return cruise[0] || null;
  }

  /**
   * Fetch cruise pricing (placeholder - would use actual cruise service)
   */
  private async fetchCruisePricing(cruiseId: number): Promise<any> {
    // Placeholder - would use the actual cruise service
    const pricing = await db
      .select()
      .from(cheapestPricing)
      .where(eq(cheapestPricing.cruiseId, cruiseId))
      .limit(1);
    
    return pricing[0] || null;
  }

  /**
   * Fetch cruise itinerary (placeholder - would use actual cruise service)
   */
  private async fetchCruiseItinerary(cruiseId: number): Promise<any> {
    // Placeholder - would fetch from itineraries table if available
    return null;
  }

  /**
   * Schedule cache warming to run periodically
   */
  scheduleWarming(): void {
    cacheLogger.info('Scheduling cache warming every 15 minutes');
    
    setInterval(async () => {
      try {
        await this.warmPopularData();
      } catch (error) {
        cacheLogger.error('Scheduled cache warming failed', { error });
      }
    }, this.warmingInterval);
  }

  /**
   * Warm cache on demand (useful for after data updates)
   */
  async warmOnDemand(targets: {
    searchFilters?: boolean;
    popularCruises?: boolean;
    specificCruises?: number[];
    popularSearches?: boolean;
  } = {}): Promise<{ successful: number; failed: number }> {
    if (this.isWarming) {
      throw new Error('Cache warming already in progress');
    }

    this.isWarming = true;
    let successful = 0;
    let failed = 0;

    try {
      cacheLogger.info('Starting on-demand cache warming', { targets });

      if (targets.searchFilters) {
        try {
          await this.warmSearchFilters();
          successful++;
        } catch {
          failed++;
        }
      }

      if (targets.popularCruises) {
        try {
          await this.warmPopularCruises();
          successful++;
        } catch {
          failed++;
        }
      }

      if (targets.specificCruises?.length) {
        for (const cruiseId of targets.specificCruises) {
          try {
            await this.warmCruiseDetails(cruiseId);
            successful++;
          } catch {
            failed++;
          }
        }
      }

      if (targets.popularSearches) {
        const queries = await this.getPopularSearchQueries();
        for (const query of queries) {
          try {
            await this.warmSearchQuery(query);
            successful++;
          } catch {
            failed++;
          }
        }
      }

      cacheLogger.info('On-demand cache warming completed', { successful, failed });
    } finally {
      this.isWarming = false;
    }

    return { successful, failed };
  }

  /**
   * Get warming status
   */
  getStatus(): {
    isWarming: boolean;
    lastWarmingTime: number;
    nextWarmingIn: number;
  } {
    return {
      isWarming: this.isWarming,
      lastWarmingTime: this.lastWarmingTime,
      nextWarmingIn: Math.max(0, this.warmingInterval - (Date.now() - this.lastWarmingTime)),
    };
  }
}

// Singleton instance
export const cacheWarmingService = new CacheWarmingService();