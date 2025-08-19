import { and, or, eq, gte, lte, ilike, sql, desc, asc, inArray, isNotNull } from 'drizzle-orm';
import { BaseService } from './base.service';
import { 
  cruises, 
  ships, 
  cruiseLines, 
  ports, 
  regions,
  itineraries,
  cabinCategories,
  cheapestPricing,
  pricing,
  alternativeSailings,
} from '../db/schema';
import { 
  CruiseDetails, 
  CruiseListItem, 
  ItineraryDay,
  CabinCategory,
  ShipDetails,
  PricingSummary,
} from '../types/api.types';
import { CACHE_KEYS } from '../cache/cache-keys';
import logger from '../config/logger';

interface CruiseListParams {
  page: number;
  limit: number;
  sortBy: 'price' | 'date' | 'nights' | 'name';
  sortOrder: 'asc' | 'desc';
  cruiseLine?: string;
  ship?: string;
  departurePort?: string;
}

interface CruisePricingResult {
  interior: PricingOption[];
  oceanview: PricingOption[];
  balcony: PricingOption[];
  suite: PricingOption[];
}

interface PricingOption {
  rateCode: string;
  cabinCode: string;
  cabinType: string;
  occupancyOptions: OccupancyOption[];
}

interface OccupancyOption {
  occupancyCode: string;
  guestCount: number;
  basePrice: number;
  adultPrice?: number;
  childPrice?: number;
  taxes: number;
  fees: number;
  totalPrice: number;
  currency: string;
  isAvailable: boolean;
  inventory?: number;
}

interface CabinPricingResult {
  cabinCode: string;
  cabinType: string;
  category: string;
  name: string;
  description?: string;
  images: string[];
  rateOptions: PricingOption[];
}

export class CruiseService extends BaseService {
  /**
   * List cruises with pagination and basic filters
   */
  async listCruises(params: CruiseListParams) {
    const cacheKey = CACHE_KEYS.CRUISE_LIST(JSON.stringify(params));
    const cacheTTL = 15 * 60; // 15 minutes

    return this.getFromCacheOrDb(cacheKey, async () => {
      this.log('info', 'Listing cruises', { params });

      // Build WHERE conditions
      const conditions = [
        eq(cruises.showCruise, true),
        eq(cruises.isActive, true),
      ];

      if (params.cruiseLine) {
        conditions.push(eq(cruiseLines.id, parseInt(params.cruiseLine)));
      }
      if (params.ship) {
        conditions.push(eq(ships.id, parseInt(params.ship)));
      }
      if (params.departurePort) {
        conditions.push(eq(cruises.embarkPortId, parseInt(params.departurePort)));
      }

      // Build sort order
      const orderBy = this.buildSortOrder(params);

      // Calculate offset for pagination
      const offset = (params.page - 1) * params.limit;

      // Execute the main query
      const listQuery = this.db
        .select({
          // Cruise basic info
          id: cruises.id,
          name: cruises.name,
          sailingDate: cruises.sailingDate,
          returnDate: cruises.returnDate,
          nights: cruises.nights,
          
          // Cruise line info
          cruiseLineId: cruiseLines.id,
          cruiseLineName: cruiseLines.name,
          cruiseLineLogoUrl: cruiseLines.logoUrl,
          
          // Ship info
          shipId: ships.id,
          shipName: ships.name,
          shipImageUrl: ships.defaultImageUrl,
          
          // Port info
          embarkPortId: ports.id,
          embarkPortName: ports.name,
          embarkPortCity: ports.city,
          embarkPortCountry: ports.country,
          
          disembarkPortId: sql<number>`dp.id`,
          disembarkPortName: sql<string>`dp.name`,
          disembarkPortCity: sql<string>`dp.city`,
          disembarkPortCountry: sql<string>`dp.country`,
          
          // Region and port arrays
          regionIds: cruises.regionIds,
          portIds: cruises.portIds,
          
          // Pricing from cheapest_pricing table
          cheapestPrice: cheapestPricing.cheapestPrice,
          cheapestCabinType: cheapestPricing.cheapestCabinType,
          interiorPrice: cheapestPricing.interiorPrice,
          oceanviewPrice: cheapestPricing.oceanviewPrice,
          balconyPrice: cheapestPricing.balconyPrice,
          suitePrice: cheapestPricing.suitePrice,
          currency: cheapestPricing.currency,
        })
        .from(cruises)
        .innerJoin(cruiseLines, eq(cruises.cruiseLineId, cruiseLines.id))
        .innerJoin(ships, eq(cruises.shipId, ships.id))
        .leftJoin(ports, eq(cruises.embarkPortId, ports.id))
        .leftJoin(sql`ports dp`, sql`${cruises.disembarkPortId} = dp.id`)
        .leftJoin(cheapestPricing, eq(cruises.id, cheapestPricing.cruiseId))
        .where(and(...conditions))
        .orderBy(...orderBy)
        .limit(params.limit)
        .offset(offset);

      // Execute list and count queries in parallel
      const [listResults, countResult] = await Promise.all([
        listQuery,
        this.db
          .select({ count: sql<number>`count(*)` })
          .from(cruises)
          .innerJoin(cruiseLines, eq(cruises.cruiseLineId, cruiseLines.id))
          .innerJoin(ships, eq(cruises.shipId, ships.id))
          .leftJoin(ports, eq(cruises.embarkPortId, ports.id))
          .where(and(...conditions)),
      ]);

      const totalCount = countResult[0]?.count || 0;
      const totalPages = Math.ceil(totalCount / params.limit);

      // Transform results to API format
      const cruiseItems: CruiseListItem[] = await this.transformToCruiseList(listResults);

      return {
        cruises: cruiseItems,
        meta: {
          page: params.page,
          limit: params.limit,
          total: totalCount,
          totalPages,
          hasNext: params.page < totalPages,
          hasPrevious: params.page > 1,
        },
      };
    }, cacheTTL);
  }

  /**
   * Get detailed cruise information by ID
   */
  async getCruiseById(cruiseId: number): Promise<CruiseDetails | null> {
    const cacheKey = CACHE_KEYS.CRUISE_DETAILS(cruiseId);
    const cacheTTL = 60 * 60; // 1 hour

    return this.getFromCacheOrDb(cacheKey, async () => {
      this.log('info', 'Getting cruise details', { cruiseId });

      // Get basic cruise information with relations
      const cruiseQuery = await this.db
        .select({
          // Cruise basic info
          id: cruises.id,
          name: cruises.name,
          sailingDate: cruises.sailingDate,
          returnDate: cruises.returnDate,
          nights: cruises.nights,
          lineContent: cruises.lineContent,
          flyCruiseInfo: cruises.flyCruiseInfo,
          regionIds: cruises.regionIds,
          portIds: cruises.portIds,
          
          // Cruise line info
          cruiseLineId: cruiseLines.id,
          cruiseLineName: cruiseLines.name,
          cruiseLineLogoUrl: cruiseLines.logoUrl,
          cruiseLineDescription: cruiseLines.description,
          
          // Ship info
          shipId: ships.id,
          shipName: ships.name,
          shipDescription: ships.description,
          shipImages: ships.images,
          shipDefaultImage: ships.defaultImageUrl,
          shipTonnage: ships.tonnage,
          shipCapacity: ships.capacity,
          shipRating: ships.rating,
          shipHighlights: ships.highlights,
          
          // Port info
          embarkPortId: ports.id,
          embarkPortName: ports.name,
          embarkPortCity: ports.city,
          embarkPortCountry: ports.country,
          
          disembarkPortId: sql<number>`dp.id`,
          disembarkPortName: sql<string>`dp.name`,
          disembarkPortCity: sql<string>`dp.city`,
          disembarkPortCountry: sql<string>`dp.country`,
          
          // Pricing
          cheapestPrice: cheapestPricing.cheapestPrice,
          cheapestCabinType: cheapestPricing.cheapestCabinType,
          interiorPrice: cheapestPricing.interiorPrice,
          oceanviewPrice: cheapestPricing.oceanviewPrice,
          balconyPrice: cheapestPricing.balconyPrice,
          suitePrice: cheapestPricing.suitePrice,
          currency: cheapestPricing.currency,
        })
        .from(cruises)
        .innerJoin(cruiseLines, eq(cruises.cruiseLineId, cruiseLines.id))
        .innerJoin(ships, eq(cruises.shipId, ships.id))
        .leftJoin(ports, eq(cruises.embarkPortId, ports.id))
        .leftJoin(sql`ports dp`, sql`${cruises.disembarkPortId} = dp.id`)
        .leftJoin(cheapestPricing, eq(cruises.id, cheapestPricing.cruiseId))
        .where(and(
          eq(cruises.id, cruiseId),
          eq(cruises.isActive, true)
        ))
        .limit(1);

      if (!cruiseQuery.length) {
        return null;
      }

      const cruise = cruiseQuery[0];

      // Get itinerary, cabin categories, and regions in parallel
      const [itineraryResult, cabinCategories, regionData] = await Promise.all([
        this.getCruiseItinerary(cruiseId),
        this.getCruiseCabinCategories(cruiseId),
        this.getCruiseRegions(cruise.regionIds as number[]),
      ]);

      // Transform to CruiseDetails format
      const cruiseDetails: CruiseDetails = {
        id: cruise.id,
        name: cruise.name,
        cruiseLine: {
          id: cruise.cruiseLineId,
          name: cruise.cruiseLineName,
          logoUrl: cruise.cruiseLineLogoUrl,
        },
        ship: {
          id: cruise.shipId,
          name: cruise.shipName,
          cruiseLineId: cruise.cruiseLineId,
          cruiseLine: {
            id: cruise.cruiseLineId,
            name: cruise.cruiseLineName,
            logoUrl: cruise.cruiseLineLogoUrl,
          },
          description: cruise.shipDescription,
          tonnage: cruise.shipTonnage,
          maxGuests: cruise.shipCapacity,
          images: Array.isArray(cruise.shipImages) ? cruise.shipImages : [],
          amenities: [], // Would be populated from ship amenities
          restaurants: [], // Would be populated from ship facilities
          bars: [], // Would be populated from ship facilities
          entertainment: [], // Would be populated from ship facilities
          isActive: true,
        },
        sailingDate: cruise.sailingDate,
        returnDate: cruise.returnDate,
        nights: cruise.nights,
        embarkPort: {
          id: cruise.embarkPortId,
          name: cruise.embarkPortName,
          city: cruise.embarkPortCity,
          country: cruise.embarkPortCountry,
        },
        disembarkPort: {
          id: cruise.disembarkPortId,
          name: cruise.disembarkPortName,
          city: cruise.disembarkPortCity,
          country: cruise.disembarkPortCountry,
        },
        regions: regionData,
        pricing: {
          cheapest: cruise.cheapestPrice ? {
            basePrice: parseFloat(cruise.cheapestPrice),
            totalPrice: parseFloat(cruise.cheapestPrice),
            taxes: 0,
            fees: 0,
            currency: cruise.currency || 'USD',
            rateName: cruise.cheapestCabinType,
            perPerson: true,
          } : undefined,
          interior: cruise.interiorPrice ? {
            basePrice: parseFloat(cruise.interiorPrice),
            totalPrice: parseFloat(cruise.interiorPrice),
            taxes: 0,
            fees: 0,
            currency: cruise.currency || 'USD',
            perPerson: true,
          } : undefined,
          oceanview: cruise.oceanviewPrice ? {
            basePrice: parseFloat(cruise.oceanviewPrice),
            totalPrice: parseFloat(cruise.oceanviewPrice),
            taxes: 0,
            fees: 0,
            currency: cruise.currency || 'USD',
            perPerson: true,
          } : undefined,
          balcony: cruise.balconyPrice ? {
            basePrice: parseFloat(cruise.balconyPrice),
            totalPrice: parseFloat(cruise.balconyPrice),
            taxes: 0,
            fees: 0,
            currency: cruise.currency || 'USD',
            perPerson: true,
          } : undefined,
          suite: cruise.suitePrice ? {
            basePrice: parseFloat(cruise.suitePrice),
            totalPrice: parseFloat(cruise.suitePrice),
            taxes: 0,
            fees: 0,
            currency: cruise.currency || 'USD',
            perPerson: true,
          } : undefined,
        },
        availability: true,
        highlights: cruise.shipHighlights ? [cruise.shipHighlights] : [],
        itinerary: itineraryResult,
        cabinCategories: cabinCategories,
        inclusions: [], // Would be populated from cruise inclusions
        exclusions: [], // Would be populated from cruise exclusions
        policies: {
          cancellation: 'Standard cancellation policy applies',
          age: 'Passengers must be at least 6 months old',
          smoking: 'Smoking is allowed in designated areas only',
          dress: 'Dress codes vary by venue and time of day',
        },
      };

      return cruiseDetails;
    }, cacheTTL);
  }

  /**
   * Get cruise pricing with all rate codes and occupancy options
   */
  async getCruisePricing(cruiseId: number): Promise<CruisePricingResult | null> {
    const cacheKey = CACHE_KEYS.CRUISE_PRICING(cruiseId);
    const cacheTTL = 15 * 60; // 15 minutes

    return this.getFromCacheOrDb(cacheKey, async () => {
      this.log('info', 'Getting cruise pricing', { cruiseId });

      // Check if cruise exists
      const cruiseExists = await this.db
        .select({ id: cruises.id })
        .from(cruises)
        .where(and(eq(cruises.id, cruiseId), eq(cruises.isActive, true)))
        .limit(1);

      if (!cruiseExists.length) {
        return null;
      }

      // Get all pricing for this cruise
      const pricingData = await this.db
        .select({
          rateCode: pricing.rateCode,
          cabinCode: pricing.cabinCode,
          occupancyCode: pricing.occupancyCode,
          cabinType: pricing.cabinType,
          basePrice: pricing.basePrice,
          adultPrice: pricing.adultPrice,
          childPrice: pricing.childPrice,
          taxes: pricing.taxes,
          ncf: pricing.ncf,
          gratuity: pricing.gratuity,
          fuel: pricing.fuel,
          totalPrice: pricing.totalPrice,
          currency: pricing.currency,
          isAvailable: pricing.isAvailable,
          inventory: pricing.inventory,
          
          // Cabin category info
          cabinName: cabinCategories.name,
          cabinDescription: cabinCategories.description,
          cabinCategory: cabinCategories.category,
        })
        .from(pricing)
        .leftJoin(cabinCategories, and(
          eq(cabinCategories.shipId, sql`(SELECT ship_id FROM cruises WHERE id = ${cruiseId})`),
          eq(cabinCategories.cabinCode, pricing.cabinCode)
        ))
        .where(and(
          eq(pricing.cruiseId, cruiseId),
          eq(pricing.isAvailable, true)
        ))
        .orderBy(pricing.rateCode, pricing.cabinCode, pricing.occupancyCode);

      return this.organizePricingByCategory(pricingData);
    }, cacheTTL);
  }

  /**
   * Get pricing for a specific cabin code
   */
  async getCabinPricing(cruiseId: number, cabinCode: string): Promise<CabinPricingResult | null> {
    const cacheKey = CACHE_KEYS.CABIN_PRICING(cruiseId, cabinCode);
    const cacheTTL = 15 * 60; // 15 minutes

    return this.getFromCacheOrDb(cacheKey, async () => {
      this.log('info', 'Getting cabin pricing', { cruiseId, cabinCode });

      // Get cabin category information
      const cabinInfo = await this.db
        .select({
          cabinCode: cabinCategories.cabinCode,
          name: cabinCategories.name,
          description: cabinCategories.description,
          category: cabinCategories.category,
          colorCode: cabinCategories.colorCode,
          imageUrl: cabinCategories.imageUrl,
          imageUrlHd: cabinCategories.imageUrlHd,
          maxOccupancy: cabinCategories.maxOccupancy,
        })
        .from(cabinCategories)
        .innerJoin(cruises, eq(cruises.shipId, cabinCategories.shipId))
        .where(and(
          eq(cruises.id, cruiseId),
          eq(cabinCategories.cabinCode, cabinCode)
        ))
        .limit(1);

      if (!cabinInfo.length) {
        return null;
      }

      const cabin = cabinInfo[0];

      // Get all pricing for this cabin
      const pricingData = await this.db
        .select({
          rateCode: pricing.rateCode,
          occupancyCode: pricing.occupancyCode,
          cabinType: pricing.cabinType,
          basePrice: pricing.basePrice,
          adultPrice: pricing.adultPrice,
          childPrice: pricing.childPrice,
          taxes: pricing.taxes,
          ncf: pricing.ncf,
          gratuity: pricing.gratuity,
          fuel: pricing.fuel,
          totalPrice: pricing.totalPrice,
          currency: pricing.currency,
          isAvailable: pricing.isAvailable,
          inventory: pricing.inventory,
        })
        .from(pricing)
        .where(and(
          eq(pricing.cruiseId, cruiseId),
          eq(pricing.cabinCode, cabinCode),
          eq(pricing.isAvailable, true)
        ))
        .orderBy(pricing.rateCode, pricing.occupancyCode);

      const rateOptions = this.organizePricingByRate(pricingData);

      return {
        cabinCode: cabin.cabinCode,
        cabinType: cabin.category,
        category: cabin.category,
        name: cabin.name,
        description: cabin.description,
        images: [cabin.imageUrl, cabin.imageUrlHd].filter(Boolean),
        rateOptions,
      };
    }, cacheTTL);
  }

  /**
   * Get cruise itinerary
   */
  async getCruiseItinerary(cruiseId: number): Promise<ItineraryDay[]> {
    const cacheKey = CACHE_KEYS.CRUISE_ITINERARY(cruiseId);
    const cacheTTL = 60 * 60; // 1 hour

    return this.getFromCacheOrDb(cacheKey, async () => {
      this.log('info', 'Getting cruise itinerary', { cruiseId });

      const itineraryData = await this.db
        .select({
          dayNumber: itineraries.dayNumber,
          date: itineraries.date,
          portName: itineraries.portName,
          portId: itineraries.portId,
          arrivalTime: itineraries.arrivalTime,
          departureTime: itineraries.departureTime,
          status: itineraries.status,
          overnight: itineraries.overnight,
          description: itineraries.description,
          
          // Port details
          portCity: ports.city,
          portCountry: ports.country,
          portDescription: ports.description,
          portImages: ports.images,
        })
        .from(itineraries)
        .leftJoin(ports, eq(itineraries.portId, ports.id))
        .where(eq(itineraries.cruiseId, cruiseId))
        .orderBy(itineraries.dayNumber);

      return itineraryData.map(day => ({
        dayNumber: day.dayNumber,
        date: day.date,
        port: day.portId ? {
          id: day.portId,
          name: day.portName,
          city: day.portCity,
          country: day.portCountry,
          imageUrl: Array.isArray(day.portImages) && day.portImages.length > 0 
            ? day.portImages[0] 
            : undefined,
        } : undefined,
        arrivalTime: day.arrivalTime,
        departureTime: day.departureTime,
        isSeaDay: day.status === 'at_sea',
        description: day.description,
        excursions: [], // Would be populated from excursions table
      }));
    }, cacheTTL);
  }

  /**
   * Get ship details for a cruise
   */
  async getShipDetails(cruiseId: number): Promise<ShipDetails | null> {
    const cacheKey = CACHE_KEYS.SHIP_DETAILS(cruiseId);
    const cacheTTL = 60 * 60; // 1 hour

    return this.getFromCacheOrDb(cacheKey, async () => {
      this.log('info', 'Getting ship details', { cruiseId });

      const shipData = await this.db
        .select({
          id: ships.id,
          name: ships.name,
          cruiseLineId: ships.cruiseLineId,
          code: ships.code,
          shipClass: ships.shipClass,
          tonnage: ships.tonnage,
          totalCabins: ships.totalCabins,
          capacity: ships.capacity,
          rating: ships.rating,
          description: ships.description,
          highlights: ships.highlights,
          defaultImageUrl: ships.defaultImageUrl,
          defaultImageUrlHd: ships.defaultImageUrlHd,
          images: ships.images,
          additionalInfo: ships.additionalInfo,
          
          // Cruise line info
          cruiseLineName: cruiseLines.name,
          cruiseLineLogoUrl: cruiseLines.logoUrl,
        })
        .from(ships)
        .innerJoin(cruiseLines, eq(ships.cruiseLineId, cruiseLines.id))
        .innerJoin(cruises, and(
          eq(cruises.shipId, ships.id),
          eq(cruises.id, cruiseId)
        ))
        .limit(1);

      if (!shipData.length) {
        return null;
      }

      const ship = shipData[0];

      return {
        id: ship.id,
        name: ship.name,
        cruiseLineId: ship.cruiseLineId,
        cruiseLine: {
          id: ship.cruiseLineId,
          name: ship.cruiseLineName,
          logoUrl: ship.cruiseLineLogoUrl,
        },
        description: ship.description,
        tonnage: ship.tonnage,
        maxGuests: ship.capacity,
        staterooms: ship.totalCabins,
        images: Array.isArray(ship.images) ? ship.images : [],
        amenities: [], // Would be populated from ship amenities
        restaurants: [], // Would be populated from ship facilities
        bars: [], // Would be populated from ship facilities
        entertainment: [], // Would be populated from ship facilities
        isActive: true,
      };
    }, cacheTTL);
  }

  /**
   * Get alternative sailings
   */
  async getAlternativeSailings(cruiseId: number): Promise<CruiseListItem[]> {
    const cacheKey = CACHE_KEYS.ALTERNATIVE_SAILINGS(cruiseId);
    const cacheTTL = 60 * 60; // 1 hour

    return this.getFromCacheOrDb(cacheKey, async () => {
      this.log('info', 'Getting alternative sailings', { cruiseId });

      const alternatives = await this.db
        .select({
          alternativeCruiseId: alternativeSailings.alternativeCruiseId,
          sailingDate: alternativeSailings.sailingDate,
          price: alternativeSailings.price,
        })
        .from(alternativeSailings)
        .where(eq(alternativeSailings.baseCruiseId, cruiseId))
        .limit(10);

      if (!alternatives.length) {
        return [];
      }

      // Get full cruise details for alternatives
      const alternativeIds = alternatives.map(alt => alt.alternativeCruiseId);
      const alternativeCruises = await this.listCruises({
        page: 1,
        limit: 10,
        sortBy: 'date',
        sortOrder: 'asc',
      });

      return alternativeCruises.cruises.filter(cruise => 
        alternativeIds.includes(cruise.id)
      );
    }, cacheTTL);
  }

  // Private helper methods

  private buildSortOrder(params: CruiseListParams) {
    const sortColumn = (() => {
      switch (params.sortBy) {
        case 'price':
          return cheapestPricing.cheapestPrice;
        case 'date':
          return cruises.sailingDate;
        case 'nights':
          return cruises.nights;
        case 'name':
          return cruises.name;
        default:
          return cruises.sailingDate;
      }
    })();

    return [params.sortOrder === 'desc' ? desc(sortColumn) : asc(sortColumn)];
  }

  private async transformToCruiseList(results: any[]): Promise<CruiseListItem[]> {
    // Get all region IDs from results to batch fetch region names
    const allRegionIds = new Set<number>();
    results.forEach(result => {
      if (result.regionIds && Array.isArray(result.regionIds)) {
        result.regionIds.forEach((id: number) => allRegionIds.add(id));
      }
    });

    const regionNames = await this.db
      .select({
        id: regions.id,
        name: regions.name,
      })
      .from(regions)
      .where(inArray(regions.id, Array.from(allRegionIds)));

    const regionMap = new Map(regionNames.map(r => [r.id, r.name]));

    return results.map(result => ({
      id: result.id,
      name: result.name,
      cruiseLine: {
        id: result.cruiseLineId,
        name: result.cruiseLineName,
        logoUrl: result.cruiseLineLogoUrl,
      },
      ship: {
        id: result.shipId,
        name: result.shipName,
        imageUrl: result.shipImageUrl,
      },
      sailingDate: result.sailingDate,
      returnDate: result.returnDate,
      nights: result.nights,
      embarkPort: {
        id: result.embarkPortId,
        name: result.embarkPortName,
        city: result.embarkPortCity,
        country: result.embarkPortCountry,
      },
      disembarkPort: {
        id: result.disembarkPortId,
        name: result.disembarkPortName,
        city: result.disembarkPortCity,
        country: result.disembarkPortCountry,
      },
      regions: (result.regionIds || []).map((id: number) => ({
        id,
        name: regionMap.get(id) || `Region ${id}`,
      })),
      pricing: {
        cheapest: result.cheapestPrice ? {
          basePrice: parseFloat(result.cheapestPrice),
          totalPrice: parseFloat(result.cheapestPrice),
          taxes: 0,
          fees: 0,
          currency: result.currency || 'USD',
          perPerson: true,
        } : undefined,
        interior: result.interiorPrice ? {
          basePrice: parseFloat(result.interiorPrice),
          totalPrice: parseFloat(result.interiorPrice),
          taxes: 0,
          fees: 0,
          currency: result.currency || 'USD',
          perPerson: true,
        } : undefined,
        oceanview: result.oceanviewPrice ? {
          basePrice: parseFloat(result.oceanviewPrice),
          totalPrice: parseFloat(result.oceanviewPrice),
          taxes: 0,
          fees: 0,
          currency: result.currency || 'USD',
          perPerson: true,
        } : undefined,
        balcony: result.balconyPrice ? {
          basePrice: parseFloat(result.balconyPrice),
          totalPrice: parseFloat(result.balconyPrice),
          taxes: 0,
          fees: 0,
          currency: result.currency || 'USD',
          perPerson: true,
        } : undefined,
        suite: result.suitePrice ? {
          basePrice: parseFloat(result.suitePrice),
          totalPrice: parseFloat(result.suitePrice),
          taxes: 0,
          fees: 0,
          currency: result.currency || 'USD',
          perPerson: true,
        } : undefined,
      },
      availability: true,
      highlights: [],
    }));
  }

  private async getCruiseCabinCategories(cruiseId: number): Promise<CabinCategory[]> {
    const cabinData = await this.db
      .select({
        id: sql<number>`ROW_NUMBER() OVER (ORDER BY ${cabinCategories.cabinCode})`,
        shipId: cabinCategories.shipId,
        cabinCode: cabinCategories.cabinCode,
        name: cabinCategories.name,
        description: cabinCategories.description,
        category: cabinCategories.category,
        imageUrl: cabinCategories.imageUrl,
        imageUrlHd: cabinCategories.imageUrlHd,
        maxOccupancy: cabinCategories.maxOccupancy,
      })
      .from(cabinCategories)
      .innerJoin(cruises, eq(cruises.shipId, cabinCategories.shipId))
      .where(eq(cruises.id, cruiseId));

    return cabinData.map(cabin => ({
      id: cabin.id,
      shipId: cabin.shipId,
      cabinCode: cabin.cabinCode,
      category: cabin.category as 'interior' | 'oceanview' | 'balcony' | 'suite',
      name: cabin.name,
      description: cabin.description,
      size: 0, // Would be populated from cabin details
      maxOccupancy: cabin.maxOccupancy || 2,
      amenities: [], // Would be populated from cabin amenities
      images: [cabin.imageUrl, cabin.imageUrlHd].filter(Boolean),
      isActive: true,
    }));
  }

  private async getCruiseRegions(regionIds: number[]) {
    if (!regionIds || !regionIds.length) {
      return [];
    }

    const regionData = await this.db
      .select({
        id: regions.id,
        name: regions.name,
      })
      .from(regions)
      .where(inArray(regions.id, regionIds));

    return regionData.map(region => ({
      id: region.id,
      name: region.name,
    }));
  }

  private organizePricingByCategory(pricingData: any[]): CruisePricingResult {
    const categories = {
      interior: [] as PricingOption[],
      oceanview: [] as PricingOption[],
      balcony: [] as PricingOption[],
      suite: [] as PricingOption[],
    };

    // Group by rate code and cabin code
    const groupedData = new Map<string, any[]>();
    pricingData.forEach(price => {
      const key = `${price.rateCode}-${price.cabinCode}`;
      if (!groupedData.has(key)) {
        groupedData.set(key, []);
      }
      groupedData.get(key)!.push(price);
    });

    groupedData.forEach((prices, key) => {
      const [rateCode, cabinCode] = key.split('-');
      const firstPrice = prices[0];
      const category = this.determineCabinCategory(firstPrice.cabinCategory);

      const occupancyOptions: OccupancyOption[] = prices.map(price => ({
        occupancyCode: price.occupancyCode,
        guestCount: this.parseOccupancyCode(price.occupancyCode),
        basePrice: parseFloat(price.basePrice || '0'),
        adultPrice: price.adultPrice ? parseFloat(price.adultPrice) : undefined,
        childPrice: price.childPrice ? parseFloat(price.childPrice) : undefined,
        taxes: parseFloat(price.taxes || '0'),
        fees: parseFloat(price.ncf || '0') + parseFloat(price.gratuity || '0') + parseFloat(price.fuel || '0'),
        totalPrice: parseFloat(price.totalPrice || '0'),
        currency: price.currency || 'USD',
        isAvailable: price.isAvailable,
        inventory: price.inventory,
      }));

      const pricingOption: PricingOption = {
        rateCode,
        cabinCode,
        cabinType: firstPrice.cabinName || firstPrice.cabinType,
        occupancyOptions,
      };

      categories[category].push(pricingOption);
    });

    return categories;
  }

  private organizePricingByRate(pricingData: any[]): PricingOption[] {
    const groupedData = new Map<string, any[]>();
    
    pricingData.forEach(price => {
      const key = price.rateCode;
      if (!groupedData.has(key)) {
        groupedData.set(key, []);
      }
      groupedData.get(key)!.push(price);
    });

    return Array.from(groupedData.entries()).map(([rateCode, prices]) => {
      const firstPrice = prices[0];
      
      const occupancyOptions: OccupancyOption[] = prices.map(price => ({
        occupancyCode: price.occupancyCode,
        guestCount: this.parseOccupancyCode(price.occupancyCode),
        basePrice: parseFloat(price.basePrice || '0'),
        adultPrice: price.adultPrice ? parseFloat(price.adultPrice) : undefined,
        childPrice: price.childPrice ? parseFloat(price.childPrice) : undefined,
        taxes: parseFloat(price.taxes || '0'),
        fees: parseFloat(price.ncf || '0') + parseFloat(price.gratuity || '0') + parseFloat(price.fuel || '0'),
        totalPrice: parseFloat(price.totalPrice || '0'),
        currency: price.currency || 'USD',
        isAvailable: price.isAvailable,
        inventory: price.inventory,
      }));

      return {
        rateCode,
        cabinCode: firstPrice.cabinCode,
        cabinType: firstPrice.cabinType,
        occupancyOptions,
      };
    });
  }

  private determineCabinCategory(category: string): 'interior' | 'oceanview' | 'balcony' | 'suite' {
    if (!category) return 'interior';
    
    const cat = category.toLowerCase();
    if (cat.includes('suite') || cat.includes('s1') || cat.includes('s2')) return 'suite';
    if (cat.includes('balcony') || cat.includes('ba') || cat.includes('b1')) return 'balcony';
    if (cat.includes('oceanview') || cat.includes('outside') || cat.includes('ov')) return 'oceanview';
    return 'interior';
  }

  private parseOccupancyCode(occupancyCode: string): number {
    // Occupancy codes like 101, 102, 201, 202 represent guest counts
    // First digit is usually base occupancy, second digit is additional guests
    if (!occupancyCode) return 2;
    
    const code = occupancyCode.toString();
    if (code.length === 3) {
      const base = parseInt(code[0]) || 1;
      const additional = parseInt(code[1]) || 0;
      return base + additional;
    }
    
    return parseInt(occupancyCode) || 2;
  }
}