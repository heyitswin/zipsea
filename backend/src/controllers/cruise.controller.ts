import { Request, Response } from 'express';
import { cruiseService } from '../services/cruise.service';
import { searchService } from '../services/search.service';
import { searchHotfixService } from '../services/search-hotfix.service';
import { logger } from '../config/logger';
import { db } from '../db/connection';
import {
  sql,
  eq,
  and,
  gte,
  lte,
  isNotNull,
  gt,
  notIlike,
  inArray,
  notInArray,
  asc,
} from 'drizzle-orm';
import { cruises, ships, cruiseLines, ports, cheapestPricing } from '../db/schema';
import { parseCruiseSlug, isValidCruiseSlug } from '../utils/slug.utils';

class CruiseController {
  async listCruises(req: Request, res: Response): Promise<void> {
    try {
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const offset = (page - 1) * limit;

      // Extract filter parameters (including cruiseLine added by live booking filter middleware)
      const { shipId, shipName, departureDate, cruiseLine } = req.query;

      // If no filters are provided (except cruiseLine which may be auto-added by middleware), use the original hotfix service
      if (!shipId && !shipName && !departureDate) {
        // Parse cruise line IDs if provided by middleware
        const cruiseLineIds = cruiseLine
          ? (Array.isArray(cruiseLine) ? cruiseLine : [cruiseLine]).map(Number)
          : undefined;

        const results = await searchHotfixService.getSimpleCruiseList(limit, offset, cruiseLineIds);

        // Map the results to ensure consistent field names
        const formattedCruises = results.cruises.map((cruise: any) => ({
          id: cruise.id,
          name: cruise.name,
          sailing_date: cruise.sailingDate, // Map sailingDate to sailing_date
          nights: cruise.nights,
          cruise_line_name: cruise.cruiseLine?.name,
          ship_name: cruise.ship?.name,
          embark_port_name: cruise.embarkPort?.name,
          disembark_port_name: cruise.disembarkPort?.name,
          cheapest_price: cruise.price?.amount,
        }));

        res.json({
          success: true,
          data: {
            cruises: formattedCruises,
            meta: results.meta,
          },
        });
        return;
      }

      // Build filtered query when filters are provided
      const conditions = [];
      const params = [];

      // Add base conditions
      conditions.push(`c.is_active = true`);
      conditions.push(`c.sailing_date >= CURRENT_DATE + INTERVAL '14 days'`);

      if (shipId) {
        conditions.push(`c.ship_id = $${params.length + 1}`);
        params.push(shipId);
      }

      if (shipName) {
        conditions.push(`LOWER(s.name) LIKE LOWER($${params.length + 1})`);
        params.push(`%${shipName}%`);
      }

      if (departureDate) {
        conditions.push(`c.sailing_date = $${params.length + 1}`);
        params.push(departureDate);
      }

      const whereClause = conditions.join(' AND ');

      // Query for filtered results
      const query = `
        SELECT
          c.id,
          c.cruise_id,
          c.name,
          c.voyage_code,
          c.sailing_date,
          c.nights,
          cl.name as cruise_line_name,
          s.name as ship_name,
          p1.name as embark_port_name,
          p2.name as disembark_port_name,
          c.port_ids,
          c.region_ids,
          cp.cheapest_price,
          cp.interior_price,
          cp.oceanview_price,
          cp.balcony_price,
          cp.suite_price
        FROM cruises c
        LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
        LEFT JOIN ships s ON c.ship_id = s.id
        LEFT JOIN ports p1 ON c.embarkation_port_id = p1.id
        LEFT JOIN ports p2 ON c.disembarkation_port_id = p2.id
        LEFT JOIN cheapest_pricing cp ON cp.cruise_id = c.id
        WHERE ${whereClause}
        ORDER BY c.sailing_date ASC
        LIMIT $${params.length + 1}
        OFFSET $${params.length + 2}
      `;

      params.push(limit, offset);
      // TODO: Fix this to use Drizzle ORM
      const results: any[] = []; // await sql.unsafe(query, params);

      // Get total count for filtered results
      const countQuery = `
        SELECT COUNT(*) as count
        FROM cruises c
        LEFT JOIN ships s ON c.ship_id = s.id
        WHERE ${whereClause}
      `;

      const countParams = params.slice(0, -2); // Remove limit and offset
      // TODO: Fix this to use Drizzle ORM
      const countResult: any[] = [{ count: 0 }]; // await sql.unsafe(countQuery, countParams);
      const total = Number(countResult[0]?.count || 0);

      // Format results similar to the working /search/by-ship endpoint
      const formattedResults = results.map((row: any) => ({
        id: row.id,
        cruise_id: row.cruise_id,
        name: row.name,
        voyage_code: row.voyage_code,
        sailing_date: row.sailing_date,
        nights: row.nights,
        cruise_line_name: row.cruise_line_name,
        ship_name: row.ship_name,
        embark_port_name: row.embark_port_name,
        disembark_port_name: row.disembark_port_name,
        port_ids: row.port_ids,
        region_ids: row.region_ids,
        cheapest_price: row.cheapest_price,
        interior_price: row.interior_price,
        oceanview_price: row.oceanview_price,
        balcony_price: row.balcony_price,
        suite_price: row.suite_price,
      }));

      res.json({
        success: true,
        data: {
          cruises: formattedResults,
          meta: {
            total,
            limit,
            offset,
            page: Math.floor(offset / limit) + 1,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      logger.error('List cruises failed:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to list cruises',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  async getCruiseDetails(req: Request, res: Response): Promise<void> {
    try {
      const cruiseId = Number(req.params.id);
      const comprehensive = req.query.comprehensive === 'true';

      if (isNaN(cruiseId)) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid cruise ID',
            details: 'Cruise ID must be a number',
          },
        });
        return;
      }

      // If comprehensive data is requested, use the comprehensive service method
      if (comprehensive) {
        const comprehensiveData = await cruiseService.getComprehensiveCruiseData(cruiseId);

        if (!comprehensiveData) {
          res.status(404).json({
            success: false,
            error: {
              message: 'Cruise not found',
              details: `Cruise with ID ${cruiseId} does not exist`,
            },
          });
          return;
        }

        res.json({
          success: true,
          data: comprehensiveData,
          meta: {
            dataVersion: 'comprehensive',
            note: 'Comprehensive data includes all database fields and related records',
          },
        });
        return;
      }

      // Otherwise, use the standard cruise details method
      const cruiseDetails = await cruiseService.getCruiseDetails(cruiseId);

      if (!cruiseDetails) {
        res.status(404).json({
          success: false,
          error: {
            message: 'Cruise not found',
            details: `Cruise with ID ${cruiseId} does not exist`,
          },
        });
        return;
      }

      res.json({
        success: true,
        data: cruiseDetails,
        meta: {
          dataVersion: 'standard',
          note: 'Add ?comprehensive=true for complete database fields',
        },
      });
    } catch (error) {
      logger.error(`Get cruise details failed for ID ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to get cruise details',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  async getCruisePricing(req: Request, res: Response): Promise<void> {
    try {
      const cruiseId = Number(req.params.id);
      const cabinType = req.query.cabinType as string;
      const rateCode = req.query.rateCode as string;

      if (isNaN(cruiseId)) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid cruise ID',
            details: 'Cruise ID must be a number',
          },
        });
        return;
      }

      const pricing = await cruiseService.getCruisePricing(cruiseId, cabinType, rateCode);

      res.json({
        success: true,
        data: pricing,
      });
    } catch (error) {
      logger.error(`Get cruise pricing failed for ID ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to get cruise pricing',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  async getCruiseAvailability(req: Request, res: Response): Promise<void> {
    try {
      const cruiseId = Number(req.params.id);

      if (isNaN(cruiseId)) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid cruise ID',
            details: 'Cruise ID must be a number',
          },
        });
        return;
      }

      const availability = await cruiseService.checkCruiseAvailability(cruiseId);

      res.json({
        success: true,
        data: availability,
      });
    } catch (error) {
      logger.error(`Get cruise availability failed for ID ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to get cruise availability',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  async getCruiseItinerary(req: Request, res: Response): Promise<void> {
    try {
      const cruiseId = Number(req.params.id);

      if (isNaN(cruiseId)) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid cruise ID',
            details: 'Cruise ID must be a number',
          },
        });
        return;
      }

      const itinerary = await cruiseService.getCruiseItinerary(cruiseId);

      res.json({
        success: true,
        data: { itinerary },
      });
    } catch (error) {
      logger.error(`Get cruise itinerary failed for ID ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to get cruise itinerary',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  async getCabinPricing(req: Request, res: Response): Promise<void> {
    try {
      const cruiseId = Number(req.params.id);
      const cabinCode = req.params.cabinCode as string;

      if (isNaN(cruiseId)) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid cruise ID',
            details: 'Cruise ID must be a number',
          },
        });
        return;
      }

      if (!cabinCode) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Cabin code is required',
            details: 'Please provide a valid cabin code',
          },
        });
        return;
      }

      // Get pricing for specific cabin
      const pricing = await cruiseService.getCruisePricing(cruiseId);
      const cabinPricing = pricing.groupedByCabin[cabinCode] || [];

      res.json({
        success: true,
        data: {
          cruiseId,
          cabinCode,
          pricing: cabinPricing,
        },
      });
    } catch (error) {
      logger.error(
        `Get cabin pricing failed for cruise ${req.params.id}, cabin ${req.params.cabinCode}:`,
        error
      );
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to get cabin pricing',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  async getShipDetails(req: Request, res: Response): Promise<void> {
    try {
      // For now, get ship details through cruise details
      // In the future, you might want a dedicated ship service
      const cruiseId = Number(req.params.id);

      if (isNaN(cruiseId)) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid cruise ID',
            details: 'Cruise ID must be a number',
          },
        });
        return;
      }

      const cruiseDetails = await cruiseService.getCruiseDetails(cruiseId);

      if (!cruiseDetails) {
        res.status(404).json({
          success: false,
          error: {
            message: 'Cruise not found',
            details: `Cruise with ID ${cruiseId} does not exist`,
          },
        });
        return;
      }

      res.json({
        success: true,
        data: {
          ship: cruiseDetails.ship,
          cabinCategories: cruiseDetails.cabinCategories,
        },
      });
    } catch (error) {
      logger.error(`Get ship details failed for cruise ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to get ship details',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  async getAlternativeSailings(req: Request, res: Response): Promise<void> {
    try {
      const cruiseId = Number(req.params.id);

      if (isNaN(cruiseId)) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid cruise ID',
            details: 'Cruise ID must be a number',
          },
        });
        return;
      }

      const alternatives = await cruiseService.getAlternativeSailings(cruiseId);

      res.json({
        success: true,
        data: { alternatives },
      });
    } catch (error) {
      logger.error(`Get alternative sailings failed for ID ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to get alternative sailings',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  async getCruiseBySlug(req: Request, res: Response): Promise<void> {
    try {
      const slug = req.params.slug;

      if (!slug) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Slug is required',
            details: 'Please provide a valid cruise slug',
          },
        });
        return;
      }

      if (!isValidCruiseSlug(slug)) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid slug format',
            details: 'Slug should be in format: ship-name-YYYY-MM-DD-cruiseId',
            example: 'symphony-of-the-seas-2025-10-05-2143102',
          },
        });
        return;
      }

      const cruiseData = await cruiseService.getCruiseBySlug(slug);

      if (!cruiseData) {
        const parsedSlug = parseCruiseSlug(slug);
        res.status(404).json({
          success: false,
          error: {
            message: 'Cruise not found',
            details: parsedSlug
              ? `No cruise found matching ${parsedSlug.shipName} on ${parsedSlug.departureDate} with ID ${parsedSlug.cruiseId}`
              : `No cruise found for slug: ${slug}`,
          },
        });
        return;
      }

      res.json({
        success: true,
        data: cruiseData,
        meta: {
          slug,
          requestedAt: new Date().toISOString(),
          dataVersion: 'comprehensive',
        },
      });
    } catch (error) {
      logger.error(`Get cruise by slug failed for slug ${req.params.slug}:`, error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to get cruise by slug',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  async getComprehensiveCruiseData(req: Request, res: Response): Promise<void> {
    try {
      const cruiseId = Number(req.params.id);

      if (isNaN(cruiseId)) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid cruise ID',
            details: 'Cruise ID must be a number',
          },
        });
        return;
      }

      const cruiseData = await cruiseService.getComprehensiveCruiseData(cruiseId);

      if (!cruiseData) {
        res.status(404).json({
          success: false,
          error: {
            message: 'Cruise not found',
            details: `Cruise with ID ${cruiseId} does not exist`,
          },
        });
        return;
      }

      res.json({
        success: true,
        data: cruiseData,
        meta: {
          cruiseId,
          requestedAt: new Date().toISOString(),
          dataVersion: 'comprehensive',
          totalFields: Object.keys(cruiseData).length,
        },
      });
    } catch (error) {
      logger.error(`Get comprehensive cruise data failed for ID ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to get comprehensive cruise data',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  async dumpCruiseData(req: Request, res: Response): Promise<void> {
    try {
      const cruiseId = Number(req.params.id);

      if (isNaN(cruiseId)) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid cruise ID',
            details: 'Cruise ID must be a number',
          },
        });
        return;
      }

      // Get comprehensive data
      const comprehensiveData = await cruiseService.getComprehensiveCruiseData(cruiseId);

      if (!comprehensiveData) {
        res.status(404).json({
          success: false,
          error: {
            message: 'Cruise not found',
            details: `Cruise with ID ${cruiseId} does not exist`,
          },
        });
        return;
      }

      // Create a human-readable dump with ALL fields
      const dump = {
        // Basic cruise information
        cruiseInfo: {
          id: comprehensiveData.cruise.id,
          name: comprehensiveData.cruise.name,
          cruiseLineId: comprehensiveData.cruise.cruiseId,
          voyageCode: comprehensiveData.cruise.voyageCode,
          itineraryCode: comprehensiveData.cruise.itineraryCode,
          sailingDate: comprehensiveData.cruise.sailingDate,
          startDate: comprehensiveData.cruise.startDate,
          nights: comprehensiveData.cruise.nights,
          sailNights: comprehensiveData.cruise.sailNights,
          seaDays: comprehensiveData.cruise.seaDays,
          embarkPortId: comprehensiveData.cruise.embarkPortId,
          disembarkPortId: comprehensiveData.cruise.disembarkPortId,
          portIds: comprehensiveData.cruise.portIds,
          regionIds: comprehensiveData.cruise.regionIds,
          marketId: comprehensiveData.cruise.marketId,
          ownerId: comprehensiveData.cruise.ownerId,
          noFly: comprehensiveData.cruise.noFly,
          departUk: comprehensiveData.cruise.departUk,
          showCruise: comprehensiveData.cruise.showCruise,
          flyCruiseInfo: comprehensiveData.cruise.flyCruiseInfo,
          lastCached: comprehensiveData.cruise.lastCached,
          cachedDate: comprehensiveData.cruise.cachedDate,
          traveltekFilePath: comprehensiveData.cruise.traveltekFilePath,
          isActive: comprehensiveData.cruise.isActive,
          createdAt: comprehensiveData.cruise.createdAt,
          updatedAt: comprehensiveData.cruise.updatedAt,
        },

        // Cruise line details
        cruiseLine: comprehensiveData.cruiseLine,

        // Ship details with ALL fields
        ship: comprehensiveData.ship,

        // Port information
        embarkPort: comprehensiveData.embarkPort,
        disembarkPort: comprehensiveData.disembarkPort,

        // All regions
        regions: {
          count: comprehensiveData.regions.length,
          data: comprehensiveData.regions,
        },

        // All ports visited
        ports: {
          count: comprehensiveData.ports.length,
          data: comprehensiveData.ports,
        },

        // Complete pricing breakdown
        pricing: {
          totalOptions: comprehensiveData.pricing.options.length,
          availableOptions: comprehensiveData.pricing.summary.availableOptions,
          priceRange: comprehensiveData.pricing.summary.priceRange,
          cabinTypes: comprehensiveData.pricing.summary.cabinTypes,
          rateCodes: comprehensiveData.pricing.summary.rateCodes,
          allPricingOptions: comprehensiveData.pricing.options,
        },

        // Cheapest pricing summary
        cheapestPricing: comprehensiveData.cheapestPricing,

        // Complete itinerary
        itinerary: {
          totalDays: comprehensiveData.itinerary.length,
          data: comprehensiveData.itinerary,
        },

        // All cabin categories
        cabinCategories: {
          totalCategories: comprehensiveData.cabinCategories.length,
          data: comprehensiveData.cabinCategories,
        },

        // Alternative sailings
        alternativeSailings: {
          totalAlternatives: comprehensiveData.alternativeSailings.length,
          data: comprehensiveData.alternativeSailings,
        },

        // SEO data
        seoData: comprehensiveData.seoData,

        // Raw database fields (for debugging)
        rawData: {
          cruise: comprehensiveData.cruise.raw,
          cruiseLine: comprehensiveData.cruiseLine?.raw,
          ship: comprehensiveData.ship?.raw,
          embarkPort: comprehensiveData.embarkPort?.raw,
          disembarkPort: comprehensiveData.disembarkPort?.raw,
          samplePricing: comprehensiveData.pricing.options[0]?.raw,
          sampleItinerary: comprehensiveData.itinerary[0]?.raw,
          sampleCabinCategory: comprehensiveData.cabinCategories[0]?.raw,
        },

        // Metadata
        meta: {
          ...comprehensiveData.meta,
          dumpGeneratedAt: new Date().toISOString(),
          dataVersion: 'comprehensive-dump',
          warning: 'This endpoint shows ALL database fields for debugging purposes',
        },
      };

      res.json({
        success: true,
        data: dump,
        meta: {
          cruiseId,
          endpoint: 'dump',
          warning: 'This is a comprehensive data dump including all database fields',
        },
      });
    } catch (error) {
      logger.error(`Dump cruise data failed for ID ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to dump cruise data',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  async findCruiseForRedirect(req: Request, res: Response): Promise<void> {
    try {
      const { shipName, sailingDate } = req.query;

      if (!shipName || !sailingDate) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Ship name and sailing date are required',
            details: 'Please provide both shipName and sailingDate query parameters',
          },
        });
        return;
      }

      const cruise = await cruiseService.findCruiseByShipAndDate(
        shipName as string,
        sailingDate as string
      );

      if (!cruise) {
        res.status(404).json({
          success: false,
          error: {
            message: 'No matching cruise found',
            details: `No cruise found for ship "${shipName}" on ${sailingDate}`,
          },
        });
        return;
      }

      res.json({
        success: true,
        data: {
          id: cruise.id,
          slug: cruise.slug,
          redirectUrl: `/cruise/${cruise.slug}`,
        },
        meta: {
          searchedFor: { shipName, sailingDate },
          foundCruise: cruise.id,
        },
      });
    } catch (error) {
      logger.error(`Find cruise for redirect failed:`, error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to find cruise for redirect',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  async getLastMinuteDeals(req: Request, res: Response): Promise<void> {
    try {
      // Calculate date 3 weeks from today
      const threeWeeksFromToday = new Date();
      threeWeeksFromToday.setDate(threeWeeksFromToday.getDate() + 21);
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

      // Define cruise lines in the exact order required
      const preferredCruiseLines = [
        'Royal Caribbean',
        'Carnival Cruise Line',
        'Princess Cruises',
        'MSC Cruises',
        'Norwegian Cruise Line',
        'Celebrity Cruises',
      ];

      const deals = [];
      const usedCruiseLines = new Set<string>();

      // Try to get one cruise from each preferred cruise line in order
      for (const cruiseLineName of preferredCruiseLines) {
        const cruiseForLine = await db
          .select({
            id: cruises.id,
            cruise_id: cruises.cruiseId,
            name: cruises.name,
            ship_name: ships.name,
            cruise_line_name: cruiseLines.name,
            nights: cruises.nights,
            sailing_date: cruises.sailingDate,
            embark_port_name: ports.name,
            cheapest_pricing: cheapestPricing.cheapestPrice,
            ship_image: ships.defaultShipImage,
          })
          .from(cruises)
          .leftJoin(ships, eq(cruises.shipId, ships.id))
          .leftJoin(cruiseLines, eq(cruises.cruiseLineId, cruiseLines.id))
          .leftJoin(ports, eq(cruises.embarkPortId, ports.id))
          .leftJoin(cheapestPricing, eq(cruises.id, cheapestPricing.cruiseId))
          .where(
            and(
              eq(cruises.isActive, true),
              gte(cruises.sailingDate, threeWeeksFromToday.toISOString().split('T')[0]),
              lte(cruises.sailingDate, oneYearFromNow.toISOString().split('T')[0]),
              isNotNull(cheapestPricing.cheapestPrice),
              sql`${cheapestPricing.cheapestPrice} > 0`,
              sql`${cheapestPricing.cheapestPrice} <= 5000`,
              isNotNull(cruises.name),
              gt(cruises.nights, 0),
              sql`(${cruiseLines.name} = ${cruiseLineName} OR ${cruiseLines.name} ILIKE ${cruiseLineName + '%'})`,
              notIlike(cruiseLines.name, '%a-rosa%'),
              notIlike(cruiseLines.name, '%arosa%')
            )
          )
          .orderBy(asc(cruises.sailingDate))
          .limit(1);

        if (cruiseForLine.length > 0) {
          const deal = cruiseForLine[0];
          deals.push({
            ...deal,
            onboard_credit: Math.floor((deal.cheapest_pricing || 0) * 0.2), // 20% onboard credit
          });
          usedCruiseLines.add(cruiseLineName);
        }
      }

      // If we don't have 6 deals yet, fill with other cruises
      if (deals.length < 6) {
        const excludedLines = Array.from(usedCruiseLines);

        const whereConditions = [
          eq(cruises.isActive, true),
          gte(cruises.sailingDate, threeWeeksFromToday.toISOString().split('T')[0]),
          lte(cruises.sailingDate, oneYearFromNow.toISOString().split('T')[0]),
          isNotNull(cheapestPricing.cheapestPrice),
          sql`${cheapestPricing.cheapestPrice} > 0`,
          sql`${cheapestPricing.cheapestPrice} <= 5000`,
          isNotNull(cruises.name),
          gt(cruises.nights, 0),
          notIlike(cruiseLines.name, '%a-rosa%'),
          notIlike(cruiseLines.name, '%arosa%'),
        ];

        // Add exclusion for already used cruise lines
        if (excludedLines.length > 0) {
          whereConditions.push(
            sql`${cruiseLines.name} NOT IN (${sql.join(
              excludedLines.map(name => sql`${name}`),
              sql`, `
            )})`
          );
        }

        const remainingDeals = await db
          .select({
            id: cruises.id,
            cruise_id: cruises.cruiseId,
            name: cruises.name,
            ship_name: ships.name,
            cruise_line_name: cruiseLines.name,
            nights: cruises.nights,
            sailing_date: cruises.sailingDate,
            embark_port_name: ports.name,
            cheapest_pricing: cheapestPricing.cheapestPrice,
            ship_image: ships.defaultShipImage,
          })
          .from(cruises)
          .leftJoin(ships, eq(cruises.shipId, ships.id))
          .leftJoin(cruiseLines, eq(cruises.cruiseLineId, cruiseLines.id))
          .leftJoin(ports, eq(cruises.embarkPortId, ports.id))
          .leftJoin(cheapestPricing, eq(cruises.id, cheapestPricing.cruiseId))
          .where(and(...whereConditions))
          .orderBy(asc(cruises.sailingDate))
          .limit(6 - deals.length);

        for (const deal of remainingDeals) {
          deals.push({
            ...deal,
            onboard_credit: Math.floor((deal.cheapest_pricing || 0) * 0.2), // 20% onboard credit
          });
        }
      }

      res.json({
        success: true,
        data: {
          deals,
          total: deals.length,
        },
      });
    } catch (error) {
      logger.error(`Get last minute deals failed:`, error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to get last minute deals',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
}

/* OLD CODE TO BE REMOVED AFTER CRUISE DATA IS AVAILABLE
      // Define cruise lines in the exact order required
      const preferredCruiseLines = [
        'Royal Caribbean',
        'Carnival Cruise Line',
        'Princess Cruises',
        'MSC Cruises',
        'Norwegian Cruise Line',
        'Celebrity Cruises'
      ];

      const deals = [];
      const usedCruiseLines = new Set();

      // Try to get one cruise from each preferred cruise line in order
      for (const cruiseLineName of preferredCruiseLines) {
        const cruiseForLine = await sql`
          SELECT
            c.id,
            c.cruise_id,
            c.name,
            s.name as ship_name,
            cl.name as cruise_line_name,
            c.nights,
            c.sailing_date,
            ep.name as embark_port_name,
            cp.cheapest_price as cheapest_pricing,
            s.default_ship_image as ship_image,
            ROW_NUMBER() OVER (ORDER BY c.sailing_date ASC) as rn
          FROM cruises c
          LEFT JOIN ships s ON c.ship_id = s.id
          LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
          LEFT JOIN ports ep ON c.embarkation_port_id = ep.id
          LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
          WHERE
            c.is_active = true
            AND c.sailing_date >= ${formattedDate}
            AND c.sailing_date <= CURRENT_DATE + INTERVAL '1 year'
            AND cp.cheapest_price IS NOT NULL
            AND cp.cheapest_price > 0
            AND cp.cheapest_price <= 5000
            AND c.name IS NOT NULL
            AND c.nights > 0
            AND (cl.name = ${cruiseLineName} OR cl.name ILIKE ${cruiseLineName + '%'})
          ORDER BY c.sailing_date ASC
          LIMIT 1
        `;

        if (cruiseForLine.length > 0) {
          const cruise = cruiseForLine[0];
          deals.push({
            id: cruise.id,
            cruise_id: cruise.cruise_id,
            name: cruise.name,
            ship_name: cruise.ship_name,
            cruise_line_name: cruise.cruise_line_name,
            nights: cruise.nights,
            sailing_date: cruise.sailing_date,
            embark_port_name: cruise.embark_port_name,
            cheapest_pricing: parseFloat(cruise.cheapest_pricing),
            ship_image: cruise.ship_image,
            // Calculate OBC as 10% of cheapest pricing, rounded down to nearest $10
            onboard_credit: Math.floor((parseFloat(cruise.cheapest_pricing) * 0.2) / 10) * 10
          });
          usedCruiseLines.add(cruiseLineName);
        }
      }

      // If we have less than 6 cruises, fill remaining slots with soonest available cruises
      // This is a fallback for cases where preferred cruise lines don't have enough cruises
      if (deals.length < 6) {
        const remainingSlots = 6 - deals.length;

        // Get additional cruises to fill remaining slots
        const additionalCruises = await sql`
          SELECT
            c.id,
            c.cruise_id,
            c.name,
            s.name as ship_name,
            cl.name as cruise_line_name,
            c.nights,
            c.sailing_date,
            ep.name as embark_port_name,
            cp.cheapest_price as cheapest_pricing,
            s.default_ship_image as ship_image
          FROM cruises c
          LEFT JOIN ships s ON c.ship_id = s.id
          LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
          LEFT JOIN ports ep ON c.embarkation_port_id = ep.id
          LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
          WHERE
            c.is_active = true
            AND c.sailing_date >= ${formattedDate}
            AND c.sailing_date <= CURRENT_DATE + INTERVAL '1 year'
            AND cp.cheapest_price IS NOT NULL
            AND cp.cheapest_price > 0
            AND cp.cheapest_price <= 5000
            AND c.name IS NOT NULL
            AND c.nights > 0
          ORDER BY c.sailing_date ASC
          LIMIT ${remainingSlots + 10}
        `;

        // Add additional cruises to fill remaining slots, but avoid duplicates
        let addedCount = 0;
        const existingIds = new Set(deals.map(deal => deal.id));

        for (const cruise of additionalCruises) {
          if (addedCount >= remainingSlots) break;
          if (existingIds.has(cruise.id)) continue;

          deals.push({
            id: cruise.id,
            cruise_id: cruise.cruise_id,
            name: cruise.name,
            ship_name: cruise.ship_name,
            cruise_line_name: cruise.cruise_line_name,
            nights: cruise.nights,
            sailing_date: cruise.sailing_date,
            embark_port_name: cruise.embark_port_name,
            cheapest_pricing: parseFloat(cruise.cheapest_pricing),
            ship_image: cruise.ship_image,
            // Calculate OBC as 10% of cheapest pricing, rounded down to nearest $10
            onboard_credit: Math.floor((parseFloat(cruise.cheapest_pricing) * 0.2) / 10) * 10
          });
          addedCount++;
        }
      }

      // Sort deals by the preferred cruise line order, then by sailing date
      const sortedDeals = deals.sort((a, b) => {
        const aIndex = preferredCruiseLines.indexOf(a.cruise_line_name);
        const bIndex = preferredCruiseLines.indexOf(b.cruise_line_name);

        // If both cruise lines are in preferred list, sort by their index
        if (aIndex !== -1 && bIndex !== -1) {
          return aIndex - bIndex;
        }

        // Preferred cruise lines come first
        if (aIndex !== -1 && bIndex === -1) return -1;
        if (aIndex === -1 && bIndex !== -1) return 1;

        // For non-preferred cruise lines, sort by sailing date
        return new Date(a.sailing_date).getTime() - new Date(b.sailing_date).getTime();
      });

      res.json({
        success: true,
        data: {
          deals: sortedDeals,
          total: sortedDeals.length,
        },
        meta: {
          threeWeeksFromToday: formattedDate,
          requestedAt: new Date().toISOString(),
          preferredCruiseLines,
          foundCruiseLines: sortedDeals.map(deal => deal.cruise_line_name),
        },
      });
    } catch (error) {
      logger.error(`Get last minute deals failed:`, error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to get last minute deals',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
}
*/ // END OF OLD CODE

export const cruiseController = new CruiseController();
