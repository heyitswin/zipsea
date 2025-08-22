import { eq, and, inArray, desc, asc, aliasedTable } from 'drizzle-orm';
import { db } from '../db/connection';
import { logger } from '../config/logger';
import { cacheManager } from '../cache/cache-manager';
import { CacheKeys } from '../cache/cache-keys';
import { 
  cruises, 
  cruiseLines, 
  ships, 
  ports, 
  regions, 
  cheapestPricing,
  pricing,
  itineraries,
  cabinCategories,
  alternativeSailings
} from '../db/schema';

export interface CruiseDetails {
  id: number;
  name: string;
  itineraryCode?: string;
  voyageCode?: string;
  nights: number;
  sailNights?: number;
  seaDays?: number;
  sailingDate: string;
  returnDate?: string;
  embarkPort?: PortInfo;
  disembarkPort?: PortInfo;
  cruiseLine: CruiseLineInfo;
  ship: ShipInfo;
  regions: RegionInfo[];
  ports: PortInfo[];
  itinerary: ItineraryDay[];
  pricing: CruisePricing;
  cheapestPricing: CheapestPricing;
  alternativeSailings: AlternativeSailing[];
  cabinCategories: CabinCategory[];
  currency: string;
  isActive: boolean;
  lastCached?: string;
}

export interface CruiseLineInfo {
  id: number;
  name: string;
  code?: string;
  logoUrl?: string;
  description?: string;
  website?: string;
}

export interface ShipInfo {
  id: number;
  name: string;
  code?: string;
  shipClass?: string;
  tonnage?: number;
  totalCabins?: number;
  passengerCapacity?: number;
  starRating?: number;
  description?: string;
  highlights?: string;
  defaultImageUrl?: string;
  defaultImage2kUrl?: string;
  images: any[];
  amenities: any[];
  launchedYear?: number;
  refurbishedYear?: number;
  decks?: number;
}

export interface PortInfo {
  id: number;
  name: string;
  code?: string;
  country?: string;
  countryCode?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  description?: string;
}

export interface RegionInfo {
  id: number;
  name: string;
  code?: string;
  description?: string;
}

export interface ItineraryDay {
  id: string;
  day: number;
  date: string;
  portName: string;
  port?: PortInfo;
  arrivalTime?: string;
  departureTime?: string;
  status: string;
  overnight: boolean;
  description?: string;
  activities: any[];
  shoreExcursions: any[];
}

export interface CabinCategory {
  shipId: number;
  code: string;
  codeAlt?: string;
  name: string;
  description?: string;
  category: string;
  categoryAlt?: string;
  colorCode?: string;
  colorCodeAlt?: string;
  imageUrl?: string;
  imageUrlHd?: string;
  isDefault: boolean;
  validFrom?: string;
  validTo?: string;
  maxOccupancy: number;
  minOccupancy: number;
  size?: string;
  bedConfiguration?: string;
  amenities: any[];
  deckLocations: any[];
}

export interface PricingOption {
  id: string;
  rateCode: string;
  cabinCode: string;
  occupancyCode: string;
  cabinType?: string;
  basePrice?: number;
  adultPrice?: number;
  childPrice?: number;
  infantPrice?: number;
  singlePrice?: number;
  thirdAdultPrice?: number;
  fourthAdultPrice?: number;
  taxes?: number;
  ncf?: number;
  gratuity?: number;
  fuel?: number;
  nonComm?: number;
  totalPrice?: number;
  isAvailable: boolean;
  priceType: string;
  priceTimestamp?: string;
  currency: string;
}

export interface CruisePricing {
  options: PricingOption[];
  groupedByRate: Record<string, PricingOption[]>;
  groupedByCabin: Record<string, PricingOption[]>;
}

export interface CheapestPricing {
  overall?: {
    price?: number;
    cabinType?: string;
    taxes?: number;
    ncf?: number;
    gratuity?: number;
    fuel?: number;
    nonComm?: number;
  };
  interior?: {
    price?: number;
    taxes?: number;
    ncf?: number;
    gratuity?: number;
    fuel?: number;
    nonComm?: number;
    priceCode?: string;
  };
  oceanview?: {
    price?: number;
    taxes?: number;
    ncf?: number;
    gratuity?: number;
    fuel?: number;
    nonComm?: number;
    priceCode?: string;
  };
  balcony?: {
    price?: number;
    taxes?: number;
    ncf?: number;
    gratuity?: number;
    fuel?: number;
    nonComm?: number;
    priceCode?: string;
  };
  suite?: {
    price?: number;
    taxes?: number;
    ncf?: number;
    gratuity?: number;
    fuel?: number;
    nonComm?: number;
    priceCode?: string;
  };
  currency: string;
  lastUpdated: string;
}

export interface AlternativeSailing {
  id: string;
  alternativeCruiseId: number;
  sailingDate: string;
  price?: number;
  createdAt: string;
}

export class CruiseService {

  /**
   * Get comprehensive cruise details by ID
   */
  async getCruiseDetails(cruiseId: number): Promise<CruiseDetails | null> {
    const cacheKey = CacheKeys.cruiseDetails(cruiseId.toString());

    try {
      // Try cache first
      const cached = await cacheManager.get<CruiseDetails>(cacheKey);
      if (cached) {
        logger.debug(`Returning cached cruise details for ${cruiseId}`);
        return cached;
      }

      // Create alias for disembark port
      const disembarkPort = aliasedTable(ports, 'disembark_port');

      // Get main cruise data
      const cruiseResult = await db
        .select({
          cruise: cruises,
          cruiseLine: cruiseLines,
          ship: ships,
          embarkPort: ports,
          disembarkPort: disembarkPort,
        })
        .from(cruises)
        .leftJoin(cruiseLines, eq(cruises.cruiseLineId, cruiseLines.id))
        .leftJoin(ships, eq(cruises.shipId, ships.id))
        .leftJoin(ports, eq(cruises.embarkPortId, ports.id))
        .leftJoin(disembarkPort, eq(cruises.disembarkPortId, disembarkPort.id))
        .where(eq(cruises.id, cruiseId))
        .limit(1);

      if (cruiseResult.length === 0) {
        logger.warn(`Cruise ${cruiseId} not found`);
        return null;
      }

      const cruise = cruiseResult[0].cruise;
      const cruiseLine = cruiseResult[0].cruiseLine;
      const ship = cruiseResult[0].ship;
      const embarkPort = cruiseResult[0].embarkPort;
      const disembarkPortData = cruiseResult[0].disembarkPort;

      // Get additional data in parallel
      const [
        regionsData,
        portsData,
        itineraryData,
        pricingData,
        cheapestPricingData,
        alternativeSailingsData,
        cabinCategoriesData
      ] = await Promise.all([
        this.getCruiseRegions(cruise),
        this.getCruisePorts(cruise),
        this.getCruiseItinerary(cruiseId),
        this.getCruisePricing(cruiseId),
        this.getCheapestPricing(cruiseId),
        this.getAlternativeSailings(cruiseId),
        this.getCabinCategories(cruise.shipId)
      ]);

      const cruiseDetails: CruiseDetails = {
        id: cruise.id,
        name: cruise.name,
        itineraryCode: cruise.itineraryCode,
        voyageCode: cruise.voyageCode,
        nights: cruise.nights,
        sailNights: cruise.sailNights,
        seaDays: cruise.seaDays,
        sailingDate: cruise.sailingDate,
        returnDate: cruise.returnDate,
        embarkPort: embarkPort ? this.transformPortInfo(embarkPort) : undefined,
        disembarkPort: disembarkPortData ? this.transformPortInfo(disembarkPortData) : undefined,
        cruiseLine: this.transformCruiseLineInfo(cruiseLine),
        ship: this.transformShipInfo(ship),
        regions: regionsData,
        ports: portsData,
        itinerary: itineraryData,
        pricing: pricingData,
        cheapestPricing: cheapestPricingData,
        alternativeSailings: alternativeSailingsData,
        cabinCategories: cabinCategoriesData,
        currency: cruise.currency || 'USD',
        isActive: cruise.isActive,
        lastCached: cruise.lastCached?.toISOString(),
      };

      // Cache for 6 hours
      await cacheManager.set(cacheKey, cruiseDetails, { ttl: 21600 });

      logger.info(`Retrieved cruise details for ${cruiseId}`);
      return cruiseDetails;

    } catch (error) {
      logger.error(`Failed to get cruise details for ${cruiseId}:`, error);
      throw error;
    }
  }

  /**
   * Get cruise pricing with filters
   */
  async getCruisePricing(cruiseId: number, cabinType?: string, rateCode?: string): Promise<CruisePricing> {
    const cacheKey = CacheKeys.pricing(cruiseId.toString(), cabinType || 'all');

    try {
      const cached = await cacheManager.get<CruisePricing>(cacheKey);
      if (cached) {
        return cached;
      }

      let query = db
        .select()
        .from(pricing)
        .where(eq(pricing.cruiseId, cruiseId));

      if (cabinType) {
        query = query.where(eq(pricing.cabinType, cabinType));
      }

      if (rateCode) {
        query = query.where(eq(pricing.rateCode, rateCode));
      }

      const pricingResults = await query.orderBy(asc(pricing.basePrice));

      const options: PricingOption[] = pricingResults.map(p => ({
        id: p.id,
        rateCode: p.rateCode,
        cabinCode: p.cabinCode,
        occupancyCode: p.occupancyCode,
        cabinType: p.cabinType,
        basePrice: p.basePrice ? parseFloat(p.basePrice) : undefined,
        adultPrice: p.adultPrice ? parseFloat(p.adultPrice) : undefined,
        childPrice: p.childPrice ? parseFloat(p.childPrice) : undefined,
        infantPrice: p.infantPrice ? parseFloat(p.infantPrice) : undefined,
        singlePrice: p.singlePrice ? parseFloat(p.singlePrice) : undefined,
        thirdAdultPrice: p.thirdAdultPrice ? parseFloat(p.thirdAdultPrice) : undefined,
        fourthAdultPrice: p.fourthAdultPrice ? parseFloat(p.fourthAdultPrice) : undefined,
        taxes: p.taxes ? parseFloat(p.taxes) : undefined,
        ncf: p.ncf ? parseFloat(p.ncf) : undefined,
        gratuity: p.gratuity ? parseFloat(p.gratuity) : undefined,
        fuel: p.fuel ? parseFloat(p.fuel) : undefined,
        nonComm: p.nonComm ? parseFloat(p.nonComm) : undefined,
        totalPrice: p.totalPrice ? parseFloat(p.totalPrice) : undefined,
        isAvailable: p.isAvailable,
        priceType: p.priceType,
        priceTimestamp: p.priceTimestamp?.toISOString(),
        currency: p.currency,
      }));

      // Group by rate code
      const groupedByRate: Record<string, PricingOption[]> = {};
      options.forEach(option => {
        if (!groupedByRate[option.rateCode]) {
          groupedByRate[option.rateCode] = [];
        }
        groupedByRate[option.rateCode].push(option);
      });

      // Group by cabin code
      const groupedByCabin: Record<string, PricingOption[]> = {};
      options.forEach(option => {
        if (!groupedByCabin[option.cabinCode]) {
          groupedByCabin[option.cabinCode] = [];
        }
        groupedByCabin[option.cabinCode].push(option);
      });

      const result: CruisePricing = {
        options,
        groupedByRate,
        groupedByCabin,
      };

      // Cache for 15 minutes
      await cacheManager.set(cacheKey, result, { ttl: 900 });

      return result;

    } catch (error) {
      logger.error(`Failed to get pricing for cruise ${cruiseId}:`, error);
      throw error;
    }
  }

  /**
   * Get cheapest pricing for cruise
   */
  async getCheapestPricing(cruiseId: number): Promise<CheapestPricing> {
    try {
      const result = await db
        .select()
        .from(cheapestPricing)
        .where(eq(cheapestPricing.cruiseId, cruiseId))
        .limit(1);

      if (result.length === 0) {
        return {
          currency: 'USD',
          lastUpdated: new Date().toISOString(),
        };
      }

      const data = result[0];

      return {
        overall: data.cheapestPrice ? {
          price: parseFloat(data.cheapestPrice),
          cabinType: data.cheapestCabinType,
          taxes: data.cheapestTaxes ? parseFloat(data.cheapestTaxes) : undefined,
          ncf: data.cheapestNcf ? parseFloat(data.cheapestNcf) : undefined,
          gratuity: data.cheapestGratuity ? parseFloat(data.cheapestGratuity) : undefined,
          fuel: data.cheapestFuel ? parseFloat(data.cheapestFuel) : undefined,
          nonComm: data.cheapestNonComm ? parseFloat(data.cheapestNonComm) : undefined,
        } : undefined,
        interior: data.interiorPrice ? {
          price: parseFloat(data.interiorPrice),
          taxes: data.interiorTaxes ? parseFloat(data.interiorTaxes) : undefined,
          ncf: data.interiorNcf ? parseFloat(data.interiorNcf) : undefined,
          gratuity: data.interiorGratuity ? parseFloat(data.interiorGratuity) : undefined,
          fuel: data.interiorFuel ? parseFloat(data.interiorFuel) : undefined,
          nonComm: data.interiorNonComm ? parseFloat(data.interiorNonComm) : undefined,
          priceCode: data.interiorPriceCode,
        } : undefined,
        oceanview: data.oceanviewPrice ? {
          price: parseFloat(data.oceanviewPrice),
          taxes: data.oceanviewTaxes ? parseFloat(data.oceanviewTaxes) : undefined,
          ncf: data.oceanviewNcf ? parseFloat(data.oceanviewNcf) : undefined,
          gratuity: data.oceanviewGratuity ? parseFloat(data.oceanviewGratuity) : undefined,
          fuel: data.oceanviewFuel ? parseFloat(data.oceanviewFuel) : undefined,
          nonComm: data.oceanviewNonComm ? parseFloat(data.oceanviewNonComm) : undefined,
          priceCode: data.oceanviewPriceCode,
        } : undefined,
        balcony: data.balconyPrice ? {
          price: parseFloat(data.balconyPrice),
          taxes: data.balconyTaxes ? parseFloat(data.balconyTaxes) : undefined,
          ncf: data.balconyNcf ? parseFloat(data.balconyNcf) : undefined,
          gratuity: data.balconyGratuity ? parseFloat(data.balconyGratuity) : undefined,
          fuel: data.balconyFuel ? parseFloat(data.balconyFuel) : undefined,
          nonComm: data.balconyNonComm ? parseFloat(data.balconyNonComm) : undefined,
          priceCode: data.balconyPriceCode,
        } : undefined,
        suite: data.suitePrice ? {
          price: parseFloat(data.suitePrice),
          taxes: data.suiteTaxes ? parseFloat(data.suiteTaxes) : undefined,
          ncf: data.suiteNcf ? parseFloat(data.suiteNcf) : undefined,
          gratuity: data.suiteGratuity ? parseFloat(data.suiteGratuity) : undefined,
          fuel: data.suiteFuel ? parseFloat(data.suiteFuel) : undefined,
          nonComm: data.suiteNonComm ? parseFloat(data.suiteNonComm) : undefined,
          priceCode: data.suitePriceCode,
        } : undefined,
        currency: data.currency,
        lastUpdated: data.lastUpdated.toISOString(),
      };

    } catch (error) {
      logger.error(`Failed to get cheapest pricing for cruise ${cruiseId}:`, error);
      throw error;
    }
  }

  /**
   * Get cruise itinerary
   */
  async getCruiseItinerary(cruiseId: number): Promise<ItineraryDay[]> {
    try {
      const results = await db
        .select({
          itinerary: itineraries,
          port: ports,
        })
        .from(itineraries)
        .leftJoin(ports, eq(itineraries.portId, ports.id))
        .where(eq(itineraries.cruiseId, cruiseId))
        .orderBy(asc(itineraries.dayNumber));

      return results.map(row => ({
        id: row.itinerary.id,
        day: row.itinerary.dayNumber,
        date: row.itinerary.date,
        portName: row.itinerary.portName,
        port: row.port ? this.transformPortInfo(row.port) : undefined,
        arrivalTime: row.itinerary.arrivalTime,
        departureTime: row.itinerary.departureTime,
        status: row.itinerary.status,
        overnight: row.itinerary.overnight,
        description: row.itinerary.description,
        activities: Array.isArray(row.itinerary.activities) ? 
          row.itinerary.activities : 
          JSON.parse(row.itinerary.activities || '[]'),
        shoreExcursions: Array.isArray(row.itinerary.shoreExcursions) ? 
          row.itinerary.shoreExcursions : 
          JSON.parse(row.itinerary.shoreExcursions || '[]'),
      }));

    } catch (error) {
      logger.error(`Failed to get itinerary for cruise ${cruiseId}:`, error);
      throw error;
    }
  }

  /**
   * Get alternative sailings
   */
  async getAlternativeSailings(cruiseId: number): Promise<AlternativeSailing[]> {
    try {
      const results = await db
        .select()
        .from(alternativeSailings)
        .where(eq(alternativeSailings.baseCruiseId, cruiseId))
        .orderBy(asc(alternativeSailings.sailingDate));

      return results.map(row => ({
        id: row.id,
        alternativeCruiseId: row.alternativeCruiseId,
        sailingDate: row.sailingDate,
        price: row.price ? parseFloat(row.price) : undefined,
        createdAt: row.createdAt.toISOString(),
      }));

    } catch (error) {
      logger.error(`Failed to get alternative sailings for cruise ${cruiseId}:`, error);
      throw error;
    }
  }

  /**
   * Get cabin categories for a ship
   */
  async getCabinCategories(shipId: number): Promise<CabinCategory[]> {
    try {
      const results = await db
        .select()
        .from(cabinCategories)
        .where(and(
          eq(cabinCategories.shipId, shipId),
          eq(cabinCategories.isActive, true)
        ))
        .orderBy(asc(cabinCategories.name));

      return results.map(row => ({
        shipId: row.shipId,
        code: row.cabinCode,
        codeAlt: row.cabinCodeAlt,
        name: row.name,
        description: row.description,
        category: row.category,
        categoryAlt: row.categoryAlt,
        colorCode: row.colorCode,
        colorCodeAlt: row.colorCodeAlt,
        imageUrl: row.imageUrl,
        imageUrlHd: row.imageUrlHd,
        isDefault: row.isDefault,
        validFrom: row.validFrom?.toISOString(),
        validTo: row.validTo?.toISOString(),
        maxOccupancy: row.maxOccupancy,
        minOccupancy: row.minOccupancy,
        size: row.size,
        bedConfiguration: row.bedConfiguration,
        amenities: Array.isArray(row.amenities) ? 
          row.amenities : 
          JSON.parse(row.amenities || '[]'),
        deckLocations: Array.isArray(row.deckLocations) ? 
          row.deckLocations : 
          JSON.parse(row.deckLocations || '[]'),
      }));

    } catch (error) {
      logger.error(`Failed to get cabin categories for ship ${shipId}:`, error);
      throw error;
    }
  }

  /**
   * Get regions for a cruise
   */
  private async getCruiseRegions(cruise: any): Promise<RegionInfo[]> {
    try {
      const regionIds = Array.isArray(cruise.regionIds) ? 
        cruise.regionIds : 
        Array.isArray(cruise.regionIds) ? cruise.regionIds : (cruise.regionIds ? JSON.parse(cruise.regionIds) : []);

      if (regionIds.length === 0) return [];

      const results = await db
        .select()
        .from(regions)
        .where(inArray(regions.id, regionIds));

      return results.map(row => ({
        id: row.id,
        name: row.name,
        code: row.code,
        description: row.description,
      }));

    } catch (error) {
      logger.warn('Failed to get cruise regions:', error);
      return [];
    }
  }

  /**
   * Get ports for a cruise
   */
  private async getCruisePorts(cruise: any): Promise<PortInfo[]> {
    try {
      const portIds = Array.isArray(cruise.portIds) ? 
        cruise.portIds : 
        Array.isArray(cruise.portIds) ? cruise.portIds : (cruise.portIds ? JSON.parse(cruise.portIds) : []);

      if (portIds.length === 0) return [];

      const results = await db
        .select()
        .from(ports)
        .where(inArray(ports.id, portIds));

      return results.map(row => this.transformPortInfo(row));

    } catch (error) {
      logger.warn('Failed to get cruise ports:', error);
      return [];
    }
  }

  /**
   * Transform port data
   */
  private transformPortInfo(port: any): PortInfo {
    return {
      id: port.id,
      name: port.name,
      code: port.code,
      country: port.country,
      countryCode: port.countryCode,
      city: port.city,
      latitude: port.latitude ? parseFloat(port.latitude) : undefined,
      longitude: port.longitude ? parseFloat(port.longitude) : undefined,
      timezone: port.timezone,
      description: port.description,
    };
  }

  /**
   * Transform cruise line data
   */
  private transformCruiseLineInfo(cruiseLine: any): CruiseLineInfo {
    return {
      id: cruiseLine?.id || 0,
      name: cruiseLine?.name || 'Unknown',
      code: cruiseLine?.code,
      logoUrl: cruiseLine?.logoUrl,
      description: cruiseLine?.description,
      website: cruiseLine?.website,
    };
  }

  /**
   * Transform ship data
   */
  private transformShipInfo(ship: any): ShipInfo {
    return {
      id: ship?.id || 0,
      name: ship?.name || 'Unknown',
      code: ship?.code,
      shipClass: ship?.shipClass,
      tonnage: ship?.tonnage,
      totalCabins: ship?.totalCabins,
      passengerCapacity: ship?.occupancy,
      starRating: ship?.starRating,
      description: ship?.shortDescription,
      highlights: ship?.highlights,
      defaultImageUrl: ship?.defaultShipImage,
      defaultImage2kUrl: ship?.defaultShipImage2k,
      images: ship?.images ? JSON.parse(ship.images) : [],
      amenities: ship?.amenities ? JSON.parse(ship.amenities) : [],
      launchedYear: ship?.launchedYear,
      refurbishedYear: ship?.refurbishedYear,
      decks: ship?.decks,
    };
  }

  /**
   * Check cruise availability
   */
  async checkCruiseAvailability(cruiseId: number): Promise<{
    available: boolean;
    cabinAvailability: Record<string, { available: boolean; inventory?: number; waitlist: boolean }>;
  }> {
    try {
      const pricingResults = await db
        .select({
          cabinCode: pricing.cabinCode,
          isAvailable: pricing.isAvailable,
          inventory: pricing.inventory,
          waitlist: pricing.waitlist,
        })
        .from(pricing)
        .where(eq(pricing.cruiseId, cruiseId));

      const cabinAvailability: Record<string, { available: boolean; inventory?: number; waitlist: boolean }> = {};
      let hasAvailability = false;

      pricingResults.forEach(row => {
        cabinAvailability[row.cabinCode] = {
          available: row.isAvailable,
          inventory: row.inventory,
          waitlist: row.waitlist,
        };

        if (row.isAvailable) {
          hasAvailability = true;
        }
      });

      return {
        available: hasAvailability,
        cabinAvailability,
      };

    } catch (error) {
      logger.error(`Failed to check availability for cruise ${cruiseId}:`, error);
      throw error;
    }
  }
}

// Singleton instance
export const cruiseService = new CruiseService();