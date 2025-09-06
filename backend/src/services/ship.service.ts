import { eq, desc, asc } from 'drizzle-orm';
import { db } from '../db/connection';
import { ships, cruiseLines } from '../db/schema';
import { logger } from '../config/logger';
import { cacheManager } from '../cache/cache-manager';
import { CacheKeys } from '../cache/cache-keys';

export interface ShipInfo {
  id: number;
  name: string;
  code?: string;
  cruiseLineId: number;
  cruiseLineName: string;
  cruiseLineCode?: string;
  shipClass?: string;
  tonnage?: number;
  totalCabins?: number;
  maxPassengers?: number;
  starRating?: number;
  description?: string;
  highlights?: string;
  defaultShipImage?: string;
  defaultShipImage2k?: string;
  isActive: boolean;
}

export interface SimpleShip {
  id: number;
  name: string;
  cruiseLineName: string;
}

export class ShipService {
  /**
   * Get all unique ships, sorted alphabetically
   */
  async getAllShips(): Promise<SimpleShip[]> {
    const cacheKey = CacheKeys.shipsList();

    try {
      // Try cache first
      const cached = await cacheManager.get<SimpleShip[]>(cacheKey);
      if (cached) {
        logger.debug('Returning cached ships list');
        return cached;
      }

      // Query ships with cruise line information
      const results = await db
        .select({
          id: ships.id,
          name: ships.name,
          cruiseLineName: cruiseLines.name,
          isActive: ships.isActive,
        })
        .from(ships)
        .leftJoin(cruiseLines, eq(ships.cruiseLineId, cruiseLines.id))
        .where(eq(ships.isActive, true))
        .orderBy(asc(ships.name));

      const shipsList: SimpleShip[] = results
        .filter(row => {
          // Filter out A-ROSA ships
          const cruiseLineName = (row.cruiseLineName || 'Unknown').toLowerCase();
          const shipName = row.name.toLowerCase();
          return (
            !cruiseLineName.includes('a-rosa') &&
            !cruiseLineName.includes('arosa') &&
            !shipName.includes('a-rosa') &&
            !shipName.includes('arosa')
          );
        })
        .map(row => ({
          id: row.id,
          name: row.name,
          cruiseLineName: row.cruiseLineName || 'Unknown',
        }));

      // Remove duplicates by name and sort alphabetically
      const uniqueShips = shipsList.reduce((acc: SimpleShip[], current) => {
        const existing = acc.find(ship => ship.name.toLowerCase() === current.name.toLowerCase());
        if (!existing) {
          acc.push(current);
        }
        return acc;
      }, []);

      // Sort alphabetically by name
      uniqueShips.sort((a, b) => a.name.localeCompare(b.name));

      // Cache for 1 hour
      await cacheManager.set(cacheKey, uniqueShips, { ttl: 3600 });

      logger.info(`Retrieved ${uniqueShips.length} unique ships`);
      return uniqueShips;
    } catch (error) {
      logger.error('Failed to get ships list:', error);
      throw error;
    }
  }

  /**
   * Get detailed ship information by ID
   */
  async getShipById(shipId: number): Promise<ShipInfo | null> {
    const cacheKey = CacheKeys.shipDetails(shipId.toString());

    try {
      // Try cache first
      const cached = await cacheManager.get<ShipInfo>(cacheKey);
      if (cached) {
        logger.debug(`Returning cached ship details for ${shipId}`);
        return cached;
      }

      const results = await db
        .select({
          ship: ships,
          cruiseLine: cruiseLines,
        })
        .from(ships)
        .leftJoin(cruiseLines, eq(ships.cruiseLineId, cruiseLines.id))
        .where(eq(ships.id, shipId))
        .limit(1);

      if (results.length === 0) {
        logger.warn(`Ship ${shipId} not found`);
        return null;
      }

      const result = results[0];
      const ship = result.ship;
      const cruiseLine = result.cruiseLine;

      const shipInfo: ShipInfo = {
        id: ship.id,
        name: ship.name,
        code: ship.code,
        cruiseLineId: ship.cruiseLineId,
        cruiseLineName: cruiseLine?.name || 'Unknown',
        cruiseLineCode: cruiseLine?.code,
        shipClass: ship.shipClass,
        tonnage: ship.tonnage,
        totalCabins: ship.totalCabins,
        maxPassengers: ship.maxPassengers,
        starRating: ship.starRating,
        description: ship.description,
        highlights: ship.highlights,
        defaultShipImage: ship.defaultShipImage,
        defaultShipImage2k: ship.defaultShipImage2k,
        isActive: ship.isActive,
      };

      // Cache for 6 hours
      await cacheManager.set(cacheKey, shipInfo, { ttl: 21600 });

      logger.info(`Retrieved ship details for ${shipId}`);
      return shipInfo;
    } catch (error) {
      logger.error(`Failed to get ship details for ${shipId}:`, error);
      throw error;
    }
  }

  /**
   * Search ships by name
   */
  async searchShips(searchTerm: string): Promise<SimpleShip[]> {
    try {
      const allShips = await this.getAllShips();

      if (!searchTerm.trim()) {
        return allShips;
      }

      const searchLower = searchTerm.toLowerCase();

      // Filter ships that match the search term and exclude A-ROSA ships
      const filtered = allShips.filter(ship => {
        // First check if it's an A-ROSA ship and exclude it
        const cruiseLineName = ship.cruiseLineName.toLowerCase();
        const shipName = ship.name.toLowerCase();
        if (
          cruiseLineName.includes('a-rosa') ||
          cruiseLineName.includes('arosa') ||
          shipName.includes('a-rosa') ||
          shipName.includes('arosa')
        ) {
          return false;
        }

        // Then apply the search filter
        return shipName.includes(searchLower) || cruiseLineName.includes(searchLower);
      });

      // Sort by relevance (exact matches first, then starts with, then contains)
      filtered.sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();

        // Exact match
        if (aName === searchLower) return -1;
        if (bName === searchLower) return 1;

        // Starts with
        if (aName.startsWith(searchLower) && !bName.startsWith(searchLower)) return -1;
        if (bName.startsWith(searchLower) && !aName.startsWith(searchLower)) return 1;

        // Alphabetical for equal relevance
        return aName.localeCompare(bName);
      });

      return filtered;
    } catch (error) {
      logger.error(`Failed to search ships with term "${searchTerm}":`, error);
      throw error;
    }
  }
}

// Singleton instance
export const shipService = new ShipService();
