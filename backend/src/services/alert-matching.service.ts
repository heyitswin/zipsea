/**
 * Alert Matching Service
 * Finds NEW cruises that match user price alerts and haven't been notified yet
 */

import { db } from '../db/connection';
import { savedSearches, alertMatches, cruises, cheapestPricing } from '../db/schema';
import { eq, and, inArray, lte, isNull, sql, gte } from 'drizzle-orm';
import { logger } from '../config/logger';
import {
  ComprehensiveSearchService,
  type ComprehensiveSearchFilters,
} from './search-comprehensive.service';

const searchService = new ComprehensiveSearchService();

export interface AlertMatchResult {
  cruiseId: string;
  cabinType: 'interior' | 'oceanview' | 'balcony' | 'suite';
  price: number;
  cruise: any; // Full cruise data from search
}

export class AlertMatchingService {
  /**
   * Find NEW matches for a specific alert
   * Returns cruises that:
   * 1. Match the alert's search criteria
   * 2. Have pricing below the maxBudget threshold
   * 3. Haven't been notified before (not in alert_matches)
   */
  async findNewMatches(alertId: string): Promise<AlertMatchResult[]> {
    try {
      // Get alert details
      const alert = await db.query.savedSearches.findFirst({
        where: eq(savedSearches.id, alertId),
      });

      if (!alert) {
        logger.warn(`[AlertMatching] Alert ${alertId} not found`);
        return [];
      }

      if (!alert.alertEnabled || !alert.isActive) {
        logger.info(`[AlertMatching] Alert ${alertId} is disabled or inactive`);
        return [];
      }

      if (!alert.maxBudget) {
        logger.warn(`[AlertMatching] Alert ${alertId} has no maxBudget set`);
        return [];
      }

      logger.info(`[AlertMatching] Processing alert ${alertId}: "${alert.name}"`);

      // Parse search criteria
      const searchCriteria = alert.searchCriteria as any;
      const maxBudget = parseFloat(alert.maxBudget);
      const cabinTypes = alert.cabinTypes || ['interior', 'oceanview', 'balcony', 'suite'];

      logger.info(
        `[AlertMatching] Budget threshold: $${maxBudget}, Cabin types: ${cabinTypes.join(', ')}`
      );

      // Build search filters from alert criteria
      const filters: ComprehensiveSearchFilters = {
        cruiseLineId: searchCriteria.cruiseLineId,
        departureMonth: searchCriteria.departureMonth,
        regionId: searchCriteria.regionId,
        minNights: searchCriteria.minNights,
        maxNights: searchCriteria.maxNights,
        maxPrice: maxBudget, // Use alert's budget as max price
      };

      // Search for matching cruises
      const searchResults = await searchService.searchCruises(filters, {
        limit: 100, // Get up to 100 matches
        sortBy: 'price',
        sortOrder: 'asc',
      });

      logger.info(
        `[AlertMatching] Found ${searchResults.results.length} cruises matching criteria`
      );

      // Get previously notified cruise/cabin combinations for this alert
      const previousMatches = await db
        .select()
        .from(alertMatches)
        .where(eq(alertMatches.alertId, alertId));

      const notifiedSet = new Set(previousMatches.map(m => `${m.cruiseId}:${m.cabinType}`));

      logger.info(`[AlertMatching] ${notifiedSet.size} cruise/cabin combos already notified`);

      // Filter results to find NEW matches
      const newMatches: AlertMatchResult[] = [];

      for (const cruise of searchResults.results) {
        // Check each cabin type the user wants to monitor
        for (const cabinType of cabinTypes) {
          let price: number | null = null;

          // Get price for this cabin type
          switch (cabinType) {
            case 'interior':
              price = cruise.pricing?.interiorPrice || cruise.interiorPrice;
              break;
            case 'oceanview':
              price = cruise.pricing?.oceanviewPrice || cruise.oceanviewPrice;
              break;
            case 'balcony':
              price = cruise.pricing?.balconyPrice || cruise.balconyPrice;
              break;
            case 'suite':
              price = cruise.pricing?.suitePrice || cruise.suitePrice;
              break;
          }

          // Skip if no price available for this cabin type
          if (!price) continue;

          const priceNum = typeof price === 'string' ? parseFloat(price) : price;

          // Check if price is below budget threshold
          if (priceNum > maxBudget) continue;

          // Check if we've already notified about this cruise/cabin combo
          const matchKey = `${cruise.id}:${cabinType}`;
          if (notifiedSet.has(matchKey)) continue;

          // This is a NEW match!
          newMatches.push({
            cruiseId: cruise.id,
            cabinType,
            price: priceNum,
            cruise,
          });

          logger.info(
            `[AlertMatching] NEW MATCH: ${cruise.cruiseLine?.name} - ${cruise.name}, ${cabinType} $${priceNum}`
          );
        }
      }

      logger.info(`[AlertMatching] Found ${newMatches.length} NEW matches for alert ${alertId}`);

      return newMatches;
    } catch (error) {
      logger.error(`[AlertMatching] Error finding matches for alert ${alertId}:`, error);
      throw error;
    }
  }

  /**
   * Check if a specific cruise/cabin has been notified for an alert
   */
  async hasBeenNotified(alertId: string, cruiseId: string, cabinType: string): Promise<boolean> {
    try {
      const match = await db.query.alertMatches.findFirst({
        where: and(
          eq(alertMatches.alertId, alertId),
          eq(alertMatches.cruiseId, cruiseId),
          eq(alertMatches.cabinType, cabinType)
        ),
      });

      return !!match;
    } catch (error) {
      logger.error(`[AlertMatching] Error checking notification status:`, error);
      return false; // Fail safe - if error checking, assume not notified
    }
  }

  /**
   * Record that we've notified the user about a match
   */
  async recordMatch(
    alertId: string,
    cruiseId: string,
    cabinType: string,
    price: number
  ): Promise<void> {
    try {
      await db.insert(alertMatches).values({
        alertId,
        cruiseId,
        cabinType,
        price: price.toFixed(2),
      });

      logger.info(
        `[AlertMatching] Recorded match: alert=${alertId}, cruise=${cruiseId}, cabin=${cabinType}, price=$${price}`
      );
    } catch (error) {
      // If duplicate key error (already notified), ignore
      if ((error as any).code === '23505') {
        logger.warn(`[AlertMatching] Match already recorded (duplicate): ${cruiseId}:${cabinType}`);
        return;
      }

      logger.error(`[AlertMatching] Error recording match:`, error);
      throw error;
    }
  }

  /**
   * Get all matches for an alert (including previously notified)
   * Used for viewing all matching cruises in the UI
   */
  async getAllMatches(alertId: string): Promise<AlertMatchResult[]> {
    try {
      const alert = await db.query.savedSearches.findFirst({
        where: eq(savedSearches.id, alertId),
      });

      if (!alert) {
        logger.warn(`[AlertMatching] Alert ${alertId} not found`);
        return [];
      }

      if (!alert.maxBudget) {
        logger.warn(`[AlertMatching] Alert ${alertId} has no maxBudget set`);
        return [];
      }

      const searchCriteria = alert.searchCriteria as any;
      const maxBudget = parseFloat(alert.maxBudget);
      const cabinTypes = alert.cabinTypes || ['interior', 'oceanview', 'balcony', 'suite'];

      const filters: ComprehensiveSearchFilters = {
        cruiseLineId: searchCriteria.cruiseLineId,
        departureMonth: searchCriteria.departureMonth,
        regionId: searchCriteria.regionId,
        minNights: searchCriteria.minNights,
        maxNights: searchCriteria.maxNights,
        maxPrice: maxBudget,
      };

      const searchResults = await searchService.searchCruises(filters, {
        limit: 100,
        sortBy: 'price',
        sortOrder: 'asc',
      });

      const allMatches: AlertMatchResult[] = [];

      for (const cruise of searchResults.results) {
        for (const cabinType of cabinTypes) {
          let price: number | null = null;

          switch (cabinType) {
            case 'interior':
              price = cruise.pricing?.interiorPrice || cruise.interiorPrice;
              break;
            case 'oceanview':
              price = cruise.pricing?.oceanviewPrice || cruise.oceanviewPrice;
              break;
            case 'balcony':
              price = cruise.pricing?.balconyPrice || cruise.balconyPrice;
              break;
            case 'suite':
              price = cruise.pricing?.suitePrice || cruise.suitePrice;
              break;
          }

          if (!price) continue;

          const priceNum = typeof price === 'string' ? parseFloat(price) : price;

          if (priceNum <= maxBudget) {
            allMatches.push({
              cruiseId: cruise.id,
              cabinType,
              price: priceNum,
              cruise,
            });
          }
        }
      }

      logger.info(`[AlertMatching] Found ${allMatches.length} total matches for alert ${alertId}`);

      return allMatches;
    } catch (error) {
      logger.error(`[AlertMatching] Error getting all matches for alert ${alertId}:`, error);
      throw error;
    }
  }

  /**
   * Update last checked timestamp for an alert
   */
  async updateLastChecked(alertId: string): Promise<void> {
    try {
      await db
        .update(savedSearches)
        .set({ lastChecked: new Date() })
        .where(eq(savedSearches.id, alertId));

      logger.info(`[AlertMatching] Updated lastChecked for alert ${alertId}`);
    } catch (error) {
      logger.error(`[AlertMatching] Error updating lastChecked:`, error);
      throw error;
    }
  }

  /**
   * Get all active alerts that need checking
   */
  async getActiveAlerts(): Promise<any[]> {
    try {
      const alerts = await db
        .select()
        .from(savedSearches)
        .where(
          and(
            eq(savedSearches.alertEnabled, true),
            eq(savedSearches.isActive, true),
            eq(savedSearches.alertFrequency, 'daily')
          )
        );

      logger.info(`[AlertMatching] Found ${alerts.length} active daily alerts`);

      return alerts;
    } catch (error) {
      logger.error(`[AlertMatching] Error getting active alerts:`, error);
      throw error;
    }
  }
}

export const alertMatchingService = new AlertMatchingService();
