import { logger } from '../config/logger';
import { db } from '../db/connection';
import { sql } from 'drizzle-orm';
import { cruises, cruiseLines, ships, ports } from '../db/schema';
import { ftpConnectionPool } from './ftp-connection-pool.service';
import { Writable } from 'stream';

interface SyncResult {
  lineId: number;
  filesFound: number;
  filesProcessed: number;
  cruisesCreated: number;
  cruisesUpdated: number;
  pricesUpdated: number;
  errors: number;
  duration: number;
  monthsProcessed: string[];
}

interface CruiseData {
  codetocruiseid: string;
  cruiseid: string;
  lineid: number;
  shipid: number;
  name: string;
  saildate: string;
  startdate?: string;
  nights: number;
  sailnights?: number;
  voyagecode?: string;
  itinerarycode?: string;
  startportid?: number;
  endportid?: number;
  portids?: string;
  regionids?: string;
  seadays?: number;
  departuk?: string;
  nofly?: string;
  showcruise?: string;
  ownerid?: string;
  marketid?: string;
  lastcached?: number;
  cacheddate?: string;
  cheapest?: number;
  cheapestinside?: number;
  cheapestoutside?: number;
  cheapestbalcony?: number;
  cheapestsuite?: number;
  cachedprices?: {
    inside?: number;
    outside?: number;
    balcony?: number;
    suite?: number;
  };
  linecontent?: any;
  shipcontent?: any;
  itinerary?: any[];
  ports?: any;
  regions?: any;
}

/**
 * Comprehensive FTP Sync Service
 * Downloads and syncs ALL cruise data from FTP for a given cruise line
 */
export class FTPComprehensiveSyncService {
  private readonly MONTHS_TO_SYNC = 24; // Sync next 2 years
  private readonly MAX_FILES_PER_BATCH = 100;
  private readonly MAX_RETRIES = 3;

  /**
   * Sync all cruise data for a specific cruise line
   */
  async syncCruiseLine(lineId: number): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      lineId,
      filesFound: 0,
      filesProcessed: 0,
      cruisesCreated: 0,
      cruisesUpdated: 0,
      pricesUpdated: 0,
      errors: 0,
      duration: 0,
      monthsProcessed: [],
    };

    logger.info(`🚀 Starting comprehensive FTP sync for cruise line ${lineId}`);

    let connection: any = null;

    try {
      // Get FTP connection
      connection = await ftpConnectionPool.getConnection();
      logger.info(`🔗 Got FTP connection for line ${lineId}`);

      // Generate all paths to check (current month + next 24 months)
      const pathsToCheck = this.generateFTPPaths(lineId);
      logger.info(`📂 Will check ${pathsToCheck.length} month directories for line ${lineId}`);

      // Process each month
      for (const monthPath of pathsToCheck) {
        try {
          logger.info(`📅 Processing ${monthPath}...`);

          // Get all ship directories for this month
          const shipDirs = await connection.list(monthPath);
          const directories = shipDirs.filter((item: any) => item.type === 2);

          if (directories.length === 0) {
            logger.debug(`  No ships found in ${monthPath}`);
            continue;
          }

          result.monthsProcessed.push(monthPath);

          // Process each ship directory
          for (const shipDir of directories) {
            const shipPath = `${monthPath}/${shipDir.name}`;
            const shipId = parseInt(shipDir.name);

            logger.info(`  🚢 Ship ${shipId}: checking ${shipPath}...`);

            try {
              // Get all cruise files for this ship
              const files = await connection.list(shipPath);
              const jsonFiles = files.filter((f: any) => f.name.endsWith('.json'));

              result.filesFound += jsonFiles.length;
              logger.info(`    Found ${jsonFiles.length} cruise files`);

              // Process files in batches
              for (let i = 0; i < jsonFiles.length; i += this.MAX_FILES_PER_BATCH) {
                const batch = jsonFiles.slice(i, i + this.MAX_FILES_PER_BATCH);
                const batchResult = await this.processBatch(
                  connection,
                  batch,
                  shipPath,
                  lineId,
                  shipId
                );

                result.filesProcessed += batchResult.processed;
                result.cruisesCreated += batchResult.created;
                result.cruisesUpdated += batchResult.updated;
                result.pricesUpdated += batchResult.pricesUpdated;
                result.errors += batchResult.errors;
              }
            } catch (err) {
              logger.error(`Error processing ship ${shipId}:`, err);
              result.errors++;
            }
          }
        } catch (err) {
          logger.warn(`Cannot access ${monthPath}: ${err}`);
          // Continue with next month
        }
      }

      // Update cruise line sync timestamp
      await db.execute(sql`
        UPDATE cruise_lines
        SET last_sync_at = CURRENT_TIMESTAMP
        WHERE id = ${lineId}
      `);
    } catch (error) {
      logger.error(`❌ Error during comprehensive sync for line ${lineId}:`, error);
      result.errors++;
    } finally {
      if (connection) {
        ftpConnectionPool.releaseConnection(connection);
      }

      result.duration = Date.now() - startTime;

      logger.info(`✅ Comprehensive sync completed for line ${lineId}:`, {
        ...result,
        durationSeconds: Math.round(result.duration / 1000),
      });
    }

    return result;
  }

  /**
   * Generate all FTP paths to check for a cruise line
   */
  private generateFTPPaths(lineId: number): string[] {
    const paths: string[] = [];
    const now = new Date();

    for (let monthOffset = 0; monthOffset < this.MONTHS_TO_SYNC; monthOffset++) {
      const checkDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
      const year = checkDate.getFullYear();
      const month = String(checkDate.getMonth() + 1).padStart(2, '0');
      paths.push(`${year}/${month}/${lineId}`);
    }

    return paths;
  }

  /**
   * Process a batch of cruise files
   */
  private async processBatch(
    connection: any,
    files: any[],
    shipPath: string,
    lineId: number,
    shipId: number
  ): Promise<{
    processed: number;
    created: number;
    updated: number;
    pricesUpdated: number;
    errors: number;
  }> {
    const result = {
      processed: 0,
      created: 0,
      updated: 0,
      pricesUpdated: 0,
      errors: 0,
    };

    // Download all files in the batch
    const downloads: { file: any; data: CruiseData | null }[] = [];

    for (const file of files) {
      const filePath = `${shipPath}/${file.name}`;
      const codetocruiseid = file.name.replace('.json', '');

      try {
        logger.debug(`      ⬇️ Downloading ${file.name}...`);

        // Download file content
        const chunks: Buffer[] = [];
        const writableStream = new Writable({
          write(chunk: Buffer, encoding: string, callback: Function) {
            chunks.push(chunk);
            callback();
          },
        });

        await Promise.race([
          connection.downloadTo(writableStream, filePath),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Download timeout')), 30000)
          ),
        ]);

        // Parse JSON
        const buffer = Buffer.concat(chunks);
        const content = buffer.toString();
        const data = JSON.parse(content) as CruiseData;

        downloads.push({ file, data });
      } catch (err) {
        logger.error(`      ❌ Failed to download/parse ${file.name}:`, err);
        downloads.push({ file, data: null });
        result.errors++;
      }
    }

    // Process all downloaded files
    for (const download of downloads) {
      if (!download.data) continue;

      try {
        const processed = await this.upsertCruise(download.data, lineId, shipId);

        result.processed++;
        if (processed.created) {
          result.created++;
        } else {
          result.updated++;
        }
        if (processed.priceUpdated) {
          result.pricesUpdated++;
        }
      } catch (err) {
        logger.error(`Error processing cruise:`, err);
        result.errors++;
      }
    }

    return result;
  }

  /**
   * Upsert cruise data and prices
   */
  private async upsertCruise(
    data: CruiseData,
    lineId: number,
    shipId: number
  ): Promise<{ created: boolean; priceUpdated: boolean }> {
    const cruiseId = String(data.codetocruiseid);
    const sailingDate = data.saildate || data.startdate;

    // Extract prices
    const prices = {
      interior: data.cheapestinside ? parseFloat(String(data.cheapestinside)) : null,
      oceanview: data.cheapestoutside ? parseFloat(String(data.cheapestoutside)) : null,
      balcony: data.cheapestbalcony ? parseFloat(String(data.cheapestbalcony)) : null,
      suite: data.cheapestsuite ? parseFloat(String(data.cheapestsuite)) : null,
    };

    // Check cached prices as fallback
    if (data.cachedprices) {
      prices.interior =
        prices.interior ||
        (data.cachedprices.inside ? parseFloat(String(data.cachedprices.inside)) : null);
      prices.oceanview =
        prices.oceanview ||
        (data.cachedprices.outside ? parseFloat(String(data.cachedprices.outside)) : null);
      prices.balcony =
        prices.balcony ||
        (data.cachedprices.balcony ? parseFloat(String(data.cachedprices.balcony)) : null);
      prices.suite =
        prices.suite ||
        (data.cachedprices.suite ? parseFloat(String(data.cachedprices.suite)) : null);
    }

    // Calculate cheapest price
    const validPrices = [prices.interior, prices.oceanview, prices.balcony, prices.suite].filter(
      p => p !== null && p > 0
    ) as number[];
    const cheapestPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;

    // First, ensure cruise line exists
    await db.execute(sql`
      INSERT INTO cruise_lines (id, name, code, is_active)
      VALUES (
        ${lineId},
        ${data.linecontent?.name || `Cruise Line ${lineId}`},
        ${data.linecontent?.code || `CL${lineId}`},
        true
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        updated_at = CURRENT_TIMESTAMP
    `);

    // Ensure ship exists
    await db.execute(sql`
      INSERT INTO ships (id, cruise_line_id, name, code, is_active)
      VALUES (
        ${shipId},
        ${lineId},
        ${data.shipcontent?.name || `Ship ${shipId}`},
        ${data.shipcontent?.code || `S${shipId}`},
        true
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        cruise_line_id = EXCLUDED.cruise_line_id,
        updated_at = CURRENT_TIMESTAMP
    `);

    // Ensure ports exist if provided
    if (data.startportid) {
      await db.execute(sql`
        INSERT INTO ports (id, name, code, is_active)
        VALUES (
          ${data.startportid},
          ${data.ports?.[data.startportid] || `Port ${data.startportid}`},
          ${`P${data.startportid}`},
          true
        )
        ON CONFLICT (id) DO NOTHING
      `);
    }

    if (data.endportid) {
      await db.execute(sql`
        INSERT INTO ports (id, name, code, is_active)
        VALUES (
          ${data.endportid},
          ${data.ports?.[data.endportid] || `Port ${data.endportid}`},
          ${`P${data.endportid}`},
          true
        )
        ON CONFLICT (id) DO NOTHING
      `);
    }

    // Upsert cruise with all data including prices
    const upsertResult = await db.execute(sql`
      INSERT INTO cruises (
        id,
        cruise_id,
        cruise_line_id,
        ship_id,
        name,
        sailing_date,
        return_date,
        nights,
        voyage_code,
        itinerary_code,
        embarkation_port_id,
        disembarkation_port_id,
        port_ids,
        region_ids,
        sea_days,
        depart_uk,
        no_fly,
        show_cruise,
        market_id,
        owner_id,
        last_cached,
        cached_date,
        interior_price,
        oceanview_price,
        balcony_price,
        suite_price,
        cheapest_price,
        needs_price_update,
        is_active
      ) VALUES (
        ${cruiseId},
        ${String(data.cruiseid)},
        ${lineId},
        ${shipId},
        ${data.name},
        ${sailingDate},
        ${this.calculateReturnDate(sailingDate, data.nights || data.sailnights || 0)},
        ${data.nights || data.sailnights || 0},
        ${data.voyagecode || null},
        ${data.itinerarycode || null},
        ${data.startportid || null},
        ${data.endportid || null},
        ${data.portids || null},
        ${data.regionids || null},
        ${data.seadays || null},
        ${data.departuk === 'Y'},
        ${data.nofly === 'Y'},
        ${data.showcruise !== 'N'},
        ${data.marketid || null},
        ${data.ownerid || null},
        ${data.lastcached || null},
        ${data.cacheddate || null},
        ${prices.interior},
        ${prices.oceanview},
        ${prices.balcony},
        ${prices.suite},
        ${cheapestPrice},
        false,
        true
      )
      ON CONFLICT (id) DO UPDATE SET
        cruise_id = EXCLUDED.cruise_id,
        name = EXCLUDED.name,
        sailing_date = EXCLUDED.sailing_date,
        return_date = EXCLUDED.return_date,
        nights = EXCLUDED.nights,
        voyage_code = EXCLUDED.voyage_code,
        itinerary_code = EXCLUDED.itinerary_code,
        embarkation_port_id = EXCLUDED.embarkation_port_id,
        disembarkation_port_id = EXCLUDED.disembarkation_port_id,
        port_ids = EXCLUDED.port_ids,
        region_ids = EXCLUDED.region_ids,
        sea_days = EXCLUDED.sea_days,
        depart_uk = EXCLUDED.depart_uk,
        no_fly = EXCLUDED.no_fly,
        show_cruise = EXCLUDED.show_cruise,
        market_id = EXCLUDED.market_id,
        owner_id = EXCLUDED.owner_id,
        last_cached = EXCLUDED.last_cached,
        cached_date = EXCLUDED.cached_date,
        interior_price = EXCLUDED.interior_price,
        oceanview_price = EXCLUDED.oceanview_price,
        balcony_price = EXCLUDED.balcony_price,
        suite_price = EXCLUDED.suite_price,
        cheapest_price = EXCLUDED.cheapest_price,
        needs_price_update = false,
        updated_at = CURRENT_TIMESTAMP
      RETURNING (xmax = 0) as created
    `);

    const created = upsertResult[0]?.created || false;

    // Create price snapshot if prices were updated
    if (cheapestPrice) {
      await this.createPriceSnapshot(cruiseId, prices, cheapestPrice);
    }

    logger.debug(`      ${created ? '✨ Created' : '✅ Updated'} cruise ${cruiseId}: ${data.name}`);

    return {
      created,
      priceUpdated: cheapestPrice !== null,
    };
  }

  /**
   * Calculate return date based on sailing date and nights
   */
  private calculateReturnDate(sailingDate: string, nights: number): string {
    const date = new Date(sailingDate);
    date.setDate(date.getDate() + nights);
    return date.toISOString().split('T')[0];
  }

  /**
   * Create price snapshot for historical tracking
   */
  private async createPriceSnapshot(
    cruiseId: string,
    prices: any,
    cheapestPrice: number | null
  ): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO price_history (
          cruise_id,
          interior_price,
          oceanview_price,
          balcony_price,
          suite_price,
          cheapest_price,
          snapshot_date
        ) VALUES (
          ${cruiseId},
          ${prices.interior},
          ${prices.oceanview},
          ${prices.balcony},
          ${prices.suite},
          ${cheapestPrice},
          CURRENT_DATE
        )
        ON CONFLICT (cruise_id, snapshot_date) DO UPDATE SET
          interior_price = EXCLUDED.interior_price,
          oceanview_price = EXCLUDED.oceanview_price,
          balcony_price = EXCLUDED.balcony_price,
          suite_price = EXCLUDED.suite_price,
          cheapest_price = EXCLUDED.cheapest_price,
          updated_at = CURRENT_TIMESTAMP
      `);
    } catch (err) {
      logger.warn(`Could not create price snapshot for cruise ${cruiseId}:`, err);
    }
  }
}

export const ftpComprehensiveSyncService = new FTPComprehensiveSyncService();
