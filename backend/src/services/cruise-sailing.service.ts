/**
 * New Cruise Sailing Service
 * 
 * This service demonstrates how to work with the new cruise/sailing separation schema.
 * It provides methods for finding alternative sailings and working with the new structure.
 */

import { db } from '../db/connection';
import { 
  cruiseDefinitions, 
  cruiseSailings, 
  pricing, 
  cheapestPricing,
  itineraries,
  cruiseLines,
  ships,
  ports
} from '../db/schema';
import { eq, and, gte, lte, desc, asc, sql, inArray } from 'drizzle-orm';
import { logger } from '../config/logger';

export interface CruiseDefinitionWithSailings {
  definition: {
    id: string;
    traveltekCruiseId: number;
    name: string;
    cruiseLineId: number;
    shipId: number;
    nights: number;
    voyageCode?: string;
    embarkPortId?: number;
    disembarkPortId?: number;
    regionIds: number[];
    portIds: number[];
    currency: string;
  };
  sailings: {
    id: string;
    codeToCruiseId: number;
    sailingDate: string;
    returnDate?: string;
    traveltekFilePath?: string;
    pricing?: any;
  }[];
  cruiseLine: {
    id: number;
    name: string;
    code?: string;
  };
  ship: {
    id: number;
    name: string;
    capacity?: number;
  };
  embarkPort?: {
    id: number;
    name: string;
    country?: string;
  };
}

export interface SailingSearchCriteria {
  cruiseLineIds?: number[];
  shipIds?: number[];
  embarkPortIds?: number[];
  regionIds?: number[];
  nights?: number[];
  startDate?: string;
  endDate?: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
  offset?: number;
}

export class CruiseSailingService {
  
  /**
   * Find all sailings for a specific cruise definition
   */
  async findSailingsByCruiseDefinition(cruiseDefinitionId: string): Promise<CruiseDefinitionWithSailings | null> {
    try {
      // Get cruise definition with related data
      const definitionResult = await db
        .select({
          definition: cruiseDefinitions,
          cruiseLine: cruiseLines,
          ship: ships,
          embarkPort: ports
        })
        .from(cruiseDefinitions)
        .leftJoin(cruiseLines, eq(cruiseDefinitions.cruiseLineId, cruiseLines.id))
        .leftJoin(ships, eq(cruiseDefinitions.shipId, ships.id))
        .leftJoin(ports, eq(cruiseDefinitions.embarkPortId, ports.id))
        .where(eq(cruiseDefinitions.id, cruiseDefinitionId))
        .limit(1);

      if (definitionResult.length === 0) {
        return null;
      }

      const { definition, cruiseLine, ship, embarkPort } = definitionResult[0];

      // Get all sailings for this definition
      const sailingsResult = await db
        .select({
          sailing: cruiseSailings,
          cheapestPrice: cheapestPricing
        })
        .from(cruiseSailings)
        .leftJoin(cheapestPricing, eq(cruiseSailings.id, cheapestPricing.cruiseSailingId))
        .where(eq(cruiseSailings.cruiseDefinitionId, cruiseDefinitionId))
        .orderBy(asc(cruiseSailings.sailingDate));

      const sailings = sailingsResult.map(row => ({
        id: row.sailing.id,
        codeToCruiseId: row.sailing.codeToCruiseId,
        sailingDate: row.sailing.sailingDate,
        returnDate: row.sailing.returnDate,
        traveltekFilePath: row.sailing.traveltekFilePath,
        pricing: row.cheapestPrice ? {
          cheapestPrice: row.cheapestPrice.cheapestPrice,
          interiorPrice: row.cheapestPrice.interiorPrice,
          oceanviewPrice: row.cheapestPrice.oceanviewPrice,
          balconyPrice: row.cheapestPrice.balconyPrice,
          suitePrice: row.cheapestPrice.suitePrice
        } : null
      }));

      return {
        definition: {
          id: definition.id,
          traveltekCruiseId: definition.traveltekCruiseId,
          name: definition.name,
          cruiseLineId: definition.cruiseLineId,
          shipId: definition.shipId,
          nights: definition.nights,
          voyageCode: definition.voyageCode || undefined,
          embarkPortId: definition.embarkPortId || undefined,
          disembarkPortId: definition.disembarkPortId || undefined,
          regionIds: definition.regionIds as number[] || [],
          portIds: definition.portIds as number[] || [],
          currency: definition.currency || 'USD'
        },
        sailings,
        cruiseLine: {
          id: cruiseLine?.id || 0,
          name: cruiseLine?.name || 'Unknown',
          code: cruiseLine?.code || undefined
        },
        ship: {
          id: ship?.id || 0,
          name: ship?.name || 'Unknown',
          capacity: ship?.capacity || undefined
        },
        embarkPort: embarkPort ? {
          id: embarkPort.id,
          name: embarkPort.name,
          country: embarkPort.country || undefined
        } : undefined
      };

    } catch (error) {
      logger.error(`Failed to find sailings for cruise definition ${cruiseDefinitionId}:`, error);
      throw error;
    }
  }

  /**
   * Find alternative sailings for the same cruise (by Traveltek cruise ID)
   */
  async findAlternativeSailings(traveltekCruiseId: number, excludeSailingId?: string): Promise<CruiseDefinitionWithSailings[]> {
    try {
      // Find all cruise definitions with this Traveltek ID
      const definitions = await db
        .select()
        .from(cruiseDefinitions)
        .where(eq(cruiseDefinitions.traveltekCruiseId, traveltekCruiseId));

      const results: CruiseDefinitionWithSailings[] = [];

      for (const definition of definitions) {
        const cruiseWithSailings = await this.findSailingsByCruiseDefinition(definition.id);
        if (cruiseWithSailings) {
          // Filter out the excluded sailing if specified
          if (excludeSailingId) {
            cruiseWithSailings.sailings = cruiseWithSailings.sailings.filter(
              sailing => sailing.id !== excludeSailingId
            );
          }
          
          // Only include if there are sailings available
          if (cruiseWithSailings.sailings.length > 0) {
            results.push(cruiseWithSailings);
          }
        }
      }

      return results;

    } catch (error) {
      logger.error(`Failed to find alternative sailings for Traveltek cruise ${traveltekCruiseId}:`, error);
      throw error;
    }
  }

  /**
   * Search for cruise sailings with advanced criteria
   */
  async searchSailings(criteria: SailingSearchCriteria): Promise<{
    sailings: Array<{
      sailing: any;
      definition: any;
      cruiseLine: any;
      ship: any;
      embarkPort: any;
      pricing: any;
    }>;
    total: number;
  }> {
    try {
      const whereConditions = [];
      
      // Add filters based on criteria
      if (criteria.cruiseLineIds && criteria.cruiseLineIds.length > 0) {
        whereConditions.push(inArray(cruiseDefinitions.cruiseLineId, criteria.cruiseLineIds));
      }
      
      if (criteria.shipIds && criteria.shipIds.length > 0) {
        whereConditions.push(inArray(cruiseDefinitions.shipId, criteria.shipIds));
      }
      
      if (criteria.embarkPortIds && criteria.embarkPortIds.length > 0) {
        whereConditions.push(inArray(cruiseDefinitions.embarkPortId, criteria.embarkPortIds));
      }
      
      if (criteria.nights && criteria.nights.length > 0) {
        whereConditions.push(inArray(cruiseDefinitions.nights, criteria.nights));
      }
      
      if (criteria.startDate) {
        whereConditions.push(gte(cruiseSailings.sailingDate, criteria.startDate));
      }
      
      if (criteria.endDate) {
        whereConditions.push(lte(cruiseSailings.sailingDate, criteria.endDate));
      }
      
      if (criteria.minPrice || criteria.maxPrice) {
        if (criteria.minPrice) {
          whereConditions.push(gte(cheapestPricing.cheapestPrice, criteria.minPrice.toString()));
        }
        if (criteria.maxPrice) {
          whereConditions.push(lte(cheapestPricing.cheapestPrice, criteria.maxPrice.toString()));
        }
      }

      // Add active filters
      whereConditions.push(eq(cruiseDefinitions.isActive, true));
      whereConditions.push(eq(cruiseSailings.isActive, true));

      // Build the main query
      const query = db
        .select({
          sailing: cruiseSailings,
          definition: cruiseDefinitions,
          cruiseLine: cruiseLines,
          ship: ships,
          embarkPort: ports,
          pricing: cheapestPricing
        })
        .from(cruiseSailings)
        .innerJoin(cruiseDefinitions, eq(cruiseSailings.cruiseDefinitionId, cruiseDefinitions.id))
        .leftJoin(cruiseLines, eq(cruiseDefinitions.cruiseLineId, cruiseLines.id))
        .leftJoin(ships, eq(cruiseDefinitions.shipId, ships.id))
        .leftJoin(ports, eq(cruiseDefinitions.embarkPortId, ports.id))
        .leftJoin(cheapestPricing, eq(cruiseSailings.id, cheapestPricing.cruiseSailingId))
        .where(and(...whereConditions))
        .orderBy(asc(cruiseSailings.sailingDate));

      // Apply pagination
      if (criteria.limit) {
        query.limit(criteria.limit);
      }
      if (criteria.offset) {
        query.offset(criteria.offset);
      }

      const results = await query;

      // Get total count
      const countQuery = await db
        .select({ count: sql<number>`count(*)` })
        .from(cruiseSailings)
        .innerJoin(cruiseDefinitions, eq(cruiseSailings.cruiseDefinitionId, cruiseDefinitions.id))
        .leftJoin(cheapestPricing, eq(cruiseSailings.id, cheapestPricing.cruiseSailingId))
        .where(and(...whereConditions));

      return {
        sailings: results,
        total: countQuery[0]?.count || 0
      };

    } catch (error) {
      logger.error('Failed to search sailings:', error);
      throw error;
    }
  }

  /**
   * Get sailing details by code_to_cruise_id
   */
  async getSailingByCodeToCruiseId(codeToCruiseId: number): Promise<CruiseDefinitionWithSailings | null> {
    try {
      const sailing = await db
        .select()
        .from(cruiseSailings)
        .where(eq(cruiseSailings.codeToCruiseId, codeToCruiseId))
        .limit(1);

      if (sailing.length === 0) {
        return null;
      }

      return await this.findSailingsByCruiseDefinition(sailing[0].cruiseDefinitionId);

    } catch (error) {
      logger.error(`Failed to get sailing by code_to_cruise_id ${codeToCruiseId}:`, error);
      throw error;
    }
  }

  /**
   * Get itinerary for a specific sailing
   */
  async getSailingItinerary(sailingId: string): Promise<any[]> {
    try {
      const itinerary = await db
        .select({
          itinerary: itineraries,
          port: ports
        })
        .from(itineraries)
        .leftJoin(ports, eq(itineraries.portId, ports.id))
        .where(eq(itineraries.cruiseSailingId, sailingId))
        .orderBy(asc(itineraries.dayNumber));

      return itinerary.map(row => ({
        dayNumber: row.itinerary.dayNumber,
        date: row.itinerary.date,
        portName: row.itinerary.portName,
        port: row.port,
        arrivalTime: row.itinerary.arrivalTime,
        departureTime: row.itinerary.departureTime,
        status: row.itinerary.status,
        overnight: row.itinerary.overnight,
        description: row.itinerary.description
      }));

    } catch (error) {
      logger.error(`Failed to get itinerary for sailing ${sailingId}:`, error);
      throw error;
    }
  }

  /**
   * Get pricing for a specific sailing
   */
  async getSailingPricing(sailingId: string): Promise<any> {
    try {
      const [pricingData, cheapestData] = await Promise.all([
        db.select().from(pricing).where(eq(pricing.cruiseSailingId, sailingId)),
        db.select().from(cheapestPricing).where(eq(cheapestPricing.cruiseSailingId, sailingId)).limit(1)
      ]);

      return {
        detailed: pricingData,
        cheapest: cheapestData[0] || null
      };

    } catch (error) {
      logger.error(`Failed to get pricing for sailing ${sailingId}:`, error);
      throw error;
    }
  }
}

export const cruiseSailingService = new CruiseSailingService();