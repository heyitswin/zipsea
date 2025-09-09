import * as ftp from 'basic-ftp';
import { ftpConnectionPool } from './ftp-connection-pool.service';
import logger from '../config/logger';

interface CruiseFileLocation {
  cruiseId: string;
  path: string;
  year: string;
  month: string;
  lineId: number;
  shipId?: number;
}

/**
 * Service to search for cruise files in FTP
 * Files are organized as: /isell_json/{year}/{month}/{lineId}/{shipId}/{cruiseId}.json
 */
export class FTPFileSearchService {
  private fileCache = new Map<string, CruiseFileLocation>();
  private lastCacheUpdate = 0;
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes

  /**
   * Find the FTP path for a cruise file
   */
  async findCruiseFile(cruiseId: string, lineId: number, shipId?: number): Promise<string | null> {
    // Check cache first
    const cacheKey = `${lineId}-${cruiseId}`;
    const cached = this.fileCache.get(cacheKey);
    if (cached && Date.now() - this.lastCacheUpdate < this.CACHE_TTL) {
      return cached.path;
    }

    const client = await ftpConnectionPool.getConnection();

    try {
      // Try current year and last 3 months first (most likely locations)
      const now = new Date();
      const searchPaths: string[] = [];

      for (let monthOffset = 0; monthOffset <= 3; monthOffset++) {
        const date = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');

        if (shipId) {
          // The actual structure is: YYYY/MM/lineId/shipId/cruiseId.json
          searchPaths.push(`${year}/${month}/${lineId}/${shipId}/${cruiseId}.json`);
        } else {
          // If no ship ID, we need to check all ship directories
          searchPaths.push(`${year}/${month}/${lineId}/*/${cruiseId}.json`);
        }
      }

      // Try each path
      for (const path of searchPaths) {
        try {
          if (path.includes('*')) {
            // Need to list directories and search
            const basePath = path.substring(0, path.lastIndexOf('/'));
            const parentPath = basePath.substring(0, basePath.lastIndexOf('/'));

            const dirs = await client.client.list(parentPath);
            for (const dir of dirs.filter(d => d.type === 2)) {
              // type 2 = directory
              const fullPath = `${parentPath}/${dir.name}/${cruiseId}.json`;
              try {
                // Try to get file info to check if it exists
                await client.client.size(fullPath);

                // File exists! Cache and return
                const location: CruiseFileLocation = {
                  cruiseId,
                  path: fullPath,
                  year: fullPath.split('/')[2],
                  month: fullPath.split('/')[3],
                  lineId,
                  shipId: parseInt(dir.name),
                };

                this.fileCache.set(cacheKey, location);
                this.lastCacheUpdate = Date.now();

                logger.info(`Found cruise file: ${fullPath}`);
                return fullPath;
              } catch {
                // File doesn't exist in this directory
              }
            }
          } else {
            // Direct path check
            try {
              await client.client.size(path);

              // File exists! Cache and return
              const pathParts = path.split('/');
              const location: CruiseFileLocation = {
                cruiseId,
                path,
                year: pathParts[2],
                month: pathParts[3],
                lineId,
                shipId: shipId || parseInt(pathParts[5]),
              };

              this.fileCache.set(cacheKey, location);
              this.lastCacheUpdate = Date.now();

              logger.info(`Found cruise file: ${path}`);
              return path;
            } catch {
              // File doesn't exist at this path
            }
          }
        } catch (error) {
          logger.debug(`Path not found: ${path}`);
        }
      }

      logger.warn(`Could not find cruise file: ${cruiseId} for line ${lineId}`);
      return null;
    } catch (error) {
      logger.error(`Error searching for cruise file ${cruiseId}:`, error);
      return null;
    } finally {
      ftpConnectionPool.releaseConnection(client.id);
    }
  }

  /**
   * Batch find cruise files
   */
  async findCruiseFiles(
    cruises: Array<{ cruiseId: string; lineId: number; shipId?: number }>
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    // Process in smaller batches to avoid overwhelming FTP
    const batchSize = 10;
    for (let i = 0; i < cruises.length; i += batchSize) {
      const batch = cruises.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async cruise => {
          const path = await this.findCruiseFile(cruise.cruiseId, cruise.lineId, cruise.shipId);
          if (path) {
            results.set(cruise.cruiseId, path);
          }
        })
      );
    }

    return results;
  }

  /**
   * Clear the file cache
   */
  clearCache(): void {
    this.fileCache.clear();
    this.lastCacheUpdate = 0;
  }
}

// Export singleton
export const ftpFileSearchService = new FTPFileSearchService();
