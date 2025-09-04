import { Client } from 'basic-ftp';
import { env } from '../config/environment';
import logger from '../config/logger';

interface PooledConnection {
  client: Client;
  inUse: boolean;
  lastUsed: Date;
  id: number;
}

/**
 * FTP Connection Pool Manager
 * Maintains persistent FTP connections for efficient bulk operations
 */
export class FTPConnectionPool {
  private pool: PooledConnection[] = [];
  private readonly maxConnections = 5;
  private readonly connectionTimeout = 30000; // 30 seconds
  private readonly idleTimeout = 300000; // 5 minutes
  private connectionCounter = 0;

  constructor() {
    // Cleanup idle connections every minute
    setInterval(() => this.cleanupIdleConnections(), 60000);
  }

  /**
   * Get an available connection from the pool or create a new one
   */
  async getConnection(): Promise<Client> {
    // Try to find an available connection
    const available = this.pool.find(conn => !conn.inUse);
    
    if (available) {
      available.inUse = true;
      available.lastUsed = new Date();
      logger.debug(`Reusing FTP connection #${available.id}`);
      return available.client;
    }

    // Create new connection if pool isn't full
    if (this.pool.length < this.maxConnections) {
      const client = await this.createConnection();
      const connection: PooledConnection = {
        client,
        inUse: true,
        lastUsed: new Date(),
        id: ++this.connectionCounter
      };
      this.pool.push(connection);
      logger.info(`Created new FTP connection #${connection.id} (pool size: ${this.pool.length})`);
      return client;
    }

    // Wait for a connection to become available
    logger.warn('FTP pool exhausted, waiting for available connection...');
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const conn = this.pool.find(c => !c.inUse);
        if (conn) {
          clearInterval(checkInterval);
          conn.inUse = true;
          conn.lastUsed = new Date();
          resolve(conn.client);
        }
      }, 100);
    });
  }

  /**
   * Release a connection back to the pool
   */
  releaseConnection(client: Client): void {
    const connection = this.pool.find(conn => conn.client === client);
    if (connection) {
      connection.inUse = false;
      connection.lastUsed = new Date();
      logger.debug(`Released FTP connection #${connection.id}`);
    }
  }

  /**
   * Create a new FTP connection
   */
  private async createConnection(): Promise<Client> {
    // Check if FTP credentials are configured
    if (!env.TRAVELTEK_FTP_HOST || !env.TRAVELTEK_FTP_USER || !env.TRAVELTEK_FTP_PASSWORD) {
      const missingCreds = [];
      if (!env.TRAVELTEK_FTP_HOST) missingCreds.push('TRAVELTEK_FTP_HOST');
      if (!env.TRAVELTEK_FTP_USER) missingCreds.push('TRAVELTEK_FTP_USER');
      if (!env.TRAVELTEK_FTP_PASSWORD) missingCreds.push('TRAVELTEK_FTP_PASSWORD');
      
      const error = new Error(`Missing FTP credentials: ${missingCreds.join(', ')}`);
      logger.error('FTP credentials not configured:', missingCreds);
      throw error;
    }
    
    const client = new Client();
    client.ftp.verbose = false;
    
    try {
      logger.debug(`Connecting to FTP: ${env.TRAVELTEK_FTP_HOST} as ${env.TRAVELTEK_FTP_USER}`);
      
      await client.access({
        host: env.TRAVELTEK_FTP_HOST,
        user: env.TRAVELTEK_FTP_USER,
        password: env.TRAVELTEK_FTP_PASSWORD,
        secure: false
      });
      
      logger.debug('FTP connection established successfully');
      return client;
    } catch (error) {
      logger.error('Failed to create FTP connection:', {
        error: error instanceof Error ? error.message : error,
        host: env.TRAVELTEK_FTP_HOST,
        user: env.TRAVELTEK_FTP_USER
      });
      throw error;
    }
  }

  /**
   * Clean up idle connections
   */
  private async cleanupIdleConnections(): Promise<void> {
    const now = Date.now();
    const toRemove: number[] = [];

    for (let i = 0; i < this.pool.length; i++) {
      const conn = this.pool[i];
      if (!conn.inUse && (now - conn.lastUsed.getTime()) > this.idleTimeout) {
        try {
          conn.client.close();
          toRemove.push(i);
          logger.debug(`Closed idle FTP connection #${conn.id}`);
        } catch (error) {
          logger.error(`Error closing idle connection #${conn.id}:`, error);
        }
      }
    }

    // Remove closed connections from pool
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.pool.splice(toRemove[i], 1);
    }

    if (toRemove.length > 0) {
      logger.info(`Cleaned up ${toRemove.length} idle connections (pool size: ${this.pool.length})`);
    }
  }

  /**
   * Download multiple files efficiently using a single connection
   */
  async downloadBatch(filePaths: string[]): Promise<Map<string, Buffer>> {
    const client = await this.getConnection();
    const results = new Map<string, Buffer>();
    const errors: string[] = [];
    const { Writable } = require('stream');

    try {
      for (const filePath of filePaths) {
        try {
          // Create a writable stream that collects data into a buffer
          const chunks: Buffer[] = [];
          const writableStream = new Writable({
            write(chunk: Buffer, encoding: string, callback: Function) {
              chunks.push(chunk);
              callback();
            }
          });
          
          // Download to the writable stream
          await client.downloadTo(writableStream, filePath);
          
          // Combine all chunks into a single buffer
          const buffer = Buffer.concat(chunks);
          results.set(filePath, buffer);
        } catch (error) {
          logger.warn(`Failed to download ${filePath}:`, error);
          errors.push(filePath);
        }
      }
    } finally {
      this.releaseConnection(client);
    }

    if (errors.length > 0) {
      logger.warn(`Failed to download ${errors.length}/${filePaths.length} files`);
    }

    return results;
  }

  /**
   * Close all connections
   */
  async closeAll(): Promise<void> {
    logger.info('Closing all FTP connections...');
    for (const conn of this.pool) {
      try {
        conn.client.close();
      } catch (error) {
        logger.error(`Error closing connection #${conn.id}:`, error);
      }
    }
    this.pool = [];
  }
}

// Export singleton instance
export const ftpConnectionPool = new FTPConnectionPool();