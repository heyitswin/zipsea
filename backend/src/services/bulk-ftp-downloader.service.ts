import { logger } from '../utils/logger';
import * as ftp from 'basic-ftp';
import { env } from '../config/environment';

export interface BulkDownloadResult {
  lineId: number;
  totalFiles: number;
  successfulDownloads: number;
  failedDownloads: number;
  downloadedData: Map<string, any>;
  errors: string[];
  duration: number;
}

/**
 * Efficient FTP service that downloads multiple files in a single session
 * Solves the bottleneck of individual connections per cruise
 */
export class BulkFtpDownloaderService {
  private static instance: BulkFtpDownloaderService;
  private connectionPool: ftp.Client[] = [];
  private readonly MAX_CONNECTIONS = 3;
  private readonly MAX_RETRIES = 3;
  private readonly CHUNK_SIZE = 100; // Download 100 files per batch
  
  private constructor() {}
  
  static getInstance(): BulkFtpDownloaderService {
    if (!this.instance) {
      this.instance = new BulkFtpDownloaderService();
    }
    return this.instance;
  }
  
  /**
   * Download all cruise JSON files for a specific line
   * Uses a single FTP connection to download multiple files
   */
  async downloadLineUpdates(
    lineId: number, 
    cruiseIds: string[],
    shipNames: string[]
  ): Promise<BulkDownloadResult> {
    const startTime = Date.now();
    const result: BulkDownloadResult = {
      lineId,
      totalFiles: cruiseIds.length,
      successfulDownloads: 0,
      failedDownloads: 0,
      downloadedData: new Map(),
      errors: [],
      duration: 0
    };
    
    let client: ftp.Client | null = null;
    
    try {
      // Get or create FTP connection
      client = await this.getConnection();
      
      logger.info(`🚀 Starting bulk download for line ${lineId}`, {
        totalFiles: cruiseIds.length,
        ships: [...new Set(shipNames)].length
      });
      
      // Process in chunks to avoid memory issues
      for (let i = 0; i < cruiseIds.length; i += this.CHUNK_SIZE) {
        const chunk = cruiseIds.slice(i, i + this.CHUNK_SIZE);
        const chunkShips = shipNames.slice(i, i + this.CHUNK_SIZE);
        const chunkNumber = Math.floor(i / this.CHUNK_SIZE) + 1;
        const totalChunks = Math.ceil(cruiseIds.length / this.CHUNK_SIZE);
        
        logger.info(`📦 Processing chunk ${chunkNumber}/${totalChunks} (${chunk.length} files)`);
        
        // Download all files in this chunk using the SAME connection
        await this.downloadChunk(client, lineId, chunk, chunkShips, result);
        
        // Small delay between chunks to be nice to the server
        if (i + this.CHUNK_SIZE < cruiseIds.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      result.duration = Date.now() - startTime;
      
      logger.info(`✅ Bulk download completed for line ${lineId}`, {
        totalFiles: result.totalFiles,
        successful: result.successfulDownloads,
        failed: result.failedDownloads,
        duration: `${(result.duration / 1000).toFixed(2)}s`,
        successRate: `${Math.round((result.successfulDownloads / result.totalFiles) * 100)}%`
      });
      
    } catch (error) {
      logger.error(`❌ Bulk download failed for line ${lineId}:`, error);
      result.errors.push(`Fatal error: ${error.message}`);
    } finally {
      // Return connection to pool for reuse
      if (client) {
        this.returnConnection(client);
      }
    }
    
    return result;
  }
  
  /**
   * Download a chunk of files using a single FTP connection
   */
  private async downloadChunk(
    client: ftp.Client,
    lineId: number,
    cruiseIds: string[],
    shipNames: string[],
    result: BulkDownloadResult
  ): Promise<void> {
    // Group by ship to minimize directory changes
    const shipGroups = new Map<string, string[]>();
    
    for (let i = 0; i < cruiseIds.length; i++) {
      const ship = shipNames[i].replace(/ /g, '_');
      if (!shipGroups.has(ship)) {
        shipGroups.set(ship, []);
      }
      shipGroups.get(ship)!.push(cruiseIds[i]);
    }
    
    // Process each ship's files
    for (const [ship, cruises] of shipGroups) {
      const shipDir = `/2025/09/${lineId}/${ship}`;
      
      try {
        // Change to ship directory once
        await client.cd(shipDir);
        
        // Download all cruise files for this ship
        for (const cruiseId of cruises) {
          try {
            const fileName = `${cruiseId}.json`;
            
            // Use streaming to avoid memory issues
            const chunks: Buffer[] = [];
            const stream = await client.downloadTo(
              writable => writable,
              fileName
            );
            
            // Collect data
            stream.on('data', chunk => chunks.push(chunk));
            
            await new Promise((resolve, reject) => {
              stream.on('end', resolve);
              stream.on('error', reject);
            });
            
            const data = Buffer.concat(chunks).toString('utf-8');
            const jsonData = JSON.parse(data);
            
            result.downloadedData.set(cruiseId, jsonData);
            result.successfulDownloads++;
            
          } catch (fileError) {
            logger.debug(`Failed to download ${cruiseId}: ${fileError.message}`);
            result.failedDownloads++;
            result.errors.push(`${cruiseId}: ${fileError.message}`);
          }
        }
        
      } catch (dirError) {
        logger.warn(`Failed to access ship directory ${shipDir}: ${dirError.message}`);
        result.failedDownloads += cruises.length;
        result.errors.push(`Ship ${ship}: ${dirError.message}`);
      }
    }
  }
  
  /**
   * Get a connection from the pool or create a new one
   */
  private async getConnection(): Promise<ftp.Client> {
    // Try to reuse existing connection
    if (this.connectionPool.length > 0) {
      const client = this.connectionPool.pop()!;
      
      // Test if connection is still alive
      try {
        await client.pwd();
        return client;
      } catch {
        // Connection is dead, create new one
        logger.debug('Pooled connection was dead, creating new one');
      }
    }
    
    // Create new connection
    const client = new ftp.Client();
    client.ftp.verbose = false;
    
    await client.access({
      host: env.TRAVELTEK_FTP_HOST,
      user: env.TRAVELTEK_FTP_USER,
      password: env.TRAVELTEK_FTP_PASSWORD,
      secure: false,
      connTimeout: 30000,
      pasvTimeout: 30000
    });
    
    logger.info('📡 Established new FTP connection');
    return client;
  }
  
  /**
   * Return a connection to the pool for reuse
   */
  private returnConnection(client: ftp.Client): void {
    if (this.connectionPool.length < this.MAX_CONNECTIONS) {
      this.connectionPool.push(client);
    } else {
      // Pool is full, close this connection
      client.close().catch(() => {});
    }
  }
  
  /**
   * Clean up all connections
   */
  async cleanup(): Promise<void> {
    for (const client of this.connectionPool) {
      try {
        await client.close();
      } catch {
        // Ignore errors during cleanup
      }
    }
    this.connectionPool = [];
  }
}

// Export singleton instance
export const bulkFtpDownloader = BulkFtpDownloaderService.getInstance();