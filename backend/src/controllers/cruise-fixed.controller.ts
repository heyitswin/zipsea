import { Request, Response } from 'express';
import { cruiseService } from '../services/cruise.service';
import { searchService } from '../services/search.service';
import { searchHotfixService } from '../services/search-hotfix.service';
import { logger } from '../config/logger';
import postgres from 'postgres';
import { env } from '../config/environment';
import { parseCruiseSlug, isValidCruiseSlug } from '../utils/slug.utils';

const sql = postgres(env.DATABASE_URL, {
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: { rejectUnauthorized: false },
});

class CruiseControllerFixed {
  async listCruises(req: Request, res: Response): Promise<void> {
    try {
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const offset = (page - 1) * limit;

      // Extract filter parameters
      const { shipId, shipName, departureDate } = req.query;

      // If no filters are provided, use the original hotfix service
      if (!shipId && !shipName && !departureDate) {
        const results = await searchHotfixService.getSimpleCruiseList(limit, offset);
        res.json({
          success: true,
          data: {
            cruises: results.cruises,
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

      // Query for filtered results with proper field mappings for new schema
      const query = `
        SELECT
          c.id,
          c.cruise_id,
          c.name,
          c.voyage_code,
          c.sailing_date,
          c.return_date,
          c.nights,
          cl.name as cruise_line_name,
          s.name as ship_name,
          ep.name as embark_port_name,
          dp.name as disembark_port_name,
          c.port_ids,
          c.region_ids,
          c.cheapest_price,
          c.interior_price,
          c.oceanview_price,
          c.balcony_price,
          c.suite_price,
          s.default_ship_image
        FROM cruises c
        LEFT JOIN ships s ON c.ship_id = s.id
        LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
        LEFT JOIN ports ep ON c.embarkation_port_id = ep.id
        LEFT JOIN ports dp ON c.disembarkation_port_id = dp.id
        WHERE ${whereClause}
        ORDER BY c.sailing_date ASC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      params.push(limit, offset);

      const result = await sql.unsafe(query, params);

      // Map results to expected format
      const mappedCruises = result.map((cruise: any) => ({
        id: cruise.id,
        cruise_id: cruise.cruise_id,
        name: cruise.name,
        voyage_code: cruise.voyage_code,
        sailing_date: cruise.sailing_date,
        return_date:
          cruise.return_date ||
          (cruise.sailing_date && cruise.nights
            ? new Date(
                new Date(cruise.sailing_date).getTime() + cruise.nights * 24 * 60 * 60 * 1000
              )
                .toISOString()
                .split('T')[0]
            : null),
        nights: cruise.nights,
        cruise_line_name: cruise.cruise_line_name,
        ship_name: cruise.ship_name,
        embark_port_name: cruise.embark_port_name,
        disembark_port_name: cruise.disembark_port_name,
        port_ids: cruise.port_ids,
        region_ids: cruise.region_ids,
        cheapest_price: cruise.cheapest_price,
        interior_price: cruise.interior_price,
        oceanview_price: cruise.oceanview_price,
        balcony_price: cruise.balcony_price,
        suite_price: cruise.suite_price,
        ship_image: cruise.default_ship_image,
      }));

      res.json({
        success: true,
        data: {
          cruises: mappedCruises,
          meta: {
            page,
            limit,
            total: mappedCruises.length,
            hasMore: mappedCruises.length === limit,
          },
        },
      });
    } catch (error) {
      logger.error(`List cruises failed:`, error);
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
      const cruiseId = req.params.id;
      const comprehensive = req.query.comprehensive === 'true';

      // Handle both integer and string IDs for backward compatibility
      if (!cruiseId) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid cruise ID',
            details: 'Cruise ID is required',
          },
        });
        return;
      }

      // If comprehensive is requested, use the comprehensive service
      if (comprehensive) {
        const comprehensiveData = await cruiseService.getComprehensiveCruiseData(
          parseInt(cruiseId, 10)
        );

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
            note: 'Complete database fields included',
          },
        });
        return;
      }

      // Otherwise, use the standard cruise details method with schema-aware query
      const cruiseDetails = await this.getCruiseDetailsWithSchema(cruiseId);

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

  private async getCruiseDetailsWithSchema(cruiseId: string) {
    try {
      const result = await sql`
        SELECT
          c.id,
          c.cruise_id,
          c.name,
          c.voyage_code,
          c.itinerary_code,
          c.sailing_date,
          c.return_date,
          c.nights,
          c.sail_nights,
          c.sea_days,
          c.embarkation_port_id,
          c.disembarkation_port_id,
          c.port_ids,
          c.region_ids,
          c.ports,
          c.regions,
          c.market_id,
          c.owner_id,
          c.no_fly,
          c.depart_uk,
          c.show_cruise,
          c.fly_cruise_info,
          c.line_content,
          c.ship_content,
          c.last_cached,
          c.cached_date,
          c.interior_price,
          c.oceanview_price,
          c.balcony_price,
          c.suite_price,
          c.cheapest_price,
          c.interior_price_code,
          c.oceanview_price_code,
          c.balcony_price_code,
          c.suite_price_code,
          c.currency,
          c.is_active,
          c.created_at,
          c.updated_at,
          -- Cruise line info
          cl.id as cruise_line_id,
          cl.name as cruise_line_name,
          cl.code as cruise_line_code,
          cl.description as cruise_line_description,
          cl.engine_name as cruise_line_engine_name,
          cl.short_name as cruise_line_short_name,
          cl.title as cruise_line_title,
          cl.nice_url as cruise_line_nice_url,
          cl.logo as cruise_line_logo,
          -- Ship info
          s.id as ship_id,
          s.name as ship_name,
          s.nice_name as ship_nice_name,
          s.short_name as ship_short_name,
          s.code as ship_code,
          s.tonnage,
          s.total_cabins,
          s.max_passengers,
          s.crew,
          s.length as ship_length,
          s.beam,
          s.draft,
          s.speed,
          s.registry,
          s.built_year,
          s.refurbished_year,
          s.description as ship_description,
          s.star_rating,
          s.adults_only,
          s.ship_class,
          s.default_ship_image,
          s.default_ship_image_hd,
          s.default_ship_image_2k,
          s.nice_url as ship_nice_url,
          -- Port info
          ep.name as embark_port_name,
          ep.code as embark_port_code,
          ep.country as embark_port_country,
          dp.name as disembark_port_name,
          dp.code as disembark_port_code,
          dp.country as disembark_port_country
        FROM cruises c
        LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
        LEFT JOIN ships s ON c.ship_id = s.id
        LEFT JOIN ports ep ON c.embarkation_port_id = ep.id
        LEFT JOIN ports dp ON c.disembarkation_port_id = dp.id
        WHERE c.id = ${cruiseId} OR c.cruise_id = ${cruiseId}
        LIMIT 1
      `;

      if (result.length === 0) {
        return null;
      }

      const cruise = result[0];

      // Parse JSON fields safely
      const parseJsonField = (field: any) => {
        if (!field) return null;
        try {
          return typeof field === 'string' ? JSON.parse(field) : field;
        } catch {
          return null;
        }
      };

      return {
        cruise: {
          id: cruise.id,
          cruise_id: cruise.cruise_id,
          name: cruise.name,
          voyage_code: cruise.voyage_code,
          itinerary_code: cruise.itinerary_code,
          sailing_date: cruise.sailing_date,
          return_date:
            cruise.return_date ||
            (cruise.sailing_date && cruise.nights
              ? new Date(
                  new Date(cruise.sailing_date).getTime() + cruise.nights * 24 * 60 * 60 * 1000
                )
                  .toISOString()
                  .split('T')[0]
              : null),
          nights: cruise.nights,
          sail_nights: cruise.sail_nights,
          sea_days: cruise.sea_days,
          embarkation_port_id: cruise.embarkation_port_id,
          disembarkation_port_id: cruise.disembarkation_port_id,
          port_ids: cruise.port_ids,
          region_ids: cruise.region_ids,
          market_id: cruise.market_id,
          owner_id: cruise.owner_id,
          no_fly: cruise.no_fly,
          depart_uk: cruise.depart_uk,
          show_cruise: cruise.show_cruise,
          fly_cruise_info: cruise.fly_cruise_info,
          last_cached: cruise.last_cached,
          cached_date: cruise.cached_date,
          interior_price: cruise.interior_price,
          oceanview_price: cruise.oceanview_price,
          balcony_price: cruise.balcony_price,
          suite_price: cruise.suite_price,
          cheapest_price: cruise.cheapest_price,
          interior_price_code: cruise.interior_price_code,
          oceanview_price_code: cruise.oceanview_price_code,
          balcony_price_code: cruise.balcony_price_code,
          suite_price_code: cruise.suite_price_code,
          currency: cruise.currency,
          is_active: cruise.is_active,
          created_at: cruise.created_at,
          updated_at: cruise.updated_at,
        },
        cruise_line: {
          id: cruise.cruise_line_id,
          name: cruise.cruise_line_name,
          code: cruise.cruise_line_code,
          description: cruise.cruise_line_description,
          engine_name: cruise.cruise_line_engine_name,
          short_name: cruise.cruise_line_short_name,
          title: cruise.cruise_line_title,
          nice_url: cruise.cruise_line_nice_url,
          logo: cruise.cruise_line_logo,
        },
        ship: {
          id: cruise.ship_id,
          name: cruise.ship_name,
          nice_name: cruise.ship_nice_name,
          short_name: cruise.ship_short_name,
          code: cruise.ship_code,
          tonnage: cruise.tonnage,
          total_cabins: cruise.total_cabins,
          max_passengers: cruise.max_passengers,
          crew: cruise.crew,
          length: cruise.ship_length,
          beam: cruise.beam,
          draft: cruise.draft,
          speed: cruise.speed,
          registry: cruise.registry,
          built_year: cruise.built_year,
          refurbished_year: cruise.refurbished_year,
          description: cruise.ship_description,
          star_rating: cruise.star_rating,
          adults_only: cruise.adults_only,
          ship_class: cruise.ship_class,
          default_ship_image: cruise.default_ship_image,
          default_ship_image_hd: cruise.default_ship_image_hd,
          default_ship_image_2k: cruise.default_ship_image_2k,
          nice_url: cruise.ship_nice_url,
        },
        embark_port: cruise.embark_port_name
          ? {
              id: cruise.embarkation_port_id,
              name: cruise.embark_port_name,
              code: cruise.embark_port_code,
              country: cruise.embark_port_country,
            }
          : null,
        disembark_port: cruise.disembark_port_name
          ? {
              id: cruise.disembarkation_port_id,
              name: cruise.disembark_port_name,
              code: cruise.disembark_port_code,
              country: cruise.disembark_port_country,
            }
          : null,
        ports: parseJsonField(cruise.ports) || [],
        regions: parseJsonField(cruise.regions) || [],
        line_content: parseJsonField(cruise.line_content),
        ship_content: parseJsonField(cruise.ship_content),
      };
    } catch (error) {
      logger.error('Error getting cruise details with schema:', error);
      return null;
    }
  }

  async getCruiseBySlug(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params;

      if (!isValidCruiseSlug(slug)) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid cruise slug format',
            details: 'Expected format: ship-name-YYYY-MM-DD-cruiseId',
          },
        });
        return;
      }

      const parsedSlug = parseCruiseSlug(slug);
      if (!parsedSlug) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Could not parse cruise slug',
            details: 'Expected format: ship-name-YYYY-MM-DD-cruiseId',
          },
        });
        return;
      }

      // Try to find cruise by ID first, then by ship name and sailing date
      let cruiseDetails = await this.getCruiseDetailsWithSchema(String(parsedSlug.cruiseId));

      if (!cruiseDetails) {
        // Fallback: try to find by ship name and sailing date
        const fallbackResult = await sql`
          SELECT c.id
          FROM cruises c
          LEFT JOIN ships s ON c.ship_id = s.id
          WHERE LOWER(REPLACE(s.name, ' ', '-')) = LOWER(${parsedSlug.shipName})
            AND c.sailing_date = ${parsedSlug.departureDate}
          LIMIT 1
        `;

        if (fallbackResult.length > 0) {
          cruiseDetails = await this.getCruiseDetailsWithSchema(String(fallbackResult[0].id));
        }
      }

      if (!cruiseDetails) {
        res.status(404).json({
          success: false,
          error: {
            message: 'Cruise not found',
            details: `No cruise found for slug: ${slug}`,
          },
        });
        return;
      }

      res.json({
        success: true,
        data: cruiseDetails,
        meta: {
          slug,
          parsedSlug,
          dataVersion: 'slug-based',
        },
      });
    } catch (error) {
      logger.error(`Get cruise by slug failed for ${req.params.slug}:`, error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to get cruise by slug',
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
      const formattedDate = threeWeeksFromToday.toISOString().split('T')[0];

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
            c.return_date,
            ep.name as embark_port_name,
            c.cheapest_price as cheapest_pricing,
            s.default_ship_image as ship_image,
            ROW_NUMBER() OVER (ORDER BY c.sailing_date ASC) as rn
          FROM cruises c
          LEFT JOIN ships s ON c.ship_id = s.id
          LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
          LEFT JOIN ports ep ON c.embarkation_port_id = ep.id
          WHERE
            c.is_active = true
            AND c.sailing_date >= ${formattedDate}
            AND c.sailing_date <= CURRENT_DATE + INTERVAL '1 year'
            AND c.cheapest_price IS NOT NULL
            AND c.cheapest_price > 0
            AND c.cheapest_price <= 5000
            AND c.name IS NOT NULL
            AND c.nights > 0
            AND (cl.name = ${cruiseLineName} OR cl.name ILIKE ${cruiseLineName + '%'})
            AND cl.name NOT ILIKE '%a-rosa%' AND cl.name NOT ILIKE '%arosa%'
          ORDER BY c.sailing_date ASC
          LIMIT 1
        `;

        if (cruiseForLine.length > 0) {
          const cruise = cruiseForLine[0];
          deals.push({
            ...cruise,
            // Calculate return_date if not set
            return_date:
              cruise.return_date ||
              (cruise.sailing_date && cruise.nights
                ? new Date(
                    new Date(cruise.sailing_date).getTime() + cruise.nights * 24 * 60 * 60 * 1000
                  )
                    .toISOString()
                    .split('T')[0]
                : null),
            // Calculate onboard credit as 20% of cheapest pricing, rounded down to nearest $10
            onboard_credit: Math.floor((cruise.cheapest_pricing * 0.2) / 10) * 10,
            // Ensure we have the correct field names for frontend compatibility
            embarkation_port_name: cruise.embark_port_name,
          });
          usedCruiseLines.add(cruiseLineName);
        }
      }

      // If we don't have 6 deals yet, fill with other cruises
      if (deals.length < 6) {
        const excludedLines = Array.from(usedCruiseLines);

        // Build the WHERE clause conditionally
        let whereConditions = [
          'c.is_active = true',
          `c.sailing_date >= '${formattedDate}'`,
          "c.sailing_date <= CURRENT_DATE + INTERVAL '1 year'",
          'c.cheapest_price IS NOT NULL',
          'c.cheapest_price > 0',
          'c.cheapest_price <= 5000',
          'c.name IS NOT NULL',
          'c.nights > 0',
          "cl.name NOT ILIKE '%a-rosa%'",
          "cl.name NOT ILIKE '%arosa%'",
        ];

        // Add exclusion for already used cruise lines
        if (excludedLines.length > 0) {
          const excludedLinesList = excludedLines
            .map((name: string) => `'${name.replace(/'/g, "''")}'`)
            .join(', ');
          whereConditions.push(`cl.name NOT IN (${excludedLinesList})`);
        }

        const whereClause = whereConditions.join(' AND ');

        const remainingDeals = await sql.unsafe(`
          SELECT
            c.id,
            c.cruise_id,
            c.name,
            s.name as ship_name,
            cl.name as cruise_line_name,
            c.nights,
            c.sailing_date,
            c.return_date,
            ep.name as embark_port_name,
            c.cheapest_price as cheapest_pricing,
            s.default_ship_image as ship_image
          FROM cruises c
          LEFT JOIN ships s ON c.ship_id = s.id
          LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
          LEFT JOIN ports ep ON c.embarkation_port_id = ep.id
          WHERE ${whereClause}
          ORDER BY c.sailing_date ASC
          LIMIT ${6 - deals.length}
        `);

        for (const deal of remainingDeals) {
          deals.push({
            ...deal,
            // Calculate return_date if not set
            return_date:
              deal.return_date ||
              (deal.sailing_date && deal.nights
                ? new Date(
                    new Date(deal.sailing_date).getTime() + deal.nights * 24 * 60 * 60 * 1000
                  )
                    .toISOString()
                    .split('T')[0]
                : null),
            // Calculate onboard credit as 20% of cheapest pricing, rounded down to nearest $10
            onboard_credit: Math.floor((deal.cheapest_pricing * 0.2) / 10) * 10,
            // Ensure we have the correct field names for frontend compatibility
            embarkation_port_name: deal.embark_port_name,
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

  async getCruisePricing(req: Request, res: Response): Promise<void> {
    try {
      const cruiseId = req.params.id;
      const cabinType = req.query.cabinType as string;
      const rateCode = req.query.rateCode as string;

      if (!cruiseId) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid cruise ID',
            details: 'Cruise ID is required',
          },
        });
        return;
      }

      // Get pricing from the cruise record itself first
      const cruisePricing = await sql`
        SELECT
          c.id,
          c.cruise_id,
          c.name,
          c.interior_price,
          c.oceanview_price,
          c.balcony_price,
          c.suite_price,
          c.cheapest_price,
          c.interior_price_code,
          c.oceanview_price_code,
          c.balcony_price_code,
          c.suite_price_code,
          c.currency
        FROM cruises c
        WHERE c.id = ${cruiseId} OR c.cruise_id = ${cruiseId}
        LIMIT 1
      `;

      if (cruisePricing.length === 0) {
        res.status(404).json({
          success: false,
          error: {
            message: 'Cruise not found',
            details: `Cruise with ID ${cruiseId} does not exist`,
          },
        });
        return;
      }

      const cruise = cruisePricing[0];

      // Format pricing options
      const pricingOptions = [];

      if (cruise.interior_price && cruise.interior_price > 0) {
        pricingOptions.push({
          cabin_type: 'Interior',
          cabin_code: 'INT',
          rate_code: cruise.interior_price_code || 'STANDARD',
          price: parseFloat(cruise.interior_price),
          currency: cruise.currency || 'USD',
        });
      }

      if (cruise.oceanview_price && cruise.oceanview_price > 0) {
        pricingOptions.push({
          cabin_type: 'Oceanview',
          cabin_code: 'OV',
          rate_code: cruise.oceanview_price_code || 'STANDARD',
          price: parseFloat(cruise.oceanview_price),
          currency: cruise.currency || 'USD',
        });
      }

      if (cruise.balcony_price && cruise.balcony_price > 0) {
        pricingOptions.push({
          cabin_type: 'Balcony',
          cabin_code: 'BAL',
          rate_code: cruise.balcony_price_code || 'STANDARD',
          price: parseFloat(cruise.balcony_price),
          currency: cruise.currency || 'USD',
        });
      }

      if (cruise.suite_price && cruise.suite_price > 0) {
        pricingOptions.push({
          cabin_type: 'Suite',
          cabin_code: 'SUI',
          rate_code: cruise.suite_price_code || 'STANDARD',
          price: parseFloat(cruise.suite_price),
          currency: cruise.currency || 'USD',
        });
      }

      // Filter by cabin type if specified
      let filteredOptions = pricingOptions;
      if (cabinType) {
        filteredOptions = pricingOptions.filter(option =>
          option.cabin_type.toLowerCase().includes(cabinType.toLowerCase())
        );
      }

      // Filter by rate code if specified
      if (rateCode) {
        filteredOptions = filteredOptions.filter(option =>
          option.rate_code.toLowerCase().includes(rateCode.toLowerCase())
        );
      }

      const pricing = {
        cruise_id: cruise.id,
        cruise_name: cruise.name,
        options: filteredOptions,
        summary: {
          available_options: filteredOptions.length,
          price_range:
            filteredOptions.length > 0
              ? {
                  min: Math.min(...filteredOptions.map(o => o.price)),
                  max: Math.max(...filteredOptions.map(o => o.price)),
                }
              : null,
          cabin_types: [...new Set(filteredOptions.map(o => o.cabin_type))],
          rate_codes: [...new Set(filteredOptions.map(o => o.rate_code))],
          currency: cruise.currency || 'USD',
        },
      };

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

  // Additional methods to maintain API compatibility...
  async getCruiseAvailability(req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      data: {
        cruise_id: req.params.id,
        available: true,
        message: 'Availability check - implementation pending',
      },
    });
  }

  async getCabinPricing(req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      data: {
        cruise_id: req.params.id,
        cabin_code: req.params.cabinCode,
        message: 'Cabin pricing - implementation pending',
      },
    });
  }

  async getCruiseItinerary(req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      data: {
        cruise_id: req.params.id,
        itinerary: [],
        message: 'Itinerary - implementation pending',
      },
    });
  }

  async getShipDetails(req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      data: {
        ship: {},
        message: 'Ship details - implementation pending',
      },
    });
  }
}
