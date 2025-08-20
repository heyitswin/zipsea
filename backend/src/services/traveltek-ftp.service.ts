import Client = require('ftp');
import { promisify } from 'util';
import { Readable } from 'stream';
import { logger } from '../config/logger';
import { env } from '../config/environment';

export interface FTPConfig {
  host: string;
  user: string;
  password: string;
  secure?: boolean;
  connTimeout?: number;
  pasvTimeout?: number;
}

export interface CruiseDataFile {
  year: string;
  month: string;
  lineid: string;
  shipid: string;
  codetocruiseid: string;
  filePath: string;
  lastModified?: Date;
  size?: number;
}

export class TraveltekFTPService {
  private client: Client;
  private isConnected = false;

  constructor() {
    this.client = new Client();
  }

  /**
   * Connect to Traveltek FTP server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const config: FTPConfig = {
        host: env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
        user: env.TRAVELTEK_FTP_USER,
        password: env.TRAVELTEK_FTP_PASSWORD,
        secure: false,
        connTimeout: 60000,
        pasvTimeout: 60000,
      };
      
      // Log connection attempt (without password)
      logger.info('Attempting FTP connection', {
        host: config.host,
        user: config.user ? config.user.substring(0, 3) + '***' : 'NOT SET',
        hasPassword: !!config.password
      });

      this.client.on('ready', () => {
        this.isConnected = true;
        logger.info('Connected to Traveltek FTP server');
        resolve();
      });

      this.client.on('error', (err: any) => {
        this.isConnected = false;
        logger.error('FTP connection error:', {
          message: err.message,
          code: err.code,
          host: config.host,
          user: config.user ? config.user.substring(0, 3) + '***' : 'NOT SET'
        });
        reject(err);
      });

      this.client.on('close', () => {
        this.isConnected = false;
        logger.info('FTP connection closed');
      });

      try {
        this.client.connect(config);
      } catch (error) {
        logger.error('Failed to initiate FTP connection:', error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from FTP server
   */
  async disconnect(): Promise<void> {
    if (this.isConnected) {
      this.client.end();
      this.isConnected = false;
    }
  }

  /**
   * Ensure connection is established
   */
  private async ensureConnected(): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }
  }

  /**
   * List files in a directory
   */
  async listFiles(directory: string): Promise<any[]> {
    await this.ensureConnected();
    
    const list = promisify(this.client.list.bind(this.client));
    try {
      const files = await list(directory);
      return files || [];
    } catch (error) {
      logger.error(`Failed to list files in directory ${directory}:`, error);
      throw error;
    }
  }

  /**
   * Get cruise data file content as JSON
   */
  async getCruiseDataFile(filePath: string): Promise<any> {
    await this.ensureConnected();

    return new Promise((resolve, reject) => {
      this.client.get(filePath, (err, stream) => {
        if (err) {
          logger.error(`Failed to get file ${filePath}:`, err);
          reject(err);
          return;
        }

        let data = '';
        stream.on('data', (chunk: Buffer) => {
          data += chunk.toString();
        });

        stream.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            resolve(jsonData);
          } catch (parseError) {
            logger.error(`Failed to parse JSON from file ${filePath}:`, parseError);
            reject(parseError);
          }
        });

        stream.on('error', (streamError) => {
          logger.error(`Stream error for file ${filePath}:`, streamError);
          reject(streamError);
        });
      });
    });
  }

  /**
   * Parse file path to extract metadata
   */
  parseCruiseFilePath(filePath: string): CruiseDataFile | null {
    // Expected format: [year]/[month]/[lineid]/[shipid]/[codetocruiseid].json
    const pathParts = filePath.split('/');
    
    if (pathParts.length !== 5 || !pathParts[4].endsWith('.json')) {
      return null;
    }

    const [year, month, lineid, shipid, filename] = pathParts;
    const codetocruiseid = filename.replace('.json', '');

    return {
      year,
      month,
      lineid,
      shipid,
      codetocruiseid,
      filePath,
    };
  }

  /**
   * Discover all cruise data files for a specific time period
   */
  async discoverCruiseFiles(
    year?: string,
    month?: string,
    lineid?: string,
    shipid?: string
  ): Promise<CruiseDataFile[]> {
    await this.ensureConnected();
    
    const currentYear = year || new Date().getFullYear().toString();
    const currentMonth = month || String(new Date().getMonth() + 1).padStart(2, '0');
    
    const files: CruiseDataFile[] = [];

    try {
      // If specific parameters are provided, use them
      if (year && month && lineid && shipid) {
        const directory = `${year}/${month}/${lineid}/${shipid}`;
        const dirFiles = await this.listFiles(directory);
        
        for (const file of dirFiles) {
          if (file.name.endsWith('.json')) {
            const filePath = `${directory}/${file.name}`;
            const parsedFile = this.parseCruiseFilePath(filePath);
            if (parsedFile) {
              parsedFile.lastModified = file.date;
              parsedFile.size = file.size;
              files.push(parsedFile);
            }
          }
        }
      } else {
        // Discover files by traversing directory structure
        const years = year ? [year] : await this.getAvailableYears();
        
        for (const yr of years) {
          const months = month ? [month] : await this.getAvailableMonths(yr);
          
          for (const mn of months) {
            const lineids = lineid ? [lineid] : await this.getAvailableLineIds(yr, mn);
            
            for (const lid of lineids) {
              const shipids = shipid ? [shipid] : await this.getAvailableShipIds(yr, mn, lid);
              
              for (const sid of shipids) {
                const directory = `${yr}/${mn}/${lid}/${sid}`;
                try {
                  const dirFiles = await this.listFiles(directory);
                  
                  for (const file of dirFiles) {
                    if (file.name.endsWith('.json')) {
                      const filePath = `${directory}/${file.name}`;
                      const parsedFile = this.parseCruiseFilePath(filePath);
                      if (parsedFile) {
                        parsedFile.lastModified = file.date;
                        parsedFile.size = file.size;
                        files.push(parsedFile);
                      }
                    }
                  }
                } catch (dirError) {
                  logger.warn(`Could not access directory ${directory}:`, dirError);
                }
              }
            }
          }
        }
      }
    } catch (error) {
      logger.error('Failed to discover cruise files:', error);
      throw error;
    }

    logger.info(`Discovered ${files.length} cruise data files`);
    return files;
  }

  /**
   * Get available years
   */
  async getAvailableYears(): Promise<string[]> {
    try {
      const files = await this.listFiles('.');
      return files
        .filter(file => file.type === 'd' && /^\d{4}$/.test(file.name))
        .map(file => file.name)
        .sort();
    } catch (error) {
      logger.error('Failed to get available years:', error);
      return [];
    }
  }

  /**
   * Get available months for a year
   */
  async getAvailableMonths(year: string): Promise<string[]> {
    try {
      const files = await this.listFiles(year);
      return files
        .filter(file => file.type === 'd' && /^\d{2}$/.test(file.name))
        .map(file => file.name)
        .sort();
    } catch (error) {
      logger.error(`Failed to get available months for year ${year}:`, error);
      return [];
    }
  }

  /**
   * Get available line IDs for a year/month
   */
  async getAvailableLineIds(year: string, month: string): Promise<string[]> {
    try {
      const files = await this.listFiles(`${year}/${month}`);
      return files
        .filter(file => file.type === 'd')
        .map(file => file.name)
        .sort();
    } catch (error) {
      logger.error(`Failed to get available line IDs for ${year}/${month}:`, error);
      return [];
    }
  }

  /**
   * Get available ship IDs for a year/month/lineid
   */
  async getAvailableShipIds(year: string, month: string, lineid: string): Promise<string[]> {
    try {
      const files = await this.listFiles(`${year}/${month}/${lineid}`);
      return files
        .filter(file => file.type === 'd')
        .map(file => file.name)
        .sort();
    } catch (error) {
      logger.error(`Failed to get available ship IDs for ${year}/${month}/${lineid}:`, error);
      return [];
    }
  }

  /**
   * Batch download cruise data files
   */
  async batchDownloadCruiseData(
    files: CruiseDataFile[],
    batchSize: number = 10
  ): Promise<{ file: CruiseDataFile; data: any }[]> {
    const results: { file: CruiseDataFile; data: any }[] = [];
    
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (file) => {
        try {
          const data = await this.getCruiseDataFile(file.filePath);
          return { file, data };
        } catch (error) {
          logger.error(`Failed to download file ${file.filePath}:`, error);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(result => result !== null));
      
      // Small delay between batches to be respectful to the FTP server
      if (i + batchSize < files.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  /**
   * Get recent cruise data files (last N days)
   */
  async getRecentCruiseFiles(days: number = 7): Promise<CruiseDataFile[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const allFiles = await this.discoverCruiseFiles();
    
    return allFiles.filter(file => 
      file.lastModified && file.lastModified >= cutoffDate
    );
  }

  /**
   * Check FTP server connectivity
   */
  async healthCheck(): Promise<{ connected: boolean; error?: string }> {
    try {
      await this.ensureConnected();
      const files = await this.listFiles('.');
      return { connected: true };
    } catch (error) {
      return { 
        connected: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

// Singleton instance
export const traveltekFTPService = new TraveltekFTPService();