import { db } from '../db';
import {
  cruises,
  ships,
  cruiseLines,
  ports,
  regions,
  pricing,
  itineraries,
  cheapestPricing,
} from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../config/logger';

interface ProcessingResult {
  success: boolean;
  cruiseId?: string;
  action: 'created' | 'updated' | 'failed';
  error?: string;
}

export class CruiseDataProcessor {
  /**
   * Process cruise data from webhook - extracts and populates all related tables
   */
  async processCruiseData(cruiseData: any, filePath?: string): Promise<ProcessingResult> {
    try {
      // Traveltek uses 'codetocruiseid' as the unique cruise identifier
      const cruiseCode =
        cruiseData.codetocruiseid || cruiseData.cruise_id || cruiseData.id || cruiseData.code;
      const lineId = parseInt(cruiseData.lineid || cruiseData.line_id || cruiseData.lineId || '0');

      console.log(`[PROCESSOR] Processing cruise ${cruiseCode} for line ${lineId}`);

      // Start a transaction to ensure data consistency
      return await db.transaction(async tx => {
        // 1. Process cruise line if needed
        await this.processCruiseLine(tx, cruiseData.linecontent, lineId);

        // 2. Process ship
        const shipId = await this.processShip(tx, cruiseData.shipid, cruiseData.shipname, lineId);

        // 3. Process ports
        await this.processPorts(tx, cruiseData.ports);
        await this.processPort(tx, cruiseData.embarkportid, cruiseData.embarkport);
        await this.processPort(tx, cruiseData.disembarkportid, cruiseData.disembarkport);

        // 4. Process regions
        await this.processRegions(tx, cruiseData.regions);

        // 5. Process the cruise itself
        const existingCruise = await tx
          .select()
          .from(cruises)
          .where(eq(cruises.id, cruiseCode.toString()))
          .limit(1);

        const cruiseValues = {
          id: cruiseCode.toString(), // codetocruiseid is the primary key
          cruiseId: cruiseData.cruiseid?.toString(),
          traveltekCruiseId: parseInt(cruiseData.cruiseid || 0),
          cruiseLineId: lineId,
          shipId: shipId,
          name: cruiseData.name || cruiseData.cruise_name,
          voyageCode: cruiseData.voyagecode,
          itineraryCode: cruiseData.itinerarycode,
          sailingDate: this.parseDate(cruiseData.saildate),
          startDate: this.parseDate(cruiseData.startdate),
          returnDate: this.parseDate(cruiseData.returndate),
          nights: parseInt(cruiseData.nights || 0),
          sailNights: parseInt(cruiseData.sailnights || 0),
          seaDays: parseInt(cruiseData.seadays || 0),
          embarkationPortId: parseInt(cruiseData.embarkportid || 0) || null,
          disembarkationPortId: parseInt(cruiseData.disembarkportid || 0) || null,
          portIds: cruiseData.portids || [],
          regionIds: cruiseData.regionids || [],
          marketId: parseInt(cruiseData.marketid || 0) || null,
          ownerId: parseInt(cruiseData.ownerid || 0) || null,
          noFly: cruiseData.nofly === true || cruiseData.nofly === 1,
          departUk: cruiseData.departuk === true || cruiseData.departuk === 1,
          showCruise: cruiseData.showcruise !== false && cruiseData.showcruise !== 0,
          currency: cruiseData.currency || 'USD',
          lastCached: this.parseDate(cruiseData.lastcached) || new Date(),
          cachedDate: this.parseDate(cruiseData.cacheddate) || new Date(),
          rawData: cruiseData,
          isActive: true,
        };

        // Extract and add pricing data
        const pricingData = this.extractPricing(cruiseData);
        Object.assign(cruiseValues, pricingData);

        let action: 'created' | 'updated';

        if (existingCruise.length === 0) {
          // Create new cruise
          await tx.insert(cruises).values(cruiseValues);
          action = 'created';
          console.log(`[PROCESSOR] ✅ Created new cruise ${cruiseCode}`);
        } else {
          // Skip full update for now due to Drizzle issue
          // Just mark as updated - pricing will still be processed below
          action = 'updated';
          console.log(`[PROCESSOR] ✅ Cruise ${cruiseCode} exists, will update pricing`);
        }

        // 6. Process pricing records
        await this.processPricing(tx, cruiseCode, cruiseData);

        // 7. Process itinerary - skip for now
        // await this.processItinerary(tx, cruiseCode, cruiseData.itinerary);

        return {
          success: true,
          cruiseId: cruiseCode,
          action: action,
        };
      });
    } catch (error) {
      console.error(`[PROCESSOR] Failed to process cruise:`, error);
      return {
        success: false,
        action: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async processCruiseLine(tx: any, lineContent: any, lineId: number) {
    if (!lineContent || !lineId) return;

    const existingLine = await tx
      .select()
      .from(cruiseLines)
      .where(eq(cruiseLines.id, lineId))
      .limit(1);

    if (existingLine.length === 0) {
      await tx.insert(cruiseLines).values({
        id: lineId,
        name: lineContent?.name || `Line ${lineId}`,
        isActive: true,
      });
    }
  }

  private async processShip(
    tx: any,
    shipId: any,
    shipName: string,
    lineId: number
  ): Promise<number> {
    const id = parseInt(shipId || 0);
    if (!id) return 0;

    const existingShip = await tx.select().from(ships).where(eq(ships.id, id)).limit(1);

    if (existingShip.length === 0) {
      await tx.insert(ships).values({
        id: id,
        name: shipName || `Ship ${id}`,
        cruiseLineId: lineId,
        isActive: true,
      });
    }

    return id;
  }

  private async processPorts(tx: any, portsData: any) {
    if (!portsData) return;

    // Handle both object format {"295": "Southampton"} and array format
    let portEntries: Array<{ id: string; name: string }> = [];

    if (Array.isArray(portsData)) {
      portEntries = portsData.map(p => ({ id: p.id, name: p.name }));
    } else if (typeof portsData === 'object') {
      portEntries = Object.entries(portsData).map(([id, name]) => ({
        id: id,
        name: name as string,
      }));
    }

    for (const port of portEntries) {
      await this.processPort(tx, port.id, port.name);
    }
  }

  private async processPort(tx: any, portId: any, portName: string) {
    const id = parseInt(portId || 0);
    if (!id) return;

    const existingPort = await tx.select().from(ports).where(eq(ports.id, id)).limit(1);

    if (existingPort.length === 0) {
      await tx.insert(ports).values({
        id: id,
        name: portName || `Port ${id}`,
        isActive: true,
      });
    }
  }

  private async processRegions(tx: any, regionsData: any) {
    if (!regionsData) return;

    // Handle both object format {"4": "Europe"} and array format
    let regionEntries: Array<{ id: string; name: string }> = [];

    if (Array.isArray(regionsData)) {
      regionEntries = regionsData.map(r => ({ id: r.id, name: r.name }));
    } else if (typeof regionsData === 'object') {
      regionEntries = Object.entries(regionsData).map(([id, name]) => ({
        id: id,
        name: name as string,
      }));
    }

    for (const region of regionEntries) {
      const id = parseInt(region.id || '0');
      if (!id) continue;

      const existingRegion = await tx.select().from(regions).where(eq(regions.id, id)).limit(1);

      if (existingRegion.length === 0) {
        await tx.insert(regions).values({
          id: id,
          name: region.name || `Region ${id}`,
          code: null,
          description: null,
          isActive: true,
        });
      }
    }
  }

  private extractPricing(cruiseData: any): any {
    const pricing: any = {};

    // Extract cheapest pricing
    if (cruiseData.cheapest) {
      pricing.cheapestPrice = this.parsePrice(cruiseData.cheapest.price);
      pricing.cheapestPriceRaw = cruiseData.cheapest.price;
      pricing.cheapestPricing = cruiseData.cheapest;

      // Category-specific pricing
      if (cruiseData.cheapest.inside) {
        pricing.cheapestInside = this.parsePrice(cruiseData.cheapest.inside.price);
        pricing.cheapestInsidePriceCode = cruiseData.cheapest.inside.pricecode;
      }
      if (cruiseData.cheapest.outside) {
        pricing.cheapestOutside = this.parsePrice(cruiseData.cheapest.outside.price);
        pricing.cheapestOutsidePriceCode = cruiseData.cheapest.outside.pricecode;
      }
      if (cruiseData.cheapest.balcony) {
        pricing.cheapestBalcony = this.parsePrice(cruiseData.cheapest.balcony.price);
        pricing.cheapestBalconyPriceCode = cruiseData.cheapest.balcony.pricecode;
      }
      if (cruiseData.cheapest.suite) {
        pricing.cheapestSuite = this.parsePrice(cruiseData.cheapest.suite.price);
        pricing.cheapestSuitePriceCode = cruiseData.cheapest.suite.pricecode;
      }
    }

    // Extract alternative pricing from prices object
    if (cruiseData.prices) {
      pricing.pricesData = cruiseData.prices;

      // Look for specific cabin categories
      const categories = ['interior', 'oceanview', 'balcony', 'suite'];
      for (const category of categories) {
        if (cruiseData.prices[category]) {
          const key = `${category}Price`;
          pricing[key] = this.parsePrice(cruiseData.prices[category]);
        }
      }
    }

    // Store additional data
    if (cruiseData.cabins) {
      pricing.cabinsData = cruiseData.cabins;
    }

    return pricing;
  }

  private async processPricing(tx: any, cruiseId: string, cruiseData: any) {
    // Process detailed cabin pricing from Traveltek structure
    const pricingData = cruiseData.prices || {};

    // Log pricing data structure
    const pricingKeys = Object.keys(pricingData);
    console.log(
      `[PROCESSOR-PRICING] Processing pricing for cruise ${cruiseId}, found ${pricingKeys.length} rate codes`
    );

    if (pricingKeys.length === 0) {
      console.log(`[PROCESSOR-PRICING] No pricing data found for cruise ${cruiseId}`);
      return;
    }

    let pricingRecordsInserted = 0;
    let pricingRecordsSkipped = 0;

    // Process each rate code
    for (const rateCode in pricingData) {
      const cabins = pricingData[rateCode];

      // Process each cabin
      for (const cabinCode in cabins) {
        const cabinData = cabins[cabinCode];

        // Skip if no price data
        if (!cabinData.price && !cabinData.adultprice) {
          pricingRecordsSkipped++;
          continue;
        }

        // Map cabin type to standard categories
        const cabinType = (cabinData.cabintype || '').toLowerCase();
        let standardCabinType = 'unknown';
        if (cabinType.includes('inside') || cabinType.includes('interior')) {
          standardCabinType = 'interior';
        } else if (cabinType.includes('outside') || cabinType.includes('ocean')) {
          standardCabinType = 'oceanview';
        } else if (cabinType.includes('balcony')) {
          standardCabinType = 'balcony';
        } else if (cabinType.includes('suite')) {
          standardCabinType = 'suite';
        }

        // Create pricing record with proper occupancy codes
        // Using '101' as default occupancy code (2 adults)
        const pricingRecord = {
          cruiseId: cruiseId,
          rateCode: rateCode,
          cabinCode: cabinCode,
          occupancyCode: '101', // Standard 2-adult occupancy
          cabinType: standardCabinType,
          basePrice: this.parsePrice(cabinData.price),
          adultPrice: this.parsePrice(cabinData.adultprice),
          childPrice: this.parsePrice(cabinData.childprice),
          infantPrice: this.parsePrice(cabinData.infantprice),
          singlePrice: this.parsePrice(cabinData.singleprice),
          thirdAdultPrice: this.parsePrice(cabinData.thirdadultprice),
          fourthAdultPrice: this.parsePrice(cabinData.fourthadultprice),
          taxes: this.parsePrice(cabinData.taxes),
          ncf: this.parsePrice(cabinData.ncf),
          gratuity: this.parsePrice(cabinData.gratuity),
          fuel: this.parsePrice(cabinData.fuel),
          nonComm: this.parsePrice(cabinData.noncomm),
          totalPrice: this.parsePrice(cabinData.price) + this.parsePrice(cabinData.taxes),
          isAvailable: true,
          currency: cruiseData.currency || 'USD',
        };

        try {
          await tx.insert(pricing).values(pricingRecord);
          pricingRecordsInserted++;
        } catch (error) {
          console.error(
            `[PROCESSOR-PRICING] Failed to insert pricing for cabin ${cabinCode}:`,
            error
          );
        }
      }
    }

    console.log(
      `[PROCESSOR-PRICING] Inserted ${pricingRecordsInserted} pricing records, skipped ${pricingRecordsSkipped} for cruise ${cruiseId}`
    );

    // Also update cheapest_pricing table with combined data
    const cheapest = cruiseData.cheapest?.combined || cruiseData.cheapest?.prices || {};
    if (cheapest.inside || cheapest.outside || cheapest.balcony || cheapest.suite) {
      // Find the cheapest overall price
      const prices = [
        cheapest.inside ? this.parsePrice(cheapest.inside) : null,
        cheapest.outside ? this.parsePrice(cheapest.outside) : null,
        cheapest.balcony ? this.parsePrice(cheapest.balcony) : null,
        cheapest.suite ? this.parsePrice(cheapest.suite) : null,
      ].filter(p => p !== null);

      const cheapestPrice = prices.length > 0 ? Math.min(...prices) : null;

      const cheapestRecord = {
        cruiseId: cruiseId,
        cheapestPrice: cheapestPrice,
        interiorPrice: this.parsePrice(cheapest.inside),
        interiorPriceCode: cheapest.insidepricecode,
        oceanviewPrice: this.parsePrice(cheapest.outside),
        oceanviewPriceCode: cheapest.outsidepricecode,
        balconyPrice: this.parsePrice(cheapest.balcony),
        balconyPriceCode: cheapest.balconypricecode,
        suitePrice: this.parsePrice(cheapest.suite),
        suitePriceCode: cheapest.suitepricecode,
        currency: cruiseData.currency || 'USD',
        lastUpdated: new Date(),
      };

      await tx
        .insert(cheapestPricing)
        .values(cheapestRecord)
        .onConflictDoUpdate({
          target: [cheapestPricing.cruiseId],
          set: {
            cheapestPrice: cheapestRecord.cheapestPrice,
            interiorPrice: cheapestRecord.interiorPrice,
            interiorPriceCode: cheapestRecord.interiorPriceCode,
            oceanviewPrice: cheapestRecord.oceanviewPrice,
            oceanviewPriceCode: cheapestRecord.oceanviewPriceCode,
            balconyPrice: cheapestRecord.balconyPrice,
            balconyPriceCode: cheapestRecord.balconyPriceCode,
            suitePrice: cheapestRecord.suitePrice,
            suitePriceCode: cheapestRecord.suitePriceCode,
            lastUpdated: new Date(),
          },
        });
    }
  }

  private async processItinerary(tx: any, cruiseId: string, itineraryData: any) {
    if (!itineraryData) return;

    // Handle both array and object formats
    const items = Array.isArray(itineraryData) ? itineraryData : [itineraryData];

    for (const item of items) {
      if (!item.day && !item.port) continue;

      await tx
        .insert(itineraries)
        .values({
          cruiseId: cruiseId,
          day: parseInt(item.day || 0),
          portId: parseInt(item.portid || 0) || null,
          portName: item.port || item.portname,
          arrivalTime: item.arrival || item.arrivaltime,
          departureTime: item.departure || item.departuretime,
          description: item.description,
          rawItineraryData: item,
        })
        .onConflictDoNothing();
    }
  }

  private parseDate(dateStr: any): Date | null {
    if (!dateStr) return null;
    try {
      return new Date(dateStr);
    } catch {
      return null;
    }
  }

  private parsePrice(priceStr: any): number | null {
    if (!priceStr) return null;

    // Remove currency symbols and commas
    const cleaned = String(priceStr).replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleaned);

    return isNaN(parsed) ? null : parsed;
  }
}

// Singleton instance
let processorInstance: CruiseDataProcessor | null = null;

export const getCruiseDataProcessor = (): CruiseDataProcessor => {
  if (!processorInstance) {
    processorInstance = new CruiseDataProcessor();
  }
  return processorInstance;
};
