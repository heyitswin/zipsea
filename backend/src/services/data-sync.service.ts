// @ts-nocheck - Temporarily disabled due to schema mismatches
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../db/connection';
import { logger } from '../config/logger';
import { traveltekFTPService, CruiseDataFile } from './traveltek-ftp.service';
import { priceHistoryService } from './price-history.service';
import { 
  cruises, 
  alternativeSailings,
  pricing, 
  cheapestPricing,
  cruiseLines,
  ships,
  ports,
  regions,
  itineraries,
  cabinCategories
} from '../db/schema';
import type { 
  NewCruise, 
  NewAlternativeSailing,
  NewPricing, 
  NewCheapestPricing,
  NewCruiseLine,
  NewShip,
  NewPort,
  NewRegion,
  NewItinerary,
  NewCabinCategory
} from '../db/schema';

export interface TraveltekCruiseData {
  cruiseid: number;
  codetocruiseid: string;
  lineid: number;
  shipid: number;
  name: string;
  itinerarycode?: string;
  voyagecode?: string;
  startdate: string;
  saildate: string;
  nights: number;
  sailnights?: number;
  seadays?: number;
  startportid?: number;
  endportid?: number;
  marketid?: number;
  ownerid?: number;
  nofly?: boolean;
  departuk?: boolean;
  showcruise?: boolean;
  flycruiseinfo?: string;
  linecontent?: string;
  regionids?: number[];
  portids?: number[];
  ports?: string[];
  regions?: string[];
  itinerary?: any[];
  altsailings?: Array<{
    date: string;
    cruiseid: number;
    price: number;
  }>;
  shipcontent?: any;
  cabins?: Record<string, any>;
  prices?: Record<string, Record<string, Record<string, any>>>;
  cheapest?: any;
  cheapestinside?: any;
  cheapestoutside?: any;
  cheapestbalcony?: any;
  cheapestsuite?: any;
  cheapestinsidepricecode?: string;
  cheapestoutsidepricecode?: string;
  cheapestbalconypricecode?: string;
  cheapestsuitepricecode?: string;
  cachedprices?: Record<string, Record<string, Record<string, any>>>;
  lastcached?: string;
  cacheddate?: string;
}

export class DataSyncService {
  
  /**
   * Sync a single cruise data file from Traveltek
   */
  async syncCruiseDataFile(file: CruiseDataFile, data: TraveltekCruiseData): Promise<void> {
    try {
      logger.info(`Syncing cruise data file: ${file.filePath}`);

      // Start transaction
      await db.transaction(async (tx) => {
        // 1. Ensure cruise line exists
        await this.ensureCruiseLineExists(tx, data.lineid, data);

        // 2. Ensure ship exists
        await this.ensureShipExists(tx, data.shipid, data);

        // 3. Ensure ports exist
        await this.ensurePortsExist(tx, data);

        // 4. Ensure regions exist
        await this.ensureRegionsExist(tx, data);

        // 5. Ensure cabin categories exist
        await this.ensureCabinCategoriesExist(tx, data);

        // 6. Upsert cruise record
        await this.upsertCruise(tx, file, data);

        // 7. Sync itinerary
        await this.syncItinerary(tx, data);

        // 8. Sync alternative sailings
        await this.syncAlternativeSailings(tx, data);

        // 9. Capture price snapshot before updating pricing
        const batchId = await priceHistoryService.captureSnapshot(
          data.cruiseid, 
          'ftp_sync_update'
        );

        // 10. Sync pricing data
        await this.syncPricing(tx, data);

        // 11. Sync cheapest pricing (denormalized for fast queries)
        await this.syncCheapestPricing(tx, data);

        // 12. Calculate price changes for this update
        await priceHistoryService.calculatePriceChanges(batchId);
      });

      logger.info(`Successfully synced cruise ${data.cruiseid} from ${file.filePath}`);
    } catch (error) {
      logger.error(`Failed to sync cruise data file ${file.filePath}:`, error);
      throw error;
    }
  }

  /**
   * Ensure cruise line exists in database
   */
  private async ensureCruiseLineExists(tx: any, lineId: number, data: TraveltekCruiseData): Promise<void> {
    const existing = await tx.select().from(cruiseLines).where(eq(cruiseLines.id, lineId)).limit(1);
    
    if (existing.length === 0) {
      // Extract cruise line name according to Traveltek documentation
      // Priority order: linecontent.enginename > linecontent.name > linecontent.shortname > linename
      let lineName = `Cruise Line ${lineId}`;
      
      if (data.linecontent && typeof data.linecontent === 'object') {
        const lineContent = data.linecontent as any;
        // Per Traveltek API docs: use name field, not enginename (which is for internal use)
        lineName = lineContent.name || 
                   lineContent.shortname ||
                   lineContent.title ||
                   `Cruise Line ${lineId}`;
      } else if (typeof data.linecontent === 'string') {
        lineName = data.linecontent;
      }

      const newCruiseLine: NewCruiseLine = {
        id: lineId,
        name: lineName,
        code: `CL${lineId}`,
        description: typeof data.linecontent === 'string' ? data.linecontent : '',
        isActive: true,
      };

      await tx.insert(cruiseLines).values(newCruiseLine);
      logger.info(`Created new cruise line: ${lineId} - ${lineName}`);
    }
  }

  /**
   * Ensure ship exists in database
   */
  private async ensureShipExists(tx: any, shipId: number, data: TraveltekCruiseData): Promise<void> {
    const existing = await tx.select().from(ships).where(eq(ships.id, shipId)).limit(1);
    
    if (existing.length === 0) {
      const shipContent = data.shipcontent || {};
      
      // Extract ship name according to Traveltek documentation
      // Priority order: shipcontent.name > shipcontent.nicename > shipcontent.shortname > shipname
      let shipName = `Ship ${shipId}`;
      
      if (data.shipcontent && typeof data.shipcontent === 'object') {
        shipName = shipContent.name || 
                   shipContent.nicename ||
                   shipContent.shortname ||
                   `Ship ${shipId}`;
      }
      
      const newShip: NewShip = {
        id: shipId,
        cruiseLineId: data.lineid,
        name: shipName,
        code: shipContent.code || `SH${shipId}`,
        tonnage: shipContent.tonnage || null,
        totalCabins: shipContent.totalcabins || null,
        shipClass: shipContent.shipclass || null,
        occupancy: shipContent.occupancy || null,  // Per API docs: occupancy field, not limitof
        shortDescription: shipContent.shortdescription || '',
        highlights: shipContent.highlights || '',
        defaultShipImage: shipContent.defaultshipimage || null,
        defaultShipImage2k: shipContent.defaultshipimage2k || null,
        starRating: shipContent.starrating || null,
        isActive: true,
      };

      await tx.insert(ships).values(newShip);
      logger.info(`Created new ship: ${shipId} - ${shipName}`);
    }
  }

  /**
   * Ensure ports exist in database
   */
  private async ensurePortsExist(tx: any, data: TraveltekCruiseData): Promise<void> {
    if (!data.portids || !data.ports) return;

    const existingPorts = await tx.select().from(ports).where(inArray(ports.id, data.portids));
    const existingPortIds = existingPorts.map(p => p.id);
    const missingPortIds = data.portids.filter(id => !existingPortIds.includes(id));

    for (const portId of missingPortIds) {
      const portIndex = data.portids.indexOf(portId);
      const portName = data.ports[portIndex] || `Port ${portId}`;

      const newPort: NewPort = {
        id: portId,
        name: portName,
        code: `P${portId}`,
        country: '', // Will be updated manually or from other sources
        isActive: true,
      };

      await tx.insert(ports).values(newPort);
      logger.info(`Created new port: ${portId} - ${portName}`);
    }
  }

  /**
   * Ensure regions exist in database
   */
  private async ensureRegionsExist(tx: any, data: TraveltekCruiseData): Promise<void> {
    if (!data.regionids || !data.regions) return;

    const existingRegions = await tx.select().from(regions).where(inArray(regions.id, data.regionids));
    const existingRegionIds = existingRegions.map(r => r.id);
    const missingRegionIds = data.regionids.filter(id => !existingRegionIds.includes(id));

    for (const regionId of missingRegionIds) {
      const regionIndex = data.regionids.indexOf(regionId);
      const regionName = data.regions[regionIndex] || `Region ${regionId}`;

      const newRegion: NewRegion = {
        id: regionId,
        name: regionName,
        code: `R${regionId}`,
        description: '',
        isActive: true,
      };

      await tx.insert(regions).values(newRegion);
      logger.info(`Created new region: ${regionId} - ${regionName}`);
    }
  }

  /**
   * Ensure cabin categories exist in database
   */
  private async ensureCabinCategoriesExist(tx: any, data: TraveltekCruiseData): Promise<void> {
    if (!data.cabins) return;

    const cabinCodes = Object.keys(data.cabins);
    const existingCabins = await tx.select().from(cabinCategories).where(inArray(cabinCategories.cabinCode, cabinCodes));
    const existingCabinCodes = existingCabins.map(c => c.code);
    const missingCabinCodes = cabinCodes.filter(code => !existingCabinCodes.includes(code));

    for (const cabinCode of missingCabinCodes) {
      const cabinData = data.cabins[cabinCode];

      const newCabinCategory: NewCabinCategory = {
        shipId: data.shipid,
        name: cabinData.name || cabinCode,
        cabinCode: cabinCode,
        cabinCodeAlt: cabinData.cabincode2 || null,
        category: cabinData.codtype || this.inferCabinType(cabinCode),
        categoryAlt: cabinData.codtype2 || null,
        description: cabinData.description || '',
        colorCode: cabinData.colourcode || null,
        colorCodeAlt: cabinData.colourcode2 || null,
        imageUrl: cabinData.imageurl || null,
        imageUrlHd: cabinData.imageurl2k || null,
        isDefault: cabinData.isdefault || false,
        validFrom: cabinData.validfrom ? new Date(cabinData.validfrom).toISOString().split('T')[0] : null,
        validTo: cabinData.validto ? new Date(cabinData.validto).toISOString().split('T')[0] : null,
        isActive: true,
      };

      await tx.insert(cabinCategories).values(newCabinCategory);
      logger.info(`Created new cabin category: ${cabinCode}`);
    }
  }

  /**
   * Infer cabin type from cabin code
   */
  private inferCabinType(cabinCode: string): string {
    const code = cabinCode.toUpperCase();
    if (code.startsWith('IB') || code.startsWith('IA') || code.startsWith('IC')) return 'inside';
    if (code.startsWith('OV') || code.startsWith('OA') || code.startsWith('OB')) return 'oceanview';
    if (code.startsWith('BA') || code.startsWith('BB') || code.startsWith('BC')) return 'balcony';
    if (code.startsWith('S') || code.startsWith('JS') || code.startsWith('OS')) return 'suite';
    return 'unknown';
  }

  /**
   * Upsert cruise record
   */
  private async upsertCruise(tx: any, file: CruiseDataFile, data: TraveltekCruiseData): Promise<void> {
    const sailingDate = new Date(data.saildate);
    const returnDate = new Date(sailingDate);
    returnDate.setDate(returnDate.getDate() + data.nights);

    const cruiseRecord: NewCruise = {
      id: Number(data.codetocruiseid), // ID is now codetocruiseid (unique per sailing)
      cruiseId: Number(data.cruiseid), // cruiseId is the original cruiseid (can duplicate)
      cruiseLineId: data.lineid,
      shipId: data.shipid,
      name: data.name,
      itineraryCode: data.itinerarycode || null,
      voyageCode: data.voyagecode || null,
      sailingDate: data.saildate,
      nights: data.nights,
      seaDays: data.seadays || null,
      embarkPortId: data.startportid || null,
      disembarkPortId: data.endportid || null,
      regionIds: data.regionids ? data.regionids.join(',') : null, // Store as comma-separated string
      portIds: data.portids ? data.portids.join(',') : null, // Store as comma-separated string
      marketId: data.marketid || null,
      ownerId: 'system', // Changed to VARCHAR with default 'system'
      noFly: data.nofly || false,
      departUk: data.departuk || false,
      showCruise: data.showcruise !== false,
      lastCached: data.lastcached ? Number(data.lastcached) : null, // This is INTEGER (Unix timestamp)
      cachedDate: data.cacheddate ? new Date(data.cacheddate) : null, // This is TIMESTAMP
      isActive: true,
      updatedAt: new Date(),
    };

    await tx.insert(cruises).values(cruiseRecord).onConflictDoUpdate({
      target: cruises.id,
      set: {
        ...cruiseRecord,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Sync itinerary data
   */
  private async syncItinerary(tx: any, data: TraveltekCruiseData): Promise<void> {
    if (!data.itinerary || data.itinerary.length === 0) return;

    // Delete existing itinerary for this cruise
    await tx.delete(itineraries).where(eq(itineraries.cruiseId, data.cruiseid));

    // Insert new itinerary data
    for (const dayData of data.itinerary) {
      const itineraryRecord: NewItinerary = {
        cruiseId: data.cruiseid,
        dayNumber: dayData.day || 1,
        date: dayData.date || null,
        portName: dayData.port || 'At Sea',
        arrivalTime: dayData.arrive || null,
        departureTime: dayData.depart || null,
        description: dayData.description || '',
        status: dayData.port === 'At Sea' || !dayData.port ? 'at_sea' : 'port',
      };

      await tx.insert(itineraries).values(itineraryRecord);
    }

    logger.info(`Synced ${data.itinerary.length} itinerary days for cruise ${data.cruiseid}`);
  }

  /**
   * Sync alternative sailings
   */
  private async syncAlternativeSailings(tx: any, data: TraveltekCruiseData): Promise<void> {
    if (!data.altsailings || data.altsailings.length === 0) return;

    // Delete existing alternative sailings for this cruise
    await tx.delete(alternativeSailings).where(eq(alternativeSailings.baseCruiseId, data.cruiseid));

    // Insert new alternative sailings
    for (const altSailing of data.altsailings) {
      const altSailingRecord: NewAlternativeSailing = {
        baseCruiseId: data.cruiseid,
        alternativeCruiseId: altSailing.cruiseid,
        sailingDate: altSailing.date,
        price: altSailing.price?.toString() || null,
      };

      await tx.insert(alternativeSailings).values(altSailingRecord);
    }

    logger.info(`Synced ${data.altsailings.length} alternative sailings for cruise ${data.cruiseid}`);
  }

  /**
   * Sync pricing data (both static and live)
   */
  private async syncPricing(tx: any, data: TraveltekCruiseData): Promise<void> {
    // Delete existing pricing for this cruise
    await tx.delete(pricing).where(eq(pricing.cruiseId, data.cruiseid));

    // Sync static pricing only (we don't have live pricing)
    if (data.prices) {
      await this.syncStaticPricing(tx, data.cruiseid, data.prices);
    }
  }

  /**
   * Sync static pricing data - Fixed for 2-level structure
   */
  private async syncStaticPricing(tx: any, cruiseId: number, prices: Record<string, Record<string, any>>): Promise<void> {
    const pricingRecords: NewPricing[] = [];

    // Fixed: Traveltek uses 2-level structure (rateCode -> cabinId -> priceData)
    for (const [rateCode, rateData] of Object.entries(prices)) {
      if (!rateData || typeof rateData !== 'object') continue;
      
      for (const [cabinId, priceData] of Object.entries(rateData)) {
        if (!priceData || typeof priceData !== 'object') continue;
        
        // Extract cabin type and determine cabin code
        let cabinCode = cabinId;
        const occupancyCode = '101'; // Default occupancy
        
        if (priceData.cabintype) {
          const upperType = priceData.cabintype.toUpperCase();
          if (upperType.includes('INTERIOR') || upperType.includes('INSIDE')) {
            cabinCode = 'INT';
          } else if (upperType.includes('OCEAN') || upperType.includes('OUTSIDE')) {
            cabinCode = 'OV';
          } else if (upperType.includes('BALCONY')) {
            cabinCode = 'BAL';
          } else if (upperType.includes('SUITE')) {
            cabinCode = 'STE';
          } else {
            cabinCode = priceData.cabintype.substring(0, 10);
          }
        }
        
        const pricingRecord: NewPricing = {
          cruiseId,
          rateCode,
          cabinCode,
          occupancyCode,
          cabinType: priceData.cabintype || null,
          basePrice: priceData.price?.toString() || null,
          adultPrice: priceData.adultprice?.toString() || null,
          childPrice: priceData.childprice?.toString() || null,
          infantPrice: priceData.infantprice?.toString() || null,
          singlePrice: priceData.singleprice?.toString() || null,
          thirdAdultPrice: priceData.thirdadultprice?.toString() || null,
          fourthAdultPrice: priceData.fourthadultprice?.toString() || null,
          taxes: priceData.taxes?.toString() || null,
          ncf: priceData.ncf?.toString() || null,
          gratuity: priceData.gratuity?.toString() || null,
          fuel: priceData.fuel?.toString() || null,
          nonComm: priceData.noncomm?.toString() || null,
          isAvailable: true,
          currency: 'USD',
        };

        pricingRecords.push(pricingRecord);
      }
    }

    if (pricingRecords.length > 0) {
      await tx.insert(pricing).values(pricingRecords);
      logger.info(`Synced ${pricingRecords.length} static pricing records for cruise ${cruiseId}`);
    }
  }

  /**
   * Removed syncLivePricing - we only have static pricing
   */
  private async syncLivePricingRemoved(tx: any, cruiseId: number, cachedPrices: Record<string, Record<string, Record<string, any>>>): Promise<void> {
    const pricingRecords: NewPricing[] = [];

    for (const [rateCode, cabinCodes] of Object.entries(cachedPrices)) {
      for (const [cabinCode, occupancies] of Object.entries(cabinCodes)) {
        for (const [occupancyCode, priceData] of Object.entries(occupancies)) {
          const pricingRecord: NewPricing = {
            cruiseId,
            rateCode,
            cabinCode,
            occupancyCode,
            cabinType: priceData.cabintype || null,
            basePrice: priceData.price?.toString() || null,
            adultPrice: priceData.adultprice?.toString() || null,
            childPrice: priceData.childprice?.toString() || null,
            infantPrice: priceData.infantprice?.toString() || null,
            singlePrice: priceData.singleprice?.toString() || null,
            thirdAdultPrice: priceData.thirdadultprice?.toString() || null,
            fourthAdultPrice: priceData.fourthadultprice?.toString() || null,
            taxes: priceData.taxes?.toString() || null,
            ncf: priceData.ncf?.toString() || null,
            gratuity: priceData.gratuity?.toString() || null,
            fuel: priceData.fuel?.toString() || null,
            nonComm: priceData.noncomm?.toString() || null,
            isAvailable: true,
            currency: 'USD',
          };

          pricingRecords.push(pricingRecord);
        }
      }
    }

    if (pricingRecords.length > 0) {
      await tx.insert(pricing).values(pricingRecords);
      logger.info(`Synced ${pricingRecords.length} live pricing records for cruise ${cruiseId}`);
    }
  }

  /**
   * Sync cheapest pricing (denormalized for fast search) with fallback logic
   */
  private async syncCheapestPricing(tx: any, data: TraveltekCruiseData): Promise<void> {
    // Delete existing cheapest pricing for this cruise
    await tx.delete(cheapestPricing).where(eq(cheapestPricing.cruiseId, data.cruiseid));

    // Extract combined pricing with fallback logic
    const cheapestObj = data.cheapest || {};
    const combined = cheapestObj.combined || {};
    const cachedPrices = cheapestObj.cachedprices || {};
    const staticPrices = cheapestObj.prices || {};

    // Use fallback logic: combined → cached → static → direct cheapest fields
    const interiorPrice = this.parsePrice(combined.inside) || 
                         this.parsePrice(cachedPrices.inside) || 
                         this.parsePrice(staticPrices.inside) ||
                         this.parsePrice(data.cheapestinside?.price);
    
    const oceanviewPrice = this.parsePrice(combined.outside) || 
                          this.parsePrice(cachedPrices.outside) || 
                          this.parsePrice(staticPrices.outside) ||
                          this.parsePrice(data.cheapestoutside?.price);
    
    const balconyPrice = this.parsePrice(combined.balcony) || 
                        this.parsePrice(cachedPrices.balcony) || 
                        this.parsePrice(staticPrices.balcony) ||
                        this.parsePrice(data.cheapestbalcony?.price);
    
    const suitePrice = this.parsePrice(combined.suite) || 
                      this.parsePrice(cachedPrices.suite) || 
                      this.parsePrice(staticPrices.suite) ||
                      this.parsePrice(data.cheapestsuite?.price);

    // Find overall cheapest price
    const allPrices = [
      { price: interiorPrice, type: 'interior' },
      { price: oceanviewPrice, type: 'oceanview' },
      { price: balconyPrice, type: 'balcony' },
      { price: suitePrice, type: 'suite' }
    ].filter(p => p.price && p.price > 0);

    const cheapestPrice = allPrices.length > 0 ? 
      Math.min(...allPrices.map(p => p.price!)) : null;
    
    const cheapestCabinType = allPrices.length > 0 ?
      allPrices.find(p => p.price === cheapestPrice)?.type || 'unknown' : 'unknown';

    const cheapestRecord: NewCheapestPricing = {
      cruiseId: data.cruiseid,
      
      // Overall cheapest - use calculated values with fallback to original data
      cheapestPrice: cheapestPrice?.toString() || data.cheapest?.price?.toString() || null,
      cheapestCabinType: cheapestCabinType || data.cheapest?.cabintype || null,
      cheapestTaxes: data.cheapest?.taxes?.toString() || null,
      cheapestNcf: data.cheapest?.ncf?.toString() || null,
      cheapestGratuity: data.cheapest?.gratuity?.toString() || null,
      cheapestFuel: data.cheapest?.fuel?.toString() || null,
      cheapestNonComm: data.cheapest?.noncomm?.toString() || null,
      
      // Interior - use fallback pricing with original price codes
      interiorPrice: interiorPrice?.toString() || null,
      interiorTaxes: data.cheapestinside?.taxes?.toString() || null,
      interiorNcf: data.cheapestinside?.ncf?.toString() || null,
      interiorGratuity: data.cheapestinside?.gratuity?.toString() || null,
      interiorFuel: data.cheapestinside?.fuel?.toString() || null,
      interiorNonComm: data.cheapestinside?.noncomm?.toString() || null,
      interiorPriceCode: combined.insidepricecode || cachedPrices.insidepricecode || 
                        staticPrices.insidepricecode || data.cheapestinsidepricecode || null,
      
      // Oceanview - use fallback pricing with original price codes
      oceanviewPrice: oceanviewPrice?.toString() || null,
      oceanviewTaxes: data.cheapestoutside?.taxes?.toString() || null,
      oceanviewNcf: data.cheapestoutside?.ncf?.toString() || null,
      oceanviewGratuity: data.cheapestoutside?.gratuity?.toString() || null,
      oceanviewFuel: data.cheapestoutside?.fuel?.toString() || null,
      oceanviewNonComm: data.cheapestoutside?.noncomm?.toString() || null,
      oceanviewPriceCode: combined.outsidepricecode || cachedPrices.outsidepricecode || 
                         staticPrices.outsidepricecode || data.cheapestoutsidepricecode || null,
      
      // Balcony - use fallback pricing with original price codes
      balconyPrice: balconyPrice?.toString() || null,
      balconyTaxes: data.cheapestbalcony?.taxes?.toString() || null,
      balconyNcf: data.cheapestbalcony?.ncf?.toString() || null,
      balconyGratuity: data.cheapestbalcony?.gratuity?.toString() || null,
      balconyFuel: data.cheapestbalcony?.fuel?.toString() || null,
      balconyNonComm: data.cheapestbalcony?.noncomm?.toString() || null,
      balconyPriceCode: combined.balconypricecode || cachedPrices.balconypricecode || 
                       staticPrices.balconypricecode || data.cheapestbalconypricecode || null,
      
      // Suite - use fallback pricing with original price codes
      suitePrice: suitePrice?.toString() || null,
      suiteTaxes: data.cheapestsuite?.taxes?.toString() || null,
      suiteNcf: data.cheapestsuite?.ncf?.toString() || null,
      suiteGratuity: data.cheapestsuite?.gratuity?.toString() || null,
      suiteFuel: data.cheapestsuite?.fuel?.toString() || null,
      suiteNonComm: data.cheapestsuite?.noncomm?.toString() || null,
      suitePriceCode: combined.suitepricecode || cachedPrices.suitepricecode || 
                     staticPrices.suitepricecode || data.cheapestsuitepricecode || null,
      
      currency: 'USD',
      lastUpdated: new Date(),
    };

    await tx.insert(cheapestPricing).values(cheapestRecord);
    logger.info(`Synced cheapest pricing for cruise ${data.cruiseid} with combined fallback logic`);
  }

  /**
   * Helper method to parse price values
   */
  private parsePrice(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const num = parseFloat(value);
    return isNaN(num) || num <= 0 ? null : num;
  }

  /**
   * Batch sync multiple cruise data files
   */
  async batchSyncCruiseData(fileDataPairs: { file: CruiseDataFile; data: TraveltekCruiseData }[]): Promise<{
    successful: number;
    failed: number;
    errors: Array<{ file: string; error: string }>;
  }> {
    let successful = 0;
    let failed = 0;
    const errors: Array<{ file: string; error: string }> = [];

    logger.info(`Starting batch sync of ${fileDataPairs.length} cruise files`);

    for (const { file, data } of fileDataPairs) {
      try {
        await this.syncCruiseDataFile(file, data);
        successful++;
      } catch (error) {
        failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({ file: file.filePath, error: errorMessage });
        logger.error(`Failed to sync ${file.filePath}: ${errorMessage}`);
      }
    }

    logger.info(`Batch sync completed: ${successful} successful, ${failed} failed`);
    return { successful, failed, errors };
  }

  /**
   * Sync recent cruise data from FTP
   */
  async syncRecentCruiseData(days: number = 1): Promise<void> {
    try {
      logger.info(`Starting sync of recent cruise data (${days} days)`);

      // Get recent files from FTP
      const recentFiles = await traveltekFTPService.getRecentCruiseFiles(days);
      logger.info(`Found ${recentFiles.length} recent files to sync`);

      if (recentFiles.length === 0) {
        logger.info('No recent files to sync');
        return;
      }

      // Download and sync files in batches
      const fileDataPairs = await traveltekFTPService.batchDownloadCruiseData(recentFiles, 5);
      const result = await this.batchSyncCruiseData(fileDataPairs);

      logger.info(`Sync completed: ${result.successful} successful, ${result.failed} failed`);
      
      if (result.errors.length > 0) {
        logger.warn('Sync errors:', result.errors);
      }
    } catch (error) {
      logger.error('Failed to sync recent cruise data:', error);
      throw error;
    }
  }

  /**
   * Full sync of all available cruise data
   */
  async fullSyncCruiseData(year?: string, month?: string): Promise<void> {
    try {
      logger.info('Starting full sync of cruise data');

      // Discover all available files
      const allFiles = await traveltekFTPService.discoverCruiseFiles(year, month);
      logger.info(`Found ${allFiles.length} total files to sync`);

      if (allFiles.length === 0) {
        logger.info('No files to sync');
        return;
      }

      // Process in smaller batches for full sync
      const batchSize = 10;
      let totalSuccessful = 0;
      let totalFailed = 0;
      const allErrors: Array<{ file: string; error: string }> = [];

      for (let i = 0; i < allFiles.length; i += batchSize) {
        const batch = allFiles.slice(i, i + batchSize);
        logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allFiles.length / batchSize)}`);

        const fileDataPairs = await traveltekFTPService.batchDownloadCruiseData(batch, batchSize);
        const result = await this.batchSyncCruiseData(fileDataPairs);

        totalSuccessful += result.successful;
        totalFailed += result.failed;
        allErrors.push(...result.errors);

        // Small delay between batches
        if (i + batchSize < allFiles.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      logger.info(`Full sync completed: ${totalSuccessful} successful, ${totalFailed} failed`);
      
      if (allErrors.length > 0) {
        logger.warn(`Total sync errors: ${allErrors.length}`, allErrors.slice(0, 10)); // Log first 10 errors
      }
    } catch (error) {
      logger.error('Failed to perform full sync:', error);
      throw error;
    }
  }
}

// Singleton instance
export const dataSyncService = new DataSyncService();