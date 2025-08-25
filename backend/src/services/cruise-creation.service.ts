import { db } from '../db/connection';
import { sql } from '../db/connection';
import { logger } from '../config/logger';
import { traveltekFTPService } from './traveltek-ftp.service';
import { 
  cruises, 
  ships, 
  cruiseLines, 
  ports, 
  regions,
  cheapestPricing,
  pricing,
  itineraries 
} from '../db/schema';

export class CruiseCreationService {
  /**
   * Auto-create a cruise from webhook data when it doesn't exist in database
   */
  async createCruiseFromWebhook(cruiseCode: string, lineId: string, filePath?: string): Promise<number | null> {
    try {
      logger.info(`🆕 Auto-creating cruise ${cruiseCode} from webhook`, { lineId, filePath });

      // Try to fetch cruise data from FTP
      let cruiseData = null;
      if (filePath) {
        cruiseData = await this.fetchCruiseDataFromFTP(filePath);
      }

      if (!cruiseData) {
        // Try alternative paths
        cruiseData = await this.discoverCruiseData(cruiseCode, lineId);
      }

      if (!cruiseData) {
        logger.error(`❌ Unable to fetch cruise data for auto-creation`, { cruiseCode, lineId });
        return null;
      }

      // Create the cruise and all related records
      const cruiseId = await this.createCompleteCruise(cruiseData, cruiseCode);
      
      logger.info(`✅ Successfully auto-created cruise ${cruiseCode}`, { 
        cruiseId, 
        name: cruiseData.name,
        ship: cruiseData.shipname 
      });

      return cruiseId;
    } catch (error) {
      logger.error(`❌ Failed to auto-create cruise ${cruiseCode}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        lineId,
      });
      return null;
    }
  }

  /**
   * Fetch cruise data from FTP
   */
  private async fetchCruiseDataFromFTP(filePath: string): Promise<any> {
    try {
      // Try primary path
      let data = await traveltekFTPService.getCruiseDataFile(filePath);
      if (data) return data;

      // Try alternative paths with different date formats
      const alternativePaths = this.generateAlternativePaths(filePath);
      for (const altPath of alternativePaths) {
        data = await traveltekFTPService.getCruiseDataFile(altPath);
        if (data) return data;
      }

      return null;
    } catch (error) {
      logger.error(`Failed to fetch cruise data from FTP`, {
        filePath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Try to discover cruise data using various strategies
   */
  private async discoverCruiseData(cruiseCode: string, lineId: string): Promise<any> {
    try {
      logger.info(`🔍 Attempting to discover cruise data`, { cruiseCode, lineId });

      // Strategy 1: Try to find by cruise code pattern
      const currentYear = new Date().getFullYear();
      const nextYear = currentYear + 1;
      
      const searchPaths = [
        `cruises/${currentYear}/${lineId}/${cruiseCode}.json`,
        `cruises/${nextYear}/${lineId}/${cruiseCode}.json`,
        `${currentYear}/${lineId}/${cruiseCode}.json`,
        `${nextYear}/${lineId}/${cruiseCode}.json`,
      ];

      for (const searchPath of searchPaths) {
        const data = await traveltekFTPService.getCruiseDataFile(searchPath);
        if (data) {
          logger.info(`✅ Found cruise data at ${searchPath}`, { cruiseCode });
          return data;
        }
      }

      // Strategy 2: List directory and find matching files
      const directories = [
        `cruises/${currentYear}/${lineId}/`,
        `cruises/${nextYear}/${lineId}/`,
      ];

      for (const dir of directories) {
        const files = await traveltekFTPService.listFiles(dir);
        const matchingFile = files.find(f => 
          f.includes(cruiseCode) || 
          f.includes(cruiseCode.replace(/_/g, ''))
        );
        
        if (matchingFile) {
          const data = await traveltekFTPService.getCruiseDataFile(`${dir}${matchingFile}`);
          if (data) {
            logger.info(`✅ Discovered cruise data at ${dir}${matchingFile}`, { cruiseCode });
            return data;
          }
        }
      }

      return null;
    } catch (error) {
      logger.error(`Failed to discover cruise data`, {
        cruiseCode,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Create a complete cruise with all related records
   */
  private async createCompleteCruise(cruiseData: any, cruiseCode: string): Promise<number> {
    // Start transaction
    const client = await db.connect();
    await client.query('BEGIN');

    try {
      // 1. Ensure cruise line exists
      const cruiseLineId = await this.ensureCruiseLine(cruiseData.cruiselinename || cruiseData.linename);

      // 2. Ensure ship exists
      const shipId = await this.ensureShip(cruiseData.shipname, cruiseLineId, cruiseData);

      // 3. Ensure ports exist
      const embarkPortId = await this.ensurePort(cruiseData.embarkportname || cruiseData.embarkport);
      const disembarkPortId = await this.ensurePort(cruiseData.disembarkportname || cruiseData.disembarkport);

      // 4. Create the cruise
      const cruiseResult = await client.query(sql`
        INSERT INTO cruises (
          cruise_id,
          name,
          ship_id,
          nights,
          sail_nights,
          sea_days,
          sailing_date,
          return_date,
          embarkation_port_id,
          disembarkation_port_id,
          itinerary_code,
          voyage_code,
          currency,
          is_active,
          created_at,
          updated_at
        ) VALUES (
          ${cruiseCode},
          ${cruiseData.name || `${cruiseData.nights || 0} Night Cruise`},
          ${shipId},
          ${parseInt(cruiseData.nights) || 0},
          ${parseInt(cruiseData.sailnights) || parseInt(cruiseData.nights) || 0},
          ${parseInt(cruiseData.seadays) || 0},
          ${this.parseDate(cruiseData.sailingdate)},
          ${this.parseDate(cruiseData.returndate)},
          ${embarkPortId},
          ${disembarkPortId},
          ${cruiseData.itinerarycode},
          ${cruiseData.voyagecode},
          ${cruiseData.currency || 'USD'},
          true,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT (cruise_id) DO UPDATE SET
          updated_at = CURRENT_TIMESTAMP
        RETURNING id
      `);

      const cruiseId = cruiseResult.rows[0].id;

      // 5. Create cheapest pricing
      if (cruiseData.cheapestprice) {
        await this.createCheapestPricing(cruiseId, cruiseData);
      }

      // 6. Create detailed pricing
      if (cruiseData.pricing && Array.isArray(cruiseData.pricing)) {
        await this.createDetailedPricing(cruiseId, cruiseData.pricing);
      }

      // 7. Create itinerary
      if (cruiseData.itinerary && Array.isArray(cruiseData.itinerary)) {
        await this.createItinerary(cruiseId, cruiseData.itinerary);
      }

      await client.query('COMMIT');
      return cruiseId;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Ensure cruise line exists or create it
   */
  private async ensureCruiseLine(lineName: string): Promise<number> {
    if (!lineName) {
      // Default cruise line
      lineName = 'Unknown Cruise Line';
    }

    const result = await db.execute(sql`
      INSERT INTO cruise_lines (name, code)
      VALUES (${lineName}, ${lineName.substring(0, 4).toUpperCase()})
      ON CONFLICT (name) DO UPDATE SET
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `);

    return result[0].id;
  }

  /**
   * Ensure ship exists or create it
   */
  private async ensureShip(shipName: string, cruiseLineId: number, cruiseData: any): Promise<number> {
    if (!shipName) {
      shipName = 'Unknown Ship';
    }

    const result = await db.execute(sql`
      INSERT INTO ships (
        name,
        cruise_line_id,
        ship_code,
        capacity,
        tonnage,
        year_built,
        default_ship_image
      ) VALUES (
        ${shipName},
        ${cruiseLineId},
        ${cruiseData.shipcode || shipName.substring(0, 10).toUpperCase()},
        ${parseInt(cruiseData.capacity) || 0},
        ${parseInt(cruiseData.tonnage) || 0},
        ${parseInt(cruiseData.yearbuilt) || 0},
        ${cruiseData.shipimage || cruiseData.default_ship_image}
      )
      ON CONFLICT (name, cruise_line_id) DO UPDATE SET
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `);

    return result[0].id;
  }

  /**
   * Ensure port exists or create it
   */
  private async ensurePort(portName: string): Promise<number> {
    if (!portName) {
      portName = 'Unknown Port';
    }

    const result = await db.execute(sql`
      INSERT INTO ports (name, code)
      VALUES (${portName}, ${portName.substring(0, 3).toUpperCase()})
      ON CONFLICT (name) DO UPDATE SET
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `);

    return result[0].id;
  }

  /**
   * Create cheapest pricing record
   */
  private async createCheapestPricing(cruiseId: number, cruiseData: any): Promise<void> {
    await db.execute(sql`
      INSERT INTO cheapest_pricing (
        cruise_id,
        cheapest_price,
        cheapest_cabin_type,
        interior_price,
        oceanview_price,
        balcony_price,
        suite_price,
        studio_price,
        spa_price,
        haven_price
      ) VALUES (
        ${cruiseId},
        ${this.parseDecimal(cruiseData.cheapestprice)},
        ${cruiseData.cheapestcabintype},
        ${this.parseDecimal(cruiseData.cheapestinside)},
        ${this.parseDecimal(cruiseData.cheapestoceanview)},
        ${this.parseDecimal(cruiseData.cheapestbalcony)},
        ${this.parseDecimal(cruiseData.cheapestsuite)},
        ${this.parseDecimal(cruiseData.cheapeststudio)},
        ${this.parseDecimal(cruiseData.cheapestspa)},
        ${this.parseDecimal(cruiseData.cheapesthaven)}
      )
      ON CONFLICT (cruise_id) DO UPDATE SET
        cheapest_price = EXCLUDED.cheapest_price,
        updated_at = CURRENT_TIMESTAMP
    `);
  }

  /**
   * Create detailed pricing records
   */
  private async createDetailedPricing(cruiseId: number, pricingData: any[]): Promise<void> {
    for (const price of pricingData) {
      await db.execute(sql`
        INSERT INTO pricing (
          cruise_id,
          cabin_type,
          cabin_category,
          rate_code,
          price,
          currency,
          occupancy
        ) VALUES (
          ${cruiseId},
          ${price.cabintype},
          ${price.cabincategory},
          ${price.ratecode},
          ${this.parseDecimal(price.price)},
          ${price.currency || 'USD'},
          ${parseInt(price.occupancy) || 2}
        )
        ON CONFLICT (cruise_id, cabin_type, rate_code) DO UPDATE SET
          price = EXCLUDED.price,
          updated_at = CURRENT_TIMESTAMP
      `);
    }
  }

  /**
   * Create itinerary records
   */
  private async createItinerary(cruiseId: number, itineraryData: any[]): Promise<void> {
    for (const day of itineraryData) {
      const portId = await this.ensurePort(day.portname || day.port);
      
      await db.execute(sql`
        INSERT INTO itineraries (
          cruise_id,
          day_number,
          port_id,
          arrival_time,
          departure_time,
          description
        ) VALUES (
          ${cruiseId},
          ${parseInt(day.daynumber) || 0},
          ${portId},
          ${day.arrivaltime},
          ${day.departuretime},
          ${day.description}
        )
        ON CONFLICT (cruise_id, day_number) DO UPDATE SET
          port_id = EXCLUDED.port_id,
          updated_at = CURRENT_TIMESTAMP
      `);
    }
  }

  /**
   * Helper function to generate alternative file paths
   */
  private generateAlternativePaths(originalPath: string): string[] {
    const paths: string[] = [];
    
    // Try different directory structures
    if (originalPath.includes('cruises/')) {
      paths.push(originalPath.replace('cruises/', ''));
    } else {
      paths.push(`cruises/${originalPath}`);
    }

    // Try different date formats
    const dateMatch = originalPath.match(/(\d{4})\/(\d{2})\//);
    if (dateMatch) {
      const [, year, month] = dateMatch;
      const altMonth = month.padStart(2, '0');
      paths.push(originalPath.replace(`${year}/${month}/`, `${year}/${altMonth}/`));
    }

    return paths;
  }

  /**
   * Parse date string to Date object
   */
  private parseDate(dateStr: string | undefined): Date | null {
    if (!dateStr) return null;
    try {
      return new Date(dateStr);
    } catch {
      return null;
    }
  }

  /**
   * Parse decimal value
   */
  private parseDecimal(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }
}

// Export singleton instance
export const cruiseCreationService = new CruiseCreationService();