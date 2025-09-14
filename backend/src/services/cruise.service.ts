import { eq, and, inArray, desc, asc, aliasedTable } from 'drizzle-orm';
import { db } from '../db/connection';
import { logger } from '../config/logger';
import { cacheManager } from '../cache/cache-manager';
import { CacheKeys } from '../cache/cache-keys';
import {
  extractFromRawData,
  extractShipFromRawData,
  extractItineraryFromRawData,
  extractCheapestPricingFromRawData,
  extractCabinCategoriesFromRawData,
  extractCruiseLineFromRawData,
  extractPortsFromRawData,
} from './cruise-rawdata-extractor';
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
  alternativeSailings,
} from '../db/schema';
import { parseCruiseSlug, generateCruiseSlug, createSlugFromCruiseData } from '../utils/slug.utils';

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

// Comprehensive interface that includes ALL database fields
export interface ComprehensiveCruiseData {
  // Basic cruise info
  cruise: {
    id: number;
    cruiseId: number;
    name?: string;
    voyageCode?: string;
    itineraryCode?: string;
    sailingDate: string;
    startDate?: string;
    nights?: number;
    sailNights?: number;
    seaDays?: number;
    embarkPortId?: number;
    disembarkPortId?: number;
    // Pricing fields
    interiorPrice?: any;
    oceanviewPrice?: any;
    balconyPrice?: any;
    suitePrice?: any;
    cheapestPrice?: any;
    portIds?: string;
    regionIds?: string;
    marketId?: number;
    ownerId?: string;
    noFly?: boolean;
    departUk?: boolean;
    showCruise?: boolean;
    flyCruiseInfo?: string;
    lastCached?: number;
    cachedDate?: string;
    traveltekFilePath?: string;
    isActive?: boolean;
    createdAt: string;
    updatedAt: string;
    // Raw database fields
    raw: any;
  };

  // Cruise line details
  cruiseLine: {
    id: number;
    name: string;
    code?: string;
    logoUrl?: string;
    description?: string;
    website?: string;
    // Raw database fields
    raw: any;
  } | null;

  // Ship details with ALL fields
  ship: {
    id: number;
    name: string;
    code?: string;
    cruiseLineId?: number;
    shipClass?: string;
    tonnage?: number;
    totalCabins?: number;
    maxPassengers?: number;
    starRating?: number;
    description?: string;
    highlights?: string;
    defaultShipImage?: string;
    defaultShipImage2k?: string;
    images?: any;
    amenities?: any;
    launchedYear?: number;
    refurbishedYear?: number;
    decks?: number;
    content?: any;
    isActive?: boolean;
    createdAt: string;
    updatedAt: string;
    // Raw database fields
    raw: any;
  } | null;

  // Port information
  embarkPort?: {
    id: number;
    name: string;
    code?: string;
    country?: string;
    countryCode?: string;
    city?: string;
    latitude?: string;
    longitude?: string;
    timezone?: string;
    description?: string;
    // Raw database fields
    raw: any;
  } | null;

  disembarkPort?: {
    id: number;
    name: string;
    code?: string;
    country?: string;
    countryCode?: string;
    city?: string;
    latitude?: string;
    longitude?: string;
    timezone?: string;
    description?: string;
    // Raw database fields
    raw: any;
  } | null;

  // Related data
  regions: Array<{
    id: number;
    name: string;
    code?: string;
    description?: string;
    raw: any;
  }>;

  ports: Array<{
    id: number;
    name: string;
    code?: string;
    country?: string;
    countryCode?: string;
    city?: string;
    latitude?: string;
    longitude?: string;
    timezone?: string;
    description?: string;
    raw: any;
  }>;

  // Comprehensive pricing data
  pricing: {
    options: Array<{
      id: string;
      cruiseId: number;
      rateCode: string;
      cabinCode: string;
      occupancyCode: string;
      cabinType?: string;
      basePrice?: string;
      adultPrice?: string;
      childPrice?: string;
      infantPrice?: string;
      singlePrice?: string;
      thirdAdultPrice?: string;
      fourthAdultPrice?: string;
      taxes?: string;
      ncf?: string;
      gratuity?: string;
      fuel?: string;
      nonComm?: string;
      totalPrice?: string;
      inventory?: number;
      waitlist?: boolean;
      isAvailable: boolean;
      priceType: string;
      priceTimestamp?: string;
      currency: string;
      // Raw database fields
      raw: any;
    }>;
    summary: {
      totalOptions: number;
      availableOptions: number;
      priceRange: { min?: number; max?: number };
      cabinTypes: string[];
      rateCodes: string[];
    };
  };

  // Cheapest pricing
  cheapestPricing: {
    cruiseId: number;
    cheapestPrice?: string;
    cheapestCabinType?: string;
    interiorPrice?: string;
    oceanviewPrice?: string;
    balconyPrice?: string;
    suitePrice?: string;
    currency: string;
    lastUpdated: string;
    // All raw pricing fields
    raw: any;
  } | null;

  // Itinerary with all details
  itinerary: Array<{
    id: string;
    cruiseId: number;
    dayNumber: number;
    date: string;
    portName: string;
    portId?: number;
    arrivalTime?: string;
    departureTime?: string;
    status: string;
    overnight: boolean;
    description?: string;
    activities?: any;
    shoreExcursions?: any;
    // Raw database fields
    raw: any;
  }>;

  // Cabin categories
  cabinCategories: Array<{
    shipId: number;
    cabinCode: string;
    cabinCodeAlt?: string;
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
    amenities?: any;
    deckLocations?: any;
    isActive: boolean;
    // Raw database fields
    raw: any;
  }>;

  // Alternative sailings
  alternativeSailings: Array<{
    id: string;
    baseCruiseId: number;
    alternativeCruiseId: number;
    sailingDate: string;
    price?: string;
    createdAt: string;
    // Raw database fields
    raw: any;
  }>;

  // SEO and URL data
  seoData: {
    slug: string;
    alternativeUrls: string[];
    metaTitle: string;
    metaDescription: string;
    breadcrumbs: Array<{
      label: string;
      url?: string;
    }>;
  };

  // Metadata about the request
  meta: {
    dataFetchedAt: string;
    totalRelatedRecords: {
      pricing: number;
      itinerary: number;
      cabinCategories: number;
      alternativeSailings: number;
      regions: number;
      ports: number;
    };
    cacheStatus: {
      used: boolean;
      ttl?: number;
    };
  };
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
  async getCruiseDetails(cruiseId: number | string): Promise<CruiseDetails | null> {
    const cacheKey = CacheKeys.cruiseDetails(String(cruiseId));

    try {
      // Try cache first
      const cached = await cacheManager.get<CruiseDetails>(cacheKey);
      if (cached) {
        logger.debug(`Returning cached cruise details for ${cruiseId}`);
        return cached;
      }

      // Create alias for disembark port
      const disembarkPort = aliasedTable(ports, 'disembark_port');

      // Get main cruise data - updated for new schema
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
        .where(eq(cruises.id, String(cruiseId)))
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
        cabinCategoriesData,
      ] = await Promise.all([
        this.getCruiseRegions(cruise),
        this.getCruisePorts(cruise),
        this.getCruiseItinerary(cruiseId),
        this.getCruisePricing(cruiseId),
        this.getCheapestPricing(cruiseId),
        this.getAlternativeSailings(cruiseId),
        this.getCabinCategories(cruise.shipId),
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
        lastCached: cruise.lastCached
          ? new Date(Number(cruise.lastCached) * 1000).toISOString()
          : undefined,
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
  async getCruisePricing(
    cruiseId: number | string,
    cabinType?: string,
    rateCode?: string
  ): Promise<CruisePricing> {
    const cacheKey = CacheKeys.pricing(String(cruiseId), cabinType || 'all');

    try {
      const cached = await cacheManager.get<CruisePricing>(cacheKey);
      if (cached) {
        return cached;
      }

      let query = db
        .select()
        .from(pricing)
        .where(eq(pricing.cruiseId, String(cruiseId)));

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
  async getCheapestPricing(cruiseId: number | string): Promise<CheapestPricing> {
    try {
      const result = await db
        .select()
        .from(cheapestPricing)
        .where(eq(cheapestPricing.cruiseId, String(cruiseId)))
        .limit(1);

      if (result.length === 0) {
        return {
          currency: 'USD',
          lastUpdated: new Date().toISOString(),
        };
      }

      const data = result[0];

      return {
        overall: data.cheapestPrice
          ? {
              price: parseFloat(data.cheapestPrice),
              cabinType: data.cheapestCabinType,
              taxes: data.cheapestTaxes ? parseFloat(data.cheapestTaxes) : undefined,
              ncf: data.cheapestNcf ? parseFloat(data.cheapestNcf) : undefined,
              gratuity: data.cheapestGratuity ? parseFloat(data.cheapestGratuity) : undefined,
              fuel: data.cheapestFuel ? parseFloat(data.cheapestFuel) : undefined,
              nonComm: data.cheapestNonComm ? parseFloat(data.cheapestNonComm) : undefined,
            }
          : undefined,
        interior: data.interiorPrice
          ? {
              price: parseFloat(data.interiorPrice),
              taxes: data.interiorTaxes ? parseFloat(data.interiorTaxes) : undefined,
              ncf: data.interiorNcf ? parseFloat(data.interiorNcf) : undefined,
              gratuity: data.interiorGratuity ? parseFloat(data.interiorGratuity) : undefined,
              fuel: data.interiorFuel ? parseFloat(data.interiorFuel) : undefined,
              nonComm: data.interiorNonComm ? parseFloat(data.interiorNonComm) : undefined,
              priceCode: data.interiorPriceCode,
            }
          : undefined,
        oceanview: data.oceanviewPrice
          ? {
              price: parseFloat(data.oceanviewPrice),
              taxes: data.oceanviewTaxes ? parseFloat(data.oceanviewTaxes) : undefined,
              ncf: data.oceanviewNcf ? parseFloat(data.oceanviewNcf) : undefined,
              gratuity: data.oceanviewGratuity ? parseFloat(data.oceanviewGratuity) : undefined,
              fuel: data.oceanviewFuel ? parseFloat(data.oceanviewFuel) : undefined,
              nonComm: data.oceanviewNonComm ? parseFloat(data.oceanviewNonComm) : undefined,
              priceCode: data.oceanviewPriceCode,
            }
          : undefined,
        balcony: data.balconyPrice
          ? {
              price: parseFloat(data.balconyPrice),
              taxes: data.balconyTaxes ? parseFloat(data.balconyTaxes) : undefined,
              ncf: data.balconyNcf ? parseFloat(data.balconyNcf) : undefined,
              gratuity: data.balconyGratuity ? parseFloat(data.balconyGratuity) : undefined,
              fuel: data.balconyFuel ? parseFloat(data.balconyFuel) : undefined,
              nonComm: data.balconyNonComm ? parseFloat(data.balconyNonComm) : undefined,
              priceCode: data.balconyPriceCode,
            }
          : undefined,
        suite: data.suitePrice
          ? {
              price: parseFloat(data.suitePrice),
              taxes: data.suiteTaxes ? parseFloat(data.suiteTaxes) : undefined,
              ncf: data.suiteNcf ? parseFloat(data.suiteNcf) : undefined,
              gratuity: data.suiteGratuity ? parseFloat(data.suiteGratuity) : undefined,
              fuel: data.suiteFuel ? parseFloat(data.suiteFuel) : undefined,
              nonComm: data.suiteNonComm ? parseFloat(data.suiteNonComm) : undefined,
              priceCode: data.suitePriceCode,
            }
          : undefined,
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
  async getCruiseItinerary(cruiseId: number | string): Promise<ItineraryDay[]> {
    try {
      const results = await db
        .select({
          itinerary: itineraries,
          port: ports,
        })
        .from(itineraries)
        .leftJoin(ports, eq(itineraries.portId, ports.id))
        .where(eq(itineraries.cruiseId, String(cruiseId)))
        .orderBy(asc(itineraries.dayNumber));

      return results.map(row => ({
        id: row.itinerary.id.toString(),
        day: row.itinerary.dayNumber,
        date: new Date().toISOString(), // We don't have date field in DB, using placeholder
        portName: row.itinerary.portName || row.port?.name || 'Unknown Port',
        port: row.port ? this.transformPortInfo(row.port) : undefined,
        arrivalTime: row.itinerary.arrivalTime,
        departureTime: row.itinerary.departureTime,
        status: row.itinerary.isSeaDay ? 'sea-day' : 'port',
        overnight: false, // Not available in current schema
        description: row.itinerary.description,
        activities: [], // Not available in current schema
        shoreExcursions: [], // Not available in current schema
      }));
    } catch (error) {
      logger.error(`Failed to get itinerary for cruise ${cruiseId}:`, error);
      // Log the actual error details for debugging
      logger.error(`Error details:`, error instanceof Error ? error.stack : error);
      return []; // Return empty array instead of throwing
    }
  }

  /**
   * Get alternative sailings
   */
  async getAlternativeSailings(cruiseId: number | string): Promise<AlternativeSailing[]> {
    try {
      // Temporarily return empty array to avoid schema issues
      // Commented out to reduce log spam - this feature is disabled until schema is fixed
      // logger.warn(
      //   `Alternative sailings disabled temporarily for cruise ${cruiseId} - schema mismatch`
      // );
      return [];

      /* Original code disabled temporarily due to schema issues
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
      */
    } catch (error) {
      logger.error(`Failed to get alternative sailings for cruise ${cruiseId}:`, error);
      return []; // Return empty array instead of throwing
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
        .where(and(eq(cabinCategories.shipId, shipId), eq(cabinCategories.isActive, true)))
        .orderBy(asc(cabinCategories.name));

      return results.map(row => ({
        shipId: row.shipId,
        code: row.cabinCode,
        codeAlt: row.cabinCodeAlt,
        name: row.name,
        description: row.description,
        category: row.category,
        categoryAlt: undefined, // Not in current schema
        colorCode: row.colorCode,
        colorCodeAlt: undefined, // Not in current schema
        imageUrl: row.imageUrl,
        imageUrlHd: row.imageUrlHd,
        isDefault: row.isDefault,
        validFrom: row.validFrom?.toISOString(),
        validTo: row.validTo?.toISOString(),
        maxOccupancy: 4, // Default value, not in current schema
        minOccupancy: 1, // Default value, not in current schema
        size: undefined, // Not in current schema
        bedConfiguration: undefined, // Not in current schema
        amenities: [], // Not in current schema
        deckLocations: [], // Not in current schema
      }));
    } catch (error) {
      logger.error(`Failed to get cabin categories for ship ${shipId}:`, error);
      return []; // Return empty array instead of throwing
    }
  }

  /**
   * Get regions for a cruise
   */
  private async getCruiseRegions(cruise: any): Promise<RegionInfo[]> {
    try {
      const regionIds = Array.isArray(cruise.regionIds)
        ? cruise.regionIds
        : typeof cruise.regionIds === 'string'
          ? cruise.regionIds
              .split(',')
              .map((id: string) => id.trim())
              .filter(id => id)
              .map(Number)
          : [];

      if (regionIds.length === 0) return [];

      const results = await db.select().from(regions).where(inArray(regions.id, regionIds));

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
      const portIds = Array.isArray(cruise.portIds)
        ? cruise.portIds
        : typeof cruise.portIds === 'string'
          ? cruise.portIds
              .split(',')
              .map((id: string) => id.trim())
              .filter(id => id)
              .map(Number)
          : [];

      if (portIds.length === 0) return [];

      const results = await db.select().from(ports).where(inArray(ports.id, portIds));

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
      passengerCapacity: ship?.maxPassengers,
      starRating: ship?.starRating,
      description: ship?.description,
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
    cabinAvailability: Record<
      string,
      { available: boolean; inventory?: number; waitlist: boolean }
    >;
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
        .where(eq(pricing.cruiseId, String(cruiseId)));

      const cabinAvailability: Record<
        string,
        { available: boolean; inventory?: number; waitlist: boolean }
      > = {};
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

  /**
   * Get comprehensive cruise data by slug
   */
  async getCruiseBySlug(slug: string): Promise<ComprehensiveCruiseData | null> {
    try {
      // Parse the slug to extract cruise ID and validation data
      const slugData = parseCruiseSlug(slug);
      if (!slugData) {
        logger.warn(`Invalid slug format: ${slug}`);
        return null;
      }

      const { cruiseId, departureDate, shipName } = slugData;

      // Get comprehensive cruise data
      return this.getComprehensiveCruiseData(cruiseId, {
        validateSlug: true,
        expectedSlugData: { shipName, departureDate },
      });
    } catch (error) {
      logger.error(`Failed to get cruise by slug ${slug}:`, error);
      throw error;
    }
  }

  /**
   * Get comprehensive cruise data with ALL database fields
   */
  async getComprehensiveCruiseData(
    cruiseId: number | string,
    options: {
      validateSlug?: boolean;
      expectedSlugData?: { shipName: string; departureDate: string };
    } = {}
  ): Promise<ComprehensiveCruiseData | null> {
    const startTime = Date.now();
    const cacheKey = `comprehensive_cruise_${cruiseId}`;

    try {
      // Try cache first (shorter TTL for comprehensive data)
      const cached = await cacheManager.get<ComprehensiveCruiseData>(cacheKey);
      if (cached) {
        logger.debug(`Returning cached comprehensive cruise data for ${cruiseId}`);
        cached.meta.cacheStatus.used = true;
        return cached;
      }

      // Create alias for disembark port
      const disembarkPort = aliasedTable(ports, 'disembark_port');

      // Get main cruise data with ALL fields
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
        .where(eq(cruises.id, String(cruiseId)))
        .limit(1);

      if (cruiseResult.length === 0) {
        logger.warn(`Cruise ${cruiseId} not found`);
        return null;
      }

      const cruiseData = cruiseResult[0];
      let cruise = cruiseData.cruise;
      let cruiseLine = cruiseData.cruiseLine;
      let ship = cruiseData.ship;
      const embarkPort = cruiseData.embarkPort;
      const disembarkPortData = cruiseData.disembarkPort;

      // Extract data from raw_data if fields are missing
      if (cruise.rawData) {
        cruise = extractFromRawData(cruise);
        ship = extractShipFromRawData(ship, cruise.rawData);

        // Extract cruise line if missing
        if (!cruiseLine) {
          cruiseLine = extractCruiseLineFromRawData(cruise.rawData);
        }
      }

      // Validate slug if requested
      if (options.validateSlug && options.expectedSlugData) {
        const actualShipName =
          ship?.name
            ?.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-') || '';
        const expectedShipName = options.expectedSlugData.shipName.toLowerCase();
        const actualSailingDate = cruise.sailingDate;
        const expectedSailingDate = options.expectedSlugData.departureDate;

        if (
          !actualShipName.includes(expectedShipName.replace(/-/g, '')) &&
          actualSailingDate !== expectedSailingDate
        ) {
          logger.warn(
            `Slug validation failed for cruise ${cruiseId}: expected ship ${expectedShipName} and date ${expectedSailingDate}, got ${actualShipName} and ${actualSailingDate}`
          );
          return null;
        }
      }

      // Get ALL related data in parallel
      let [
        allPricing,
        cheapestPricingData,
        allItinerary,
        allCabinCategories,
        allAlternativeSailings,
        regionsData,
        portsData,
      ] = await Promise.all([
        this.getAllPricingData(cruiseId),
        this.getRawCheapestPricing(cruiseId),
        this.getAllItineraryData(cruiseId),
        this.getAllCabinCategories(cruise.shipId),
        this.getAllAlternativeSailings(cruiseId),
        this.getAllCruiseRegions(cruise),
        this.getAllCruisePorts(cruise),
      ]);

      // If data is missing, extract from raw_data
      if (cruise.rawData) {
        if (!cheapestPricingData) {
          cheapestPricingData = extractCheapestPricingFromRawData(cruise.rawData);
        }
        if (!allItinerary || allItinerary.length === 0) {
          allItinerary = extractItineraryFromRawData(cruise.rawData);
        }
        if (!allCabinCategories || allCabinCategories.length === 0) {
          allCabinCategories = extractCabinCategoriesFromRawData(cruise.rawData);
        }
        if (!portsData || portsData.length === 0) {
          portsData = extractPortsFromRawData(cruise.rawData);
        }
      }

      // Generate SEO data
      const seoData = this.generateSeoData(cruise, ship, cruiseLine);

      // Build comprehensive data structure
      const comprehensiveData: ComprehensiveCruiseData = {
        cruise: {
          id: cruise.id,
          cruiseId: cruise.cruiseId,
          name: cruise.name,
          voyageCode: cruise.voyageCode,
          itineraryCode: cruise.itineraryCode,
          sailingDate: cruise.sailingDate,
          startDate: cruise.startDate,
          nights: cruise.nights,
          sailNights: cruise.sailNights,
          seaDays: cruise.seaDays,
          // Include pricing fields from database
          interiorPrice: cruise.interiorPrice,
          oceanviewPrice: cruise.oceanviewPrice,
          balconyPrice: cruise.balconyPrice,
          suitePrice: cruise.suitePrice,
          cheapestPrice: cruise.cheapestPrice,
          embarkPortId: cruise.embarkPortId,
          disembarkPortId: cruise.disembarkPortId,
          portIds: cruise.portIds,
          regionIds: cruise.regionIds,
          marketId: cruise.marketId,
          ownerId: cruise.ownerId,
          noFly: cruise.noFly,
          departUk: cruise.departUk,
          showCruise: cruise.showCruise,
          flyCruiseInfo: cruise.flyCruiseInfo,
          lastCached: cruise.lastCached,
          cachedDate: cruise.cachedDate
            ? typeof cruise.cachedDate === 'string'
              ? cruise.cachedDate
              : cruise.cachedDate.toISOString()
            : null,
          traveltekFilePath: cruise.traveltekFilePath,
          isActive: cruise.isActive,
          createdAt: cruise.createdAt
            ? typeof cruise.createdAt === 'string'
              ? cruise.createdAt
              : cruise.createdAt.toISOString()
            : null,
          updatedAt: cruise.updatedAt
            ? typeof cruise.updatedAt === 'string'
              ? cruise.updatedAt
              : cruise.updatedAt.toISOString()
            : null,
          raw: cruise,
        },
        cruiseLine: cruiseLine
          ? {
              id: cruiseLine.id,
              name: cruiseLine.name,
              code: cruiseLine.code,
              logoUrl: cruiseLine.logoUrl,
              description: cruiseLine.description,
              website: cruiseLine.website,
              raw: cruiseLine,
            }
          : null,
        ship: ship
          ? {
              id: ship.id,
              name: ship.name,
              code: ship.code,
              cruiseLineId: ship.cruiseLineId,
              shipClass: ship.shipClass,
              tonnage: ship.tonnage,
              totalCabins: ship.totalCabins,
              maxPassengers: ship.maxPassengers,
              starRating: ship.starRating,
              description: ship.description,
              highlights: ship.highlights,
              defaultShipImage: ship.defaultShipImage,
              defaultShipImage2k: ship.defaultShipImage2k,
              images: ship.images,
              amenities: ship.amenities,
              launchedYear: ship.launchedYear,
              refurbishedYear: ship.refurbishedYear,
              decks: ship.decks,
              content: ship.content,
              isActive: ship.isActive,
              createdAt: ship.createdAt.toISOString(),
              updatedAt: ship.updatedAt.toISOString(),
              raw: ship,
            }
          : null,
        embarkPort: embarkPort
          ? {
              id: embarkPort.id,
              name: embarkPort.name,
              code: embarkPort.code,
              country: embarkPort.country,
              countryCode: embarkPort.countryCode,
              city: embarkPort.city,
              latitude: embarkPort.latitude,
              longitude: embarkPort.longitude,
              timezone: embarkPort.timezone,
              description: embarkPort.description,
              raw: embarkPort,
            }
          : null,
        disembarkPort: disembarkPortData
          ? {
              id: disembarkPortData.id,
              name: disembarkPortData.name,
              code: disembarkPortData.code,
              country: disembarkPortData.country,
              countryCode: disembarkPortData.countryCode,
              city: disembarkPortData.city,
              latitude: disembarkPortData.latitude,
              longitude: disembarkPortData.longitude,
              timezone: disembarkPortData.timezone,
              description: disembarkPortData.description,
              raw: disembarkPortData,
            }
          : null,
        regions: regionsData,
        ports: portsData,
        pricing: allPricing,
        cheapestPricing: cheapestPricingData,
        itinerary: allItinerary,
        cabinCategories: allCabinCategories,
        alternativeSailings: allAlternativeSailings,
        seoData,
        meta: {
          dataFetchedAt: new Date().toISOString(),
          totalRelatedRecords: {
            pricing: allPricing.options.length,
            itinerary: allItinerary.length,
            cabinCategories: allCabinCategories.length,
            alternativeSailings: allAlternativeSailings.length,
            regions: regionsData.length,
            ports: portsData.length,
          },
          cacheStatus: {
            used: false,
            ttl: 1800, // 30 minutes
          },
        },
      };

      // Cache for 30 minutes
      await cacheManager.set(cacheKey, comprehensiveData, { ttl: 1800 });

      const endTime = Date.now();
      logger.info(
        `Retrieved comprehensive cruise data for ${cruiseId} in ${endTime - startTime}ms`
      );

      return comprehensiveData;
    } catch (error) {
      logger.error(`Failed to get comprehensive cruise data for ${cruiseId}:`, error);
      throw error;
    }
  }

  /**
   * Get ALL pricing data with raw database fields
   */
  private async getAllPricingData(cruiseId: number | string) {
    const results = await db
      .select()
      .from(pricing)
      .where(eq(pricing.cruiseId, String(cruiseId)))
      .orderBy(asc(pricing.basePrice));

    const options = results.map(row => ({
      id: row.id,
      cruiseId: row.cruiseId,
      rateCode: row.rateCode,
      cabinCode: row.cabinCode,
      occupancyCode: row.occupancyCode,
      cabinType: row.cabinType,
      basePrice: row.basePrice,
      adultPrice: row.adultPrice,
      childPrice: row.childPrice,
      infantPrice: row.infantPrice,
      singlePrice: row.singlePrice,
      thirdAdultPrice: row.thirdAdultPrice,
      fourthAdultPrice: row.fourthAdultPrice,
      taxes: row.taxes,
      ncf: row.ncf,
      gratuity: row.gratuity,
      fuel: row.fuel,
      nonComm: row.nonComm,
      totalPrice: row.totalPrice,
      inventory: row.inventory,
      waitlist: row.waitlist,
      isAvailable: row.isAvailable,
      priceType: row.priceType,
      priceTimestamp: row.priceTimestamp?.toISOString(),
      currency: row.currency,
      raw: row,
    }));

    // Calculate summary statistics
    const availableOptions = options.filter(o => o.isAvailable);
    const prices = options.map(o => parseFloat(o.basePrice || '0')).filter(p => p > 0);
    const cabinTypes = [...new Set(options.map(o => o.cabinType).filter(Boolean))] as string[];
    const rateCodes = [...new Set(options.map(o => o.rateCode))] as string[];

    return {
      options,
      summary: {
        totalOptions: options.length,
        availableOptions: availableOptions.length,
        priceRange: {
          min: prices.length > 0 ? Math.min(...prices) : undefined,
          max: prices.length > 0 ? Math.max(...prices) : undefined,
        },
        cabinTypes,
        rateCodes,
      },
    };
  }

  /**
   * Get raw cheapest pricing data
   */
  private async getRawCheapestPricing(cruiseId: number | string) {
    const results = await db
      .select()
      .from(cheapestPricing)
      .where(eq(cheapestPricing.cruiseId, String(cruiseId)))
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    const data = results[0];
    return {
      cruiseId: data.cruiseId,
      cheapestPrice: data.cheapestPrice,
      cheapestCabinType: data.cheapestCabinType,
      interiorPrice: data.interiorPrice,
      oceanviewPrice: data.oceanviewPrice,
      balconyPrice: data.balconyPrice,
      suitePrice: data.suitePrice,
      currency: data.currency,
      lastUpdated: data.lastUpdated.toISOString(),
      raw: data,
    };
  }

  /**
   * Get ALL itinerary data with raw fields
   */
  private async getAllItineraryData(cruiseId: number | string) {
    try {
      const results = await db
        .select({
          itinerary: itineraries,
          port: ports,
        })
        .from(itineraries)
        .leftJoin(ports, eq(itineraries.portId, ports.id))
        .where(eq(itineraries.cruiseId, String(cruiseId)))
        .orderBy(asc(itineraries.dayNumber));

      return results.map(row => ({
        id: row.itinerary.id.toString(),
        cruiseId: row.itinerary.cruiseId,
        dayNumber: row.itinerary.dayNumber,
        date: new Date().toISOString(), // Placeholder
        portName: row.itinerary.portName || 'Unknown Port',
        portId: row.itinerary.portId,
        arrivalTime: row.itinerary.arrivalTime,
        departureTime: row.itinerary.departureTime,
        status: row.itinerary.isSeaDay ? 'sea-day' : 'port',
        overnight: false,
        description: row.itinerary.description,
        activities: undefined,
        shoreExcursions: undefined,
        raw: row.itinerary,
      }));
    } catch (error) {
      logger.warn(`Failed to get itinerary data for cruise ${cruiseId}:`, error);
      return [];
    }
  }

  /**
   * Get ALL cabin categories with raw fields
   */
  private async getAllCabinCategories(shipId: number) {
    try {
      const results = await db
        .select()
        .from(cabinCategories)
        .where(and(eq(cabinCategories.shipId, shipId), eq(cabinCategories.isActive, true)))
        .orderBy(asc(cabinCategories.name));

      return results.map(row => ({
        shipId: row.shipId,
        cabinCode: row.cabinCode,
        cabinCodeAlt: row.cabinCodeAlt,
        name: row.name,
        description: row.description,
        category: row.category,
        categoryAlt: undefined,
        colorCode: row.colorCode,
        colorCodeAlt: undefined,
        imageUrl: row.imageUrl,
        imageUrlHd: row.imageUrlHd,
        isDefault: row.isDefault,
        validFrom: row.validFrom?.toISOString(),
        validTo: row.validTo?.toISOString(),
        maxOccupancy: 4,
        minOccupancy: 1,
        size: undefined,
        bedConfiguration: undefined,
        amenities: undefined,
        deckLocations: undefined,
        isActive: row.isActive,
        raw: row,
      }));
    } catch (error) {
      logger.warn(`Failed to get cabin categories for ship ${shipId}:`, error);
      return [];
    }
  }

  /**
   * Get ALL alternative sailings with raw fields
   */
  private async getAllAlternativeSailings(cruiseId: number | string) {
    // Temporarily return empty array to avoid schema issues
    // Commented out to reduce log spam - this feature is disabled until schema is fixed
    // logger.warn(
    //   `Alternative sailings disabled temporarily for cruise ${cruiseId} - schema mismatch`
    // );
    return [];

    /* Original code disabled temporarily due to schema issues
    const results = await db
      .select()
      .from(alternativeSailings)
      .where(eq(alternativeSailings.baseCruiseId, cruiseId))
      .orderBy(asc(alternativeSailings.sailingDate));

    return results.map(row => ({
      id: row.id,
      baseCruiseId: row.baseCruiseId,
      alternativeCruiseId: row.alternativeCruiseId,
      sailingDate: row.sailingDate,
      price: row.price,
      createdAt: row.createdAt.toISOString(),
      raw: row
    }));
    */
  }

  /**
   * Get ALL cruise regions with raw fields
   */
  private async getAllCruiseRegions(cruise: any) {
    try {
      let regionIds: number[] = [];

      if (cruise.regionIds) {
        if (typeof cruise.regionIds === 'string') {
          // Handle comma-separated string format
          regionIds = cruise.regionIds
            .split(',')
            .map(id => parseInt(id.trim(), 10))
            .filter(id => !isNaN(id));
        } else if (Array.isArray(cruise.regionIds)) {
          regionIds = cruise.regionIds;
        }
      }

      if (regionIds.length === 0) return [];

      const results = await db.select().from(regions).where(inArray(regions.id, regionIds));

      return results.map(row => ({
        id: row.id,
        name: row.name,
        code: row.code,
        description: row.description,
        raw: row,
      }));
    } catch (error) {
      logger.warn('Failed to get cruise regions:', error);
      return [];
    }
  }

  /**
   * Get ALL cruise ports with raw fields
   */
  private async getAllCruisePorts(cruise: any) {
    try {
      let portIds: number[] = [];

      if (cruise.portIds) {
        if (typeof cruise.portIds === 'string') {
          // Handle comma-separated string format
          portIds = cruise.portIds
            .split(',')
            .map(id => parseInt(id.trim(), 10))
            .filter(id => !isNaN(id));
        } else if (Array.isArray(cruise.portIds)) {
          portIds = cruise.portIds;
        }
      }

      if (portIds.length === 0) return [];

      const results = await db.select().from(ports).where(inArray(ports.id, portIds));

      return results.map(row => ({
        id: row.id,
        name: row.name,
        code: row.code,
        country: row.country,
        countryCode: row.countryCode,
        city: row.city,
        latitude: row.latitude,
        longitude: row.longitude,
        timezone: row.timezone,
        description: row.description,
        raw: row,
      }));
    } catch (error) {
      logger.warn('Failed to get cruise ports:', error);
      return [];
    }
  }

  /**
   * Generate SEO data for cruise
   */
  private generateSeoData(cruise: any, ship: any, cruiseLine: any) {
    const slug = createSlugFromCruiseData({
      id: cruise.id,
      shipName: ship?.name || 'Unknown Ship',
      sailingDate: cruise.sailingDate,
    });

    const shipName = ship?.name || 'Unknown Ship';
    const cruiseLineName = cruiseLine?.name || 'Unknown Cruise Line';
    const sailingDate = new Date(cruise.sailingDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const metaTitle = `${shipName} Cruise - ${sailingDate} | ${cruiseLineName} | Book Now`;
    const metaDescription = `Book your ${cruise.nights}-night cruise aboard the ${shipName} departing ${sailingDate}. Best prices guaranteed. View itinerary, cabins, and book online.`;

    return {
      slug,
      alternativeUrls: [
        `/cruise/${slug}`,
        `/cruises/${cruise.id}`,
        `/ship/${ship?.name?.toLowerCase().replace(/\s+/g, '-')}/cruise/${cruise.id}`,
      ],
      metaTitle,
      metaDescription,
      breadcrumbs: [
        { label: 'Home', url: '/' },
        { label: 'Cruises', url: '/cruises' },
        {
          label: cruiseLineName,
          url: `/cruise-lines/${cruiseLine?.name?.toLowerCase().replace(/\s+/g, '-')}`,
        },
        { label: shipName, url: `/ships/${ship?.name?.toLowerCase().replace(/\s+/g, '-')}` },
        { label: `${sailingDate} Cruise` },
      ],
    };
  }

  /**
   * Find cruise by ship and date for single result redirects
   */
  async findCruiseByShipAndDate(
    shipName: string,
    sailingDate: string
  ): Promise<{ id: number; slug: string } | null> {
    try {
      const results = await db
        .select({
          cruise: cruises,
          ship: ships,
        })
        .from(cruises)
        .leftJoin(ships, eq(cruises.shipId, ships.id))
        .where(and(eq(cruises.sailingDate, sailingDate), eq(cruises.isActive, true)))
        .limit(10); // Get a few results to match ship name

      // Find the best matching ship name
      const normalizedSearchName = shipName
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      for (const result of results) {
        if (result.ship) {
          const normalizedShipName = result.ship.name
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

          if (
            normalizedShipName.includes(normalizedSearchName) ||
            normalizedSearchName.includes(normalizedShipName)
          ) {
            const slug = createSlugFromCruiseData({
              id: result.cruise.id,
              shipName: result.ship.name,
              sailingDate: result.cruise.sailingDate,
            });

            return {
              id: result.cruise.id,
              slug,
            };
          }
        }
      }

      return null;
    } catch (error) {
      logger.error(`Failed to find cruise by ship and date:`, error);
      return null;
    }
  }
}

// Singleton instance
export const cruiseService = new CruiseService();
